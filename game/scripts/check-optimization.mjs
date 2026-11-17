import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const baseline=process.argv.includes('--baseline');
const drawingBaseline=process.argv.includes('--drawing-baseline');
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});
await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:696},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.locator('#loading').waitFor({state:'detached',timeout:60000});
  const metrics=await page.evaluate(async()=>{
    const {StrokePreview}=await import('/src/stroke-preview.ts');
    const {Vector3}=await import('/node_modules/three/build/three.module.js');
    const {LineGeometry}=await import('/node_modules/three/examples/jsm/lines/LineGeometry.js');
    const preview=new StrokePreview(),drawTimes=[],seen=new Set();let previewDisposals=0;
    const strokes=Array.from({length:70},(_,frame)=>Array.from({length:[64,128,256,512,256,64,2][frame%7]},(_,i)=>new Vector3(i*.001,Math.sin(i*.13+frame)*.02,.3)));
    const watch=()=>{const g=preview.children[0].geometry;if(!seen.has(g)){seen.add(g);g.addEventListener('dispose',()=>previewDisposals++);}};
    const segments=[],counts=[];watch();
    for(const points of strokes){
      const start=performance.now();preview.setPoints(points);drawTimes.push(performance.now()-start);watch();
      const geometry=preview.children[0].geometry,expected=new LineGeometry().setPositions(points.flatMap(p=>p.toArray()));
      const count=geometry.instanceCount,array=geometry.attributes.instanceStart.data.array;
      const active=Array.from(array.slice(0,count*6));
      if(JSON.stringify(active)!==JSON.stringify(Array.from(expected.attributes.instanceStart.data.array)))throw Error('stroke geometry changed');
      const end=points.at(-1);if(!geometry.boundingBox.clone().expandByScalar(1e-6).containsPoint(end))throw Error('stroke bounds miss the end');
      segments.push(active);counts.push(count);expected.dispose();
    }
    preview.setPoints([]);if(preview.visible)throw Error('empty stroke remains visible');
    const drawing={geometryReplacements:seen.size-1,disposals:previewDisposals};
    drawTimes.sort((a,b)=>a-b);Object.assign(drawing,{median:drawTimes[35],p95:drawTimes[66]});
    preview.children[0].geometry.dispose();for(const line of preview.children)line.material.dispose();
    const {PotteryView}=await import('/src/pottery-view.ts');
    const {createSoftDocument,applyForm,forms,adjustMouth}=await import('/src/form.ts');
    const {freshDocument,cloneDoc}=await import('/src/model.ts');
    const view=new PotteryView(),documents=[];
    const soft=createSoftDocument();documents.push(soft);
    const decorated=cloneDoc(soft);
    decorated.features=[{id:'eye',kind:'hole',width:.006,points:[[.01,.5],[.05,.5],[.05,.57],[.01,.57]]},
      {id:'line',kind:'groove',width:.004,points:[[.15,.35],[.17,.37],[.2,.35]]}];
    documents.push(decorated);
    const wide=cloneDoc(decorated);applyForm(wide,{...forms.wide,width:1.35});adjustMouth(wide,.15,.055);documents.push(wide,freshDocument());
    const snapshots=[];
    for(const d of documents){
      const original=JSON.stringify(d);view.update(d);
      snapshots.push({geometry:['body','inner','walls','rim','cap','floor'].map(name=>{
        const g=view[name].geometry;
        return {name,attributes:Object.fromEntries(Object.entries(g.attributes).map(([key,a])=>[key,Array.from(a.array)])),index:g.index?Array.from(g.index.array):null};
      }),textures:[view.mask,view.bump,view.ink].map(canvas=>canvas.toDataURL())});
      if(JSON.stringify(d)!==original)throw Error('rendering changed the saved document');
    }
    const doc=createSoftDocument();view.update(doc);
    const versions=()=>[view.maskTexture.version,view.bumpTexture.version,view.inkTexture.version];
    const initialTextures=versions(),times=[];let disposed=0;
    for(const name of ['rim','cap','floor'])view[name].geometry.addEventListener('dispose',()=>disposed++);
    for(let i=0;i<48;i++){
      const start=performance.now();
      applyForm(doc,{...forms.round,width:.85+i*.005});view.update(doc,false);
      if(i>=8)times.push(performance.now()-start);
    }
    doc.revision='committed-form';view.update(doc);
    const textureUploads=versions().map((version,i)=>version-initialTextures[i]);
    const disposedDuringEdits=disposed;
    times.sort((a,b)=>a-b);view.dispose();
    return {snapshots,segments,counts,drawing,form:{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],disposedDuringEdits,textureUploads}};
  });
  const geometryHash=createHash('sha256').update(JSON.stringify(metrics.snapshots)).digest('hex');
  let bytes=0,count=0;
  for(const name of await readdir('dist',{recursive:true})){
    const info=await stat(`dist/${name}`);if(info.isFile()){bytes+=info.size;count++;}
  }
  const result={geometryHash,strokeHash:createHash('sha256').update(JSON.stringify([metrics.segments,metrics.counts])).digest('hex'),drawing:metrics.drawing,form:metrics.form,build:{bytes,files:count}};
  await mkdir('asset/review',{recursive:true});
  const beforePath='asset/review/optimization-before.json';
  if(!baseline){
    const before=await readFile(beforePath,'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;});
    if(before)assert.equal(geometryHash,before.geometryHash,'rendered geometry, normals and painted textures are unchanged');
    assert.equal(result.form.disposedDuringEdits,0,'continuous form edits reuse rim and floor buffers');
    assert.deepEqual(result.form.textureUploads,[0,0,0],'shape-only edits do not upload unchanged face textures');
  }
  if(!drawingBaseline){
    const before=await readFile('asset/review/optimization-drawing-before.json','utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;});
    if(before)assert.equal(result.strokeHash,before.strokeHash,'preview segments remain identical');
    assert.equal(result.drawing.geometryReplacements,0,'drawing reuses its preview geometry');
    assert.equal(result.drawing.disposals,0,'drawing never discards an active preview buffer');
  }
  assert.deepEqual(errors,[]);
  await writeFile(`asset/review/optimization-${drawingBaseline?'drawing-before':baseline?'before':'after'}.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}finally{await browser?.close();await server.close();}
