import * as THREE from '../vendor/three.module.js';
import {ROWS,COLS,shapedRadius,wrapDistance} from './model.js';
import {SHOULDER_ROW,crownGeometry} from './crown.js';

export function bodyGeometry(model,inner=false){
  const pos=[],normals=[],uv=[],indices=[];
  for(let row=0;row<=SHOULDER_ROW;row++)for(let col=0;col<=COLS;col++){
    const v=row/ROWS,u=col/COLS,a=u*Math.PI*2;
    let radius=shapedRadius(model,row,col),indent=0;
    for(const mark of model.marks){
      if(mark.tool==='hole')continue;
      const spread=mark.tool==='press'?.065:.018;let nearest=1;
      for(let k=0;k<mark.points.length;k+=2){const p=mark.points[k],dx=wrapDistance(u,((p[0]%1)+1)%1)*1.55,dy=v-p[1];nearest=Math.min(nearest,dx*dx+dy*dy);}
      if(nearest<spread*spread*3)indent+=(mark.tool==='press'?.065:.025)*Math.exp(-nearest/(spread*spread));
    }
    // A stroke cannot detach the shoulder or the foot. Repeated pressing also has a depth limit.
    const joinFade=Math.min(1,v/.12,(.8-v)/.12);
    radius-=Math.min(.2,indent)*joinFade;
    radius=Math.max(.18,radius)-(inner?.07:0);
    pos.push(Math.sin(a)*radius,(v*2-1)*model.height,Math.cos(a)*radius);uv.push(u,v);
    if(row<SHOULDER_ROW&&col<COLS){const i=row*(COLS+1)+col;indices.push(i,i+1,i+COLS+1,i+1,i+COLS+2,i+COLS+1);}
  }
  const side=new THREE.BufferGeometry();side.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));side.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));side.setIndex(indices);side.computeVertexNormals();
  if(inner)return side;
  const sideNormals=side.attributes.normal;
  for(let row=SHOULDER_ROW-2;row<=SHOULDER_ROW;row++)for(let col=0;col<=COLS;col++){
    const a=col/COLS*Math.PI*2,r=shapedRadius(model,SHOULDER_ROW,col),i=row*(COLS+1)+col;
    const target=new THREE.Vector3(.8*model.height*Math.sin(a)/r,1,.8*model.height*Math.cos(a)/r).normalize();
    const n=new THREE.Vector3().fromBufferAttribute(sideNormals,i).lerp(target,(row-SHOULDER_ROW+2)/2).normalize();sideNormals.setXYZ(i,n.x,n.y,n.z);
  }
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
