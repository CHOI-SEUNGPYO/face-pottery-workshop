import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';

// A loader is visible before the held module/font requests finish. WebKit's
// font-ready wait would prevent capturing that deliberately incomplete page.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
let browser,page;const errors=[],requests=[],motion=[];
const engine=process.env.TOGI_BROWSER==='webkit'?'webkit':'chromium';
async function assertMotion(selector,pseudo=null,property='transform'){
  const values=await page.evaluate(async({selector,pseudo,property})=>{
    const el=document.querySelector(selector),samples=new Set(),until=performance.now()+3000;
    // A long first paint during scene preparation must still be sampled. The
    // screenshot check below independently verifies motion in rendered pixels.
    do{
      await new Promise(requestAnimationFrame);
      samples.add(getComputedStyle(el,pseudo)[property]);
    }while(samples.size<2&&performance.now()<until);
    return [...samples];
  },{selector,pseudo,property});
  assert.ok(values.length>1,`${selector}${pseudo??''} visibly animates on a touch viewport`);
}
async function assertVisibleMotion(selector){
  const bounds=await page.locator(selector).boundingBox(),viewport=page.viewportSize();
  const clip={x:Math.max(0,bounds.x-10),y:Math.max(0,bounds.y-10),width:0,height:0};
  clip.width=Math.min(viewport.width,bounds.x+bounds.width+10)-clip.x;
  clip.height=Math.min(viewport.height,bounds.y+bounds.height+10)-clip.y;
  const frames=[await page.screenshot({clip})];
  for(let sample=0;sample<3;sample++){
    await page.waitForTimeout(180);
    frames.push(await page.screenshot({clip}));
  }
  const difference=await page.evaluate(async images=>{
    const pixels=await Promise.all(images.map(async data=>{
      const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      return context.getImageData(0,0,canvas.width,canvas.height).data;
    }));
    const changes=pixels.slice(1).map(frame=>{
      let changed=0;
      for(let i=0;i<pixels[0].length;i+=4)
        if(Math.abs(pixels[0][i]-frame[i])+Math.abs(pixels[0][i+1]-frame[i+1])+Math.abs(pixels[0][i+2]-frame[i+2])>18)changed++;
      return changed;
    });
    return{changed:Math.max(...changes),samples:changes,total:pixels[0].length/4};
  },frames.map(frame=>frame.toString('base64')));
  motion.push({selector,...difference});
  assert.ok(difference.changed>30,`${selector} changes rendered pixels, not just CSS values (${JSON.stringify(difference)})`);
}
try{
  browser=engine==='webkit'?await webkit.launch({headless:true}):await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:696},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.resourceType()==='fetch'&&new URL(r.url()).pathname.endsWith('.glb'))requests.push(new URL(r.url()).pathname.split('/').pop());});
  const url=`http://127.0.0.1:${server.httpServer.address().port}`;
  await mkdir('asset/review',{recursive:true});
  let releaseMain,releaseTravel,releaseCharacters;
  let heldMain=new Promise(resolve=>releaseMain=resolve);
  const heldTravel=new Promise(resolve=>releaseTravel=resolve),heldCharacters=new Promise(resolve=>releaseCharacters=resolve);
  await page.route('**/src/main.ts',async route=>{await heldMain;await route.continue();});
  await page.route('**/animations/*.png',async route=>{await heldTravel;await route.continue();});
  await page.route('**/characters/*volume-v2.webp',async route=>{await heldCharacters;await route.continue();});
  await page.goto(url,{waitUntil:'commit'});
  await page.locator('#loading').waitFor({state:'visible'});
  assert.equal(await page.locator('#world').count(),0);
  assert.equal(await page.locator('#loading img').evaluateAll(images=>images.some(i=>i.naturalWidth>0)),false,'initial motion does not depend on decoded images');
  await assertMotion('#loading','::after');
  await assertVisibleMotion('#loading');
  releaseCharacters();
  await page.waitForFunction(()=>document.querySelectorAll('#loading img').length===3&&[...document.querySelectorAll('#loading img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('#world').count(),0,'initial characters render before the game module is ready');
  await assertMotion('#loading .loading-friends img');
  await assertVisibleMotion('#loading .loading-friends');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#loading img').first().evaluate(el=>getComputedStyle(el).animationName),'none','initial motion respects the system accessibility preference before scripts load');
  assert.equal(await page.locator('#loading').evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.screenshot({path:'asset/review/initial-characters.png'});
  releaseMain();await page.locator('#loading').waitFor({state:'detached'});
  const initial=[...requests];
  assert.equal(initial.length,6,'only the five studio models and stand are required at startup');
  assert.ok(initial.every(n=>/^(studio-|craft-|display-stand)/.test(n)),'later environments never block the welcome screen');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('[data-action="help"]').click();
  assert.equal(await page.locator('#reduce-motion').isChecked(),true,'without a game preference the system setting is followed');
  await page.locator('#reduce-motion').uncheck();
  await page.locator('[data-action="close"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('togi-reduced')),'false');
  assert.equal(await page.evaluate(()=>window.togi.world.reduced),false,'the explicit game choice enables motion even when the OS reduces it');
  assert.equal(await page.locator('html').getAttribute('data-motion'),'full');
  await page.locator('[data-action="new"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='body'&&!window.togi.world.transitioning);
  const original=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  await page.evaluate(()=>window.togi.go('inspect'));
  await page.waitForFunction(()=>document.body.dataset.stage==='inspect'&&!window.togi.world.transitioning);
  await page.locator('[data-action="next"]').click();
  await page.locator('#travel').waitFor({state:'visible'});
  assert.ok(await page.locator('#travel .loading-friends').isVisible(),'slow artwork uses the ready character fallback');
  assert.equal(await page.locator('.travel-party').isVisible(),false,'incomplete carrier illustration is never shown');
  await assertMotion('#travel .loading-friends img');
  await assertVisibleMotion('#travel .loading-friends');
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
  await assertMotion('.travel-party');
  await assertMotion('.travel-sprite-sheet');
  await assertVisibleMotion('.travel-party');
  assert.notEqual(await page.locator('.travel-sprite-sheet').evaluate(el=>getComputedStyle(el).animationName),'none','OS reduced motion does not override the explicit game choice');
  await page.screenshot({path:'asset/review/travel-characters.png'});
  await page.locator('#travel').waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>window.__travelDuration>=3500),'travel remains legible after images finish decoding');
  await page.locator('[data-action="help"]').click();
  await page.locator('#reduce-motion').check();
  assert.equal(await page.locator('.travel-sprite-sheet').evaluate(el=>getComputedStyle(el).animationName),'none','the explicit in-game reduced motion option stops the carrier');
  await page.locator('#reduce-motion').uncheck();
  await page.locator('[data-action="close"]').click();
  await page.evaluate(()=>window.togi.go('body'));
  await page.waitForFunction(()=>!window.togi.world.transitioning);
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
  heldMain=new Promise(resolve=>releaseMain=resolve);
  await page.reload({waitUntil:'commit'});
  await page.waitForFunction(()=>[...document.querySelectorAll('#loading img')].length===3&&[...document.querySelectorAll('#loading img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('html').getAttribute('data-motion'),'full','the explicit choice is applied before the game module on reload');
  await assertVisibleMotion('#loading .loading-friends');
  releaseMain();await page.locator('#loading').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.togi.world.reduced),false,'reload preserves the explicit game choice over OS reduced motion');
  assert.ok(!requests.some(n=>n.startsWith('gallery-')),'a saved late-stage work does not delay the welcome screen');
  await page.locator('[data-action="continue"]').click();
  await page.waitForFunction(()=>document.body.dataset.stage==='compare'&&!window.togi.world.transitioning);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),original,'resume preserves the saved artwork');
  await page.locator('[data-action="help"]').click();await page.locator('#reduce-motion').check();
  heldMain=new Promise(resolve=>releaseMain=resolve);
  await page.reload({waitUntil:'commit'});await page.locator('#loading').waitFor({state:'visible'});
  assert.equal(await page.locator('html').getAttribute('data-motion'),'reduced','explicit reduced motion also survives reload before the game module');
  assert.equal(await page.locator('#loading img').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  releaseMain();await page.locator('#loading').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.togi.world.reduced),true,'the saved reduced-motion choice is not reset');
  assert.deepEqual(errors,[]);
  await mkdir('asset/review',{recursive:true});
  await writeFile(`asset/review/loading-check-${engine}.json`,JSON.stringify({engine,initial,requests,motion,status:'pass'},null,2));
  console.log(`PASS (${engine}): rendered mobile motion before scripts/images, animated full carrier, reduced-motion preferences, studio-only startup, loading/retry and preserved resume.`);
}catch(error){
  if(page&&!page.isClosed()){
    const state=await page.evaluate(()=>({stage:document.body.dataset.stage,travelHidden:document.querySelector('#travel')?.hidden,toast:document.querySelector('#toast')?.textContent,next:document.querySelector('[data-action="next"]')?.outerHTML})).catch(()=>null);
    console.error(JSON.stringify({engine,errors,motion,state},null,2));
    await page.screenshot({path:`asset/review/loading-${engine}-failure.png`}).catch(()=>{});
  }
  throw error;
}finally{await browser?.close();await server.close();}
