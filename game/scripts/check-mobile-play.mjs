import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

// A fresh player reaches every stage through visible controls, without go() or
// fixture saves. Model reads only verify what the real gestures changed.
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
await server.listen();
let browser,page;
const report={stages:[],errors:[]};
const portrait={width:390,height:696};
async function settled(stage){
  await page.waitForFunction(stage=>document.body.dataset.stage===stage&&
    document.querySelector('#travel').hidden&&!window.togi.world.transitioning,stage);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function audit(stage){
  await settled(stage);
  const result=await page.evaluate(()=>{
    const w=window.togi.world,area=document.querySelector('.work-area').getBoundingClientRect();
    w.pottery.root.updateWorldMatrix(true,false);w.camera.updateMatrixWorld();
    const points=window.togi.save.document.outerXYZ,p=w.camera.position.clone();
    const pot={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for(let i=0;i<points.length;i+=3){
      p.fromArray(points,i).applyMatrix4(w.pottery.root.matrixWorld).project(w.camera);
      const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
      pot.left=Math.min(pot.left,x);pot.right=Math.max(pot.right,x);
      pot.top=Math.min(pot.top,y);pot.bottom=Math.max(pot.bottom,y);
    }
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    const problems=[];
    for(const el of document.querySelectorAll('header,.scene-heading,.action-panel,.settings-dock,.story-dock,footer')){
      if(!el.checkVisibility())continue;
      if(overlap(pot,el.getBoundingClientRect()))problems.push(`pot covered by ${el.className||el.tagName}`);
    }
    for(const el of document.querySelectorAll('#hud button,#hud summary')){
      if(!el.checkVisibility())continue;
      const r=el.getBoundingClientRect();
      if(r.width<43||r.height<43)problems.push(`small target: ${el.getAttribute('aria-label')||el.textContent}`);
      if(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)problems.push(`off-screen target: ${el.textContent}`);
      if(!el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)))problems.push(`covered target: ${el.textContent}`);
    }
    if(document.body.dataset.stage==='body'&&!document.querySelector('.scene-instruction').checkVisibility())problems.push('missing sculpt instruction');
    return {stage:document.body.dataset.stage,width:innerWidth,height:innerHeight,pot,areaHeight:area.height,problems};
  });
  report.stages.push(result);
  console.log(`Mobile play: ${stage} ${result.width}×${result.height}`);
  assert.deepEqual(result.problems,[],`${stage} ${result.width} mobile play layout`);
  return result.pot;
}
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:portrait,deviceScaleFactor:2,hasTouch:true,isMobile:true});
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const touch=await context.newCDPSession(page);
  const path=async points=>{
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
    for(const point of points.slice(1))await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const drag=(a,b,steps=12)=>path(Array.from({length:steps+1},(_,i)=>({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps})));
  // Edge's CDP bridge swallows the first synthetic tap after a touch drag,
  // including on a plain button-only reproduction. Use normal button clicks;
  // shaping, drawing, brushing, placement and rotation remain native touch.
  const activate=selector=>page.locator(selector).click();
  const resize=async(size,stage)=>{
    await page.setViewportSize(size);
    await page.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,size);
    return audit(stage);
  };
  const project=point=>page.evaluate(point=>{const w=window.togi.world,p=w.camera.position.clone().set(...point).project(w.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},point);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await page.locator('#loading').waitFor({state:'detached'});await page.evaluate(()=>document.fonts.ready);
  await activate('[data-action="new"]');await audit('body');
  const initial=await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ));
  const h=await page.locator('[data-form-handle="height"]').boundingBox();
  await drag({x:h.x+h.width/2,y:h.y+h.height/2},{x:h.x+h.width/2,y:h.y+h.height/2-16});
  assert.notDeepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),initial,'touch shaping changes the pot');
  await resize({width:320,height:568},'body');await resize(portrait,'body');
  await activate('[data-action="next"]');await audit('mouth');
  const m=await page.locator('[data-form-range="mouth-width"]').boundingBox();
  await drag({x:m.x+14,y:m.y+m.height/2},{x:m.x+36,y:m.y+m.height/2});
  await activate('[data-action="next"]');const pot=await audit('faces');
  const centre=(pot.left+pot.right)/2,eyeY=pot.top+(pot.bottom-pot.top)*.40;
  await page.touchscreen.tap(centre-30,eyeY);await page.touchscreen.tap(centre+30,eyeY);
  await activate('[data-action="draw-opening"]');
  const mouthY=pot.top+(pot.bottom-pot.top)*.65;
  await path(Array.from({length:49},(_,i)=>({x:centre+24*Math.cos(i*Math.PI/24),y:mouthY+12*Math.sin(i*Math.PI/24)})));
  assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),3,'touch taps and a closed contour create a face');
  await resize({width:740,height:360},'faces');await activate('.drawing-actions>summary');await audit('faces');
  await activate('[data-tool="refine"]');await resize({width:320,height:568},'faces');await resize(portrait,'faces');
  await activate('[data-action="next"]');await audit('inspect');
  assert.ok(await page.locator('[data-action="edit-faces"]').isVisible(),'editing choices are immediately available');
  await activate('[data-action="edit-faces"]');await settled('faces');await activate('[data-action="next"]');await settled('inspect');
  await activate('[data-action="next"]');await audit('firing');await activate('[data-action="next"]');
  await page.waitForFunction(()=>document.querySelector('#firing-phase')?.textContent==='완성',null,{timeout:90000});
  assert.ok(await page.locator('.story-mobile-label').isVisible(),'phone explicitly labels the story entry');
  await activate('.story-teaser');await page.locator('.story-photo img').evaluate(img=>img.decode());
  assert.equal(await page.locator('.story-section').count(),4,'all kiln explanations are present in the mobile reader');
  await mkdir('asset/review',{recursive:true});await page.screenshot({path:'asset/review/story-phone-reader.png'});
  await activate('.modal-close');
  await audit('firing');await activate('[data-action="next"]');await audit('excavation');
  for(let pass=0;pass<6&&await page.locator('[data-action="next"]').isDisabled();pass++)
    // Soil fills the path between touch samples; dense synthetic moves just
    // stall CI's software renderer without exercising another behavior.
    for(const y of [280,310,340,370,400,430])await drag({x:92,y},{x:300,y},16);
  assert.ok(await page.locator('[data-action="next"]').isEnabled(),'finger brushing alone discovers both artifacts');
  await activate('[data-action="next"]');await audit('assembly');
  const poses=await page.evaluate(()=>{const w=window.togi.world,p=w.pottery.root.position;return{from:[p.x,p.y+.48,p.z],to:[0,w.assemblyHeight,0]};});
  const from=await project(poses.from),to=await project(poses.to);
  // Check the lifted pose while the finger is still held, before completion
  // can recenter the camera and hide a brief overlap with the instructions.
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id:1}]});
  for(let i=1;i<=20;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/20,y:from.y+(to.y-from.y)*i/20,id:1}]});
  await audit('assembly');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>window.togi.save.assembledRevision===window.togi.save.document.revision);
  await audit('assembly');await activate('[data-action="next"]');await audit('compare');
  for(const which of ['own','reference']){
    const before=await page.evaluate(which=>{const w=window.togi.world;return (which==='own'?w.pottery.root:w.referenceArtifact).rotation.y;},which);
    const p=await project([which==='own'?-.78:.9,.7,.3]);await drag(p,{x:p.x+35,y:p.y});
    assert.ok(await page.evaluate(({which,before})=>{const w=window.togi.world;return (which==='own'?w.pottery.root:w.referenceArtifact).rotation.y>before+.1;},{which,before}));
  }
  const artwork=await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ));
  await activate('[data-action="next"]');await audit('ending');
  assert.equal(await page.locator('.photo-editor').count(),0);
  await activate('[data-action="ending-credits"]');
  assert.match(await page.locator('.artifact-label').textContent(),/투각인면문옹형토기/);
  await activate('.modal-close');await activate('[data-action="photo"]');await page.locator('.photo-editor canvas').waitFor();await activate('[data-sticker="독이"]');
  const c=await page.locator('.photo-editor canvas').boundingBox();
  await drag({x:c.x+c.width*600/1920,y:c.y+c.height*800/1080},{x:c.x+c.width*.65,y:c.y+c.height*.75});
  const download=page.waitForEvent('download');await activate('[data-photo="download"]');const stream=await(await download).createReadStream();
  const chunks=[];for await(const chunk of stream)chunks.push(chunk);const png=Buffer.concat(chunks);
  assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),1080);
  await activate('[data-action="finish-photo"]');await activate('[data-action="collection-face"]');
  await page.locator('.album-image img').waitFor();await activate('[data-action="album-next"]');await activate('[data-action="album-back"]');
  await activate('.ending-actions [data-action="close"]');await audit('ending');
  assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),artwork,'the finished artwork survives the photo and museum flows');
  assert.deepEqual(report.errors,[]);report.status='pass';
  console.log('PASS: new artwork → touch shaping/drawing → full firing → touch excavation → lift/drop → exhibit rotation → PNG → museum → ending.');
}catch(error){
  await mkdir('asset/review',{recursive:true});await page?.screenshot({path:'asset/review/mobile-play-failure.png'});throw error;
}finally{
  await mkdir('asset/review',{recursive:true});await writeFile('asset/review/mobile-play.json',JSON.stringify(report,null,2));
  await browser?.close();await server.close();
}
