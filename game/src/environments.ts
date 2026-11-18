import * as T from 'three';
import {galleryCases} from './display-case';

export function mesh(parent:T.Object3D, geometry:T.BufferGeometry, material:T.Material, x=0,y=0,z=0){
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
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
