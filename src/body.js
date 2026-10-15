import * as THREE from '../vendor/three.module.js';
import {ROWS,COLS,shapedRadius,wrapDistance} from './model.js';
import {SHOULDER_ROW,crownGeometry} from './crown.js';
import {openingLoop,insideOpening} from './openings.js';

export const WALL_THICKNESS=.11;

export function bodyGeometry(model,inner=false){
  const pos=[],normals=[],uv=[],indices=[],dents=model.marks.filter(mark=>!openingLoop(mark));
  for(let row=0;row<=SHOULDER_ROW;row++)for(let col=0;col<=COLS;col++){
    const v=row/ROWS,u=col/COLS,a=u*Math.PI*2;
    let radius=shapedRadius(model,row,col),indent=0;
    for(const mark of dents){
      const spread=mark.tool==='press'?.065:.018;let nearest=1;
      for(let k=0;k<mark.points.length;k+=2){const p=mark.points[k],dx=wrapDistance(u,((p[0]%1)+1)%1)*1.55,dy=v-p[1];nearest=Math.min(nearest,dx*dx+dy*dy);}
      if(nearest<spread*spread*3)indent+=(mark.tool==='press'?.065:.025)*Math.exp(-nearest/(spread*spread));
    }
    // A stroke cannot detach the shoulder or the foot. Repeated pressing also has a depth limit.
    const joinFade=Math.max(0,Math.min(1,v/.12,(1-v)/.12));
    radius-=Math.min(.2,indent)*joinFade;
    radius=Math.max(0,radius-(inner?WALL_THICKNESS:0));
    pos.push(Math.sin(a)*radius,(v*2-1)*model.height,Math.cos(a)*radius);uv.push(u,v);
    if(row<SHOULDER_ROW&&col<COLS){const i=row*(COLS+1)+col;indices.push(i,i+1,i+COLS+1,i+1,i+COLS+2,i+COLS+1);}
  }
  const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));side.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));side.setIndex(indices);side.computeVertexNormals();
  for(let row=0;row<=ROWS;row++){
    const first=row*(COLS+1),last=first+COLS,n=row===ROWS?new THREE.Vector3(0,1,0):new THREE.Vector3().fromBufferAttribute(side.attributes.normal,first).add(new THREE.Vector3().fromBufferAttribute(side.attributes.normal,last)).normalize();
    side.attributes.normal.setXYZ(first,n.x,n.y,n.z);side.attributes.normal.setXYZ(last,n.x,n.y,n.z);
    if(row===ROWS)for(let col=1;col<COLS;col++)side.attributes.normal.setXYZ(first+col,0,1,0);
  }
  if(inner)return side;
  const plain=side.toNonIndexed();side.dispose();
  const append=(target,source)=>{for(const value of source)target.push(value);};
  pos.length=0;uv.length=0;append(pos,plain.attributes.position.array);append(uv,plain.attributes.uv.array);append(normals,plain.attributes.normal.array);
  const sideCount=pos.length/3,top=crownGeometry(model);top.scale(1,model.height,1);
  append(pos,top.attributes.position.array);append(uv,top.attributes.uv.array);append(normals,top.attributes.normal.array);
  const topCount=top.attributes.position.count;
  // Close the bottom with the same boundary vertices, never with a fixed disc.
  for(let col=0;col<COLS;col++){
    const a=col/COLS*Math.PI*2,b=(col+1)/COLS*Math.PI*2,ra=shapedRadius(model,0,col),rb=shapedRadius(model,0,col+1);
    pos.push(0,-model.height,0,Math.sin(b)*rb,-model.height,Math.cos(b)*rb,Math.sin(a)*ra,-model.height,Math.cos(a)*ra);
    normals.push(0,-1,0,0,-1,0,0,-1,0);uv.push(.5,.5,(Math.sin(b)+1)/2,(Math.cos(b)+1)/2,(Math.sin(a)+1)/2,(Math.cos(a)+1)/2);
  }
  const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));merged.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));merged.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));merged.addGroup(0,sideCount,0);merged.addGroup(sideCount,topCount,1);merged.addGroup(sideCount+topCount,COLS*3,2);plain.dispose();top.dispose();return merged;
}

export function openingWalls(model,inner,loops){
  const positions=[],colors=[],uvs=[],grid=inner.attributes.position;
  const surface=(u,v,depth)=>{
    const x=((u%1+1)%1)*COLS,y=Math.max(0,Math.min(SHOULDER_ROW-.00001,v*ROWS)),col=Math.floor(x),row=Math.floor(y),fx=x-col,fy=y-row,i=row*(COLS+1)+col;
    const a=new THREE.Vector3().fromBufferAttribute(grid,i),b=new THREE.Vector3().fromBufferAttribute(grid,i+1),c=new THREE.Vector3().fromBufferAttribute(grid,i+COLS+1),d=new THREE.Vector3().fromBufferAttribute(grid,i+COLS+2);
    const p=fx+fy<=1?a.multiplyScalar(1-fx-fy).addScaledVector(b,fx).addScaledVector(c,fy):b.multiplyScalar(1-fy).addScaledVector(c,1-fx).addScaledVector(d,fx+fy-1);
    const radius=Math.hypot(p.x,p.z),scale=(radius+WALL_THICKNESS-depth)/radius;p.x*=scale;p.z*=scale;return p;
  };
  for(let index=0;index<loops.length;index++){
    const loop=loops[index],others=loops.filter((_,i)=>i!==index);
    for(let i=0;i<loop.length;i++){
      const a=loop[i],b=loop[(i+1)%loop.length],steps=Math.max(1,Math.ceil(Math.hypot((b[0]-a[0])*6,(b[1]-a[1])*2)/.012));
      for(let j=0;j<steps;j++){
        const p=[a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps],q=[a[0]+(b[0]-a[0])*(j+1)/steps,a[1]+(b[1]-a[1])*(j+1)/steps];
        if(insideOpening((p[0]+q[0])/2,(p[1]+q[1])/2,others))continue;
        const vertices=[surface(...p,0),surface(...q,0),surface(...q,WALL_THICKNESS),surface(...p,WALL_THICKNESS)];
        for(const k of [0,1,2,0,2,3]){positions.push(...vertices[k].toArray());const light=k<2?1:.38;colors.push(light,light,light);uvs.push(k%2,k<2?1:0);}
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.computeVertexNormals();return g;
}
