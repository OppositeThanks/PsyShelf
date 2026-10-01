const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const pins = require('./publisher.json').thumbprints;
const NOT_CONFIGURED = 'Publisher verification is not configured. A signing certificate is required before in-app update downloads can be enabled.';
const INVALID = 'The installer signature or publisher is not trusted. The download was removed.';
function validateSignature(signature, thumbprints) {
  if (!Array.isArray(thumbprints) || !thumbprints.length || thumbprints.some(pin => !/^[A-F0-9]{40}$/.test(pin))) throw new Error(NOT_CONFIGURED);
  if (signature?.status !== 'Valid' || !thumbprints.includes(String(signature.thumbprint || '').toUpperCase())) throw new Error(INVALID);
  return true;
}
async function verifyInstaller(file, thumbprints = pins) {
  if (!thumbprints.length) throw new Error(NOT_CONFIGURED);
  if (process.platform !== 'win32') throw new Error(INVALID);
  try {
    const { stdout } = await promisify(execFile)(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; $s = Get-AuthenticodeSignature -LiteralPath $env:PSYSHELF_VERIFY_FILE; @{status=$s.Status.ToString();thumbprint=$s.SignerCertificate.Thumbprint} | ConvertTo-Json -Compress"], { env: { ...process.env, PSYSHELF_VERIFY_FILE: path.resolve(file) }, windowsHide: true, timeout: 30000 });
    return validateSignature(JSON.parse(stdout.replace(/^\uFEFF/, '')), thumbprints);
  } catch { throw new Error(INVALID); }
}
module.exports = { verifyInstaller, validateSignature, configured: pins.length > 0, NOT_CONFIGURED, INVALID };
