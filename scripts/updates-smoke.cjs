const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {_electron}=require(process.env.PSYSHELF_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'psyshelf-updates-ui-'));
 fs.writeFileSync(path.join(data,'settings.json'),JSON.stringify({agentSetupSeen:true}));
 const executable=process.env.PSYSHELF_EXECUTABLE||require('electron');
 const options={executablePath:executable,args:process.env.PSYSHELF_EXECUTABLE?[]:[path.resolve('.')],env:{...process.env,PSYSHELF_TEST_DATA_DIR:data}};
 let app=await _electron.launch(options);
 try {
  const page=await app.firstWindow();await page.waitForSelector('.resource-card');
  await app.evaluate(({shell}, checksum)=>{
   const body=Buffer.from('MZ safe test fixture, never executed');
   const name='PsyShelf-Setup-99.0.0-Windows.exe',base='https://github.com/OppositeThanks/PsyShelf/releases/download/v99.0.0/';
   global.fetch=async url=>{
    if(String(url).includes('/api/tags'))throw new Error('Ollama offline');
    if(String(url).endsWith('/releases/latest'))return new Response(JSON.stringify({tag_name:'v99.0.0',draft:false,prerelease:false,assets:[{name,size:body.length,browser_download_url:base+name},{name:name+'.sha256',browser_download_url:base+name+'.sha256'}]}));
    if(String(url).endsWith('.sha256'))return new Response(checksum+'  '+name);
    return new Response(body);
   };
   shell.showItemInFolder=file=>{global.shownInstaller=file};
  }, require('node:crypto').createHash('sha256').update('MZ safe test fixture, never executed').digest('hex'));
  await page.locator('#settingsButton').click();await page.locator('#checkUpdates').click();
  await page.waitForFunction(()=>document.getElementById('updateStatus').textContent==='A new version is available.');
  assert.equal(await page.locator('#updateVersion').textContent(),'PsyShelf 99.0.0');
  await page.locator('[data-close="settingsDialog"]').click();assert(await page.locator('#updateNotice').isVisible());
  await page.locator('#updateNotice').click();assert(await page.locator('#settingsDialog').isVisible());
  for(const [language,label] of [['French','Télécharger la mise à jour'],['Spanish','Descargar actualización'],['English','Download update']]){
   await page.locator('#interfaceLanguage').selectOption(language);await page.waitForFunction(l=>window.psyI18n.language===l,language);
   assert.equal(await page.locator('#downloadUpdate').textContent(),label);
  }
  await page.locator('#downloadUpdate').click();await page.waitForFunction(()=>document.getElementById('updateStatus').textContent.startsWith('Download verified.'));
  await page.locator('#showUpdateDownload').click();const file=await app.evaluate(()=>global.shownInstaller);
  assert(file.startsWith(path.join(data,'test-downloads')));assert(fs.existsSync(file));assert(!file.endsWith('.part'));
  await page.locator('#automaticUpdates').uncheck();assert.equal(JSON.parse(fs.readFileSync(path.join(data,'settings.json'),'utf8')).checkUpdates,false);
  await page.screenshot({path:path.join(data,'updates.png')});
  await app.close();app=await _electron.launch(options);
  const restarted=await app.firstWindow();await restarted.waitForSelector('.resource-card');await restarted.locator('#settingsButton').click();
  assert.equal(await restarted.locator('#automaticUpdates').isChecked(),false);
  console.log('PASS: notification, three languages, verified download, reveal action, and preference persistence. Installer was not executed. '+data);
 }finally{await app.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
