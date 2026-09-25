const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
// Disposable extraction index, separate from the backed-up library. One atomic file per source/mode.
async function indexedDocument(filename, options, extract) {
  if (!options.cacheDir) return extract(filename, options);
  const stat = await fs.stat(filename);
  const mode = options.ocr ? options.ocr.language : 'text';
  const key = crypto.createHash('sha256').update(path.resolve(filename) + '\0' + mode).digest('hex');
  const fingerprint = [2, stat.size, stat.mtimeMs, stat.ctimeMs, mode].join(':');
  const target = path.join(options.cacheDir, key + '.json');
  try {
    const cached = JSON.parse(await fs.readFile(target, 'utf8'));
    if (cached.fingerprint === fingerprint && Array.isArray(cached.document?.pages)) return cached.document;
  } catch { /* A missing or damaged index is rebuilt from the original. */ }
  const document = await extract(filename, options);
  const after = await fs.stat(filename);
  // Retry limited OCR on a later search rather than permanently caching partial recognition.
  if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || /OCR is limited|OCR could not/.test(document.warning || '')) return document;
  let temporary;
  try {
    await fs.mkdir(options.cacheDir, { recursive: true });
    temporary = target + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temporary, JSON.stringify({ fingerprint, document }));
    await fs.rename(temporary, target);
  } catch { /* Search remains usable when cache storage is unavailable. */ }
  finally { if (temporary) await fs.unlink(temporary).catch(() => {}); }
  return document;
}
module.exports = { indexedDocument };
