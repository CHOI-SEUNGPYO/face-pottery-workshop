import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,reshapeProfile,profileY,sampledProfile,validateModel,ROWS} from '../src/model.js';
import {bodyGeometry,refreshBodyGeometry} from '../src/body.js';
import {Interactions} from '../src/interactions.js';

// Recorded gesture: pull clay upward, then take a new grip higher up and narrow it.
test('retouching the upper part after a long pull preserves the lower body already made',()=>{
 const start=freshModel();start.profile=Array.from({length:41},(_,i)=>i===40?0:i<3?.65-i*.19:.19);
 const pulled=structuredClone(start);reshapeProfile(pulled,start,.35,.36,.65);
 const before=structuredClone(pulled);
 reshapeProfile(pulled,before,.86,-.14,-.18);
 for(let row=0;row<=13;row++)assert.ok(Math.abs(pulled.profile[row]-before.profile[row])<.005,'remote lower clay keeps its width within half a screen pixel');
 for(let row=14;row<=20;row++)assert.ok(Math.abs(pulled.profile[row]-before.profile[row])<.065,'adjacent clay shares pressure without erasing the lower bulge');
 assert.equal(profileY(pulled,0),profileY(before,0));assert.ok(validateModel(pulled));
 // Reversing a vertical stroke must not switch to a different upper-body policy.
 for(const dy of [-.12,.12]){
  const m=structuredClone(before);reshapeProfile(m,before,.85,-.08,dy);
  const moved=profileY(m,.85)-profileY(before,.85);assert.ok(moved*dy>0&&Math.abs(moved)<=Math.abs(dy)+1e-8);
  assert.ok(Math.abs(profileY(m,1)-profileY(before,1)-moved)<.002);
 }
});

test('deformed material heights join smoothly and remain ordered between stored rings',()=>{
 const start=freshModel();start.profile=sampledProfile(start);const m=structuredClone(start);reshapeProfile(m,start,.35,.25,.65);
 let last=profileY(m,0);
 for(let i=1;i<=4000;i++){const y=profileY(m,i/4000);assert.ok(y>last);last=y;}
 for(let i=1;i<40;i++){
  const t=i/40,h=1e-7,left=(profileY(m,t)-profileY(m,t-h))/h,right=(profileY(m,t+h)-profileY(m,t))/h;
  assert.ok(Math.abs(left-right)<.003,`height tangent must not jump at ring ${i}`);
 }
});

test('a frame applies the latest diagonal input once, and pointer-up flushes its final position',()=>{
 const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;let callback,queued=0,refreshes=0,commits=0;
 globalThis.requestAnimationFrame=fn=>{callback=fn;queued++;return queued;};globalThis.cancelAnimationFrame=()=>{};
 try{
  const before=freshModel(),pot={model:structuredClone(before),hit:()=>null,shapeGrab:()=>({v:1,side:1,unitsPerPixel:.01,end:1}),refreshShape(){refreshes++;},update(){throw Error('do not rebuild on release');},render(){}};
  const surface={addEventListener(){},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},focus(){},classList:{toggle(){},remove(){}}};
  const input=new Interactions(pot,surface,{setAttribute(){}},()=>commits++,()=>{}),e=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,target:{closest:()=>null},preventDefault(){}});
  input.down(e(100,100));input.move(e(105,110));input.move(e(110,120));input.move(e(115,130));assert.equal(queued,1);assert.equal(refreshes,0);
  callback();assert.equal(refreshes,1);assert.ok(Math.abs(profileY(pot.model,1)-before.height+.3)<1e-8);
  const expected=structuredClone(before);reshapeProfile(expected,{...before,profile:sampledProfile(before)},1,.2,-.4);
  input.up(e(120,140));assert.equal(refreshes,2);assert.equal(commits,1);assert.deepEqual(pot.model.profile,expected.profile);assert.deepEqual(pot.model.profileLevels,expected.profileLevels);
  const vertical=structuredClone(before);reshapeProfile(vertical,{...before,profile:sampledProfile(before)},1,0,-.4);
  assert.ok(pot.model.profile.some((r,i)=>r>vertical.profile[i]+.01),'top touch retains its horizontal component within the clay patch');
 }finally{globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}
});

test('reused mesh buffers follow the actual silhouette, keep the floor closed and retain valid normals',()=>{
 const m=freshModel(),outer=bodyGeometry(m),inner=bodyGeometry(m,true),position=outer.attributes.position.array,uv=outer.attributes.uv.array;
 const before={...m,profile:sampledProfile(m)};reshapeProfile(m,before,.4,.3,.45);
 assert.equal(refreshBodyGeometry(m,outer),true);assert.equal(refreshBodyGeometry(m,inner,true),true);
 assert.equal(outer.attributes.position.array,position);assert.equal(outer.attributes.uv.array,uv);
 const expected=bodyGeometry(m),p=expected.attributes.position;
 for(let i=0;i<p.count;i++)for(const name of ['getX','getY','getZ'])assert.ok(Math.abs(p[name](i)-outer.attributes.position[name](i))<1e-6);
 for(const g of [outer,inner]){
  const n=g.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
 }
 const rebuiltInner=bodyGeometry(m,true);
 for(const [actual,rebuilt] of [[outer,expected],[inner,rebuiltInner]])for(let i=0;i<actual.attributes.normal.array.length;i++)assert.ok(Math.abs(actual.attributes.normal.array[i]-rebuilt.attributes.normal.array[i])<1e-6,'dragging and reloading must have identical shading');
 rebuiltInner.dispose();
 m.crown=[[0,.2],[.2,0],[0,-.2]];assert.equal(refreshBodyGeometry(m,outer),false,'opening topology uses the complete construction');
 outer.dispose();inner.dispose();expected.dispose();
});

test('returning to sculpt a decorated vessel retains its grooves and the crown lip while reusing buffers',()=>{
 const start=freshModel();start.crown=Array.from({length:64},(_,i)=>[Math.cos(i/64*Math.PI*2)*.25,Math.sin(i/64*Math.PI*2)*.25]);
 start.marks=[{tool:'press',points:[[.25,.45]]},{tool:'carve',points:[[.65,.5],[.68,.52]]},{tool:'hole',points:[[.3,.65]]}];
 const outer=bodyGeometry(start),inner=bodyGeometry(start,true),p=outer.attributes.position.array,m=structuredClone(start);
 reshapeProfile(m,{...start,profile:sampledProfile(start)},.35,.08,.1);
 assert.equal(refreshBodyGeometry(m,outer),true);assert.equal(refreshBodyGeometry(m,inner,true),true);assert.equal(outer.attributes.position.array,p);
 for(const [actual,inside] of [[outer,false],[inner,true]]){
  const expected=bodyGeometry(m,inside),a=actual.attributes.position,b=expected.attributes.position;assert.equal(a.count,b.count);
  for(let i=0;i<a.count;i++)for(const name of ['getX','getY','getZ'])assert.ok(Math.abs(a[name](i)-b[name](i))<1e-6,`decorated vertex ${i} ${name}`);
  expected.dispose();
 }
 assert.deepEqual(m.marks,start.marks);assert.deepEqual(m.crown,start.crown);outer.dispose();inner.dispose();
});
