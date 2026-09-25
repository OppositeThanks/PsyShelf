const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('psyPreview', {
  reading: () => ipcRenderer.invoke('preview:reading'),
  saveReading: patch => ipcRenderer.invoke('preview:save-reading', patch),
  pdfBytes: () => ipcRenderer.invoke('preview:pdf-bytes'),
  onLanguageChange: callback => ipcRenderer.on('interface-language', (_event, language) => callback(language)),
  getData: () => ipcRenderer.invoke('preview:data'),
  openOriginal: () => ipcRenderer.invoke('preview:open-original')
});
