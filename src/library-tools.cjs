const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeDetails } = require('./resource-details.cjs');
const { annotationMarkdown } = require('./reading.cjs');
const filterFields = ['query', 'category', 'language', 'clinicalTopic', 'audience', 'theoreticalApproach', 'sort', 'collection', 'readingStatus'];
function savedSearches(value) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Invalid saved searches.');
  return value.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120 || !item.filters || typeof item.filters !== 'object') throw new Error('Invalid saved searches.');
    const filters = {};
    for (const key of filterFields) {
      if (item.filters[key] !== undefined) {
        if (typeof item.filters[key] !== 'string' || item.filters[key].length > 4000) throw new Error('Invalid saved searches.');
        filters[key] = item.filters[key];
      }
    }
    return { name: item.name.trim(), filters, ocr: item.ocr === true, ocrLanguage: ['eng','fra','spa'].includes(item.ocrLanguage) ? item.ocrLanguage : 'eng' };
  });
}
async function scanLibrary(resources, signal) {
  const groups = new Map(), missing = [], unreadable = [];
  for (const resource of resources) {
    signal?.throwIfAborted();
    let key;
    if (resource.filePath) {
      try {
        const hash = crypto.createHash('sha256');
        const before = await fsp.stat(resource.filePath);
        for await (const chunk of fs.createReadStream(resource.filePath, { signal })) hash.update(chunk);
        const after = await fsp.stat(resource.filePath);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) { unreadable.push(resource); continue; }
        key = 'file:' + hash.digest('hex');
      } catch (error) {
        signal?.throwIfAborted();
        (error.code === 'ENOENT' ? missing : unreadable).push(resource); continue;
      }
    } else if (resource.url) {
      try { const url = new URL(resource.url); url.hash = ''; key = 'url:' + url.href; } catch { continue; }
    } else key = 'title:' + resource.title.normalize('NFKC').trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(resource);
  }
  return { groups: [...groups.entries()].filter(([,items]) => items.length > 1).map(([key, items]) => ({ kind: key.split(':')[0], items })), missing, unreadable };
}
function registerLibraryTools({ handle, getDb, listResources, getResource, updateResource, changed, dialog, window, cacheDir, cancelSearch, previewResources, managedFolder }) {
  let scan;
  const preferences = () => {
    getDb().exec('CREATE TABLE IF NOT EXISTS library_preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    return getDb();
  };
  handle('library:saved-searches', () => {
    const row = preferences().prepare("SELECT value FROM library_preferences WHERE key = 'saved-searches'").get();
    return row ? savedSearches(JSON.parse(row.value)) : [];
  });
  handle('library:save-searches', (_event, value) => {
    const searches = savedSearches(value);
    preferences().prepare("INSERT INTO library_preferences VALUES ('saved-searches', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(searches));
    changed(); return searches;
  });
  handle('library:bulk', (_event, ids, patch) => {
    const allowed = ['categories','languages','clinicalTopic','audience','theoreticalApproach','readingStatus','collections'];
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string') || !patch || Object.keys(patch).some(key => !allowed.includes(key))) throw new Error('Invalid bulk edit.');
    const resources = [...new Set(ids)].map(getResource);
    if (resources.some(r => !r)) throw new Error('Resource not found.');
    for (const r of resources) normalizeDetails(patch, r);
    const db = getDb(); db.exec('BEGIN');
    try { for (const r of resources) updateResource(r.id, patch); db.exec('COMMIT'); }
    catch (error) { db.exec('ROLLBACK'); throw error; }
    changed(); return resources.length;
  });
  handle('library:scan', async () => {
    if (scan) throw new Error('A library scan is already running.');
    scan = new AbortController();
    try { return await scanLibrary(listResources(), scan.signal); }
    catch (error) { if (scan.signal.aborted) return { cancelled: true }; throw error; }
    finally { scan = null; }
  });
  handle('library:cancel-scan', () => { scan?.abort(); });
  handle('library:relink', async (_event, id) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
    const picked = await dialog.showOpenDialog(window(), { title: 'Locate replacement file', properties: ['openFile'] });
    if (picked.canceled) return false;
    const filename = picked.filePaths[0];
    if (!(await fsp.stat(filename)).isFile()) throw new Error('File not found.');
    const confirmed = await dialog.showMessageBox(window(), { type: 'question', message: 'Replace this file reference?', detail: `${resource.title}\n${resource.filePath || ''}\n→ ${filename}`, buttons: ['Cancel', 'Replace reference'], defaultId: 0, cancelId: 0 });
    if (confirmed.response !== 1) return false;
    if (!getResource(id)) throw new Error('Resource not found.');
    const managed = resource.storageMode === 'copy';
    const destination = managed ? path.join(managedFolder(), crypto.randomUUID() + path.extname(filename).toLowerCase()) : filename;
    try {
      if (managed) await fsp.copyFile(filename, destination, fs.constants.COPYFILE_EXCL);
      if (!getResource(id)) throw new Error('Resource not found.');
      getDb().prepare('UPDATE resources SET file_path = ?, extension = ?, storage_mode = ?, url = NULL, updated_at = ? WHERE id = ?').run(destination, path.extname(filename).toLowerCase(), managed ? 'copy' : 'reference', new Date().toISOString(), id);
    } catch (error) { if (managed) await fsp.unlink(destination).catch(() => {}); throw error; }
    // Preserve reading data when reconnecting a moved document; never remove either original.
    changed(); return true;
  });
  handle('library:export-notes', async (_event, id) => {
    const resource = getResource(id);
    if (!resource) throw new Error('Resource not found.');
    const result = await dialog.showSaveDialog(window(), { title: 'Export annotations', defaultPath: 'annotations.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (result.canceled) return false;
    await fsp.writeFile(result.filePath, annotationMarkdown(resource), 'utf8'); return true;
  });
  handle('library:clear-index', async () => {
    await cancelSearch();
    // Only remove generated index entries; no recursive deletion or source-file access.
    for (const name of await fsp.readdir(cacheDir()).catch(() => [])) if (/^[a-f0-9]{64}\.json(?:\.[a-f0-9-]+\.tmp)?$/.test(name)) await fsp.unlink(path.join(cacheDir(), name)).catch(() => {});
    return true;
  });
  const previewResource = event => {
    const snapshot = previewResources.get(event.sender.id);
    if (!snapshot || event.senderFrame !== event.sender.mainFrame) throw new Error('Preview unavailable.');
    const resource = getResource(snapshot.id);
    if (!resource || resource.filePath !== snapshot.filePath) throw new Error('Preview unavailable.');
    return resource;
  };
  handle('preview:reading', event => previewResource(event));
  handle('preview:save-reading', (event, patch) => {
    const resource = previewResource(event);
    if (!patch || Object.keys(patch).some(k => !['lastPage','readingStatus','bookmarks','annotations'].includes(k))) throw new Error('Invalid reading details.');
    return updateResource(resource.id, patch);
  });
  handle('preview:pdf-bytes', async event => {
    const resource = previewResource(event);
    if (path.extname(resource.filePath || '').toLowerCase() !== '.pdf' || (await fsp.stat(resource.filePath)).size > 32 * 1024 * 1024) throw new Error('File too large or unavailable.');
    return new Uint8Array(await fsp.readFile(resource.filePath));
  });
}
module.exports = { registerLibraryTools, scanLibrary, savedSearches };
