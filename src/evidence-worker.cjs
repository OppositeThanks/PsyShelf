const { parentPort, workerData } = require('node:worker_threads');
const { retrieve } = require('./source-evidence.cjs');
retrieve(workerData.resources, workerData.question).then(result => parentPort.postMessage(result)).catch(() => parentPort.postMessage({ sources: [], warnings: [{ title: '', message: 'Document search failed. Try a smaller library or another question.' }] }));
