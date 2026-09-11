const fs = require('node:fs/promises');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');

const API = 'https://api.github.com/repos/OppositeThanks/PsyShelf/releases/latest';
const ROOT = 'https://github.com/OppositeThanks/PsyShelf/releases/download/';
const MAX_INSTALLER = 1024 * 1024 * 1024;
function versionParts(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return null;
  const parts = version.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function isNewer(candidate, current) {
  const a = versionParts(candidate), b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function releaseInstaller(release) {
  const version = String(release?.tag_name || '').replace(/^v/, '');
  if (!versionParts(version) || release.draft || release.prerelease || !Array.isArray(release.assets)) throw new Error('No compatible update installer is available yet.');
  const name = `PsyShelf-Setup-${version}-Windows.exe`;
  const installer = release.assets.find(asset => asset.name === name);
  const checksum = release.assets.find(asset => asset.name === name + '.sha256');
  const prefix = `${ROOT}v${version}/`;
  if (!installer || !checksum || installer.browser_download_url !== prefix + name || checksum.browser_download_url !== prefix + name + '.sha256' || !Number.isSafeInteger(installer.size) || installer.size <= 0 || installer.size > MAX_INSTALLER) throw new Error('No compatible update installer is available yet.');
  return { version, name, size: installer.size, url: installer.browser_download_url, checksumUrl: checksum.browser_download_url };
}
async function boundedText(response, limit) {
  const chunks = []; let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > limit) throw new Error('The update server returned invalid information.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

class AppUpdates {
  constructor({ currentVersion, downloads, fetchImpl = (...args) => fetch(...args), notify = () => {}, supported = process.platform === 'win32' && process.arch === 'x64' }) {
    this.currentVersion = currentVersion; this.downloads = downloads; this.fetch = fetchImpl; this.notify = notify; this.supported = supported;
    this.state = { status: supported ? 'idle' : 'unsupported', version: null, received: 0, total: 0, checkedAt: null, error: '', downloadedVersion: null };
    this.release = null; this.downloaded = null; this.controller = null;
  }
  snapshot() { return { ...this.state, supported: this.supported }; }
  publish(patch) { Object.assign(this.state, patch); this.notify(this.snapshot()); return this.snapshot(); }
  cancel() { this.controller?.abort(); }
  async stop() { this.cancel(); await this.done; }
  async request(url, signal) {
    const response = await this.fetch(url, { signal, headers: { 'User-Agent': 'PsyShelf', Accept: url === API ? 'application/vnd.github+json' : 'application/octet-stream' } });
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) throw new Error('GitHub is limiting update checks. Try again later.');
      if (response.status === 404) throw new Error('No compatible update installer is available yet.');
      throw new Error('Could not contact GitHub. Check your connection and try again.');
    }
    // GitHub release files redirect to its asset CDN. Do not accept a different destination.
    if (response.url) {
      const target = new URL(response.url);
      if (target.protocol !== 'https:' || !['api.github.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(target.hostname)) throw new Error('The update server returned invalid information.');
    }
    return response;
  }
  async check() {
    if (!this.supported || this.controller) return this.snapshot();
    const controller = this.controller = new AbortController();
    this.done = new Promise(resolve => { this.finish = resolve; });
    this.publish({ status: 'checking', error: '' });
    try {
      const response = await this.request(API, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      const raw = JSON.parse(await boundedText(response, 1024 * 1024));
      const version = String(raw.tag_name || '').replace(/^v/, '');
      if (!versionParts(version) || raw.draft || raw.prerelease) throw new Error('The update server returned invalid information.');
      if (!isNewer(version, this.currentVersion)) {
        this.release = null;
        return this.publish({ status: 'up-to-date', version: null, checkedAt: Date.now() });
      }
      this.release = releaseInstaller(raw);
      return this.publish({ status: this.downloaded?.version === version ? 'downloaded' : 'available', version, checkedAt: Date.now(), total: this.release.size });
    } catch (error) { return this.failed(error, controller); }
    finally { this.controller = null; this.finish?.(); }
  }
  failed(error, controller) {
    const known = ['No compatible update installer is available yet.', 'The update server returned invalid information.', 'GitHub is limiting update checks. Try again later.', 'Could not contact GitHub. Check your connection and try again.', 'The installer checksum did not match. The download was removed.', 'The installer download was incomplete. Please try again.'];
    const message = controller.signal.aborted ? 'Update request cancelled.' : known.includes(error.message) ? error.message : 'Update failed. Check your connection and available disk space, then try again.';
    return this.publish({ status: 'error', error: message });
  }
  async download() {
    if (!this.supported || this.controller || !this.release) return this.snapshot();
    const release = { ...this.release };
    const controller = this.controller = new AbortController();
    this.done = new Promise(resolve => { this.finish = resolve; });
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30 * 60 * 1000)]);
    let temporary, handle;
    this.publish({ status: 'downloading', error: '', received: 0, total: release.size });
    try {
      const checksumResponse = await this.request(release.checksumUrl, signal);
      const checksum = (await boundedText(checksumResponse, 2048)).trim();
      const match = checksum.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
      if (!match || match[2] !== release.name) throw new Error('The update server returned invalid information.');
      await fs.mkdir(this.downloads, { recursive: true });
      // Unique names preserve all existing downloads. Only the current partial file is removed on failure.
      const destination = path.join(this.downloads, release.name.replace('.exe', `-${randomUUID().slice(0, 8)}.exe`));
      temporary = destination + '.part';
      handle = await fs.open(temporary, 'wx');
      const response = await this.request(release.url, signal);
      const hash = createHash('sha256'); let received = 0; let lastProgress = 0;
      for await (const chunk of response.body) {
        signal.throwIfAborted();
        received += chunk.length;
        if (received > release.size) throw new Error('The installer download was incomplete. Please try again.');
        hash.update(chunk);
        let offset = 0;
        while (offset < chunk.length) {
          const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
          if (!bytesWritten) throw new Error('Download write failed.');
          offset += bytesWritten;
        }
        if (Date.now() - lastProgress > 150) { this.publish({ received }); lastProgress = Date.now(); }
      }
      if (received !== release.size) throw new Error('The installer download was incomplete. Please try again.');
      if (hash.digest('hex') !== match[1].toLowerCase()) throw new Error('The installer checksum did not match. The download was removed.');
      await handle.close(); handle = null;
      signal.throwIfAborted();
      await fs.rename(temporary, destination); temporary = null;
      this.downloaded = { file: destination, version: release.version };
      return this.publish({ status: 'downloaded', received, downloadedVersion: release.version });
    } catch (error) { return this.failed(error, controller); }
    finally {
      if (handle) await handle.close().catch(() => {});
      if (temporary) await fs.unlink(temporary).catch(() => {});
      this.controller = null;
      this.finish?.();
    }
  }
  async downloadedFile() {
    if (!this.downloaded) return null;
    try { await fs.access(this.downloaded.file); return this.downloaded.file; }
    catch { this.downloaded = null; this.publish({ downloadedVersion: null, status: this.release ? 'available' : 'idle' }); return null; }
  }
}
module.exports = { AppUpdates, isNewer, releaseInstaller, API };
