const { verifyInstaller, configured } = require('../src/publisher-verification.cjs');
if (configured) verifyInstaller(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
