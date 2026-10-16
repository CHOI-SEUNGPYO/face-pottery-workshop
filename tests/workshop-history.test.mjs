import test from 'node:test';
import assert from 'node:assert/strict';
import {freshModel,createWorkshopHistory,validateModel} from '../src/model.js';

test('repeated undo stays in its stage and revisiting body editing preserves the latest crown and faces',()=>{
  const history=createWorkshopHistory();let model=freshModel();const original=structuredClone(model);
  history.push(1,model);model.height=1.4;model.offsets[800]=.2;
  const shaped=structuredClone(model);history.push(2,model);model.crown=[[0,0],[.2,0],[0,.2]];
  history.push(3,model);model.marks=[{tool:'hole',points:[[.4,.5]]}];
  model=history.pop(2,model);
  assert.deepEqual(model.crown,[]);assert.deepEqual(model.offsets,shaped.offsets);assert.equal(model.height,1.4);assert.equal(model.marks.length,1);
  for(let i=0;i<5;i++)assert.equal(history.pop(2,model),undefined);
  assert.equal(history.count(1),1);assert.equal(history.count(3),1);
  model.crown=[[.1,.1],[.3,.1],[.1,.3]];const crown=structuredClone(model.crown),marks=structuredClone(model.marks);
  model.fired=true;model.dug=100;model.assembled=true;model.stage=1;
  model=history.pop(1,model);
  assert.equal(model.height,original.height);assert.deepEqual(model.offsets,original.offsets);
  assert.deepEqual(model.crown,crown);assert.deepEqual(model.marks,marks);assert.equal(model.stage,1);
  assert.equal(model.fired,false);assert.equal(model.dug,0);assert.equal(model.assembled,false);
  model=history.pop(3,model);assert.deepEqual(model.marks,[]);assert.deepEqual(model.crown,crown);
  assert.deepEqual(validateModel(JSON.parse(JSON.stringify(model))),model);
  history.push(1,model);history.push(2,model);history.clear();for(const stage of [1,2,3])assert.equal(history.count(stage),0);
});
