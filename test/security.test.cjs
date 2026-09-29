const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkPath, inspectOpenFile, openCheckedFile } = require('../src/file-security.cjs');
const { shareMetadata } = require('../src/share-policy.cjs');
const { assertTrustedSender, protectWindow, protectSession, mainUrl, previewUrl } = require('../electron/security.cjs');
const { workerTask } = require('../src/file-jobs.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psyshelf-security-'));
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('psyshelf-security-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

test('exports exclude notes, local paths, internal identifiers and unexpected private fields by default', async t => {
  const root = fixture(t);
  const resource = { id: 'private-id', title: 'Public title', description: 'Public description', authors: ['Author'],
    personalNotes: 'CONFIDENTIAL', filePath: path.join(root, 'private.txt'), storageMode: 'reference', secretFutureField: 'private' };
  fs.writeFileSync(resource.filePath, 'Attachment content');
  const sharedAt = '2026-09-29T12:00:00.000Z';
  const preview = shareMetadata(resource, { sharedAt });
  assert.equal(JSON.stringify(preview).includes('CONFIDENTIAL'), false);
  for (const key of ['personalNotes', 'filePath', 'id', 'storageMode', 'secretFutureField', 'attachment']) assert.equal(Object.hasOwn(preview, key), false);
  const exported = await workerTask('share', { root, resource, sharedAt });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(exported.folder, 'resource.json'), 'utf8')), preview);
  assert.deepEqual(fs.readdirSync(exported.folder), ['resource.json']);
  const options = { includeNotes: true, includeFile: true, sharedAt };
  const included = await workerTask('share', { root, resource, ...options });
  const metadata = JSON.parse(fs.readFileSync(path.join(included.folder, 'resource.json'), 'utf8'));
  assert.deepEqual(metadata, shareMetadata(resource, options));
  assert.equal(metadata.personalNotes, 'CONFIDENTIAL');
  assert.equal(fs.readFileSync(path.join(included.folder, metadata.attachment), 'utf8'), 'Attachment content');
  assert.equal(Object.hasOwn(shareMetadata(resource, { includeNotes: 'true' }), 'personalNotes'), false);
});

test('executables, script files, shortcuts and Windows path aliases never reach the OS opener', async t => {
  const root = fixture(t); let opens = 0;
  for (const name of ['file.EXE', 'file.pdf.lnk', 'script.ps1', 'file.url', 'file.hta', 'file.reg', 'file.chm', 'file.msix', 'file.cmd', 'file.exe ', 'file.pdf:payload.exe', 'NUL.pdf']) {
    await assert.rejects(openCheckedFile(path.join(root, name), { open: async () => { opens++; }, confirm: async () => true }), /blocked/);
  }
  for (const filename of ['\\\\server\\share\\file.pdf', '\\\\?\\C:\\file.exe', '//server/share/file.pdf', 'relative.pdf']) assert.throws(() => checkPath(filename), /blocked/);
  assert.equal(opens, 0);
});

test('renamed executables are blocked and unfamiliar documents require cancellable confirmation', async t => {
  const root = fixture(t); let opens = 0;
  const filename = path.join(root, 'document.pdf');
  for (const signature of ['MZ executable', '#!/bin/sh', '\x7fELF']) {
    fs.writeFileSync(filename, signature);
    await assert.rejects(openCheckedFile(filename, { open: async () => { opens++; }, confirm: async () => true }), /blocked/);
  }
  const macro = path.join(root, 'document.docm'); fs.writeFileSync(macro, 'not an executable header');
  assert.equal(inspectOpenFile(macro).needsConfirmation, true);
  const canceled = await openCheckedFile(macro, { open: async () => { opens++; }, confirm: async () => false });
  assert.equal(canceled.canceled, true); assert.equal(opens, 0);
  // Changing the file during confirmation must not bypass the signature check.
  await assert.rejects(openCheckedFile(macro, { open: async () => { opens++; }, confirm: async () => { fs.writeFileSync(macro, 'MZ changed'); return true; } }), /blocked/);
  fs.writeFileSync(filename, '%PDF-1.4 harmless test');
  assert.equal((await openCheckedFile(filename, { confirm: async () => { throw Error('Unexpected prompt'); }, open: async () => { opens++; return ''; } })).opened, true);
  assert.equal(opens, 1);
});

test('privileged IPC accepts only the correct window, exact app page and top-level frame', () => {
  const main = { id: 1, isDestroyed: () => false, mainFrame: { url: mainUrl } };
  const preview = { id: 2, isDestroyed: () => false, mainFrame: { url: previewUrl } };
  const previews = new Map([[2, {}]]);
  const event = sender => ({ sender, senderFrame: sender.mainFrame });
  assert.doesNotThrow(() => assertTrustedSender(event(main), 'resources:list', main, previews));
  assert.doesNotThrow(() => assertTrustedSender(event(preview), 'preview:data', main, previews));
  assert.throws(() => assertTrustedSender(event(preview), 'resources:delete', main, previews), /not allowed/);
  assert.throws(() => assertTrustedSender(event(main), 'preview:open-original', main, previews), /not allowed/);
  assert.throws(() => assertTrustedSender({ sender: main, senderFrame: { url: mainUrl } }, 'resources:list', main, previews), /not allowed/);
  assert.throws(() => assertTrustedSender({ sender: main, senderFrame: null }, 'resources:list', main, previews), /not allowed/);
  assert.throws(() => assertTrustedSender(event({ ...main }), 'resources:list', main, previews), /not allowed/);
  main.mainFrame.url = 'https://example.com';
  assert.throws(() => assertTrustedSender(event(main), 'resources:list', main, previews), /not allowed/);
  main.mainFrame.url = mainUrl + '?spoof=1';
  assert.throws(() => assertTrustedSender(event(main), 'resources:list', main, previews), /not allowed/);
  previews.clear();
  assert.throws(() => assertTrustedSender(event(preview), 'preview:data', main, previews), /not allowed/);
});

test('navigation, popups, webviews and device permission requests are denied', () => {
  const events = {}; let popup;
  protectWindow({ on: (name, fn) => { events[name] = fn; }, setWindowOpenHandler: fn => { popup = fn; } });
  assert.deepEqual(popup(), { action: 'deny' });
  for (const name of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
    let blocked = false; events[name]({ preventDefault: () => { blocked = true; } }); assert.equal(blocked, true);
  }
  const handlers = {};
  protectSession(Object.fromEntries(['setPermissionRequestHandler', 'setPermissionCheckHandler', 'setDevicePermissionHandler', 'setDisplayMediaRequestHandler'].map(name => [name, fn => { handlers[name] = fn; }])));
  handlers.setPermissionRequestHandler(null, 'media', allowed => assert.equal(allowed, false));
  assert.equal(handlers.setPermissionCheckHandler(), false);
  const contents = { isDestroyed: () => false, getURL: () => mainUrl };
  assert.equal(handlers.setPermissionCheckHandler(contents, 'clipboard-sanitized-write', 'null', { isMainFrame: true, requestingUrl: mainUrl }), true);
  assert.equal(handlers.setPermissionCheckHandler(contents, 'clipboard-sanitized-write', 'null', { isMainFrame: false, requestingUrl: mainUrl }), false);
  assert.equal(handlers.setPermissionCheckHandler(contents, 'clipboard-read', 'null', { isMainFrame: true, requestingUrl: mainUrl }), false);
  assert.equal(handlers.setDevicePermissionHandler(), false);
  handlers.setDisplayMediaRequestHandler({}, streams => assert.deepEqual(streams, {}));
});
