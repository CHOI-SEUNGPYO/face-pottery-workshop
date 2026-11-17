import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { once } from "node:events";
import test from "node:test";
import {validCatalog} from '../content/schema.mjs';
import {advanceFiring} from '../src/firing-progress.mjs';

test('museum research links resolve and older editable catalogues remain usable',async()=>{
 const catalog=JSON.parse(await readFile('content/museum.json','utf8'));
 assert.ok(validCatalog(catalog));
 for(const stage of Object.values(catalog.stages))for(const block of stage.blocks){
  if(block.kind!=='imagination')assert.ok(block.sources?.length,'historical and interpretive content identifies its evidence');
 }
 const broken=structuredClone(catalog);broken.stages.faces.blocks[0].sources=['missing'];
 assert.equal(validCatalog(broken),false,'unknown citations cannot silently enter the published catalogue');
 const missingPhoto=structuredClone(catalog);missingPhoto.stages.firing.blocks[0].photo='missing';
 assert.equal(validCatalog(missingPhoto),false,'story illustrations must reference an available photo');
 delete catalog.artifact;delete catalog.sources;
 for(const stage of Object.values(catalog.stages))for(const block of stage.blocks){delete block.sources;delete block.question;}
 assert.ok(validCatalog(catalog),'existing editor data without new metadata remains valid');
});

test('slow frames preserve every firing phase and normal playback duration',()=>{
 for(const duration of [4000,14000]){
  const phases=new Set();let progress=0;
  for(let i=0;i<12&&progress<1;i++){
   progress=advanceFiring(progress,9000,duration);
   phases.add(progress<.15?'load':progress<.62?'heat':progress<.85?'cool':'unload');
  }
  assert.deepEqual([...phases],['load','heat','cool','unload']);
  assert.equal(progress,1);
  assert.equal(advanceFiring(.3,0,duration),.3);
  let normal=0;for(let i=0;i<600;i++)normal=advanceFiring(normal,duration/600,duration);
  assert.ok(normal>.999999,'normal frames retain the intended duration');
 }
});

test('museum photo categories remain optional for existing editor catalogs',async()=>{
 const catalog=JSON.parse(await readFile('content/museum.json','utf8'));
 assert.ok(validCatalog(catalog));
 for(const photo of catalog.photos){assert.ok((await readFile('asset/runtime/museum/'+photo.file)).length>0);delete photo.category;delete photo.title;}
 assert.ok(validCatalog(catalog));
 catalog.photos[0].category='invalid';assert.equal(validCatalog(catalog),false);
});

test(
  "prototype serves its build and assets without exposing source or accepting writes",
  { timeout: 15000 },
  async () => {
    const server = spawn(process.execPath, ["server.mjs"], {
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const ready = once(server.stdout, "data").then(([text]) => String(text));
      const failed = once(server, "exit").then(() => {
        throw new Error("Server exited before listening");
      });
      const url = (await Promise.race([ready, failed])).match(
        /http:\/\/127\.0\.0\.1:\d+/,
      )?.[0];
      assert.ok(url);
      const home = await fetch(url);
      assert.equal(home.status, 200);
      assert.match(await home.text(), /작은 흙 공방/);
      const cached=await fetch(url,{headers:{'If-None-Match':home.headers.get('etag')}});
      assert.equal(cached.status,304,'unchanged HTML is revalidated without downloading it again');
      assert.equal(await cached.text(),'');
      assert.equal(home.headers.get('cache-control'),'no-cache','entry page always checks for updates');
      const outdated=await fetch(url,{headers:{'If-None-Match':'"outdated"','If-Modified-Since':'Fri, 01 Jan 2100 00:00:00 GMT'}});
      assert.equal(outdated.status,200,'a mismatched entity tag takes precedence over the date');
      const catalogue=await fetch(url+'/museum/catalog.json');
      assert.equal(catalogue.headers.get('cache-control'),'no-cache','editable museum content is not frozen');
      assert.equal((await fetch(url, { method: "HEAD" })).status, 200);
      assert.equal((await fetch(url, { method: "POST" })).status, 405);
      for (const path of [
        "/package.json",
        "/src/main.ts",
        "/.git/config",
        "/..%5cpackage.json",
        "/%ZZ",
      ])
        assert.equal((await fetch(url + path)).status, 404, path);
      const files = await readdir("dist/assets");
      assert.ok(files.some((name) => name.endsWith(".glb")));
      for (const file of files) {
        const response = await fetch(
          `${url}/assets/${encodeURIComponent(file)}`,
        );
        assert.equal(response.status, 200, file);
        if(/-[\w-]{8}\.[\w]+$/.test(file))assert.match(response.headers.get('cache-control'),/immutable/);
        assert.equal((await fetch(`${url}/assets/${encodeURIComponent(file)}`,{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          await readFile("dist/assets/" + file),
          file,
        );
      }
    } finally {
      server.kill();
    }
  },
);
