import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,reshapeProfile,shapedRadius,createWorkshopHistory,validateModel,ROWS,COLS} from '../src/model.js';
import {bodyGeometry} from '../src/body.js';
import {Pottery} from '../src/pottery.js';

test('a thin upper or lower outline remains a width handle instead of being swallowed by the height handle',()=>{
  const pot=Object.create(Pottery.prototype);pot.stage=1;pot.tool='shape';pot.model=freshModel();
  for(let pass=0;pass<3;pass++)for(const v of [.1,.3,.5,.7,.9])reshapeProfile(pot.model,structuredClone(pot.model),v,-.6,0);
  pot.camera={left:-1.55,right:1.55};pot.renderer={domElement:{getBoundingClientRect:()=>({left:0,top:0,width:600,height:600})}};
  const scale=600/3.1;
  for(const row of [1,38]){
    const x=300+shapedRadius(pot.model,row,20)*scale,y=300-(row/ROWS*2-1)*pot.model.height*scale;
    assert.equal(pot.shapeGrab(x,y).end,0,'outline must change width');
    assert.notEqual(pot.shapeGrab(300,y).end,0,'centre must still change height');
  }
});

test('strong narrowing leaves neither a fixed crown nor a fixed foot, and a second grab starts at the visible profile',()=>{
  const model=freshModel();
  for(let pass=0;pass<3;pass++)for(const v of [.1,.3,.5,.7,.9])reshapeProfile(model,structuredClone(model),v,-.6,0);
  for(let row=0;row<ROWS-3;row++)assert.ok(Math.abs(shapedRadius(model,row,0)-.18)<1e-9,`ring ${row} must reach the same narrow radius`);
  for(let row=ROWS-3;row<=ROWS;row++)assert.ok(shapedRadius(model,row,0)<=shapedRadius(model,row-1,0),'closing tip cannot widen into a cap');
  const before=structuredClone(model);
  reshapeProfile(model,before,.85,0,0);
  assert.deepEqual(model,before,'starting a second grab must not reapply the base silhouette or smoothing');
  reshapeProfile(model,before,.85,.18,0);
  assert.ok(shapedRadius(model,34,0)>.3,'the upper outline must still be freely editable');
  assert.ok(Math.abs(shapedRadius(model,0,0)-before.profile[0])<1e-8,'editing the head must not manufacture a foot');
});

test('lathe mesh matches the stored outline through rotation, storage, stage undo and the bottom closure',()=>{
  const model=freshModel(),history=createWorkshopHistory();history.push(1,model);
  for(const v of [.5,.85,.1])reshapeProfile(model,structuredClone(model),v,-.5,0);
  const saved=structuredClone(model);history.push(1,model);
  reshapeProfile(model,structuredClone(model),.65,.4,.08);
  model.crown=[[0,.2],[.2,0],[0,-.2],[-.2,0]];model.marks=[{tool:'hole',points:[[.25,.5]]}];
  const restored=history.pop(1,model);assert.deepEqual(restored.profile,saved.profile);assert.deepEqual(restored.crown,model.crown);assert.deepEqual(restored.marks,model.marks);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(restored))),restored);
  const outer=bodyGeometry(restored),p=outer.attributes.position,uv=outer.attributes.uv;
  for(let i=0;i<outer.groups[0].count;i++){
    const row=Math.round(uv.getY(i)*ROWS);
    assert.ok(Math.abs(Math.hypot(p.getX(i),p.getZ(i))-restored.profile[row])<1e-6);
  }
  const bottom=outer.groups[2];
  for(let i=bottom.start;i<bottom.start+bottom.count;i++)assert.ok(Math.abs(p.getY(i)+restored.height)<1e-6);
  assert.equal(outer.groups[2].count,COLS*3);outer.dispose();
  const legacy=history.pop(1,restored);assert.equal(legacy.profile,undefined);assert.deepEqual(legacy.offsets,freshModel().offsets);
  assert.equal(validateModel({...restored,profile:[NaN]}),null);
});
