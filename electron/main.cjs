const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');

const seedData = require('../src/seed-data.cjs');
const {
  CORRECTION_SCHEMA,
  METADATA_SCHEMA,
  buildChatMessages,
  buildCorrectionMessages,
  buildMetadataMessages,
  validateCorrectionResponse,
  validateMetadataResponse
} = require('../src/agent-contracts.cjs');
const {
  helperForExtension,
  inferResourceType,
  normalizeList,
  previewKind,
  safeFilename,
  searchResources,
  validateHttpUrl
} = require('../src/library-utils.cjs');
const { bytesToGiB, recommendModel, selectGpuName } = require('../src/hardware-advisor.cjs');

const OLLAMA_BASE = 'http://127.0.0.1:11434';
const READABLE_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml', '.rtf']);
const OFFICIAL_HOSTS = new Set([
  'ollama.com', 'www.ollama.com', 'docs.ollama.com',
  'libreoffice.org', 'www.libreoffice.org',
  'calibre-ebook.com', 'www.calibre-ebook.com',
  'videolan.org', 'www.videolan.org',
  '7-zip.org', 'www.7-zip.org',
  'gimp.org', 'www.gimp.org'
]);

let mainWindow;
let db;
let settings;
let settingsPath;
let databasePath;
let managedLibraryPath;
let backupTimer;

if (process.env.PSYSHELF_TEST_DATA_DIR) {
  app.setPath('userData', path.resolve(process.env.PSYSHELF_TEST_DATA_DIR));
}

/** Returns the current timestamp in the database's ISO format. */
function now() {
  return new Date().toISOString();
}

/** Creates a collision-resistant identifier for stored records. */
function randomId() {
  return crypto.randomUUID();
}

/** Loads user settings while preserving safe defaults for missing fields. */
function readSettings() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  const defaults = {
    model: 'qwen3:4b',
    backupFolder: '',
    hardwareRecommendation: null
  };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  } catch {
    return defaults;
  }
}

/** Persists the current application settings to the user-data folder. */
function writeSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

/** Opens the SQLite database, creates its schema, and seeds an empty library. */
function initDatabase() {
  databasePath = path.join(app.getPath('userData'), 'psyshelf.sqlite');
  managedLibraryPath = path.join(app.getPath('userData'), 'library-files');
  fs.mkdirSync(managedLibraryPath, { recursive: true });
  db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = DELETE;
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '[]',
      categories TEXT NOT NULL DEFAULT '[]',
      languages TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      source_kind TEXT NOT NULL DEFAULT 'manual',
      file_path TEXT,
      url TEXT,
      storage_mode TEXT,
      extension TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      resource_id TEXT NOT NULL,
      requested_changes TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      decision TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS total FROM resources').get().total;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO resources
      (id, title, authors, categories, languages, description, source_kind, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'google-sheet', ?, ?, ?)
    `);
    const createdAt = now();
    for (const item of seedData) {
      insert.run(
        randomId(), item.title, JSON.stringify(item.authors), JSON.stringify(item.categories),
        JSON.stringify(item.languages), item.description, item.status || 'ready', createdAt, createdAt
      );
    }
  }
}

/** Converts a SQLite row into the renderer-facing resource shape. */
function fromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    authors: JSON.parse(row.authors || '[]'),
    categories: JSON.parse(row.categories || '[]'),
    languages: JSON.parse(row.languages || '[]'),
    description: row.description || '',
    sourceKind: row.source_kind,
    filePath: row.file_path,
    url: row.url,
    storageMode: row.storage_mode,
    extension: row.extension,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/** Retrieves one resource by identifier or returns null. */
function getResource(id) {
  return fromRow(db.prepare('SELECT * FROM resources WHERE id = ?').get(id));
}

/** Lists resources with optional query, category, and language filters. */
function listResources(filters = {}) {
  let resources = db.prepare('SELECT * FROM resources ORDER BY updated_at DESC, title COLLATE NOCASE').all().map(fromRow);
  if (filters.query) resources = searchResources(resources, filters.query);
  if (filters.category) resources = resources.filter(item => item.categories.includes(filters.category));
  if (filters.language) resources = resources.filter(item => item.languages.includes(filters.language));
  return resources;
}

/** Inserts a normalized resource and schedules a cloud-folder backup. */
function insertResource(item) {
  const timestamp = now();
  const id = randomId();
  db.prepare(`
    INSERT INTO resources
    (id, title, authors, categories, languages, description, source_kind, file_path, url, storage_mode, extension, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(item.title || 'Untitled resource').trim(),
    JSON.stringify(normalizeList(item.authors)),
    JSON.stringify(normalizeList(item.categories)),
    JSON.stringify(normalizeList(item.languages)),
    String(item.description || '').trim(),
    item.sourceKind || 'manual',
    item.filePath || null,
    item.url || null,
    item.storageMode || null,
    item.extension || null,
    item.status || 'draft',
    timestamp,
    timestamp
  );
  scheduleBackup();
  return getResource(id);
}

/** Applies editable metadata fields to an existing resource. */
function updateResource(id, patch) {
  const current = getResource(id);
  if (!current) throw new Error('Resource not found.');
  const next = {
    title: patch.title !== undefined ? String(patch.title).trim() || current.title : current.title,
    authors: patch.authors !== undefined ? normalizeList(patch.authors) : current.authors,
    categories: patch.categories !== undefined ? normalizeList(patch.categories) : current.categories,
    languages: patch.languages !== undefined ? normalizeList(patch.languages) : current.languages,
    description: patch.description !== undefined ? String(patch.description).trim() : current.description,
    status: patch.status !== undefined ? String(patch.status) : current.status
  };
  db.prepare(`
    UPDATE resources
    SET title = ?, authors = ?, categories = ?, languages = ?, description = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.title, JSON.stringify(next.authors), JSON.stringify(next.categories), JSON.stringify(next.languages),
    next.description, next.status, now(), id
  );
  scheduleBackup();
  return getResource(id);
}

/** Finds a non-conflicting destination inside the managed library folder. */
function uniqueManagedPath(sourcePath) {
  const ext = path.extname(sourcePath);
  const base = safeFilename(path.basename(sourcePath, ext));
  let candidate = path.join(managedLibraryPath, `${base}${ext}`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(managedLibraryPath, `${base}-${counter}${ext}`);
    counter += 1;
  }
  return candidate;
}

/** Reads a bounded text excerpt only from known text-based formats. */
function readableText(filePath) {
  if (!READABLE_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return '';
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, 24000);
  } catch {
    return '';
  }
}

/** Checks the local Ollama service and reports installed model readiness. */
async function getOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) throw new Error('Ollama did not respond.');
    const data = await response.json();
    const models = (data.models || []).map(model => model.name);
    return {
      available: true,
      models,
      configuredModel: settings.model,
      modelReady: models.some(model => model === settings.model || model.startsWith(`${settings.model}:`))
    };
  } catch {
    return { available: false, models: [], configuredModel: settings.model, modelReady: false };
  }
}

/** Sends a bounded local-model request with an optional JSON response schema. */
async function callOllama(messages, responseFormat = null) {
  const status = await getOllamaStatus();
  if (!status.available) throw new Error('Ollama is not running. Open Agent settings for the free local setup.');
  const model = status.models.includes(settings.model) ? settings.model : status.models[0];
  if (!model) throw new Error(`No local model is installed. Run: ollama pull ${settings.model}`);
  const payload = { model, messages, stream: false, options: { temperature: responseFormat ? 0 : 0.15 } };
  if (responseFormat) payload.format = responseFormat;
  const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`Local model error (${response.status}).`);
  const data = await response.json();
  return data.message?.content || '';
}

/** Debounces automatic backups after database mutations. */
function scheduleBackup() {
  if (!settings?.backupFolder) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    try { performBackup(); } catch (error) { console.error('Automatic backup failed:', error); }
  }, 800);
}

/** Copies the database and managed files into the configured sync folder. */
function performBackup() {
  if (!settings.backupFolder) throw new Error('Choose a Google Drive or cloud-synced folder first.');
  const targetRoot = path.join(settings.backupFolder, 'PsyShelf Backup');
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.copyFileSync(databasePath, path.join(targetRoot, 'psyshelf.sqlite'));
  if (fs.existsSync(managedLibraryPath)) {
    fs.cpSync(managedLibraryPath, path.join(targetRoot, 'library-files'), { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(targetRoot, 'backup-info.json'), JSON.stringify({ updatedAt: now(), version: app.getVersion() }, null, 2));
  return { folder: targetRoot, updatedAt: now() };
}

/** Creates the sandboxed PsyShelf desktop window. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 900,
    minWidth: 1050,
    minHeight: 680,
    backgroundColor: '#f5f2ea',
    title: 'PsyShelf',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

/** Retrieves one resource or raises a consistent not-found error. */
function requireResource(id) {
  const resource = getResource(id);
  if (!resource) throw new Error('Resource not found.');
  return resource;
}

/** Creates a non-conflicting share-package directory. */
function createShareFolder(root, title) {
  const baseName = `${safeFilename(title)}-share`;
  let target = path.join(root, baseName);
  let counter = 2;
  while (fs.existsSync(target)) target = path.join(root, `${baseName}-${counter++}`);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

/** Imports selected files as references or managed copies. */
async function handleAddFiles(_event, options = {}) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add resources to PsyShelf',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'All files', extensions: ['*'] }]
  });
  if (result.canceled) return [];
  const storageMode = options.storageMode === 'copy' ? 'copy' : 'reference';
  return result.filePaths.map(sourcePath => {
    const filePath = storageMode === 'copy' ? uniqueManagedPath(sourcePath) : sourcePath;
    if (storageMode === 'copy') fs.copyFileSync(sourcePath, filePath);
    const extension = path.extname(filePath).toLowerCase();
    return insertResource({
      title: path.basename(filePath, extension),
      authors: [],
      categories: [inferResourceType(filePath)],
      languages: [],
      description: 'Awaiting metadata analysis or manual description.',
      sourceKind: 'file',
      filePath,
      storageMode,
      extension,
      status: 'draft'
    });
  });
}

/** Returns the catalog list requested by the renderer. */
function handleListResources(_event, filters) {
  return listResources(filters);
}

/** Adds a validated web link to the catalog. */
function handleAddUrl(_event, resource) {
  const url = validateHttpUrl(resource.url);
  if (!url) throw new Error('Enter a valid http or https URL.');
  const categories = normalizeList(resource.categories);
  return insertResource({
    ...resource,
    url,
    sourceKind: 'url',
    categories: categories.length ? categories : ['URL'],
    status: resource.status || 'ready'
  });
}

/** Removes a catalog entry while always preserving its original file. */
function handleDeleteResource(_event, id) {
  const resource = getResource(id);
  if (!resource) return { deleted: false };
  db.prepare('DELETE FROM resources WHERE id = ?').run(id);
  scheduleBackup();
  return {
    deleted: true,
    preservedFile: Boolean(resource.filePath),
    message: resource.filePath ? 'The library entry was removed. Its file was preserved.' : 'The library entry was removed.'
  };
}

/** Opens a resource in the user's default browser or Windows application. */
async function handleOpenResource(_event, id) {
  const resource = requireResource(id);
  if (resource.url) {
    const url = validateHttpUrl(resource.url);
    if (!url) throw new Error('This link is not valid.');
    await shell.openExternal(url);
    return { opened: true };
  }
  if (!resource.filePath || !fs.existsSync(resource.filePath)) throw new Error('The referenced file could not be found.');
  const error = await shell.openPath(resource.filePath);
  if (error) throw new Error(error);
  return { opened: true };
}

/** Returns safe preview metadata or a compatible helper recommendation. */
function handlePreviewResource(_event, id) {
  const resource = requireResource(id);
  if (resource.url) return { kind: 'url', url: resource.url, helper: { builtIn: false, name: 'Web browser', reason: 'Open this resource in your default browser.' } };
  if (!resource.filePath || !fs.existsSync(resource.filePath)) return { kind: 'missing', helper: helperForExtension(resource.filePath || resource.extension || '') };
  const kind = previewKind(resource.filePath);
  const response = {
    kind,
    fileUrl: pathToFileURL(resource.filePath).toString(),
    helper: helperForExtension(resource.filePath),
    filename: path.basename(resource.filePath)
  };
  if (kind === 'text') response.content = readableText(resource.filePath);
  return response;
}

/** Exports shareable metadata and optionally a copyright-permitted file copy. */
async function handleShareResource(_event, id, includeFile) {
  const resource = requireResource(id);
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder for the shared entry',
    properties: ['openDirectory', 'createDirectory']
  });
  if (selection.canceled) return { canceled: true };
  const target = createShareFolder(selection.filePaths[0], resource.title);
  const shared = { ...resource, filePath: undefined, sharedAt: now() };
  fs.writeFileSync(path.join(target, 'resource.json'), JSON.stringify(shared, null, 2), 'utf8');
  const fileIncluded = Boolean(includeFile && resource.filePath && fs.existsSync(resource.filePath));
  if (fileIncluded) fs.copyFileSync(resource.filePath, path.join(target, path.basename(resource.filePath)));
  return { canceled: false, folder: target, fileIncluded };
}

/** Runs the bounded metadata agent and validates its structured response. */
async function handleAnalyzeResource(_event, id) {
  const resource = requireResource(id);
  const excerpt = resource.filePath ? readableText(resource.filePath) : '';
  const content = await callOllama(buildMetadataMessages(resource, excerpt), METADATA_SCHEMA);
  const metadata = validateMetadataResponse(content, resource);
  return updateResource(id, { ...metadata, status: 'ready' });
}

/** Normalizes the owner’s requested metadata changes. */
function requestedCorrection(resource, request) {
  return {
    title: String(request.title || '').trim() || resource.title,
    authors: normalizeList(request.authors),
    categories: normalizeList(request.categories),
    languages: normalizeList(request.languages),
    description: String(request.description || '').trim()
  };
}

/** Reviews a correction locally and records both decision and explanation. */
async function handleReviewCorrection(_event, id, request) {
  const resource = requireResource(id);
  const requestedChanges = requestedCorrection(resource, request);
  let decision = 'needs-override';
  let explanation = 'The local model is not available, so PsyShelf cannot independently review this correction. You may start Ollama or use your final override.';
  try {
    const content = await callOllama(buildCorrectionMessages(resource, requestedChanges, request.reason), CORRECTION_SCHEMA);
    const review = validateCorrectionResponse(content);
    decision = review.decision === 'accept' ? 'accepted' : 'rejected';
    explanation = review.explanation;
  } catch (error) {
    if (!/Ollama|model/i.test(error.message)) explanation = `The local review could not finish: ${error.message}`;
  }
  const correctionId = randomId();
  db.prepare(`
    INSERT INTO corrections (id, resource_id, requested_changes, reason, decision, explanation, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(correctionId, id, JSON.stringify(requestedChanges), String(request.reason || ''), decision, explanation, now());
  const updatedResource = decision === 'accepted' ? updateResource(id, { ...requestedChanges, status: 'ready' }) : resource;
  return { correctionId, decision, explanation, resource: updatedResource };
}

/** Applies the owner’s final correction override and records that decision. */
function handleOverrideCorrection(_event, correctionId) {
  const correction = db.prepare('SELECT * FROM corrections WHERE id = ?').get(correctionId);
  if (!correction) throw new Error('Correction request not found.');
  const requested = JSON.parse(correction.requested_changes);
  const resource = updateResource(correction.resource_id, { ...requested, status: 'ready' });
  db.prepare("UPDATE corrections SET decision = 'overridden', explanation = ? WHERE id = ?")
    .run('Applied using the owner’s final override.', correctionId);
  return resource;
}

/** Answers from the local model or falls back to deterministic catalog search. */
async function handleChat(_event, message) {
  const resources = listResources();
  const matches = searchResources(resources, message).slice(0, 8);
  try {
    const answer = await callOllama(buildChatMessages(resources, message));
    return { mode: 'local-ai', answer, resourceIds: matches.map(item => item.id) };
  } catch {
    if (!matches.length) {
      return { mode: 'catalog-search', answer: 'I could not find a matching entry in your library. The local AI is not connected, so I used exact catalog search.', resourceIds: [] };
    }
    const titles = matches.slice(0, 5).map(item => `“${item.title}”`).join(', ');
    return { mode: 'catalog-search', answer: `The closest catalog matches are ${titles}. Connect the local model in Agent settings for a conversational answer.`, resourceIds: matches.map(item => item.id) };
  }
}

/** Returns settings together with local paths and current agent status. */
async function handleGetSettings() {
  return { ...settings, databasePath, managedLibraryPath, agent: await getOllamaStatus() };
}

/** Collects local hardware facts without sending them outside the computer. */
async function collectHardwareProfile() {
  const processors = os.cpus();
  let gpuInfo = {};
  try {
    gpuInfo = await app.getGPUInfo('basic');
  } catch {
    gpuInfo = {};
  }
  return {
    platform: `${os.type()} ${os.release()}`,
    architecture: os.arch(),
    totalMemoryGb: bytesToGiB(os.totalmem()),
    logicalCores: processors.length || 1,
    availableParallelism: typeof os.availableParallelism === 'function' ? os.availableParallelism() : (processors.length || 1),
    cpuModel: processors[0]?.model || 'Processor not reported',
    gpuName: selectGpuName(gpuInfo)
  };
}

/** Re-analyzes this computer and persists its current local-model recommendation. */
async function handleAnalyzeHardware() {
  settings.hardwareRecommendation = recommendModel(await collectHardwareProfile());
  writeSettings();
  return settings.hardwareRecommendation;
}

/** Updates the supported user-editable settings. */
function handleUpdateSettings(_event, patch) {
  if (patch.model !== undefined) settings.model = String(patch.model).trim() || 'qwen3:4b';
  writeSettings();
  return settings;
}

/** Lets the owner choose a cloud-synchronized backup folder. */
async function handleChooseBackup() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose your Google Drive or cloud-synced folder',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return { canceled: true };
  settings.backupFolder = result.filePaths[0];
  writeSettings();
  return { canceled: false, backupFolder: settings.backupFolder };
}

/** Opens only allowlisted official helper-download pages. */
async function handleOpenOfficialUrl(_event, value) {
  const url = validateHttpUrl(value);
  if (!url || !OFFICIAL_HOSTS.has(new URL(url).hostname)) throw new Error('Only verified official download pages can be opened here.');
  await shell.openExternal(url);
  return { opened: true };
}

/** Registers the minimal IPC surface used by the renderer. */
function registerHandlers() {
  const handlers = [
    ['resources:list', handleListResources],
    ['resources:add-files', handleAddFiles],
    ['resources:add-url', handleAddUrl],
    ['resources:delete', handleDeleteResource],
    ['resources:open', handleOpenResource],
    ['resources:preview', handlePreviewResource],
    ['resources:share', handleShareResource],
    ['agent:analyze', handleAnalyzeResource],
    ['agent:review-correction', handleReviewCorrection],
    ['agent:override-correction', handleOverrideCorrection],
    ['agent:chat', handleChat],
    ['settings:get', handleGetSettings],
    ['settings:update', handleUpdateSettings],
    ['settings:analyze-hardware', handleAnalyzeHardware],
    ['settings:choose-backup', handleChooseBackup],
    ['settings:sync-backup', performBackup],
    ['system:open-official-url', handleOpenOfficialUrl]
  ];
  for (const [channel, handler] of handlers) ipcMain.handle(channel, handler);
}

/** Recreates the main window when the desktop application is reactivated. */
function handleActivate() {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
}

/** Initializes application state after Electron becomes ready. */
function handleReady() {
  settings = readSettings();
  initDatabase();
  registerHandlers();
  createWindow();
  app.on('activate', handleActivate);
}

/** Quits after all Windows desktop windows are closed. */
function handleAllWindowsClosed() {
  if (process.platform !== 'darwin') app.quit();
}

/** Releases timers and the SQLite connection before shutdown. */
function handleBeforeQuit() {
  clearTimeout(backupTimer);
  if (db) db.close();
}

app.whenReady().then(handleReady);
app.on('window-all-closed', handleAllWindowsClosed);
app.on('before-quit', handleBeforeQuit);
