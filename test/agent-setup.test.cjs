const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendModel } = require('../src/agent-setup.cjs');
const hardware = { totalGB: 32, freeGB: 16, threads: 8, diskGB: 100 };

test('recommendations scale with memory and CPU capacity', () => {
  for (const [totalGB, freeGB, threads, model] of [[4, 2, 2, 'qwen3:0.6b'], [8, 3, 2, 'qwen3:1.7b'], [16, 6, 4, 'qwen3:4b'], [32, 10, 8, 'qwen3:8b']]) {
    assert.equal(recommendModel({ ...hardware, totalGB, freeGB, threads }).model, model);
  }
  assert.equal(recommendModel({ ...hardware, freeGB: 3 }).model, 'qwen3:1.7b');
  assert.equal(recommendModel({ ...hardware, threads: 2 }).model, 'qwen3:1.7b');
});
test('insufficient resources recommend no download; limited disk selects a smaller model', () => {
  assert.equal(recommendModel({ ...hardware, freeGB: 1 }).model, null);
  assert.equal(recommendModel({ ...hardware, diskGB: 4 }).model, null);
  assert.equal(recommendModel({ ...hardware, diskGB: 7 }).model, 'qwen3:1.7b');
  assert.equal(recommendModel({ ...hardware, diskGB: null }).model, 'qwen3:8b');
});
