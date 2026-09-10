const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createSnapshot, inspectBackup, listBackups, prepareRestore, installRestore, recoverRestore } = require('../src/backup.cjs');
const { workerTask } = require('../src/file-jobs.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-backup-test-'));
  const userData = path.join(root, 'live');
  const managedLibraryPath = path.join(userData, 'library-files');
  fs.mkdirSync(managedLibraryPath, { recursive: true });
  let db = new DatabaseSync(path.join(userData, 'psyshelf.sqlite'));
  db.exec(`CREATE TABLE resources (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, authors TEXT DEFAULT '[]', categories TEXT DEFAULT '[]', languages TEXT DEFAULT '[]',
    description TEXT DEFAULT '', source_kind TEXT DEFAULT 'file', file_path TEXT, url TEXT, storage_mode TEXT,
    extension TEXT, status TEXT DEFAULT 'ready', created_at TEXT DEFAULT '', updated_at TEXT DEFAULT '', details TEXT DEFAULT '{}');
    CREATE TABLE corrections (id TEXT PRIMARY KEY, resource_id TEXT REFERENCES resources(id), requested_changes TEXT,
    reason TEXT, decision TEXT, explanation TEXT, created_at TEXT);`);
  const close = () => { if (db) { db.close(); db = null; } };
  const open = () => { db = new DatabaseSync(path.join(userData, 'psyshelf.sqlite')); };
  t.after(() => {
    close();
    // Only remove the exact temporary test directory created above.
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('psyshelf-backup-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  function snapshot() { return createSnapshot({ db, managedLibraryPath, root: path.join(root, 'backups'), version: 'test' }); }
  function add(id = 'managed') {
    fs.writeFileSync(path.join(managedLibraryPath, `${id}.txt`), `Contents of ${id}`);
    db.prepare('INSERT INTO resources (id,title,file_path,storage_mode,details) VALUES (?,?,?,?,?)')
      .run(id, 'A resource', path.join(managedLibraryPath, `${id}.txt`), 'copy', JSON.stringify({ personalNotes: 'Keep my notes', rating: 4 }));
  }
  return { root, userData, managedLibraryPath, get db() { return db; }, close, open, snapshot, add };
}

test('dated snapshots preserve history and committed WAL data', t => {
  const f = fixture(t);
  f.db.exec('PRAGMA journal_mode = WAL');
  f.add();
  const first = f.snapshot();
  f.db.prepare('UPDATE resources SET title = ?').run('Changed title');
  const second = f.snapshot();
  assert.notEqual(first.folder, second.folder);
  assert.equal(listBackups(path.join(f.root, 'backups')).length, 2);
  const saved = new DatabaseSync(path.join(first.folder, 'psyshelf.sqlite'), { readOnly: true });
  assert.equal(saved.prepare('SELECT title FROM resources').get().title, 'A resource');
  saved.close();
  assert.equal(inspectBackup(second.folder).managedCount, 1);
});

test('restore rebases managed paths, preserves notes and corrections, and leaves external references unchanged', t => {
  const f = fixture(t);
  f.add();
  f.db.prepare('INSERT INTO resources (id,title,file_path,storage_mode) VALUES (?,?,?,?)').run('reference', 'External', 'D:\\originals\\paper.pdf', 'reference');
  f.db.exec("INSERT INTO corrections VALUES ('c','managed','{}','','accepted','','')");
  const saved = f.snapshot();
  const remote = new DatabaseSync(path.join(saved.folder, 'psyshelf.sqlite'));
  remote.prepare("UPDATE resources SET file_path = ? WHERE id = 'managed'").run('C:\\AnotherComputer\\library-files\\managed.txt');
  remote.close();
  f.db.exec('DELETE FROM corrections; DELETE FROM resources');
  f.add('new');
  const prepared = prepareRestore(saved.folder, f.userData);
  installRestore({ staging: prepared.staging, userData: f.userData, close: f.close, open: f.open });
  const restored = f.db.prepare("SELECT * FROM resources WHERE id = 'managed'").get();
  assert.equal(restored.file_path, path.join(f.managedLibraryPath, 'managed.txt'));
  assert.equal(JSON.parse(restored.details).personalNotes, 'Keep my notes');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM corrections').get().n, 1);
  assert.equal(f.db.prepare("SELECT file_path FROM resources WHERE id = 'reference'").get().file_path, 'D:\\originals\\paper.pdf');
  assert.equal(f.db.prepare("SELECT * FROM resources WHERE id = 'new'").get(), undefined);
  assert.equal(fs.readFileSync(restored.file_path, 'utf8'), 'Contents of managed');
});

test('missing files, damaged databases, incompatible schemas and malformed metadata are rejected', t => {
  const f = fixture(t);
  f.add();
  const missing = f.snapshot();
  fs.unlinkSync(path.join(missing.folder, 'library-files', 'managed.txt'));
  assert.throws(() => prepareRestore(missing.folder, f.userData));
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resources').get().n, 1);
  const corrupt = f.snapshot();
  fs.writeFileSync(path.join(corrupt.folder, 'psyshelf.sqlite'), 'not sqlite');
  assert.throws(() => inspectBackup(corrupt.folder));
  const invalid = f.snapshot();
  const database = new DatabaseSync(path.join(invalid.folder, 'psyshelf.sqlite'));
  database.exec("UPDATE resources SET authors = '{}'");
  assert.throws(() => inspectBackup(invalid.folder), /metadata/);
  database.exec(`UPDATE resources SET authors = '[]', details = '{"rating":99}'`);
  assert.throws(() => inspectBackup(invalid.folder), /rating/);
  database.exec("UPDATE resources SET details = '{}'; CREATE VIEW unsupported AS SELECT * FROM resources");
  database.close();
  assert.throws(() => inspectBackup(invalid.folder), /unsupported/);
});

test('failure to open the restored database rolls back both files and catalog', t => {
  const f = fixture(t);
  const empty = f.snapshot();
  f.add();
  const prepared = prepareRestore(empty.folder, f.userData);
  let attempts = 0;
  assert.throws(() => installRestore({ staging: prepared.staging, userData: f.userData, close: f.close,
    open: () => { if (++attempts === 1) throw Error('simulated open failure'); f.open(); }
  }), /previous library was recovered/);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resources').get().n, 1);
  assert.equal(fs.readFileSync(path.join(f.managedLibraryPath, 'managed.txt'), 'utf8'), 'Contents of managed');
  assert.equal(fs.existsSync(path.join(f.userData, 'restore-pending.json')), false);
});

test('startup recovery repairs an interrupted swap and is safe to run twice', t => {
  const f = fixture(t);
  const empty = f.snapshot();
  f.add();
  const { staging } = prepareRestore(empty.folder, f.userData);
  f.close();
  fs.writeFileSync(path.join(f.userData, 'restore-pending.json'), JSON.stringify({ stagingName: path.basename(staging) }));
  fs.renameSync(path.join(f.userData, 'psyshelf.sqlite'), path.join(staging, 'previous-psyshelf.sqlite'));
  fs.renameSync(path.join(staging, 'psyshelf.sqlite'), path.join(f.userData, 'psyshelf.sqlite'));
  recoverRestore(f.userData);
  recoverRestore(f.userData);
  f.open();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resources').get().n, 1);
  assert.ok(fs.existsSync(path.join(f.managedLibraryPath, 'managed.txt')));
});

test('legacy backups without metadata and empty libraries can be restored', t => {
  const f = fixture(t);
  const saved = f.snapshot();
  fs.unlinkSync(path.join(saved.folder, 'backup-info.json'));
  f.add();
  const { staging } = prepareRestore(saved.folder, f.userData);
  installRestore({ staging, userData: f.userData, close: f.close, open: f.open });
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resources').get().n, 0);
});

test('unsafe destinations and restore recovery paths are rejected', t => {
  const f = fixture(t);
  assert.throws(() => createSnapshot({ db: f.db, managedLibraryPath: f.managedLibraryPath, root: path.join(f.managedLibraryPath, 'nested'), version: 'test' }), /outside/);
  fs.writeFileSync(path.join(f.userData, 'restore-pending.json'), JSON.stringify({ stagingName: '..' }));
  assert.throws(() => recoverRestore(f.userData), /Invalid/);
});

test('background backup keeps a consistent catalog while live metadata changes', async t => {
  const f = fixture(t);
  f.db.exec('PRAGMA journal_mode = WAL');
  f.add();
  let edited = false;
  const result = await workerTask('snapshot', { databasePath: path.join(f.userData, 'psyshelf.sqlite'),
    managedLibraryPath: f.managedLibraryPath, root: path.join(f.root, 'background'), version: 'test' }, {
    progress: status => {
      if (!edited && status.phase === 'Copying files') {
        f.db.prepare('UPDATE resources SET title = ?').run('Edited while copying');
        edited = true;
      }
    }
  });
  assert.ok(edited);
  const saved = new DatabaseSync(path.join(result.folder, 'psyshelf.sqlite'), { readOnly: true });
  try { assert.equal(saved.prepare('SELECT title FROM resources').get().title, 'A resource'); }
  finally { saved.close(); }
  assert.equal(f.db.prepare('SELECT title FROM resources').get().title, 'Edited while copying');
});

test('cancelled background backups preserve the previous snapshot', async t => {
  const f = fixture(t);
  f.db.exec('PRAGMA journal_mode = WAL');
  f.add();
  const previous = f.snapshot();
  const fd = fs.openSync(path.join(f.managedLibraryPath, 'large.bin'), 'wx');
  fs.ftruncateSync(fd, 128 * 1024 * 1024); fs.closeSync(fd);
  const signal = new SharedArrayBuffer(4);
  await assert.rejects(workerTask('snapshot', { databasePath: path.join(f.userData, 'psyshelf.sqlite'),
    managedLibraryPath: f.managedLibraryPath, root: path.join(f.root, 'backups'), version: 'test' }, {
    signal, progress: status => { if (status.phase === 'Copying files') Atomics.store(new Int32Array(signal), 0, 1); }
  }), { name: 'AbortError' });
  assert.equal(listBackups(path.join(f.root, 'backups')).length, 1);
  assert.ok(fs.existsSync(path.join(previous.folder, 'psyshelf.sqlite')));
  assert.equal(fs.readdirSync(path.join(f.root, 'backups')).filter(name => name.startsWith('.pending-')).length, 0);
});

test('restore preparation includes committed WAL changes from a selected database', t => {
  const f = fixture(t);
  f.db.exec('PRAGMA journal_mode = WAL');
  f.add();
  const { staging } = prepareRestore(f.userData, f.userData);
  const saved = new DatabaseSync(path.join(staging, 'psyshelf.sqlite'), { readOnly: true });
  try { assert.equal(saved.prepare('SELECT COUNT(*) n FROM resources').get().n, 1); }
  finally { saved.close(); }
});

test('recovery discards replacement WAL sidecars before reopening the original library', t => {
  const f = fixture(t);
  const empty = f.snapshot();
  f.add();
  const { staging } = prepareRestore(empty.folder, f.userData);
  f.close();
  fs.writeFileSync(path.join(f.userData, 'restore-pending.json'), JSON.stringify({ stagingName: path.basename(staging) }));
  for (const name of ['psyshelf.sqlite', 'library-files']) {
    fs.renameSync(path.join(f.userData, name), path.join(staging, `previous-${name}`));
    fs.renameSync(path.join(staging, name), path.join(f.userData, name));
  }
  for (const suffix of ['-wal', '-shm']) fs.writeFileSync(path.join(f.userData, 'psyshelf.sqlite' + suffix), 'Replacement sidecar');
  recoverRestore(f.userData);
  for (const suffix of ['-wal', '-shm']) assert.equal(fs.existsSync(path.join(f.userData, 'psyshelf.sqlite' + suffix)), false);
  f.open();
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM resources').get().n, 1);
});
