import test from 'node:test';
import assert from 'node:assert/strict';
import {reshapeProfile,shapedRadius,profileY,validateModel,createWorkshopHistory,ROWS,COLS} from '../src/model.js';
import {Pottery} from '../src/pottery.js';
import {foldedModel} from './folded-fixture.js';

test('unfolding a low pinch changes only the contacted clay and joins without overshooting',()=>{
  const before=foldedModel(),after=structuredClone(before);
  reshapeProfile(after,before,.125,.27,0);
  assert.ok(after.profile[5]>before.profile[5]+.1,'the pinched ring widens using neighbouring material');
  const crease=p=>p.slice(1,10).reduce((sum,r,i)=>sum+Math.abs(p[i]-2*r+p[i+2]),0);
  assert.ok(crease(after.profile)<crease(before.profile),'unfolding must reduce the crease instead of creating another collar');
  for(const row of [0,...Array.from({length:27},(_,i)=>i+14)])assert.equal(after.profile[row],before.profile[row],`remote ring ${row} must remain unchanged`);
  for(let row=0;row<37;row++)for(const f of [.1,.3,.5,.7,.9]){
    const r=shapedRadius(after,row+f,0);assert.ok(r>=Math.min(after.profile[row],after.profile[row+1])-1e-9&&r<=Math.max(after.profile[row],after.profile[row+1])+1e-9,'interpolation cannot invent another collar');
  }
  assert.equal(after.height,before.height);assert.ok(validateModel(after));
  for(let row=0;row<=ROWS;row++)assert.equal(new Set(after.offsets.slice(row*COLS,(row+1)*COLS)).size,1);
  const history=createWorkshopHistory();history.push(1,before);assert.deepEqual(history.pop(1,after).profile,before.profile);
  const saved=validateModel(JSON.parse(JSON.stringify(after)));reshapeProfile(after,saved,.125,0,0);assert.deepEqual(after,saved,'a second grab must not smooth or reset the whole silhouette');
});

test('vertical stretching transports a fold locally without reversing the material order, even with a very long drag',()=>{
  const before=foldedModel(),after=structuredClone(before);reshapeProfile(after,before,.125,0,.18);
  for(let row=17;row<=ROWS;row++)assert.equal(after.profile[row],before.profile[row]);
  assert.equal(after.profile[0],before.profile[0]);
  assert.ok(Math.abs(profileY(after,.125)-profileY(before,.125)-.18)<1e-8,'the pinched material must move with the hand');
  assert.equal(profileY(after,.6),profileY(before,.6),'the distant upper body must not move');
  for(const upward of [-20,-.4,.4,20]){
    const ordered=foldedModel();ordered.profile=Array.from({length:ROWS+1},(_,i)=>i===ROWS?0:.3+i*.02);
    const moved=structuredClone(ordered);reshapeProfile(moved,ordered,.5,0,upward);
    for(let row=1;row<=ROWS;row++)assert.ok(moved.profileLevels[row]>moved.profileLevels[row-1],'material heights must not fold back over their neighbours');
    assert.equal(moved.profile[0],ordered.profile[0]);assert.equal(moved.profile[ROWS],0);assert.ok(validateModel(moved));
  }
});

test('a low fold is a contour handle rather than a whole-body height handle',()=>{
  const pot=Object.create(Pottery.prototype);pot.stage=1;pot.tool='shape';pot.model=foldedModel();
  pot.camera={left:-1.55,right:1.55};pot.renderer={domElement:{getBoundingClientRect:()=>({left:0,top:0,width:600,height:600})}};
  const scale=600/3.1,v=.1,x=300+shapedRadius(pot.model,v*ROWS,20)*scale,y=300-(v*2-1)*pot.model.height*scale;
  const grab=pot.shapeGrab(x,y);assert.equal(grab.end,0);assert.ok(Math.abs(grab.v-v)<.002);
  assert.equal(pot.shapeGrab(300,300+pot.model.height*scale).end,-1);
});
