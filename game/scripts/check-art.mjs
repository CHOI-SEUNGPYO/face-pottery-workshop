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
  for(const viewport of [{width:740,height:360},{width:320,height:568},{width:768,height:1024}]){
    await page.setViewportSize(viewport);
    const start=await page.locator('[data-action="new"]').boundingBox();
    assert.ok(start&&start.x>=0&&start.y>=0&&start.x+start.width<=viewport.width&&start.y+start.height<=viewport.height,'welcome start button fits phone and tablet screens');
  }
  await page.setViewportSize({width:1366,height:768});
  if(review)await mkdir('asset/review',{recursive:true});
  await page.locator('[data-action="new"]').click();
  const before=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  for(const stage of ['body','compare','excavation','assembly','firing']){
    await page.evaluate(stage=>window.togi.go(stage),stage);
    await page.waitForFunction(()=>!window.togi.world.transitioning);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(review&&['body','compare','excavation'].includes(stage)){
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
    if(review&&stage==='body'){
      await page.evaluate(()=>window.togi.world.setView('top'));
      await page.screenshot({path:'asset/review/art-tool-materials.png'});
      await page.evaluate(()=>window.togi.go('faces'));
      await page.locator('.drawing-actions summary').click();
      await page.screenshot({path:'asset/review/art-guide-menu.png'});
      await page.evaluate(()=>window.togi.go('body'));
    }
    if(stage==='compare'){
      const photo=await page.evaluate(()=>{
        const w=window.togi.world,p=w.scene.getObjectByName('Actual artifact photograph');
        return {url:p?.material.map.image.src,toneMapped:p?.material.toneMapped,plinths:w.art.model('gallery-fixtures').visible};
      });
      assert.ok(photo.url.endsWith('/face-museum-photo.jpg'),'comparison uses the supplied real photograph');
      assert.equal(photo.toneMapped,false,'museum lighting must not recolour the reference photograph');
      assert.equal(photo.plinths,true,'permanent exhibit supports are visible');
    }
    if(stage==='excavation'){
      const documentBefore=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
      for(const viewport of [{width:1366,height:768},{width:740,height:360},{width:390,height:844},{width:768,height:1024}]){
        await page.setViewportSize(viewport);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const area=await page.locator('.work-area').boundingBox(),x=area.x+area.width/2,y=area.y+area.height/2;
        for(const delta of [-900,1800]){
          // Real secondary-button drags exercise the same orbit route as a player.
          await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+120,y+delta,{steps:8});await page.mouse.up({button:'right'});
          await page.mouse.move(x,y);await page.mouse.wheel(0,-5000);
          const frame=await page.evaluate(()=>{
            const w=window.togi.world,r=document.querySelector('.work-area').getBoundingClientRect();
            w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld();
            const points=[];
            for(const root of [w.soil,w.siru,w.pottery.root])root.traverseVisible(o=>{
              if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
              for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
                const p=w.camera.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld).project(w.camera);
                points.push({x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2});
              }
            });
            return {outside:points.filter(p=>p.x<r.left-1||p.x>r.right+1||p.y<r.top-1||p.y>r.bottom+1),aboveGround:w.camera.position.y>w.digLevel+.15};
          });
          assert.ok(frame.aboveGround,'excavation orbit stays above the surrounding ground');
          assert.equal(frame.outside.length,0,`${viewport.width}: trench and artifacts stay within the working area at gesture limits`);
        }
      }
      assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),documentBefore,'camera gestures preserve artwork');
      await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>window.togi.world.setView('stage'));
    }
    if(stage==='assembly'){
      await page.locator('[data-action="place"]').click();
      const contact=await page.evaluate(()=>{
        const w=window.togi.world;
        w.scene.updateMatrixWorld(true);
        const bounds=root=>{
          const box=w.pottery.body.geometry.boundingBox.clone().makeEmpty();
          root.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
          return box;
        };
        const pot=bounds(w.pottery.root),siru=bounds(w.siru),bench=bounds(w.assemblyBench);
        return {pot:pot.min.y,siruTop:siru.max.y,table:siru.min.y,bench:bench.max.y};
      });
      assert.ok(Math.abs(contact.pot-contact.siruTop)<.001,'pot contacts the actual steamer rim');
      assert.ok(Math.abs(contact.table-contact.bench)<.001,'steamer rests on the conservation table');
    }
    if(stage==='firing'){
      await page.evaluate(()=>window.togi.world.toggleKiln());
      assert.equal(await page.evaluate(()=>window.togi.world.firingView.group.getObjectByName('Cutaway_shell').visible),false,'kiln model opens with the cutaway control');
      await page.evaluate(()=>window.togi.world.toggleKiln());
    }
  }
  await page.evaluate(()=>window.togi.go('body'));
  await page.evaluate(()=>window.togi.world.orbit(540,0));
  const behind=await page.evaluate(()=>{
    const w=window.togi.world;
    return {shell:w.studioArchitecture.visible,back:w.walls.find(o=>o.name==='Studio_window_wall')?.visible,
      floor:w.art.model('studio-shell').children.some(o=>o.isMesh&&o.visible),bench:w.art.model('craft-bench').visible};
  });
  assert.equal(behind.back,false,'back wall opens when viewing the pot from behind');
  assert.ok(behind.shell&&behind.floor&&behind.bench,'floor and table stay visible while the wall opens');
  await page.evaluate(()=>window.togi.world.setView('stage'));
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>!window.togi.world.transitioning);
  if(review)await page.screenshot({path:'asset/review/art-body-portrait.png'});
  assert.equal(await page.evaluate(()=>JSON.stringify(window.togi.save.document)),before,'art and stage changes preserve the editable document');
  assert.deepEqual(errors,[]);
  const manifest=JSON.parse(await readFile('asset/source/model-manifest.json','utf8'));
  assert.ok(manifest.length>=20);
  const layout=JSON.parse(await readFile('asset/source/scene-layout-v3.json','utf8'));
  for(const [i,a]of layout.exhibits.entries()){
    assert.ok(Math.abs(a.min[1]-a.supportY)<.001,'each background pot touches its shelf');
    for(const b of layout.exhibits.slice(i+1).filter(b=>b.collection===a.collection)){
      assert.ok([0,1,2].some(axis=>a.max[axis]<b.min[axis]||b.max[axis]<a.min[axis]),'background artifacts do not overlap');
    }
  }
  console.log('PASS: textured scene assets, geometry/draw budgets and artwork preservation.');
}finally{await browser?.close();await server.close();}
