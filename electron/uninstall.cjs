const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function uninstallerPath(app) {
  if (!app.isPackaged || process.platform !== 'win32') return null;
  const target = path.join(path.dirname(app.getPath('exe')), 'Uninstall PsyShelf.exe');
  return fs.existsSync(target) ? target : null;
}

async function uninstall({ app, dialog, window, stop, launch = startUninstaller }) {
  const executable = uninstallerPath(app);
  if (!executable) throw new Error('Uninstall is available in the installed Windows app.');
  const result = await dialog.showMessageBox(window, {
    type: 'warning', title: 'Uninstall PsyShelf', message: 'How would you like to uninstall PsyShelf?',
    detail: 'Keep library: remove the application and shortcuts, but keep your library and settings for reinstallation.\n\nDelete local data: also permanently remove your catalog, notes, managed file copies, settings, caches, and local restore safety copies. Back up anything you want to keep first.\n\nReferenced originals and backups outside the app-data folder are not removed. Active file copies will be cancelled safely before uninstall starts.',
    buttons: ['Cancel', 'Uninstall — keep library', 'Uninstall — delete local data'],
    defaultId: 0, cancelId: 0, noLink: true
  });
  if (result.response !== 1 && result.response !== 2) return { canceled: true };
  await stop();
  await launch(executable, result.response === 2 ? ['--delete-app-data'] : []);
  app.quit();
  return { canceled: false };
}

function startUninstaller(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

module.exports = { uninstallerPath, uninstall };
