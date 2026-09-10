const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { uninstall, uninstallerPath } = require('../electron/uninstall.cjs');

test('development builds cannot launch an uninstaller', () => {
  assert.equal(uninstallerPath({ isPackaged: false }), null);
});

test('uninstall requires a choice, waits for cleanup, and only passes the data deletion flag on explicit selection',
  { skip: process.platform !== 'win32' }, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-uninstall-test-'));
    fs.writeFileSync(path.join(root, 'Uninstall PsyShelf.exe'), 'Test placeholder; never executed');
    t.after(() => {
      assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(root).startsWith('psyshelf-uninstall-test-'));
      fs.rmSync(root, { recursive: true, force: true });
    });
    for (const response of [0, 1, 2]) {
      const calls = [];
      const app = { isPackaged: true, getPath: () => path.join(root, 'PsyShelf.exe'), quit: () => calls.push('quit') };
      const result = await uninstall({ app, window: {},
        dialog: { showMessageBox: async (_window, options) => {
          assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0);
          assert.match(options.detail, /Referenced originals/);
          return { response };
        } },
        stop: async () => { calls.push('stop'); },
        launch: async (exe, args) => {
          assert.equal(exe, path.join(root, 'Uninstall PsyShelf.exe'));
          assert.deepEqual(args, response === 2 ? ['--delete-app-data'] : []);
          calls.push('launch');
        }
      });
      assert.equal(result.canceled, response === 0);
      assert.deepEqual(calls, response === 0 ? [] : ['stop', 'launch', 'quit']);
    }
  });
