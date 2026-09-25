const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { normalizeDetails } = require('../src/resource-details.cjs');
const { annotationMarkdown } = require('../src/reading.cjs');
const { savedSearches, scanLibrary, registerLibraryTools } = require('../src/library-tools.cjs');
const { indexedDocument } = require('../src/document-index.cjs');
const { searchDocuments } = require('../src/document-search.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'psyshelf-reading-'));
  t.after(async () => { assert.equal(path.dirname(root), os.tmpdir()); assert(path.basename(root).startsWith('psyshelf-reading-')); await fs.rm(root, { recursive:true, force:true }); });
  return root;
}
test('reading metadata survives unrelated edits and validates annotations and page bounds', () => {
  const input = { readingStatus: 'reading', lastPage: 12, bookmarks: [12,2,12], collections: ['Course','Course'], annotations: [{id:'a',page:12,quote:'A passage',note:'A note'}] };
  const details = normalizeDetails(input);
  assert.deepEqual(details.bookmarks,[2,12]); assert.deepEqual(details.collections,['Course']);
  assert.deepEqual(normalizeDetails({rating:4}, details).annotations,input.annotations);
  assert.equal(normalizeDetails({},details).lastPage,12);
  for (const patch of [{lastPage:-1},{lastPage:1.1},{readingStatus:'invalid'},{bookmarks:[-3]},{annotations:[{}]},{collections:'bad'}]) assert.throws(() => normalizeDetails(patch));
  const markdown = annotationMarkdown({...details,title:'Book',authors:['Author'],publicationYear:2020});
  assert.match(markdown,/Author\. 2020\. Book/); assert.match(markdown,/## 12\n\n> A passage\n\nA note/);
});
test('saved searches retain scoped filters and OCR options and reject malformed data', () => {
  const [search] = savedSearches([{name:' Reading ',filters:{query:'memory',collection:'Course',readingStatus:'reading',unknown:'ignored'},ocr:true,ocrLanguage:'fra'}]);
  assert.equal(search.name,'Reading'); assert.equal(search.filters.collection,'Course'); assert.equal(search.ocrLanguage,'fra'); assert.equal(search.filters.unknown,undefined);
  for (const value of [{},[{name:'',filters:{}}],[{name:'x',filters:{query:3}}]]) assert.throws(() => savedSearches(value));
});
test('document index reuses extraction, refreshes changed files, separates OCR languages, and recovers corrupt cache', async t => {
  const root = await fixture(t), file = path.join(root,'source.txt'), cacheDir = path.join(root,'index');
  await fs.writeFile(file,'first'); let calls = 0;
  const extract = async () => { calls++; return {pages:[{page:null,text:await fs.readFile(file,'utf8')}],warning:null}; };
  await indexedDocument(file,{cacheDir},extract); await indexedDocument(file,{cacheDir},extract); assert.equal(calls,1);
  await fs.writeFile(file,'second and longer'); const updated = await indexedDocument(file,{cacheDir},extract); assert.equal(calls,2); assert.equal(updated.pages[0].text,'second and longer');
  await indexedDocument(file,{cacheDir,ocr:{language:'fra'}},extract); await indexedDocument(file,{cacheDir,ocr:{language:'spa'}},extract); assert.equal(calls,4);
  for (const name of await fs.readdir(cacheDir)) await fs.writeFile(path.join(cacheDir,name),'broken');
  await indexedDocument(file,{cacheDir},extract); assert.equal(calls,5);
  await fs.unlink(file); await assert.rejects(indexedDocument(file,{cacheDir},extract));
});
test('partial OCR is retried and cached searches return updated passages after file changes', async t => {
  const root = await fixture(t), file = path.join(root,'source.txt'), cacheDir = path.join(root,'index');
  await fs.writeFile(file,'memory improves with sleep'); let calls = 0;
  const extract = async () => { calls++; return {pages:[],warning:'OCR is limited to 20 pages'}; };
  await indexedDocument(file,{cacheDir,ocr:{language:'eng'}},extract); await indexedDocument(file,{cacheDir,ocr:{language:'eng'}},extract); assert.equal(calls,2);
  const resources = [{id:'a',title:'Source',filePath:file}];
  assert.equal((await searchDocuments(resources,'memory',{cacheDir})).results.length,1);
  await fs.writeFile(file,'a completely different passage');
  assert.equal((await searchDocuments(resources,'memory',{cacheDir})).results.length,0);
});
test('cleanup separates exact duplicates, possible titles, and missing files; cancellation preserves files', async t => {
  const root = await fixture(t), a = path.join(root,'a.txt'), b = path.join(root,'b.txt');
  await fs.writeFile(a,'same'); await fs.writeFile(b,'same');
  const result = await scanLibrary([{id:'a',title:'A',filePath:a},{id:'b',title:'B',filePath:b},{id:'missing',filePath:path.join(root,'missing')},{id:'u1',url:'https://example.com/#a'},{id:'u2',url:'https://example.com/#b'},{id:'t1',title:'A title'},{id:'t2',title:'a title'}]);
  assert.deepEqual(result.groups.map(g=>g.kind),['file','url','title']); assert.equal(result.missing[0].id,'missing');
  const abort = new AbortController(); abort.abort(); await assert.rejects(scanLibrary([{filePath:a}],abort.signal));
  assert.equal(await fs.readFile(a,'utf8'),'same');
});
test('bulk edits roll back the entire transaction on failure', () => {
  const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE resources(id TEXT PRIMARY KEY, details TEXT); INSERT INTO resources VALUES ('a','{}'),('b','{}')");
    const handlers = {};
    registerLibraryTools({handle:(name,fn)=>handlers[name]=fn,getDb:()=>db,getResource:id=>db.prepare('SELECT * FROM resources WHERE id=?').get(id), updateResource:(id,patch)=>{if(id==='b')throw new Error('failure'); db.prepare('UPDATE resources SET details=? WHERE id=?').run(JSON.stringify(patch),id);},changed:()=>{}});
    assert.throws(()=>handlers['library:bulk']({},['a','b'],{readingStatus:'finished'}),/failure/);
    assert.equal(db.prepare("SELECT details FROM resources WHERE id='a'").get().details,'{}');
    assert.throws(()=>handlers['library:bulk']({},['a'],{filePath:'x'}),/Invalid bulk/);
  } finally {db.close();}
});
