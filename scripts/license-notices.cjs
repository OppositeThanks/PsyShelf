// Capture installed package declarations and verbatim legal files for distribution.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const records = new Map();
function inspect(dir) {
  const manifest = path.join(dir, 'package.json');
  if (!fs.existsSync(manifest)) return;
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (!pkg.name || !pkg.version) return;
  const key = `${pkg.name}@${pkg.version}`;
  if (records.has(key)) return;
  const notices = fs.readdirSync(dir).filter(name => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(name))
    .filter(name => fs.statSync(path.join(dir, name)).isFile())
    .map(name => ({ file: name, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
  records.set(key, { package: key, license: pkg.license || 'UNDECLARED', notices });
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    resolvePackage(fs.realpathSync(dir), name);
  }
}
function resolvePackage(from, name) {
  let current = from;
  while (true) {
    const candidate = path.join(current, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) { inspect(candidate); return; }
    const parent = path.dirname(current);
    if (parent === current) return; // Optional platform-specific packages may be absent.
    current = parent;
  }
}
const appPackage = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const name of Object.keys({ ...appPackage.dependencies, ...appPackage.devDependencies })) resolvePackage(root, name);
const result = [...records.values()].sort((a,b) => a.package.localeCompare(b.package));
if (!result.length) throw new Error('Install dependencies before generating notices.');
fs.writeFileSync(path.join(root, 'renderer', 'third-party-notices.txt'),
  'PsyShelf installed dependency inventory (includes build tools).\nDeclarations are not a legal clearance. Bundled native/OCR/model components require separate review.\n\n' +
  result.map(item => `${item.package}\nDeclared license: ${JSON.stringify(item.license)}\n${item.notices.map(n => `${n.file}\n${n.text}`).join('\n')}\n${item.notices.length ? '' : 'REVIEW: no top-level legal file found.\n'}`).join('\n---\n\n'));
console.log(`Captured ${result.length} package declarations and legal notices.`);
