// Repeatable art-direction review in an isolated browser; never touches player saves.
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',headless:true});
const label=process.env.TOGI_SCENE_LABEL||'scene';
try{
  await mkdir('asset/review',{recursive:true});
  for(const [width,height] of [[1366,768],[768,1024],[390,696],[320,568],[740,360]]){
    if(!(process.env.TOGI_SCENE_WIDTHS||'1366,390').split(',').includes(String(width)))continue;
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<600});
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
    await page.waitForFunction(()=>window.togi&&!document.querySelector('#loading'),null,{timeout:60000});
    for(const stage of (process.env.TOGI_SCENE_STAGES?.split(',')||['welcome','body','faces','firing','excavation','assembly','ending'])){
      await page.evaluate(stage=>window.togi.go(stage),stage);
      await page.waitForFunction(()=>document.querySelector('#travel').hidden&&!window.togi.world.transitioning);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      await page.screenshot({path:`asset/review/${label}-${stage}-${width}.png`});
    }
    await context.close();
  }
}finally{await browser.close();await server.close();}
