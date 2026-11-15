import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import * as T from 'three';
import {buildFaceArtifact} from './face-artifact.mjs';
// Probe the actual geometry, not material colour: every face has open eyes,
// nostrils and mouth. A painted black disk cannot satisfy this check.
const model=buildFaceArtifact();model.updateMatrixWorld(true);
assert.equal(model.userData.openingCentres.length,18,'three faces and three pierced ear collars');
for(const {u,y,kind} of model.userData.openingCentres){
  const start=model.localToWorld(new T.Vector3(Math.sin(u)*.8,y,Math.cos(u)*.8));
  const centre=model.localToWorld(new T.Vector3(0,y,0));
  const hits=new T.Raycaster(start,centre.sub(start).normalize()).intersectObject(model,true);
  assert.ok(!hits.length||hits[0].distance>.40,`${kind}: opening is a real tunnel into the vessel`);
}
const underside=new T.Raycaster(new T.Vector3(.22,-.2,0),new T.Vector3(0,1,0)).intersectObject(model,true);
assert.ok(underside[0]?.distance>1,'the open base leads into the vessel, not a solid bottom');
const dimensions=new T.Box3().setFromObject(model,true).getSize(new T.Vector3());
assert.ok(dimensions.x/dimensions.y>.65&&dimensions.x/dimensions.y<.76,'broad shoulders match the scan-video silhouette');
model.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
const review=process.env.TOGI_REVIEW==='1'||process.env.TOGI_ART_REVIEW==='1';
const artifactReview=process.env.TOGI_ARTIFACT_REVIEW==='1';
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
  if(review||artifactReview)await mkdir('asset/review',{recursive:true});
  await page.locator('[data-action="new"]').click();
  const before=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  for(const stage of ['body','compare','excavation','assembly','firing']){
    await page.evaluate(stage=>window.togi.go(stage),stage);
    await page.waitForFunction(()=>!window.togi.world.transitioning);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(review&&['body','compare','firing'].includes(stage)){
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
    if(stage==='body')assert.equal(await page.evaluate(()=>window.togi.world.pottery.outline.visible),true,'editable body has a subtle silhouette');
    if(stage==='compare'){
      const artifact=await page.evaluate(()=>{
        const w=window.togi.world,b=w.pottery.body.geometry.boundingBox.clone().makeEmpty();let vertices=0;
        w.referenceArtifact.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));vertices+=o.geometry.attributes.position.count;}});
        return {depth:b.max.z-b.min.z,bottom:b.min.y,vertices,photo:!!w.scene.getObjectByName('Actual artifact photograph'),plinths:w.art.model('gallery-fixtures').visible,outline:w.pottery.outline.visible};
      });
      assert.ok(artifact.depth>.8&&artifact.vertices>10000,'reference exhibit has a curved three-dimensional body');
      assert.ok(Math.abs(artifact.bottom)<.001,'reference vessel rests on the plinth');
      assert.equal(artifact.photo,false,'the static photograph no longer replaces the 3D exhibit');
      assert.equal(artifact.outline,false,'editing outline is absent in the gallery and exported photos');
      assert.equal(artifact.plinths,true,'permanent exhibit supports are visible');
      assert.equal(await page.evaluate(()=>{
        const materials=new Set();window.togi.world.referenceArtifact.traverse(o=>{if(o.isMesh&&o.material.userData.artifactSurface==='exterior')materials.add(o.material);});
        return materials.size>0&&[...materials].every(m=>m.map&&m.normalMap&&!m.bumpMap&&m.map.image.width===1024);
      }),true,'reference exhibit preserves its embedded colour and relief maps');
      for(let face=0;face<3;face++){
        await page.evaluate(angle=>{window.togi.world.referenceArtifact.rotation.y=angle;window.togi.world.refresh(true);},-face*Math.PI*2/3);
        if(review){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`asset/review/art-reference-face-${face+1}.png`});}
      }
      await page.evaluate(()=>{window.togi.world.referenceArtifact.rotation.y=0;window.togi.world.refresh(true);});
      if(artifactReview){
        await page.screenshot({path:'asset/review/artifact-v4-gallery.png'});
        // Render the loaded game asset with neutral lighting at matching angles.
        // This also checks that the GLB is self-contained outside the game room.
        const plates=await page.evaluate(()=>{
          const w=window.togi.world,scene=new w.scene.constructor(),artifact=w.referenceArtifact.clone(true);
          artifact.position.set(0,0,0);scene.add(artifact);
          scene.environment=w.scene.environment;scene.environmentIntensity=w.scene.environmentIntensity;
          const key=w.key.clone(),fill=w.fill.clone(),ambient=w.ambient.clone();
          key.position.set(-3,4,5);key.intensity=2.4;fill.position.set(4,2,3);fill.intensity=.75;ambient.intensity=1.1;
          scene.add(key,fill,ambient);
          const renderer=new w.renderer.constructor({antialias:true,preserveDrawingBuffer:true});renderer.setSize(560,680);renderer.setClearColor(0xe8e6e1,1);renderer.outputColorSpace=w.renderer.outputColorSpace;renderer.toneMapping=w.renderer.toneMapping;renderer.toneMappingExposure=w.renderer.toneMappingExposure;
          const camera=w.camera.clone();camera.fov=28;camera.aspect=560/680;camera.zoom=1;camera.near=.01;camera.far=100;camera.updateProjectionMatrix();
          const out=[];
          for(let face=0;face<3;face++){
            artifact.rotation.y=-face*Math.PI*2/3;camera.position.set(0,.84,4);camera.lookAt(0,.79,0);camera.updateMatrixWorld();renderer.render(scene,camera);out.push(renderer.domElement.toDataURL('image/png'));
          }
          artifact.rotation.y=0;camera.position.set(1.4,-3.5,.8);camera.lookAt(0,.75,0);camera.updateMatrixWorld();renderer.render(scene,camera);out.push(renderer.domElement.toDataURL('image/png'));renderer.dispose();return out;
        });
        for(let i=0;i<plates.length;i++)await writeFile(`asset/review/artifact-v4-${i===3?'underside':`face-${i+1}`}.png`,Buffer.from(plates[i].split(',')[1],'base64'));
      }
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
      const motion=await page.evaluate(()=>{
        const w=window.togi.world,samples=[];
        for(let i=0;i<=1000;i++){w.setFiringProgress(i/1000);samples.push([...w.pottery.root.position]);}
        return samples;
      });
      assert.ok(motion.every((p,i)=>!i||Math.hypot(...p.map((n,k)=>n-motion[i-1][k]))<.05),'kiln loading and unloading have no position jumps');
      assert.ok(Math.abs(motion[0][1]-.12)<.001&&Math.abs(motion.at(-1)[1]-.12)<.001,'pot starts and finishes on the cooling slab');
      assert.ok(Math.abs(motion[500][1]-.07)<.001,'pot rests on the kiln bed while firing');
      if(review){await page.evaluate(()=>window.togi.world.setFiringProgress(.42));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:'asset/review/art-firing-interior.png'});}
      await page.evaluate(()=>window.togi.world.setFiringProgress(null));
      await page.evaluate(()=>window.togi.world.toggleKiln());
      assert.equal(await page.evaluate(()=>window.togi.world.firingView.group.getObjectByName('Cutaway_shell').visible),false,'kiln model opens with the cutaway control');
      await page.evaluate(()=>window.togi.world.toggleKiln());
    }
  }
  await page.evaluate(()=>window.togi.go('body'));
  const blocked=await page.evaluate(()=>{
    const w=window.togi.world,failures=[];
    for(let angle=0;angle<360;angle+=15){
      w.setView('stage');w.orbit((-14-angle)/.35,0);
      w.scene.updateMatrixWorld(true);w.camera.updateMatrixWorld();
      const point=w.camera.position.clone().set(0,.7,0).project(w.camera);
      const x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2,pot=w.hit(x,y,true);
      const meshes=[];for(const root of [w.workshop,w.displayPots])root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
      const obstacle=w.pointer(x,y).intersectObjects(meshes,false)[0];
      if(!pot||(obstacle&&obstacle.distance<pot.distance-.01))failures.push({angle,obstacle:obstacle?.object.name});
    }
    return failures;
  });
  assert.deepEqual(blocked,[],'a full orbit never puts the cupboard or wall between the player and pottery');
  await page.evaluate(()=>window.togi.world.setView('stage'));
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
