const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('psyPreview', {
  onLanguageChange: callback => ipcRenderer.on('interface-language', (_event, language) => callback(language)),
  getData: () => ipcRenderer.invoke('preview:data'),
  openOriginal: () => ipcRenderer.invoke('preview:open-original')
});
