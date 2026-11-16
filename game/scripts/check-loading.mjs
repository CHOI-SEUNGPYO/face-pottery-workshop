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
  await page.goto(url);await page.locator('#loading').waitFor({state:'detached'});
  const initial=[...requests];
  assert.equal(initial.length,6,'only the five studio models and stand are required at startup');
  assert.ok(initial.every(n=>/^(studio-|craft-|display-stand)/.test(n)),'later environments never block the welcome screen');
  await page.locator('[data-action="new"]').click();
  const original=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
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
  console.log('PASS: studio-only startup, scene loading/retry, one AI exhibit and saved late-stage resume.');
}finally{await browser?.close();await server.close();}
