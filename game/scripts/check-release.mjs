import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
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
for(const path of [...localHTML.match(/\.\/assets\/index-[^"']+\.(?:js|css)/g),'./museum/catalog.json']){
  if(path.includes('/assets/'))assert.ok(html.includes(path),`published HTML uses ${path}`);
  const local=await readFile(`dist/${path}`),res=await fetch(new URL(path,url));assert.equal(res.status,200);
  const remote=Buffer.from(await res.arrayBuffer());assert.ok(local.equals(remote),`published bytes match ${path}`);
  report.files.push({path,sha256:createHash('sha256').update(remote).digest('hex')});
}
const browser=await chromium.launch({channel:'msedge',headless:true});let page;
try{
  const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:2,hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
  page=await context.newPage();page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))report.requests.push({url:r.url(),error:r.failure()});});
  const settle=()=>page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  await page.goto(url);await page.locator('#loading').waitFor({state:'detached'});await page.evaluate(()=>document.fonts.ready);
  await page.locator('[data-action="new"]').click();await settle();
  assert.ok(await page.locator('.turn-demonstration').isVisible());
  await page.locator('[data-action="next"]').click();await settle();
  await page.evaluate(()=>{
    window.__faces=new Set();
    new MutationObserver(()=>{const face=document.querySelector('[data-face].active')?.dataset.face;if(face)window.__faces.add(face);}).observe(document.querySelector('#hud'),{childList:true,subtree:true,attributes:true});
  });
  await page.locator('[data-action="next"]').click();
  await page.waitForFunction(()=>window.__faces.size===3&&document.querySelector('[data-face].active')?.dataset.face==='1');
  assert.ok(await page.locator('.turn-demonstration').isVisible(),'gesture hint outlasts the automatic tour');
  assert.equal(await page.locator('[data-action="draw-round"]').getAttribute('aria-pressed'),'true');
  const area=await page.locator('.work-area').boundingBox(),cx=area.x+area.width/2,cy=area.y+area.height*.42;
  const touch=await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-28,y:cy-15,id:1}]});
  for(const t of [.25,.5,.75,1])await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-28+56*t,y:cy-15+30*t,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.locator('.refine-nudge').waitFor();await page.locator('[data-tool="refine"]').click();await settle();
  assert.ok(await page.locator('.refine-nudge').isVisible());
  await page.screenshot({path:'asset/review/release-touch-guidance.png'});
  const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const r=indexedDB.open('togi-workshop-v2',1);r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,t=db.transaction('state','readwrite'),store=t.objectStore('state'),q=store.get('current');let artwork;
      q.onsuccess=()=>{const s=q.result;artwork=JSON.stringify(s.document);s.stage='compare';s.firedRevision=s.document.revision;s.assembledRevision=s.document.revision;store.put(s,'current');};
      t.oncomplete=()=>{db.close();resolve(artwork);};t.onerror=()=>reject(t.error);
    };
  }));
  await page.reload();await page.locator('#loading').waitFor({state:'detached'});await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='compare'&&document.querySelector('#travel').hidden);await settle();
  assert.match(await page.locator('.gallery-disclosure').textContent(),/AI가 게임 도구로 만든.*투각인면문옹형토기/s);
  await page.screenshot({path:'asset/review/release-gallery.png'});
  await page.locator('[data-action="next"]').click();await settle();
  assert.equal(await page.getAttribute('body','data-stage'),'ending');assert.equal(await page.locator('.photo-editor').count(),0);
  await page.locator('[data-action="ending-credits"]').click();
  assert.match(await page.locator('.artifact-label').textContent(),/透刻人面文甕形土器/);
  await page.locator('[data-action="collection-face"]').click();
  await page.locator('.album-image img').evaluate(i=>i.decode());
  await page.locator('.artifact-label').scrollIntoViewIfNeeded();
  await page.screenshot({path:'asset/review/release-academic-label.png'});
  await page.locator('[data-action="album-back"]').click();await page.locator('.ending-actions [data-action="close"]').click();
  const after=await page.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('togi-workshop-v2',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{db.close();resolve(JSON.stringify(q.result.document));};};}));
  assert.equal(after,saved);assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
  report.status='pass';report.checkedAt=new Date().toISOString();
}catch(error){report.status='failed';report.failure=String(error);await page?.screenshot({path:'asset/review/release-failure.png'});throw error;}
finally{await writeFile('asset/review/release-check.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
