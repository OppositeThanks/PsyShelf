const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AppLock } = require('../src/app-lock.cjs');
const { validateSignature, verifyInstaller } = require('../src/publisher-verification.cjs');
test('app lock persists only a salted password hash, rejects wrong passwords and throttles retries', async () => {
  const first = new AppLock(); const password = 'test long lock password';
  const record = await first.configure(password, 5);
  assert.equal(JSON.stringify(record).includes(password), false);
  const locked = new AppLock(record);
  assert.throws(() => locked.assertAllowed('resources:list'), /Unlock/);
  locked.assertAllowed('security:status');
  await assert.rejects(locked.verify('wrong long password'), /Incorrect/);
  assert.equal(locked.locked, true);
  await assert.rejects(locked.verify(password), /Wait/);
  locked.nextAttempt = 0;
  await locked.verify(password);
  locked.assertAllowed('resources:list'); assert.equal(locked.locked, false);
});
test('publisher verification rejects unsigned, invalid, unknown and unconfigured identities', async () => {
  const pin = 'A'.repeat(40);
  assert.equal(validateSignature({ status: 'Valid', thumbprint: pin }, [pin]), true);
  for (const signature of [{ status: 'NotSigned' }, { status: 'HashMismatch', thumbprint: pin }, { status: 'Valid', thumbprint: 'B'.repeat(40) }]) assert.throws(() => validateSignature(signature, [pin]), /not trusted/);
  assert.throws(() => validateSignature({ status: 'Valid', thumbprint: pin }, []), /not configured/);
  await assert.rejects(verifyInstaller('unused.exe', []), /not configured/);
});
