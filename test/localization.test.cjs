const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {translate, messages} = require('../renderer/i18n.js');

test('all translation entries include French and Spanish without conflicting duplicates', () => {
  const seen = new Map();
  for (const row of messages) {
    assert.equal(row.length,3);
    assert(row.every(value => typeof value === 'string' && value.trim()));
    if (seen.has(row[0])) assert.deepEqual(row,seen.get(row[0]));
    seen.set(row[0],row);
  }
});
test('static interface copy has translations, including future additions', () => {
  const invariant = new Set(['PsyShelf','Ctrl K','URL','Français','Español','ollama pull qwen3:4b']);
  for (const file of ['index.html','preview.html']) {
    const html=fs.readFileSync(path.join(__dirname,'../renderer',file),'utf8');
    for (const match of html.matchAll(/>([^<>]+)</g)) {
      const text=match[1].trim().replaceAll('&amp;','&');
      if (!/[a-z]{3}/i.test(text) || invariant.has(text)) continue;
      assert(translate(text,'French')!==text || translate(text,'Spanish')!==text, `Missing translation: ${text}`);
    }
  }
});
test('dynamic progress and confirmation paragraphs translate while filenames remain intact', () => {
  assert.equal(translate('Backup: Copying files','French'),'Sauvegarde: Copie des fichiers');
  assert.equal(translate('File 1 of 2 · 0.1 MB / 0.2 MB · Book.pdf','Spanish'),'Archivo 1 de 2 · 0.1 MB / 0.2 MB · Book.pdf');
  assert.equal(translate('Backup: C:\\Book\nSaved: 2026-09-11','French'),'Sauvegarde: C:\\Book\nEnregistré: 2026-09-11');
  assert.equal(translate('My custom category','Spanish'),'My custom category');
  assert.equal(translate('Book','English'),'Book');
});
