import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
const settle=page=>page.waitForFunction(()=>!window.togi.world.transitioning);
const values=page=>page.evaluate(()=>({height:window.togi.save.document.form.height,width:window.togi.save.document.form.width,radius:window.togi.save.document.mouth.innerRadius,rim:window.togi.save.document.mouth.neckHeight}));
async function dragRange(page,key,fraction,touch){
  const range=page.locator(`[data-form-range="${key}"]`),r=await range.boundingBox();
  assert.ok(r&&r.width>0,`${key} is visible`);
  const current=await range.evaluate(el=>(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min)));
  const a={x:r.x+8+(r.width-16)*current,y:r.y+r.height/2},b={x:r.x+8+(r.width-16)*fraction,y:a.y};
  if(touch){
    const session=await page.context().newCDPSession(page);
    try{
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
      for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y,id:1}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }finally{await session.detach();}
  }else{
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
  }
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
try{
  await mkdir('asset/review',{recursive:true});
  for(const device of [{name:'desktop',width:1366,height:768,touch:false},{name:'tablet',width:1024,height:768,touch:true},{name:'phone',width:390,height:696,touch:true}]){
    const context=await browser.newContext({viewport:device,hasTouch:device.touch,isMobile:device.touch,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);await page.locator('#loading').waitFor({state:'detached'});
      await page.locator('[data-action="new"]').click();await settle(page);
      if(device.name==='desktop'){
        // A browser may omit change when the range value is rewritten during
        // input. An unfinished width edit must never capture the next control.
        await page.locator('[data-form-range="width"]').evaluate(el=>{el.value='125';el.dispatchEvent(new Event('input',{bubbles:true}));});
        await page.evaluate(()=>new Promise(requestAnimationFrame));
        await page.locator('[data-form-range="height"]').evaluate(el=>{el.value='140';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
        const switched=await values(page);
        assert.equal(switched.width,1.25,'unfinished width input cannot capture height');
        assert.equal(switched.height,1.4,'the newly selected height receives its value');
        await page.locator('[data-action="undo"]').click();await page.locator('[data-action="undo"]').click();
      }
      for(const pair of device.name==='phone'?[['mouth-width','mouth-height','radius','rim']]:[['width','height','width','height'],['mouth-width','mouth-height','radius','rim']]){
        const [widthKey,heightKey,widthValue,heightValue]=pair;
        if(widthKey.startsWith('mouth')){await page.locator('[data-action="next"]').click();await settle(page);}
        const initial=await values(page);
        await dragRange(page,widthKey,.8,device.touch);const wider=await values(page);
        assert.ok(wider[widthValue]>initial[widthValue],`${device.name}: width increases`);
        await dragRange(page,heightKey,.85,device.touch);const taller=await values(page);
        assert.equal(taller[widthValue],wider[widthValue],`${device.name}: height does not edit previous width`);
        assert.ok(taller[heightValue]>wider[heightValue],`${device.name}: height increases`);
        await page.locator('[data-action="undo"]').click();assert.deepEqual(await values(page),wider,'one undo restores height only');
        await page.locator('[data-action="undo"]').click();assert.deepEqual(await values(page),initial,'second undo restores width');
        results.push({device:device.name,pair,initial,wider,taller});
      }
      await page.locator('[data-action="next"]').click();await settle(page);
      if(!device.touch){
        assert.equal(await page.locator('.drawing-actions>summary').isVisible(),false,'desktop has no collapsed action bar');
        assert.ok(await page.locator('[data-tool="refine"]').isVisible(),'desktop tools are immediately available');
        const panel=await page.locator('.drawing-actions .action-panel').boundingBox(),area=await page.locator('.work-area').boundingBox();
        assert.ok(panel.x>=area.x+area.width,'desktop tools occupy the right rail outside the pottery');
        await page.locator('[data-tool="refine"]').click();
        assert.ok(await page.locator('[data-tool="carve"]').isVisible(),'choosing a tool does not collapse the panel');
        await page.locator('[data-tool="carve"]').click();
        await page.screenshot({path:'asset/review/desktop-tools-right.png'});
        await page.locator('[data-action="next"]').click();await settle(page);
        assert.equal(await page.locator('.edit-actions>summary').isVisible(),false);
        assert.ok(await page.locator('[data-action="edit-body"]').isVisible(),'inspect editing is directly accessible');
      }else if(device.name==='tablet'){
        assert.ok(await page.locator('.drawing-actions>summary').isVisible(),'touch tablet keeps its compact action bar');
      }else{
        assert.equal(await page.locator('.drawing-actions>summary').isVisible(),false);
        assert.ok(await page.locator('[data-tool="refine"]').isVisible(),'phone keeps its directly accessible bottom tools');
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS: ${device.name} width → height with separate undo`);
    }catch(error){await page.screenshot({path:`asset/review/form-controls-${device.name}-failure.png`});throw error;}
    finally{await context.close();}
  }
  await writeFile('asset/review/form-controls-check.json',JSON.stringify(results,null,2));
}finally{await browser.close();await server.close();}
