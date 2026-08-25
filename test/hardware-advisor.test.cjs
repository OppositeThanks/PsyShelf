const test = require('node:test');
const assert = require('node:assert/strict');

const { bytesToGiB, recommendModel, selectGpuName } = require('../src/hardware-advisor.cjs');

test('converts memory bytes into readable GiB values', () => {
  assert.equal(bytesToGiB(16 * (1024 ** 3)), 16);
  assert.equal(bytesToGiB(undefined), 0);
});

test('recommends progressively larger models only with sufficient memory and CPU', () => {
  const analyzedAt = '2026-08-25T12:00:00.000Z';
  assert.equal(recommendModel({ totalMemoryGb: 4, availableParallelism: 2 }, analyzedAt).model, 'qwen3:0.6b');
  assert.equal(recommendModel({ totalMemoryGb: 8, availableParallelism: 4 }, analyzedAt).model, 'qwen3:1.7b');
  assert.equal(recommendModel({ totalMemoryGb: 16, availableParallelism: 8 }, analyzedAt).model, 'qwen3:4b');
  assert.equal(recommendModel({ totalMemoryGb: 32, availableParallelism: 8 }, analyzedAt).model, 'qwen3:8b');
  assert.equal(recommendModel({ totalMemoryGb: 64, availableParallelism: 12 }, analyzedAt).model, 'qwen3:14b');
  assert.equal(recommendModel({ totalMemoryGb: 128, availableParallelism: 16 }, analyzedAt).model, 'qwen3:30b');
});

test('recognizes nominal memory when Windows reserves a small fraction', () => {
  const result = recommendModel({ totalMemoryGb: 15.9, availableParallelism: 4 }, '2026-08-25T12:00:00.000Z');
  assert.equal(result.model, 'qwen3:4b');
  assert.equal(result.profile.totalMemoryGb, 15.9);
});

test('keeps a smaller model when CPU capacity would make a larger one impractical', () => {
  const result = recommendModel({ totalMemoryGb: 64, availableParallelism: 6, logicalCores: 8 }, '2026-08-25T12:00:00.000Z');
  assert.equal(result.model, 'qwen3:4b');
  assert.equal(result.profile.logicalCores, 8);
});

test('selects the active graphics adapter without making performance claims from it', () => {
  const name = selectGpuName({ gpuDevice: [
    { active: false, deviceString: 'Integrated graphics' },
    { active: true, deviceString: 'Dedicated graphics' }
  ] });
  assert.equal(name, 'Dedicated graphics');
  assert.equal(selectGpuName({}), 'Graphics adapter not reported');
});
