import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from '../vendor/three.module.js';
import {bodyGeometry,openingWalls,EAR_RISE} from '../src/body.js';
import {openingLoop,raisedFootprint,openingFrame,insideLoop} from '../src/openings.js';
import {Interactions} from '../src/interactions.js';import {freshModel,shapedRadius,profileY} from '../src/model.js';
import {flaredFixture,concaveEar} from './regression-fixtures.js';

test('a concave pushed opening has an enclosing footprint and no triangles spanning its centre',()=>{
 const m=flaredFixture(),loop=openingLoop(concaveEar()),foot=raisedFootprint(loop,m),frame=openingFrame(loop,m),hole=loop.map(frame.toPlane),border=foot.map(frame.toPlane);
 for(const p of hole)assert.ok(insideLoop(...p,border),'the outer lobe must enclose the exact drawn hole');
 const inner=bodyGeometry(m,true),g=openingWalls(m,inner,[loop],[true]),p=g.attributes.position,uv=g.attributes.uv;
 assert.ok([...p.array].every(Number.isFinite));let longest=0;
 for(let i=0;i<g.index.count;i+=3){
  const ids=[0,1,2].map(k=>g.index.getX(i+k)),centre=[0,1].map(k=>ids.reduce((s,j)=>s+(k?uv.getY(j):uv.getX(j)),0)/3);
  const q=ids.map(j=>[uv.getX(j),uv.getY(j)]),area=Math.abs((q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]));
  if(area>1e-10)assert.equal(insideLoop(...centre,loop),false,'the triangulated skirt must not cover the drawn opening');
  for(let k=0;k<3;k++){const a=new THREE.Vector3().fromBufferAttribute(p,ids[k]),b=new THREE.Vector3().fromBufferAttribute(p,ids[(k+1)%3]);longest=Math.max(longest,a.distanceTo(b));}
 }
 assert.ok(longest<.4,`stretched triangle edge ${longest}`);g.dispose();inner.dispose();
});

test('the wall attaches to actual body triangles even on a steep, nonuniform profile',()=>{
 const m=flaredFixture(),loop=openingLoop({tool:'hole',points:[[.11,.16],[.15,.165],[.15,.21],[.11,.205],[.11,.16]]}),inner=bodyGeometry(m,true),walls=openingWalls(m,inner,[loop]),body=bodyGeometry(m);
 const mesh=new THREE.Mesh(body,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
 const p=walls.attributes.position,light=walls.attributes.color;
 for(let i=0;i<p.count;i+=3)if(light.getX(i)>.9){
  const point=new THREE.Vector3().fromBufferAttribute(p,i),direction=new THREE.Vector3(-point.x,0,-point.z).normalize(),ray=new THREE.Raycaster(point.clone().addScaledVector(direction,-2),direction),hits=ray.intersectObject(mesh).filter(h=>h.face.materialIndex===0);
  assert.ok(hits.length);assert.ok(hits[0].point.distanceTo(point)<1e-5,'wall rim must lie on the rendered surface');
 }
 inner.dispose();walls.dispose();body.dispose();mesh.material.dispose();
});

test('a stroke crossing empty space or jumping across folded surfaces is never bridged into a pushed hole',()=>{
 for(const mode of ['gap','surface-jump']){
  const m=freshModel();let saved=0;
  const pottery={model:m,camera:{left:-2,right:2},hit(x,y){if(mode==='gap'&&x===120)return null;return {uv:{x:x/1000,y:.6},point:new THREE.Vector3(x===130&&mode==='surface-jump'?2:x/1000,0,1)};},update(){},render(){}};
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:600}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const input=new Interactions(pottery,surface,{setAttribute(){}},()=>saved++,()=>{});input.set(3,'ear');
  const e=x=>({button:0,pointerId:1,clientX:x,clientY:100,target:{closest:()=>null},preventDefault(){}});
  input.down(e(100));for(const x of [110,120,130])input.move(e(x));input.up(e(130));assert.equal(m.marks.length,0,mode);assert.equal(saved,0);
 }
});

test('only erasing may sample the invisible original surface beneath existing openings',()=>{
 for(const tool of ['ear','carve','press','erase']){
  const includes=[],pot={model:freshModel(),hit(x,y,include){includes.push(include);return {uv:{x:.1,y:.6}};},update(){},render(){}};
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:600}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const input=new Interactions(pot,surface,{setAttribute(){}},()=>{},()=>{});input.set(3,tool);const e={button:0,pointerId:1,clientX:100,clientY:100,target:{closest:()=>null},preventDefault(){}};
  input.down(e);input.up(e);assert.ok(includes.length>1);assert.ok(includes.every(value=>value===(tool==='erase')));
 }
});

test('a tap remains a local physical opening rather than a fixed UV stencil on stretched or folded clay',()=>{
 const m=flaredFixture();
 for(const v of [.14,.3,.7]){
  const loop=openingLoop({tool:'ear',points:[[0,v]]},m),points=loop.map(([u,t])=>{
   const r=shapedRadius(m,t*40,0),a=u*Math.PI*2;return new THREE.Vector3(Math.sin(a)*r,profileY(m,t),Math.cos(a)*r);
  });
  let diameter=0;for(const p of points)for(const q of points)diameter=Math.max(diameter,p.distanceTo(q));
  assert.ok(diameter<.35&&diameter>.1,`local tap diameter ${diameter} at ${v}`);
 }
});
