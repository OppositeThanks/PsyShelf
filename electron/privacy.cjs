const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { safeStorage, powerMonitor, BrowserWindow } = require('electron');
const { AppLock } = require('../src/app-lock.cjs');
const { encryptStorage } = require('./storage-encryption.cjs');
const { workerTask } = require('../src/file-jobs.cjs');
class Privacy {
  constructor(root) {
    this.root = root; this.file = path.join(root, 'privacy.json');
    this.config = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : {};
    this.lock = new AppLock(this.config.lock); this.busy = false; this.generation = 0; this.lastUnlock = Date.now();
  }
  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.config), { mode: 0o600, flush: true });
    fs.renameSync(tmp, this.file);
  }
  encryption() {
    if (!this.config.backup) return null;
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows key protection is unavailable. Encrypted backups are paused.');
    return { salt: this.config.backup.salt, key: safeStorage.decryptString(Buffer.from(this.config.backup.protectedKey, 'base64')) };
  }
  status() { return { locked: this.lock.locked, lockEnabled: Boolean(this.config.lock), autoLockMinutes: this.config.lock?.minutes || 0, storageEncrypted: this.config.storageEncrypted === true, backupEncrypted: Boolean(this.config.backup) }; }
  async initialize() { if (this.config.storageEncrypted) await encryptStorage(this.root); }
  bind({ handle, mainWindow, isBusy, pause, resume, lockPage, mainPage, language, cancelWork }) {
    const lockNow = async () => {
      if (!this.config.lock || this.lock.locked) return;
      this.lock.locked = true; this.generation++;
      for (const win of BrowserWindow.getAllWindows()) if (win !== mainWindow()) win.destroy();
      await mainWindow()?.loadFile(lockPage).catch(error => { if (error.code !== 'ERR_ABORTED') throw error; });
      void cancelWork();
    };
    powerMonitor.on('lock-screen', () => { void lockNow().catch(() => {}); });
    powerMonitor.on('suspend', () => { void lockNow(); });
    const timer = setInterval(() => {
      if (this.config.lock?.minutes && Math.min(powerMonitor.getSystemIdleTime(), (Date.now() - this.lastUnlock) / 1000) >= this.config.lock.minutes * 60) void lockNow();
    }, 1000); timer.unref();
    handle('security:status', () => ({ ...this.status(), language: language() }));
    handle('security:unlock', async (_e, password) => {
      if (!this.lock.locked || !this.config.lock) return;
      await this.lock.verify(password);
      this.lastUnlock = Date.now();
      await mainWindow().loadFile(mainPage);
    });
    handle('security:lock', lockNow);
    handle('security:configure-lock', async (_e, password, minutes) => {
      if (this.busy) throw new Error('Wait for the current security operation to finish.');
      this.busy = true;
      try { this.config.lock = await this.lock.configure(password, minutes); this.lastUnlock = Date.now(); this.save(); return this.status(); }
      finally { this.busy = false; }
    });
    handle('security:disable-lock', async (_e, password) => {
      if (!this.config.lock) return;
      await this.lock.verify(password, { unlock: false }); this.lock.assertAllowed('security:disable-lock'); delete this.config.lock; this.save(); this.lock.record = null;
      return this.status();
    });
    handle('security:encrypt-backups', async (_e, password) => {
      if (this.busy || isBusy()) throw new Error('Wait for the current security operation to finish.');
      if (this.config.backup) throw new Error('Backup encryption is already configured.');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows key protection is unavailable. Encrypted backups are paused.');
      this.busy = true;
      try {
        const salt = crypto.randomBytes(16).toString('hex');
        const key = await workerTask('derive-backup-key', { password, salt });
        this.config.backup = { salt, protectedKey: safeStorage.encryptString(key).toString('base64') };
        this.save(); return this.status();
      } finally { this.busy = false; }
    });
    handle('security:encrypt-storage', async () => {
      if (this.busy || isBusy()) throw new Error('Wait for the current security operation to finish.');
      this.busy = true;
      try { await pause(); await encryptStorage(this.root); this.config.storageEncrypted = true; this.save(); return this.status(); }
      finally { await resume(); this.busy = false; }
    });
  }
}
module.exports = { Privacy };
