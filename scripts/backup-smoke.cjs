// Run with PSYSHELF_PLAYWRIGHT_MODULE pointing to Playwright when it is not installed locally.
const { _electron } = require(process.env.PSYSHELF_PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function run() {
  const project = path.resolve(process.env.PSYSHELF_APP_DIR || path.join(__dirname, '..'));
  const artifacts = path.resolve(__dirname, '../artifacts', `backup-smoke-${Date.now()}`);
  const data = path.join(artifacts, 'user-data');
  const cloud = path.join(artifacts, 'cloud');
  fs.mkdirSync(cloud, { recursive: true });
  fs.writeFileSync(path.join(artifacts, 'paper.txt'), 'Original managed contents');
  const options = { executablePath: process.env.PSYSHELF_EXECUTABLE || require('electron'),
    args: [project], env: { ...process.env, PSYSHELF_TEST_DATA_DIR: data } };
  let application = await _electron.launch(options);
  async function mockDialogs(folder, response = 0) {
    await application.evaluate(({ dialog }, options) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [options.folder] });
      dialog.showMessageBox = async (_window, details) => {
        globalThis.restorePrompt = details;
        return { response: options.response };
      };
    }, { folder, response });
  }
  async function getPage() {
    const page = await application.firstWindow();
    await page.waitForFunction(() => Boolean(window.psyLibrary));
    if (await page.locator('#agentSetupDialog').count()) {
      await page.waitForSelector('#agentSetupDialog[open]');
      await page.locator('#agentSetupDialog [data-close]').first().click();
    }
    return page;
  }
  try {
    let page = await getPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('.resource-card');
    await mockDialogs(cloud);
    await page.evaluate(() => window.psyLibrary.chooseBackupFolder());
    await mockDialogs(path.join(artifacts, 'paper.txt'));
    const [managed] = await page.evaluate(() => window.psyLibrary.addFiles({ storageMode: 'copy' }));
    const originalCount = (await page.evaluate(() => window.psyLibrary.listResources({}))).length;
    const saved = await page.evaluate(() => window.psyLibrary.syncBackup());
    await page.evaluate(() => window.psyLibrary.addUrl({ title: 'After backup', url: 'https://example.com/new' }));
    fs.writeFileSync(managed.filePath, 'Changed contents');

    await mockDialogs(saved.folder, 0);
    assert.equal((await page.evaluate(() => window.psyLibrary.restoreBackup())).canceled, true);
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, originalCount + 1);
    assert.equal((await page.evaluate(() => window.psyLibrary.backupStatus())).safety.length, 0);

    await mockDialogs(artifacts, 1);
    assert.match(await page.evaluate(async () => {
      try { await window.psyLibrary.restoreBackup(); return 'unexpected success'; }
      catch (error) { return error.message; }
    }), /ENOENT/);
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, originalCount + 1);

    // A failed safety backup must stop before changing the live library.
    await mockDialogs(saved.folder, 1);
    fs.writeFileSync(path.join(data, 'restore-safety'), 'Simulate an unavailable safety destination');
    assert.match(await page.evaluate(async () => {
      try { await window.psyLibrary.restoreBackup(); return 'unexpected success'; }
      catch (error) { return error.message; }
    }), /EEXIST|ENOTDIR/);
    assert.equal(fs.readdirSync(data).filter(name => name.startsWith('.restore-')).length, 0);
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, originalCount + 1);
    assert.equal(fs.readFileSync(managed.filePath, 'utf8'), 'Changed contents');
    fs.unlinkSync(path.join(data, 'restore-safety'));

    await mockDialogs(saved.folder, 1);
    await page.locator('#backupCard').click();
    await page.locator('#restoreBackup').click();
    await page.waitForSelector('#settingsDialog', { state: 'hidden' });
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, originalCount);
    assert.equal(fs.readFileSync(managed.filePath, 'utf8'), 'Original managed contents');
    const status = await page.evaluate(() => window.psyLibrary.backupStatus());
    assert.equal(status.safety.length, 1);
    assert.ok(fs.existsSync(path.join(status.safety[0].folder, 'psyshelf.sqlite')));
    const prompt = await application.evaluate(() => globalThis.restorePrompt);
    assert.equal(prompt.cancelId, 0);
    assert.match(prompt.detail, /Referenced originals/);
    await page.locator('#backupCard').click();
    await page.locator('#backupHistory').waitFor({ state: 'attached' });
    await page.waitForFunction(() => document.querySelector('#backupStatus').textContent.startsWith('Last successful backup:'));
    await page.locator('#settingsDialog details').evaluate(element => { element.open = true; });
    await page.locator('#restoreBackup').evaluate(element => element.closest('section').scrollIntoView());
    await page.screenshot({ path: path.join(artifacts, 'backup-settings.png') });
    assert.deepEqual(errors, []);

    // A safety copy can undo the replacement, including the managed file contents.
    await mockDialogs(status.safety[0].folder, 1);
    await page.locator('#backupHistory button').first().click();
    await page.waitForSelector('#settingsDialog', { state: 'hidden' });
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, originalCount + 1);
    assert.equal(fs.readFileSync(managed.filePath, 'utf8'), 'Changed contents');

    // Restore an empty library, then restart: startup must not reimport the seed catalog.
    await page.evaluate(async () => {
      for (const resource of await window.psyLibrary.listResources({})) await window.psyLibrary.deleteResource(resource.id);
    });
    const empty = await page.evaluate(() => window.psyLibrary.syncBackup());
    await page.evaluate(() => window.psyLibrary.addUrl({ title: 'Temporary', url: 'https://example.com/temporary' }));
    await mockDialogs(empty.folder, 1);
    await page.evaluate(() => window.psyLibrary.restoreBackup());
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, 0);
    await application.close();
    application = await _electron.launch(options);
    page = await application.firstWindow();
    await page.waitForFunction(() => Boolean(window.psyLibrary));
    assert.equal((await page.evaluate(() => window.psyLibrary.listResources({}))).length, 0);
    console.log('Backup desktop smoke test passed:', artifacts);
  } finally { await application.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
