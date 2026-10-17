import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,reshapeProfile,shapedRadius,sampledProfile,profileY,validateModel,createWorkshopHistory} from '../src/model.js';
import {clayVolume} from '../src/clay-material.js';
import {flaredFixture} from './regression-fixtures.js';
import {readFile} from 'node:fs/promises';
const heights=m=>Array.from({length:41},(_,i)=>profileY(m,i/40));
const volume=m=>clayVolume(sampledProfile(m),heights(m));
function renderedVolume(m){
 let sum=0;for(let i=0;i<1600;i++){const a=i/1600,b=(i+1)/1600;sum+=(shapedRadius(m,a*40,0)**2+shapedRadius(m,b*40,0)**2)/2*(profileY(m,b)-profileY(m,a));}return sum;
}
test('120 mixed pulls and presses retain material and a connected profile without invalid saves',()=>{
 const m=freshModel(),amount=volume(m),rendered=renderedVolume(m);
 for(let i=0;i<120;i++){
  const before=structuredClone(m);reshapeProfile(m,before,.1+(i*17%81)/100,Math.sin(i*1.8)*.5,Math.cos(i*2.3)*.4);
  assert.ok(validateModel(m),`valid save after stroke ${i}`);assert.ok(Math.abs(volume(m)/amount-1)<.005,'incompressible flow must retain material within the profile sampling error');
  assert.ok(m.profile.slice(0,37).every(r=>r>.12),'the continuous body never pinches off');
 }
 assert.ok(Math.abs(renderedVolume(m)/rendered-1)<.005,'the visible body also retains its material, not just the stored samples');
});
test('compression spreads neighbouring clay and elongation thins it without applying an artifact template',()=>{
 const start=freshModel(),radii=sampledProfile(start),pressed=structuredClone(start),pulled=structuredClone(start);reshapeProfile(pressed,start,1,0,-.6);reshapeProfile(pulled,start,1,0,.24);
 assert.ok(pressed.profile[0]>radii[0]+.05,'pressure spreads through the supported body rather than making a separate mushroom cap');assert.equal(profileY(pressed,0),profileY(start,0));
 assert.ok(pulled.profile.some((r,i)=>r<radii[i]-.03));
 for(const m of [pressed,pulled])assert.ok(Math.abs(volume(m)/volume(start)-1)<.005);
});
test('small input starts continuously, remote clay stays put and a re-grab does not reshape old saves',()=>{
 const start=freshModel(),radii=sampledProfile(start),small=structuredClone(start),a=structuredClone(start),b=structuredClone(start);reshapeProfile(small,start,.5,.001,0);
 assert.ok(Math.max(...small.profile.map((r,i)=>Math.abs(r-radii[i])))<.004,'a tiny touch must not trigger a large smoothing jump');
 reshapeProfile(a,start,.5,.15,0);reshapeProfile(b,start,.5,.15001,0);assert.ok(Math.max(...a.profile.map((r,i)=>Math.abs(r-b.profile[i])))<.001);
 for(let i=0;i<5;i++)assert.ok(Math.abs(a.profile[i]-radii[i])<.02,'the brush must not erase lower clay more than .9 world units from the grip');
 for(const old of [flaredFixture(),start]){const m=structuredClone(old);reshapeProfile(m,old,.5,0,0);assert.deepEqual(m,old);}
 const legacy=flaredFixture(),touched=structuredClone(legacy);reshapeProfile(touched,legacy,.5,.001,0);
 assert.ok(Math.max(...touched.profile.map((r,i)=>Math.abs(r-legacy.profile[i])))<.01,'old creases do not collapse on a tiny new touch');
});
test('the three deployed double-collar failures no longer invent extra radial bulges for the same strokes',async()=>{
 const {cases}=JSON.parse(await readFile(new URL('./sculpt-flow-cases.json',import.meta.url),'utf8'));
 const peaks=r=>r.slice(1,-1).filter((a,i)=>a>r[i]&&a>r[i+2]).length;
 for(const c of cases.slice(0,3)){
  assert.ok(peaks(c.previous.profile)>=3,`${c.name}: fixture must reproduce the deployed defect`);
  const m=freshModel();for(const stroke of c.strokes)reshapeProfile(m,structuredClone(m),...stroke);
  assert.equal(peaks(m.profile),1,`${c.name}: one body bulge, no extra stacked collars`);
  assert.ok(Math.abs(renderedVolume(m)/renderedVolume(freshModel())-1)<.005);
 }
});
test('material-aware shaping survives stage undo and storage without undoing later openings',()=>{
 const before=freshModel(),m=structuredClone(before),history=createWorkshopHistory();history.push(1,before);reshapeProfile(m,before,.65,-.4,-.3);
 m.marks=[{tool:'ear',points:[[.2,.4],[.24,.4],[.22,.45]]}];m.crown=[[0,.2],[.2,0],[0,-.2]];
 assert.deepEqual(validateModel(JSON.parse(JSON.stringify(m))),m);const restored=history.pop(1,m);assert.deepEqual(restored.offsets,before.offsets);assert.deepEqual(restored.marks,m.marks);assert.deepEqual(restored.crown,m.crown);
});
