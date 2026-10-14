import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('local server serves the offline game and rejects private paths or writes', {timeout:10000}, async t=>{
  const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0'},windowsHide:true});
  t.after(()=>child.kill());
  const [chunk]=await once(child.stdout,'data');
  const url=chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  for(const path of ['/', '/src/app.js', '/vendor/three.module.js', '/assets/artifact.png', '/asset/게임용 에셋/소월이.png']){
    const response=await fetch(url+encodeURI(path));assert.equal(response.status,200,path);assert.ok((await response.arrayBuffer()).byteLength>0);
  }
  assert.match((await fetch(url+'/src/app.js')).headers.get('content-type'),/javascript/);
  assert.equal((await fetch(url+'/.git/config')).status,404);
  assert.equal((await fetch(url+'/missing-file')).status,404);
  assert.equal((await fetch(url+'/',{method:'POST',body:'not a write'})).status,405);
});
