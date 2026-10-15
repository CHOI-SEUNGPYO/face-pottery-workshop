import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {freshModel,validateModel} from '../src/model.js';
import {closedStroke,openingLoop,insideOpening} from '../src/openings.js';
import {bodyGeometry,openingWalls,WALL_THICKNESS} from '../src/body.js';
import {Interactions} from '../src/interactions.js';

const circle=Array.from({length:65},(_,i)=>[Math.cos(i/64*Math.PI*2)*.045, .5+Math.sin(i/64*Math.PI*2)*.1]);
test('drawing a closed face with the carve tool clears its centre instead of leaving a painted ring',()=>{
  const model=freshModel(),pottery={model,hit:(u,v)=>({uv:{x:u/1000,y:v/1000}}),update(){},render(){}};let commits=0;
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const interaction=new Interactions(pottery,surface,{setAttribute(){}},()=>commits++,()=>{});interaction.set(3,'carve');
  const e=p=>({button:0,pointerId:1,clientX:p[0]*1000,clientY:p[1]*1000,target:{closest:()=>null},preventDefault(){}});
  interaction.down(e(circle[0]));for(const p of circle.slice(1))interaction.move(e(p));interaction.up(e(circle.at(-1)));
  assert.equal(commits,1);assert.equal(model.marks[0].tool,'hole');
  const loops=model.marks.map(openingLoop);assert.equal(insideOpening(0,.5,loops),true);assert.equal(insideOpening(1,.5,loops),true);assert.equal(insideOpening(.07,.5,loops),false);
  assert.ok(validateModel(JSON.parse(JSON.stringify(model))));
  assert.equal(closedStroke(circle.slice(0,30)),false);assert.equal(openingLoop({tool:'carve',points:circle.slice(0,30)}),null);
  assert.ok(openingLoop({tool:'carve',points:circle}),'old closed carve strokes also open');
});

test('opening walls have real thickness while leaving the centre unobstructed, including the UV seam',()=>{
  const model=freshModel();model.marks=[{tool:'hole',points:circle}];
  const inner=bodyGeometry(model,true),loop=openingLoop(model.marks[0]),walls=openingWalls(model,inner,[loop]);
  const p=walls.attributes.position;assert.ok(p.count>0);assert.ok([...p.array].every(Number.isFinite));
  const outer=new THREE.Vector3().fromBufferAttribute(p,1),inside=new THREE.Vector3().fromBufferAttribute(p,2);
  assert.ok(Math.abs(outer.distanceTo(inside)-WALL_THICKNESS)<.001);
  const mesh=new THREE.Mesh(walls,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  assert.equal(new THREE.Raycaster(new THREE.Vector3(0,0,3),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length,0);
  assert.ok(insideOpening(0,.5,[loop]));inner.dispose();walls.dispose();mesh.material.dispose();
});
