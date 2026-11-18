import * as T from 'three';
import {galleryCases} from './display-case';

const clay = new T.MeshStandardMaterial({color:0x8c8171,roughness:.98});
const wood = new T.MeshStandardMaterial({color:0x805735,roughness:.9});
const earth = new T.MeshStandardMaterial({color:0xab8b64,roughness:1});
export function setEnvironmentMaterials(soil:T.Texture,timber:T.Texture){
  earth.map=earth.bumpMap=soil;earth.bumpScale=.006;earth.color.set(0xbebdb1);earth.needsUpdate=true;
  wood.map=wood.bumpMap=timber;wood.bumpScale=.003;wood.color.set(0xd6bea0);wood.needsUpdate=true;
}
export function mesh(parent:T.Object3D, geometry:T.BufferGeometry, material:T.Material, x=0,y=0,z=0){
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function jar(profile:number[][], material=clay){
  const g=new T.Group(),points=profile.map(([r,y])=>new T.Vector2(r,y));
  mesh(g,new T.LatheGeometry(points,40),material);
  const [r,y]=profile.at(-1)!;
  const lip=mesh(g,new T.TorusGeometry(r,.012,8,40),material,0,y,0);lip.rotation.x=Math.PI/2;
  mesh(g,new T.CircleGeometry(r*.94,40),new T.MeshStandardMaterial({color:0x302a23,roughness:1,side:T.DoubleSide}),0,y-.035,0).rotation.x=-Math.PI/2;
  return g;
}

/** Shapes interpreted from the supplied photos; these are not scanned artifacts. */
export function referencePots(){
  const group=new T.Group();
  const profiles=[
    [[.09,0],[.17,.04],[.23,.2],[.21,.34],[.12,.4],[.12,.48],[.16,.51]],
    [[.13,0],[.24,.05],[.29,.23],[.26,.4],[.16,.47],[.16,.54],[.2,.57]],
    [[.12,0],[.21,.03],[.25,.18],[.24,.33],[.17,.39],[.18,.46]],
    [[.18,0],[.13,.05],[.1,.17],[.16,.24],[.2,.27]],
  ];
  for(let side=0;side<2;side++)for(let row=0;row<2;row++)for(let i=0;i<3;i++){
    const p=jar(profiles[(i+row+side)%profiles.length],clay.clone());
    p.scale.setScalar(.7);p.position.set((side?-1:1)*(1.8+i*.35),.59+row*1.1,-2.2);
    group.add(p);
    if(row===0&&i===1){
      const stand=jar([[.17,0],[.12,.03],[.12,.1],[.16,.12]]);stand.position.copy(p.position);group.add(stand);p.position.y+=.08;
    }
  }
  return group;
}
export function workshopTools(){
  const g=new T.Group();
  // Wire cutter, wooden ribs, paddle, sponge and a low water bowl.
  mesh(g,new T.BoxGeometry(.55,.025,.32),wood,-1.45,.02,-.65);
  for(let i=0;i<3;i++){
    const rib=mesh(g,new T.CapsuleGeometry(.045,.2,4,12),wood,-1.65+i*.16,.065,-.65);
    rib.rotation.z=Math.PI/2;rib.rotation.y=i*.2;
  }
  const paddle=mesh(g,new T.BoxGeometry(.15,.035,.42),wood,1.45,.04,-.65);paddle.rotation.y=-.4;
  mesh(g,new T.CylinderGeometry(.025,.025,.3,10),wood,1.55,.05,-.95).rotation.x=Math.PI/2;
  const sponge=mesh(g,new T.SphereGeometry(.12,16,8),new T.MeshStandardMaterial({color:0xcbb263,roughness:1}),1.17,.06,-.7);sponge.scale.set(1,.45,.7);
  const bowl=jar([[.12,0],[.18,.025],[.2,.09]],new T.MeshStandardMaterial({color:0xa77951,roughness:1}));bowl.position.set(1.7,0,-.4);g.add(bowl);
  const wire=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-1.8,.06,-.4),new T.Vector3(-1.35,.06,-.35)]),new T.LineBasicMaterial({color:0x645949}));g.add(wire);
  return g;
}
export function outdoorSite(level:number, excavation=true){
  const g=new T.Group(),shape=new T.Shape();shape.absarc(0,0,8.2,0,Math.PI*2,false);
  if(excavation){const hole=new T.Path();hole.absellipse(0,0,1.69,1.49,0,Math.PI*2,true,0);shape.holes.push(hole);}
  const floor=mesh(g,new T.ShapeGeometry(shape,80),earth,0,level,0);floor.rotation.x=-Math.PI/2;
  if(excavation){
    const points=Array.from({length:129},(_,i)=>{const a=i*Math.PI/64;return new T.Vector3(Math.cos(a)*1.73,level+.008,Math.sin(a)*1.53);});
    const guide=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xffffff}));guide.name='White excavation boundary';g.add(guide);
    const cutEarth=earth.clone();cutEarth.color.set(0x92816d);cutEarth.side=T.BackSide;
    const wall=mesh(g,new T.CylinderGeometry(1,1,level+.24,96,1,true),cutEarth,0,(level-.24)/2,0);wall.name='Interior trench wall';wall.scale.set(1.7,1,1.5);
    for(let i=0;i<5;i++){
      const peg=mesh(g,new T.BoxGeometry(.035,.18,.035),wood,-2+i,level+.07,-1.95);peg.rotation.z=.08;
    }
  }
  return g;
}
function plaque(text:string){
  const c=document.createElement('canvas');c.width=640;c.height=190;
  const ctx=c.getContext('2d')!;ctx.fillStyle='#f2e7cf';ctx.fillRect(0,0,640,190);
  ctx.fillStyle='#514331';ctx.font='bold 40px sans-serif';ctx.fillText(text,28,65);
  ctx.font='24px sans-serif';ctx.fillText('얼굴과 표면의 흔적을 천천히 살펴보세요',28,120);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map:texture});
}
export function museumRoom(){
  const g=new T.Group();
  const glass=new T.MeshStandardMaterial({color:0xd8f2ed,transparent:true,opacity:.035,roughness:.12,metalness:0,side:T.DoubleSide,depthWrite:false});
  const edge=new T.MeshStandardMaterial({color:0xa7beb8,roughness:.3,transparent:true,opacity:.42});
  for(const [key,label] of [['own','내가 만든 얼굴모양토기'],['reference','AI 제작 · 유물 재현 예시']] as const){
    const {x,width,depth,height}=galleryCases[key];
    {
      const displayCase=new T.Group();displayCase.name=key+'-exhibit-glass';g.add(displayCase);
      for(const z of [-depth/2,depth/2]){const pane=mesh(displayCase,new T.PlaneGeometry(width,height),glass,x,height/2,z);pane.castShadow=false;pane.renderOrder=3;}
      for(const side of [-1,1]){
        const pane=mesh(displayCase,new T.PlaneGeometry(depth,height),glass,x+side*width/2,height/2,0);pane.rotation.y=Math.PI/2;pane.castShadow=false;pane.renderOrder=3;
        for(const z of [-depth/2,depth/2]){const corner=mesh(displayCase,new T.BoxGeometry(.006,height,.006),edge,x+side*width/2,height/2,z);corner.castShadow=false;}
      }
      const lid=mesh(displayCase,new T.PlaneGeometry(width,depth),glass,x,height,0);lid.rotation.x=-Math.PI/2;lid.castShadow=false;
    }
    const labelMesh=mesh(g,new T.PlaneGeometry(.68,.2),plaque(label),x,-.15,.68);labelMesh.rotation.x=-.22;labelMesh.castShadow=false;
  }
  const signage=new T.Group();signage.name='Gyeongsan gallery signage';signage.userData.wallFixture=true;signage.position.z=-4.18;g.add(signage);
  const c=document.createElement('canvas');c.width=1536;c.height=256;
  const ctx=c.getContext('2d')!;
  ctx.fillStyle='#f2eada';ctx.font='500 68px "Malgun Gothic",sans-serif';ctx.fillText('경산시립박물관',36,88);
  ctx.font='32px "Malgun Gothic",sans-serif';ctx.fillText('토기에 담긴 압독의 생활',38,155);
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;
  const title=mesh(signage,new T.PlaneGeometry(3.9,.65),new T.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false}),.55,2.16,.04);title.castShadow=false;
  for(const x of [-2.3,2.1]){
    const spot=new T.SpotLight(0xffe5ba,9,7,.70,.75,2);
    spot.position.set(x,2.7,-3.2);spot.target.position.set(x,.3,-3.9);
    g.add(spot,spot.target);
  }
  return g;
}
