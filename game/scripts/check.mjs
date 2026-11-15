import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { once } from "node:events";
import test from "node:test";
import {validCatalog} from '../content/schema.mjs';
import {advanceFiring} from '../src/firing-progress.mjs';

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
