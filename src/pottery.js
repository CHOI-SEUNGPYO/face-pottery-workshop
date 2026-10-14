import * as THREE from '../vendor/three.module.js';
import { ROWS,COLS,baseRadius,wrapDistance,clamp } from './model.js';

const TAU=Math.PI*2;
const makeCanvas=(w=1024,h=512)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export class Pottery {
  constructor(container,model){
    this.container=container;this.model=model;this.angle=0;this.stage=1;
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);
    container.append(this.renderer.domElement);this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-2,2,2,-2,.1,40);
    this.scene.add(new THREE.HemisphereLight(0xfff6e8,0x624830,2.1));const key=new THREE.DirectionalLight(0xffeed8,3.2);key.position.set(-3,5,5);this.scene.add(key);const fill=new THREE.DirectionalLight(0xe3f0f4,.9);fill.position.set(4,2,-3);this.scene.add(fill);
    this.pot=new THREE.Group();this.scene.add(this.pot);this.guides=new THREE.Group();this.pot.add(this.guides);this.guideCount=0;
    this.mask=makeCanvas();this.bump=makeCanvas();this.baseBump=makeCanvas();this.colorMap=makeCanvas();this.noise();this.baseColor=makeCanvas();this.baseColor.getContext('2d').drawImage(this.colorMap,0,0);this.plainColor=new THREE.CanvasTexture(this.baseColor);this.plainColor.colorSpace=THREE.SRGBColorSpace;
    this.maskTexture=new THREE.CanvasTexture(this.mask);this.bumpTexture=new THREE.CanvasTexture(this.bump);this.colorTexture=new THREE.CanvasTexture(this.colorMap);this.colorTexture.colorSpace=THREE.SRGBColorSpace;
    for(const t of [this.maskTexture,this.bumpTexture,this.colorTexture]){t.wrapS=THREE.RepeatWrapping;t.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());}
    this.material=new THREE.MeshStandardMaterial({color:0xb97852,map:this.colorTexture,bumpMap:this.bumpTexture,bumpScale:.045,roughness:.88,metalness:0,alphaMap:this.maskTexture,alphaTest:.5,side:THREE.FrontSide});
    this.insideMaterial=this.material.clone();this.insideMaterial.side=THREE.BackSide;this.insideMaterial.color.set(0x6e442f);this.insideMaterial.roughness=1;
    this.body=new THREE.Mesh(new THREE.BufferGeometry(),this.material);this.inner=new THREE.Mesh(new THREE.BufferGeometry(),this.insideMaterial);this.pot.add(this.body,this.inner);
    this.plainBump=new THREE.CanvasTexture(this.baseBump);
    this.capMaterial=this.material.clone();this.capMaterial.alphaMap=null;this.capMaterial.map=this.plainColor;this.capMaterial.bumpMap=this.plainBump;this.capMaterial.side=THREE.DoubleSide;this.cap=new THREE.Mesh(new THREE.BufferGeometry(),this.capMaterial);this.pot.add(this.cap);
    this.base=new THREE.Mesh(new THREE.CircleGeometry(.54,64),this.insideMaterial.clone());this.base.material.side=THREE.DoubleSide;this.base.material.alphaMap=null;this.base.rotation.x=-Math.PI/2;this.pot.add(this.base);
    const shadow=makeCanvas(256,256),ctx=shadow.getContext('2d');let grad=ctx.createRadialGradient(128,128,4,128,128,126);grad.addColorStop(0,'rgba(80,53,27,.28)');grad.addColorStop(.5,'rgba(80,53,27,.14)');grad.addColorStop(1,'rgba(80,53,27,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
    this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadow),transparent:true,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
    this.siru=this.makeSiru();this.scene.add(this.siru);this.siru.visible=false;
    this.ray=new THREE.Raycaster();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();container.dispatchEvent(new CustomEvent('render-lost',{bubbles:true}));});
    this.update(model);this.resize();
  }
  noise(){
    let seed=7717;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const ctx=this.baseBump.getContext('2d'),img=ctx.createImageData(1024,512),rgb=this.colorMap.getContext('2d'),col=rgb.createImageData(1024,512);
    for(let y=0;y<512;y++)for(let x=0;x<1024;x++){const i=(y*1024+x)*4;const grain=random();const wave=Math.sin(x*.037+Math.sin(y*.025)*3)*.1+Math.sin(y*.086+x*.006)*.08;const n=clamp(135+grain*58+wave*160,0,255);for(let k=0;k<3;k++){img.data[i+k]=n;col.data[i+k]=clamp(217+wave*42+(grain-.5)*32,0,255);}img.data[i+3]=col.data[i+3]=255;}ctx.putImageData(img,0,0);rgb.putImageData(col,0,0);
  }
  makeSiru(){
    const g=new THREE.Group(),points=[new THREE.Vector2(.76,-1.2),new THREE.Vector2(.73,-1.14),new THREE.Vector2(.55,-.3),new THREE.Vector2(.45,.25),new THREE.Vector2(.38,.25),new THREE.Vector2(.48,-.3),new THREE.Vector2(.66,-1.14),new THREE.Vector2(.69,-1.2),new THREE.Vector2(.76,-1.2)];
    const mat=new THREE.MeshStandardMaterial({color:0x9d8a72,map:this.plainColor,bumpMap:this.plainBump,bumpScale:.035,roughness:1,side:THREE.DoubleSide});g.add(new THREE.Mesh(new THREE.LatheGeometry(points,64),mat));
    for(const sign of [-1,1]){const path=new THREE.CatmullRomCurve3([new THREE.Vector3(sign*.62,-.43,0),new THREE.Vector3(sign*.86,-.37,0),new THREE.Vector3(sign*.99,-.16,0)]);const geom=new THREE.TubeGeometry(path,14,.11,10,false);const pos=geom.attributes.position;for(let i=0;i<pos.count;i++){const t=Math.floor(i/11)/14,center=path.getPointAt(t);const taper=1-t*.96;const v=new THREE.Vector3().fromBufferAttribute(pos,i).sub(center).multiplyScalar(taper).add(center);pos.setXYZ(i,v.x,v.y,v.z);}geom.computeVertexNormals();g.add(new THREE.Mesh(geom,mat));}return g;
  }
  geometry(inner=false){
    const pos=[],uv=[],indices=[],model=this.model;
    for(let row=0;row<=ROWS;row++){const v=row/ROWS;for(let col=0;col<=COLS;col++){const u=col/COLS,a=u*TAU;let r=baseRadius(v)+model.offsets[row*COLS+col%COLS];
      // ponytail: a sampled surface keeps edits responsive; detached clay needs a volumetric sculptor.
      for(const mark of model.marks){if(mark.tool==='hole')continue;const rad=mark.tool==='press'?.065:.018;let closest=1;for(let k=0;k<mark.points.length;k+=2){const p=mark.points[k],dx=wrapDistance(u,((p[0]%1)+1)%1)*1.55,dy=v-p[1];closest=Math.min(closest,dx*dx+dy*dy);}if(closest<rad*rad*3)r-=(mark.tool==='press'?.065:.025)*Math.exp(-closest/(rad*rad));}
      r=Math.max(.18,r)+(row>1&&row<ROWS-2?.008*Math.sin(a*7+v*17)*Math.sin(v*23+a*3):0)-(inner?.07:0);pos.push(Math.sin(a)*r,(v*2-1)*model.height,Math.cos(a)*r);uv.push(u,v);
      if(row<ROWS&&col<COLS){const i=row*(COLS+1)+col;indices.push(i,i+1,i+COLS+1,i+1,i+COLS+2,i+COLS+1);}
    }}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  paint(){
    const mask=this.mask.getContext('2d'),bump=this.bump.getContext('2d'),color=this.colorMap.getContext('2d');mask.fillStyle='white';mask.fillRect(0,0,1024,512);bump.drawImage(this.baseBump,0,0);color.drawImage(this.baseColor,0,0);
    for(const mark of this.model.marks){for(const shift of [-1,0,1]){const ctx=mark.tool==='hole'?mask:bump;const pts=mark.points;if(!pts.length)continue;ctx.beginPath();pts.forEach(([u,v],i)=>{const x=(u+shift)*1024,y=(1-v)*512;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.lineCap='round';ctx.lineJoin='round';
      if(mark.tool==='hole'){ctx.fillStyle='#000';ctx.strokeStyle='#000';if(pts.length<4){const p=pts[0];ctx.arc((p[0]+shift)*1024,(1-p[1])*512,8,0,TAU);ctx.fill();}else{ctx.closePath();ctx.fill();ctx.lineWidth=2;ctx.stroke();}}
      else{ctx.strokeStyle=mark.tool==='carve'?'#353535':'#777';ctx.lineWidth=mark.tool==='carve'?7:22;ctx.stroke();if(mark.tool==='carve'){color.beginPath();pts.forEach(([u,v],i)=>i?color.lineTo((u+shift)*1024,(1-v)*512):color.moveTo((u+shift)*1024,(1-v)*512));color.lineCap='round';color.lineJoin='round';color.strokeStyle='#756657';color.lineWidth=5;color.stroke();}}
    }}this.maskTexture.needsUpdate=true;this.bumpTexture.needsUpdate=true;this.colorTexture.needsUpdate=true;
  }
  crown(){
    const shape=new THREE.Shape();shape.absarc(0,0,.483,0,TAU,false);
    if(this.model.crown.length>=3){const hole=new THREE.Path();this.model.crown.forEach(([x,y],i)=>i?hole.lineTo(x*.46,y*.46):hole.moveTo(x*.46,y*.46));hole.closePath();shape.holes.push(hole);}
    const g=new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1,curveSegments:48});g.rotateX(-Math.PI/2);this.cap.geometry.dispose();this.cap.geometry=g;this.cap.position.y=this.model.height;
  }
  update(model=this.model){this.model=model;this.body.geometry.dispose();this.inner.geometry.dispose();this.body.geometry=this.geometry();this.inner.geometry=this.geometry(true);this.base.position.y=-model.height+.015;this.paint();this.crown();this.setGuides(this.guideCount);this.setFired(model.fired?1:0);this.layout();}
  setGuides(count){
    this.guideCount=count;
    for(const line of [...this.guides.children]){line.geometry.dispose();line.material.dispose();this.guides.remove(line);}
    for(let i=0;i<count;i++){
      const col=Math.round((i+.5)/count*COLS),a=col/COLS*TAU,points=[];
      for(let row=3;row<ROWS-2;row++){const v=row/ROWS,r=baseRadius(v)+this.model.offsets[row*COLS+col%COLS]+.025;points.push(new THREE.Vector3(Math.sin(a)*r,(v*2-1)*this.model.height,Math.cos(a)*r));}
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:0xffe4ab,dashSize:.07,gapSize:.05,transparent:true,opacity:.85}));line.computeLineDistances();this.guides.add(line);
    }
    this.guides.visible=this.stage===3;this.render();
  }
  setFired(t){const wet=new THREE.Color(0xbe7c52),dry=new THREE.Color(0x82715b);this.material.color.copy(wet).lerp(dry,t);this.capMaterial.color.copy(this.material.color);this.material.roughness=.84+t*.16;this.insideMaterial.color.set(0x60402c).lerp(new THREE.Color(0x453c31),t);this.render();}
  setStage(stage){this.stage=stage;this.layout();}
  mount(container){if(container!==this.container){this.observer.unobserve(this.container);this.container=container;container.append(this.renderer.domElement);this.observer.observe(container);}this.resize();}
  layout(){
    this.guides.visible=this.stage===3;
    this.pot.scale.setScalar(1);this.pot.position.set(0,0,0);this.pot.rotation.y=this.angle;this.siru.visible=this.stage===6||this.stage===7;this.siru.scale.setScalar(.65);this.siru.position.set(.8,-.35,0);
    if(this.stage===6){this.pot.scale.setScalar(.65);this.pot.position.set(-.65,0,0);}
    if(this.stage===7){this.pot.scale.setScalar(.55);this.pot.position.set(this.model.assembled?.8:-.85,-.17+this.model.height*.55,0);}
    if(this.stage===8){this.pot.scale.setScalar(.7);this.pot.position.x=-.83;}
    this.shadow.position.set(this.pot.position.x,this.pot.position.y-this.model.height*this.pot.scale.y-.03,0);this.shadow.scale.setScalar(this.pot.scale.x);this.shadow.visible=this.stage!==2;
    this.resize();
  }
  resize(){const rect=this.container.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const w=rect.width,h=rect.height;this.renderer.setSize(w,h,false);let height=this.stage===2?2.7:3.1;const aspect=w/h;if(aspect<.95)height/=aspect;if(this.stage===6||this.stage===7||this.stage===8)height=Math.max(height,3.8/aspect);this.camera.left=-height*aspect/2;this.camera.right=height*aspect/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.position.set(0,this.stage===2?7:2.0,this.stage===2?.001:6);this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();this.render();}
  render(){if(this.renderer&&this.camera)this.renderer.render(this.scene,this.camera);}
  rotate(delta){this.angle+=delta;this.pot.rotation.y=this.angle;this.render();}
  hit(clientX,clientY){const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);return this.ray.intersectObject(this.body,false)[0];}
  crownPoint(clientX,clientY){const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);const point=this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-this.model.height),new THREE.Vector3());if(!point)return null;this.pot.worldToLocal(point);const x=point.x/.46,y=-point.z/.46;return Math.hypot(x,y)<.93?[x,y]:null;}
  move(dx,dy){this.pot.position.x+=dx;this.pot.position.y+=dy;this.render();}
  tryAssemble(){const yes=Math.abs(this.pot.position.x-.8)<.52&&Math.abs(this.pot.position.y-(-.17+this.model.height*.55))<.55;if(yes){this.model.assembled=true;}this.layout();return yes;}
}
