const { contextBridge, ipcRenderer } = require('electron');

/** Creates a sandbox-safe renderer function for one IPC channel. */
function invoke(channel) {
  return (...args) => ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('psyLibrary', {
  listResources: invoke('resources:list'),
  addFiles: invoke('resources:add-files'),
  addUrl: invoke('resources:add-url'),
  deleteResource: invoke('resources:delete'),
  openResource: invoke('resources:open'),
  previewResource: invoke('resources:preview'),
  shareResource: invoke('resources:share'),
  analyzeResource: invoke('agent:analyze'),
  reviewCorrection: invoke('agent:review-correction'),
  overrideCorrection: invoke('agent:override-correction'),
  chat: invoke('agent:chat'),
  getSettings: invoke('settings:get'),
  updateSettings: invoke('settings:update'),
  chooseBackupFolder: invoke('settings:choose-backup'),
  syncBackup: invoke('settings:sync-backup'),
  openOfficialUrl: invoke('system:open-official-url')
});
