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
  private shell=new T.Group();
  private front:T.Mesh;
  private coal=new T.MeshStandardMaterial({color:0x4e2315,emissive:0xff4808,emissiveIntensity:0,roughness:1});
  private sparks:T.Points<T.BufferGeometry,T.PointsMaterial>;
  private smoke:T.Points<T.BufferGeometry,T.PointsMaterial>;
  constructor(){
    this.group.add(outdoorSite(-.12,false));
    const stone=new T.MeshStandardMaterial({color:0x957650,roughness:1,side:T.DoubleSide});
    const inside=new T.MeshStandardMaterial({color:0x4c3828,roughness:1,side:T.DoubleSide});
    mesh(this.group,new T.BoxGeometry(2.5,.12,3.2),inside,0,-.06,-.2);
    for(let half=0;half<2;half++){
      const holder=half===0?this.shell:new T.Group();if(half)this.group.add(holder);
      for(const [r,material] of [[1,stone],[.91,inside]] as const){
        const positions:number[]=[],indices:number[]=[];
        for(let j=0;j<=1;j++)for(let i=0;i<=32;i++){
          const a=(half+i/32)*Math.PI/2,z=1.2-j*3;
          positions.push(Math.cos(a)*1.2*r,Math.sin(a)*1.85*r+(1.2-z)*.08,z);
          if(j===0&&i<32){const k=i;indices.push(k,k+33,k+1,k+1,k+33,k+34);}
        }
        const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(holder,geo,material);
      }
    }
    this.group.add(this.shell);
    const shape=new T.Shape();shape.moveTo(-1.2,0);shape.absellipse(0,0,1.2,1.85,Math.PI,0,true,0);shape.lineTo(-1.2,0);
    const mouth=new T.Path();mouth.moveTo(-.35,.01);mouth.lineTo(.35,.01);mouth.lineTo(.35,.3);mouth.absellipse(0,.3,.35,.3,0,Math.PI,false,0);mouth.closePath();shape.holes.push(mouth);
    this.front=mesh(this.group,new T.ExtrudeGeometry(shape,{depth:.1,bevelEnabled:false,curveSegments:32}),stone,0,0,1.2);
    mesh(this.group,new T.CylinderGeometry(.14,.2,.65,12,1,true),inside,0,2,-1.55);
    this.group.add(this.light);this.light.position.set(0,.35,.9);
    const coalGeometry=new T.DodecahedronGeometry(.095,0);
    for(let i=0;i<15;i++){const m=mesh(this.group,coalGeometry,this.coal,(i%5-2)*.12,.03,.65+Math.floor(i/5)*.14);m.scale.y=.4;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3));
    this.sparks=new T.Points(geometry,new T.PointsMaterial({color:0xffb453,size:.025,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending}));
    const smokeGeometry=geometry.clone();
    this.smoke=new T.Points(smokeGeometry,new T.PointsMaterial({color:0xc6c0b0,size:.16,transparent:true,opacity:0,depthWrite:false}));
    this.group.add(this.sparks,this.smoke);this.group.visible=false;
  }
  setCutaway(value:boolean){this.cutaway=value;this.shell.visible=!value;this.front.visible=!value;}
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
