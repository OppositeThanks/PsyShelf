// Used only by the Electron smoke test, never included in packaged builds.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('securityProbe', { invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args) });
