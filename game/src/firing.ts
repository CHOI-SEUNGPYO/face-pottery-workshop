import * as T from 'three';
import {mesh,outdoorSite} from './environments';
const ease=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function firingFrame(progress:number){
  const phase=progress<.15?'준비':progress<.62?'가열':progress<.85?'냉각':'완성 공개';
  const heat=ease((progress-.15)/.22)*(1-ease((progress-.62)/.23));
  const description=progress<.15?'옆벽 너머에 내가 빚은 토기가 있어요.':progress<.62?'아궁이에서 피운 불이 가마 안을 데워요.':progress<.85?'불이 잦아들면 토기를 천천히 식혀요.':'가마 안에서 다 구워진 내 토기를 살펴봐요.';
  return {phase,heat,description};
}
/** Period-informed interpretation; the original artifact's kiln is unknown. */
export class FiringView {
  group=new T.Group();
  hearth=new T.Vector3();
  private mouth={z:0,radius:0,height:0};
  light=new T.PointLight(0xff7028,0,5,2);
  private shell:T.Object3D=new T.Group();
  get shellVisible(){return this.shell.visible;}
  private shellMaterials:T.Material[]=[];
  private coal=new T.MeshStandardMaterial({color:0x4e2315,emissive:0xff4808,emissiveIntensity:0,roughness:1});
  private flames:T.InstancedMesh<T.LatheGeometry,T.MeshBasicMaterial>;
  private flamePose=new T.Object3D();
  private smoke:T.Points<T.BufferGeometry,T.PointsMaterial>;
  private contact:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
  constructor(){
    this.group.add(outdoorSite(0,false));
    this.group.add(this.light);this.light.position.set(0,.44,.69);
    const coalGeometry=new T.DodecahedronGeometry(.095,0);
    for(let i=0;i<9;i++){
      const m=mesh(this.group,coalGeometry,this.coal,(i%3-1)*.15,.04,1.13+Math.floor(i/3)*.115);
      m.scale.set(.83,.44,.88);m.rotation.y=i*2.4;
    }
    const flame=new T.LatheGeometry([[.05,0],[.105,.10],[.068,.24],[.036,.34],[.001,.47]].map(([x,y])=>new T.Vector2(x,y)),8);
    const vertices=flame.attributes.position,colors=[];
    const amber=new T.Color(0xffdd7c),orange=new T.Color(0xe5732b),c=new T.Color();
    for(let i=0;i<vertices.count;i++){
      const h=vertices.getY(i)/.47;
      vertices.setX(i,vertices.getX(i)+h*h*.08);
      colors.push(...c.copy(amber).lerp(orange,h).toArray());
    }
    flame.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    this.flames=new T.InstancedMesh(flame,new T.MeshBasicMaterial({vertexColors:true,toneMapped:false}),6);
    this.flames.frustumCulled=false;
    const smokeGeometry=new T.BufferGeometry();
    smokeGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(9*3),3));
    const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
    const ctx=canvas.getContext('2d')!,mist=ctx.createRadialGradient(16,16,0,16,16,16);
    mist.addColorStop(0,'rgba(255,255,255,.65)');mist.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=mist;ctx.fillRect(0,0,32,32);
    const softSpot=new T.CanvasTexture(canvas);
    this.smoke=new T.Points(smokeGeometry,new T.PointsMaterial({color:0xb6ab99,map:softSpot,size:.42,transparent:true,opacity:0,depthWrite:false}));
    this.contact=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0x34231b,map:softSpot,transparent:true,depthWrite:false,opacity:.84}));
    this.contact.rotation.x=-Math.PI/2;
    this.smoke.frustumCulled=false;
    this.group.add(this.flames,this.smoke,this.contact);this.group.visible=false;
  }
  private reveal(amount:number){
    this.shell.visible=amount<.995;
    for(const material of this.shellMaterials){
      const transparent=amount>.001;
      if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
      material.opacity=1-amount;material.depthWrite=!transparent;
    }
  }
  applyArt(vault:T.Group,dressing:T.Group){
    const layout=vault.getObjectByName('Earthen_kiln')?.userData;
    if(!layout?.hearth||!layout.firemouth)throw new Error('Kiln layout is missing');
    const bed=layout.hearth;this.mouth=layout.firemouth;
    this.hearth.set(bed.x,bed.y,bed.z);
    const shell=vault.getObjectByName('Cutaway_shell');
    if(!shell)throw new Error('Kiln cutaway shell is missing');
    this.shell=shell;this.shell.visible=true;
    this.shellMaterials=[];
    this.shell.traverse(o=>{if(o instanceof T.Mesh){
      const materials=(Array.isArray(o.material)?o.material:[o.material]).map(m=>m.clone());
      o.material=Array.isArray(o.material)?materials:materials[0];this.shellMaterials.push(...materials);
    }});
    this.group.add(vault,dressing);
  }
  hitsFiremouth(ray:T.Ray){
    if(ray.direction.z>=0)return false;
    const distance=(this.mouth.z-ray.origin.z)/ray.direction.z;
    if(distance<0)return false;
    const x=ray.origin.x+ray.direction.x*distance,y=ray.origin.y+ray.direction.y*distance;
    return y>=0&&(x/this.mouth.radius)**2+(y/this.mouth.height)**2<=1;
  }
  seatFoot(radius:number){
    this.contact.position.copy(this.hearth);this.contact.position.y+=.002;
    this.contact.scale.setScalar(2*radius+.27);
  }
  update(progress:number,reduced:boolean){
    const {heat}=firingFrame(progress);this.group.visible=true;
    this.reveal(reduced?Number(progress>=.08):ease(progress/.15));
    this.light.intensity=heat*3.8;this.coal.emissiveIntensity=heat*1.5;
    this.flames.visible=heat>.01;
    if(this.flames.visible){
      for(let i=0;i<this.flames.count;i++){
        const pose=this.flamePose,wave=reduced?0:Math.sin(progress*56+i*1.7);
        pose.position.set((i%3-1)*.14,.075,1.13+Math.floor(i/3)*.18);
        pose.rotation.set(-.21,2.4*i,wave*.12);
        pose.scale.set(.74,heat*(.65+.12*(i%3)+.12*wave),.68);
        pose.updateMatrix();this.flames.setMatrixAt(i,pose.matrix);
      }
      this.flames.instanceMatrix.needsUpdate=true;
    }
    this.smoke.visible=!reduced&&heat>.02;
    if(this.smoke.visible){
      this.smoke.material.opacity=heat*.28;
      const p=this.smoke.geometry.getAttribute('position');
      for(let i=0;i<p.count;i++){const t=(progress*1.5+i/p.count)%1;p.setXYZ(i,.05+t*t*.44,2.20+t*.85,-1.30-t*.14);}
      p.needsUpdate=true;
    }
  }
  dispose(){
    this.flames.dispose();this.flames.geometry.dispose();this.flames.material.dispose();
    this.smoke.material.map?.dispose();this.smoke.geometry.dispose();this.smoke.material.dispose();
    this.contact.geometry.dispose();this.contact.material.dispose();
  }
}
