const { parentPort, workerData } = require('node:worker_threads');
const { searchDocuments } = require('./document-search.cjs');
let lastProgress = 0;
searchDocuments(workerData.resources, workerData.query, { ...workerData.options, progress: value => {
  if (Date.now() - lastProgress > 120) { parentPort.postMessage({ type: 'progress', value }); lastProgress = Date.now(); }
} }).then(value => parentPort.postMessage({ type: 'result', value })).catch(() => parentPort.postMessage({ type: 'error' }));
