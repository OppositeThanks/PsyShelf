// Real Electron integration checks against a temporary, isolated library.
const { app, BrowserWindow, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { pdfFixture } = require('../test/fixtures/pdf.cjs');
const { mainUrl } = require('../electron/security.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-security-smoke-'));
process.env.PSYSHELF_TEST_DATA_DIR = root;
const exportsFolder = path.join(root, 'exports'); fs.mkdirSync(exportsFolder);
const files = ['safe.txt', 'safe.pdf', 'blocked.exe'].map(name => path.join(root, name));
fs.writeFileSync(files[0], 'Security smoke document.');
fs.writeFileSync(files[1], pdfFixture(['Security smoke PDF.']));
fs.writeFileSync(files[2], 'MZ test fixture, never execute');
let chosenFiles = [];
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: chosenFiles });
let shellCalls = 0;
shell.openPath = async () => { shellCalls++; return ''; };
shell.openExternal = async () => { shellCalls++; };
const violations = [];
app.on('web-contents-created', (_event, contents) => contents.on('console-message', ({ message }) => {
  if (/Refused|Content Security Policy|Uncaught/.test(message)) violations.push(message);
}));
require('../electron/main.cjs');
const evaluate = (window, fn, arg) => window.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)})`, true);
async function ready(window) {
  if (window.webContents.isLoading()) await once(window.webContents, 'did-finish-load');
}
async function preview(main, id) {
  const before = new Set(BrowserWindow.getAllWindows().map(w => w.id));
  await evaluate(main, id => window.psyLibrary.openPreview(id), id);
  const window = BrowserWindow.getAllWindows().find(w => !before.has(w.id));
  assert.ok(window); await ready(window);
  await evaluate(window, () => window.psyPreview.getData());
  return window;
}
async function run() {
  await app.whenReady();
  const main = BrowserWindow.getAllWindows()[0]; assert.ok(main); await ready(main);
  main.hide();
  assert.equal(await evaluate(main, async () => (await navigator.permissions.query({ name: 'clipboard-write' })).state), 'granted');
  assert.equal(await evaluate(main, async () => (await window.psyLibrary.listResources({})).length), 17);
  chosenFiles = files;
  const resources = await evaluate(main, () => window.psyLibrary.addFiles({ storageMode: 'reference' }));
  const text = resources.find(r => r.filePath.endsWith('safe.txt'));
  const pdf = resources.find(r => r.filePath.endsWith('safe.pdf'));
  const blocked = resources.find(r => r.filePath.endsWith('blocked.exe'));
  await assert.rejects(evaluate(main, id => window.psyLibrary.openResource(id), blocked.id), /blocked/);
  const blockedPreview = await preview(main, blocked.id);
  await assert.rejects(evaluate(blockedPreview, () => window.psyPreview.openOriginal()), /blocked/);
  blockedPreview.destroy(); assert.equal(shellCalls, 0);
  const textPreview = await preview(main, text.id);
  assert.match(await evaluate(textPreview, () => document.querySelector('#content').textContent), /Security smoke document/);
  textPreview.destroy();
  const pdfPreview = await preview(main, pdf.id);
  // Allow the local PDF reader to render before checking policy violations.
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.match(await evaluate(pdfPreview, () => document.querySelector('#pdfText')?.textContent || document.querySelector('#status').textContent), /Security smoke PDF/);
  assert.ok(await evaluate(pdfPreview, () => document.querySelector('#pdfCanvas').width > 0));
  await evaluate(pdfPreview, () => window.psyPreview.saveReading({ lastPage: 1 }));
  assert.equal(violations.length, 0, violations.join('\n'));
  pdfPreview.destroy();
  const link = await evaluate(main, () => window.psyLibrary.addUrl({ title: 'Link', url: 'https://example.com', authors: [], categories: ['URL'], languages: [] }));
  const linkPreview = await preview(main, link.id);
  assert.equal(await evaluate(linkPreview, () => document.querySelectorAll('iframe').length), 0);
  linkPreview.destroy();
  await evaluate(main, id => window.psyLibrary.updateResource(id, { personalNotes: 'PRIVATE SMOKE NOTE' }), text.id);
  const review = await evaluate(main, id => window.psyLibrary.previewShare(id, { includeFile: false, includeNotes: false }), text.id);
  assert.equal(Object.hasOwn(review.metadata, 'personalNotes'), false);
  chosenFiles = [exportsFolder];
  const result = await evaluate(main, token => window.psyLibrary.shareResource(token), review.token);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.folder, 'resource.json'), 'utf8')), review.metadata);
  await assert.rejects(evaluate(main, token => window.psyLibrary.shareResource(token), review.token), /expired/);
  for (const language of ['English', 'French', 'Spanish', 'English']) {
    const rendered = await evaluate(main, async ({ id, language }) => {
      window.psyI18n.setLanguage(language);
      await loadResources(id);
      await shareSelected(currentResource());
      await new Promise(resolve => setTimeout(resolve, 0));
      const result = { heading: document.querySelector('#shareReviewTitle').textContent, notes: document.querySelector('#shareNotesStatus').textContent, content: document.querySelector('#shareReviewContent').textContent };
      document.querySelector('#shareReviewDialog').close();
      return result;
    }, { id: text.id, language });
    assert.equal(rendered.content.includes('PRIVATE SMOKE NOTE'), false);
    assert.equal(rendered.heading, { English: 'Review export', French: 'Vérifier l’export', Spanish: 'Revisar exportación' }[language]);
    const message = await evaluate(main, async id => {
      try { await window.psyLibrary.openResource(id); } catch (error) { toast(errorMessage(error), true); }
      await new Promise(resolve => setTimeout(resolve, 0));
      return document.querySelector('#toast').textContent;
    }, blocked.id);
    assert.equal(message, require('../renderer/i18n.js').translate(require('../src/file-security.cjs').blockedMessage, language));
  }
  // Verify the browser enforces the policy, rather than only checking a string.
  assert.equal(await evaluate(main, async () => {
    window.cspProbe = false;
    const script = document.createElement('script'); script.textContent = 'window.cspProbe = true'; document.body.append(script);
    await new Promise(resolve => setTimeout(resolve, 0)); return window.cspProbe;
  }), false);
  const impostor = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, preload: path.join(__dirname, '../test/fixtures/security-probe-preload.cjs') } });
  await impostor.loadURL(mainUrl);
  await assert.rejects(evaluate(impostor, () => window.securityProbe.invoke('resources:list', {})), /not allowed/);
  impostor.destroy();
  assert.equal(shellCalls, 0);
  console.log('PASS: real IPC isolation, CSP, file blocking, PDF/text/link previews, reviewed exports, token replay protection, and EN/FR/ES export UI.');
}
const timeout = setTimeout(() => { console.error('Security smoke test timed out'); app.exit(1); }, 45000);
run().then(() => { clearTimeout(timeout); app.quit(); }, error => { console.error(error); clearTimeout(timeout); app.exit(1); });
app.on('will-quit', () => {
  // Only this test-created directory is eligible for cleanup.
  assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('psyshelf-security-smoke-'));
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { console.log('Temporary smoke data retained at', root); }
});
