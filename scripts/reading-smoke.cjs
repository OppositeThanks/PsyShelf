const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(process.env.PSYSHELF_PLAYWRIGHT_MODULE || 'playwright');
const { pdfFixture } = require('../test/fixtures/pdf.cjs');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'psyshelf-reading-smoke-'));
  const data = path.join(root,'data'); fs.mkdirSync(data);
  fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({agentSetupSeen:true}));
  const file = path.join(root,'reading.pdf'); fs.writeFileSync(file,pdfFixture(['First page for reading.','Memory improves with sleep.','Last page.']));
  const launchOptions = {executablePath:process.env.PSYSHELF_EXECUTABLE || require('electron'),args:process.env.PSYSHELF_EXECUTABLE ? [] : [path.resolve('.')],env:{...process.env,PSYSHELF_TEST_DATA_DIR:data}};
  const app = await _electron.launch(launchOptions);
  const errors = [];
  try {
    const page = await app.firstWindow(); page.on('pageerror',e=>errors.push(e.message));
    await page.waitForSelector('.resource-card');
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
    const [resource] = await page.evaluate(()=>window.psyLibrary.addFiles({storageMode:'reference'}));
    await page.evaluate(id=>window.psyLibrary.updateResource(id,{collections:['Sleep course'],readingStatus:'reading'}),resource.id);
    await page.evaluate(()=>loadResources());
    await page.locator('#collectionFilter').selectOption('Sleep course');
    assert.equal(await page.locator('.resource-card').count(),1);
    await page.locator('#libraryToolsButton').click();
    await page.locator('#saveSearchForm input').fill('Sleep reading'); await page.locator('#saveSearchForm button').click();
    await page.waitForFunction(()=>document.querySelector('#savedSearchSelect').options.length===2);
    await page.locator('#libraryToolsDialog [data-close-tool]').click();
    await page.locator('#clearFilters').click(); await page.locator('#savedSearchSelect').selectOption('0');
    assert.equal(await page.locator('#collectionFilter').inputValue(),'Sleep course');
    let opened = app.waitForEvent('window'); await page.evaluate(id=>window.psyLibrary.openPreview(id),resource.id);
    let preview = await opened; preview.on('pageerror',e=>errors.push(e.message));
    await preview.waitForSelector('#pdfText span');
    await preview.waitForFunction(()=>!document.querySelector('#nextPage').disabled);
    await preview.locator('#nextPage').click(); await preview.waitForFunction(()=>document.querySelector('#pdfPage').value==='2'&&!document.querySelector('#bookmarkPage').disabled);
    await preview.locator('#bookmarkPage').click();
    await preview.waitForFunction(()=>document.querySelector('#bookmarkPage').textContent==='Remove bookmark');
    await preview.evaluate(()=>{const node=document.querySelector('#pdfText span');const range=document.createRange();range.selectNodeContents(node);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);});
    await preview.locator('#highlightSelection').click();
    assert.match(await preview.locator('#pdfQuote').inputValue(),/Memory/);
    await preview.locator('#pdfNote').fill('Useful for the course'); await preview.locator('#pdfAnnotationForm button').click();
    await preview.waitForSelector('#pdfAnnotations article');
    assert.equal(await preview.evaluate(()=>CSS.highlights.get('annotations').size),1);
    await preview.screenshot({path:path.join(root,'reader.png')});
    await preview.close();
    opened = app.waitForEvent('window'); await page.evaluate(id=>window.psyLibrary.openPreview(id),resource.id); preview = await opened;
    await preview.waitForFunction(()=>document.querySelector('#pdfPage')?.value==='2'&&document.querySelector('#pdfAnnotations article'));
    assert.match(await preview.locator('#pdfAnnotations').textContent(),/Useful for the course/);
    for(const [language,label] of [['French','Page suivante'],['Spanish','Página siguiente'],['English','Next page']]) {
      await page.evaluate(language=>window.psyLibrary.updateSettings({language}),language);
      await preview.waitForFunction(label=>document.querySelector('#nextPage').textContent===label,label);
    }
    await preview.close();
    await page.evaluate(id=>window.libraryTools.openReading(id),resource.id); await page.waitForSelector('#readingDialog[open]');
    for (const [language,label] of [['French','Lecture et annotations'],['Spanish','Lectura y anotaciones'],['English','Reading & annotations']]) {
      await page.evaluate(language=>window.psyI18n.setLanguage(language),language);
      assert.equal(await page.locator('#readingDialog h2').textContent(),label);
      assert.match(await page.locator('#annotationList').textContent(),/Useful for the course/);
    }
    const exported=path.join(root,'notes.md');
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},exported);
    await page.locator('#exportAnnotations').click(); await page.waitForFunction(()=>document.querySelector('#readingDialog .tool-status').textContent==='Annotations exported.');
    assert.match(fs.readFileSync(exported,'utf8'),/## 2/);
    await page.locator('#readingDialog [data-close-tool]').click();
    await page.locator('#libraryToolsButton').click();
    await page.locator('#bulkAll').check(); await page.locator('#bulkForm select[name="field"]').selectOption('readingStatus');
    await page.locator('#bulkForm select[name="status"]').selectOption('finished'); await page.locator('#bulkForm button').click(); await page.locator('#bulkReview button').click();
    await page.waitForFunction(()=>document.querySelector('#libraryToolsDialog .tool-status').textContent==='Saved.');
    assert.equal((await page.evaluate(()=>window.psyLibrary.listResources())).find(r=>r.id===resource.id).readingStatus,'finished');
    await page.locator('#scanLibrary').click(); await page.waitForFunction(()=>document.querySelector('#libraryToolsDialog .tool-status').textContent==='Library scan complete.');
    await page.screenshot({path:path.join(root,'organize.png')});
    await page.locator('#libraryToolsDialog [data-close-tool]').click();
    const moved=path.join(root,'moved.pdf');fs.renameSync(file,moved);
    assert((await page.evaluate(()=>window.psyLibrary.scanLibrary())).missing.some(r=>r.id===resource.id));
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>({response:1});},moved);
    assert(await page.evaluate(id=>window.psyLibrary.relinkFile(id),resource.id));
    const reconnected=(await page.evaluate(()=>window.psyLibrary.listResources())).find(r=>r.id===resource.id);
    assert.equal(reconnected.filePath,moved);assert.equal(reconnected.lastPage,2);assert.equal(reconnected.annotations.length,1);
    const [managed]=await page.evaluate(()=>window.psyLibrary.addFiles({storageMode:'copy'}));
    const oldManaged=managed.filePath;
    assert(await page.evaluate(id=>window.psyLibrary.relinkFile(id),managed.id));
    const copied=(await page.evaluate(()=>window.psyLibrary.listResources())).find(r=>r.id===managed.id);
    assert.equal(copied.storageMode,'copy');assert.notEqual(copied.filePath,moved);assert(fs.existsSync(oldManaged));assert(fs.existsSync(copied.filePath));
    assert.deepEqual(errors,[]);
    console.log('PASS: saved search, collection scope, PDF page persistence, bookmark, selected-text highlight, note export, bulk edit, cleanup and three languages. '+root);
  } finally { await app.close(); }
  const restarted=await _electron.launch(launchOptions);
  try {
    const page=await restarted.firstWindow();await page.waitForSelector('.resource-card');
    const resources=await page.evaluate(()=>window.psyLibrary.listResources());
    const resource=resources.find(r=>r.annotations.length);
    assert.equal(resource.lastPage,2);assert.deepEqual(resource.bookmarks,[2]);assert.equal(resource.readingStatus,'finished');
    assert.equal((await page.evaluate(()=>window.psyLibrary.savedSearches()))[0].name,'Sleep reading');
    console.log('PASS: reference and managed reconnection preserve originals; reading data and saved searches persist after app restart.');
  } finally {await restarted.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
