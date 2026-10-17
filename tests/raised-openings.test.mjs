import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {freshModel,validateModel,eraseAt,createWorkshopHistory,shapedRadius,ROWS} from '../src/model.js';
import {openingLoop,raisedFootprint,insideOpening} from '../src/openings.js';
import {bodyGeometry,openingWalls,EAR_RISE} from '../src/body.js';
import {Interactions} from '../src/interactions.js';
import {stages} from '../src/content.js';

function draw(tool,points){
  const model=freshModel(),pottery={model,hit:(x,y)=>({uv:{x:x/1000,y:y/1000}}),update(){},render(){}};
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const input=new Interactions(pottery,surface,{setAttribute(){}},()=>{},()=>{});input.set(3,tool);
  const event=p=>({button:0,pointerId:1,clientX:p[0]*1000,clientY:p[1]*1000,target:{closest:()=>null},preventDefault(){}});
  input.down(event(points[0]));for(const p of points.slice(1))input.move(event(p));input.up(event(points.at(-1)));return model;
}

test('one carving control handles taps, open grooves and closed holes, separately from raised openings',()=>{
  assert.ok(!stages[3].tools.some(([id])=>id==='hole'));
  assert.equal(draw('carve',[[.1,.6]]).marks[0].tool,'hole');
  assert.equal(draw('carve',[[.1,.6],[.12,.63],[.14,.63]]).marks[0].tool,'carve');
  const loop=[[.1,.6],[.15,.6],[.15,.65],[.1,.65],[.1,.6]];
  assert.equal(draw('carve',loop).marks[0].tool,'hole');
  const ear=draw('ear',[[.99,.8]]);assert.equal(ear.marks[0].tool,'ear');
  const saved=validateModel(JSON.parse(JSON.stringify(ear)));assert.deepEqual(saved,ear);
  const history=createWorkshopHistory();history.push(3,saved);eraseAt(saved,.99,.85);
  assert.equal(saved.marks.length,0);assert.equal(history.pop(3,saved).marks[0].tool,'ear');
});

test('raised openings extend outward, retain an open tunnel and wrap around the UV seam',()=>{
  const model=draw('ear',[[0,.65]]),loop=openingLoop(model.marks[0]),foot=raisedFootprint(loop),inner=bodyGeometry(model,true);
  assert.ok(insideOpening(.999,.65,[loop]));assert.ok(insideOpening(.02,.65,[foot]));
  const ordinary=openingWalls(model,inner,[loop]),raised=openingWalls(model,inner,[loop],[true]);
  assert.ok([...raised.attributes.position.array].every(Number.isFinite));
  const maxRadius=g=>Math.max(...Array.from({length:g.attributes.position.count},(_,i)=>Math.hypot(g.attributes.position.getX(i),g.attributes.position.getZ(i))));
  assert.ok(maxRadius(raised)>maxRadius(ordinary)+EAR_RISE*.85);
  const mesh=new THREE.Mesh(raised,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  const ray=new THREE.Raycaster(new THREE.Vector3(0,(.65*2-1)*model.height,3),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(mesh).length,0,'the projected centre must stay open');
  const atEdge=new THREE.Raycaster(new THREE.Vector3(.13,(.65*2-1)*model.height,3),new THREE.Vector3(0,0,-1));
  assert.ok(atEdge.intersectObject(mesh).length>0,'the lifted skirt must have a real surface');
  inner.dispose();ordinary.dispose();raised.dispose();mesh.material.dispose();
});

test('raised mouth lifts upward with the shoulder while its skirt remains attached to the body',()=>{
  const model=draw('ear',[[0,.78]]),loop=openingLoop(model.marks[0]),inner=bodyGeometry(model,true);
  const ordinary=openingWalls(model,inner,[loop]),raised=openingWalls(model,inner,[loop],[true]);
  const heights=g=>{
    const result=new Map(),p=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++){
      const key=[uv.getX(i),uv.getY(i)].map(n=>n.toFixed(5)).join(',');
      result.set(key,Math.max(result.get(key)??-Infinity,p.getY(i)));
    }
    return result;
  };
  const baseline=heights(ordinary),lifted=heights(raised);
  for(const [key,y] of baseline)assert.ok(lifted.get(key)>y+.05,'mouth must tilt upward rather than project horizontally');
  const wall=raised.attributes.position;
  assert.ok([...wall.array].every(Number.isFinite));
  const row=.78*ROWS,tilt=Math.max(.35,Math.min(.9,(shapedRadius(model,row-1,0)-shapedRadius(model,row+1,0))/(4*model.height/ROWS)));
  const centre=new THREE.Vector3(0,(.78*2-1)*model.height,shapedRadius(model,row,0));
  const direction=new THREE.Vector3(0,-tilt,-1).normalize();
  const ray=new THREE.Raycaster(centre.clone().addScaledVector(direction,-3),direction);
  const mesh=new THREE.Mesh(raised,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  assert.equal(ray.intersectObject(mesh).length,0,'raised centre must remain a tunnel');
  inner.dispose();ordinary.dispose();raised.dispose();mesh.material.dispose();
});
