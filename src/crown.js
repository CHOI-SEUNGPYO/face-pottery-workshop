import * as THREE from '../vendor/three.module.js';
import {shapedRadius,COLS,ROWS,SURFACE_ROWS} from './model.js';
import {insideLoop} from './openings.js';

// The complete vertical profile closes at the top. There is no separate head cap.
export const SHOULDER_ROW=ROWS;
export function crownRadius(model){
  let radius=.3;
  for(let row=24;row<ROWS;row++)for(const col of [0,20,40,60])radius=Math.max(radius,shapedRadius(model,row,col));
  return radius;
}
export function topPoint(model,x,y,depth=0,radius=crownRadius(model)){
  const distance=Math.hypot(x,y)*radius,u=(Math.atan2(x,-y)/(Math.PI*2)+1)%1,c=u*COLS,i=Math.floor(c),f=c-i;
  let previous=0,height=1;
  for(let row=SURFACE_ROWS-1;row>=0;row--){
    const sample=row/SURFACE_ROWS*ROWS,r=shapedRadius(model,sample,i)*(1-f)+shapedRadius(model,sample,(i+1)%COLS)*f;
    if(r>=distance){height=((row+1-(distance-previous)/(r-previous||1))/SURFACE_ROWS*2-1);break;}
    previous=r;
  }
  return [x*radius,height-depth,-y*radius];
}

export function mouthOutline(model){
  const loop=model.crown;if(loop.length<3)return [];
  const signed=loop.reduce((sum,p,i)=>{const q=loop[(i+1)%loop.length];return sum+p[0]*q[1]-q[0]*p[1];},0),direction=signed>0?1:-1;
  const radius=crownRadius(model),clearance=Math.max(.002,.995-Math.max(...loop.map(p=>Math.hypot(...p)))),width=Math.min(.055/radius,clearance*.5);
  return loop.map((p,i)=>{
    const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length],la=Math.hypot(p[0]-a[0],p[1]-a[1])||1,lb=Math.hypot(b[0]-p[0],b[1]-p[1])||1;
    const nx=direction*((p[1]-a[1])/la+(b[1]-p[1])/lb),ny=-direction*((p[0]-a[0])/la+(b[0]-p[0])/lb),length=Math.hypot(nx,ny)||1;
    return [p[0]+nx/length*width,p[1]+ny/length*width];
  });
}

export function mouthCut(model){
  const outline=mouthOutline(model),radius=crownRadius(model);
  const bottom=outline.length?(Math.min(...outline.map(p=>topPoint(model,...p,0,radius)[1]))-.16)*model.height:Infinity;
  return {outline,radius,bottom};
}
export function insideMouth(point,cut){
  return point.y>cut.bottom&&insideLoop(point.x/cut.radius,-point.z/cut.radius,cut.outline);
}

export function crownGeometry(model){
  const inner=model.crown,outer=mouthOutline(model),positions=[],uv=[];
  if(inner.length<3)return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([],3)).setAttribute('normal',new THREE.Float32BufferAttribute([],3)).setAttribute('uv',new THREE.Float32BufferAttribute([],2));
  const radius=crownRadius(model),surface=(p,depth=0)=>topPoint(model,...p,depth,radius);
  const triangle=(a,b,c)=>{for(const p of [a,b,c]){positions.push(...p);uv.push(p[0]/(2*radius)+.5,p[2]/(2*radius)+.5);}};
  for(let i=0;i<inner.length;i++){
    const next=(i+1)%inner.length,steps=Math.max(1,Math.ceil(Math.hypot(inner[i][0]-inner[next][0],inner[i][1]-inner[next][1])*radius/.025));
    for(let j=0;j<steps;j++){
      const at=(loop,t)=>loop[i].map((value,k)=>value+(loop[next][k]-value)*t);
      const a=at(outer,j/steps),b=at(outer,(j+1)/steps),c=at(inner,j/steps),d=at(inner,(j+1)/steps);
      const ab=surface(a),bb=surface(b),cb=surface(c,.11),db=surface(d,.11);
      const levelA=Math.max(ab[1],cb[1]+.11)+.1,levelB=Math.max(bb[1],db[1]+.11)+.1;
      const atip=[a[0]*radius,levelA,-a[1]*radius],btip=[b[0]*radius,levelB,-b[1]*radius],ctip=[c[0]*radius,levelA,-c[1]*radius],dtip=[d[0]*radius,levelB,-d[1]*radius];
      triangle(ab,bb,btip);triangle(ab,btip,atip);
      triangle(atip,btip,dtip);triangle(atip,dtip,ctip);
      triangle(ctip,dtip,db);triangle(ctip,db,cb);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
