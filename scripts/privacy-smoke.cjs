const { app, BrowserWindow, dialog, powerMonitor } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-privacy-smoke-'));
process.env.PSYSHELF_TEST_DATA_DIR = root;
const backupFolder = path.join(root, 'cloud'); fs.mkdirSync(backupFolder);
fs.writeFileSync(path.join(root, 'settings.json'), JSON.stringify({ backupFolder, agentSetupSeen: true }));
dialog.showMessageBox = async () => ({ response: 1 });
require('../electron/main.cjs');
const evaluate = (win, fn, arg) => win.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)})`, true);
async function page(win, name) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    if (win.webContents.getURL().endsWith('/' + name) && !win.webContents.isLoading()) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Page did not load: ' + name);
}
async function run() {
  await app.whenReady(); const main = BrowserWindow.getAllWindows()[0];
  if (main.webContents.isLoading()) await once(main.webContents, 'did-finish-load'); main.hide();
  const password = 'test-only privacy passphrase';
  await evaluate(main, password => window.psyLibrary.encryptBackups(password), password);
  const snapshot = await evaluate(main, () => window.psyLibrary.syncBackup());
  assert.ok(fs.existsSync(path.join(snapshot.folder, 'manifest.enc')));
  assert.equal(fs.existsSync(path.join(snapshot.folder, 'psyshelf.sqlite')), false);
  const record = fs.readFileSync(path.join(root, 'privacy.json'), 'utf8'); assert.equal(record.includes(password), false);
  await assert.rejects(evaluate(main, folder => window.psyLibrary.restoreBackup(folder, 'incorrect password'), snapshot.folder), /decrypt/);
  const restored = await evaluate(main, folder => window.psyLibrary.restoreBackup(folder), snapshot.folder);
  assert.equal(restored.resourceCount, 17);
  assert.ok(fs.existsSync(path.join(restored.safetyFolder, 'manifest.enc')));
  await evaluate(main, async password => { await window.psyLibrary.configureLock(password, 5); }, password);
  const records = JSON.parse(fs.readFileSync(path.join(root, 'privacy.json'), 'utf8'));
  assert.equal(records.lock.minutes, 5);
  // System lock events must clear previews and deny requests, including a forced reload of the main page.
  const resource = await evaluate(main, () => window.psyLibrary.addUrl({ title: 'PRIVATE PREVIEW', url: 'https://example.com', authors: [], categories: [], languages: [] }));
  await evaluate(main, id => window.psyLibrary.openPreview(id), resource.id);
  powerMonitor.emit('lock-screen'); await page(main, 'lock.html');
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  assert.equal(await evaluate(main, () => document.body.textContent.includes('PRIVATE PREVIEW')), false);
  await assert.rejects(evaluate(main, () => window.psyLibrary.unlock('incorrect password')), /Incorrect/);
  assert.equal((await evaluate(main, () => window.psyLibrary.securityStatus())).locked, true);
  await main.loadFile(path.join(__dirname, '../renderer/index.html'));
  await assert.rejects(evaluate(main, () => window.psyLibrary.listResources({})), /Unlock/);
  await main.loadFile(path.join(__dirname, '../renderer/lock.html'));
  for (const language of ['French', 'Spanish', 'English']) {
    const heading = await evaluate(main, language => { window.psyI18n.setLanguage(language); return document.querySelector('h1').textContent; }, language);
    assert.equal(heading, { French: 'Bibliothèque verrouillée', Spanish: 'Biblioteca bloqueada', English: 'Library locked' }[language]);
  }
  await new Promise(resolve => setTimeout(resolve, 1600));
  // Do not hold an executeJavaScript promise across a navigation.
  await evaluate(main, password => { document.getElementById('unlockPassword').value = password; document.getElementById('unlockForm').requestSubmit(); }, password);
  await page(main, 'index.html');
  assert.equal((await evaluate(main, () => window.psyLibrary.listResources({}))).length, 18);
  console.log('PASS: encrypted automatic and safety backups, password restoration, protected key storage, lock-screen closure, locked IPC denial, unlock, and EN/FR/ES lock screens.');
}
const timeout = setTimeout(() => { console.error('Privacy smoke timed out'); app.exit(1); }, 60000);
run().then(() => { clearTimeout(timeout); app.quit(); }, error => { console.error(error); clearTimeout(timeout); app.exit(1); });
