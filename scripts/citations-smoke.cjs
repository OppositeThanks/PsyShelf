const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {_electron}=require(process.env.PSYSHELF_PLAYWRIGHT_MODULE||'playwright');
const {pdfFixture}=require('../test/fixtures/pdf.cjs');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'psyshelf-citations-')); const file=path.join(root,'reference.pdf');
 fs.writeFileSync(file,pdfFixture(['Introduction.','The violet lantern is stored in the garden.']));
 fs.mkdirSync(path.join(root,'data'));fs.writeFileSync(path.join(root,'data','settings.json'),JSON.stringify({agentSetupSeen:true}));
 const executable=process.env.PSYSHELF_EXECUTABLE||require('electron');
 const app=await _electron.launch({executablePath:executable,args:process.env.PSYSHELF_EXECUTABLE?[]:[path.resolve('.')],env:{...process.env,PSYSHELF_TEST_DATA_DIR:path.join(root,'data')}});
 try {
  const page=await app.firstWindow();await page.waitForSelector('.resource-card');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});global.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/api/tags')?{models:[{name:'qwen3:4b'}]}:{message:{content:JSON.stringify({claims:[{text:'The violet lantern is in the garden.',sourceIds:['S1']}]})}}});},file);
  await page.evaluate(()=>window.psyLibrary.addFiles({storageMode:'reference'}));
  await page.locator('[data-tab="chat"]').click();
  await page.locator('#chatInput').fill('Where is the violet lantern?');await page.locator('#chatForm [type="submit"]').click();
  await page.waitForSelector('.citation-link');
  assert.equal(await page.locator('.source-location').first().textContent(),'PDF page 2');
  await page.locator('.citation-link').first().click();
  assert.match(await page.locator('.source-card blockquote').first().textContent(),/violet lantern/);
  const previewPromise=app.waitForEvent('window');await page.locator('.source-card button').first().click();const preview=await previewPromise;
  await preview.waitForSelector('iframe');assert.match(await preview.locator('iframe').getAttribute('src'),/#page=2$/);
  await preview.close();
  for(const [language,label] of [['French','Page PDF 2'],['Spanish','Página PDF 2'],['English','PDF page 2']]){
    await page.locator('#settingsButton').click();await page.locator('#interfaceLanguage').selectOption(language);await page.waitForFunction(l=>window.psyI18n.language===l,language);await page.locator('[data-close="settingsDialog"]').click();
    assert.equal(await page.locator('.source-location').first().textContent(),label);
    assert.equal(await page.locator('.source-answer > p span[translate="no"]').first().textContent(),'The violet lantern is in the garden.');
  }
  await app.evaluate(()=>{global.fetch=async()=>{throw new Error('offline test')};});
  let response=await page.evaluate(()=>window.psyLibrary.chat('violet lantern'));
  assert.equal(response.mode,'source-search');assert.equal(response.sources[0].page,2);assert.equal(response.claims.length,0);
  await app.evaluate(()=>{global.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('/api/tags')?{models:[{name:'qwen3:4b'}]}:{message:{content:JSON.stringify({claims:[{text:'Invented answer',sourceIds:['S999']}]})}}});});
  response=await page.evaluate(()=>window.psyLibrary.chat('violet lantern'));assert.equal(response.mode,'insufficient-evidence');assert.equal(response.claims.length,0);
  response=await page.evaluate(()=>window.psyLibrary.chat('zzznomatchingterm'));assert.equal(response.mode,'no-evidence');
  await page.screenshot({path:path.join(root,'citations.png')});
  console.log('PASS: PDF page 2, excerpt links, preview navigation, three languages, offline fallback, unknown reference rejection and no-match handling. '+root);
 }finally{await app.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
