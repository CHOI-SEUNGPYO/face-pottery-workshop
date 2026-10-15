import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {freshModel,area,sculptProfile,validateModel,shapedRadius} from '../src/model.js';
import {strokeContour} from '../src/contour.js';
import {crownGeometry,topPoint} from '../src/crown.js';
import {bodyGeometry} from '../src/body.js';
import {Interactions} from '../src/interactions.js';

const outline=Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,r=i%2?.33:.78;return [Math.cos(a)*r,Math.sin(a)*r];});
const crossed=[0,4,8,2,6].map(i=>outline[i]);
const event=(p,id=1)=>({button:0,pointerId:id,clientX:p[0],clientY:p[1],target:{closest:()=>null},preventDefault(){}});

test('a closed star survives the real pointer handler, both as an outline and a crossed stroke',()=>{
  for(const input of [outline,crossed]){
    const model=freshModel();let commits=0;
    const pottery={model,hit:()=>null,crownPoint:(x,y)=>[x,y],update(){},render(){}};
    const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
    const interaction=new Interactions(pottery,surface,{setAttribute(){}},()=>commits++,()=>{});interaction.set(2,'crown');
    interaction.down(event(input[0]));for(const p of input.slice(1))interaction.move(event(p));interaction.up(event(input[0]));
    assert.equal(commits,1);assert.ok(area(model.crown)>.6);assert.ok(area(model.crown)<1.5);
    const radii=model.crown.map(p=>Math.hypot(...p));assert.ok(Math.min(...radii)<.45);assert.ok(Math.max(...radii)>.74,'star tips must not turn into a circle');assert.ok(Math.max(...radii)<.98);
    assert.ok(validateModel(JSON.parse(JSON.stringify(model))));
    const mesh=new THREE.Mesh(crownGeometry(model),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
    const hit=(x,y)=>{const point=topPoint(model,x,y);return new THREE.Raycaster(new THREE.Vector3(point[0],3,point[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh).length>0;};
    assert.equal(hit(0,0),false,'the star centre must be open');
    assert.equal(hit(0,.62),false,'the star tip must be open');
    const a=Math.PI/2+Math.PI/5;assert.equal(hit(Math.cos(a)*.57,Math.sin(a)*.57),true,'clay must remain between the points');
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    mesh.geometry.dispose();mesh.material.dispose();
  }
});

test('an off-centre crown contour stays where it was drawn; outside input is not silently resized',()=>{
  const contour=outline.map(([x,y])=>[x*.5+.3,y*.5]);assert.deepEqual(strokeContour(contour),contour);
  const model=freshModel();model.crown=contour;let commits=0,message='';
  const pottery={model,hit:()=>null,crownPoint:(x,y)=>[x,y],update(){},render(){}};
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const input=new Interactions(pottery,surface,{setAttribute(){}},()=>commits++,text=>message=text);input.set(2,'crown');
  input.down(event([.5,0]));input.move(event([1.1,.3]));input.move(event([.4,.5]));input.up(event([.5,0]));
  assert.equal(commits,0);assert.deepEqual(model.crown,contour);assert.match(message,/가장자리/);
});

test('tiny strokes do not create circles; nearly closed shapes retain corners',()=>{
  assert.deepEqual(strokeContour([[0,0],[.001,.002],[0,0]]),[]);
  assert.deepEqual(strokeContour([[-.5,0],[.5,0]]),[]);
  const square=strokeContour([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[-.5,-.46]]);
  assert.ok(area(square)>.95);assert.ok(square.length<=8);
});

test('grabbing a side visibly changes a broad silhouette without breaking the shoulder',()=>{
  const m=freshModel();sculptProfile(m,.25,.45,.3);
  assert.ok(m.offsets[18*80+20]>.29);
  assert.ok(m.offsets[14*80+20]>.1,'neighbouring clay must move together');
  assert.equal(m.offsets[32*80+20],0,'the shoulder remains joined to the crown');
  for(let i=0;i<30;i++)sculptProfile(m,.25,.45,.3);assert.ok(validateModel(m));
});

test('shoulder and base stay attached after repeated pressing and height changes',()=>{
  const model=freshModel();
  model.marks=Array.from({length:120},(_,i)=>({tool:'press',points:[[i%2?.25:.75,i%3?.79:.05]]}));
  for(const height of [.65,1,1.45]){
    model.height=height;const mesh=bodyGeometry(model),p=mesh.attributes.position,uv=mesh.attributes.uv;
    assert.ok([...p.array].every(Number.isFinite));
    for(let i=0;i<mesh.groups[0].count;i++){
      if(Math.abs(uv.getY(i)-.8)<1e-6){
        const a=uv.getX(i)*Math.PI*2,top=topPoint(model,Math.sin(a),-Math.cos(a));
        assert.ok(Math.hypot(p.getX(i)-top[0],p.getY(i)-top[1]*height,p.getZ(i)-top[2])<1e-5,'shoulder boundary must be identical');
      }
      if(uv.getY(i)===0)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getZ(i))-.54)<1e-6,'bottom must not shrink away from its closure');
    }
    mesh.dispose();
  }
});

test('old heavily narrowed saves do not leave a fixed crown or a foot flange',()=>{
  const m=freshModel();for(let row=2;row<38;row++)for(let col=0;col<80;col++)m.offsets[row*80+col]=-.38;
  const before=JSON.stringify(m);
  for(let col=0;col<80;col++){
    assert.ok(shapedRadius(m,0,col)<shapedRadius(m,1,col),'foot must taper inward');
    assert.ok(shapedRadius(m,32,col)<shapedRadius(m,31,col),'crown must taper inward');
    const a=col/80*Math.PI*2,top=topPoint(m,Math.sin(a),-Math.cos(a));
    assert.ok(Math.abs(Math.hypot(top[0],top[2])-shapedRadius(m,32,col))<1e-6);
  }
  assert.equal(JSON.stringify(m),before,'rendering must preserve the saved artwork');
});
