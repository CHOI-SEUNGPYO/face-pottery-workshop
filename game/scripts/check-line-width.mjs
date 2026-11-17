import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  await mkdir('asset/review',{recursive:true});
  for(const device of [{name:'desktop',width:1366,height:768,touch:false},{name:'tablet',width:768,height:1024,touch:true},{name:'phone',width:390,height:696,touch:true}]){
    const context=await browser.newContext({viewport:device,hasTouch:device.touch,isMobile:device.touch,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const openTools=async()=>{
      const actions=page.locator('.drawing-actions');
      if(!await actions.evaluate(el=>el.open))await actions.locator('summary').click();
    };
    const features=()=>page.evaluate(()=>structuredClone(window.togi.save.document.features));
    const inkPixels=()=>page.evaluate(()=>{
      const canvas=window.togi.world.pottery.ink,data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let n=0;for(let i=0;i<data.length;i+=4)if(data[i]<235)n++;return n;
    });
    const checkLayout=async()=>{
      await openTools();
      const r=await page.locator('#line-width').boundingBox(),footer=await page.locator('footer').boundingBox(),v=page.viewportSize();
      assert.ok(r&&r.height>=44&&r.width>=30,'thickness has a usable touch target');
      assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=v.width&&r.y+r.height<=footer.y,'thickness fits above navigation');
      const center=await page.evaluate(()=>{
        const w=window.togi.world,p=w.pottery.body.geometry.boundingBox.getCenter(w.camera.position.clone());
        w.pottery.root.localToWorld(p);p.project(w.camera);
        return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
      });
      assert.ok(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS',center),'the pottery centre stays available for drawing');
    };
    const setWidth=async level=>{
      await openTools();const range=page.locator('#line-width'),r=await range.boundingBox(),current=Number(await range.inputValue());
      const start={x:r.x+8+(r.width-16)*(current-1)/4,y:r.y+r.height/2},end={x:r.x+8+(r.width-16)*(level-1)/4,y:start.y};
      if(device.touch){
        const session=await context.newCDPSession(page);
        try{
          await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1}]});
          for(let i=1;i<=10;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/10,y:end.y,id:1}]});
          await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }finally{await session.detach();}
      }else{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:10});await page.mouse.up();}
      assert.equal(await range.inputValue(),String(level),'native slider reaches the selected thickness');
    };
    const draw=async(v,width)=>{
      const points=await page.evaluate(async v=>{
        const {surfacePoint}=await import('/src/model.ts'),w=window.togi.world;w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld();
        return Array.from({length:17},(_,i)=>{
          const p=surfacePoint(window.togi.save.document,-.065+i*.13/16,v);w.pottery.root.localToWorld(p);p.project(w.camera);
          return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
        });
      },v);
      const session=device.touch?await context.newCDPSession(page):null;
      try{
        if(session){
          await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
          for(const point of points.slice(1))await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});
        }else{
          await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
          for(const point of points.slice(1))await page.mouse.move(point.x,point.y);
        }
        await page.waitForFunction(width=>window.togi.world.stroke.visible&&window.togi.world.stroke.children[1].material.linewidth===width,width);
        if(session)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
      }finally{await session?.detach();}
    };
    try{
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
      await page.locator('#loading').waitFor({state:'detached'});
      await page.locator('[data-action="new"]').click();
      await page.locator('[data-action="next"]').click();await page.locator('[data-action="next"]').click();
      await openTools();await page.locator('[data-action="draw-line"]').click();
      await checkLayout();
      await setWidth(1);await draw(.61,.002);
      const thin=(await features())[0],thinPixels=await inkPixels();
      assert.equal(thin.strokeWidth,.002);assert.equal(thin.kind,'groove');assert.ok(thinPixels>0);
      await setWidth(5);assert.deepEqual((await features())[0],thin,'changing the tool leaves an existing line untouched');
      await draw(.46,.02);
      const both=await features(),bothPixels=await inkPixels();
      assert.equal(both.length,2);assert.equal(both[1].strokeWidth,.02);
      assert.ok(bothPixels-thinPixels>thinPixels*3,'the thicker stroke paints a visibly wider surface band');
      await page.locator('[data-action="undo"]').click();assert.deepEqual(await features(),[thin]);
      await page.locator('[data-action="redo"]').click();assert.deepEqual(await features(),both);
      await openTools();
      await page.screenshot({path:`asset/review/line-width-${device.name}.png`});
      if(device.touch&&device.name==='phone'){
        for(const viewport of [{width:320,height:568},{width:740,height:360}]){
          await page.setViewportSize(viewport);await checkLayout();
        }
        await page.setViewportSize({width:device.width,height:device.height});
      }
      await openTools();await page.locator('[data-action="draw-opening"]').click();assert.equal(await page.locator('#line-width').count(),0,'hole tools do not gain an unrelated width control');
      await page.waitForFunction(expected=>new Promise(resolve=>{
        const request=indexedDB.open('togi-workshop-v2',1);
        request.onsuccess=()=>{const db=request.result,r=db.transaction('state').objectStore('state').get('current');r.onsuccess=()=>{resolve(JSON.stringify(r.result.document.features)===expected);db.close();};};
      }),JSON.stringify(both));
      await page.reload();await page.locator('#loading').waitFor({state:'detached'});await page.locator('[data-action="continue"]').click();
      assert.deepEqual(await features(),both,'saved strokes retain individual widths on resume');
      assert.equal(await inkPixels(),bothPixels,'saved strokes render at the same widths');
      assert.deepEqual(errors,[]);console.log(`PASS: ${device.name} native line thickness, visible paint, undo/redo and resume`);
    }catch(error){await page.screenshot({path:`asset/review/line-width-${device.name}-failure.png`});throw error;}
    finally{await context.close();}
  }
}finally{await browser?.close();await server.close();}
