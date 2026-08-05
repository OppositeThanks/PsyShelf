const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');

const seedData = require('../src/seed-data.cjs');
const {
  helperForExtension,
  inferResourceType,
  normalizeList,
  previewKind,
  safeFilename,
  searchResources,
  validateHttpUrl
} = require('../src/library-utils.cjs');

const OLLAMA_BASE = 'http://127.0.0.1:11434';
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

function now() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomUUID();
}

function readSettings() {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  const defaults = {
    model: 'qwen3:4b',
    backupFolder: '',
    language: 'English'
  };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  } catch {
    return defaults;
  }
}

function writeSettings() {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

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

function getResource(id) {
  return fromRow(db.prepare('SELECT * FROM resources WHERE id = ?').get(id));
}

function listResources(filters = {}) {
  let resources = db.prepare('SELECT * FROM resources ORDER BY updated_at DESC, title COLLATE NOCASE').all().map(fromRow);
  if (filters.query) resources = searchResources(resources, filters.query);
  if (filters.category) resources = resources.filter(item => item.categories.includes(filters.category));
  if (filters.language) resources = resources.filter(item => item.languages.includes(filters.language));
  return resources;
}

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

function readableText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml', '.rtf'].includes(ext)) return '';
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, 24000);
  } catch {
    return '';
  }
}

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

async function callOllama(messages, json = false) {
  const status = await getOllamaStatus();
  if (!status.available) throw new Error('Ollama is not running. Open Agent settings for the free local setup.');
  const model = status.models.includes(settings.model) ? settings.model : status.models[0];
  if (!model) throw new Error(`No local model is installed. Run: ollama pull ${settings.model}`);
  const payload = { model, messages, stream: false, options: { temperature: 0.15 } };
  if (json) payload.format = 'json';
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

function parseModelJson(text) {
  const cleaned = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^```json\s*|\s*```$/g, '').trim();
  return JSON.parse(cleaned);
}

function scheduleBackup() {
  if (!settings?.backupFolder) return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    try { performBackup(); } catch (error) { console.error('Automatic backup failed:', error); }
  }, 800);
}

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

function registerHandlers() {
  ipcMain.handle('resources:list', (_event, filters) => listResources(filters));

  ipcMain.handle('resources:add-files', async (_event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add resources to PsyShelf',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'All files', extensions: ['*'] }]
    });
    if (result.canceled) return [];
    const storageMode = options.storageMode === 'copy' ? 'copy' : 'reference';
    return result.filePaths.map(sourcePath => {
      let filePath = sourcePath;
      if (storageMode === 'copy') {
        filePath = uniqueManagedPath(sourcePath);
        fs.copyFileSync(sourcePath, filePath);
      }
      const ext = path.extname(filePath).toLowerCase();
      return insertResource({
        title: path.basename(filePath, ext),
        authors: [],
        categories: [inferResourceType(filePath)],
        languages: [],
        description: 'Awaiting metadata analysis or manual description.',
        sourceKind: 'file',
        filePath,
        storageMode,
        extension: ext,
        status: 'draft'
      });
    });
  });

  ipcMain.handle('resources:add-url', (_event, resource) => {
    const url = validateHttpUrl(resource.url);
    if (!url) throw new Error('Enter a valid http or https URL.');
    return insertResource({
      ...resource,
      url,
      sourceKind: 'url',
      categories: normalizeList(resource.categories).length ? resource.categories : ['URL'],
      status: resource.status || 'ready'
    });
  });

  ipcMain.handle('resources:update', (_event, id, patch) => updateResource(id, patch));

  ipcMain.handle('resources:delete', (_event, id) => {
    const resource = getResource(id);
    if (!resource) return { deleted: false };
    db.prepare('DELETE FROM resources WHERE id = ?').run(id);
    scheduleBackup();
    return {
      deleted: true,
      preservedFile: Boolean(resource.filePath),
      message: resource.filePath ? 'The library entry was removed. Its file was preserved.' : 'The library entry was removed.'
    };
  });

  ipcMain.handle('resources:open', async (_event, id) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
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
  });

  ipcMain.handle('resources:preview', (_event, id) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
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
  });

  ipcMain.handle('resources:share', async (_event, id, includeFile) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose a folder for the shared entry',
      properties: ['openDirectory', 'createDirectory']
    });
    if (selection.canceled) return { canceled: true };
    const root = selection.filePaths[0];
    let target = path.join(root, `${safeFilename(resource.title)}-share`);
    let counter = 2;
    while (fs.existsSync(target)) {
      target = path.join(root, `${safeFilename(resource.title)}-share-${counter++}`);
    }
    fs.mkdirSync(target, { recursive: true });
    const shared = { ...resource, filePath: undefined, sharedAt: now() };
    fs.writeFileSync(path.join(target, 'resource.json'), JSON.stringify(shared, null, 2), 'utf8');
    let fileIncluded = false;
    if (includeFile && resource.filePath && fs.existsSync(resource.filePath)) {
      fs.copyFileSync(resource.filePath, path.join(target, path.basename(resource.filePath)));
      fileIncluded = true;
    }
    return { canceled: false, folder: target, fileIncluded };
  });

  ipcMain.handle('agent:status', () => getOllamaStatus());

  ipcMain.handle('agent:analyze', async (_event, id) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
    const excerpt = resource.filePath ? readableText(resource.filePath) : '';
    const prompt = `Analyze this professional psychology-library resource. Return JSON only with keys title (string), authors (array), categories (array), languages (array), description (2 concise sentences). Categories may include Book, URL, Music, Podcast, Art, Series, Movie, Scientific article, Video, Course, Presentation, Spreadsheet, or a more fitting new category. Do not invent details: keep uncertain fields empty and mention uncertainty in the description.\n\nExisting entry:\n${JSON.stringify(resource)}\n\nReadable excerpt:\n${excerpt}`;
    const content = await callOllama([
      { role: 'system', content: 'You are a careful multilingual metadata librarian for a psychologist. Prefer accuracy over completeness.' },
      { role: 'user', content: prompt }
    ], true);
    const analyzed = parseModelJson(content);
    return updateResource(id, {
      title: analyzed.title || resource.title,
      authors: analyzed.authors || resource.authors,
      categories: analyzed.categories || resource.categories,
      languages: analyzed.languages || resource.languages,
      description: analyzed.description || resource.description,
      status: 'ready'
    });
  });

  ipcMain.handle('agent:review-correction', async (_event, id, request) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
    const requestedChanges = {
      title: String(request.title || '').trim() || resource.title,
      authors: normalizeList(request.authors),
      categories: normalizeList(request.categories),
      languages: normalizeList(request.languages),
      description: String(request.description || '').trim()
    };
    let decision = 'needs-override';
    let explanation = 'The local model is not available, so PsyShelf cannot independently review this correction. You may start Ollama or use your final override.';
    try {
      const content = await callOllama([
        { role: 'system', content: 'You are a cautious multilingual correction reviewer for a professional psychology library. Never fabricate evidence.' },
        { role: 'user', content: `Review the requested metadata correction. Return JSON only: {"decision":"accept" or "reject","explanation":"brief reason"}. Accept reasonable user corrections unless the current information is demonstrably more accurate. If evidence is insufficient, accept the correction and say it is user-supplied.\nCurrent: ${JSON.stringify(resource)}\nRequested: ${JSON.stringify(requestedChanges)}\nUser reason: ${request.reason || 'Not provided'}` }
      ], true);
      const review = parseModelJson(content);
      decision = review.decision === 'accept' ? 'accepted' : 'rejected';
      explanation = String(review.explanation || 'The local agent completed its review.');
    } catch (error) {
      explanation = error.message.includes('Ollama') || error.message.includes('model') ? explanation : `The local review could not finish: ${error.message}`;
    }
    const correctionId = randomId();
    db.prepare(`
      INSERT INTO corrections (id, resource_id, requested_changes, reason, decision, explanation, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(correctionId, id, JSON.stringify(requestedChanges), String(request.reason || ''), decision, explanation, now());
    let updatedResource = resource;
    if (decision === 'accepted') updatedResource = updateResource(id, { ...requestedChanges, status: 'ready' });
    return { correctionId, decision, explanation, resource: updatedResource };
  });

  ipcMain.handle('agent:override-correction', (_event, correctionId) => {
    const correction = db.prepare('SELECT * FROM corrections WHERE id = ?').get(correctionId);
    if (!correction) throw new Error('Correction request not found.');
    const requested = JSON.parse(correction.requested_changes);
    const resource = updateResource(correction.resource_id, { ...requested, status: 'ready' });
    db.prepare("UPDATE corrections SET decision = 'overridden', explanation = ? WHERE id = ?")
      .run('Applied using the owner’s final override.', correctionId);
    return resource;
  });

  ipcMain.handle('agent:chat', async (_event, message) => {
    const resources = listResources();
    const matches = searchResources(resources, message).slice(0, 8);
    try {
      const content = await callOllama([
        {
          role: 'system',
          content: 'You answer questions about a personal professional psychology library. Use only the supplied catalog. If the catalog does not contain the answer, say so. Reply in the language used by the user and cite resource titles in quotation marks.'
        },
        { role: 'user', content: `Question: ${message}\n\nCatalog:\n${JSON.stringify(resources.map(({ title, authors, categories, languages, description }) => ({ title, authors, categories, languages, description })))}` }
      ]);
      return { mode: 'local-ai', answer: content, resourceIds: matches.map(item => item.id) };
    } catch {
      if (!matches.length) {
        return { mode: 'catalog-search', answer: 'I could not find a matching entry in your library. The local AI is not connected, so I used exact catalog search.', resourceIds: [] };
      }
      const titles = matches.slice(0, 5).map(item => `“${item.title}”`).join(', ');
      return { mode: 'catalog-search', answer: `The closest catalog matches are ${titles}. Connect the local model in Agent settings for a conversational answer.`, resourceIds: matches.map(item => item.id) };
    }
  });

  ipcMain.handle('settings:get', async () => ({
    ...settings,
    databasePath,
    managedLibraryPath,
    agent: await getOllamaStatus()
  }));

  ipcMain.handle('settings:update', (_event, patch) => {
    if (patch.model !== undefined) settings.model = String(patch.model).trim() || 'qwen3:4b';
    if (patch.language !== undefined) settings.language = String(patch.language).trim() || 'English';
    writeSettings();
    return settings;
  });

  ipcMain.handle('settings:choose-backup', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose your Google Drive or cloud-synced folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) return { canceled: true };
    settings.backupFolder = result.filePaths[0];
    writeSettings();
    return { canceled: false, backupFolder: settings.backupFolder };
  });

  ipcMain.handle('settings:sync-backup', () => performBackup());

  ipcMain.handle('system:open-official-url', async (_event, value) => {
    const url = validateHttpUrl(value);
    if (!url || !OFFICIAL_HOSTS.has(new URL(url).hostname)) throw new Error('Only verified official download pages can be opened here.');
    await shell.openExternal(url);
    return { opened: true };
  });
}

app.whenReady().then(() => {
  settings = readSettings();
  initDatabase();
  registerHandlers();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  clearTimeout(backupTimer);
  if (db) db.close();
});
