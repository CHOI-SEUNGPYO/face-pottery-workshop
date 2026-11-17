import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

// Isolated browser/save. Measures input-driven preview work, not a real phone's FPS.
const baseline=process.argv.includes('--baseline'),results=[];
const server=await createServer({server:{host:'127.0.0.1',port:0}});await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const [width,height,throttle] of [[1366,768,1],[390,696,1],[390,696,4]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:width<500?3:1,hasTouch:width<500,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await page.locator('#loading').waitFor({state:'detached'});
      await page.evaluate(()=>{
        const w=window.togi.world,stats={times:[],mainDraws:0,resizes:0};window.examplePerf=stats;
        const render=w.renderer.render.bind(w.renderer),resize=w.renderer.setSize.bind(w.renderer),create=w.createExampleView.bind(w);
        w.renderer.render=(scene,...args)=>{if(scene===w.scene)stats.mainDraws++;return render(scene,...args);};
        w.renderer.setSize=(...args)=>{stats.resizes++;return resize(...args);};
        w.createExampleView=(...args)=>{const view=create(...args),draw=view.render.bind(view);view.render=(...a)=>{const start=performance.now();try{return draw(...a);}finally{stats.times.push(performance.now()-start);}};return view;};
      });
      await page.locator('[data-action="example-artwork"]').click();
      const canvas=page.locator('.example-viewer canvas');await canvas.waitFor();
      const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
      const metrics=await page.evaluate(async()=>{
        const canvas=document.querySelector('.example-viewer canvas'),r=canvas.getBoundingClientRect();
        const stats=window.examplePerf,frames=[],quantiles=a=>{a=[...a].sort((a,b)=>a-b);return{median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]};};
        // Warm shaders and textures, then use one input per animation frame.
        canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,button:0,isPrimary:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));
        let last=0;
        for(let i=0;i<90;i++){
          await new Promise(resolve=>requestAnimationFrame(now=>{
            if(i===10){stats.times=[];stats.mainDraws=0;stats.resizes=0;}
            if(i>10)frames.push(now-last);last=now;
            canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,isPrimary:true,clientX:r.x+r.width*(.5+.25*Math.sin(i*.08)),clientY:r.y+r.height*(.5+.15*Math.sin(i*.05))}));
            resolve();
          }));
        }
        canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,isPrimary:true}));
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return{render:quantiles(stats.times),frame:quantiles(frames),draws:stats.times.length,mainDraws:stats.mainDraws,resizes:stats.resizes,pixels:[canvas.width,canvas.height]};
      });
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();
      // Capture actual compositor output, including WebGL canvases without readback.
      await mkdir('asset/review',{recursive:true});
      await page.screenshot({path:`asset/review/example-performance-${baseline?'before':'after'}-${width}-${throttle}.png`});
      const result={width,height,throttle,...metrics};results.push(result);console.log(JSON.stringify(result));
      assert.deepEqual(errors,[]);
      if(!baseline){
        assert.equal(metrics.mainDraws,0,'orbiting an example never redraws the hidden game');
        assert.equal(metrics.resizes,0,'orbiting never reallocates the game drawing buffer');
        assert.ok(metrics.draws>=70,'continuous input produces frames, not a frozen preview');
        assert.ok(metrics.render.p95<(throttle===4?30:16),'preview CPU work fits the test-device budget');
      }
    }finally{await context.close();}
  }
  await writeFile(`asset/review/example-performance-${baseline?'before':'after'}.json`,JSON.stringify(results,null,2));
}finally{await browser?.close();await server.close();}
