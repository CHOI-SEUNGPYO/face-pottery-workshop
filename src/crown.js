import * as THREE from '../vendor/three.module.js';
import {shapedRadius,COLS} from './model.js';
import {insideLoop} from './openings.js';

export const SHOULDER_ROW=32;
export function topPoint(model,x,y,depth=0){
  const r=Math.hypot(x,y),u=(Math.atan2(x,-y)/(Math.PI*2)+1)%1,c=u*COLS,i=Math.floor(c),f=c-i;
  const radius=shapedRadius(model,SHOULDER_ROW,i)*(1-f)+shapedRadius(model,SHOULDER_ROW,i+1)*f;
  return [x*radius,.6+.4*(1-r*r)-depth,-y*radius];
}

export function crownGeometry(model){
  const outside=Array.from({length:COLS},(_,i)=>new THREE.Vector2(Math.sin(i/COLS*Math.PI*2),-Math.cos(i/COLS*Math.PI*2)));
  const holes=model.crown.length>=3?[model.crown.map(p=>new THREE.Vector2(...p))]:[];
  const centres=holes.map(loop=>loop.reduce((sum,p)=>sum.add(p),new THREE.Vector2()).multiplyScalar(1/loop.length));
  const innerHoles=holes.map((loop,i)=>{
    const inset=loop.map(p=>p.clone().lerp(centres[i],.08)),original=loop.map(p=>p.toArray());
    return inset.every((p,j)=>Array.from({length:8},(_,k)=>p.clone().lerp(inset[(j+1)%inset.length],k/8)).every(q=>insideLoop(q.x,q.y,original)))?inset:loop;
  });
  const pos=[],normals=[],uv=[];
  const emit=(a,b,c,depth,reverse=false)=>{
    const vertices=[a,b,c].map(p=>topPoint(model,p.x,p.y,depth));
    const normal=new THREE.Vector3().subVectors(new THREE.Vector3(...vertices[1]),new THREE.Vector3(...vertices[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...vertices[2]),new THREE.Vector3(...vertices[0])));
    if((normal.y<0)!==reverse)[b,c]=[c,b];
    for(const p of [a,b,c]){
      const v=topPoint(model,p.x,p.y,depth),r=Math.max(.1,Math.hypot(v[0],v[2])/Math.max(.001,p.length()));
      const n=new THREE.Vector3(.8*v[0]/(r*r),1,.8*v[2]/(r*r)).normalize().multiplyScalar(reverse?-1:1);
      pos.push(...v);normals.push(n.x,n.y,n.z);uv.push((p.x+1)/2,(p.y+1)/2);
    }
  };
  const subdivide=(a,b,c,depth,reverse,level=0)=>{
    if(level<3&&Math.max(a.distanceTo(b),b.distanceTo(c),c.distanceTo(a))>.16){
      const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);
      subdivide(a,ab,ca,depth,reverse,level+1);subdivide(ab,b,bc,depth,reverse,level+1);subdivide(ca,bc,c,depth,reverse,level+1);subdivide(ab,bc,ca,depth,reverse,level+1);
    }else emit(a,b,c,depth,reverse);
  };
  for(const [loops,depth,reverse]of [[holes,0,false],[innerHoles,.11,true]]){
    const triangles=THREE.ShapeUtils.triangulateShape(outside,loops),points=[...outside,...loops.flat()];
    for(const [a,b,c]of triangles)subdivide(points[a],points[b],points[c],depth,reverse);
  }
  // Only the drawn opening has a wall; there is no raised circular collar.
  for(let index=0;index<holes.length;index++)for(let i=0;i<holes[index].length;i++)for(let part=0;part<8;part++){
    const loop=holes[index],inner=innerHoles[index],a=loop[i].clone().lerp(loop[(i+1)%loop.length],part/8),b=loop[i].clone().lerp(loop[(i+1)%loop.length],(part+1)/8),ia=inner[i].clone().lerp(inner[(i+1)%inner.length],part/8),ib=inner[i].clone().lerp(inner[(i+1)%inner.length],(part+1)/8),verts=[topPoint(model,a.x,a.y),topPoint(model,b.x,b.y),topPoint(model,ib.x,ib.y,.11),topPoint(model,ia.x,ia.y,.11)];
    for(const ids of [[0,1,2],[0,2,3]]){
      const n=new THREE.Vector3().subVectors(new THREE.Vector3(...verts[ids[1]]),new THREE.Vector3(...verts[ids[0]])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...verts[ids[2]]),new THREE.Vector3(...verts[ids[0]]))).normalize();
      for(const id of ids){pos.push(...verts[id]);normals.push(n.x,n.y,n.z);uv.push(id%2,id<2?1:0);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}
