const fs = require('node:fs');
const path = require('node:path');

const blocked = new Set(('.exe .com .scr .pif .cpl .dll .sys .drv .ocx .msi .msp .mst .msix .msixbundle .appx .appxbundle .appinstaller .application .appref-ms ' +
  '.bat .cmd .ps1 .ps1xml .ps2 .ps2xml .psc1 .psc2 .psm1 .psd1 .vbs .vbe .vb .js .jse .wsf .wsh .wsc .hta .sct .sh .bash .py .pyw .pl .rb .jar ' +
  '.lnk .url .website .scf .search-ms .searchconnector-ms .settingcontent-ms .reg .inf .ins .isp .chm .hlp .gadget .diagcab .desktop .command .workflow').split(/\s+/));
const ordinary = new Set(('.pdf .txt .md .csv .json .xml .png .jpg .jpeg .gif .webp .bmp .tif .tiff ' +
  '.mp3 .wav .ogg .m4a .flac .aac .wma .mp4 .webm .mov .avi .mkv .wmv .docx .xlsx .pptx .epub').split(/\s+/));
const blockedMessage = 'Opening executable files, scripts, shortcuts, or unsafe paths is blocked in PsyShelf.';

function checkPath(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename) || /^[\\/]{2}/.test(filename) || /[\x00-\x1f\u202a-\u202e\u2066-\u2069]/.test(filename)) throw new Error(blockedMessage);
  // Deny device namespaces, alternate data streams and Windows filename aliases.
  const tail = /^[a-z]:[\\/]/i.test(filename) ? filename.slice(2) : filename;
  if (tail.includes(':') || tail.split(/[\\/]/).some(part => part && (/[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))) throw new Error(blockedMessage);
  if (blocked.has(path.extname(filename).toLowerCase())) throw new Error(blockedMessage);
}

function inspectOpenFile(filename) {
  checkPath(filename);
  if (!fs.existsSync(filename)) throw new Error('File not found.');
  // Native resolution includes Windows package/app-data redirection. External
  // viewers do not necessarily share our process's virtualized filesystem.
  const resolved = fs.realpathSync.native(filename);
  checkPath(resolved);
  const handle = fs.openSync(resolved, 'r');
  try {
    if (!fs.fstatSync(handle).isFile()) throw new Error(blockedMessage);
    const header = Buffer.alloc(4);
    fs.readSync(handle, header, 0, header.length, 0);
    // Detect common executable/script files even if renamed to a document extension.
    if (header.subarray(0, 2).equals(Buffer.from('MZ')) || header.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || header.subarray(0, 2).equals(Buffer.from('#!'))) throw new Error(blockedMessage);
  } finally { fs.closeSync(handle); }
  return { path: resolved, needsConfirmation: !ordinary.has(path.extname(filename).toLowerCase()) || !ordinary.has(path.extname(resolved).toLowerCase()) };
}

async function openCheckedFile(filename, { confirm, open }) {
  const inspected = inspectOpenFile(filename);
  if (inspected.needsConfirmation && !(await confirm(inspected.path))) return { opened: false, canceled: true };
  // Recheck after a potentially long-running confirmation dialog.
  const checked = inspectOpenFile(filename);
  if (checked.path !== inspected.path) throw new Error('The file changed. Try opening it again.');
  const error = await open(checked.path);
  if (error) throw new Error(error);
  return { opened: true };
}

module.exports = { checkPath, inspectOpenFile, openCheckedFile, blockedMessage };
