const { Worker } = require('node:worker_threads');
const path = require('node:path');
function searchEvidence(resources, question) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'evidence-worker.cjs'), { workerData: { resources, question } });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Document search timed out. Narrow your question or use smaller files.')), 90000);
    worker.on('message', result => finish(null, result));
    worker.on('error', () => finish(new Error('Document search failed. Try a smaller library or another question.')));
    worker.on('exit', () => { if (!settled) finish(new Error('Document search stopped. Please try again.')); });
    worker.unref();
  });
}
module.exports = { searchEvidence };
