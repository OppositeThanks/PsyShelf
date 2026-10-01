const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
async function encryptStorage(root) {
  if (process.platform !== 'win32') throw new Error('Windows file encryption is unavailable on this computer.');
  // Paths are data in the child environment, never PowerShell source. Reparse points are rejected.
  const script = `
    $ErrorActionPreference = 'Stop'
    $root = Get-Item -LiteralPath $env:PSYSHELF_ENCRYPT_ROOT -Force
    function Protect($item) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse point' }
      [IO.File]::Encrypt($item.FullName)
      if (-not ((Get-Item -LiteralPath $item.FullName -Force).Attributes -band [IO.FileAttributes]::Encrypted)) { throw 'Encryption unavailable' }
    }
    Protect $root
    foreach ($name in @('psyshelf.sqlite','psyshelf.sqlite-wal','psyshelf.sqlite-shm','library-files','document-index','restore-safety')) {
      $target = Join-Path $root.FullName $name
      if (Test-Path -LiteralPath $target) {
        $item = Get-Item -LiteralPath $target -Force
        Protect $item
        if ($item.PSIsContainer) {
          Get-ChildItem -LiteralPath $target -Force -Recurse | ForEach-Object { Protect $_ }
        }
      }
    }`;
  try { await run(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, env: { ...process.env, PSYSHELF_ENCRYPT_ROOT: path.resolve(root) }, timeout: 300000 }); }
  catch { throw new Error('Windows file encryption could not finish. Keep your EFS recovery certificate safe and check that this drive supports EFS.'); }
}
module.exports = { encryptStorage };
