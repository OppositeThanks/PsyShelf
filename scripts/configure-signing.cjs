const fs = require('node:fs');
const pins = (process.env.PSYSHELF_PUBLISHER_THUMBPRINTS || '').split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
if (pins.some(pin => !/^[A-F0-9]{40}$/.test(pin))) throw new Error('Invalid publisher certificate thumbprint.');
if (Boolean(pins.length) !== Boolean(process.env.WIN_CSC_LINK)) throw new Error('Configure both publisher thumbprints and signing credentials, or neither.');
fs.writeFileSync('src/publisher.json', JSON.stringify({ thumbprints: pins }) + '\n');
if (pins.length) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.build.forceCodeSigning = true;
  pkg.build.win.signtoolOptions = { signingHashAlgorithms: ['sha256'] };
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
}
console.log(pins.length ? 'Trusted signing required for this build.' : 'No signing identity configured; this build is unsigned and in-app update downloads are disabled.');
