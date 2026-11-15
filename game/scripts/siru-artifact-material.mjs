import {rgbPng,embedCeramicMaps} from './ceramic-glb.mjs';

// Independently authored maps, visually informed by the supplied colour photo
// and the KHS excavation photo. No photographic pixels are copied into the GLB.
const SIZE=1024,TAU=Math.PI*2;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const fract=n=>n-Math.floor(n);
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
function noise(x,y,period){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,fract(x)),v=smooth(0,1,fract(y));
  const at=(a,b)=>hash(((a%period)+period)%period,b);
  return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
}
const cracks=[
  [[.909,.668],[.904,.59],[.906,.48],[.894,.41],[.897,.30],[.889,.19],[.881,.07]],
  [[.904,.59],[.931,.57],[.959,.58]],
  [[.12,.25],[.113,.31],[.118,.39],[.111,.44]],
  [[.54,.84],[.548,.72],[.543,.62],[.559,.53]],
];
const segments=cracks.flatMap(path=>path.slice(1).map((b,i)=>[path[i],b]));
function crackDistance(u,v){
  let d=1;
  for(const [a,b] of segments){
    const x=(u-a[0])*2.6,y=v-a[1],dx=(b[0]-a[0])*2.6,dy=b[1]-a[1];
    const t=clamp((x*dx+y*dy)/(dx*dx+dy*dy));d=Math.min(d,Math.hypot(x-t*dx,y-t*dy));
  }
  return d;
}
function surfaceMaps(){
  const height=new Float32Array(SIZE*SIZE),colour=Buffer.alloc(SIZE*SIZE*3),normal=Buffer.alloc(SIZE*SIZE*3);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const u=x/(SIZE-1),v=y/(SIZE-1),grain=hash(x,y)-.5;
    const broad=noise(u*13,v*7,13),medium=noise(u*43,v*33,43),fine=noise(u*101,v*93,101);
    const ash=smooth(.36,.75,broad*.28+medium*.39+fine*.33);
    const weather=1-smooth(.42,.72,noise(u*21+8,v*17+4,21));
    const strength=smooth(.055,.13,v)*(1-smooth(.94,1,v))*(.65+.35*weather);
    const column=u*246+1.3*Math.sin(v*TAU*1.7+u*TAU*2)+.3*Math.sin(u*TAU*23);
    const row=v*135+.30*Math.sin(u*TAU*9)+.26*hash(Math.floor(column),8);
    const dx=Math.abs(fract(column)-.5)*2,dy=Math.abs(fract(row)-.5)*2;
    const vertical=1-smooth(.06,.36,dx),cross=(1-smooth(.08,.30,dy))*.65;
    const mark=Math.max(vertical,cross),crack=1-smooth(.0006,.0026,crackDistance(u,v));
    const relief=-mark*.15*strength+grain*.024-crack*.12;
    height[y*SIZE+x]=relief;
    const edge=1-smooth(.0,.08,v),shade=(medium-.5)*8+(fine-.5)*10+grain*16-mark*9*strength-crack*17;
    const soot=(1-smooth(.32,.64,noise(u*9+17,v*6,9)))*5;
    const base=[80+shade-soot,81+shade-soot,76+shade-soot];
    for(let c=0;c<3;c++){
      const deposit=[134,128,111][c],blend=clamp(ash*.45+edge*.10);
      colour[(y*SIZE+x)*3+c]=Math.round(clamp(base[c]*(1-blend)+deposit*blend,0,255));
    }
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const l=height[y*SIZE+(x+SIZE-1)%SIZE],r=height[y*SIZE+(x+1)%SIZE];
    const d=height[Math.max(0,y-1)*SIZE+x],u=height[Math.min(SIZE-1,y+1)*SIZE+x];
    const nx=-(r-l)*2.0,ny=-(u-d)*1.3,len=Math.hypot(nx,ny,1),i=(y*SIZE+x)*3;
    normal[i]=Math.round((nx/len*.5+.5)*255);normal[i+1]=Math.round((ny/len*.5+.5)*255);normal[i+2]=Math.round((1/len*.5+.5)*255);
  }
  return [rgbPng(colour,SIZE),rgbPng(normal,SIZE)];
}
export function finishSiruArtifactGlb(arrayBuffer){
  return embedCeramicMaps(arrayBuffer,{images:surfaceMaps(),names:['Sowol siru grey-brown firing and mineral wear','Sowol siru fine lattice impressions and fractures'],surfaceKey:'siruSurface',normalScale:1.1});
}
