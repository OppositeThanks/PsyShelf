const { Worker } = require('node:worker_threads');
const path = require('node:path');
const crypto = require('node:crypto');

function cancelled() { const error = new Error('Operation cancelled.'); error.name = 'AbortError'; return error; }

function workerTask(type, payload, { signal = new SharedArrayBuffer(4), progress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'file-worker.cjs'), { workerData: { type, payload, signal } });
    let response;
    let failure;
    worker.on('message', message => {
      if (message.type === 'progress') progress(message.value);
      else if (message.type === 'result') response = message;
      else if (message.type === 'error') failure = Object.assign(new Error(message.message), { name: message.name });
    });
    worker.on('error', error => { failure = error; });
    // Resolve only after exit: the SQLite connection and file handles must be closed before a restore.
    worker.on('exit', code => {
      if (failure) reject(failure);
      else if (code !== 0 || !response) reject(new Error('The background file operation stopped unexpectedly.'));
      else resolve(response.value);
    });
  });
}

class FileJobs {
  constructor(notify = () => {}, idle = () => {}) {
    this.notify = notify;
    this.idle = idle;
    this.active = null;
    this.status = null;
    this.sequence = 0;
  }
  get busy() { return Boolean(this.active); }
  cancel(id) {
    const job = this.active;
    if (!job || job.id !== id || !job.cancellable) return false;
    if (Atomics.compareExchange(job.flag, 0, 0, 1) !== 0) return false;
    this.publish({ phase: 'Cancelling…', cancellable: false });
    return true;
  }
  publish(patch) {
    this.status = { ...this.status, ...patch, sequence: ++this.sequence };
    this.notify(this.status);
  }
  async run(label, callback) {
    if (this.active) throw new Error('Another file operation is running. Wait for it or cancel it first.');
    const signal = new SharedArrayBuffer(4);
    const job = { id: crypto.randomUUID(), flag: new Int32Array(signal), cancellable: true };
    this.active = job;
    this.status = { id: job.id, label, state: 'running', phase: 'Preparing…', cancellable: true, sequence: ++this.sequence };
    this.notify(this.status);
    const check = () => { if (Atomics.load(job.flag, 0) === 1) throw cancelled(); };
    const api = {
      check,
      phase: phase => this.publish({ phase, copiedBytes: undefined, totalBytes: undefined, fileName: undefined, fileIndex: undefined, totalFiles: undefined }),
      commit: () => {
        if (Atomics.compareExchange(job.flag, 0, 0, 2) === 1) throw cancelled();
        job.cancellable = false; this.publish({ phase: 'Finishing…', cancellable: false });
      },
      task: (type, payload) => {
        check();
        return workerTask(type, payload, { signal, progress: value => {
          if (Atomics.load(job.flag, 0) !== 1) {
            if (value.cancellable === false) job.cancellable = false;
            this.publish(value);
          }
        } });
      },
      cleanup: (type, payload) => workerTask(type, payload)
    };
    let finish;
    job.settled = new Promise(resolve => { finish = resolve; });
    try {
      const result = await callback(api);
      this.publish({ state: result?.canceled ? 'cancelled' : 'completed', phase: result?.canceled ? 'Cancelled' : 'Completed', cancellable: false });
      return result;
    } catch (error) {
      this.publish({ state: error.name === 'AbortError' ? 'cancelled' : 'failed',
        phase: error.name === 'AbortError' ? 'Cancelled' : error.message, cancellable: false });
      throw error;
    } finally {
      this.active = null;
      finish();
      this.idle();
    }
  }
  async stop() {
    if (!this.active) return;
    this.cancel(this.active.id);
    await this.active.settled;
  }
}

module.exports = { FileJobs, workerTask };
