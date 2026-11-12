import { mkdir, copyFile, readFile, writeFile, cp } from "node:fs/promises";
import {validCatalog} from '../content/schema.mjs';
const catalog=JSON.parse(await readFile('content/museum.json','utf8'));
if(!validCatalog(catalog))throw Error('Invalid museum content');
await mkdir('dist/museum',{recursive:true});
await copyFile('content/museum.json','dist/museum/catalog.json');
await cp('asset/runtime/museum','dist/museum/assets',{recursive:true});

await mkdir("dist/licenses", { recursive: true });
for (const [source, name] of [
  ["node_modules/three/LICENSE", "three.txt"],
  ["node_modules/three-mesh-bvh/LICENSE", "three-mesh-bvh.txt"],
  ["node_modules/polygon-clipping/LICENSE.md", "polygon-clipping.txt"],
  ["node_modules/robust-predicates/LICENSE", "robust-predicates.txt"],
  ["font/Pretendard-1.3.9/LICENSE.txt", "Pretendard.txt"],
  ["font/Cafe24Ssurround-v2.0/License-Ssurround.pdf", "Cafe24-Ssurround.pdf"],
  ["assets/CREDITS.md", "asset-credits.md"],
])
  await copyFile(source, "dist/licenses/" + name);
const readme = await readFile("node_modules/splaytree/Readme.md", "utf8");
const license = readme.indexOf("## License");
if (license < 0) throw new Error("Missing splaytree license");
await writeFile("dist/licenses/splaytree.txt", readme.slice(license));
