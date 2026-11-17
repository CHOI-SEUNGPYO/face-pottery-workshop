import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  await mkdir('asset/review',{recursive:true});
  for(const device of [
    {name:'desktop',width:1366,height:768,touch:false},
    {name:'tablet',width:768,height:1024,touch:true},
    {name:'phone',width:390,height:696,touch:true},
    {name:'small-phone',width:320,height:568,touch:true},
    {name:'landscape',width:740,height:360,touch:true},
  ]){
    const context=await browser.newContext({viewport:device,hasTouch:device.touch,isMobile:device.touch,reducedMotion:'no-preference'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const documentState=()=>page.evaluate(async()=>{
      const {revision,...artwork}=window.togi.save.document;
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(artwork)));
      return {revision,artwork:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')};
    });
    const replay=async()=>{
      await page.locator('[data-action="help"]').click();
      await page.locator('[data-action="shape-guide"]').click();
      await page.locator('.body-demonstration').waitFor({state:'visible'});
    };
    const layout=()=>page.evaluate(()=>{
      const el=document.querySelector('.body-demonstration'),r=el.querySelector('span').getBoundingClientRect();
      const point=el.querySelector('.body-guide-rest').getPointAtLength(el.querySelector('.body-guide-rest').getTotalLength()/2);
      const overlap=b=>Math.min(r.right,b.right)>Math.max(r.left,b.left)&&Math.min(r.bottom,b.bottom)>Math.max(r.top,b.top);
      return {onScreen:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        coversButton:[...document.querySelectorAll('#hud button')].filter(b=>b.checkVisibility()).some(b=>overlap(b.getBoundingClientRect())),
        transparent:getComputedStyle(el).pointerEvents==='none',
        point:{x:point.x,y:point.y},onClay:!!window.togi.world.shapeHit(point.x,point.y)};
    });
    try{
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
      await page.locator('#loading').waitFor({state:'detached'});
      await page.locator('[data-action="new"]').click();
      await page.locator('.body-demonstration').waitFor({state:'visible'});
      const before=await documentState(),bounds=await layout();
      assert.ok(bounds.onScreen&&bounds.onClay&&bounds.transparent&&!bounds.coversButton,JSON.stringify(bounds));
      assert.equal(await page.locator('.turn-demonstration').isVisible(),false,'shaping and rotation cues do not compete');
      const motion=await page.evaluate(async()=>{
        const el=document.querySelector('.body-demonstration'),hand=el.querySelector('.body-guide-finger'),trace=el.querySelector('.body-guide-trace');
        const positions=[],curves=new Set(),until=performance.now()+800;
        do{positions.push(hand.transform.baseVal.getItem(0).matrix.e);curves.add(trace.getAttribute('d'));await new Promise(requestAnimationFrame);}while(performance.now()<until);
        return {travel:Math.max(...positions)-Math.min(...positions),curves:curves.size};
      });
      assert.ok(motion.travel>8&&motion.curves>3,'finger and contour visibly rehearse shaping');
      await page.screenshot({path:`asset/review/body-guide-${device.name}.png`});
      if(device.name==='phone'){
        await page.setViewportSize({width:390,height:650});
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        assert.ok((await layout()).onClay,'browser chrome resize keeps the cue on the silhouette');
      }
      await page.locator('.body-demonstration').waitFor({state:'detached'});
      assert.deepEqual(await documentState(),before,'the entire demonstration never modifies artwork');
      assert.ok(await page.locator('.turn-demonstration').isVisible(),'rotation follows the short shape demonstration');
      await replay();const target=(await layout()).point;
      if(device.touch){
        const touch=await context.newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...target,id:1}]});
        assert.equal(await page.locator('.body-demonstration').count(),0,'touch dismisses the guide immediately');
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:target.x+25,y:target.y,id:1}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.detach();
      }else{
        await page.mouse.move(target.x,target.y);await page.mouse.down();
        assert.equal(await page.locator('.body-demonstration').count(),0,'mouse input dismisses the guide immediately');
        await page.mouse.move(target.x+25,target.y,{steps:10});await page.mouse.up();
      }
      assert.notEqual((await documentState()).artwork,before.artwork,'the indicated contour really can be sculpted');
      await page.locator('[data-action="undo"]').click();assert.equal((await documentState()).artwork,before.artwork,'undo restores the artwork, with a new revision');
      await replay();await page.locator('[data-action="next"]').click();
      assert.equal(await page.locator('.body-demonstration').count(),0,'leaving the stage cleans up the guide');
      await page.locator('[data-action="previous"]').click();
      assert.equal(await page.locator('.body-demonstration').count(),0,'returning to the stage does not repeat the guide');
      await page.emulateMedia({reducedMotion:'reduce'});await replay();
      const staticPaths=await page.evaluate(async()=>{
        const path=document.querySelector('.body-guide-trace'),values=new Set(),until=performance.now()+400;
        do{values.add(path.getAttribute('d'));await new Promise(requestAnimationFrame);}while(performance.now()<until);
        return values.size;
      });
      assert.equal(staticPaths,1,'reduced motion keeps a static cue');
      await page.locator('[data-action="help"]').click();assert.equal(await page.locator('.body-demonstration').count(),0,'dialogs stop the demonstration');
      assert.deepEqual(errors,[]);console.log(`PASS: ${device.name} body gesture, layout, input, undo and reduced motion`);
    }catch(error){await page.screenshot({path:`asset/review/body-guide-${device.name}-failure.png`});throw error;}
    finally{await context.close();}
  }
}finally{await browser?.close();await server.close();}
