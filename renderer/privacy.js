(() => {
  const api = window.psyLibrary;
  const get = id => document.getElementById(id);
  const message = error => String(error?.message || error).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  async function refresh() {
    const status = await api.securityStatus();
    get('privacyStorageStatus').textContent = status.storageEncrypted ? 'Windows encryption enabled' : 'Windows encryption not enabled';
    get('privacyBackupStatus').textContent = status.backupEncrypted ? 'New backups are encrypted' : 'New backups are not encrypted';
    get('privacyLockStatus').textContent = status.lockEnabled ? 'App lock enabled' : 'App lock not enabled';
    get('enableStorageEncryption').disabled = status.storageEncrypted;
    get('enableBackupEncryption').disabled = status.backupEncrypted;
    get('enableAppLock').disabled = status.lockEnabled;
    get('disableAppLock').hidden = !status.lockEnabled;
    get('lockApp').hidden = !status.lockEnabled;
  }
  async function action(callback) {
    get('privacyError').textContent = '';
    const buttons = [...get('privacySection').querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
    try { await callback(); get('privacyError').textContent = 'Security settings saved.'; }
    catch (error) { get('privacyError').textContent = message(error); }
    finally { get('privacyPassword').value = ''; get('privacyConfirm').value = ''; buttons.forEach(b => b.disabled = false); await refresh(); }
  }
  function password() {
    const value = get('privacyPassword').value;
    if (value !== get('privacyConfirm').value) throw new Error('Passwords do not match.');
    return value;
  }
  get('enableStorageEncryption').onclick = () => action(() => {
    if (!get('efsAcknowledgement').checked) throw new Error('Confirm that you understand Windows encryption recovery first.');
    return api.encryptStorage();
  });
  get('enableBackupEncryption').onclick = () => action(() => {
    if (!get('backupAcknowledgement').checked) throw new Error('Save your backup password before enabling encryption.');
    return api.encryptBackups(password());
  });
  get('enableAppLock').onclick = () => action(() => api.configureLock(password(), Number(get('autoLockMinutes').value)));
  get('disableAppLock').onclick = () => action(() => api.disableLock(get('privacyPassword').value));
  get('lockApp').onclick = () => api.lock().catch(error => { get('privacyError').textContent = message(error); });
  refresh().catch(error => { get('privacyError').textContent = message(error); });
})();
