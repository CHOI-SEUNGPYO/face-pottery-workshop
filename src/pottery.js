import * as THREE from '../vendor/three.module.js';
import { ROWS,COLS,SURFACE_ROWS,shapedRadius,profileY,clamp } from './model.js';
import {crownRadius,mouthOutline,mouthCut,insideMouth,SHOULDER_ROW} from './crown.js';
import {bodyGeometry,refreshBodyGeometry,openingWalls} from './body.js';
import {openingLoop,insideOpening,insideLoop,raisedFootprint} from './openings.js';

import {claySurface} from './clay.js';

const TAU=Math.PI*2;
const makeCanvas=(w=1024,h=512)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export class Pottery {
  constructor(container,model){
    this.container=container;this.model=model;this.angle=0;this.stage=1;this.tool='shape';
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);
    container.append(this.renderer.domElement);this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,40);
    this.scene.add(new THREE.HemisphereLight(0xfff6e8,0x624830,2.1));const key=new THREE.DirectionalLight(0xffeed8,3.2);key.position.set(-3,5,5);this.scene.add(key);const fill=new THREE.DirectionalLight(0xe3f0f4,.9);fill.position.set(4,2,-3);this.scene.add(fill);
    this.pot=new THREE.Group();this.scene.add(this.pot);this.guides=new THREE.Group();this.pot.add(this.guides);this.guideCount=0;
    this.mask=makeCanvas();this.bump=makeCanvas();this.baseBump=makeCanvas();this.colorMap=makeCanvas();this.noise();this.baseColor=makeCanvas();this.baseColor.getContext('2d').drawImage(this.colorMap,0,0);this.plainColor=new THREE.CanvasTexture(this.baseColor);this.plainColor.colorSpace=THREE.SRGBColorSpace;
    this.maskTexture=new THREE.CanvasTexture(this.mask);this.bumpTexture=new THREE.CanvasTexture(this.bump);this.colorTexture=new THREE.CanvasTexture(this.colorMap);this.colorTexture.colorSpace=THREE.SRGBColorSpace;
    for(const t of [this.maskTexture,this.bumpTexture,this.colorTexture]){t.wrapS=THREE.RepeatWrapping;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());}
    this.material=new THREE.MeshStandardMaterial({color:0xb97852,map:this.colorTexture,bumpMap:this.bumpTexture,bumpScale:.018,roughness:.88,metalness:0,alphaMap:this.maskTexture,alphaTest:.5,side:THREE.FrontSide});
    this.insideMaterial=new THREE.MeshBasicMaterial({color:0x4b3325,map:this.plainColor,alphaMap:this.maskTexture,alphaTest:.5,side:THREE.BackSide});
    this.plainBump=new THREE.CanvasTexture(this.baseBump);
    this.capMaterial=this.material.clone();this.capMaterial.alphaMap=null;this.capMaterial.map=this.plainColor;this.capMaterial.bumpMap=this.plainBump;this.capMaterial.side=THREE.DoubleSide;
    this.floorMaterial=new THREE.MeshBasicMaterial({color:0x3b291e,map:this.plainColor,side:THREE.DoubleSide});
    this.body=new THREE.Mesh(new THREE.BufferGeometry(),[this.material,this.capMaterial,this.floorMaterial]);this.inner=new THREE.Mesh(new THREE.BufferGeometry(),this.insideMaterial);this.pot.add(this.body,this.inner);
    this.rimMaterial=this.capMaterial.clone();this.rimMaterial.vertexColors=true;this.rims=new THREE.Mesh(new THREE.BufferGeometry(),this.rimMaterial);this.pot.add(this.rims);this.openings=[];
    this.crownMask=makeCanvas(1024,1024);this.crownTexture=new THREE.CanvasTexture(this.crownMask);
    this.crownUniforms={mouthMask:{value:this.crownTexture},mouthRadius:{value:1},mouthBottom:{value:10}};
    for(const material of [this.material,this.insideMaterial])claySurface(material,this.crownUniforms);
    for(const material of [this.capMaterial,this.rimMaterial])claySurface(material);
    this.outline=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x785239,transparent:true,opacity:.8,depthTest:false}));this.outline.renderOrder=2;this.scene.add(this.outline);
    const shadow=makeCanvas(256,256),ctx=shadow.getContext('2d');let grad=ctx.createRadialGradient(128,128,4,128,128,126);grad.addColorStop(0,'rgba(80,53,27,.28)');grad.addColorStop(.5,'rgba(80,53,27,.14)');grad.addColorStop(1,'rgba(80,53,27,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadow),transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.siru=this.makeSiru();this.scene.add(this.siru);this.siru.visible=false;
    this.ray=new THREE.Raycaster();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();container.dispatchEvent(new CustomEvent('render-lost',{bubbles:true}));});
    this.update(model);this.resize();
  }
  noise(){
    // Flat maps hold only marks; the clay grain is evaluated in physical space.
    const bump=this.baseBump.getContext('2d'),color=this.colorMap.getContext('2d');
    bump.fillStyle='#808080';bump.fillRect(0,0,1024,512);
    color.fillStyle='#ffffff';color.fillRect(0,0,1024,512);
  }
  makeSiru(){
    const g=new THREE.Group(),points=[new THREE.Vector2(.76,-1.2),new THREE.Vector2(.73,-1.14),new THREE.Vector2(.55,-.3),new THREE.Vector2(.45,.25),new THREE.Vector2(.38,.25),new THREE.Vector2(.48,-.3),new THREE.Vector2(.66,-1.14),new THREE.Vector2(.69,-1.2),new THREE.Vector2(.76,-1.2)];
    const mat=new THREE.MeshStandardMaterial({color:0x9d8a72,map:this.plainColor,bumpMap:this.plainBump,bumpScale:.035,roughness:1,side:THREE.DoubleSide});claySurface(mat);g.add(new THREE.Mesh(new THREE.LatheGeometry(points,64),mat));
    for(const sign of [-1,1]){const path=new THREE.CatmullRomCurve3([new THREE.Vector3(sign*.62,-.43,0),new THREE.Vector3(sign*.86,-.37,0),new THREE.Vector3(sign*.99,-.16,0)]);const geom=new THREE.TubeGeometry(path,14,.11,10,false);const pos=geom.attributes.position;for(let i=0;i<pos.count;i++){const t=Math.floor(i/11)/14,center=path.getPointAt(t);const taper=1-t*.96;const v=new THREE.Vector3().fromBufferAttribute(pos,i).sub(center).multiplyScalar(taper).add(center);pos.setXYZ(i,v.x,v.y,v.z);}geom.computeVertexNormals();g.add(new THREE.Mesh(geom,mat));}return g;
  }
  geometry(inner=false){return bodyGeometry(this.model,inner);}
  paintMouth(cut=mouthCut(this.model)){
    this.mouth=cut;
    const crown=this.crownMask.getContext('2d'),{outline:outer,radius,bottom}=this.mouth;
    crown.fillStyle='white';crown.fillRect(0,0,1024,1024);
    if(outer.length){crown.beginPath();outer.forEach(([x,y],i)=>i?crown.lineTo((x+1)*512,(y+1)*512):crown.moveTo((x+1)*512,(y+1)*512));crown.closePath();crown.fillStyle='black';crown.fill();}
    this.crownTexture.needsUpdate=true;this.crownUniforms.mouthRadius.value=radius;this.crownUniforms.mouthBottom.value=outer.length?bottom:10;
  }
  paint(){
    this.paintMouth();
    const mask=this.mask.getContext('2d'),bump=this.bump.getContext('2d'),color=this.colorMap.getContext('2d');mask.fillStyle='white';mask.fillRect(0,0,1024,512);bump.drawImage(this.baseBump,0,0);color.drawImage(this.baseColor,0,0);
    for(const mark of this.model.marks){const loop=openingLoop(mark);for(const shift of [-1,0,1]){const ctx=loop?mask:bump;const pts=loop?(mark.tool==='ear'?raisedFootprint(loop):loop):mark.points;if(!pts.length)continue;ctx.beginPath();pts.forEach(([u,v],i)=>{const x=(u+shift)*1024,y=(1-v)*512;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.lineCap='round';ctx.lineJoin='round';
      if(loop){ctx.fillStyle='#000';ctx.closePath();ctx.fill();}
      else{ctx.strokeStyle=mark.tool==='carve'?'#353535':'#777';ctx.lineWidth=mark.tool==='carve'?7:22;ctx.stroke();if(mark.tool==='carve'){color.beginPath();pts.forEach(([u,v],i)=>i?color.lineTo((u+shift)*1024,(1-v)*512):color.moveTo((u+shift)*1024,(1-v)*512));color.lineCap='round';color.lineJoin='round';color.strokeStyle='#756657';color.lineWidth=5;color.stroke();}}
    }}this.maskTexture.needsUpdate=true;this.bumpTexture.needsUpdate=true;this.colorTexture.needsUpdate=true;
  }
  updateOpenings(){const marks=this.model.marks.filter(mark=>openingLoop(mark));this.openings=marks.map(openingLoop);this.rims.geometry.dispose();this.rims.geometry=openingWalls(this.model,this.inner.geometry,this.openings,marks.map(mark=>mark.tool==='ear'));}
  refreshShape(){
    const fast=refreshBodyGeometry(this.model,this.body.geometry);
    if(fast){refreshBodyGeometry(this.model,this.inner.geometry,true);if(this.openings.length)this.updateOpenings();}
    else{
      this.body.geometry.dispose();this.inner.geometry.dispose();this.body.geometry=this.geometry();this.inner.geometry=this.geometry(true);this.updateOpenings();
    }
    // The child's UV marks did not change. Update only the mouth's physical bounds.
    const cut=mouthCut(this.model);
    if(cut.outline.length&&cut.radius!==this.crownUniforms.mouthRadius.value)this.paintMouth(cut);
    else{this.mouth=cut;this.crownUniforms.mouthRadius.value=cut.radius;this.crownUniforms.mouthBottom.value=cut.outline.length?cut.bottom:10;}
    this.shadow.position.y=profileY(this.model,0)-.03;this.updateOutline();this.setFired(0);
  }
  update(model=this.model){this.model=model;this.body.geometry.dispose();this.inner.geometry.dispose();this.body.geometry=this.geometry();this.inner.geometry=this.geometry(true);this.updateOpenings();this.paint();this.setGuides(this.guideCount);this.updateOutline();this.setFired(model.fired?1:0);this.layout();}
  get profileView(){return this.stage===1&&this.tool==='shape';}
  setTool(tool){this.tool=tool;this.layout();}
  updateOutline(){
    const points=[],outer=mouthOutline(this.model),radius=crownRadius(this.model),bottom=this.crownUniforms.mouthBottom.value;
    for(const side of [1,-1]){
      const col=side===1?20:60;
      const edge=Array.from({length:SURFACE_ROWS+1},(_,row)=>new THREE.Vector3(side*shapedRadius(this.model,row/SURFACE_ROWS*ROWS,col),profileY(this.model,row/SURFACE_ROWS),0));
      for(let i=1;i<edge.length;i++){
        const middle=edge[i].clone().add(edge[i-1]).multiplyScalar(.5);
        if(!outer.length||middle.y<=bottom||!insideLoop(middle.x/radius,0,outer))points.push(edge[i-1],edge[i]);
      }
    }
    this.outline.geometry.dispose();this.outline.geometry=new THREE.BufferGeometry().setFromPoints(points);
  }
  setGuides(count){
    this.guideCount=count;
    for(const line of [...this.guides.children]){line.geometry.dispose();line.material.dispose();this.guides.remove(line);}
    for(let i=0;i<count;i++){
      const col=Math.round((i+.5)/count*COLS),a=col/COLS*TAU,points=[];
      for(let row=3;row<SHOULDER_ROW;row++){const v=row/ROWS,r=shapedRadius(this.model,row,col)+.025;points.push(new THREE.Vector3(Math.sin(a)*r,profileY(this.model,v),Math.cos(a)*r));}
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:0xffe4ab,dashSize:.07,gapSize:.05,transparent:true,opacity:.85}));line.computeLineDistances();this.guides.add(line);
    }
    this.guides.visible=this.stage===3;this.render();
  }
  setFired(t){const wet=new THREE.Color(0xad805f),dry=new THREE.Color(0x82715b);this.material.color.copy(wet).lerp(dry,t);this.capMaterial.color.copy(this.material.color);this.rimMaterial.color.copy(this.material.color);this.capMaterial.roughness=this.rimMaterial.roughness=.76+t*.24;this.material.roughness=.76+t*.24;this.insideMaterial.color.set(0x4b3325).lerp(new THREE.Color(0x332c23),t);this.render();}
  setStage(stage){this.stage=stage;if(stage===3&&this.guideCount)this.setGuides(this.guideCount);this.layout();}
  mount(container){if(container!==this.container){this.observer.unobserve(this.container);this.container=container;container.append(this.renderer.domElement);this.observer.observe(container);}this.resize();}
  layout(){
    this.guides.visible=this.stage===3;
    this.pot.scale.setScalar(1);this.pot.position.set(0,0,0);this.pot.rotation.y=this.profileView?0:this.angle;this.outline.visible=this.profileView;this.siru.visible=this.stage===6||this.stage===7;this.siru.scale.setScalar(.65);this.siru.position.set(.8,-.35,0);
    if(this.stage===6){this.pot.scale.setScalar(.65);this.pot.position.set(-.65,0,0);}
    if(this.stage===7){this.pot.scale.setScalar(.55);this.pot.position.set(this.model.assembled?.8:-.85,-.17-profileY(this.model,0)*.55,0);}
    if(this.stage===8){this.pot.scale.setScalar(.7);this.pot.position.x=-.83;}
    this.shadow.position.set(this.pot.position.x,this.pot.position.y+profileY(this.model,0)*this.pot.scale.y-.03,0);this.shadow.scale.setScalar(this.pot.scale.x);this.shadow.visible=this.stage!==2&&!this.profileView;
    this.resize();
  }
  resize(){const rect=this.container.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const w=rect.width,h=rect.height;this.renderer.setSize(w,h,false);let height=this.stage===2?2.7:3.1;const aspect=w/h;if(aspect<.95)height/=aspect;if(this.stage===6||this.stage===7||this.stage===8)height=Math.max(height,3.8/aspect);this.camera.left=-height*aspect/2;this.camera.right=height*aspect/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.position.set(0,this.stage===2?7:this.profileView?0:2.0,this.stage===2?.001:6);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();this.render();}
  render(){if(this.renderer&&this.camera)this.renderer.render(this.scene,this.camera);}
  rotate(delta){if(this.profileView)return;this.angle+=delta;this.pot.rotation.y=this.angle;this.render();}
  hit(clientX,clientY,includeOpenings=false){const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);return this.ray.intersectObject(this.body,false).find(hit=>hit.face.materialIndex===0&&!insideMouth(this.body.worldToLocal(hit.point.clone()),this.mouth)&&(includeOpenings||!insideOpening(hit.uv.x,hit.uv.y,this.openings)));}
  crownPoint(clientX,clientY){const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);const point=this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-profileY(this.model,1)),new THREE.Vector3());if(!point)return null;this.pot.worldToLocal(point);const radius=crownRadius(this.model);return [point.x/radius,-point.z/radius];}
  shapeGrab(clientX,clientY){
    if(this.profileView){
      const rect=this.renderer.domElement.getBoundingClientRect(),unitsPerPixel=(this.camera.right-this.camera.left)/rect.width;
      const x=(clientX-rect.left-rect.width/2)*unitsPerPixel,y=(rect.top+rect.height/2-clientY)*unitsPerPixel,side=x>=0?1:-1;
      const col=side===1?20:60;
      const topDistance=Math.abs(y-profileY(this.model,1)),bottomDistance=Math.abs(y-profileY(this.model,0));
      const end=Math.abs(x)<12*unitsPerPixel&&Math.min(topDistance,bottomDistance)<24*unitsPerPixel?(topDistance<bottomDistance?1:-1):0;
      if(end)return {v:end===1?1:0,side,unitsPerPixel,end};
      let closest=null,distance=48*unitsPerPixel;
      for(let row=1;row<=SURFACE_ROWS;row++){
        const va=(row-1)/SURFACE_ROWS,vb=row/SURFACE_ROWS;
        const ax=shapedRadius(this.model,va*ROWS,col),ay=profileY(this.model,va),bx=shapedRadius(this.model,vb*ROWS,col),by=profileY(this.model,vb);
        const dx=bx-ax,dy=by-ay,t=clamp(((Math.abs(x)-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
        const d=Math.hypot(Math.abs(x)-ax-dx*t,y-ay-dy*t);
        if(d<distance){distance=d;closest=va+(vb-va)*t;}
      }
      if(closest!==null)return {v:clamp(closest,0,.97),side,unitsPerPixel,end:0};
      return null;
    }
    const rect=this.renderer.domElement.getBoundingClientRect();let closest=null,distance=48;
    const positions=this.body.geometry.attributes.position;
    for(let i=0;i<this.body.geometry.groups[0].count;i+=3){
      const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(this.pot.matrixWorld).project(this.camera);
      const x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2,d=Math.hypot(x-clientX,y-clientY);
      if(d<distance){distance=d;closest={u:this.body.geometry.attributes.uv.getX(i),v:this.body.geometry.attributes.uv.getY(i)};}
    }
    const hit=this.hit(clientX,clientY);if(hit)closest={u:hit.uv.x,v:hit.uv.y};
    // The whole shoulder is a generous handle for changing height.
    const top=new THREE.Vector3(0,profileY(this.model,1),0).project(this.camera),topY=rect.top+(1-top.y)*rect.height/2;
    if(!closest&&Math.abs(clientX-(rect.left+rect.width/2))<rect.height*.3&&Math.abs(clientY-topY)<45)closest={u:0,v:.85};
    return closest?{...closest,side:clientX>=rect.left+rect.width/2?1:-1,unitsPerPixel:(this.camera.right-this.camera.left)/rect.width}:null;
  }
  move(dx,dy){this.pot.position.x+=dx;this.pot.position.y+=dy;this.render();}
  tryAssemble(){const yes=Math.abs(this.pot.position.x-.8)<.52&&Math.abs(this.pot.position.y-(-.17-profileY(this.model,0)*.55))<.55;if(yes){this.model.assembled=true;}this.layout();return yes;}
}
