import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,writeFile,copyFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {stages} from '../content/schema.mjs';
const review=process.env.TOGI_REVIEW==='1',processes=[];
let browser,testRoot;
async function serve(file,env){const process=spawn(globalThis.process.execPath,[file],{env:{...globalThis.process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});processes.push(process);const output=await Promise.race([once(process.stdout,'data').then(([chunk])=>String(chunk)),once(process,'exit').then(()=>{throw Error('Test server exited');})]);const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url);return url;}
async function shot(page,name){if(review){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/${name}.png`});}}
async function layout(page,stage,width){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const problems=await page.evaluate(()=>{
   const selectors=['.scene-info','.tools','.lesson-dock','.settings-dock','.story-dock','.view-controls','footer'];
   const boxes=selectors.flatMap(selector=>{const el=document.querySelector(selector);if(!el||!el.getClientRects().length)return[];const r=el.getBoundingClientRect();return [{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scroll:el.scrollHeight>el.clientHeight+2}];});
   const errors=boxes.filter(r=>r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.scroll).map(r=>({outside:r}));
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
     const a=boxes[i],b=boxes[j];
     if(a.selector==='footer'||b.selector==='footer')continue;
     if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2)errors.push({overlap:[a.selector,b.selector]});
   }
   return errors;
 });
 if(problems.length){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/layout-${width}-${stage}-failure.png`});}
 assert.deepEqual(problems,[],`${width} ${stage} layout`);
}
try{
 const url=await serve('server.mjs',{PORT:'0'});
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [1366,1280]){
  const page=await browser.newPage({viewport:{width,height:width===1280?720:768},reducedMotion:width===1280?'reduce':'no-preference'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="new"]').click();
  for(const stage of ['body','mouth','faces','inspect','firing']){
   await layout(page,stage,width);
   if(width===1366){await page.setViewportSize({width:1920,height:1080});await layout(page,stage,1920);await page.setViewportSize({width:1366,height:768});await layout(page,stage,width);}
   if(width===1366&&['body','faces'].includes(stage))await shot(page,'layout-'+stage);
   if(stage!=='firing')await page.locator('[data-action="next"]').click();
  }
  await page.locator('[data-action="next"]').click();
  await page.waitForFunction(()=>document.querySelector('#firing-phase')?.textContent==='가열');
  if(width===1366)await page.waitForFunction(()=>parseFloat(document.querySelector('#fire-progress').style.width)>35);
  if(width===1366)await shot(page,'firing-heat');
  await page.locator('.story-teaser').click();
  await page.waitForTimeout(80);
  const progress=await page.locator('#fire-progress').getAttribute('style');
  await page.waitForTimeout(220);assert.equal(await page.locator('#fire-progress').getAttribute('style'),progress,'story dialog pauses firing');
  await page.locator('[data-action="close"]').click();
  if(width===1366){
    await page.waitForFunction(()=>document.querySelector('#firing-phase')?.textContent==='냉각',{},{timeout:18000});
    await shot(page,'firing-cooling');
    await page.waitForFunction(()=>document.querySelector('#firing-phase')?.textContent==='완성',{},{timeout:18000});
  }else await page.locator('[data-action="next"]').click();
  await page.locator('[data-action="next"]').click();await layout(page,'excavation',width);
  for(let i=0;i<12;i++)await page.locator('[data-action="assist"]').click();
  await page.locator('[data-action="next"]').click();
  assert.equal(await page.locator('body').getAttribute('data-stage'),'assembly');
  await layout(page,'assembly',width);await page.locator('[data-action="place"]').click();await page.locator('[data-action="next"]').click();
  await layout(page,'compare',width);await page.locator('.story-teaser').click();assert.ok(await page.locator('.story-photo img').isVisible());
  await page.locator('[data-action="story-next"]').click();assert.equal(await page.locator('.fact-badge').textContent(),'연구자의 해석');
  await page.locator('[data-action="close"]').click();await page.locator('[data-action="next"]').click();await layout(page,'ending',width);
  assert.deepEqual(errors,[]);await page.close();
 }
 // Editor writes only synthetic content in a temporary workspace.
 testRoot=await mkdtemp(join(tmpdir(),'togi-editor-check-'));
 for(const folder of ['content','asset/runtime/museum','scripts','dist/museum'])await mkdir(join(testRoot,folder),{recursive:true});
 for(const name of ['museum-editor.html','museum-editor.js'])await copyFile('scripts/'+name,join(testRoot,'scripts',name));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64');
 await writeFile(join(testRoot,'asset/runtime/museum/test.png'),png);
 const synthetic={version:1,title:'검사 자료',photos:[{id:'test',file:'test.png',alt:'검사 사진',caption:'검사 사진',credit:'검사',source:''}],stages:Object.fromEntries(stages.map(stage=>[stage,{title:'검사 이야기',summary:'검사 설명',photo:'test',blocks:[{kind:'fact',text:'검사 문단'}]}])),exhibits:[]};
 await writeFile(join(testRoot,'content/museum.json'),JSON.stringify(synthetic));
 const editorURL=await serve('scripts/museum-editor.mjs',{EDITOR_PORT:'0',TOGI_EDITOR_ROOT:testRoot});
 const editor=await browser.newPage();const editorErrors=[];editor.on('pageerror',error=>editorErrors.push(error.message));
 await editor.goto(editorURL);await editor.waitForFunction(()=>document.querySelector('#title').value==='검사 이야기');
 await editor.locator('#stage').selectOption('faces');await editor.locator('#title').fill('내가 수정한 유물 이야기');await editor.locator('#summary').fill('수정한 사진과 설명이에요.');
 await editor.locator('#photo-upload').setInputFiles({name:'new.png',mimeType:'image/png',buffer:png});
 await editor.waitForFunction(()=>document.querySelector('#photo').options.length===2);
 const newPhoto=await editor.locator('#photo').inputValue();await editor.locator('#stage-photo').selectOption(newPhoto);await editor.locator('#caption').fill('직접 바꾼 사진');
 const glb=await readFile('asset/runtime/models/siru.glb');
 await editor.locator('#model-upload').setInputFiles({name:'fixture.glb',mimeType:'model/gltf-binary',buffer:glb});
 await editor.waitForSelector('.exhibit');
 await editor.locator('#save').click();await editor.waitForFunction(()=>document.querySelector('#message').textContent.includes('저장했어요'));
 const saved=JSON.parse(await readFile(join(testRoot,'content/museum.json'),'utf8'));
 assert.equal(saved.stages.faces.title,'내가 수정한 유물 이야기');assert.equal(saved.stages.faces.photo,newPhoto);
 assert.equal(saved.exhibits.length,1);
 assert.deepEqual(JSON.parse(await readFile(join(testRoot,'dist/museum/catalog.json'),'utf8')),saved);
 assert.equal((await fetch(editorURL+'/api/catalog',{method:'POST',body:'{}'})).status,403);
 const token=await editor.evaluate(()=>window.editorToken);
 const invalid=await fetch(editorURL+'/api/catalog',{method:'POST',headers:{'X-Editor-Token':token},body:'{}'});assert.equal(invalid.status,400);
 await editor.reload();await editor.waitForFunction(()=>document.querySelector('#title').value==='검사 이야기');await editor.locator('#stage').selectOption('faces');assert.equal(await editor.locator('#title').inputValue(),'내가 수정한 유물 이야기');
 if(review)await shot(editor,'museum-editor');assert.deepEqual(editorErrors,[]);
 const exhibitPage=await browser.newPage();let modelRequested=false;const warnings=[];
 exhibitPage.on('console',message=>{if(message.type()==='warning'&&message.text().includes('전시 모델'))warnings.push(message.text());});
 await exhibitPage.route('**/museum/catalog.json',route=>route.fulfill({json:saved}));
 await exhibitPage.route('**/museum/assets/*',route=>{const model=route.request().url().endsWith('.glb');modelRequested||=model;return route.fulfill({body:model?glb:png,contentType:model?'model/gltf-binary':'image/png'});});
 await exhibitPage.goto(url);await exhibitPage.waitForSelector('#loading',{state:'detached'});
 assert.equal(modelRequested,true,'registered exhibit is loaded separately from the room');assert.deepEqual(warnings,[]);
 await exhibitPage.close();
 const restored=await fetch(editorURL+'/api/restore',{method:'POST',headers:{'X-Editor-Token':token}});assert.equal(restored.status,200);assert.deepEqual(await restored.json(),synthetic);
 console.log('PASS: all-stage desktop layouts, firing phases/pause/skip, story pages, editor photo/text persistence, publish and restore.');
}finally{
 await browser?.close();for(const process of processes)if(process.exitCode===null){const stopped=once(process,'exit');process.kill();await stopped;}
 if(testRoot){const absolute=await realpath(testRoot);if(absolute.startsWith(join(tmpdir(),'togi-editor-check-')))await rm(absolute,{recursive:true,force:true});}
}
