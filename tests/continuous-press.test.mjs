import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,reshapeProfile,profileY,validateModel,createWorkshopHistory,ROWS} from '../src/model.js';
import {bodyGeometry} from '../src/body.js';
import {topPoint} from '../src/crown.js';
import {Pottery} from '../src/pottery.js';
import {Interactions} from '../src/interactions.js';

test('pressing the top follows a long stroke past the old height limit and keeps the base planted',()=>{
  const before=freshModel(),short=structuredClone(before),shorter=structuredClone(before);
  reshapeProfile(short,before,1,0,-1.3,1);reshapeProfile(shorter,before,1,0,-1.9,1);
  assert.ok(Math.abs(profileY(shorter,1)-(profileY(before,1)-1.9))<1e-8);
  assert.ok(shorter.height<.65);assert.ok(profileY(shorter,1)<profileY(short,1)-.59);
  for(const model of [short,shorter]){
    assert.equal(profileY(model,0),profileY(before,0));assert.ok(validateModel(model));
    for(let row=1;row<=ROWS;row++)assert.ok(model.profileLevels[row]>model.profileLevels[row-1]);
  }
  const again=structuredClone(shorter);reshapeProfile(again,shorter,1,0,-.1,1);
  assert.ok(Math.abs(profileY(again,1)-profileY(shorter,1)+.1)<1e-8,'a new press continues from the actual top');
  const flat=structuredClone(before);reshapeProfile(flat,before,1,0,-20,1);
  assert.ok(Math.abs(profileY(flat,1)-profileY(flat,0)-.22)<1e-8);assert.ok(validateModel(flat));
  const flatAgain=structuredClone(flat);reshapeProfile(flatAgain,flat,.85,0,-.3);
  assert.ok(profileY(flatAgain,1)<=profileY(flat,1)+1e-8,'pressing a flattened shoulder must never push the top upward');
  reshapeProfile(shorter,before,1,0,0,1);assert.equal(shorter.profileLevels,undefined);assert.equal(shorter.height,before.height);
});

test('pressing the upper contour carries its top instead of leaving a tall fixed pole',()=>{
  const before=freshModel(),model=structuredClone(before);reshapeProfile(model,before,.85,0,-1.1);
  assert.ok(Math.abs(profileY(model,.85)-profileY(before,.85)+1.1)<1e-8);
  assert.ok(Math.abs(profileY(model,1)-profileY(before,1)+1.1)<1e-8);
  assert.equal(profileY(model,0),profileY(before,0));assert.ok(validateModel(model));
  const pot=Object.create(Pottery.prototype);pot.stage=1;pot.tool='shape';pot.model=model;
  pot.camera={left:-1.55,right:1.55};pot.renderer={domElement:{getBoundingClientRect:()=>({left:0,top:0,width:600,height:600})}};
  const y=300-profileY(model,1)*600/3.1;assert.equal(pot.shapeGrab(300,y).end,1,'the top handle must follow the moved top');
});

test('pressed material heights survive stage undo and storage and all body surfaces use them',()=>{
  const before=freshModel(),model=structuredClone(before),history=createWorkshopHistory();history.push(1,model);
  reshapeProfile(model,before,1,0,-1.6,1);model.crown=[[0,.2],[.2,0],[0,-.2],[-.2,0]];
  const saved=validateModel(JSON.parse(JSON.stringify(model)));assert.deepEqual(saved,model);
  const outer=bodyGeometry(saved),inner=bodyGeometry(saved,true);
  for(const [geometry,count] of [[outer,outer.groups[0].count],[inner,inner.attributes.position.count]]){
    const p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<count;i++)assert.ok(Math.abs(p.getY(i)-profileY(saved,uv.getY(i)))<1e-6);
  }
  const point=topPoint(saved,0,0);assert.ok(Math.abs(point[1]*saved.height-profileY(saved,1))<1e-8);
  const bottom=outer.groups[2],p=outer.attributes.position;
  for(let i=bottom.start;i<bottom.start+bottom.count;i++)assert.ok(Math.abs(p.getY(i)-profileY(saved,0))<1e-6);
  const restored=history.pop(1,saved);assert.equal(restored.profileLevels,undefined);assert.equal(restored.height,before.height);assert.deepEqual(restored.crown,saved.crown);
  const reversed=structuredClone(saved);reversed.profileLevels[20]=reversed.profileLevels[19];assert.equal(validateModel(reversed),null);
  assert.equal(validateModel({...saved,height:1.18}),null);assert.equal(validateModel({...saved,profileLevels:[NaN]}),null);
  outer.dispose();inner.dispose();
});

test('the real top-handle pointer follows the complete downward gesture and cancellation restores the artwork',()=>{
  const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;let pending;globalThis.requestAnimationFrame=fn=>{pending=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
  try{
    const before=freshModel(),pottery={model:structuredClone(before),hit:()=>null,shapeGrab:()=>({v:1,side:1,unitsPerPixel:.01,end:1}),update(){},refreshShape(){},render(){}};
    const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
    const input=new Interactions(pottery,surface,{setAttribute(){}},()=>{},()=>{}),e=y=>({button:0,pointerId:1,clientX:100,clientY:y,target:{closest:()=>null},preventDefault(){}});
    input.down(e(100));input.move(e(220));pending();const first=profileY(pottery.model,1);input.move(e(290));pending();
    assert.ok(Math.abs(profileY(pottery.model,1)-first+.7)<1e-8);assert.equal(profileY(pottery.model,0),profileY(before,0));
    input.cancel();assert.deepEqual(pottery.model,before);
  }finally{globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}
});
