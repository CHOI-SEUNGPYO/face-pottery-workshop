import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
const url=`http://127.0.0.1:${server.httpServer.address().port}`;
let browser,page;const errors=[];
const settle=async()=>{
  await page.waitForFunction(()=>!window.togi.world.transitioning);
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('.scene-info,.guide-stack,.settings-dock,footer')].flatMap(el=>el.getAnimations()).map(a=>a.finished.catch(()=>{}))));
};
try{
  await mkdir('asset/review',{recursive:true});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:696},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // Observe actual startup lifetime, including cached/quick-load machines.
  await page.addInitScript(()=>{window.__loaderStart=performance.now();new MutationObserver((_,o)=>{if(document.body?.dataset.stage&&!document.querySelector('#loading')){window.__loaderEnd=performance.now();o.disconnect();}}).observe(document,{childList:true,subtree:true});});
  await page.goto(url);await page.locator('#loading').waitFor({state:'detached'});await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>window.__loaderEnd-window.__loaderStart>=880),'loading has a legible minimum duration');
  await page.locator('[data-action="new"]').click();await settle();
  assert.ok(await page.locator('.turn-demonstration').isVisible(),'new artwork immediately teaches rotation');
  await page.locator('[data-action="next"]').click();await settle();
  const range=page.locator('[data-form-range="mouth-width"]');
  const initial=await page.evaluate(()=>({radius:window.togi.save.document.mouth.innerRadius,height:window.togi.save.document.mouth.center[1]}));
  const rect=await range.boundingBox();await range.focus();await range.press('End');await settle();
  const expanded=await page.evaluate(()=>({radius:window.togi.save.document.mouth.innerRadius,height:window.togi.save.document.mouth.center[1]}));
  assert.ok(expanded.radius>initial.radius*2);assert.equal(expanded.height,initial.height);
  assert.deepEqual(await range.boundingBox(),rect,'mouth controls do not fall down when widened');
  await page.screenshot({path:'asset/review/mouth-fixed-controls.png'});
  await page.locator('[data-action="undo"]').click();
  // Subscribe before entering: a slow click acknowledgement can arrive after
  // an early face has already been rendered on a software-GPU runner.
  await page.evaluate(()=>{
    const w=window.togi.world,doc=window.togi.save.document,revision=doc.revision,xyz=Array.from(doc.outerXYZ),rotation=window.togi.save.rotation;
    const aspects=new Set();let started=false,start;
    window.__tourResult=new Promise(resolve=>{const tick=()=>{
      if(w.demonstratingFaces){if(!started){started=true;start=w.faceAspect;}aspects.add(w.faceAspect);}
      if(started&&!w.demonstratingFaces)resolve({aspects:[...aspects].sort(),start,end:w.faceAspect,unchanged:revision===doc.revision&&xyz.every((n,i)=>n===doc.outerXYZ[i])&&rotation===window.togi.save.rotation});
      else requestAnimationFrame(tick);
    };requestAnimationFrame(tick);});
  });
  await page.locator('[data-action="next"]').click();
  await page.setViewportSize({width:390,height:680});
  assert.ok(await page.evaluate(()=>window.togi.world.demonstratingFaces),'mobile browser resize does not cancel the tour');
  const tour=await page.evaluate(()=>window.__tourResult);
  await page.setViewportSize({width:390,height:696});await settle();
  assert.deepEqual(tour.aspects,[1,2,3]);assert.equal(tour.end,tour.start);assert.ok(tour.unchanged);
  assert.ok(await page.locator('.turn-demonstration').isVisible(),'gesture cue stays until a real rotation');
  const delayed=await page.evaluate(async()=>{
    const w=window.togi.world;w.startFaceTour();
    w.faceTour.start=performance.now()-5000;w.faceTour.last=w.faceTour.start;
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const elapsed=w.faceTour?.elapsed;w.stopFaceTour();return elapsed;
  });
  assert.ok(delayed>0&&delayed<=230,'a five-second delayed frame cannot skip a face');
  const touch=await context.newCDPSession(page);
  const draw=async points=>{
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
    for(const p of points.slice(1))await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const area=await page.locator('.work-area').boundingBox(),cx=area.x+area.width/2,cy=area.y+area.height*.42;
  assert.equal(await page.locator('[data-action="draw-round"]').getAttribute('aria-pressed'),'true');
  await draw([{x:cx-32,y:cy-17},{x:cx-12,y:cy-9},{x:cx+12,y:cy+6},{x:cx+32,y:cy+17}]);
  assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),1,'finger drag makes an ellipse');
  assert.equal(await page.locator('.refine-nudge').count(),1);
  await page.screenshot({path:'asset/review/touch-hole-tools.png'});
  const rough=await page.evaluate(()=>JSON.stringify(window.togi.save.document.features));
  await page.locator('[data-tool="refine"]').click();await settle();
  assert.equal(await page.locator('.refine-nudge').count(),1,'selecting the tool does not dismiss the refinement reminder');
  await page.evaluate(()=>{
    const outline=document.querySelector('#opening-outline');
    window.__feedbackCleared=new Promise((resolve,reject)=>{
      let started;
      const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Refinement outline did not clear'));},10000);
      const observer=new MutationObserver(()=>{
        if(outline.dataset.state==='finished'&&started===undefined)started=performance.now();
        if(started!==undefined&&outline.style.display==='none'){
          clearTimeout(timeout);observer.disconnect();resolve({duration:performance.now()-started,path:outline.querySelector('path').getAttribute('d')});
        }
      });observer.observe(outline,{attributes:true,childList:true,subtree:true});
    });
  });
  await draw([{x:cx,y:cy},{x:cx+9,y:cy+4},{x:cx+19,y:cy+7},{x:cx+5,y:cy+1}]);
  assert.notEqual(await page.evaluate(()=>JSON.stringify(window.togi.save.document.features)),rough,'rubbing the opening refines it');
  assert.equal(await page.locator('.refine-nudge').count(),0,'successful refinement clears the reminder');
  const feedback=await page.evaluate(()=>window.__feedbackCleared);
  assert.ok(feedback.duration<650,`refinement glow clears promptly (${feedback.duration}ms)`);
  assert.equal(feedback.path,null,'completed refinement leaves no screen-space outline');
  await page.locator('[data-action="undo"]').click();assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document.features)),rough,'one rub is one undo');
  await page.locator('[data-action="undo"]').click();
  await page.locator('[data-tool="carve"]').click();
  await page.locator('[data-action="draw-opening"]').click();
  const loop=Array.from({length:27},(_,i)=>{const a=i/28*Math.PI*2;return{x:cx+27*Math.cos(a),y:cy+27*Math.sin(a)};});
  await draw(loop);assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),1,'near-closed finger drawing is accepted');
  const artwork=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  await page.evaluate(()=>window.togi.world.startFaceTour());
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:20,y:cy,id:1}]});
  assert.equal(await page.evaluate(()=>window.togi.world.demonstratingFaces),false,'touch interrupts the demo immediately');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await draw([{x:20,y:cy},{x:40,y:cy},{x:65,y:cy}]);
  assert.equal(await page.locator('.turn-demonstration').isVisible(),false,'actual rotation dismisses the cue');
  await page.locator('[data-action="help"]').click();await page.locator('[data-action="turn-guide"]').click();
  assert.ok(await page.locator('.turn-demonstration').isVisible(),'help replays the demonstration');
  await page.evaluate(()=>window.togi.go('compare'));await settle();
  assert.ok(await page.locator('.gallery-disclosure').textContent().then(t=>t.includes('AI가 게임 도구로 만든')));
  const own=await page.evaluate(()=>JSON.stringify(window.togi.save.document));assert.equal(own,artwork);
  await page.screenshot({path:'asset/review/ai-game-example-mobile.png'});
  assert.equal(await page.locator('#reference-example').count(),0,'gallery offers only the game-authored example');
  assert.equal(await page.evaluate(()=>window.togi.world.referenceArtifact.children.length),1);
  await page.evaluate(()=>window.togi.world.rotateArtifact('reference',100));await settle();
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),artwork,'turning the AI example never changes the player artwork');
  await page.setViewportSize({width:1366,height:768});await settle();
  await page.screenshot({path:'asset/review/ai-game-example-desktop.png'});
  await page.evaluate(()=>{window.togi.world.reduced=true;document.body.classList.add('reduced-motion');});
  await page.evaluate(()=>window.togi.go('faces'));await settle();
  await page.locator('[data-action="help"]').click();await page.locator('[data-action="turn-guide"]').click();
  assert.ok(await page.locator('.turn-demonstration').isVisible(),'reduced motion keeps a static gesture hint');
  assert.equal(await page.locator('.turn-demonstration i').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.evaluate(()=>window.togi.world.demonstratingFaces),false);
  assert.deepEqual(errors,[]);
  await writeFile('asset/review/guidance-check.json',JSON.stringify({tour,initial,expanded,feedback,status:'pass'},null,2));
  console.log('PASS: stable mouth controls, three-face tour, touch ellipse/closure/refinement, AI example and saved-art isolation.');
}catch(error){await page?.screenshot({path:'asset/review/guidance-failure.png'});throw error;}
finally{await browser?.close();await server.close();}
