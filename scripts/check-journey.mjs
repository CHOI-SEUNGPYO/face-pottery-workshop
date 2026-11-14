import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

// Isolated origins and fresh contexts never read the player's actual artwork.
// Dev-only access supplies fixture state and projects targets; gestures use real pointer events.
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
await server.listen();
let browser;
const settle=page=>page.waitForFunction(()=>!window.togi.world.transitioning);
const go=async(page,stage)=>{await page.evaluate(s=>window.togi.go(s),stage);await settle(page);};
async function drag(page,a,b){
 if(page.viewportSize().width>800){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:20});await page.mouse.up();return;}
 const touch=await page.context().newCDPSession(page);
 try{
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  for(let i=1;i<=20;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/20,y:a.y+(b.y-a.y)*i/20,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await touch.detach();}
}
async function siteState(page){return page.evaluate(()=>{
 const {world:w,save:s}=window.togi;
 return {level:w.terrain.surfaceLevel,ground:w.terrain.heightAt(-1.4,-1),site:w.site.children.length,
  placement:[...w.pottery.root.position],siru:[...w.siru.position],mask:Array.from(s.excavationMask),doc:Array.from(s.document.outerXYZ)};
});}
async function project(page,point){return page.evaluate(point=>{
 const p=window.togi.world.camera.position.clone().set(...point).project(window.togi.world.camera);
 return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
},point);}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const viewport of [{width:1366,height:768},{width:740,height:360}]){
  const context=await browser.newContext({viewport,reducedMotion:'reduce',hasTouch:viewport.width===740});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
   await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="new"]').click();await settle(page);
   const original=await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ));
   const rotation=await page.evaluate(()=>window.togi.save.rotation);
   const area=await page.locator('.work-area').boundingBox();
   const outside={x:area.x+8,y:area.y+8};
   assert.equal(await page.evaluate(p=>!!window.togi.world.hit(p.x,p.y),outside),false);
   await drag(page,outside,{x:outside.x+55,y:outside.y});
   assert.notEqual(await page.evaluate(()=>window.togi.save.rotation),rotation,'background drag rotates');
   assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'background drag never sculpts');
   const handle=page.locator('[data-form-handle="height"]');await handle.focus();await handle.press('ArrowUp');
   assert.notDeepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'body handle edits');
   await page.locator('[data-action="undo"]').click();assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original);
   await go(page,'mouth');
   // Opening is a deliberate action, then width/height handles are directly usable.
   if(!await page.locator('[data-form-handle="mouth-width"]').count())await page.locator('[data-action="open-mouth"]').click();
   const beforeMouth=await page.evaluate(()=>window.togi.save.document.mouth.innerRadius);
   const mouth=page.locator('[data-form-handle="mouth-width"]'),r=await mouth.boundingBox();
   assert.ok(r&&r.y>=0&&r.y+r.height<=viewport.height);
   await drag(page,{x:r.x+r.width/2,y:r.y+r.height/2},{x:r.x+r.width/2+28,y:r.y+r.height/2});
   assert.notEqual(await page.evaluate(()=>window.togi.save.document.mouth.innerRadius),beforeMouth,'mouth drag edits width');
   await page.locator('[data-action="undo"]').click();assert.equal(await page.evaluate(()=>window.togi.save.document.mouth.innerRadius),beforeMouth);

   await go(page,'faces');
   const faceArea=await page.locator('.work-area').boundingBox(),face={x:faceArea.x+faceArea.width/2,y:faceArea.y+faceArea.height/2};
   await page.mouse.click(face.x,face.y);assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),1);
   await page.locator('.drawing-actions summary').click();await page.locator('[data-tool="pierce"]').click();
   await page.mouse.click(face.x,face.y);assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),1,'different tools reject actual overlap');
   assert.ok((await page.locator('#toast').textContent()).includes('겹치는'));
   await page.mouse.click(face.x,face.y-50);assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),2,'separated holes remain allowed');
   await page.locator('[data-action="undo"]').click();await page.locator('[data-action="undo"]').click();

   await page.evaluate(()=>{window.togi.save.rotation=0;});await go(page,'excavation');
   const buried=await siteState(page);assert.ok(buried.site>0);assert.ok(Math.abs(buried.ground-buried.level)<.003);
   const start=await project(page,[-.5,buried.level,.2]),end=await project(page,[.45,buried.level,.2]);
   await drag(page,start,end);
   const dug=await siteState(page);assert.ok(dug.mask.some(n=>n>0),'real pointer drag digs soil');
   assert.ok(await page.evaluate(()=>window.togi.world.terrain.heightAt(0,.2)<window.togi.world.terrain.surfaceLevel-.03),'stroke lowers the surface');
   assert.equal(dug.ground,buried.ground,'remote soil stays flat');
   if(process.env.TOGI_REVIEW==='1'){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/dug-${viewport.width}.png`});}
   // Resume assembly in a freshly created World, without entering excavation first.
   await go(page,'assembly');const assembly=await siteState(page);
   await page.reload();await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="continue"]').click();await settle(page);
   assert.equal(await page.locator('body').getAttribute('data-stage'),'assembly');assert.deepEqual(await siteState(page),assembly,'assembly resume restores the same site and mask');
   await page.locator('[data-action="place"]').click();const placed=await siteState(page);
   assert.ok(Math.abs(placed.placement[1]-placed.siru[1]-.61)<1e-8,'pot rests at the steamer height');
   await page.reload();await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="continue"]').click();await settle(page);
   assert.deepEqual(await siteState(page),placed,'placed assembly also resumes');
   if(process.env.TOGI_REVIEW==='1')await page.screenshot({path:`asset/review/assembly-${viewport.width}.png`});
   await go(page,'compare');await page.locator('[data-action="next"]').click();
   for(const name of ['경산이','독이','압이'])await page.locator(`[data-sticker="${name}"]`).click();
   const bounds=await page.locator('.photo-actions').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height,'photo save controls fit');
   await page.locator('[data-photo="size"]').fill('330');await page.locator('[data-photo="angle"]').fill('30');
   if(process.env.TOGI_REVIEW==='1')await page.screenshot({path:`asset/review/photo-${viewport.width}.png`});
   const download=page.waitForEvent('download');await page.locator('[data-photo="download"]').click();const file=await download;
   const stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const png=Buffer.concat(chunks);
   assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),1080);
   assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),placed.doc,'photo editing preserves pottery');
   await page.locator('[data-action="finish-photo"]').click();
   assert.equal(await page.locator('body').getAttribute('data-stage'),'ending','photo editor leads to the completed artwork');
   assert.deepEqual(errors,[]);
  }catch(error){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/journey-${viewport.width}-failure.png`});throw error;}
  finally{await context.close();}
 }
 console.log('PASS: background rotation, body/mouth handles, pointer excavation, assembly resume, small-screen photo controls and PNG dimensions.');
}finally{await browser?.close();await server.close();}
