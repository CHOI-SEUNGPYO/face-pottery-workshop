import {Vector3} from 'three';
import {COLS,ROWS,type PotteryDocument} from './model';
import type {World} from './world';

/** A screen-space rehearsal only: it never edits the pot or its save. */
export class BodyGuide {
  private element=document.createElement('div');
  private trace:SVGPathElement;
  private rest:SVGPathElement;
  private finger:SVGGElement;
  private caption:HTMLElement;
  private points:{x:number;y:number}[]=[];
  private frame=0;
  private elapsed=0;
  private last=0;
  private stopped=false;
  private distance=24;

  constructor(private world:World,private doc:PotteryDocument,host:HTMLElement,private done:()=>void){
    this.element.className='body-demonstration';
    this.element.setAttribute('aria-hidden','true');
    this.element.hidden=true;
    this.element.innerHTML=`<svg><path class="body-guide-rest"/><path class="body-guide-trace"/><g class="body-guide-finger"><circle r="9"/><path d="M-4 12V1a4 4 0 0 1 8 0v9l4 2a4 4 0 0 1 2 4l-2 10H-3l-6-9a3 3 0 0 1 5-3Z"/></g></svg><span>윤곽선을 잡고 움직여 봐요</span>`;
    this.trace=this.element.querySelector('.body-guide-trace')!;
    this.rest=this.element.querySelector('.body-guide-rest')!;
    this.finger=this.element.querySelector('.body-guide-finger')!;
    this.caption=this.element.querySelector('span')!;
    host.append(this.element);
    this.frame=requestAnimationFrame(this.tick);
  }

  layout(){
    if(this.stopped)return;
    const area=document.querySelector('.work-area')?.getBoundingClientRect();
    if(!area)return;
    this.world.camera.updateMatrixWorld();this.world.pottery.root.updateWorldMatrix(true,false);
    const p=new Vector3(),points:{x:number;y:number}[]=[];
    // Follow the visible left silhouette, including a resumed or reshaped pot.
    for(let n=0;n<=12;n++){
      const row=Math.round(ROWS*(.3+n*.4/12));let edge={x:Infinity,y:0};
      for(let col=0;col<COLS;col+=2){
        p.fromArray(this.doc.outerXYZ,(row*COLS+col)*3).applyMatrix4(this.world.pottery.root.matrixWorld).project(this.world.camera);
        const x=(p.x+1)*innerWidth/2,y=(1-p.y)*innerHeight/2;
        if(x<edge.x)edge={x,y};
      }
      points.push(edge);
    }
    this.points=points;
    this.distance=Math.min(26,area.width*.07);
    const center=points[6];
    this.caption.style.left=`${area.left+area.width/2}px`;
    this.caption.style.maxWidth=`${area.width}px`;
    this.caption.style.top=`${Math.max(area.top,Math.min(area.bottom-30,center.y+47))}px`;
    this.element.querySelector('svg')!.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
    this.paint();
  }

  private paint(){
    if(!this.points.length)return;
    const phase=(Math.min(this.elapsed,4000)%2000)/2000;
    const pull=this.world.reduced?0:Math.sin(Math.PI*Math.max(0,Math.min(1,(phase-.12)/.7)))**2;
    const path=(amount:number)=>this.points.map((p,i)=>`${i?'L':'M'}${(p.x+amount*Math.sin(Math.PI*i/12)**2).toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    this.rest.setAttribute('d',path(0));
    this.trace.setAttribute('d',path(pull*this.distance));
    const center=this.points[6];
    this.finger.setAttribute('transform',`translate(${center.x+pull*this.distance} ${center.y})`);
    this.element.style.opacity=String(this.world.reduced?1:Math.min(1,this.elapsed/180,Math.max(0,(4400-this.elapsed)/350)));
  }

  private tick=(now:number)=>{
    if(this.stopped)return;
    if(this.world.paused||document.hidden){this.stop();return;}
    if(this.world.transitioning){this.last=now;this.frame=requestAnimationFrame(this.tick);return;}
    if(this.element.hidden){this.element.hidden=false;this.layout();this.last=now;}
    // A delayed frame must not consume the whole lesson before it is visible.
    this.elapsed+=Math.min(80,now-this.last);this.last=now;
    if(this.elapsed>=4400){this.stop();return;}
    this.paint();this.frame=requestAnimationFrame(this.tick);
  };

  stop(){
    if(this.stopped)return;
    this.stopped=true;cancelAnimationFrame(this.frame);this.element.remove();this.done();
  }
}
