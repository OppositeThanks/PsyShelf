const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const backups = require('./backup.cjs');
const { copyFiles, copyTree } = require('./file-copy.cjs');
const { safeFilename } = require('./library-utils.cjs');

const flag = new Int32Array(workerData.signal);
function check() {
  if (Atomics.load(flag, 0) === 1) { const error = new Error('Operation cancelled.'); error.name = 'AbortError'; throw error; }
}
function commit() {
  if (Atomics.compareExchange(flag, 0, 0, 2) === 1) check();
  progress({ phase: 'Finishing…', cancellable: false, copiedBytes: undefined, totalBytes: undefined });
}
let lastUpdate = 0;
let lastPhase;
function progress(value) {
  const now = Date.now();
  if (value.phase !== lastPhase || now - lastUpdate >= 100 || (value.totalBytes > 0 && value.copiedBytes === value.totalBytes)) {
    parentPort.postMessage({ type: 'progress', value });
    lastUpdate = now;
    lastPhase = value.phase;
  }
}
const hooks = { check, progress, commit, copyFiles: files => copyFiles(files, { check, progress }),
  copyTree: (source, destination) => copyTree(source, destination, { check, progress }) };

function cleanup(parent, staging) {
  const root = fs.realpathSync(parent);
  if (path.dirname(path.resolve(staging)) !== path.resolve(parent) || !/^\.(import|share)-[a-zA-Z0-9]+$/.test(path.basename(staging))) {
    throw new Error('Invalid temporary file operation folder.');
  }
  if (!fs.existsSync(staging)) return;
  if (fs.lstatSync(staging).isSymbolicLink() || path.dirname(fs.realpathSync(staging)) !== root) throw new Error('Temporary folder escaped its parent.');
  // Only an owned, generated folder is removed; no selected source paths are deleted.
  fs.rmSync(staging, { recursive: true });
}

function importFiles({ sources, managedLibraryPath, userData }) {
  const staging = fs.mkdtempSync(path.join(userData, '.import-'));
  try {
    const names = new Set();
    const files = sources.map(source => {
      check();
      const extension = path.extname(source);
      const base = safeFilename(path.basename(source, extension));
      let name = base + extension;
      let n = 2;
      while (names.has(name.toLowerCase()) || fs.existsSync(path.join(managedLibraryPath, name))) name = `${base}-${n++}${extension}`;
      names.add(name.toLowerCase());
      return { source, destination: path.join(staging, name), filePath: path.join(managedLibraryPath, name) };
    });
    copyFiles(files, hooks);
    check();
    return { staging, files };
  } catch (error) { cleanup(userData, staging); throw error; }
}

function share({ root, resource, includeFile }) {
  const staging = fs.mkdtempSync(path.join(root, '.share-'));
  try {
    const shared = { ...resource, filePath: undefined, sharedAt: new Date().toISOString() };
    let fileIncluded = false;
    if (includeFile && resource.filePath) {
      let name = path.basename(resource.filePath);
      if (name.toLowerCase() === 'resource.json') name = 'attachment-resource.json';
      copyFiles([{ source: resource.filePath, destination: path.join(staging, name) }], hooks);
      shared.attachment = name;
      fileIncluded = true;
    }
    check();
    fs.writeFileSync(path.join(staging, 'resource.json'), JSON.stringify(shared, null, 2));
    let folder = path.join(root, `${safeFilename(resource.title)}-share`);
    let n = 2;
    while (fs.existsSync(folder)) folder = path.join(root, `${safeFilename(resource.title)}-share-${n++}`);
    commit();
    fs.renameSync(staging, folder);
    return { canceled: false, folder, fileIncluded };
  } catch (error) { cleanup(root, staging); throw error; }
}

function execute(type, payload) {
  check();
  switch (type) {
    case 'snapshot': {
      const db = new DatabaseSync(payload.databasePath, { readOnly: true, timeout: 5000 });
      try { return backups.createSnapshot({ ...payload, db, hooks }); }
      finally { db.close(); }
    }
    case 'inspect':
      progress({ phase: 'Checking backup' });
      return backups.inspectBackup(payload.folder, check);
    case 'prepare-restore': return backups.prepareRestore(payload.folder, payload.userData, hooks);
    case 'cleanup-restore': return backups.discardStaging(payload.userData, payload.staging);
    case 'history': return { history: backups.listBackups(payload.root), safety: backups.listBackups(payload.safetyRoot) };
    case 'import': return importFiles(payload);
    case 'cleanup-import': return cleanup(payload.userData, payload.staging);
    case 'share': return share(payload);
    default: throw new Error('Unknown file operation.');
  }
}

try { parentPort.postMessage({ type: 'result', value: execute(workerData.type, workerData.payload) }); }
catch (error) { parentPort.postMessage({ type: 'error', name: error.name, message: error.message }); }
