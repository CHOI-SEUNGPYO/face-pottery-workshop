import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
let browser,page;const errors=[],requests=[];
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:696},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.resourceType()==='fetch'&&new URL(r.url()).pathname.endsWith('.glb'))requests.push(new URL(r.url()).pathname.split('/').pop());});
  const url=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('asset/review',{recursive:true});
  let releaseMain,releaseTravel;
  const heldMain=new Promise(resolve=>releaseMain=resolve),heldTravel=new Promise(resolve=>releaseTravel=resolve);
  await page.route('**/src/main.ts',async route=>{await heldMain;await route.continue();});
  await page.route('**/animations/*.png',async route=>{await heldTravel;await route.continue();});
  await page.goto(url,{waitUntil:'commit'});
  await page.waitForFunction(()=>document.querySelectorAll('#loading img').length===3&&[...document.querySelectorAll('#loading img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('#world').count(),0,'initial characters render before the game module is ready');
  await page.screenshot({path:'asset/review/initial-characters.png'});
  releaseMain();await page.locator('#loading').waitFor({state:'detached'});
  const initial=[...requests];
  assert.equal(initial.length,6,'only the five studio models and stand are required at startup');
  assert.ok(initial.every(n=>/^(studio-|craft-|display-stand)/.test(n)),'later environments never block the welcome screen');
  await page.locator('[data-action="new"]').click();
  const original=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  await page.evaluate(()=>window.togi.go('inspect'));
  await page.waitForFunction(()=>!window.togi.world.transitioning);
  await page.locator('[data-action="next"]').click();
  await page.locator('#travel').waitFor({state:'visible'});
  assert.ok(await page.locator('#travel .loading-friends').isVisible(),'slow artwork uses the ready character fallback');
  assert.equal(await page.locator('.travel-party').isVisible(),false,'incomplete carrier illustration is never shown');
  await page.evaluate(()=>{
    const el=document.querySelector('#travel');window.__travelReady=0;
    const observer=new MutationObserver(()=>{
      if(el.classList.contains('art-ready')&&!window.__travelReady)window.__travelReady=performance.now();
      if(el.hidden){window.__travelDuration=performance.now()-window.__travelReady;observer.disconnect();}
    });observer.observe(el,{attributes:true});
  });
  releaseTravel();await page.locator('#travel.art-ready').waitFor({state:'visible'});
  const carrier=await page.locator('.travel-party').boundingBox();
  assert.ok(Math.abs(carrier.width-carrier.height)<1,'carrier sprite frame is square and cannot shrink/crop the characters');
  assert.ok(carrier.y>=0&&carrier.y+carrier.height<=696,'entire character frame fits the phone');
  await page.screenshot({path:'asset/review/travel-characters.png'});
  await page.locator('#travel').waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>window.__travelDuration>=2900),'travel remains legible after images finish decoding');
  await page.evaluate(()=>window.togi.go('body'));
  let release,failed=false;
  const held=new Promise(resolve=>release=resolve);
  await page.route('**/models/gallery-shell-v3.glb',async route=>{
    if(failed){await route.continue();return;}
    failed=true;await held;await route.abort('failed');
  });
  const entering=page.evaluate(()=>window.togi.go('compare'));
  await page.locator('#travel').waitFor({state:'visible'});
  assert.equal(await page.getAttribute('body','data-stage'),'body','the editable stage stays intact until its successor is ready');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),original);
  release();await entering;
  assert.equal(await page.getAttribute('body','data-stage'),'body');
  assert.equal(await page.locator('#travel').isVisible(),false,'failure releases navigation');
  assert.ok((await page.locator('#toast').textContent()).includes('다시 눌러'));
  await page.evaluate(()=>window.togi.go('compare'));
  await page.waitForFunction(()=>document.body.dataset.stage==='compare'&&!window.togi.world.transitioning);
  assert.equal(await page.locator('#reference-example').count(),0);
  assert.equal(await page.evaluate(()=>window.togi.world.referenceArtifact.children.length),1);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),original);
  assert.equal(requests.filter(n=>n==='gallery-shell-v3.glb').length,2,'failed assets retry');
  assert.equal(requests.filter(n=>n==='gallery-fixtures-v3.glb').length,1,'successful and in-flight assets are reused');
  assert.ok(!requests.some(n=>n.startsWith('face-artifact-')),'the old reference model is not downloaded');
  await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('togi-workshop-v2',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>{db.close();resolve(q.result?.stage==='compare');};};}));
  requests.length=0;
  await page.reload();await page.locator('#loading').waitFor({state:'detached'});
  assert.ok(!requests.some(n=>n.startsWith('gallery-')),'a saved late-stage work does not delay the welcome screen');
  await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='compare'&&!window.togi.world.transitioning);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),original,'resume preserves the saved artwork');
  assert.deepEqual(errors,[]);
  await mkdir('asset/review',{recursive:true});
  await writeFile('asset/review/loading-check.json',JSON.stringify({initial,requests,status:'pass'},null,2));
  console.log('PASS: immediate initial characters, image-ready full carrier scene, studio-only startup, loading/retry and preserved resume.');
}finally{await browser?.close();await server.close();}
