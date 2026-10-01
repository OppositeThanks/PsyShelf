const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
async function digest(password, salt) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('Use a password of 12 to 1,024 characters.');
  return scrypt(password, Buffer.from(salt, 'hex'), 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
}
class AppLock {
  constructor(record = null) { this.record = record; this.locked = Boolean(record); this.nextAttempt = 0; this.busy = false; }
  async configure(password, minutes) {
    if (this.record) throw new Error('App lock is already configured.');
    if (![0, 1, 5, 15, 30].includes(minutes)) throw new Error('Invalid automatic lock interval.');
    const salt = crypto.randomBytes(16).toString('hex');
    this.record = { salt, hash: (await digest(password, salt)).toString('hex'), minutes };
    return this.record;
  }
  async verify(password, { unlock = true } = {}) {
    if (this.busy || Date.now() < this.nextAttempt) throw new Error('Wait a moment before trying again.');
    this.busy = true; this.nextAttempt = Date.now() + 1500;
    try {
      const hash = await digest(password, this.record.salt);
      if (!crypto.timingSafeEqual(hash, Buffer.from(this.record.hash, 'hex'))) throw new Error('Incorrect password.');
      if (unlock) this.locked = false;
    } finally { this.busy = false; }
  }
  assertAllowed(channel) { if (this.locked && !['security:status', 'security:unlock'].includes(channel)) throw new Error('Unlock PsyShelf to continue.'); }
}
module.exports = { AppLock };
