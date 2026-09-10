const fs = require('node:fs');
const path = require('node:path');

// This synchronous, bounded-memory copier runs only in a worker thread.
// Checking between chunks lets cancellation interrupt a single large file.
function copyFiles(files, { check = () => {}, progress = () => {} } = {}) {
  const planned = files.map(item => {
    check();
    const stat = fs.lstatSync(item.source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Not a regular file: ${item.source}`);
    return { ...item, size: stat.size, modified: stat.mtimeMs };
  });
  const totalBytes = planned.reduce((sum, file) => sum + file.size, 0);
  let copiedBytes = 0;
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  for (const [index, item] of planned.entries()) {
    check();
    progress({ phase: 'Copying files', fileName: path.basename(item.source), fileIndex: index + 1,
      totalFiles: planned.length, copiedBytes, totalBytes });
    fs.mkdirSync(path.dirname(item.destination), { recursive: true });
    let input;
    let output;
    let created = false;
    try {
      input = fs.openSync(item.source, 'r');
      output = fs.openSync(item.destination, 'wx');
      created = true;
      let position = 0;
      while (position < item.size) {
        check();
        const count = fs.readSync(input, buffer, 0, Math.min(buffer.length, item.size - position), position);
        if (!count) throw new Error(`The source file changed during copying: ${item.source}`);
        let written = 0;
        while (written < count) {
          const bytes = fs.writeSync(output, buffer, written, count - written);
          if (!bytes) throw new Error('The destination stopped accepting data.');
          written += bytes;
        }
        position += count;
        copiedBytes += count;
        progress({ phase: 'Copying files', fileName: path.basename(item.source), fileIndex: index + 1,
          totalFiles: planned.length, copiedBytes, totalBytes });
      }
      const finalStat = fs.fstatSync(input);
      if (finalStat.size !== item.size || finalStat.mtimeMs !== item.modified) throw new Error(`The source file changed during copying: ${item.source}`);
      check();
    } catch (error) {
      if (output !== undefined) { fs.closeSync(output); output = undefined; }
      if (created) fs.unlinkSync(item.destination);
      throw error;
    } finally {
      if (input !== undefined) fs.closeSync(input);
      if (output !== undefined) fs.closeSync(output);
    }
  }
}

function copyTree(source, destination, hooks = {}) {
  const files = [];
  function walk(from, to) {
    hooks.check?.();
    const stat = fs.lstatSync(from);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Cannot copy a linked or invalid folder.');
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const input = path.join(from, entry.name);
      const output = path.join(to, entry.name);
      if (entry.isDirectory()) walk(input, output);
      else files.push({ source: input, destination: output });
    }
  }
  walk(source, destination);
  copyFiles(files, hooks);
}

module.exports = { copyFiles, copyTree };
