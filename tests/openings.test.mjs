import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {freshModel,validateModel} from '../src/model.js';
import {closedStroke,openingLoop,insideOpening} from '../src/openings.js';
import {bodyGeometry,openingWalls,WALL_THICKNESS} from '../src/body.js';
import {Interactions} from '../src/interactions.js';

const circle=Array.from({length:65},(_,i)=>[Math.cos(i/64*Math.PI*2)*.045, .5+Math.sin(i/64*Math.PI*2)*.1]);

test('small eyes with a slight closing gap open through the real drawing handler, while an open arc stays a groove',()=>{
  for(const [turns,expected] of [[.9,'hole'],[.5,'carve']]){
    const points=Array.from({length:35},(_,i)=>[.998+Math.cos(i/34*Math.PI*2*turns)*.006,.78+Math.sin(i/34*Math.PI*2*turns)*.012]);
    const model=freshModel(),fills=[],pottery={model,hit:(x,y)=>({uv:{x:(x/1000+1)%1,y:y/1000}}),update(){},render(){}};
    const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
    const input=new Interactions(pottery,surface,{setAttribute(key,value){if(key==='fill')fills.push(value);}},()=>{},()=>{});input.set(3,'carve');
    const event=p=>({button:0,pointerId:1,clientX:p[0]*1000,clientY:p[1]*1000,target:{closest:()=>null},preventDefault(){}});
    input.down(event(points[0]));for(const p of points.slice(1))input.move(event(p));input.up(event(points.at(-1)));
    assert.equal(model.marks[0].tool,expected);
    assert.equal(fills.at(-1),expected==='hole'?'#3e2a1b88':'none','preview and finished hole must agree');
    if(expected==='hole'){
      assert.ok(insideOpening(.998,.78,[openingLoop(model.marks[0])]),'the small eye centre must be empty');
      assert.ok(openingLoop({tool:'carve',points}),'existing nearly closed grooves also become openings');
      assert.ok(validateModel(JSON.parse(JSON.stringify(model))));
    }
  }
});
test('drawing a closed face with the carve tool clears its centre instead of leaving a painted ring',()=>{
  const model=freshModel(),pottery={model,hit:(u,v)=>({uv:{x:u/1000,y:v/1000}}),update(){},render(){}};let commits=0;
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const interaction=new Interactions(pottery,surface,{setAttribute(){}},()=>commits++,()=>{});interaction.set(3,'carve');
  const e=p=>({button:0,pointerId:1,clientX:p[0]*1000,clientY:p[1]*1000,target:{closest:()=>null},preventDefault(){}});
  interaction.down(e(circle[0]));for(const p of circle.slice(1))interaction.move(e(p));interaction.up(e(circle.at(-1)));
  assert.equal(commits,1);assert.equal(model.marks[0].tool,'hole');
  const loops=model.marks.map(mark=>openingLoop(mark,model));assert.equal(insideOpening(0,.5,loops),true);assert.equal(insideOpening(1,.5,loops),true);assert.equal(insideOpening(.07,.5,loops),false);
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
