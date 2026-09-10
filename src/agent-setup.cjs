const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

// Download sizes: https://ollama.com/library/qwen3 (September 2026).
// RAM/free-memory thresholds are conservative PsyShelf estimates, not benchmarks.
const MODELS = [
  { model: 'qwen3:0.6b', downloadGB: 0.523, ramGB: 4, freeGB: 2, threads: 2 },
  { model: 'qwen3:1.7b', downloadGB: 1.4, ramGB: 8, freeGB: 3, threads: 2 },
  { model: 'qwen3:4b', downloadGB: 2.5, ramGB: 16, freeGB: 6, threads: 4 },
  { model: 'qwen3:8b', downloadGB: 5.2, ramGB: 32, freeGB: 10, threads: 8 }
];

function recommendModel(specs) {
  const eligible = MODELS.filter(m => specs.totalGB >= m.ramGB && specs.freeGB >= m.freeGB && specs.threads >= m.threads);
  const candidate = eligible.at(-1);
  if (!candidate) return { model: null, reason: 'Available memory or CPU capacity is limited. Close other apps and scan again, or continue using the library without AI.' };
  const fitting = eligible.filter(m => specs.diskGB === null || specs.diskGB >= m.downloadGB * 2 + 4);
  const choice = fitting.at(-1);
  if (!choice) return { model: null, reason: 'There is not enough free space on the estimated model drive. Free up space or change Ollama’s model location, then scan again.' };
  return { ...choice, reason: 'Selected using total RAM, memory available now, logical CPU count, and estimated disk space. Smaller models use fewer resources but give less reliable answers. This is an estimate; speed depends on your hardware and workload.' };
}

async function detectHardware() {
  const cpus = os.cpus();
  const modelPath = process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models');
  let diskGB = null;
  try {
    let existing = path.resolve(modelPath);
    while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
    const disk = await fs.promises.statfs(existing);
    diskGB = disk.bavail * disk.bsize / 1e9;
  } catch { /* Unknown disk space must not prevent the setup from opening. */ }
  return {
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus[0]?.model || 'Unknown processor', threads: cpus.length,
    totalGB: os.totalmem() / 2 ** 30, freeGB: os.freemem() / 2 ** 30,
    diskGB, modelPath
  };
}

module.exports = { MODELS, recommendModel, detectHardware };
