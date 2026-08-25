const MODEL_TIERS = Object.freeze([
  { model: 'qwen3:0.6b', label: 'Qwen3 0.6B', packageSizeGb: 0.523, minimumMemoryGb: 0, minimumCpuCapacity: 1 },
  { model: 'qwen3:1.7b', label: 'Qwen3 1.7B', packageSizeGb: 1.4, minimumMemoryGb: 8, minimumCpuCapacity: 4 },
  { model: 'qwen3:4b', label: 'Qwen3 4B', packageSizeGb: 2.5, minimumMemoryGb: 16, minimumCpuCapacity: 4 },
  { model: 'qwen3:8b', label: 'Qwen3 8B', packageSizeGb: 5.2, minimumMemoryGb: 32, minimumCpuCapacity: 8 },
  { model: 'qwen3:14b', label: 'Qwen3 14B', packageSizeGb: 9.3, minimumMemoryGb: 64, minimumCpuCapacity: 12 },
  { model: 'qwen3:30b', label: 'Qwen3 30B', packageSizeGb: 19, minimumMemoryGb: 128, minimumCpuCapacity: 16 }
]);

/** Converts a byte count into rounded gibibytes. */
function bytesToGiB(bytes) {
  const value = Number(bytes);
  return Number.isFinite(value) && value > 0 ? Math.round((value / (1024 ** 3)) * 10) / 10 : 0;
}

/** Extracts a readable active graphics-adapter name from Electron GPU data. */
function selectGpuName(gpuInfo = {}) {
  const devices = Array.isArray(gpuInfo.gpuDevice) ? gpuInfo.gpuDevice : [];
  const active = devices.find(device => device?.active) || devices[0];
  const deviceName = String(active?.deviceString || '').trim();
  if (deviceName) return deviceName;
  return String(gpuInfo.auxAttributes?.glRenderer || '').trim() || 'Graphics adapter not reported';
}

/** Selects a conservative local model that balances quality with usable speed. */
function recommendModel(profile, analyzedAt = new Date().toISOString()) {
  const memoryGb = Math.max(0, Number(profile?.totalMemoryGb) || 0);
  const capacityMemoryGb = Math.max(memoryGb, Math.round(memoryGb));
  const cpuCapacity = Math.max(1, Number(profile?.availableParallelism || profile?.logicalCores) || 1);
  const supported = MODEL_TIERS.filter(tier => capacityMemoryGb >= tier.minimumMemoryGb && cpuCapacity >= tier.minimumCpuCapacity);
  const tierIndex = Math.max(0, supported.length - 1);
  const tier = MODEL_TIERS[tierIndex];
  const smaller = MODEL_TIERS[tierIndex - 1] || null;
  const larger = MODEL_TIERS[tierIndex + 1] || null;
  const reason = `${memoryGb || 'Unknown'} GB RAM and ${cpuCapacity} usable CPU thread${cpuCapacity === 1 ? '' : 's'} make ${tier.label} the best balanced choice for this computer. The recommendation leaves memory for Windows and PsyShelf.`;
  return {
    model: tier.model,
    label: tier.label,
    packageSizeGb: tier.packageSizeGb,
    reason,
    analyzedAt,
    profile: {
      platform: String(profile?.platform || 'Unknown'),
      architecture: String(profile?.architecture || 'Unknown'),
      totalMemoryGb: memoryGb,
      logicalCores: Math.max(1, Number(profile?.logicalCores) || cpuCapacity),
      availableParallelism: cpuCapacity,
      cpuModel: String(profile?.cpuModel || 'Processor not reported'),
      gpuName: String(profile?.gpuName || 'Graphics adapter not reported')
    },
    alternatives: {
      smaller: smaller ? { model: smaller.model, label: smaller.label } : null,
      larger: larger ? { model: larger.model, label: larger.label } : null
    }
  };
}

module.exports = { MODEL_TIERS, bytesToGiB, recommendModel, selectGpuName };
