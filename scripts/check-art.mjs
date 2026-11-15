import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
const review=process.env.TOGI_REVIEW==='1'||process.env.TOGI_ART_REVIEW==='1';
await server.listen();let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()}: ${r.url()}`);});
  page.on('console',message=>{if(message.type()==='error')errors.push(`${message.text()} ${message.location().url}`);});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(()=>!document.querySelector('#loading')||document.querySelector('#loading h2'),null,{timeout:60000});
  assert.equal(await page.locator('#loading').count(),0,`scene loads: ${errors.join('\n')}`);
  await page.locator('[data-action="new"]').click();
  const before=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  for(const stage of ['body','compare','excavation','firing']){
    await page.evaluate(stage=>window.togi.go(stage),stage);
    await page.waitForFunction(()=>!window.togi.world.transitioning);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(review){
      await mkdir('asset/review',{recursive:true});
      await page.screenshot({path:`asset/review/art-${stage}-desktop.png`});
    }
    const stats=await page.evaluate(()=>{
      const w=window.togi.world;let textured=0;
      w.scene.traverseVisible(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)textured++;});
      return {textured,triangles:w.renderer.info.render.triangles,calls:w.renderer.info.render.calls,textures:w.renderer.info.memory.textures};
    });
    assert.ok(stats.textured>=6,`${stage}: real texture assets are visible`);
    assert.ok(stats.triangles<450000,`${stage}: mobile geometry budget: ${stats.triangles}`);
    assert.ok(stats.calls<180,`${stage}: draw call budget: ${stats.calls}`);
    console.log(stage,stats);
    if(stage==='firing'){
      await page.evaluate(()=>window.togi.world.toggleKiln());
      assert.equal(await page.evaluate(()=>window.togi.world.firingView.group.getObjectByName('Cutaway_shell').visible),false,'kiln model opens with the cutaway control');
      await page.evaluate(()=>window.togi.world.toggleKiln());
    }
  }
  await page.evaluate(()=>window.togi.go('body'));
  await page.evaluate(()=>window.togi.world.orbit(540,0));
  assert.equal(await page.evaluate(()=>window.togi.world.studioArchitecture.visible),false,'back wall opens when viewing the pot from behind');
  await page.evaluate(()=>window.togi.world.setView('stage'));
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>!window.togi.world.transitioning);
  if(review)await page.screenshot({path:'asset/review/art-body-portrait.png'});
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),before,'art and stage changes preserve the editable document');
  assert.deepEqual(errors,[]);
  const manifest=JSON.parse(await readFile('asset/source/model-manifest.json','utf8'));
  assert.ok(manifest.length>=20);
  console.log('PASS: textured scene assets, geometry/draw budgets and artwork preservation.');
}finally{await browser?.close();await server.close();}
