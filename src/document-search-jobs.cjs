const path = require('node:path');
const { Worker } = require('node:worker_threads');
class DocumentSearchJobs {
  constructor(notify = () => {}) { this.notify = notify; this.job = null; }
  run(resources, query, options) {
    if (this.job) throw new Error('A document search is already running.');
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'document-search-worker.cjs'), { workerData: { resources, query, options } });
      const job = this.job = { worker, cancelled: false, result: null, failed: false };
      const timer = setTimeout(() => { job.timedOut = true; void worker.terminate(); }, 10 * 60 * 1000);
      worker.on('message', message => {
        if (message.type === 'progress' && !job.cancelled) this.notify(message.value);
        else if (message.type === 'result') job.result = message.value;
        else if (message.type === 'error') job.failed = true;
      });
      worker.on('error', () => { job.failed = true; });
      worker.on('exit', code => {
        clearTimeout(timer);
        this.job = null;
        if (job.cancelled) resolve({ cancelled: true, results: [], warnings: [] });
        else if (job.timedOut) reject(new Error('Document search timed out. Select one resource or turn off OCR and try again.'));
        else if (job.failed || code !== 0 || !job.result) reject(new Error('Document search failed. Try a smaller library or another question.'));
        else resolve(job.result);
      });
    });
  }
  async cancel() {
    if (!this.job) return;
    this.job.cancelled = true;
    await this.job.worker.terminate();
  }
}
module.exports = { DocumentSearchJobs };
