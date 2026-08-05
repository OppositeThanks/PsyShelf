const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('psyLibrary', {
  listResources: filters => ipcRenderer.invoke('resources:list', filters),
  addFiles: options => ipcRenderer.invoke('resources:add-files', options),
  addUrl: resource => ipcRenderer.invoke('resources:add-url', resource),
  updateResource: (id, patch) => ipcRenderer.invoke('resources:update', id, patch),
  deleteResource: id => ipcRenderer.invoke('resources:delete', id),
  openResource: id => ipcRenderer.invoke('resources:open', id),
  previewResource: id => ipcRenderer.invoke('resources:preview', id),
  shareResource: (id, includeFile) => ipcRenderer.invoke('resources:share', id, includeFile),
  analyzeResource: id => ipcRenderer.invoke('agent:analyze', id),
  reviewCorrection: (id, request) => ipcRenderer.invoke('agent:review-correction', id, request),
  overrideCorrection: correctionId => ipcRenderer.invoke('agent:override-correction', correctionId),
  chat: message => ipcRenderer.invoke('agent:chat', message),
  agentStatus: () => ipcRenderer.invoke('agent:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  chooseBackupFolder: () => ipcRenderer.invoke('settings:choose-backup'),
  syncBackup: () => ipcRenderer.invoke('settings:sync-backup'),
  openOfficialUrl: url => ipcRenderer.invoke('system:open-official-url', url)
});
