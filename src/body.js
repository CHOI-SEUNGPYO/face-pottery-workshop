import * as THREE from '../vendor/three.module.js';
import {ROWS,COLS,SURFACE_ROWS,shapedRadius,profileY,wrapDistance} from './model.js';
import {crownGeometry} from './crown.js';
import {openingLoop,insideOpening,raisedFootprint,openingFrame} from './openings.js';

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
    const i=row*stride+col;cache.outerRadii[i]=Math.max(0,radius[row]-cache.cuts[i]);r[i]=Math.max(0,cache.outerRadii[i]-(inner?WALL_THICKNESS:0));
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
function sculptCache(cuts,outside){return {outerRadii:new Float64Array(outside),cuts:new Float32Array(cuts),radii:new Float64Array(cuts.length),normals:new Float64Array(cuts.length*3)};}

export function bodyGeometry(model,inner=false){
  const pos=[],normals=[],uv=[],indices=[],cuts=[],outside=[],dents=model.marks.filter(mark=>!openingLoop(mark,model));
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
    outside.push(Math.max(0,radius));radius=Math.max(0,radius-(inner?WALL_THICKNESS:0));
    const source=col*(SURFACE_ROWS+1)+row,scale=profile[row].x?radius/profile[row].x:0;
    pos.push(vertices.getX(source)*scale,vertices.getY(source),vertices.getZ(source)*scale);uv.push(u,v);
  }
  lathe.dispose();
  const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));side.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));side.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(pos.length),3));side.setIndex(indices);
  // Use the same surface tangents on creation, dragging, undo and reload.
  // Switching between triangle-weighted and meridian normals left a seam.
  if(inner){side.userData.sculpt=sculptCache(cuts,outside);refreshBodyGeometry(model,side,true);return side;}
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
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));merged.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));merged.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));merged.addGroup(0,sideCount,0);merged.addGroup(sideCount,topCount,1);merged.addGroup(sideCount+topCount,COLS*3,2);merged.userData.sculpt=sculptCache(cuts,outside);plain.dispose();top.dispose();refreshBodyGeometry(model,merged);return merged;
}

export function openingWalls(model,inner,loops,raised=[]){
  const positions=[],colors=[],uvs=[],indices=[],verticesByKey=new Map(),grid=inner.attributes.position;
  const frames=loops.map(loop=>openingFrame(loop,model)),footprints=loops.map((loop,i)=>raised[i]?raisedFootprint(loop,model):loop);
  const surface=(u,v,depth)=>{
    const x=((u%1+1)%1)*COLS,y=Math.max(0,Math.min(SURFACE_ROWS-.00001,v*SURFACE_ROWS)),col=Math.floor(x),row=Math.floor(y),fx=x-col,fy=y-row,i=row*(COLS+1)+col;
    const vertex=(index,outer)=>{
      const p=new THREE.Vector3().fromBufferAttribute(grid,index);
      if(outer){const c=index%(COLS+1),r=inner.userData.sculpt.outerRadii[index];p.x=r*ringSin[c];p.z=r*ringCos[c];}return p;
    };
    // LatheGeometry uses the a-d diagonal, not the b-c diagonal.
    const at=outer=>{
      const a=vertex(i,outer),d=vertex(i+COLS+2,outer);
      return fx>=fy?a.multiplyScalar(1-fx).addScaledVector(vertex(i+1,outer),fx-fy).addScaledVector(d,fy):a.multiplyScalar(1-fy).addScaledVector(d,fx).addScaledVector(vertex(i+COLS+1,outer),fy-fx);
    };
    const p=at(true);
    if(depth>=0)return p.lerp(at(false),Math.min(1,depth/WALL_THICKNESS));
    const r=Math.max(1,Math.min(ROWS-1,v*ROWS)),c=(u*COLS|0),dy=profileY(model,(r+1)/ROWS)-profileY(model,(r-1)/ROWS);
    const slope=(shapedRadius(model,r-1,c)-shapedRadius(model,r+1,c))/Math.max(dy,.000001),tilt=Math.max(.35,Math.min(.9,slope));
    const angle=u*Math.PI*2,normal=new THREE.Vector3(Math.sin(angle),tilt,Math.cos(angle)).normalize();
    return p.addScaledVector(normal,-depth);
  };
  const triangle=(vertices,coordinates,light=[1,1,1])=>{
    for(let k=0;k<3;k++){
      const point=vertices[k].toArray(),key=[...point,...coordinates[k],light[k]].map(n=>Math.round(n*1e6)).join(',');
      if(!verticesByKey.has(key)){verticesByKey.set(key,positions.length/3);positions.push(...point);colors.push(light[k],light[k],light[k]);uvs.push(...coordinates[k]);}
      indices.push(verticesByKey.get(key));
    }
  };
  const quad=(v,p,light=[1,1,1,1])=>{for(const ids of [[0,1,2],[0,2,3]])triangle(ids.map(i=>v[i]),ids.map(i=>p[i]),ids.map(i=>light[i]));};
  const edge=(a,b,callback,depth=0)=>{
    const mid=a.map((v,i)=>(v+b[i])/2),pa=surface(...a,0),pb=surface(...b,0),pm=surface(...mid,0);
    if(depth<14&&(pa.distanceTo(pb)>.022||pm.distanceTo(pa.clone().add(pb).multiplyScalar(.5))>.002)){edge(a,mid,callback,depth+1);edge(mid,b,callback,depth+1);}else callback(a,b);
  };
  for(let index=0;index<loops.length;index++){
    const loop=frames[index].sampleLoop(loops[index]),foot=footprints[index],others=footprints.filter((_,i)=>i!==index),frame=frames[index];
    if(raised[index]){
      const outer=foot.map(frame.toPlane),hole=loop.map(frame.toPlane),points=[...outer,...hole];
      const faces=THREE.ShapeUtils.triangulateShape(outer.map(p=>new THREE.Vector2(...p)),[hole.map(p=>new THREE.Vector2(...p))]);
      const distance=(p,path)=>{let d=Infinity;for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));d=Math.min(d,Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t));}return d;};
      const emit=coords=>{
        const centre=coords[0].map((_,k)=>(coords[0][k]+coords[1][k]+coords[2][k])/3),uv=coords.map(frame.fromPlane),c=frame.fromPlane(centre);
        if(insideOpening(...c,others))return;
        const lift=coords.map(p=>{const a=distance(p,outer),b=distance(p,hole),t=a/(a+b||1);return -EAR_RISE*Math.sin(t*Math.PI/2)**2;});
        triangle(uv.map((p,i)=>surface(...p,lift[i])),uv);
        triangle(uv.map(p=>surface(...p,WALL_THICKNESS)).reverse(),uv.slice().reverse(),[.38,.38,.38]);
      };
      const patch=(a,b,c,depth=0)=>{
        const points=[a,b,c],world=points.map(p=>surface(...frame.fromPlane(p),0));
        const lengths=points.map((p,i)=>{
          const q=points[(i+1)%3],mid=p.map((v,k)=>(v+q[k])/2),actualMid=surface(...frame.fromPlane(mid),0),chord=world[i].clone().add(world[(i+1)%3]).multiplyScalar(.5);
          return Math.max(Math.hypot(p[0]-q[0],p[1]-q[1])/.025,world[i].distanceTo(world[(i+1)%3])/.035,actualMid.distanceTo(chord)/.002);
        });
        const longest=lengths.indexOf(Math.max(...lengths));
        if(lengths[longest]>1&&depth<18){
          const p=points[longest],q=points[(longest+1)%3],other=points[(longest+2)%3],mid=p.map((v,i)=>(v+q[i])/2);
          patch(p,mid,other,depth+1);patch(mid,q,other,depth+1);
        }else emit(points);
      };
      for(const face of faces)patch(...face.map(i=>points[i]));
    }
    for(let i=0;i<loop.length;i++)edge(loop[i],loop[(i+1)%loop.length],(p,q)=>{
      if(insideOpening((p[0]+q[0])/2,(p[1]+q[1])/2,others))return;
      const lift=raised[index]?-EAR_RISE:0;
      quad([surface(...p,lift),surface(...q,lift),surface(...q,WALL_THICKNESS),surface(...p,WALL_THICKNESS)],[p,q,q,p],[1,1,.38,.38]);
    });
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
