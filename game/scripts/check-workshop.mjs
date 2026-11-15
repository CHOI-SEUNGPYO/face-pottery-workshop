import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,writeFile,copyFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {stages} from '../content/schema.mjs';
import {checkMuseumWelcome} from './museum-checks.mjs';
const review=process.env.TOGI_REVIEW==='1',processes=[];
let browser,testRoot,activePage;
async function serve(file,env){const process=spawn(globalThis.process.execPath,[file],{env:{...globalThis.process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});processes.push(process);const output=await Promise.race([once(process.stdout,'data').then(([chunk])=>String(chunk)),once(process,'exit').then(()=>{throw Error('Test server exited');})]);const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url);return url;}
async function shot(page,name){if(review||(process.env.TOGI_FIRING_REVIEW==='1'&&name.startsWith('firing-'))){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/${name}.png`});}}
async function layout(page,stage,width){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const problems=await page.evaluate(()=>{
   const selectors=['.scene-info','.drawing-actions[open] .action-panel','.lesson-dock','.settings-dock','.story-dock','.drawing-actions > summary','.character-dock','footer'];
   const boxes=selectors.flatMap(selector=>{const el=document.querySelector(selector);if(!el||!el.getClientRects().length)return[];const r=el.getBoundingClientRect();return [{selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scroll:el.scrollHeight>el.clientHeight+2}];});
   const errors=boxes.filter(r=>r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||r.scroll).map(r=>({outside:r}));
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
     const a=boxes[i],b=boxes[j];
     if(a.selector==='footer'||b.selector==='footer')continue;
     if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2)errors.push({overlap:[a.selector,b.selector]});
   }
   const menu=boxes.find(b=>b.selector==='.drawing-actions > summary'),guide=boxes.find(b=>b.selector==='.character-dock');
   if(menu&&guide&&guide.y-menu.bottom<12)errors.push({guideGap:guide.y-menu.bottom});
   const buttons=[...document.querySelectorAll('.drawing-actions[open] button')].map(el=>({name:el.getAttribute('aria-label')||el.textContent,rect:el.getBoundingClientRect()}));
   for(let i=0;i<buttons.length;i++)for(const b of buttons.slice(i+1)){
     const a=buttons[i],r=a.rect,s=b.rect;
     if(Math.min(r.right,s.right)-Math.max(r.left,s.left)>2&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>2)errors.push({toolOverlap:[a.name,b.name]});
   }
   return errors;
 });
 if(problems.length){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/layout-${width}-${stage}-failure.png`});}
 assert.deepEqual(problems,[],`${width} ${stage} layout`);
 assert.ok(await page.locator('.ai-mark').isVisible(),`${stage} keeps the AI notice visible`);
}
async function welcomeDisclosure(page,viewport){
 await page.setViewportSize(viewport);
 await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const problems=await page.evaluate(()=>{
  const selectors=['header','.welcome-copy','.welcome-foot'];
  const boxes=selectors.map(selector=>({selector,rect:document.querySelector(selector).getBoundingClientRect()}));
  const errors=[];
  for(const {selector,rect:r} of boxes)if(r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1)errors.push(`${selector} outside viewport`);
  for(let i=0;i<boxes.length;i++)for(const b of boxes.slice(i+1)){
   const a=boxes[i],r=a.rect,s=b.rect;
   if(Math.min(r.right,s.right)-Math.max(r.left,s.left)>2&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>2)errors.push(`${a.selector} overlaps ${b.selector}`);
  }
  for(const selector of ['.ai-notice','[data-action="new"]','.welcome-foot a','.welcome-foot button']){
   const el=document.querySelector(selector),r=el.getBoundingClientRect();
   if(!el.getClientRects().length||r.bottom>innerHeight+1||r.right>innerWidth+1)errors.push(`${selector} hidden or clipped`);
   const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
   if(selector!=='.ai-notice'&&!el.contains(hit))errors.push(`${selector} obstructed`);
  }
  return errors;
 });
 if(problems.length||process.env.TOGI_DISCLOSURE_REVIEW==='1'){
  await mkdir('asset/review',{recursive:true});
  await page.screenshot({path:`asset/review/ai-welcome-${viewport.width}.png`});
 }
 assert.deepEqual(problems,[],`${viewport.width} × ${viewport.height} welcome disclosure layout`);
 assert.match(await page.locator('.ai-notice').textContent(),/AI\(인공지능\)/);
 const link=page.locator('.welcome-foot .museum-home-link');
 assert.equal(await link.getAttribute('href'),'https://www.gbgs.go.kr/museum/main.do');
 assert.equal(await link.getAttribute('target'),'_blank');
 assert.match(await link.getAttribute('rel'),/noopener/);
}
try{
 const url=await serve('server.mjs',{PORT:'0'});
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [1366,1280]){
  const page=await browser.newPage({viewport:{width,height:width===1280?720:768},reducedMotion:width===1280?'reduce':'no-preference'});
  activePage=page;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.waitForSelector('#loading',{state:'detached'});
  if(width===1366){
   for(const viewport of [{width:1366,height:768},{width:740,height:360},{width:320,height:568},{width:390,height:844},{width:768,height:1024}])await welcomeDisclosure(page,viewport);
   await page.locator('[data-action="credits"]').click();
   assert.match(await page.locator('.credits-copy').textContent(),/실제 사진은 AI 생성 이미지가 아니에요/);
   assert.match(await page.locator('.credits-copy').textContent(),/플레이어가 직접 조절/);
   if(process.env.TOGI_DISCLOSURE_REVIEW==='1')await page.screenshot({path:'asset/review/ai-credits.png'});
   await page.locator('[data-action="close"]').click();
   await page.setViewportSize({width:1366,height:768});
   await checkMuseumWelcome(page);
  }
  await page.locator('[data-action="new"]').click();
  for(const stage of ['body','mouth','faces','inspect','firing']){
   await page.waitForFunction(s=>document.body.dataset.stage===s,stage);
   await layout(page,stage,width);
   if(stage==='faces'){
     await page.locator('.drawing-actions summary').click();await layout(page,'faces-open',width);
     await page.locator('.drawing-actions summary').click();
   }
   if(stage==='firing'){
     await page.locator('[data-action="kiln-guide"]').click();
     assert.match(await page.locator('.kiln-guide').textContent(),/실제로 가마 벽을 열어 둔 채 굽는다는 뜻은 아니에요/);
     assert.ok(await page.locator('.kiln-flow').isVisible());
     if(process.env.TOGI_MUSEUM_REVIEW==='1'&&width===1366)await page.screenshot({path:'asset/review/museum-kiln-guide.png'});
     await page.locator('.modal-close').click();
   }
   if(width===1366){
     for(const viewport of [{width:1920,height:1080},{width:844,height:390},{width:390,height:844},{width:320,height:568},{width:740,height:360},{width:1024,height:768},{width:768,height:1024},{width:1180,height:820}]){
       await page.setViewportSize(viewport);await layout(page,stage,viewport.width);
       if(stage==='faces'){
         await page.locator('.drawing-actions summary').click();await layout(page,'faces-open',viewport.width);
         await page.locator('.drawing-actions summary').click();
       }
     }
     await page.setViewportSize({width:1366,height:768});
   }
   if(width===1366&&['body','faces'].includes(stage))await shot(page,'layout-'+stage);
   if(stage!=='firing')await page.locator('[data-action="next"]').click();
  }
  // Hold transient phases through the real story button, before the remote
  // browser can finish rendering and return the click command to the runner.
  await page.evaluate(holdCooling=>{
    window.__observedFiring=[];
    const held=new Set();
    const observer=new MutationObserver(()=>{
      const phase=document.querySelector('#firing-phase')?.textContent;
      if(!phase)return;
      if(window.__observedFiring.at(-1)!==phase)window.__observedFiring.push(phase);
      if((phase==='가열'||(holdCooling&&phase==='냉각'))&&!held.has(phase)){
        held.add(phase);document.querySelector('.story-teaser').click();
      }
      if(phase==='완성')observer.disconnect();
    });
    observer.observe(document.querySelector('#hud'),{childList:true,subtree:true,characterData:true});
  },width===1366);
  await page.locator('[data-action="next"]').click();
  try{
    await page.waitForFunction(()=>document.querySelector('dialog').open&&window.__observedFiring.includes('가열'),null,{timeout:90000});
  }catch(error){
    console.error('Firing diagnostic:',await page.evaluate(()=>({phase:document.querySelector('#firing-phase')?.textContent,progress:document.querySelector('#fire-progress')?.getAttribute('style'),hidden:document.hidden,observed:window.__observedFiring})));
    await mkdir('asset/review',{recursive:true});await page.screenshot({path:'asset/review/firing-timeout.png',timeout:10000}).catch(()=>{});throw error;
  }
  await page.waitForTimeout(80);
  const progress=await page.locator('#fire-progress').getAttribute('style');
  await page.waitForTimeout(220);assert.equal(await page.locator('#fire-progress').getAttribute('style'),progress,'story dialog pauses firing');
  assert.equal(await page.locator('[data-action="kiln-inside"]').count(),0,'automatic kiln cutaway does not show a conflicting manual view button');
  await page.locator('[data-action="close"]').click();
  if(width===1366)await shot(page,'firing-heat');
  if(width===1366){
    await page.waitForFunction(()=>document.querySelector('dialog').open&&window.__observedFiring.includes('냉각'),null,{timeout:90000});
    await page.locator('[data-action="close"]').click();
    await shot(page,'firing-cooling');
    await page.waitForFunction(()=>document.querySelector('#firing-phase')?.textContent==='완성',null,{timeout:90000});
  }else await page.locator('[data-action="next"]').click();
  await page.locator('[data-action="next"]').click();await layout(page,'excavation',width);
  if(width===1366){for(const viewport of [{width:740,height:360},{width:390,height:844},{width:320,height:568},{width:1024,height:768},{width:768,height:1024}]){await page.setViewportSize(viewport);await layout(page,'excavation',viewport.width);}await page.setViewportSize({width:1366,height:768});}
  // Let the player inspect the find before explicitly leaving the trench.
  for(let i=0;i<12&&await page.locator('body').getAttribute('data-stage')==='excavation';i++){await page.locator('[data-action="assist"]').click();if(await page.locator('[data-action="next"]').isEnabled())break;}
  assert.equal(await page.locator('body').getAttribute('data-stage'),'excavation');
  await page.locator('[data-action="next"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='assembly');
  assert.equal(await page.locator('body').getAttribute('data-stage'),'assembly');
  await layout(page,'assembly',width);
  if(width===1366){for(const viewport of [{width:740,height:360},{width:390,height:844},{width:320,height:568},{width:1024,height:768},{width:768,height:1024}]){await page.setViewportSize(viewport);await layout(page,'assembly',viewport.width);}await page.setViewportSize({width:1366,height:768});}
  await page.locator('[data-action="place"]').click();await page.locator('[data-action="next"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='compare');
  await layout(page,'compare',width);
  if(width===1366){for(const viewport of [{width:740,height:360},{width:390,height:844},{width:320,height:568},{width:1024,height:768},{width:768,height:1024}]){await page.setViewportSize(viewport);await layout(page,'compare',viewport.width);}await page.setViewportSize({width:1366,height:768});}
  await page.locator('.story-teaser').click();assert.ok(await page.locator('.story-photo img').isVisible());
  await page.locator('[data-action="story-next"]').click();assert.equal(await page.locator('.fact-badge').textContent(),'게임 속 상상');
  assert.ok((await page.locator('.story-copy').textContent()).includes('3D 스캔은 아니며'),'the model is described as a photo-informed reconstruction');
  await page.locator('[data-action="story-next"]').click();assert.equal(await page.locator('.fact-badge').textContent(),'연구자의 해석');
  await page.locator('[data-action="close"]').click();await page.locator('[data-action="next"]').click();await page.waitForSelector('.photo-editor canvas');
  assert.equal(await page.locator('[data-sticker]').count(),3);await page.locator('[data-sticker="경산이"]').click();
  await page.locator('[data-photo="size"]').fill('340');await page.locator('[data-photo="angle"]').fill('25');
  const download=page.waitForEvent('download');await page.locator('[data-photo="download"]').click();assert.ok((await download).suggestedFilename().endsWith('.png'));
  await page.locator('[data-action="close"]').click();
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
 await editor.locator('#photo-category').selectOption('siru');await editor.locator('#photo-title').fill('사진첩의 시루');
 const glb=await readFile('asset/runtime/models/siru.glb');
 await editor.locator('#model-upload').setInputFiles({name:'fixture.glb',mimeType:'model/gltf-binary',buffer:glb});
 await editor.waitForSelector('.exhibit');
 await editor.locator('#save').click();await editor.waitForFunction(()=>document.querySelector('#message').textContent.includes('저장했어요'));
 const saved=JSON.parse(await readFile(join(testRoot,'content/museum.json'),'utf8'));
 assert.equal(saved.stages.faces.title,'내가 수정한 유물 이야기');assert.equal(saved.stages.faces.photo,newPhoto);
 assert.equal(saved.exhibits.length,1);
 assert.equal(saved.photos.find(p=>p.id===newPhoto).category,'siru');assert.equal(saved.photos.find(p=>p.id===newPhoto).title,'사진첩의 시루');
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
 console.log('PASS: AI notices and museum links, all-stage layouts, firing phases/pause/skip, story pages, editor photo/text persistence, publish and restore.');
}catch(error){
 if(activePage&&!activePage.isClosed()){
  console.error('Workshop diagnostic:',await activePage.evaluate(()=>({stage:document.body.dataset.stage,toast:document.querySelector('#toast')?.textContent,next:document.querySelector('[data-action="next"]')?.outerHTML})).catch(()=>null));
  await mkdir('asset/review',{recursive:true});await activePage.screenshot({path:'asset/review/workshop-failure.png',timeout:10000}).catch(()=>{});
 }
 throw error;
}finally{
 await browser?.close();for(const process of processes)if(process.exitCode===null){const stopped=once(process,'exit');process.kill();await stopped;}
 if(testRoot){const absolute=await realpath(testRoot);if(absolute.startsWith(join(tmpdir(),'togi-editor-check-')))await rm(absolute,{recursive:true,force:true});}
}
