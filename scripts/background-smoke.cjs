const { _electron } = require(process.env.PSYSHELF_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function run() {
  const project = path.resolve(process.env.PSYSHELF_APP_DIR || path.join(__dirname, '..'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-background-smoke-'));
  const data = path.join(root, 'user-data');
  const cloud = path.join(root, 'cloud');
  fs.mkdirSync(cloud);
  const large = path.join(root, 'large.bin');
  const fd = fs.openSync(large, 'wx'); fs.ftruncateSync(fd, 128 * 1024 * 1024); fs.closeSync(fd);
  for (const folder of ['first', 'second']) {
    fs.mkdirSync(path.join(root, folder));
    fs.writeFileSync(path.join(root, folder, 'paper.txt'), folder);
  }
  const options = { executablePath: process.env.PSYSHELF_EXECUTABLE || require('electron'),
    args: process.env.PSYSHELF_EXECUTABLE ? [] : [project],
    env: { ...process.env, PSYSHELF_TEST_DATA_DIR: data } };
  let application = await _electron.launch(options);
  let closed = false;
  async function dialogs(paths) {
    await application.evaluate(({ dialog }, paths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths });
      dialog.showMessageBox = async () => ({ response: 1 });
    }, paths);
  }
  try {
    let page = await application.firstWindow();
    await page.waitForSelector('.resource-card');
    if (await page.locator('#agentSetupDialog').count()) {
      await page.waitForSelector('#agentSetupDialog[open]');
      await page.locator('#agentSetupDialog [data-close]').first().click();
    }
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const initial = (await page.evaluate(() => window.psyLibrary.listResources({}))).length;
    await dialogs([large]);
    await page.evaluate(() => {
      let handled = false;
      window.cancelProbe = {};
      const off = window.psyLibrary.onFileOperation(async status => {
        if (handled || status.label !== 'Import files' || status.phase !== 'Copying files') return;
        handled = true;
        off();
        try {
          window.cancelProbe.count = (await window.psyLibrary.listResources({})).length;
          window.cancelProbe.wasRunning = (await window.psyLibrary.fileOperationStatus()).state === 'running';
          window.cancelProbe.progressVisible = !document.querySelector('.workspace .file-activity').hidden;
          document.querySelector('.workspace [data-file-cancel]').click();
        } catch (error) { window.cancelProbe.error = error.message; }
      });
      window.psyLibrary.addFiles({ storageMode: 'copy' }).then(
        result => { window.importResult = { count: result.length }; },
        error => { window.importResult = { error: error.message }; }
      );
    });
    await page.waitForFunction(() => window.importResult !== undefined);
    const cancelled = await page.evaluate(() => ({ result: window.importResult, probe: window.cancelProbe }));
    assert.match(cancelled.result.error, /cancelled/i);
    assert.equal(cancelled.probe.count, initial);
    assert.equal(cancelled.probe.wasRunning, true);
    assert.equal(cancelled.probe.progressVisible, true);
    assert.deepEqual(fs.readdirSync(path.join(data, 'library-files')), []);
    assert.equal(fs.readdirSync(data).filter(name => name.startsWith('.import-')).length, 0);

    await dialogs([path.join(root, 'first', 'paper.txt'), path.join(root, 'second', 'paper.txt')]);
    const created = await page.evaluate(() => window.psyLibrary.addFiles({ storageMode: 'copy' }));
    assert.equal(created.length, 2);
    assert.notEqual(created[0].filePath, created[1].filePath);
    assert.equal(fs.readFileSync(created[0].filePath, 'utf8'), 'first');
    assert.equal(fs.readFileSync(created[1].filePath, 'utf8'), 'second');
    await dialogs([cloud]);
    await page.evaluate(() => window.psyLibrary.chooseBackupFolder());
    // An unreferenced managed file makes the copy long enough to exercise concurrent UI work.
    const extra = fs.openSync(path.join(data, 'library-files', 'large.bin'), 'wx');
    fs.ftruncateSync(extra, 128 * 1024 * 1024); fs.closeSync(extra);
    await page.evaluate(id => {
      let edited = false;
      window.autoFinished = false;
      window.psyLibrary.onFileOperation(status => {
        if (status.label === 'Automatic backup' && status.state === 'completed') window.autoFinished = true;
        if (!edited && status.label === 'Backup' && status.phase === 'Copying files') {
          edited = true;
          window.concurrentEdit = window.psyLibrary.updateResource(id, { title: 'Edited during backup' });
        }
      });
    }, created[0].id);
    const backup = await page.evaluate(() => window.psyLibrary.syncBackup());
    await page.evaluate(() => window.concurrentEdit);
    await page.waitForFunction(() => window.autoFinished, { timeout: 15000 });
    const saved = new DatabaseSync(path.join(backup.folder, 'psyshelf.sqlite'), { readOnly: true });
    try { assert.equal(saved.prepare('SELECT title FROM resources WHERE id = ?').get(created[0].id).title, created[0].title); }
    finally { saved.close(); }
    const history = await page.evaluate(() => window.psyLibrary.backupStatus());
    assert.equal(history.history.length, 2, 'Edits during copying produce one follow-up automatic backup');

    await dialogs([backup.folder]);
    await page.evaluate(() => {
      let handled = false;
      window.restoreProbe = {};
      const off = window.psyLibrary.onFileOperation(async status => {
        if (handled || status.label !== 'Restore backup' || status.phase !== 'Copying files') return;
        handled = true; off();
        try {
          window.restoreProbe.count = (await window.psyLibrary.listResources({})).length;
          await window.psyLibrary.addUrl({ title: 'Must not be added', url: 'https://example.com/blocked' });
          window.restoreProbe.edit = 'unexpected success';
        } catch (error) { window.restoreProbe.edit = error.message; }
        await window.psyLibrary.cancelFileOperation(status.id);
      });
      window.psyLibrary.restoreBackup().then(
        result => { window.restoreResult = result; },
        error => { window.restoreResult = { error: error.message }; }
      );
    });
    await page.waitForFunction(() => window.restoreResult !== undefined);
    const restored = await page.evaluate(() => ({ result: window.restoreResult, probe: window.restoreProbe }));
    assert.match(restored.result.error, /cancelled/i);
    assert.match(restored.probe.edit, /paused/);
    assert.equal(restored.probe.count, initial + 2);
    assert.equal(fs.readdirSync(data).filter(name => name.startsWith('.restore-')).length, 0);
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, initial + 2);
    const screenshot = path.resolve(__dirname, '../artifacts', `background-activity-${Date.now()}.png`);
    await page.screenshot({ path: screenshot });
    assert.deepEqual(errors, []);

    // Closing during a copy cancels it and waits for cleanup before closing SQLite.
    await dialogs([large]);
    const exited = new Promise(resolve => application.process().once('exit', resolve));
    await page.evaluate(() => {
      let closing = false;
      window.psyLibrary.onFileOperation(status => {
        if (!closing && status.label === 'Import files' && status.phase === 'Copying files') { closing = true; window.close(); }
      });
      window.psyLibrary.addFiles({ storageMode: 'copy' }).catch(() => {});
    });
    await exited;
    closed = true;
    assert.equal(fs.readdirSync(data).filter(name => name.startsWith('.import-')).length, 0);
    application = await _electron.launch(options);
    closed = false;
    page = await application.firstWindow();
    await page.waitForFunction(() => Boolean(window.psyLibrary));
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, initial + 2);
    console.log('Background desktop checks passed:', screenshot);
  } finally {
    if (!closed) await application.close();
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('psyshelf-background-smoke-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
