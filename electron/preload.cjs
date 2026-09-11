const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('psyLibrary', {
  updateStatus: () => ipcRenderer.invoke('updates:status'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  cancelUpdate: () => ipcRenderer.invoke('updates:cancel'),
  setAutomaticUpdates: enabled => ipcRenderer.invoke('updates:automatic', enabled),
  showUpdateDownload: () => ipcRenderer.invoke('updates:show-download'),
  onUpdateStatus: callback => ipcRenderer.on('updates:status', (_event, status) => callback(status)),
  onLanguageChange: callback => ipcRenderer.on('interface-language', (_event, language) => callback(language)),
  scanHardware: () => ipcRenderer.invoke('setup:scan'),
  dismissSetup: () => ipcRenderer.invoke('setup:dismiss'),
  useSetupModel: model => ipcRenderer.invoke('setup:use-model', model),
  listResources: filters => ipcRenderer.invoke('resources:list', filters),
  addFiles: options => ipcRenderer.invoke('resources:add-files', options),
  addUrl: resource => ipcRenderer.invoke('resources:add-url', resource),
  updateResource: (id, patch) => ipcRenderer.invoke('resources:update', id, patch),
  deleteResource: id => ipcRenderer.invoke('resources:delete', id),
  openResource: id => ipcRenderer.invoke('resources:open', id),
  previewResource: id => ipcRenderer.invoke('resources:preview', id),
  openPreview: (id, page = null) => ipcRenderer.invoke('resources:open-preview', id, page),
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
  backupStatus: () => ipcRenderer.invoke('settings:backup-status'),
  fileOperationStatus: () => ipcRenderer.invoke('files:status'),
  uninstall: () => ipcRenderer.invoke('system:uninstall'),
  cancelFileOperation: id => ipcRenderer.invoke('files:cancel', id),
  onFileOperation: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('files:progress', listener);
    return () => ipcRenderer.removeListener('files:progress', listener);
  },
  restoreBackup: folder => ipcRenderer.invoke('settings:restore-backup', folder),
  openOfficialUrl: url => ipcRenderer.invoke('system:open-official-url', url)
});
