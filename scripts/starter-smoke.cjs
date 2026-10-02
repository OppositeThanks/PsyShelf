// Cold-start checks use a disposable library, never the user's app data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
if (!process.env.PSYSHELF_STARTER_PHASE) {
  const { spawnSync } = require('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-starter-'));
  try {
    for (const phase of ['fresh', 'existing', 'empty']) {
      const result = spawnSync(require('electron'), [__filename], {
        env: { ...process.env, PSYSHELF_TEST_DATA_DIR: root, PSYSHELF_STARTER_PHASE: phase },
        stdio: 'inherit', timeout: 30000
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, phase);
    }
    console.log('PASS: five packaged demos, edited library preserved on restart, intentionally empty library stays empty.');
  } finally {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('psyshelf-starter-'));
    try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
  }
} else {
  const { app, BrowserWindow } = require('electron');
  const { once } = require('node:events');
  require('../electron/main.cjs');
  async function run() {
    await app.whenReady();
    const window = BrowserWindow.getAllWindows()[0];
    window.hide();
    if (window.webContents.isLoading()) await once(window.webContents, 'did-finish-load');
    const evaluate = code => window.webContents.executeJavaScript(code, true);
    const resources = await evaluate('window.psyLibrary.listResources({})');
    const phase = process.env.PSYSHELF_STARTER_PHASE;
    if (phase === 'empty') { assert.equal(resources.length, 0); return; }
    assert.equal(resources.length, 5);
    if (phase === 'fresh') {
      for (const resource of resources) {
        assert.match(resource.title, /^DEMO - /);
        assert.equal(resource.storageMode, 'copy');
        assert.match(fs.readFileSync(resource.filePath, 'utf8'), /Original educational sample/);
      }
      await evaluate(`window.psyLibrary.updateResource(${JSON.stringify(resources[0].id)}, {title:'Edited demo',personalNotes:'Preserve my notes'})`);
    } else {
      const edited = resources.find(resource => resource.title === 'Edited demo');
      assert.ok(edited); assert.equal(edited.personalNotes, 'Preserve my notes');
      for (const resource of resources) await evaluate(`window.psyLibrary.deleteResource(${JSON.stringify(resource.id)})`);
      assert.equal((await evaluate('window.psyLibrary.listResources({})')).length, 0);
    }
  }
  run().then(() => app.quit(), error => { console.error(error); app.exit(1); });
}
