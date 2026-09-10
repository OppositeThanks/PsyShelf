const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const DATABASE = 'psyshelf.sqlite';
const FILES = 'library-files';
const MARKER = 'restore-pending.json';
const RESOURCE_COLUMNS = ['id', 'title', 'authors', 'categories', 'languages', 'description',
  'source_kind', 'file_path', 'url', 'storage_mode', 'extension', 'status', 'created_at', 'updated_at'];
const CORRECTION_COLUMNS = ['id', 'resource_id', 'requested_changes', 'reason', 'decision', 'explanation', 'created_at'];

function inside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function regularFile(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected a regular file: ${file}`);
}

function validateTree(folder) {
  const stat = fs.lstatSync(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Backup folders cannot be symbolic links.');
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) validateTree(target);
    else regularFile(target);
  }
}

function discardStaging(userData, staging, snapshot = false) {
  // Recursive removal is restricted to an owned, generated direct child of userData.
  if (path.dirname(path.resolve(staging)) !== path.resolve(userData) ||
      !(snapshot ? /^\.pending-[a-zA-Z0-9.-]+$/ : /^\.restore-[a-zA-Z0-9]+$/).test(path.basename(staging))) throw new Error('Invalid staging cleanup path.');
  if (!fs.existsSync(staging)) return;
  validateTree(staging);
  if (!inside(fs.realpathSync(userData), fs.realpathSync(staging))) throw new Error('Staging folder escaped user data.');
  fs.rmSync(staging, { recursive: true });
}

function inspectBackup(folder) {
  regularFile(path.join(folder, DATABASE));
  const database = new DatabaseSync(path.join(folder, DATABASE), { readOnly: true });
  try {
    database.exec('PRAGMA trusted_schema = OFF');
    if (database.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') {
      throw new Error('The backup database is damaged.');
    }
    const schema = database.prepare("SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
    if (schema.some(item => ['trigger', 'view'].includes(item.type) ||
      (item.type === 'table' && !['resources', 'corrections'].includes(item.name)))) {
      throw new Error('This backup uses an unsupported database schema.');
    }
    for (const [table, required] of [['resources', RESOURCE_COLUMNS], ['corrections', CORRECTION_COLUMNS]]) {
      const columns = database.prepare(`PRAGMA table_info(${table})`).all().map(item => item.name);
      if (required.some(column => !columns.includes(column)) ||
        columns.some(column => !required.includes(column) && !(table === 'resources' && column === 'details'))) {
        throw new Error('This is not a compatible PsyShelf backup.');
      }
    }
    if (database.prepare('PRAGMA foreign_key_check').all().length) throw new Error('The backup has broken resource relationships.');
    const resources = database.prepare('SELECT * FROM resources').all();
    const names = new Set();
    let managedCount = 0;
    let referenceCount = 0;
    for (const row of resources) {
      for (const column of ['authors', 'categories', 'languages']) {
        const values = JSON.parse(row[column]);
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Invalid resource metadata.');
      }
      if (row.details !== undefined) {
        const details = JSON.parse(row.details);
        if (!details || typeof details !== 'object' || Array.isArray(details)) throw new Error('Invalid resource details.');
        for (const [field, max] of [['rating', 5], ['publicationYear', 9999]]) {
          const raw = details[field];
          if (raw !== undefined && raw !== null && raw !== '' &&
              (!Number.isInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > max)) {
            throw new Error(`Invalid resource ${field} in backup.`);
          }
        }
      }
      if (row.storage_mode === 'copy') {
        if (typeof row.file_path !== 'string') throw new Error('A managed file has no path.');
        // Existing PsyShelf imports store managed files flat; accept paths from another OS.
        const name = path.win32.basename(row.file_path.replaceAll('/', '\\'));
        if (!name || /[<>:"/\\|?*]/.test(name) || name === '.' || name === '..' || /[. ]$/.test(name)) {
          throw new Error('A managed file has an invalid filename.');
        }
        const key = name.toLowerCase();
        if (names.has(key)) throw new Error('The backup contains ambiguous managed filenames.');
        names.add(key);
        regularFile(path.join(folder, FILES, name));
        managedCount++;
      } else if (row.source_kind === 'file') referenceCount++;
    }
    if (fs.existsSync(path.join(folder, FILES))) validateTree(path.join(folder, FILES));
    let info = {};
    if (fs.existsSync(path.join(folder, 'backup-info.json'))) {
      regularFile(path.join(folder, 'backup-info.json'));
      info = JSON.parse(fs.readFileSync(path.join(folder, 'backup-info.json'), 'utf8'));
      if (info.formatVersion !== undefined && info.formatVersion !== 1) throw new Error('This backup format needs a newer PsyShelf version.');
    }
    return { resourceCount: resources.length, managedCount, referenceCount, updatedAt: info.updatedAt || null };
  } finally { database.close(); }
}

function createSnapshot({ db, managedLibraryPath, root, version, kind = 'backup' }) {
  fs.mkdirSync(root, { recursive: true });
  const source = fs.realpathSync(managedLibraryPath);
  if (inside(source, fs.realpathSync(root))) throw new Error('Choose a backup folder outside the managed library.');
  validateTree(source);
  const id = `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID().slice(0, 8)}`;
  const staging = path.join(root, `.pending-${id}`);
  const folder = path.join(root, id);
  fs.mkdirSync(staging);
  // VACUUM INTO creates a consistent standalone SQLite snapshot, including committed WAL data.
  // An incomplete operation never replaces an existing backup.
  try {
    db.prepare('VACUUM INTO ?').run(path.join(staging, DATABASE));
    fs.cpSync(source, path.join(staging, FILES), { recursive: true, errorOnExist: true, force: false });
    const updatedAt = new Date().toISOString();
    fs.writeFileSync(path.join(staging, 'backup-info.json'), JSON.stringify({ formatVersion: 1, updatedAt, version, kind }, null, 2));
    const summary = inspectBackup(staging);
    fs.renameSync(staging, folder);
    return { folder, updatedAt, ...summary };
  } catch (error) {
    try { discardStaging(root, staging, true); } catch (cleanupError) { console.warn('Backup staging cleanup failed:', cleanupError.message); }
    throw error;
  }
}

function listBackups(root) {
  if (!root || !fs.existsSync(root)) return [];
  const candidates = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(root, entry.name));
  if (fs.existsSync(path.join(root, DATABASE))) candidates.push(root); // Original single-folder backups.
  return candidates.flatMap(folder => {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(folder, 'backup-info.json'), 'utf8'));
      if (!fs.existsSync(path.join(folder, DATABASE))) return [];
      return [{ folder, updatedAt: info.updatedAt || null, kind: info.kind || 'backup' }];
    } catch { return []; }
  }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function prepareRestore(folder, userData) {
  inspectBackup(folder);
  fs.mkdirSync(userData, { recursive: true });
  const staging = fs.mkdtempSync(path.join(userData, '.restore-'));
  try {
    fs.copyFileSync(path.join(folder, DATABASE), path.join(staging, DATABASE));
    if (fs.existsSync(path.join(folder, FILES))) {
      fs.cpSync(path.join(folder, FILES), path.join(staging, FILES), { recursive: true, errorOnExist: true, force: false });
    } else fs.mkdirSync(path.join(staging, FILES));
    const summary = inspectBackup(staging); // Validate the actual copied bytes, not just the selected source.
    const database = new DatabaseSync(path.join(staging, DATABASE));
    try {
      const update = database.prepare('UPDATE resources SET file_path = ? WHERE id = ?');
      for (const row of database.prepare("SELECT id, file_path FROM resources WHERE storage_mode = 'copy'").all()) {
        const name = path.win32.basename(row.file_path.replaceAll('/', '\\'));
        update.run(path.join(userData, FILES, name), row.id);
      }
      database.exec('PRAGMA journal_mode = DELETE');
    } finally { database.close(); }
    return { staging, ...summary };
  } catch (error) {
    try { discardStaging(userData, staging); } catch (cleanupError) { console.warn('Restore staging cleanup failed:', cleanupError.message); }
    throw error;
  }
}

function recoverRestore(userData) {
  const marker = path.join(userData, MARKER);
  if (!fs.existsSync(marker)) return;
  const { stagingName } = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (typeof stagingName !== 'string' || !/^\.restore-[a-zA-Z0-9]+$/.test(stagingName)) throw new Error('Invalid restore recovery record.');
  const staging = path.join(userData, stagingName);
  // Renames are on the same volume. Recovery is repeatable if the application exits mid-swap.
  for (const name of [DATABASE, FILES]) {
    const previous = path.join(staging, `previous-${name}`);
    const live = path.join(userData, name);
    if (fs.existsSync(previous)) {
      if (fs.existsSync(live)) fs.renameSync(live, path.join(staging, `abandoned-${crypto.randomUUID()}-${name}`));
      fs.renameSync(previous, live);
    }
  }
  fs.unlinkSync(marker);
  try { discardStaging(userData, staging); } catch (error) { console.warn('Restore staging cleanup failed:', error.message); }
}

function installRestore({ staging, userData, close, open }) {
  if (path.dirname(staging) !== path.resolve(userData) || !/^\.restore-[a-zA-Z0-9]+$/.test(path.basename(staging))) {
    throw new Error('Invalid restore staging folder.');
  }
  const marker = path.join(userData, MARKER);
  if (fs.existsSync(marker)) throw new Error('An earlier restore needs recovery before continuing.');
  close();
  try {
    fs.writeFileSync(marker, JSON.stringify({ stagingName: path.basename(staging) }), { flag: 'wx', flush: true });
    for (const name of [DATABASE, FILES]) {
      fs.renameSync(path.join(userData, name), path.join(staging, `previous-${name}`));
      fs.renameSync(path.join(staging, name), path.join(userData, name));
    }
    open();
    fs.unlinkSync(marker); // Commit only after the application can open the restored database.
  } catch (error) {
    close();
    recoverRestore(userData);
    open();
    throw new Error(`Restore failed; the previous library was recovered. ${error.message}`);
  }
  try { discardStaging(userData, staging); } catch (error) { console.warn('Restore staging cleanup failed:', error.message); }
}

module.exports = { createSnapshot, inspectBackup, listBackups, prepareRestore, installRestore, recoverRestore, discardStaging };
