import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
 await page.waitForSelector('#loading',{state:'detached'});
 await page.evaluate(()=>window.togi.go('excavation'));await page.waitForFunction(()=>!window.togi.world.transitioning);
 const measure=()=>{
  const w=window.togi.world,s=window.togi.save;
  const point=w.camera.position.clone().set(.62,.15,.3).project(w.camera),x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2;
  const quantiles=values=>{values.sort((a,b)=>a-b);return {median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)]};};
  const metrics={};
  for(const [name,fill] of [['buried',0],['exposed',255]]){
   s.excavationMask.fill(fill);w.terrain.configure(s.excavationMask,w.terrain.findBounds);w.beginBrush();
   const times=[];
   for(let i=0;i<48;i++){
    const start=performance.now();w.moveBrush(x+Math.sin(i*.3)*45,y+Math.cos(i*.3)*30);w.brushAt(x+Math.sin(i*.3)*45,y+Math.cos(i*.3)*30);w.terrain.update();w.coverage();
    if(i>=8)times.push(performance.now()-start);
   }
   w.endBrush();metrics[name]=quantiles(times);
  }
  return metrics;
 };
 const result=await page.evaluate(measure);
 const coverageAgrees=await page.evaluate(()=>{
   const t=window.togi.world.terrain;
   const agrees=()=>{
     const sum=t.findBounds.map(()=>0),count=t.findBounds.map(()=>0);
     t.mask.forEach((value,k)=>{const i=t.targetMap[k]-1;if(i>=0){sum[i]+=value;count[i]++;}});
     return t.coverage().every((v,i)=>Math.abs(v-sum[i]/(Math.max(1,count[i])*255))<1e-9);
   };
   t.mask.fill(0);t.configure(t.mask,t.findBounds);t.begin();
   const target=t.findBounds[0],point=t.mesh.position.clone().set((target.minX+target.maxX)/2,0,(target.minZ+target.maxZ)/2);
   t.dig(point);t.end();
   const brushed=agrees();t.assist();const assisted=agrees();
   const actual=t.mesh.geometry,full=actual.clone();full.computeVertexNormals();
   const normals=actual.attributes.normal.array,expected=full.attributes.normal.array;
   const lightingMatches=normals.every((v,i)=>Math.abs(v-expected[i])<.0001);full.dispose();
   t.configure(t.mask,t.findBounds);return brushed&&assisted&&agrees()&&lightingMatches;
 });
 assert.ok(coverageAgrees,'local brush updates match full surface lighting and per-artifact progress');
 console.log(JSON.stringify(result));
 await mkdir('asset/review',{recursive:true});
 const label=process.env.TOGI_PERF_BASELINE==='1'?'before':'after';
 await writeFile(`asset/review/excavation-performance-${label}.json`,JSON.stringify(result,null,2));
 if(label==='after')assert.ok(result.exposed.p95<16&&result.buried.p95<16,'brush CPU work stays within a 60 Hz frame budget on this test PC');
 await page.evaluate(()=>window.togi.go('firing'));await page.waitForFunction(()=>!window.togi.world.transitioning);
 await page.evaluate(()=>{window.togi.world.setFiringProgress(.42);});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 if(process.env.TOGI_PERF_REVIEW==='1')await page.screenshot({path:`asset/review/firing-stability-${label}.png`});
 const a=await page.evaluate(()=>[...window.togi.world.camera.position]);
 await page.evaluate(()=>{window.togi.world.setFiringProgress(.48);});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const b=await page.evaluate(()=>[...window.togi.world.camera.position]);
 if(label==='after')assert.deepEqual(a,b,'heating does not drift the camera across fine background edges');
 if(label==='after'){
  await page.setViewportSize({width:390,height:844});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>window.togi.go('excavation'));await page.waitForFunction(()=>!window.togi.world.transitioning);
  const throttled=await page.evaluate(measure);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();
  await writeFile('asset/review/excavation-performance-throttled.json',JSON.stringify(throttled,null,2));
  console.log('Portrait / 4x CPU throttle:',JSON.stringify(throttled));
  assert.ok(throttled.exposed.p95<50&&throttled.buried.p95<50,'throttled brush CPU work avoids 50 ms main-thread stalls');
 }
}finally{await browser?.close();await server.close();}
