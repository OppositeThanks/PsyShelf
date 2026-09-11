const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pdfFixture } = require('./fixtures/pdf.cjs');
const { extractDocument, retrieve, validateAnswer } = require('../src/source-evidence.cjs');
const { searchEvidence } = require('../src/evidence-search.cjs');

test('PDF extraction and worker retrieval preserve physical page numbers and exact excerpts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'psy-evidence-'));
  try {
    const filename = path.join(root, 'reference.pdf');
    await fs.writeFile(filename, pdfFixture(['Opening introduction.', 'The violet lantern is stored in the garden.', '']));
    const extracted = await extractDocument(filename);
    assert.equal(extracted.pages[1].page, 2);
    assert.match(extracted.pages[1].text, /violet lantern/);
    assert.match(extracted.warning, /OCR/);
    const result = await searchEvidence([{id:'book',title:'Reference',filePath:filename}], 'Where is the violet lantern?');
    assert.equal(result.sources[0].resourceId,'book');
    assert.equal(result.sources[0].page,2);
    assert(extracted.pages[1].text.includes(result.sources[0].excerpt));
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('text and catalog citations never invent page numbers; unreadable documents are reported', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'psy-text-evidence-'));
  try {
    const filename=path.join(root,'notes.txt');
    await fs.writeFile(filename,'An amber notebook is on the shelf.');
    const result=await retrieve([{id:'text',title:'Notes',filePath:filename},{id:'web',title:'Amber catalog',description:'A catalog description only.',url:'https://example.com'},{id:'missing',title:'Missing',filePath:path.join(root,'gone.pdf')}],'amber');
    assert(result.sources.some(source => source.resourceId==='text' && source.kind==='document' && source.page===null));
    assert(result.sources.some(source => source.resourceId==='web' && source.kind==='catalog' && source.page===null));
    assert.equal(result.warnings.length,1);
    assert.equal((await retrieve([{id:'text',title:'Notes',filePath:filename}],'nonexistentword')).sources.length,0);
    await fs.writeFile(filename,'The amber notebook moved.');
    assert.match((await retrieve([{id:'text',title:'Notes',filePath:filename}],'amber')).sources[0].excerpt,/moved/);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('fabricated, missing and malformed model references reject the entire answer', () => {
  const sources=[{id:'S1'}];
  assert.deepEqual(validateAnswer({claims:[{text:'Supported statement',sourceIds:['S1','S1']}]},sources),[{text:'Supported statement',sourceIds:['S1']}]);
  for (const claims of [[],[{text:'Unsupported',sourceIds:['S999']}],[{text:'No citation',sourceIds:[]}],[{text:'Mix',sourceIds:['S1','invented']}],[{text:42,sourceIds:['S1']}]]) assert.equal(validateAnswer({claims},sources),null);
});
