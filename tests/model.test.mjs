import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,deform,validateModel,createHistory,unwrap,area,eraseAt,advanceIssue,invalidateProcess} from '../src/model.js';
test('a sculpted pot survives undo, save/restore and seam edits',()=>{const m=freshModel(),h=createHistory(2);h.push(m);deform(m,.999,.5,.2);assert.ok(m.offsets.some(v=>v>0));assert.ok(m.offsets[20*80]>0,'edits wrap through the UV seam');assert.deepEqual(h.pop(),freshModel());const restored=validateModel(JSON.parse(JSON.stringify(m)));assert.deepEqual(restored,m);assert.equal(validateModel({...m,offsets:[NaN]}),null);assert.equal(validateModel({...m,marks:[{tool:'script',points:[]}]}),null);});
test('hole contours close across the seam and erase locally',()=>{const points=unwrap([[.98,.4],[.02,.4],[.02,.5],[.98,.5]]);assert.ok(area(points)>.003&&area(points)<.005);const m=freshModel();m.marks=[{tool:'hole',points}];eraseAt(m,.99,.4);assert.equal(m.marks.length,0);const h=createHistory(2);for(let i=0;i<3;i++){m.height=1+i*.1;h.push(m);}assert.equal(h.length,2);assert.equal(h.pop().height,1.2);});
test('editing a finished artwork preserves its design and requires the journey again',()=>{
  const m=freshModel();assert.ok(advanceIssue(2,m));
  m.crown=[[0,0],[.3,0],[0,.3]];m.marks=[{tool:'carve',points:[[.3,.4],[.4,.4]]}];
  assert.equal(advanceIssue(2,m),'');assert.ok(advanceIssue(5,m));
  m.fired=true;assert.equal(advanceIssue(5,m),'');assert.ok(advanceIssue(6,m));
  m.dug=100;m.brush=[[.5,.5]];assert.equal(advanceIssue(6,m),'');assert.ok(advanceIssue(7,m));
  m.assembled=true;assert.equal(advanceIssue(7,m),'');
  const before=structuredClone(m);invalidateProcess(m);
  assert.deepEqual(m.marks,before.marks);assert.deepEqual(m.crown,before.crown);
  assert.ok(advanceIssue(5,m));assert.ok(advanceIssue(6,m));assert.ok(advanceIssue(7,m));
  assert.deepEqual(m.brush,[]);assert.deepEqual(validateModel(JSON.parse(JSON.stringify(before))),before);
});
