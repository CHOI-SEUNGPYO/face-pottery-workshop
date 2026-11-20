import assert from 'node:assert/strict';

export async function checkSiruFit(page, drag) {
  const burial = await page.evaluate(async () => {
    const {save, world: w, go} = window.togi;
    const {createSoftDocument, applyForm} = await import('/src/form.ts');
    const {SOIL_WIDTH, SOIL_DEPTH} = await import('/src/soil.ts');
    const doc = createSoftDocument();
    applyForm(doc, {width:1.4, height:1.65, radii:[.5,.5,.49,.5,.46,.32,.14]});
    doc.features.push({id:'lip',kind:'raised-hole',width:.006,
      points:Array.from({length:32}, (_, i) => [.25+.04*Math.cos(i*Math.PI/16), .53+.035*Math.sin(i*Math.PI/16)])});
    save.document = doc;
    save.rotation = .47;
    save.assembledRevision = null;
    save.excavationLayout = 'terrain-v1';
    save.excavationMask.fill(0);
    // Two exposed patches from the old, overlapping layout.
    const pixel = (x, z) => Math.round((z/SOIL_DEPTH+.5)*255)*256 + Math.round((x/SOIL_WIDTH+.5)*255);
    for (const [x,z] of [[-.58,-.35],[.62,-.85]]) {
      const center = pixel(x,z);
      for (let row=-4; row<=4; row++) save.excavationMask.fill(188, center+256*row-4, center+256*row+5);
    }
    const oldMask = save.excavationMask.slice();
    window.__siruDocument = JSON.stringify(doc);
    await go('excavation');
    w.scene.updateMatrixWorld(true);
    window.__siruBounds = root => {
      root.updateWorldMatrix(true,true);
      const box = w.pottery.body.geometry.boundingBox.clone().makeEmpty();
      root.traverseVisible(mesh => { if (mesh.isMesh) box.expandByObject(mesh,true); });
      return box;
    };
    const boxes = [w.pottery.root, w.siru].map(window.__siruBounds);
    const targets = w.terrain.findBounds;
    const mask = save.excavationMask.slice();
    const counts = w.coverage();
    w.setStage('excavation',true);
    return {
      gap: boxes[1].min.x-boxes[0].max.x,
      fits: boxes.every(b => Math.hypot(Math.max(-b.min.x,b.max.x)/(SOIL_WIDTH/2),
        Math.max(-b.min.z,b.max.z)/(SOIL_DEPTH/2)) < .84),
      floor: boxes.map(b => b.min.y),
      matching: boxes.every((b,i) => Math.abs(b.min.x-targets[i].minX)<.001 &&
        Math.abs(b.max.x-targets[i].maxX)<.001 && Math.abs(b.max.y-targets[i].top)<.001),
      carried: targets.map(t => mask[pixel((t.minX+t.maxX)/2,(t.minZ+t.maxZ)/2)]),
      retained: mask.every((v,i) => v >= oldMask[i]) && save.excavationMask.every((v,i) => v === mask[i]),
      layout: save.excavationLayout, counts, scales: [w.pottery.root.scale.x,w.siru.scale.x],
    };
  });
  assert.ok(burial.gap > .15 && burial.fits, 'both large finds fit separately inside the pit');
  assert.ok(burial.floor.every(y => Math.abs(y+.23)<.001) && burial.matching, 'brush targets coincide with the resting finds');
  assert.equal(burial.layout,'terrain-v2');
  assert.ok(burial.retained && burial.carried.every(v => v===188) && burial.counts.every(n=>n>0),
    'previously cleared soil is retained on the ground and on each moved find');

  for (const i of [0,1]) {
    const stroke = await page.evaluate(i => {
      const w = window.togi.world, t = w.terrain.findBounds[i];
      const z = t.minZ + .62 * (t.maxZ-t.minZ);
      const project = x => {
        const p = w.camera.position.clone().set(x,w.terrain.heightAt(x,z),z).project(w.camera);
        return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
      };
      const x = (t.minX+t.maxX)/2;
      return {from:project(x-.07),to:project(x+.07),before:w.coverage()};
    },i);
    await drag(page,stroke.from,stroke.to);
    const after = await page.evaluate(() => window.togi.world.coverage());
    assert.ok(after[i]>stroke.before[i] && after[1-i]===stroke.before[1-i], 'brushing one large find only uncovers that find');
  }
  const next = page.locator('[data-action="next"]');
  for (let i=0; i<20 && await next.isDisabled(); i++) await page.locator('[data-action="assist"]').click();
  assert.equal(await next.isEnabled(),true,'both large finds can be discovered');
  if (page.viewportSize().width===390) await page.screenshot({path:'asset/review/large-finds-portrait.png'});
  await next.click();
  await page.waitForFunction(() => window.togi.stage==='assembly' && !window.togi.world.transitioning);
  const bench = await page.evaluate(() => {
    const w = window.togi.world, pot = w.pottery.root;
    const bounds = window.__siruBounds;
    const a = bounds(pot), b = bounds(w.siru), table = bounds(w.assemblyBench);
    const screen = p => {p.project(w.camera); return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};};
    const grip = pot.position.clone(); grip.y += .48*pot.scale.y;
    const rim = w.siru.position.clone(); rim.y = w.assemblyHeight;
    return {from:screen(grip), rim:screen(rim), rest:[...pot.position], gap:b.min.x-a.max.x,
      supported: [a,b].every(box => Math.abs(box.min.y-table.max.y)<.001 && box.min.x>table.min.x &&
        box.max.x<table.max.x && box.min.z>table.min.z && box.max.z<table.max.z),
      scales:[pot.scale.x,w.siru.scale.x]};
  });
  assert.deepEqual(bench.scales, burial.scales);
  assert.ok(bench.gap > .15 && bench.supported, 'the large pot and steamer start apart on the tabletop');
  const {from,rim} = bench;
  await drag(page, from, {x:from.x+(rim.x-from.x)*.28, y:from.y});
  assert.deepEqual(await page.evaluate(() => [...window.togi.world.pottery.root.position]), bench.rest, 'a short drag returns to the same spot');
  assert.equal(await page.locator('[data-action="next"]').isDisabled(),true);
  // A player carries it sideways, never moving the pointer up to the rim's precise screen pixel.
  await drag(page, from, {x:rim.x,y:from.y});
  await page.waitForFunction(() => window.togi.save.assembledRevision === window.togi.save.document.revision);
  const seated = await page.evaluate(() => {
    const {world:w,save} = window.togi;
    const box = window.__siruBounds;
    return {contact:box(w.pottery.root).min.y-box(w.siru).max.y,
      centered:w.pottery.root.position.x===w.siru.position.x && w.pottery.root.position.z===w.siru.position.z,
      unchanged:JSON.stringify(save.document)===window.__siruDocument};
  });
  assert.ok(seated.centered && Math.abs(seated.contact)<.001 && seated.unchanged,'a sideways release seats the unmodified artwork on the rim');
  if (page.viewportSize().width===390) await page.screenshot({path:'asset/review/large-siru-seated-portrait.png'});

  const shoulder = await page.evaluate(async () => {
    const {world:w,save,go} = window.togi;
    const {applyForm} = await import('/src/form.ts');
    applyForm(save.document,{height:1.65,width:1.4,radii:[.1,.36,.48,.5,.48,.35,.15]});
    save.assembledRevision = null;
    await go('assembly');
    w.setView('angle');
    const screen = p => {p.project(w.camera); return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};};
    const grab = w.pottery.root.localToWorld(w.camera.position.clone().set(.3,.67,0));
    const from = screen(grab), rim = screen(w.siru.position.clone().setY(w.assemblyHeight));
    return {from,to:{x:rim.x,y:from.y},onClay:!!w.hit(from.x,from.y,false,true)};
  });
  assert.ok(shoulder.onClay,'the off-centre grip is on the wide body');
  await drag(page,shoulder.from,shoulder.to);
  await page.waitForFunction(() => window.togi.save.assembledRevision===window.togi.save.document.revision);
}
