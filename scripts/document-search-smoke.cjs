const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {_electron}=require(process.env.PSYSHELF_PLAYWRIGHT_MODULE||'playwright');const {scanPdf}=require('../test/fixtures/scanned-pdf.cjs');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'psyshelf-document-ui-')),file=path.join(root,'scan.pdf');fs.writeFileSync(file,scanPdf());const data=path.join(root,'data');fs.mkdirSync(data);fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({agentSetupSeen:true}));
 const app=await _electron.launch({executablePath:process.env.PSYSHELF_EXECUTABLE||require('electron'),args:process.env.PSYSHELF_EXECUTABLE?[]:[path.resolve('.')],env:{...process.env,PSYSHELF_TEST_DATA_DIR:data}});
 try{
 const page=await app.firstWindow();await page.waitForSelector('.resource-card');await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]})},file);
 await page.evaluate(()=>window.psyLibrary.addFiles({storageMode:'reference'}));
 await page.locator('#openDocumentSearch').click();await page.locator('#documentSearchQuery').fill('violet lantern');await page.locator('#documentSearchOCR').check();await page.locator('#documentSearchStart').click();
 await page.waitForFunction(()=>document.getElementById('documentSearchStatus').textContent==='Matching passages: 1',{},{timeout:60000});
 assert.match(await page.locator('.document-hit blockquote').textContent(),/garden/);assert.equal(await page.locator('.document-hit > p').textContent(),'PDF page 1');assert(await page.locator('.document-hit small').isVisible());
 const opened=app.waitForEvent('window');await page.locator('.document-hit button').click();const preview=await opened;await preview.waitForSelector('iframe');assert.match(await preview.locator('iframe').getAttribute('src'),/#page=1$/);await preview.close();
 for(const [language,expected] of [['French','Rechercher dans les documents'],['Spanish','Buscar en documentos']]){
 await page.locator('[data-close="documentSearchDialog"]').click();await page.locator('#settingsButton').click();await page.locator('#interfaceLanguage').selectOption(language);await page.waitForFunction(l=>window.psyI18n.language===l,language);await page.locator('[data-close="settingsDialog"]').click();await page.locator('#openDocumentSearch').click();assert.equal(await page.locator('#documentSearchStart').textContent(),expected);assert.match(await page.locator('.document-hit blockquote').textContent(),/violet lantern/);
 }
 await page.screenshot({path:path.join(root,'document-search.png')});
 // Close the app during OCR to verify nested workers cannot keep shutdown alive.
 await page.locator('#documentSearchStart').click();
 console.log('PASS: scanned PDF search, physical page navigation, OCR labeling, and language switching. '+root);
 }finally{await app.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
