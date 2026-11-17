import assert from 'node:assert/strict';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

// A focused deployed-build check. Full real-control play is check:mobile.
// Every save below belongs to this disposable browser, never the user's browser.
const url=process.argv[2]??'https://choi-seungpyo.github.io/face-pottery-workshop/';
const report={url,files:[],errors:[],requests:[],viewport:{width:390,height:696}};
await mkdir('asset/review',{recursive:true});
const localHTML=await readFile('dist/index.html','utf8');
const response=await fetch(url,{cache:'no-store'});assert.equal(response.status,200);
const html=await response.text();
const exampleAsset=(await readdir('dist/assets')).find(name=>/^user-pottery\.togi-.*\.json$/.test(name));
assert.ok(exampleAsset,'build includes the separately stored user example');
for(const path of [...localHTML.match(/\.\/assets\/index-[^"']+\.(?:js|css)/g),'./museum/catalog.json',`./assets/${exampleAsset}`]){
  if(path.startsWith('./assets/index-'))assert.ok(html.includes(path),`published HTML uses ${path}`);
  const local=await readFile(`dist/${path}`),res=await fetch(new URL(path,url));assert.equal(res.status,200);
  const remote=Buffer.from(await res.arrayBuffer());assert.ok(local.equals(remote),`published bytes match ${path}`);
  report.files.push({path,sha256:createHash('sha256').update(remote).digest('hex')});
}
const browser=await chromium.launch({channel:'msedge',headless:true});let page;
try{
  const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:2,hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))report.requests.push({url:r.url(),error:r.failure()});});
  const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  await page.goto(url);await page.locator('#loading').waitFor({state:'detached'});await page.evaluate(()=>document.fonts.ready);
  await page.locator('.welcome-artifact img').evaluate(i=>i.decode());
  assert.match(await page.locator('.welcome-purpose').textContent(),/얼굴모양토기.*눈과 입/s);
  assert.ok(await page.locator('.welcome-path').isVisible());
  await page.screenshot({path:'asset/review/release-purpose-welcome.png'});
  await page.locator('[data-action="example-artwork"]').click();
  const exampleCanvas=page.locator('.example-viewer canvas');await exampleCanvas.waitFor();
  assert.match(await page.locator('.example-caption').textContent(),/게임을 만든 사람.*빚어.*복원품은 아니/s);
  const exampleBefore=await exampleCanvas.screenshot();
  await exampleCanvas.press('ArrowRight');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.notDeepEqual(await exampleCanvas.screenshot(),exampleBefore,'published example responds to rotation');
  await page.screenshot({path:'asset/review/release-user-example.png'});
  await page.locator('.example-viewer [data-action="close"]').click();
  report.userExampleRotation=true;
  await page.locator('[data-action="help"]').click();await page.locator('#reduce-motion').uncheck();
  await page.locator('[data-action="close"]').click();
  await page.reload();await page.locator('#loading').waitFor({state:'detached'});
  assert.equal(await page.locator('html').getAttribute('data-motion'),'full','published build retains the game motion choice over the OS setting');
  await page.locator('[data-action="new"]').click();await settle();
  await page.locator('.body-demonstration').waitFor({state:'visible'});
  report.bodyMotion=await page.locator('.body-guide-trace').evaluate(async el=>{
    const paths=new Set(),end=performance.now()+650;
    do{paths.add(el.getAttribute('d'));await new Promise(requestAnimationFrame);}while(performance.now()<end);
    return paths.size;
  });
  assert.ok(report.bodyMotion>3,'published body contour demonstrates sculpting');
  await page.screenshot({path:'asset/review/release-body-guidance.png'});
  await page.locator('.body-demonstration').waitFor({state:'detached'});
  assert.ok(await page.locator('.turn-demonstration').isVisible());
  assert.equal(await page.locator('.turn-demonstration i').count(),1);
  assert.equal(await page.locator('.turn-demonstration span').textContent(),'빈 곳을 끌어 돌려요');
  await page.locator('[data-action="next"]').click();await settle();
  await page.evaluate(()=>{
    window.__faces=new Set();
    new MutationObserver(()=>{const face=document.querySelector('[data-face].active')?.dataset.face;if(face)window.__faces.add(face);}).observe(document.querySelector('#hud'),{childList:true,subtree:true,attributes:true});
  });
  await page.locator('[data-action="next"]').click();
  await page.waitForFunction(()=>window.__faces.size===3&&document.querySelector('[data-face].active')?.dataset.face==='1');
  assert.ok(await page.locator('.turn-demonstration').isVisible(),'gesture hint outlasts the automatic tour');
  assert.equal(await page.locator('[data-action="draw-opening"]').getAttribute('aria-pressed'),'true','published build defaults to free drawing');
  assert.equal(await page.locator('[data-action="draw-round"]').count(),0,'published build has no drag-to-pierce mode');
  const area=await page.locator('.work-area').boundingBox(),cx=area.x+area.width/2,cy=area.y+area.height*.42;
  const touch=await context.newCDPSession(page);
  const ellipse=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2;return{x:cx+28*Math.cos(a),y:cy+15*Math.sin(a),id:1};});
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[ellipse[0]]});
  for(const point of ellipse.slice(1))await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  // Successful cutting reveals the refinement prompt in the production UI.
  // Developer-only geometry hooks are intentionally absent from this build.
  await page.locator('.refine-nudge').waitFor();await page.locator('[data-tool="refine"]').click();await settle();
  assert.ok(await page.locator('.refine-nudge').isVisible());
  await page.screenshot({path:'asset/review/release-touch-guidance.png'});
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+8,y:cy+4,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>!document.querySelector('.refine-nudge'));
  await page.locator('#opening-outline').waitFor({state:'hidden',timeout:1500});
  assert.equal(await page.locator('#opening-outline path').first().getAttribute('d'),null,'published refinement clears its outline');
  await page.locator('[data-tool="carve"]').click();await page.locator('[data-action="draw-line"]').click();
  await page.locator('#line-width').focus();await page.locator('#line-width').press('End');
  assert.equal(await page.locator('#line-width').inputValue(),'5');
  const lineArea=await page.locator('.work-area').boundingBox(),lineX=lineArea.x+lineArea.width/2,lineY=lineArea.y+lineArea.height*.64;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:lineX-24,y:lineY,id:1}]});
  for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:lineX-24+i*4,y:lineY,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('togi-workshop-v2',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{resolve(q.result.document.features.some(f=>f.kind==='groove'&&f.strokeWidth===.02));db.close();};};}));
  report.lineWidthSaved=true;
  await page.locator('[data-action="next"]').click();await settle();
  await page.locator('[data-action="next"]').click();
  await page.locator('#travel.art-ready').waitFor({state:'visible'});
  const travelFrames=await page.locator('.travel-sprite-sheet').evaluate(async el=>{
    const frames=new Set(),end=performance.now()+400;
    do{frames.add(getComputedStyle(el).transform);await new Promise(requestAnimationFrame);}while(performance.now()<end);
    return frames.size;
  });
  assert.ok(travelFrames>1,'published carrier frames advance after reduced motion is switched off');
  await page.waitForFunction(()=>document.body.dataset.stage==='firing'&&document.querySelector('#travel').hidden);await settle();
  assert.equal(await page.locator('[data-action="kiln-inside"]').count(),0,'published kiln has no manual inside-view button');
  await page.screenshot({path:'asset/review/release-firing-no-manual-view.png'});
  const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const r=indexedDB.open('togi-workshop-v2',1);r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite'),store=t.objectStore('state'),q=store.get('current');let artwork;
      q.onsuccess=()=>{const s=q.result;artwork=JSON.stringify(s.document);s.stage='excavation';s.firedRevision=s.document.revision;s.assembledRevision=s.document.revision;store.put(s,'current');};
      t.oncomplete=()=>{db.close();resolve(artwork);};t.onerror=()=>reject(t.error);
    };
  }));
  await page.reload();await page.locator('#loading').waitFor({state:'detached'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='excavation'&&document.querySelector('#travel').hidden);await settle();
  assert.equal(await page.locator('.story-dock').getAttribute('aria-label'),'발굴 이야기');
  await page.locator('.story-teaser').click();
  await page.locator('.story-photo img').evaluate(i=>i.decode());
  assert.match(await page.locator('.story-photo img').getAttribute('src'),/sowol-pit-2019/);
  for(const image of await page.locator('.story-inline-photo img').all()){
    await image.scrollIntoViewIfNeeded();await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await image.elementHandle());
  }
  assert.match(await page.locator('.story-copy').textContent(),/발굴조사보고서/);
  await page.locator('.story-copy').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:'asset/review/release-excavation-story.png'});
  await page.locator('.modal-close').click();
  await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('togi-workshop-v2',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite'),store=t.objectStore('state'),q=store.get('current');q.onsuccess=()=>{const s=q.result;s.stage='compare';store.put(s,'current');};t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};}));
  await page.reload();await page.locator('#loading').waitFor({state:'detached'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='compare'&&document.querySelector('#travel').hidden);await settle();
  assert.match(await page.locator('.gallery-disclosure').textContent(),/AI가 게임 도구로 만든.*투각인면문옹형토기/s);
  await page.screenshot({path:'asset/review/release-gallery.png'});
  await page.locator('[data-action="next"]').click();await settle();
  assert.equal(await page.getAttribute('body','data-stage'),'ending');assert.equal(await page.locator('.photo-editor').count(),0);
  await page.locator('[data-action="photo"]').click();
  assert.match(await page.locator('.photo-editor h2').textContent(),/내 작품/);
  assert.match(await page.locator('.photo-status').textContent(),/내 작품만/);
  assert.match(await page.locator('.photo-status').textContent(),/케이스/);
  const photoCanvas=page.locator('.photo-editor canvas');
  await page.evaluate(()=>document.fonts.ready);
  const photoBefore=await photoCanvas.evaluate(c=>c.toDataURL());
  const photoBox=await photoCanvas.boundingBox();
  await page.mouse.move(photoBox.x+photoBox.width*.5,photoBox.y+photoBox.height*.45);await page.mouse.down();
  await page.mouse.move(photoBox.x+photoBox.width*.68,photoBox.y+photoBox.height*.45,{steps:12});await page.mouse.up();
  assert.notEqual(await photoCanvas.evaluate(c=>c.toDataURL()),photoBefore,'published photo preview responds to rotation');
  await page.screenshot({path:'asset/review/release-own-work-photo.png'});
  await page.locator('.modal-close').click();
  await page.locator('[data-action="ending-credits"]').click();
  assert.match(await page.locator('.artifact-label').textContent(),/透刻人面文甕形土器/);
  const visit=page.locator('.museum-ending .museum-visit');
  assert.match(await visit.textContent(),/경산시립박물관에서 만나 보세요/);
  for(const viewport of [{width:320,height:568},{width:768,height:1024},report.viewport]){
    await page.setViewportSize(viewport);await visit.scrollIntoViewIfNeeded();
    const box=await visit.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width,'museum visit invitation fits the screen');
    assert.equal(await visit.locator('a').getAttribute('href'),'https://www.gbgs.go.kr/museum/main.do');
    assert.equal(await visit.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  }
  await page.screenshot({path:'asset/review/release-museum-visit.png'});
  await page.locator('[data-action="collection-face"]').click();
  await page.locator('.album-image img').evaluate(i=>i.decode());
  assert.ok(await page.locator('.album-info .museum-visit').count());
  await page.locator('.artifact-label').scrollIntoViewIfNeeded();
  await page.screenshot({path:'asset/review/release-academic-label.png'});
  await page.locator('[data-action="album-back"]').click();await page.locator('.ending-actions [data-action="close"]').click();
  await page.screenshot({path:'asset/review/release-ending-complete.png'});
  await page.locator('footer [data-action="finish-home"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='welcome');await settle();
  assert.equal(await page.getAttribute('body','data-stage'),'welcome');
  await page.reload();await page.locator('#loading').waitFor({state:'detached'});
  await page.locator('[data-action="continue"]').click();await settle();
  await page.waitForFunction(()=>document.body.dataset.stage==='ending'&&document.querySelector('#travel').hidden);
  await page.locator('[data-action="ending-credits"]').click();
  await page.locator('.ending-actions [data-action="finish-home"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='welcome');await settle();
  assert.equal(await page.getAttribute('body','data-stage'),'welcome');
  assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
  const after=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('togi-workshop-v2',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{db.close();resolve(JSON.stringify(q.result.document));};};}));
  assert.equal(after,saved);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
  const desktop=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
  page=await desktop.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(url);await page.locator('#loading').waitFor({state:'detached'});await page.locator('[data-action="new"]').click();await settle();
  const readDoc=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('togi-workshop-v2',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{db.close();resolve(q.result.document);};};}));
  for(const [key,fraction] of [['width',.8],['height',.85]]){
    const range=page.locator(`[data-form-range="${key}"]`),rect=await range.boundingBox();
    const current=await range.evaluate(el=>(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min)));
    await page.mouse.move(rect.x+8+(rect.width-16)*current,rect.y+rect.height/2);await page.mouse.down();
    await page.mouse.move(rect.x+8+(rect.width-16)*fraction,rect.y+rect.height/2,{steps:12});await page.mouse.up();
    await page.waitForFunction(()=>!document.querySelector('[data-action="undo"]').disabled);
    const doc=await readDoc();
    if(key==='width')report.sliderWidth=doc.form.width;
    else{assert.equal(doc.form.width,report.sliderWidth,'published height slider preserves width');assert.ok(doc.form.height>1.3);}
  }
  await page.locator('[data-action="next"]').click();await settle();await page.locator('[data-action="next"]').click();await settle();
  assert.equal(await page.locator('.drawing-actions>summary').isVisible(),false);assert.ok(await page.locator('[data-tool="refine"]').isVisible());
  await page.locator('.story-teaser').click();
  assert.equal(await page.locator('[data-action="story-next"]').count(),0);assert.ok(await page.locator('.story-section').count()>1);
  const albumButton=page.locator('.story-controls [data-action="collection"]'),position=await albumButton.boundingBox();
  await page.locator('.photo-picker button').last().click();assert.deepEqual(await albumButton.boundingBox(),position);
  await page.locator('.story-copy .museum-visit').scrollIntoViewIfNeeded();assert.deepEqual(await albumButton.boundingBox(),position);
  await page.screenshot({path:'asset/review/release-full-story.png'});assert.deepEqual(report.errors,[]);
  report.status='pass';report.checkedAt=new Date().toISOString();
}catch(error){report.status='failed';report.failure=String(error);await page?.screenshot({path:'asset/review/release-failure.png'});throw error;}
finally{await writeFile('asset/review/release-check.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
