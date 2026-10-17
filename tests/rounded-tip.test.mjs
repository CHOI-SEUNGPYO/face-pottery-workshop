import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,reshapeProfile,shapedRadius,profileY,ROWS,SURFACE_ROWS,COLS} from '../src/model.js';
import {bodyGeometry} from '../src/body.js';
import {topPoint,crownRadius} from '../src/crown.js';

test('narrowed ends close round, follow the edited neck and never flare into a separate cap',()=>{
  const model=freshModel();
  for(let pass=0;pass<3;pass++)for(const v of Array.from({length:21},(_,i)=>i/20))reshapeProfile(model,structuredClone(model),v,-.6,0);
  const saved=JSON.stringify(model),neck=shapedRadius(model,37,0);
  let previous=neck;
  for(let row=37;row<=40;row+=.05){const r=shapedRadius(model,row,0);assert.ok(r<=previous+1e-9);previous=r;}
  const slope=delta=>(delta/ROWS*2*model.height)/shapedRadius(model,ROWS-delta,0);
  assert.ok(slope(.01)<slope(.1)*.4,'slope must approach horizontal at the pole, unlike a cone');
  assert.ok(slope(ROWS/SURFACE_ROWS)<.35,'the final rendered segment must not look like a pointed cone');
  assert.equal(JSON.stringify(model),saved,'rendering must not modify saved edits');
  const wider=structuredClone(model);reshapeProfile(wider,model,.94,.3,0);
  assert.ok(shapedRadius(wider,39.5,0)>shapedRadius(model,39.5,0)*1.1,'round end grows with the edited neck while retaining material');
});

test('top openings and inside surface use the rounded surface at fractional profile heights',()=>{
  const model=freshModel();reshapeProfile(model,structuredClone(model),.94,-.5,0);
  const inner=bodyGeometry(model,true),p=inner.attributes.position;
  assert.equal(p.count,(SURFACE_ROWS+1)*(COLS+1));
  for(const row of [112,115,118,119]){
    const radius=shapedRadius(model,row/SURFACE_ROWS*ROWS,0);
    const point=topPoint(model,0,-radius/crownRadius(model));
    assert.ok(Math.abs(point[1]*model.height-profileY(model,row/SURFACE_ROWS))<1e-8,'opening lip must meet the actual asymmetric body height');
    assert.ok(Math.abs(Math.hypot(p.getX(row*(COLS+1)),p.getZ(row*(COLS+1)))-Math.max(0,radius-.11))<1e-6);
  }
  inner.dispose();
});
