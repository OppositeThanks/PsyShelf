const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const backups = require('./backup.cjs');
const MAGIC = Buffer.from('PSYENC01');
const failure = () => new Error('Cannot decrypt backup. Check the password and backup integrity.');
function deriveKey(password, salt) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024 || !/^[a-f0-9]{32}$/.test(salt)) throw new Error('Use a password of 12 to 1,024 characters.');
  return crypto.scryptSync(password, Buffer.from(salt, 'hex'), 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}
function regular(file) { const s = fs.lstatSync(file); if (!s.isFile() || s.isSymbolicLink()) throw failure(); return s; }
function transform(source, destination, key, decrypt, context, check = () => {}) {
  const size = regular(source).size;
  const input = fs.openSync(source, 'r'); let output;
  try {
    const header = Buffer.alloc(20);
    let end = size;
    if (decrypt) {
      if (size < 36 || fs.readSync(input, header, 0, 20, 0) !== 20 || !header.subarray(0, 8).equals(MAGIC)) throw failure();
      end -= 16;
    } else { MAGIC.copy(header); crypto.randomFillSync(header, 8, 12); }
    const cipher = decrypt ? crypto.createDecipheriv('aes-256-gcm', key, header.subarray(8)) : crypto.createCipheriv('aes-256-gcm', key, header.subarray(8));
    cipher.setAAD(Buffer.from(context));
    if (decrypt) { const tag = Buffer.alloc(16); fs.readSync(input, tag, 0, 16, end); cipher.setAuthTag(tag); }
    output = fs.openSync(destination, 'wx', 0o600);
    if (!decrypt) fs.writeFileSync(output, header);
    const buffer = Buffer.alloc(1024 * 1024);
    for (let offset = decrypt ? 20 : 0; offset < end;) {
      check();
      const n = fs.readSync(input, buffer, 0, Math.min(buffer.length, end - offset), offset);
      if (!n) throw failure();
      fs.writeFileSync(output, cipher.update(buffer.subarray(0, n))); offset += n;
    }
    fs.writeFileSync(output, cipher.final());
    if (!decrypt) fs.writeFileSync(output, cipher.getAuthTag());
    fs.fsyncSync(output);
  } finally { fs.closeSync(input); if (output !== undefined) fs.closeSync(output); }
}
function cleanup(parent, folder) {
  if (path.dirname(path.resolve(folder)) !== path.resolve(parent) || !/^\.encrypted-[a-f0-9-]+$/.test(path.basename(folder))) throw failure();
  if (fs.existsSync(folder)) {
    if (fs.lstatSync(folder).isSymbolicLink() || path.dirname(fs.realpathSync(folder)) !== fs.realpathSync(parent)) throw failure();
    fs.rmSync(folder, { recursive: true });
  }
}
function temporary(parent) { fs.mkdirSync(parent, { recursive: true }); const folder = path.join(parent, '.encrypted-' + crypto.randomUUID()); fs.mkdirSync(folder); return folder; }
function createSnapshot({ db, managedLibraryPath, root, userData, encryption, version, kind = 'backup', hooks = {} }) {
  // Plaintext snapshots stay in app storage, never in the cloud destination.
  const local = temporary(userData); let staged;
  try {
    const snapshot = backups.createSnapshot({ db, managedLibraryPath, root: local, version, kind, hooks: { ...hooks, commit: undefined } });
    fs.mkdirSync(root, { recursive: true });
    const source = fs.realpathSync(managedLibraryPath), dest = fs.realpathSync(root);
    if (dest === source || dest.startsWith(source + path.sep)) throw new Error('Choose a backup folder outside the managed library.');
    staged = temporary(root);
    const id = crypto.randomUUID(), key = Buffer.from(encryption.key, 'base64');
    const entries = [];
    const walk = (folder, prefix = '') => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        hooks.check?.();
        const relative = prefix + entry.name;
        if (entry.isDirectory()) walk(path.join(folder, entry.name), relative + '/');
        else {
          const name = entries.length + '.enc';
          transform(path.join(folder, entry.name), path.join(staged, name), key, false, id + ':' + name, hooks.check);
          entries.push({ name, relative });
        }
      }
    };
    walk(snapshot.folder);
    const manifest = path.join(local, 'manifest.json'); fs.writeFileSync(manifest, JSON.stringify(entries));
    transform(manifest, path.join(staged, 'manifest.enc'), key, false, id + ':manifest', hooks.check);
    const info = { formatVersion: 2, encrypted: true, id, salt: encryption.salt, updatedAt: snapshot.updatedAt, kind };
    fs.writeFileSync(path.join(staged, 'backup-info.json'), JSON.stringify(info));
    hooks.check?.(); hooks.commit?.();
    const folder = path.join(root, snapshot.updatedAt.replaceAll(':', '-') + '-' + id.slice(0, 8));
    fs.renameSync(staged, folder); staged = null;
    return { ...snapshot, folder, encrypted: true };
  } finally { cleanup(userData, local); if (staged) cleanup(root, staged); }
}
function withDecrypted({ folder, userData, encryption, password }, callback, hooks = {}) {
  const infoPath = path.join(folder, 'backup-info.json');
  if (!fs.existsSync(infoPath)) return callback(folder);
  regular(infoPath);
  if (fs.statSync(infoPath).size > 4096) throw failure();
  const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  if (!info.encrypted) return callback(folder);
  if (info.formatVersion !== 2 || !/^[a-f0-9-]{36}$/.test(info.id) || !/^[a-f0-9]{32}$/.test(info.salt)) throw failure();
  if (!password && info.salt !== encryption?.salt) throw new Error('Enter the password used to encrypt this backup.');
  const key = password ? deriveKey(password, info.salt) : Buffer.from(encryption.key, 'base64');
  const local = temporary(userData);
  try {
    if (regular(path.join(folder, 'manifest.enc')).size > 16 * 1024 * 1024) throw failure();
    const manifest = path.join(local, 'manifest.json');
    transform(path.join(folder, 'manifest.enc'), manifest, key, true, info.id + ':manifest', hooks.check);
    const entries = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    if (!Array.isArray(entries) || entries.length > 100000) throw failure();
    const output = path.join(local, 'data'); fs.mkdirSync(output); fs.mkdirSync(path.join(output, 'library-files'));
    const names = new Set();
    for (const entry of entries) {
      hooks.check?.();
      if (!/^\d+\.enc$/.test(entry.name) || typeof entry.relative !== 'string' ||
          !/^(psyshelf\.sqlite|backup-info\.json|library-files\/[^\\/:\x00-\x1f]+)$/.test(entry.relative) ||
          /[. ]$/.test(entry.relative) || names.has(entry.relative.toLowerCase())) throw failure();
      names.add(entry.relative.toLowerCase());
      transform(path.join(folder, entry.name), path.join(output, ...entry.relative.split('/')), key, true, info.id + ':' + entry.name, hooks.check);
    }
    return callback(output);
  } catch (error) { if (error.name === 'AbortError') throw error; throw failure(); }
  finally { key.fill(0); cleanup(userData, local); }
}
module.exports = { deriveKey, createSnapshot, withDecrypted, transform };
