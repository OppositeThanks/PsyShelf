const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(process.env.PSYSHELF_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-localization-'));
  fs.writeFileSync(path.join(data, 'settings.json'), JSON.stringify({agentSetupSeen:true}));
  const app = await _electron.launch({executablePath: require('electron'), args:[path.resolve('.')], env:{...process.env, PSYSHELF_TEST_DATA_DIR:data}});
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('.resource-card');
    const resources = await page.evaluate(() => window.psyLibrary.listResources());
    for (const [language, book, restore, uninstall, progress] of [
      ['French','Livre','Restaurer une sauvegarde…','Désinstaller PsyShelf…','Sauvegarde :'],
      ['Spanish','Libro','Restaurar copia de seguridad…','Desinstalar PsyShelf…','Copia de seguridad:'],
      ['English','Book','Restore backup…','Uninstall PsyShelf…','Backup:']
    ]) {
      await page.locator('#settingsButton').click();
      await page.locator('#interfaceLanguage').selectOption(language);
      await page.waitForFunction(value => window.psyI18n.language === value, language);
      assert.equal(await page.locator('#restoreBackup').textContent(),restore);
      assert.equal(await page.locator('#uninstallApp').textContent(),uninstall);
      assert.equal(await page.locator('[data-category="Book"] span').first().textContent(),book);
      await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.send('files:progress', {id:'language-check',sequence:Date.now(),label:'Backup',phase:'Copying files',state:'running',cancellable:true,totalBytes:100,copiedBytes:50,totalFiles:2,fileIndex:1,fileName:'Book.pdf'}));
      await page.waitForFunction(() => document.querySelector('#settingsDialog .file-activity-status').textContent.includes(':'));
      const status=await page.locator('#settingsDialog .file-activity-status').textContent();
      assert(status.startsWith(progress.replace(' :',':')), status);
      assert.match(await page.locator('#settingsDialog .file-activity-detail').textContent(), /Book\.pdf$/);
      // Capture native options without opening or accepting an OS dialog.
      await app.evaluate(({dialog}) => { dialog.showOpenDialog=async (_window,options) => {global.languageDialog=options;return {canceled:true}}; });
      await page.evaluate(() => window.psyLibrary.chooseBackupFolder());
      const native=await app.evaluate(() => global.languageDialog.title);
      assert.equal(native, require('../renderer/i18n.js').translate('Choose your Google Drive or cloud-synced folder',language));
      await page.locator('[data-close="settingsDialog"]').click();
      await page.locator('[data-category="Book"]').click();
      assert((await page.locator('.resource-card').count()) > 0);
      assert.equal(await page.locator('.resource-card .pill.category').first().textContent(),book);
      await page.locator('#allResourcesButton').click();
    }
    assert.deepEqual(await page.evaluate(() => window.psyLibrary.listResources()),resources);
    console.log('PASS: three-language switching, categories/filtering, settings, progress, filenames, native dialogs, and unchanged saved resources.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
