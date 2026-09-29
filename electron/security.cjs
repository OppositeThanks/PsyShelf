const path = require('node:path');
const { pathToFileURL } = require('node:url');
const mainUrl = pathToFileURL(path.join(__dirname, '..', 'renderer', 'index.html')).href;
const previewUrl = pathToFileURL(path.join(__dirname, '..', 'renderer', 'preview.html')).href;

function assertTrustedSender(event, channel, mainContents, previews) {
  const sender = event?.sender;
  const frame = event?.senderFrame;
  const isPreview = ['preview:data', 'preview:open-original', 'preview:reading', 'preview:save-reading', 'preview:pdf-bytes'].includes(channel);
  if (!sender || sender.isDestroyed() || !frame || frame !== sender.mainFrame ||
      frame.url !== (isPreview ? previewUrl : mainUrl) ||
      (isPreview ? !previews.has(sender.id) : sender !== mainContents)) {
    throw new Error('This window is not allowed to perform that action.');
  }
}

function protectWindow(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', event => event.preventDefault());
  contents.on('will-redirect', event => event.preventDefault());
  contents.on('will-attach-webview', event => event.preventDefault());
}

function protectSession(session) {
  const allowClipboardWrite = (contents, permission, details) => permission === 'clipboard-sanitized-write' &&
    contents && !contents.isDestroyed() && contents.getURL() === mainUrl &&
    details?.isMainFrame === true && details.requestingUrl === mainUrl;
  session.setPermissionRequestHandler((contents, permission, callback, details) => callback(Boolean(allowClipboardWrite(contents, permission, details))));
  session.setPermissionCheckHandler((contents, permission, _origin, details) => Boolean(allowClipboardWrite(contents, permission, details)));
  session.setDevicePermissionHandler(() => false);
  session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
}

module.exports = { assertTrustedSender, protectWindow, protectSession, mainUrl, previewUrl };
