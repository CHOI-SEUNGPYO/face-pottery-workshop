import assert from 'node:assert/strict';

// Runs in a disposable journey context, after the normal player flow.
export async function checkExhibitFit(page) {
  const result = await page.evaluate(async () => {
    const { world, save } = window.togi;
    const { createSoftDocument, applyForm } = await import('/src/form.ts');
    const { photoScene } = await import('/src/photo-scene.ts');
    const doc = createSoftDocument();
    applyForm(doc, {height:1.65,width:1.4,radii:[.24,.43,.54,.60,.54,.35,.16]});
    doc.features.push({id:'projecting-mouth',kind:'raised-hole',width:.006,
      points:Array.from({length:32},(_,i)=>[.17+.05*Math.cos(i*Math.PI/16),.5+.035*Math.sin(i*Math.PI/16)])});
    save.document = doc;
    const original = JSON.stringify(doc);
    const own = world.pottery.root;
    const box = () => world.pottery.body.geometry.boundingBox.clone().makeEmpty();
    function checkRotation(artwork, panes) {
      const enclosure = box();
      for (const pane of panes.children.filter(o=>o.geometry?.type==='PlaneGeometry'))
        enclosure.expandByObject(pane,true);
      const rotation = artwork.rotation.y;
      let gap = Infinity, foot = 0;
      for(let i=0;i<24;i++) {
        artwork.rotation.y = rotation + i*Math.PI/12;
        artwork.updateWorldMatrix(true,true);
        const bounds = box(), point=world.camera.position.clone();
        artwork.traverseVisible(mesh=>{
          if(!mesh.isMesh)return;
          const vertices=mesh.geometry.getAttribute('position');
          for(let j=0;j<vertices.count;j++)
            bounds.expandByPoint(point.fromBufferAttribute(vertices,j).applyMatrix4(mesh.matrixWorld));
        });
        gap = Math.min(gap,bounds.min.x-enclosure.min.x,enclosure.max.x-bounds.max.x,
          bounds.min.z-enclosure.min.z,enclosure.max.z-bounds.max.z,enclosure.max.y-bounds.max.y);
        foot = Math.max(foot,Math.abs(bounds.min.y-enclosure.min.y));
      }
      artwork.rotation.y = rotation;
      return {gap,foot};
    }
    const displays = [];
    for(const stage of ['compare','ending']) {
      world.setStage(stage,true);
      world.scene.updateMatrixWorld(true);
      displays.push(checkRotation(own,world.scene.getObjectByName('own-exhibit-glass')));
    }
    const photo = photoScene(own,world.scene.environment,world.camera.position,world.art.texture('limestone'));
    try {
      photo.scene.updateMatrixWorld(true);
      displays.push(checkRotation(photo.own,photo.scene.getObjectByName('Own display case and plinth')));
    } finally { photo.dispose(); }
    const galleryScale=own.scale.x;
    world.setStage('body',true);
    return {displays,galleryScale,editScale:own.scale.x,unchanged:JSON.stringify(doc)===original};
  });
  assert.ok(result.galleryScale<1,'oversized fixture exercises fitting');
  for(const [i,{gap,foot}] of result.displays.entries()){
    assert.ok(gap>.04,`pottery needs clearance at every angle in ${['compare','ending','photo'][i]}, got ${gap}`);
    assert.ok(foot<.0001,`pottery should rest on the plinth, gap ${foot}`);
  }
  assert.equal(result.editScale,1);
  assert.ok(result.unchanged,'display fitting preserves the artwork document');
}
