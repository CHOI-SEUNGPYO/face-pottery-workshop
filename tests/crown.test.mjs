import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {freshModel,area,reshapeProfile,validateModel,shapedRadius} from '../src/model.js';
import {strokeContour} from '../src/contour.js';
import {crownGeometry,topPoint,mouthCut,insideMouth} from '../src/crown.js';
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
    const mesh=new THREE.Mesh(bodyGeometry(model),Array.from({length:3},()=>new THREE.MeshBasicMaterial({side:THREE.DoubleSide})));mesh.updateMatrixWorld();
    const cut=mouthCut(model);
    const hit=(x,y)=>{const point=topPoint(model,x,y);return new THREE.Raycaster(new THREE.Vector3(point[0],3,point[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh).some(h=>h.point.y>0&&(h.face.materialIndex!==0||!insideMouth(h.point,cut)));};
    assert.equal(hit(0,0),false,'the star centre must be open');
    assert.equal(hit(0,.62),false,'the star tip must be open');
    const a=Math.PI/2+Math.PI/5;assert.equal(hit(Math.cos(a)*.57,Math.sin(a)*.57),true,'clay must remain between the points');
    assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));
    mesh.geometry.dispose();mesh.material.forEach(m=>m.dispose());
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

test('shaping the upper silhouette changes the head instead of leaving a fixed cap',()=>{
  const before=freshModel();
  for(const row of [32,35,37,38]){
    const m=structuredClone(before);reshapeProfile(m,before,row/40,-.28,0);
    assert.ok(shapedRadius(m,row,20)<shapedRadius(before,row,20)-.08,`upper row ${row} must follow its local gesture`);
    assert.equal(shapedRadius(m,40,20),0);assert.ok(validateModel(m));
  }
});

test('one continuous body reaches the tip and the base stays closed after pressing',()=>{
  const model=freshModel();
  model.marks=Array.from({length:120},(_,i)=>({tool:'press',points:[[i%2?.25:.75,i%3?.79:.05]]}));
  for(const height of [.65,1,1.45]){
    model.height=height;const mesh=bodyGeometry(model),p=mesh.attributes.position,uv=mesh.attributes.uv;
    assert.ok([...p.array].every(Number.isFinite));
    for(let i=0;i<mesh.groups[0].count;i++){
      if(uv.getY(i)===1)assert.ok(Math.hypot(p.getX(i),p.getZ(i))<1e-6,'the body itself closes at the top');
      if(uv.getY(i)===0)assert.ok(Math.abs(Math.hypot(p.getX(i),p.getZ(i))-shapedRadius(model,0,Math.round(uv.getX(i)*80)%80))<1e-6,'bottom must follow the edited profile rather than a fixed disc');
    }
    assert.equal(mesh.groups[1].count,0,'there is no separate head when no opening has been drawn');
    assert.ok([...mesh.attributes.normal.array].every(Number.isFinite));
    mesh.dispose();
  }
});

test('old heavily narrowed saves do not leave a fixed crown or a foot flange',()=>{
  const m=freshModel();for(let row=2;row<38;row++)for(let col=0;col<80;col++)m.offsets[row*80+col]=-.38;
  const before=JSON.stringify(m);
  for(let col=0;col<80;col++){
    assert.ok(Math.abs(shapedRadius(m,0,col)-shapedRadius(m,1,col))<.04,'no separate foot flange');
    for(let row=31;row<=40;row++)assert.ok(shapedRadius(m,row,col)<=shapedRadius(m,row-1,col)+.001,'upper body must taper continuously');
  }
  assert.equal(JSON.stringify(m),before,'rendering must preserve the saved artwork');
});

test('a drawn mouth has a raised lip, thickness and an open centre in either drawing direction',()=>{
  for(const reverse of [false,true]){
    const m=freshModel();m.crown=Array.from({length:64},(_,i)=>[Math.cos(i/64*Math.PI*2)*.25,Math.sin(i/64*Math.PI*2)*.25]);if(reverse)m.crown.reverse();
    const g=crownGeometry(m),p=g.attributes.position,base=topPoint(m,.25,0)[1];
    assert.ok(Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)))>base+.09);
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
    assert.equal(new THREE.Raycaster(new THREE.Vector3(0,3,0),new THREE.Vector3(0,-1,0)).intersectObject(mesh).length,0);
    const radii=Array.from({length:p.count},(_,i)=>Math.hypot(p.getX(i),p.getZ(i)));
    assert.ok(Math.max(...radii)-Math.min(...radii)>.05,'lip has physical thickness');
    g.dispose();mesh.material.dispose();
  }
});
