import * as T from 'three';
const ease=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function firingFrame(progress:number){
  const phase=progress<.15?'준비':progress<.62?'가열':progress<.85?'냉각':'완성 공개';
  const heat=ease((progress-.15)/.22)*(1-ease((progress-.62)/.23));
  return {phase,heat,inKiln:progress>=.15&&progress<.88};
}
/** A symbolic heating space, not a reconstruction of an excavated kiln. */
export class FiringView {
  group=new T.Group();
  light=new T.PointLight(0xff7028,0,5,2);
  private coal=new T.MeshStandardMaterial({color:0x4e2315,emissive:0xff4808,emissiveIntensity:0,roughness:1});
  private sparks:T.Points<T.BufferGeometry,T.PointsMaterial>;
  constructor(){
    const stone=new T.MeshStandardMaterial({color:0x594439,roughness:1,side:T.DoubleSide});
    const wall=new T.Mesh(new T.CylinderGeometry(1.25,1.3,2.1,40,1,true,Math.PI/2,Math.PI),stone);
    wall.position.set(0,.86,-.05);
    const floor=new T.Mesh(new T.CylinderGeometry(1.38,1.38,.14,40),stone);floor.position.y=-.07;floor.receiveShadow=true;
    this.group.add(wall,floor,this.light);this.light.position.set(0,.2,1);
    const coalGeometry=new T.DodecahedronGeometry(.095,0);
    for(let i=0;i<18;i++){const a=i*Math.PI/9,m=new T.Mesh(coalGeometry,this.coal);m.position.set(Math.sin(a)*.82,.015,Math.cos(a)*.82);m.scale.set(1.2,.5,.8);this.group.add(m);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3));
    this.sparks=new T.Points(geometry,new T.PointsMaterial({color:0xffb453,size:.025,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));
    this.group.add(this.sparks);this.group.visible=false;
  }
  update(progress:number,reduced:boolean){
    const {heat,inKiln}=firingFrame(progress);this.group.visible=inKiln;
    const flicker=reduced?1:1+Math.sin(progress*310)*.045;
    this.light.intensity=heat*11*flicker;this.coal.emissiveIntensity=heat*2;
    this.sparks.material.opacity=reduced?0:heat*.65;
    const p=this.sparks.geometry.getAttribute('position');
    for(let i=0;i<24;i++){const t=(progress*3+i*.137)%1,a=i*2.399;p.setXYZ(i,Math.sin(a)*(.65+t*.12),t*1.5,Math.cos(a)*.65);}
    p.needsUpdate=true;
  }
  dispose(){this.sparks.geometry.dispose();this.sparks.material.dispose();}
}
