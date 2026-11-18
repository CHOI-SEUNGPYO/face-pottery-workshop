import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildFaceArtifact} from './face-artifact.mjs';
import {buildSiruArtifact} from './siru-artifact.mjs';
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
const steamer=buildSiruArtifact();steamer.updateMatrixWorld(true);
const steamerBody=steamer.getObjectByName('Impressed tapering body'),bodySize=new T.Box3().setFromObject(steamerBody,true).getSize(new T.Vector3());
assert.ok(bodySize.y/bodySize.x>.93&&bodySize.y/bodySize.x<1.04,'siru body is tall like the excavation photograph');
assert.equal(steamer.children.filter(o=>o.userData.siruHandle).length,2,'two distinct mid-body ox-horn lugs');
for(const lug of steamer.children.filter(o=>o.userData.siruHandle)){
  const box=new T.Box3().setFromObject(lug,true),size=box.getSize(new T.Vector3());
  assert.ok(size.z>.14&&size.y>.10,'handles have broad clay roots, not thin pipe sections');
  const p=box.getCenter(new T.Vector3()),hit=new T.Raycaster(new T.Vector3(p.x,p.y,1),new T.Vector3(0,0,-1)).intersectObject(lug);
  assert.ok(hit.length>0&&hit[0].point.z>0,'the lug has an outward-facing solid surface');
}
for(const x of [-.16,0,.16]){
  const holes=new T.Raycaster(new T.Vector3(x,-.1,0),new T.Vector3(0,1,0)).intersectObject(steamer,true);
  assert.equal(holes.length,0,'the removed bottom is an open passage, with no invented sieve plate');
}
const {u:chipU,v:chipV}=steamer.userData.missingSherd;
const chipStart=new T.Vector3(Math.sin(chipU)*.7,chipV*.88,Math.cos(chipU)*.7);
const chipHits=new T.Raycaster(chipStart,new T.Vector3(-Math.sin(chipU),0,-Math.cos(chipU))).intersectObject(steamer,true);
assert.ok(!chipHits.length||chipHits[0].distance>.75,'the documented missing sherd pierces both walls');
steamer.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
const kilnBytes=await readFile(new URL('../asset/runtime/models/kiln-vault-v3.glb',import.meta.url));
const {scene:kiln}=await new GLTFLoader().parseAsync(Uint8Array.from(kilnBytes).buffer,'');
kiln.updateMatrixWorld(true);
for(const side of [-1,1])for(const z of [-1.65,-1.3,-.55,.45,1.14]){
  const hits=new T.Raycaster(new T.Vector3(side*2,.012,z),new T.Vector3(-side,0,0)).intersectObject(kiln);
  assert.ok(hits[0]&&hits[0].distance<1,`kiln wall meets grade at side ${side}, z=${z}`);
}
for(const x of [-.4,0,.4]){
  const rearHits=new T.Raycaster(new T.Vector3(x,.014,-2.45),new T.Vector3(0,0,1)).intersectObject(kiln);
  assert.ok(rearHits[0]?.distance<.5,'rear wall meets the ground across its width');
}
const mouthHits=new T.Raycaster(new T.Vector3(0,.32,2),new T.Vector3(0,0,-1)).intersectObject(kiln);
assert.ok(mouthHits[0]?.distance>2,'the open firemouth leads into the chamber');
const seat=kiln.getObjectByName('Earthen_kiln').userData.hearth;
for(const dx of [-.36,.03,.36]){
  const floor=new T.Raycaster(new T.Vector3(seat.x+dx,.6,seat.z),new T.Vector3(0,-1,0)).intersectObject(kiln);
  assert.ok(Math.abs(floor[0]?.point.y-seat.y)<.001,'the actual firing floor supports the base of the pot');
}
const yardBytes=await readFile(new URL('../asset/runtime/models/kiln-dressing-v3.glb',import.meta.url));
const {scene:yard}=await new GLTFLoader().parseAsync(Uint8Array.from(yardBytes).buffer,'');
yard.updateMatrixWorld(true);
const ground=yard.getObjectByName('Beaten_clay_yard_and_meadow_banks');
const down=new T.Vector3(0,-1,0);
for(let angle=0;angle<Math.PI*2;angle+=Math.PI/8){
  const probe=new T.Raycaster(new T.Vector3(11*Math.cos(angle),3,11*Math.sin(angle)),down);
  assert.ok(probe.intersectObject(ground).length,'the terrace continues around the full camera orbit');
}
const posts=[];
yard.traverse(o=>{if(o.isMesh&&o.name.startsWith('Round_timber_post'))posts.push(o);});
assert.equal(posts.length,4);
for(const post of posts){
  const b=new T.Box3().setFromObject(post,true),p=b.getCenter(new T.Vector3());
  const hit=new T.Raycaster(new T.Vector3(p.x,3,p.z),down).intersectObject(ground)[0];
  assert.ok(hit&&b.min.y<=hit.point.y+.01&&b.min.y>hit.point.y-.15,'a drying shelter post meets the bank');
}
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
const review=process.env.TOGI_REVIEW==='1'||process.env.TOGI_ART_REVIEW==='1';
const artifactReview=process.env.TOGI_ARTIFACT_REVIEW==='1';
const siruReview=process.env.TOGI_SIRU_REVIEW==='1';
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
  if(review||artifactReview||siruReview)await mkdir('asset/review',{recursive:true});
  await page.locator('[data-action="new"]').click();
  assert.equal(await page.evaluate(()=>window.togi.save.document.features.length),0,'the welcome study stays out of new artwork');
  const before=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
  for(const stage of ['body','firing','compare','excavation','assembly']){
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
      assert.equal(await page.evaluate(()=>window.togi.world.referenceArtifact.children.length),1,'only the game-authored example is displayed');
      const artifact=await page.evaluate(()=>{
        const w=window.togi.world,b=w.pottery.body.geometry.boundingBox.clone().makeEmpty();let vertices=0;
        w.referenceArtifact.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));vertices+=o.geometry.attributes.position.count;}});
        return {depth:b.max.z-b.min.z,bottom:b.min.y,vertices,photo:!!w.scene.getObjectByName('Actual artifact photograph'),plinths:w.art.model('gallery-fixtures').visible,outline:w.pottery.outline.visible};
      });
      assert.ok(artifact.depth>.8&&artifact.vertices>10000,'reference exhibit has a curved three-dimensional body');
      assert.ok(Math.abs(artifact.bottom)<.001,'reference vessel rests on the plinth');
      assert.equal(artifact.photo,false,'the static photograph no longer replaces the 3D exhibit');
      assert.equal(artifact.outline,false,'editing outline is absent in the gallery and exported photos');
      assert.equal(artifact.plinths,true,'permanent exhibit supports are visible');
      assert.ok((await page.locator('.gallery-disclosure').textContent()).includes('AI가 게임 도구로 만든'),'the example is visibly labelled as AI-authored');
      for(let face=0;face<3;face++){
        await page.evaluate(angle=>{window.togi.world.referenceArtifact.rotation.y=angle;window.togi.world.refresh(true);},-face*Math.PI*2/3);
        const glazing=await page.evaluate(()=>{
          const w=window.togi.world;w.scene.updateMatrixWorld(true);
          const bounds=(root,precise=false)=>{
            const b=w.pottery.body.geometry.boundingBox.clone().makeEmpty(),p=w.camera.position.clone();
            root.traverseVisible(o=>{if(!o.isMesh)return;
              if(precise){const positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++)b.expandByPoint(p.fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld));}
              else{o.geometry.computeBoundingBox();b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}
            });return b;
          };
          const own=w.scene.getObjectByName('own-exhibit-glass'),reference=w.scene.getObjectByName('reference-exhibit-glass');
          const caseBounds=reference&&bounds(reference),potBounds=bounds(w.referenceArtifact,true);
          return {own:own?.children.filter(o=>o.geometry?.type==='PlaneGeometry').length,reference:reference?.children.filter(o=>o.geometry?.type==='PlaneGeometry').length,contained:caseBounds?.clone().expandByScalar(.001).containsBox(potBounds),caseBounds,potBounds};
        });
        assert.equal(glazing.own,5);assert.equal(glazing.reference,5,'both exhibits have four glass walls and a lid');
        assert.ok(glazing.contained,`the rotating AI example fits inside its glass case: ${JSON.stringify(glazing)}`);
        if(review){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`asset/review/art-reference-face-${face+1}.png`});}
      }
      await page.evaluate(()=>{window.togi.world.referenceArtifact.rotation.y=0;window.togi.world.refresh(true);});
      if(artifactReview){
        await page.screenshot({path:'asset/review/ai-game-example-gallery.png'});
        // Render the same game-authored example at each of its three faces.
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
        for(let i=0;i<plates.length;i++)await writeFile(`asset/review/ai-game-example-${i===3?'underside':`face-${i+1}`}.png`,Buffer.from(plates[i].split(',')[1],'base64'));
      }
    }
    if(stage==='excavation'){
      const documentBefore=await page.evaluate(()=>JSON.stringify(window.togi.save.document));
      for(const viewport of [{width:1366,height:768},{width:740,height:360},{width:390,height:844},{width:768,height:1024}]){
        await page.setViewportSize(viewport);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        if(viewport.width===390){
          await page.evaluate(()=>{
            const w=window.togi.world;window.__reviewSoil=w.terrain.mask.slice();
            w.terrain.mask.fill(255);w.terrain.configure(w.terrain.mask,w.terrain.findBounds);w.setView('stage');
          });
          await page.screenshot({path:'asset/review/fitted-siru-excavation-mobile.png'});
          await page.evaluate(()=>{
            const w=window.togi.world;w.terrain.mask.set(window.__reviewSoil);
            w.terrain.configure(w.terrain.mask,w.terrain.findBounds);w.refresh();delete window.__reviewSoil;
          });
        }
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
      assert.equal(await page.evaluate(()=>{
        const materials=new Set();window.togi.world.siru.traverse(o=>{if(o.isMesh&&o.material.userData.siruSurface==='exterior')materials.add(o.material);});
        return materials.size>0&&[...materials].every(m=>m.map&&m.normalMap&&!m.bumpMap&&m.map.image.width===1024);
      }),true,'siru keeps its own grey-brown colour and impressed relief maps');
      if(siruReview)await page.screenshot({path:'asset/review/siru-v4-before-assembly.png'});
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
      if(siruReview){
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await page.screenshot({path:'asset/review/siru-v4-assembly.png'});
        const plates=await page.evaluate(()=>{
          const w=window.togi.world,scene=new w.scene.constructor(),siru=w.siru.clone(true);
          siru.position.set(0,0,0);scene.add(siru);scene.environment=w.scene.environment;scene.environmentIntensity=w.scene.environmentIntensity;
          const key=w.key.clone(),fill=w.fill.clone(),ambient=w.ambient.clone();
          key.position.set(-3,4,5);key.intensity=2.4;fill.position.set(4,2,3);fill.intensity=.75;ambient.intensity=1.1;scene.add(key,fill,ambient);
          const renderer=new w.renderer.constructor({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,700);renderer.setClearColor(0xe8e6e1,1);renderer.outputColorSpace=w.renderer.outputColorSpace;renderer.toneMapping=w.renderer.toneMapping;renderer.toneMappingExposure=w.renderer.toneMappingExposure;
          const camera=w.camera.clone();camera.fov=28;camera.aspect=640/700;camera.zoom=1;camera.near=.01;camera.far=100;camera.updateProjectionMatrix();
          const out=[];
          for(const eye of [[0,.60,2.6],[1.1,2.3,1.6]]){
            camera.position.set(...eye);camera.lookAt(0,.44,0);camera.updateMatrixWorld();renderer.render(scene,camera);out.push(renderer.domElement.toDataURL('image/png'));
          }
          renderer.dispose();return out;
        });
        for(let i=0;i<plates.length;i++)await writeFile(`asset/review/siru-v4-${i?'interior':'front'}.png`,Buffer.from(plates[i].split(',')[1],'base64'));
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await page.screenshot({path:'asset/review/siru-v4-assembly-portrait.png'});
        await page.setViewportSize({width:1366,height:768});
      }
    }
    if(stage==='firing'){
      const surfaces=await page.evaluate(()=>({
        valley:window.togi.world.art.textures.has('kiln-valley'),
        dig:window.togi.world.art.models.has('courtyard')
      }));
      assert.deepEqual(surfaces,{valley:true,dig:false},'entering the kiln loads its own landscape independently of excavation');
      const samples=await page.evaluate(()=>{
        const w=window.togi.world,root=w.pottery.root,bed=w.firingView.hearth;
        return [0,.08,.38,.68,.95,1].map(progress=>{
          w.setFiringProgress(progress);
          const gap=root.position.y+root.scale.y*w.pottery.body.geometry.boundingBox.min.y-bed.y;
          return {gap,center:[root.position.x-bed.x,root.position.z-bed.z],closed:w.firingView.shellVisible,fire:w.firingView.flames.visible};
        });
      });
      assert.ok(samples.every(s=>Math.abs(s.gap)<.001&&Math.hypot(...s.center)<.001),'pot stays seated through firing and cooling');
      assert.ok(samples[0].closed&&!samples[0].fire&&!samples[2].closed&&samples[2].fire,'automatic cutaway exposes the lit hearth');
      assert.ok(await page.evaluate(()=>window.togi.world.firingView.flames.geometry.attributes.color?.getX(0)>.7),'lit flames have a warm visible vertex colour');
      assert.ok(!samples.at(-1).closed&&!samples.at(-1).fire,'cooled piece stays on view, with the fire out');
      if(review){await page.evaluate(()=>window.togi.world.setFiringProgress(.42));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:'asset/review/art-firing-interior.png'});}
      await page.evaluate(()=>window.togi.world.setFiringProgress(null));
      assert.equal(await page.locator('[data-action="kiln-inside"]').count(),0,'firing has no manual interior-view control');
      assert.ok(await page.evaluate(()=>window.togi.world.firingView.shellVisible===(window.togi.save.firedRevision!==window.togi.save.document.revision)),'idle and completed visits restore the matching cutaway');
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
    return {shell:w.studioArchitecture.visible,back:w.walls.studio.find(o=>o.name==='Studio_window_wall')?.visible,
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
