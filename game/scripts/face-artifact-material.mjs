import {rgbPng,embedCeramicMaps} from './ceramic-glb.mjs';

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
  return [rgbPng(colour,SIZE),rgbPng(normal,SIZE)];
}

// Embed colour and normal maps into the GLB. The game uses these original
// materials instead of recolouring this artifact with a shared ceramic texture.
export function finishFaceArtifactGlb(arrayBuffer){
  return embedCeramicMaps(arrayBuffer,{images:surfaceMaps(),names:['Sowol charcoal and ochre patina','Sowol vertical impressions normal'],surfaceKey:'artifactSurface',normalScale:1.25});
}
