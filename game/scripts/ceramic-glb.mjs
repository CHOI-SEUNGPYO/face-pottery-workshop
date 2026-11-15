import {deflateSync} from 'node:zlib';

const crcTable=Uint32Array.from({length:256},(_,c)=>{for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function chunk(type,data){
  const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);
  let crc=0xffffffff;for(const b of Buffer.concat([name,data]))crc=crcTable[(crc^b)&255]^(crc>>>8);
  out.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return out;
}
export function rgbPng(rgb,size){
  const raw=Buffer.alloc((size*3+1)*size),header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  for(let y=0;y<size;y++)rgb.copy(raw,y*(size*3+1)+1,y*size*3,(y+1)*size*3);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

// Keep the authored colour and relief maps inside the portable model, without
// loading a DOM image or assigning the game's shared ceramic material.
export function embedCeramicMaps(arrayBuffer,{images,names,surfaceKey,normalScale}){
  const glb=Buffer.from(arrayBuffer),jsonLength=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonLength).toString());
  const binHeader=20+jsonLength,bin=glb.subarray(binHeader+8,binHeader+8+glb.readUInt32LE(binHeader));
  const chunks=[bin];let length=bin.length;
  json.bufferViews??=[];json.images??=[];json.textures??=[];json.samplers??=[];
  const sampler=json.samplers.length;json.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:33071});
  const textures=images.map((image,index)=>{
    const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
    const bufferView=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:image.length});chunks.push(image);length+=image.length;
    const source=json.images.length;json.images.push({bufferView,mimeType:'image/png',name:names[index]});
    const texture=json.textures.length;json.textures.push({source,sampler});return texture;
  });
  for(const mat of json.materials)if(mat.extras?.[surfaceKey]==='exterior'){
    mat.pbrMetallicRoughness.baseColorTexture={index:textures[0]};mat.normalTexture={index:textures[1],scale:normalScale};
  }
  const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
  json.buffers[0].byteLength=length;
  const text=Buffer.from(JSON.stringify(json)),j=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),b=Buffer.concat(chunks);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,j,bh,b]);
}
