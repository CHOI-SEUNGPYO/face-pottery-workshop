import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {checkMuseumEnding} from './museum-checks.mjs';

// Isolated origins and fresh contexts never read the player's actual artwork.
// Dev-only access supplies fixture state and projects targets; gestures use real pointer events.
const sizes=[{width:1366,height:768},{width:740,height:360},{width:390,height:844}];
const requested=process.env.TOGI_JOURNEY_WIDTH??'all';
const viewports=requested==='all'?sizes:sizes.filter(v=>String(v.width)===requested);
assert.ok(viewports.length,'TOGI_JOURNEY_WIDTH must be all, 1366, 740 or 390');
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
await server.listen();
let browser;
const settle=page=>page.waitForFunction(()=>!window.togi.world.transitioning);
const go=async(page,stage)=>{console.log(`Journey ${page.viewportSize().width}: ${stage}`);await page.evaluate(s=>window.togi.go(s),stage);await settle(page);};
async function drag(page,a,b){
 if(page.viewportSize().width>800){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:20});await page.mouse.up();return;}
 const touch=await page.context().newCDPSession(page);
 try{
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  for(let i=1;i<=20;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/20,y:a.y+(b.y-a.y)*i/20,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await touch.detach();}
}
async function pinch(page,point){
 const session=await page.context().newCDPSession(page);
 const a={x:point.x,y:point.y,id:1},b={x:point.x+40,y:point.y,id:2};
 try{
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,x:a.x+10}]});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,x:a.x+10},b]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...a,x:a.x-15,y:a.y+25},{...b,x:b.x+35,y:b.y+25}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await session.detach();}
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
async function assertPhotoDisclosure(page,png){
 const difference=await page.evaluate(async url=>{
 let canvas=document.querySelector('.photo-editor canvas');
 if(url){const image=new Image();image.src=url;await image.decode();canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;canvas.getContext('2d').drawImage(image,0,0);}
 const data=canvas.getContext('2d').getImageData(0,1008,1920,72).data;
 let ink=0;for(let i=0;i<data.length;i+=4){if(data[i+3]!==255)throw Error('Disclosure must have an opaque background');if(data[i]>150)ink++;}
 if(ink<1000)throw Error('Disclosure text missing from the image');
 const baseline=window.__photoDisclosurePixels;
 if(!baseline){window.__photoDisclosurePixels=data.slice();return {maximum:0,mean:0};}
 let maximum=0,total=0;
 for(let i=0;i<data.length;i++){const delta=Math.abs(data[i]-baseline[i]);maximum=Math.max(maximum,delta);total+=delta;}
 return {maximum,mean:total/data.length};
 },png?`data:image/png;base64,${png.toString('base64')}`:null);
 // Chromium can switch from GPU to CPU after repeated canvas readback.
 // Measured text-edge rounding differs by at most 2/255; covered text differs far more.
 assert.ok(difference.maximum<=2&&difference.mean<.1,`photo disclosure remains visible: ${JSON.stringify(difference)}`);
}
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const viewport of viewports){
  console.log(`Journey ${viewport.width}: loading`);
  const mobile=viewport.width<800;
  const context=await browser.newContext({viewport,reducedMotion:'reduce',hasTouch:mobile,isMobile:mobile,deviceScaleFactor:mobile?2:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
   await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="new"]').click();await settle(page);
   const original=await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ));
   await page.locator('[data-action="help"]').click();
   await page.locator('[data-action="credits"]').click();
   assert.ok(await page.locator('.credits-copy .museum-home-link').isVisible());
   await page.locator('[data-action="close"]').click();
   assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'opening and closing AI credits preserves the artwork');
   const rotation=await page.evaluate(()=>Array.from(window.togi.world.camera.position));
   const faceBefore=await project(page,[0,.70,.33]);
   const area=await page.locator('.work-area').boundingBox();
   const outside={x:area.x+8,y:area.y+8};
   assert.equal(await page.evaluate(p=>!!window.togi.world.hit(p.x,p.y),outside),false);
   await drag(page,outside,{x:outside.x+55,y:outside.y});
   assert.ok((await project(page,[0,.70,.33])).x>faceBefore.x+2,'the visible front surface follows a rightward camera drag');
   assert.notDeepEqual(await page.evaluate(()=>Array.from(window.togi.world.camera.position)),rotation,'background drag orbits');
   assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'background drag never sculpts');
   if(viewport.width<800){
    const centre={x:area.x+area.width/2-20,y:area.y+area.height/2};
    const zoom=await page.evaluate(()=>window.togi.world.zoom);
    await pinch(page,centre);
    assert.ok(await page.evaluate(()=>window.togi.world.zoom)>zoom,'two fingers zoom');
    assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'a second finger cancels a pending sculpt');
    await page.evaluate(()=>window.togi.world.setView('stage'));await settle(page);
   }
   if(process.env.TOGI_REVIEW==='1')await page.screenshot({path:`asset/review/body-${viewport.width}.png`});
   const handle=page.locator('[data-form-handle="height"]');await handle.focus();await handle.press('ArrowUp');
   assert.notDeepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'body handle edits');
   await page.locator('[data-action="undo"]').click();assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original);
   const edge=await page.evaluate(()=>{
    const w=window.togi.world,r=document.querySelector('.work-area').getBoundingClientRect();
    const p=w.camera.position.clone().set(0,.65,0).project(w.camera),y=(1-p.y)*innerHeight/2;
    let right=0;for(let x=r.left;x<r.right;x+=1)if(w.hit(x,y,false,true))right=x;
    return {x:right+4,y};
   });
   const edgeCamera=await page.evaluate(()=>[...window.togi.world.camera.position]);
   assert.equal(await page.evaluate(p=>!!window.togi.world.hit(p.x,p.y,false,true),edge),false,'outline grip starts just outside the clay');
   await drag(page,edge,{x:edge.x+18,y:edge.y});
   assert.notDeepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),original,'grabbing near the visible outline reshapes the pot');
   assert.deepEqual(await page.evaluate(()=>[...window.togi.world.camera.position]),edgeCamera,'outline grip does not accidentally orbit the room');
   await page.locator('[data-action="undo"]').click();
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
   if(viewport.width<800){
    await page.locator('.drawing-actions summary').click();await page.locator('[data-tool="erase"]').click();
    const features=await page.evaluate(()=>JSON.stringify(window.togi.save.document.features));
    await pinch(page,face);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document.features)),features,'orbiting with erase selected preserves features');
    await page.evaluate(()=>window.togi.world.setView('stage'));await settle(page);
   }
   await page.locator('.drawing-actions summary').click();await page.locator('[data-tool="pierce"]').click();
   await page.mouse.click(face.x,face.y);assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),1,'different tools reject actual overlap');
   assert.ok((await page.locator('#toast').textContent()).includes('겹치는'));
   await page.mouse.click(face.x,face.y-50);assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),2,'separated holes remain allowed');
   await page.locator('[data-action="undo"]').click();await page.locator('[data-action="undo"]').click();

   await page.evaluate(()=>{window.togi.save.rotation=0;});await go(page,'excavation');
   const buried=await siteState(page);assert.ok(buried.site>0);assert.ok(Math.abs(buried.ground-buried.level)<.003);
   const start=await project(page,[-.5,buried.level,.2]),end=await project(page,[.45,buried.level,.2]);
   if(viewport.width<800){
    await pinch(page,start);
    assert.deepEqual((await siteState(page)).mask,buried.mask,'two-finger view restores tentative soil edits');
    await page.evaluate(()=>window.togi.world.setView('stage'));await settle(page);
   }
   await drag(page,start,end);
   const dug=await siteState(page);assert.ok(dug.mask.some(n=>n>0),'real pointer drag digs soil');
   assert.ok(await page.evaluate(()=>window.togi.world.terrain.heightAt(0,.2)<window.togi.world.terrain.surfaceLevel-.03),'stroke lowers the surface');
   assert.equal(dug.ground,buried.ground,'remote soil stays flat');
   if(process.env.TOGI_REVIEW==='1'){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/dug-${viewport.width}.png`});}
   // Resume assembly in a freshly created World, without entering excavation first.
   await go(page,'assembly');const assembly=await siteState(page);
   await page.reload();await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="continue"]').click();await settle(page);
   assert.equal(await page.locator('body').getAttribute('data-stage'),'assembly');assert.deepEqual(await siteState(page),assembly,'assembly resume restores the same site and mask');
   const placementPoints=await page.evaluate(()=>{
    const w=window.togi.world,p=w.pottery.root.position;
    return {from:[p.x,p.y+.48,p.z],to:[0,w.assemblyHeight,0]};
   });
   await drag(page,await project(page,placementPoints.from),await project(page,placementPoints.to));
   assert.equal(await page.evaluate(()=>window.togi.save.assembledRevision===window.togi.save.document.revision),true,'dragging the pot onto the steamer completes placement');
   const placed=await siteState(page);
   assert.ok(Math.abs(placed.placement[1]-await page.evaluate(()=>window.togi.world.assemblyHeight))<1e-8,'pot rests at the measured steamer height');
   await page.reload();await page.waitForSelector('#loading',{state:'detached'});await page.locator('[data-action="continue"]').click();await settle(page);
   assert.deepEqual(await siteState(page),placed,'placed assembly also resumes');
   if(process.env.TOGI_REVIEW==='1')await page.screenshot({path:`asset/review/assembly-${viewport.width}.png`});
   await go(page,'compare');
   for(const which of ['own','reference']){
    const state=await page.evaluate(()=>{const w=window.togi.world;return {own:w.pottery.root.rotation.y,reference:w.referenceArtifact.rotation.y,camera:[...w.camera.position]};});
    const target=await project(page,[which==='own'?-.78:.9,.70,.30]);
    assert.equal(await page.evaluate(p=>window.togi.world.artifactAt(p.x,p.y),target),which,'visible artifact is the drag target');
    await drag(page,target,{x:target.x+55,y:target.y});
    const after=await page.evaluate(()=>{const w=window.togi.world;return {own:w.pottery.root.rotation.y,reference:w.referenceArtifact.rotation.y,camera:[...w.camera.position]};});
    assert.ok(after[which]>state[which]+.1,'each exhibit turns directly with the finger');
    const other=which==='own'?'reference':'own';assert.equal(after[other],state[other],'the other exhibit stays still');
    assert.deepEqual(after.camera,state.camera,'turning an exhibit does not orbit the room');
   }
   await page.locator('[data-action="next"]').click();
   await page.evaluate(()=>document.fonts.ready);
   for(const name of ['경산이','독이','압이'])await page.locator(`[data-sticker="${name}"]`).click();
   assert.match(await page.locator('.photo-editor .eyebrow').textContent(),/AI\(인공지능\) 생성·편집 콘텐츠 포함/);
   await assertPhotoDisclosure(page);
   const bounds=await page.locator('.photo-actions').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height,'photo save controls fit');
   await page.locator('[data-photo="size"]').fill('330');await page.locator('[data-photo="angle"]').fill('30');
   const canvas=await page.locator('.photo-editor canvas').boundingBox();
   const point=(x,y)=>({x:canvas.x+x/1920*canvas.width,y:canvas.y+y/1080*canvas.height});
   await drag(page,point(1000,800),point(1700,1040));
   await assertPhotoDisclosure(page);
   await page.locator('[data-photo="delete"]').click();
   await assertPhotoDisclosure(page);
   await page.locator('[data-photo="undo"]').click();
   if(process.env.TOGI_DISCLOSURE_REVIEW==='1'&&viewport.width===390)await page.screenshot({path:'asset/review/ai-photo-portrait.png'});
   if(process.env.TOGI_REVIEW==='1')await page.screenshot({path:`asset/review/photo-${viewport.width}.png`});
   const download=page.waitForEvent('download');await page.locator('[data-photo="download"]').click();const file=await download;
   const stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const png=Buffer.concat(chunks);
   assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),1080);
   await assertPhotoDisclosure(page,png);
   if(process.env.TOGI_DISCLOSURE_REVIEW==='1'&&viewport.width===1366)await writeFile('asset/review/ai-disclosure-export.png',png);
   assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),placed.doc,'photo editing preserves pottery');
   await page.locator('[data-action="finish-photo"]').click();
   const beforeOutro=await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ));
   await checkMuseumEnding(page);
   assert.deepEqual(await page.evaluate(()=>Array.from(window.togi.save.document.outerXYZ)),beforeOutro,'museum photos and outro preserve the finished artwork');
   assert.equal(await page.locator('body').getAttribute('data-stage'),'ending','photo editor leads to the completed artwork');
   await settle(page);
   const ownBefore=await page.evaluate(()=>window.togi.world.pottery.root.rotation.y),ownTarget=await project(page,[-.78,.7,.3]);
   await drag(page,ownTarget,{x:ownTarget.x-45,y:ownTarget.y});
   assert.ok(await page.evaluate(()=>window.togi.world.pottery.root.rotation.y)<ownBefore-.1,'own artwork remains rotatable on the ending screen');
   assert.deepEqual(errors,[]);
   console.log(`PASS: ${viewport.width} complete journey and preserved artwork.`);
  }catch(error){await mkdir('asset/review',{recursive:true});await page.screenshot({path:`asset/review/journey-${viewport.width}-failure.png`});throw error;}
  finally{await context.close();}
 }
 console.log('PASS: orbit/pinch without sculpting, erasing or digging; body/mouth handles, excavation, assembly resume and portrait/landscape photo export.');
}finally{await browser?.close();await server.close();}
