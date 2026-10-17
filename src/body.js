import * as THREE from '../vendor/three.module.js';
import {ROWS,COLS,SURFACE_ROWS,shapedRadius,profileY,wrapDistance} from './model.js';
import {crownGeometry} from './crown.js';
import {openingLoop,insideOpening,raisedFootprint} from './openings.js';

export const WALL_THICKNESS=.11;
export const EAR_RISE=.18;

// The silhouette editor changes rings, not the child's marks. Retain their
// cached indentations and mesh buffers; rebuild only if a mouth changes topology.
const ringSin=Array.from({length:COLS+1},(_,i)=>Math.sin(i/COLS*Math.PI*2));
const ringCos=Array.from({length:COLS+1},(_,i)=>Math.cos(i/COLS*Math.PI*2));
export function refreshBodyGeometry(model,geometry,inner=false){
  const cache=geometry.userData.sculpt;if(!cache)return false;
  const top=!inner&&model.crown.length?crownGeometry(model):null;
  if(top&&top.attributes.position.count!==geometry.groups[1].count){top.dispose();return false;}
  if(top)top.scale(1,model.height,1);
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  const radius=Array.from({length:SURFACE_ROWS+1},(_,i)=>shapedRadius(model,i/SURFACE_ROWS*ROWS,0));
  const levels=radius.map((_,i)=>profileY(model,i/SURFACE_ROWS)),r=cache.radii,normal=cache.normals,stride=COLS+1;
  for(let row=0;row<=SURFACE_ROWS;row++)for(let col=0;col<=COLS;col++){
    const i=row*stride+col;r[i]=Math.max(0,radius[row]-cache.cuts[i]-(inner?WALL_THICKNESS:0));
  }
  for(let row=0;row<=SURFACE_ROWS;row++)for(let col=0;col<=COLS;col++){
    const i=row*stride+col,k=i*3;
    if(row===SURFACE_ROWS){normal[k]=0;normal[k+1]=1;normal[k+2]=0;continue;}
    const a=Math.max(0,row-1),b=row+1,dr=r[b*stride+col]-r[a*stride+col],dy=levels[b]-levels[a];
    const dt=(r[row*stride+(col+1)%COLS]-r[row*stride+(col+COLS-1)%COLS])/(2*Math.PI*2/COLS*Math.max(r[i],.001));
    const x=dy*(ringSin[col]-dt*ringCos[col]),z=dy*(ringCos[col]+dt*ringSin[col]),length=Math.hypot(x,dr,z)||1;
    normal[k]=x/length;normal[k+1]=-dr/length;normal[k+2]=z/length;
  }
  const count=inner?p.count:geometry.groups[0].count;
  for(let i=0;i<count;i++){
    const row=Math.round(uv.getY(i)*SURFACE_ROWS),col=Math.round(uv.getX(i)*COLS),grid=row*stride+col,k=grid*3;
    p.setXYZ(i,r[grid]*ringSin[col],levels[row],r[grid]*ringCos[col]);
    n.setXYZ(i,normal[k],normal[k+1],normal[k+2]);
  }
  if(!inner){
    if(top){
      const start=geometry.groups[1].start;
      for(const name of ['position','normal','uv'])geometry.attributes[name].array.set(top.attributes[name].array,start*geometry.attributes[name].itemSize);
      uv.needsUpdate=true;top.dispose();
    }
    const bottom=geometry.groups[2];
    for(let i=bottom.start;i<bottom.start+bottom.count;i++){
      if((i-bottom.start)%3===0)p.setXYZ(i,0,levels[0],0);
      else p.setXYZ(i,(uv.getX(i)*2-1)*radius[0],levels[0],(uv.getY(i)*2-1)*radius[0]);
    }
  }
  p.needsUpdate=true;n.needsUpdate=true;geometry.computeBoundingSphere();geometry.boundingBox=null;
  return true;
}
function sculptCache(cuts){return {cuts:new Float32Array(cuts),radii:new Float64Array(cuts.length),normals:new Float64Array(cuts.length*3)};}

export function bodyGeometry(model,inner=false){
  const pos=[],normals=[],uv=[],indices=[],cuts=[],dents=model.marks.filter(mark=>!openingLoop(mark));
  // Three.js r180 LatheGeometry (MIT): revolve one continuous meridian.
  // Reorder its grid for our existing opening-wall UV interpolation.
  const profile=Array.from({length:SURFACE_ROWS+1},(_,row)=>new THREE.Vector2(shapedRadius(model,row/SURFACE_ROWS*ROWS,0),profileY(model,row/SURFACE_ROWS)));
  const lathe=new THREE.LatheGeometry(profile,COLS),vertices=lathe.attributes.position;
  const gridIndex=i=>(i%(SURFACE_ROWS+1))*(COLS+1)+Math.floor(i/(SURFACE_ROWS+1));
  for(const i of lathe.index.array)indices.push(gridIndex(i));
  for(let row=0;row<=SURFACE_ROWS;row++)for(let col=0;col<=COLS;col++){
    const v=row/SURFACE_ROWS,u=col/COLS;
    let radius=shapedRadius(model,v*ROWS,col),indent=0;
    for(const mark of dents){
      const spread=mark.tool==='press'?.065:.018;let nearest=1;
      for(let k=0;k<mark.points.length;k+=2){const p=mark.points[k],dx=wrapDistance(u,((p[0]%1)+1)%1)*1.55,dy=v-p[1];nearest=Math.min(nearest,dx*dx+dy*dy);}
      if(nearest<spread*spread*3)indent+=(mark.tool==='press'?.065:.025)*Math.exp(-nearest/(spread*spread));
    }
    // A stroke cannot detach the shoulder or the foot. Repeated pressing also has a depth limit.
    const joinFade=Math.max(0,Math.min(1,v/.12,(1-v)/.12));
    const cut=Math.min(.2,indent)*joinFade;cuts.push(cut);radius-=cut;
    radius=Math.max(0,radius-(inner?WALL_THICKNESS:0));
    const source=col*(SURFACE_ROWS+1)+row,scale=profile[row].x?radius/profile[row].x:0;
    pos.push(vertices.getX(source)*scale,vertices.getY(source),vertices.getZ(source)*scale);uv.push(u,v);
  }
  lathe.dispose();
  const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));side.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));side.setIndex(indices);side.computeVertexNormals();
  for(let row=0;row<=SURFACE_ROWS;row++){
    const first=row*(COLS+1),last=first+COLS,n=row===SURFACE_ROWS?new THREE.Vector3(0,1,0):new THREE.Vector3().fromBufferAttribute(side.attributes.normal,first).add(new THREE.Vector3().fromBufferAttribute(side.attributes.normal,last)).normalize();
    side.attributes.normal.setXYZ(first,n.x,n.y,n.z);side.attributes.normal.setXYZ(last,n.x,n.y,n.z);
    if(row===SURFACE_ROWS)for(let col=1;col<COLS;col++)side.attributes.normal.setXYZ(first+col,0,1,0);
  }
  if(inner){side.userData.sculpt=sculptCache(cuts);return side;}
  const plain=side.toNonIndexed();side.dispose();
  const append=(target,source)=>{for(const value of source)target.push(value);};
  pos.length=0;uv.length=0;append(pos,plain.attributes.position.array);append(uv,plain.attributes.uv.array);append(normals,plain.attributes.normal.array);
  const sideCount=pos.length/3,top=crownGeometry(model);top.scale(1,model.height,1);
  append(pos,top.attributes.position.array);append(uv,top.attributes.uv.array);append(normals,top.attributes.normal.array);
  const topCount=top.attributes.position.count;
  // Close the bottom with the same boundary vertices, never with a fixed disc.
  for(let col=0;col<COLS;col++){
    const a=col/COLS*Math.PI*2,b=(col+1)/COLS*Math.PI*2,ra=shapedRadius(model,0,col),rb=shapedRadius(model,0,col+1);
    const bottom=profileY(model,0);
    pos.push(0,bottom,0,Math.sin(b)*rb,bottom,Math.cos(b)*rb,Math.sin(a)*ra,bottom,Math.cos(a)*ra);
    normals.push(0,-1,0,0,-1,0,0,-1,0);uv.push(.5,.5,(Math.sin(b)+1)/2,(Math.cos(b)+1)/2,(Math.sin(a)+1)/2,(Math.cos(a)+1)/2);
  }
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));merged.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));merged.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));merged.addGroup(0,sideCount,0);merged.addGroup(sideCount,topCount,1);merged.addGroup(sideCount+topCount,COLS*3,2);merged.userData.sculpt=sculptCache(cuts);plain.dispose();top.dispose();return merged;
}

export function openingWalls(model,inner,loops,raised=[]){
  const positions=[],colors=[],uvs=[],indices=[],verticesByKey=new Map(),grid=inner.attributes.position;
  const footprints=loops.map((loop,i)=>raised[i]?raisedFootprint(loop):loop);
  const surface=(u,v,depth)=>{
    const x=((u%1+1)%1)*COLS,y=Math.max(0,Math.min(SURFACE_ROWS-.00001,v*SURFACE_ROWS)),col=Math.floor(x),row=Math.floor(y),fx=x-col,fy=y-row,i=row*(COLS+1)+col;
    const a=new THREE.Vector3().fromBufferAttribute(grid,i),b=new THREE.Vector3().fromBufferAttribute(grid,i+1),c=new THREE.Vector3().fromBufferAttribute(grid,i+COLS+1),d=new THREE.Vector3().fromBufferAttribute(grid,i+COLS+2);
    const p=fx+fy<=1?a.multiplyScalar(1-fx-fy).addScaledVector(b,fx).addScaledVector(c,fy):b.multiplyScalar(1-fy).addScaledVector(c,1-fx).addScaledVector(d,fx+fy-1);
    const radius=Math.hypot(p.x,p.z),scale=(radius+WALL_THICKNESS-depth)/Math.max(radius,.001);p.x*=scale;p.z*=scale;
    if(depth<0){
      // Lift the mouth along the shoulder's outward/upward direction. Both
      // the skirt and its tunnel share this displacement and stay connected.
      const row=Math.max(1,Math.min(ROWS-1,v*ROWS)),col=u*COLS|0;
      const slope=(shapedRadius(model,row-1,col)-shapedRadius(model,row+1,col))/(profileY(model,(row+1)/ROWS)-profileY(model,(row-1)/ROWS));
      p.y+=-depth*Math.max(.35,Math.min(.9,slope));
    }
    return p;
  };
  const quad=(vertices,coordinates,light=[1,1,1,1])=>{
    for(const k of [0,1,2,0,2,3]){
      const point=vertices[k].toArray(),key=[...point,...coordinates[k],light[k]].map(n=>Math.round(n*1e5)).join(',');
      if(!verticesByKey.has(key)){verticesByKey.set(key,positions.length/3);positions.push(...point);colors.push(light[k],light[k],light[k]);uvs.push(...coordinates[k]);}
      indices.push(verticesByKey.get(key));
    }
  };
  for(let index=0;index<loops.length;index++){
    const loop=loops[index],foot=footprints[index],others=footprints.filter((_,i)=>i!==index);
    for(let i=0;i<loop.length;i++){
      const a=loop[i],b=loop[(i+1)%loop.length],steps=Math.max(1,Math.ceil(Math.hypot((b[0]-a[0])*6,(b[1]-a[1])*2)/.012));
      for(let j=0;j<steps;j++){
        const p=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps],q=[a[0]+(b[0]-a[0])*(j+1)/steps,a[1]+(b[1]-a[1])*(j+1)/steps];
        if(insideOpening((p[0]+q[0])/2,(p[1]+q[1])/2,others))continue;
        if(raised[index]){
          const fa=foot[i],fb=foot[(i+1)%foot.length],fp=fa.map((v,k)=>v+(fb[k]-v)*j/steps),fq=fa.map((v,k)=>v+(fb[k]-v)*(j+1)/steps);
          const blend=(outer,inner,t)=>outer.map((v,k)=>v+(inner[k]-v)*t);
          for(let ring=0;ring<12;ring++){
            const t=ring/12,s=(ring+1)/12,pa=blend(fp,p,t),qa=blend(fq,q,t),pb=blend(fp,p,s),qb=blend(fq,q,s);
            const rise=t=>-EAR_RISE*Math.sin(t*Math.PI/2)**2;
            quad([surface(...pa,rise(t)),surface(...qa,rise(t)),surface(...qb,rise(s)),surface(...pb,rise(s))],[pa,qa,qb,pb]);
          }
          // Close the underside of the raised skirt as well as the visible tunnel.
          quad([surface(...fp,WALL_THICKNESS),surface(...fq,WALL_THICKNESS),surface(...q,WALL_THICKNESS),surface(...p,WALL_THICKNESS)],[fp,fq,q,p],[.38,.38,.38,.38]);
        }
        const lift=raised[index]?-EAR_RISE:0;
        quad([surface(...p,lift),surface(...q,lift),surface(...q,WALL_THICKNESS),surface(...p,WALL_THICKNESS)],[p,q,q,p],[1,1,.38,.38]);
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
