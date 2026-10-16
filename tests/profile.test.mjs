import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,reshapeProfile,createHistory,validateModel,shapedRadius} from '../src/model.js';
import {Pottery} from '../src/pottery.js';
import {Interactions} from '../src/interactions.js';

test('profile can leave the original silhouette without losing circular rings or saved artwork',()=>{
  const initial=freshModel(),wide=freshModel(),narrow=freshModel();
  reshapeProfile(wide,initial,.3,1,0);
  reshapeProfile(narrow,initial,.65,-1,0);
  assert.ok(wide.offsets[12*80]>.5,'can widen beyond the old base-relative limit');
  assert.ok(narrow.offsets[26*80]<-.38,'can narrow the original belly beyond the old limit');
  for(const model of [wide,narrow]){
    for(let row=0;row<=40;row++)assert.equal(new Set(model.offsets.slice(row*80,(row+1)*80)).size,1);
    assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
    const history=createHistory();history.push(initial);history.push(model);assert.deepEqual(history.pop(),model);assert.deepEqual(history.pop(),initial);
  }
});

test('local profile gestures keep circular rings, move a bulge vertically, and survive undo/save',()=>{
  const original=freshModel(),wide=freshModel();reshapeProfile(wide,original,.4,.28,0);
  assert.ok(shapedRadius(wide,16,0)-shapedRadius(original,16,0)>.2);
  assert.ok(Math.abs(shapedRadius(wide,5,0)-shapedRadius(original,5,0))<.04,'faraway clay moves much less than the grabbed area');
  for(let row=0;row<=40;row++)assert.equal(new Set(wide.offsets.slice(row*80,(row+1)*80)).size,1);
  const moved=structuredClone(wide),shiftedBase=structuredClone(original);reshapeProfile(moved,wide,.4,0,.15);reshapeProfile(shiftedBase,original,.4,0,.15);
  const centre=(m,base)=>{let sum=0,weighted=0;for(let row=0;row<=40;row++){const d=Math.max(0,m.offsets[row*80]-base.offsets[row*80]);sum+=d;weighted+=d*row;}return weighted/sum;};
  assert.ok(centre(moved,shiftedBase)>centre(wide,original)+.7,'upward drag moves the added fullness upward');
  assert.ok(validateModel(JSON.parse(JSON.stringify(moved))));
  const history=createHistory();history.push(wide);history.push(moved);assert.deepEqual(history.pop(),moved);assert.deepEqual(history.pop(),wide);
  const legacy=freshModel();legacy.offsets[16*80+3]=.3;const before=structuredClone(legacy);reshapeProfile(legacy,before,.5,.1,0);
  for(let row=0;row<=40;row++)assert.equal(new Set(legacy.offsets.slice(row*80,(row+1)*80)).size,1);
  assert.equal(before.offsets[16*80+3],.3);
});

test('front edit blocks rotation and mode switches restore the viewing angle without editing the model',()=>{
  const pot=Object.create(Pottery.prototype);pot.stage=1;pot.tool='shape';pot.angle=1.2;pot.pot={rotation:{y:0}};pot.render=()=>{};
  let layouts=0;pot.layout=()=>{layouts++;pot.pot.rotation.y=pot.profileView?0:pot.angle;};
  pot.rotate(1);assert.equal(pot.angle,1.2);
  pot.setTool('rotate');assert.equal(pot.pot.rotation.y,1.2);pot.rotate(7);assert.equal(pot.angle,8.2);
  pot.setTool('shape');assert.equal(pot.pot.rotation.y,0);assert.equal(layouts,2);
  pot.stage=3;assert.equal(pot.profileView,false);
});

test('real profile pointer gesture is symmetric and cancelling restores the starting artwork',()=>{
  const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  try{
    const original=freshModel();let commits=0;
    const pottery={model:structuredClone(original),hit:()=>null,shapeGrab:()=>({v:.4,side:1,unitsPerPixel:.01,end:0}),update(){},render(){}};
    const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
    const interaction=new Interactions(pottery,surface,{setAttribute(){}},()=>commits++,()=>{});
    const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,target:{closest:()=>null},preventDefault(){}});
    interaction.down(event(100,100));interaction.move(event(125,90));interaction.up(event(125,90));assert.equal(commits,1);
    for(let col=1;col<80;col++)assert.equal(pottery.model.offsets[16*80+col],pottery.model.offsets[16*80]);
    const saved=structuredClone(pottery.model);interaction.down(event(100,100));interaction.move(event(80,120));interaction.cancel();assert.deepEqual(pottery.model,saved);
  }finally{globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}
});
