const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const javascriptFiles = [
  'electron/main.cjs',
  'electron/preload.cjs',
  'renderer/app.js',
  'scripts/electron-smoke.cjs',
  'src/agent-contracts.cjs',
  'src/hardware-advisor.cjs',
  'src/library-utils.cjs'
];

/** Finds named JavaScript functions without a directly preceding JSDoc summary. */
function undocumentedJavascriptFunctions(relativePath) {
  const lines = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8').split(/\r?\n/);
  return lines.flatMap((line, index) => {
    const match = line.match(/^\s*(?:async\s+)?function\s+([\w$]+)/);
    if (!match) return [];
    const previous = lines.slice(0, index).reverse().find(candidate => candidate.trim());
    return previous?.trim().endsWith('*/') ? [] : [`${relativePath}:${index + 1} ${match[1]}`];
  });
}

/** Finds Python functions without an immediate one-line docstring. */
function undocumentedPythonFunctions(relativePath) {
  const lines = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8').split(/\r?\n/);
  return lines.flatMap((line, index) => {
    const match = line.match(/^\s*def\s+([\w_]+)/);
    if (!match) return [];
    return /^\s*["']{3}.+["']{3}\s*$/.test(lines[index + 1] || '') ? [] : [`${relativePath}:${index + 1} ${match[1]}`];
  });
}

test('keeps a short description above every named application function', () => {
  const undocumented = javascriptFiles.flatMap(undocumentedJavascriptFunctions);
  undocumented.push(...undocumentedPythonFunctions('scripts/generate-icon.py'));
  assert.deepEqual(undocumented, []);
});
