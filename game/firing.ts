import * as T from 'three';
import {mesh,outdoorSite} from './environments';
const ease=(t:number)=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function firingFrame(progress:number){
  const phase=progress<.15?'준비':progress<.62?'가열':progress<.85?'냉각':'완성 공개';
  const heat=ease((progress-.15)/.22)*(1-ease((progress-.62)/.23));
  return {phase,heat,inKiln:progress>=.15&&progress<.88};
}
/** Period-informed interpretation; the original artifact's kiln is unknown. */
export class FiringView {
  group=new T.Group();
  light=new T.PointLight(0xff7028,0,5,2);
  cutaway=false;
  private shell:T.Object3D=new T.Group();
  private coal=new T.MeshStandardMaterial({color:0x4e2315,emissive:0xff4808,emissiveIntensity:0,roughness:1});
  private sparks:T.Points<T.BufferGeometry,T.PointsMaterial>;
  private smoke:T.Points<T.BufferGeometry,T.PointsMaterial>;
  constructor(){
    this.group.add(outdoorSite(-.12,false));
    this.group.add(this.light);this.light.position.set(0,.35,.9);
    const coalGeometry=new T.DodecahedronGeometry(.095,0);
    for(let i=0;i<15;i++){const m=mesh(this.group,coalGeometry,this.coal,(i%5-2)*.12,.03,.65+Math.floor(i/5)*.14);m.scale.y=.4;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3));
    this.sparks=new T.Points(geometry,new T.PointsMaterial({color:0xffb453,size:.025,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));
    const smokeGeometry=geometry.clone();
    this.smoke=new T.Points(smokeGeometry,new T.PointsMaterial({color:0xc6c0b0,size:.16,transparent:true,opacity:0,depthWrite:false}));
    this.group.add(this.sparks,this.smoke);this.group.visible=false;
  }
  setCutaway(value:boolean){this.cutaway=value;this.shell.visible=!value;}
  applyArt(vault:T.Group,dressing:T.Group){
    const shell=vault.getObjectByName('Cutaway_shell');
    if(!shell)throw new Error('Kiln cutaway shell is missing');
    this.shell=shell;this.shell.visible=!this.cutaway;
    this.group.add(vault,dressing);
  }
  update(progress:number,reduced:boolean){
    const {heat}=firingFrame(progress);this.group.visible=true;
    const flicker=reduced?1:1+Math.sin(progress*310)*.045;
    this.light.intensity=heat*15*flicker;this.coal.emissiveIntensity=heat*3;
    this.sparks.material.opacity=reduced?0:heat*.65;
    this.smoke.material.opacity=reduced?.06:heat*.23;
    for(const [points,smoke] of [[this.sparks,false],[this.smoke,true]] as const){
      const p=points.geometry.getAttribute('position');
      for(let i=0;i<24;i++){const t=(progress*3+i*.137)%1,a=i*2.399;p.setXYZ(i,Math.sin(a)*(smoke?.15+t*.28:.22),smoke?2.25+t*.85:.1+t*.45,smoke?-1.55+t*.25:.85+Math.cos(a)*.15);}p.needsUpdate=true;
    }
  }
  dispose(){for(const p of [this.sparks,this.smoke]){p.geometry.dispose();p.material.dispose();}}
}
