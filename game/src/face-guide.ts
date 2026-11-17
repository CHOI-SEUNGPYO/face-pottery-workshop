import {Group} from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {surfacePoint,surfaceNormal,type PotteryDocument} from './model';

/** Temporary surface marks for the tour, never features in the saved artwork. */
export class FaceGuide extends Group {
  private faces:{angle:number;group:Group;material:LineMaterial}[]=[];
  constructor(){super();this.name='Face opening examples';this.visible=false;}
  prepare(doc:PotteryDocument,frontAngle:number){
    this.dispose();
    for(let face=0;face<3;face++){
      const angle=frontAngle-face*Math.PI*2/3,group=new Group();
      const material=new LineMaterial({color:0xfff4d8,linewidth:1.8,dashed:true,dashSize:.012,gapSize:.011,transparent:true,opacity:0,depthWrite:false,depthTest:true,toneMapped:false});
      // Three gentle variations invite an expression without prescribing one.
      const eyes=face===1?.019:.03,mouth=face===2?.036:.023;
      for(const [u,v,rx,ry] of [[-.05,.64,.021,eyes],[.05,.64,.021,eyes],[0,.49,.044,mouth]]){
        const points=Array.from({length:49},(_,i)=>{
          const a=i/48*Math.PI*2,uv=[angle/(Math.PI*2)+u+rx*Math.cos(a),v+ry*Math.sin(a)] as const;
          return surfacePoint(doc,...uv).addScaledVector(surfaceNormal(doc,...uv),.003).toArray();
        });
        const line=new Line2(new LineGeometry().setPositions(points.flat()),material);
        line.computeLineDistances();line.renderOrder=8;group.add(line);
      }
      this.faces.push({angle,group,material});this.add(group);
    }
  }
  show(opacity:number,viewAngle:number){
    this.visible=opacity>.005;
    for(const face of this.faces){
      // Marks on the opposite side must not show through an existing opening.
      const facing=Math.max(0,Math.min(1,(Math.cos(face.angle-viewAngle)-.2)/.5));
      face.material.opacity=opacity*facing;face.group.visible=face.material.opacity>.005;
    }
  }
  dispose(){
    for(const face of this.faces){for(const line of face.group.children)(line as Line2).geometry.dispose();face.material.dispose();}
    this.faces=[];this.clear();this.visible=false;
  }
}
