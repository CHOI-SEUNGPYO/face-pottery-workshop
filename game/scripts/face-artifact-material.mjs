import {deflateSync} from 'node:zlib';

// Original procedural surface. No pixels are copied from the museum video:
// the grey scan informs relief; supplied colour photos inform the palette.
const SIZE=1024,TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
const noise=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
const wave=(u,v)=>Math.sin(TAU*(u*7+v*2))*.45+Math.sin(TAU*(u*19-v*4))*.28+Math.sin(TAU*(u*37+v*9))*.15;
function softNoise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,fract(x)),v=smooth(0,1,fract(y));
  return (noise(ix,iy)*(1-u)+noise(ix+1,iy)*u)*(1-v)+(noise(ix,iy+1)*(1-u)+noise(ix+1,iy+1)*u)*v;
}
const patches=[[.28,1.35,.12,.13],[1.23,1.38,.17,.08],[2.50,1.30,.21,.08],[3.10,1.44,.16,.07],[4.82,1.38,.18,.09],[5.72,1.40,.17,.09]];
const crcTable=Uint32Array.from({length:256},(_,c)=>{for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function chunk(type,data){
  const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);
  let crc=0xffffffff;for(const b of Buffer.concat([name,data]))crc=crcTable[(crc^b)&255]^(crc>>>8);
  out.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return out;
}
function png(rgb){
  const raw=Buffer.alloc((SIZE*3+1)*SIZE),header=Buffer.alloc(13);header.writeUInt32BE(SIZE,0);header.writeUInt32BE(SIZE,4);header[8]=8;header[9]=2;
  for(let y=0;y<SIZE;y++)rgb.copy(raw,y*(SIZE*3+1)+1,y*SIZE*3,(y+1)*SIZE*3);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function surfaceMaps(){
  const height=new Float32Array(SIZE*SIZE),colour=Buffer.alloc(SIZE*SIZE*3),normal=Buffer.alloc(SIZE*SIZE*3);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    // GLTFLoader uses unflipped images, so row zero corresponds to UV v=0.
    const u=x/(SIZE-1),v=y/(SIZE-1),cloud=wave(u,v),grain=noise(x,y)-.5;
    const strength=smooth(.28,.42,v)*(1-smooth(.953,.978,v));
    const bend=3*v+.85*Math.sin(TAU*(u*3+v*.7))+.32*Math.sin(TAU*(u*9-v*1.5));
    const column=u*216+bend,ix=Math.floor(column),row=v*(65+18*noise(ix,3))+.75*noise(ix,5);
    const dx=(fract(column)-.5)*2,dy=(fract(row)-.5)*2;
    const groove=Math.pow(Math.max(0,Math.cos(dx*Math.PI/2)),4);
    const pit=groove*(.35+.65*(1-smooth(.68,.99,Math.abs(dy))));
    const worn=.65+.35*smooth(-.6,.5,cloud);
    height[y*SIZE+x]=-pit*.30*strength*worn+grain*.026+.009*Math.sin(v*TAU*128+cloud*2)*(1-strength);
    const mottling=softNoise(u*41,v*37)*.65+softNoise(u*101,v*99)*.35;
    const patch=Math.max(...patches.map(([angle,y,w,h])=>{
      const du=Math.atan2(Math.sin(u*TAU-angle),Math.cos(u*TAU-angle));
      return Math.exp(-((du/w)**2)-(((v*1.58-y)/h)**2));
    }),smooth(.956,.98,v)*(.25+.45*mottling));
    const patina=smooth(.24,.70,patch*(.25+mottling));
    const wornEdge=smooth(.40,.65,Math.abs(dx))*(1-smooth(.70,.92,Math.abs(dx)));
    const soot=4*(1-smooth(.30,.65,v));
    const shade=cloud*5+grain*10+(mottling-.5)*9+(wornEdge*10-pit*8)*strength;
    const base=[82+shade-soot,87+shade-soot,84+shade-soot];
    for(let c=0;c<3;c++){
      const ash=[162,143,111][c],rim=(1-smooth(.006,.026,v))*(2+3*noise(x,3));
      colour[(y*SIZE+x)*3+c]=Math.round(clamp(base[c]*(1-patina*.65)+ash*patina*.65+rim,0,255));
    }
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const left=height[y*SIZE+(x+SIZE-1)%SIZE],right=height[y*SIZE+(x+1)%SIZE];
    const down=height[Math.max(0,y-1)*SIZE+x],up=height[Math.min(SIZE-1,y+1)*SIZE+x];
    const nx=-(right-left)*2.6,ny=-(up-down)*1.8,len=Math.hypot(nx,ny,1),i=(y*SIZE+x)*3;
    normal[i]=Math.round((nx/len*.5+.5)*255);normal[i+1]=Math.round((ny/len*.5+.5)*255);normal[i+2]=Math.round((1/len*.5+.5)*255);
  }
  return [png(colour),png(normal)];
}

// Embed colour and normal maps into the GLB. The game uses these original
// materials instead of recolouring this artifact with a shared ceramic texture.
export function finishFaceArtifactGlb(arrayBuffer){
  const glb=Buffer.from(arrayBuffer),jsonLength=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonLength).toString());
  const binHeader=20+jsonLength,bin=glb.subarray(binHeader+8,binHeader+8+glb.readUInt32LE(binHeader));
  const chunks=[bin];let length=bin.length;
  json.bufferViews??=[];json.images??=[];json.textures??=[];json.samplers??=[];
  const sampler=json.samplers.length;json.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:33071});
  const textures=surfaceMaps().map((image,index)=>{
    const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
    const bufferView=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:length,byteLength:image.length});chunks.push(image);length+=image.length;
    const source=json.images.length;json.images.push({bufferView,mimeType:'image/png',name:index?'Sowol vertical impressions normal':'Sowol charcoal and ochre patina'});
    const texture=json.textures.length;json.textures.push({source,sampler});return texture;
  });
  for(const mat of json.materials)if(mat.extras?.artifactSurface==='exterior'){
    mat.pbrMetallicRoughness.baseColorTexture={index:textures[0]};mat.normalTexture={index:textures[1],scale:1.25};
  }
  const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
  json.buffers[0].byteLength=length;
  const text=Buffer.from(JSON.stringify(json)),j=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),b=Buffer.concat(chunks);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(b.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,j,bh,b]);
}
