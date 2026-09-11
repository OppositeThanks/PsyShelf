(() => {
  const api = window.psyLibrary;
  if (!api?.updateStatus) return;
  const byId = id => document.getElementById(id);
  function render(state) {
    const busy = ['checking', 'downloading'].includes(state.status);
    const messages = {
      idle: 'Updates have not been checked yet.',
      checking: 'Checking GitHub for updates…',
      'up-to-date': 'You have the latest version.',
      available: 'A new version is available.',
      downloading: 'Downloading and verifying the installer…',
      downloaded: 'Download verified. Open Downloads and run the installer when you are ready. You can delete it after installation.',
      unsupported: 'In-app downloads are available in the Windows x64 app.'
    };
    byId('updateStatus').textContent = state.status === 'error' ? state.error : messages[state.status];
    byId('updateVersion').textContent = state.version ? 'PsyShelf ' + state.version : '';
    byId('checkUpdates').disabled = busy || !state.supported;
    byId('downloadUpdate').hidden = !state.version || state.downloadedVersion === state.version;
    byId('downloadUpdate').disabled = busy || !state.supported;
    byId('cancelUpdate').hidden = state.status !== 'downloading';
    byId('showUpdateDownload').hidden = !state.downloadedVersion;
    byId('updateProgress').hidden = state.status !== 'downloading';
    byId('updateProgress').value = state.total ? Math.min(100, state.received / state.total * 100) : 0;
    byId('updateDownloadSize').textContent = state.status === 'downloading' ? (state.received / 1048576).toFixed(1) + ' / ' + (state.total / 1048576).toFixed(1) + ' MiB' : '';
    byId('updateNotice').hidden = !state.version && !state.downloadedVersion;
    byId('updateNotice').firstElementChild.textContent = state.status === 'downloaded' ? 'Update downloaded' : 'Update available';
    if (typeof state.automatic === 'boolean') byId('automaticUpdates').checked = state.automatic;
  }
  async function action(callback) {
    try { const state = await callback(); if (state?.status) render(state); }
    catch { byId('updateStatus').textContent = 'Update failed. Check your connection and available disk space, then try again.'; }
  }
  byId('checkUpdates').addEventListener('click', () => action(() => api.checkForUpdates()));
  byId('downloadUpdate').addEventListener('click', () => action(() => api.downloadUpdate()));
  byId('cancelUpdate').addEventListener('click', () => action(() => api.cancelUpdate()));
  byId('showUpdateDownload').addEventListener('click', async () => {
    try { await api.showUpdateDownload(); }
    catch { byId('updateStatus').textContent = 'The downloaded installer was moved or removed. Download it again.'; }
  });
  byId('automaticUpdates').addEventListener('change', async event => {
    const enabled = event.target.checked;
    try { await api.setAutomaticUpdates(enabled); }
    catch { event.target.checked = !enabled; byId('updateStatus').textContent = 'Could not save the update preference. Please try again.'; }
  });
  byId('updateNotice').addEventListener('click', () => {
    byId('settingsButton').click();
    byId('updatesSection').scrollIntoView({ block: 'start' });
  });
  api.onUpdateStatus(render);
  void action(() => api.updateStatus());
})();
