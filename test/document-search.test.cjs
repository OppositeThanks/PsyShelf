const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {searchDocuments}=require('../src/document-search.cjs');const {DocumentSearchJobs}=require('../src/document-search-jobs.cjs');const {scanPdf,scanImage}=require('./fixtures/scanned-pdf.cjs');
test('scanned PDFs use real local OCR, preserve physical page numbers, and never modify originals',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'psy-doc-search-'));try{
 const file=path.join(dir,'scan.pdf'),bytes=scanPdf();await fs.writeFile(file,bytes);const resources=[{id:'scan',title:'Scanned page',filePath:file}];
 assert.equal((await searchDocuments(resources,'violet lantern')).results.length,0);
 const answer=await searchDocuments(resources,'violet lantern',{ocr:true,language:'eng'});assert.equal(answer.results.length,1);assert.equal(answer.results[0].page,1);assert.equal(answer.results[0].ocr,true);assert.match(answer.results[0].excerpt,/garden/);assert.deepEqual(await fs.readFile(file),bytes);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('French and Spanish OCR data work offline for image searches',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'psy-doc-languages-'));try{
 for(const [language,text,query] of [['fra','Bonjour la bibliotheque','bibliotheque'],['spa','Hola la biblioteca','biblioteca']]){const file=path.join(dir,language+'.jpg');await fs.writeFile(file,scanImage(text));const answer=await searchDocuments([{id:language,title:language,filePath:file}],query,{ocr:true,language});assert.equal(answer.results.length,1);assert.equal(answer.results[0].page,null);assert(answer.results[0].ocr)}
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('document search checks beyond 30 entries and ignores catalog-only matches',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'psy-doc-full-'));try{
 const file=path.join(dir,'passage.txt');await fs.writeFile(file,'A unique passage about the violet lantern.');
 const resources=Array.from({length:35},(_,i)=>({id:String(i),title:'violet lantern',description:'Catalog only'}));resources.push({id:'file',title:'Contents',filePath:file});
 const answer=await searchDocuments(resources,'violet lantern');assert.equal(answer.results.length,1);assert.equal(answer.results[0].resourceId,'file');assert.equal(answer.results[0].page,null);
 }finally{await fs.rm(dir,{recursive:true,force:true})}
});
test('cancellation releases the search worker and allows another search',async()=>{
 const jobs=new DocumentSearchJobs();const result=jobs.run([],'test',{ocr:false,language:'eng'});await jobs.cancel();assert.equal((await result).cancelled,true);assert.equal(jobs.job,null);assert.deepEqual((await jobs.run([],'test',{ocr:false,language:'eng'})).results,[]);
});
