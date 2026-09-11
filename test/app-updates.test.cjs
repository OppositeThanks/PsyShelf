const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const {AppUpdates,isNewer,releaseInstaller,API}=require('../src/app-updates.cjs');
const payload=Buffer.from('MZ test installer bytes');
function release(version='0.2.15') {
 const name=`PsyShelf-Setup-${version}-Windows.exe`,base=`https://github.com/OppositeThanks/PsyShelf/releases/download/v${version}/`;
 return {tag_name:'v'+version,draft:false,prerelease:false,assets:[{name,size:payload.length,browser_download_url:base+name},{name:name+'.sha256',size:120,browser_download_url:base+name+'.sha256'}]};
}
function fakeFetch(record, body=payload, checksum=createHash('sha256').update(payload).digest('hex')) {
 return async url=> {
  if(url===API)return new Response(JSON.stringify(record));
  if(url===record.assets[1].browser_download_url)return new Response(checksum+'  '+record.assets[0].name+'\n');
  assert.equal(url,record.assets[0].browser_download_url,'download stays pinned to checked release');
  return new Response(body);
 };
}
test('versions compare numerically and reject unstable or malformed releases',()=>{
 assert(isNewer('0.2.15','0.2.9'));assert(!isNewer('0.2.9','0.2.15'));assert(!isNewer('0.2.15','0.2.15'));assert(!isNewer('1.0.0-beta','0.2.15'));
 for(const record of [{...release(),prerelease:true},{...release(),draft:true},{...release(),assets:[]}])assert.throws(()=>releaseInstaller(record));
 const record=release();record.assets[0].browser_download_url='https://example.com/malware.exe';assert.throws(()=>releaseInstaller(record));
});
test('verified downloads preserve existing files and reveal only completed installers',async()=>{
 const downloads=await fs.mkdtemp(path.join(os.tmpdir(),'psy-update-test-'));
 try {
  const existing=path.join(downloads,'keep.txt');await fs.writeFile(existing,'preserve');
  const manager=new AppUpdates({currentVersion:'0.2.13',downloads,fetchImpl:fakeFetch(release()),supported:true});
  assert.equal((await manager.check()).status,'available');assert.equal((await manager.download()).status,'downloaded');
  const file=await manager.downloadedFile();assert.deepEqual(await fs.readFile(file),payload);assert.equal(await fs.readFile(existing,'utf8'),'preserve');
  assert(!(await fs.readdir(downloads)).some(name=>name.endsWith('.part')));
  await fs.unlink(file);assert.equal(await manager.downloadedFile(),null);assert.equal(manager.snapshot().downloadedVersion,null);
 }finally{await fs.rm(downloads,{recursive:true,force:true})}
});
test('corrupt and incomplete downloads never leave an executable or partial file',async()=>{
 const downloads=await fs.mkdtemp(path.join(os.tmpdir(),'psy-update-errors-'));
 try {
  for(const [body,checksum] of [[payload,'0'.repeat(64)],[payload.subarray(0,4),createHash('sha256').update(payload).digest('hex')]]) {
   const manager=new AppUpdates({currentVersion:'0.2.13',downloads,fetchImpl:fakeFetch(release(),body,checksum),supported:true});await manager.check();
   assert.equal((await manager.download()).status,'error');assert.deepEqual(await fs.readdir(downloads),[]);assert.equal(await manager.downloadedFile(),null);
  }
 }finally{await fs.rm(downloads,{recursive:true,force:true})}
});
test('cancellation and shutdown wait for partial-download cleanup',async()=>{
 const downloads=await fs.mkdtemp(path.join(os.tmpdir(),'psy-update-cancel-'));const record=release();
 let received;const firstChunk=new Promise(resolve=>received=resolve);
 const base=fakeFetch(record);
 const manager=new AppUpdates({currentVersion:'0.2.13',downloads,supported:true,notify:state=>{if(state.received>0)received()},fetchImpl:async(url,options)=>{
  if(url!==record.assets[0].browser_download_url)return base(url);
  return new Response(new ReadableStream({start(controller){controller.enqueue(payload.subarray(0,4));options.signal.addEventListener('abort',()=>controller.error(new DOMException('Cancelled','AbortError')),{once:true});}}));
 }});
 try {await manager.check();const job=manager.download();await firstChunk;await manager.stop();await job;assert.equal(manager.snapshot().error,'Update request cancelled.');assert.deepEqual(await fs.readdir(downloads),[])}finally{await fs.rm(downloads,{recursive:true,force:true})}
});
test('current versions, missing releases, rate limits and offline checks stay usable',async()=>{
 const manager=new AppUpdates({currentVersion:'0.2.15',downloads:os.tmpdir(),supported:true,fetchImpl:fakeFetch(release())});assert.equal((await manager.check()).status,'up-to-date');
 manager.fetch=async()=>new Response('',{status:429});assert.match((await manager.check()).error,/limiting/);
 manager.fetch=async()=>{throw new Error('offline')};assert.equal((await manager.check()).status,'error');
 manager.fetch=fakeFetch(release());assert.equal((await manager.check()).status,'up-to-date');
});
