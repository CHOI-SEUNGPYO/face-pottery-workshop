import type {PhotoView} from './photo-scene';
import {icon} from './icons';
import './example-viewer.css';

/** A disposable display copy. No game controls or save repository are involved. */
export class ExampleViewer {
  private events=new AbortController();
  private frame=0;
  private start:{id:number;x:number;angle:number}|null=null;
  constructor(root:HTMLElement,private view:PhotoView){
    root.innerHTML=`<section class="example-viewer"><p class="eyebrow">직접 만든 창작 예시</p><h2>세 얼굴을 만나 보세요</h2><canvas width="1920" height="1080" tabindex="0" aria-label="예시 토기. 좌우로 끌거나 방향키로 돌려 보세요."></canvas><p class="example-hint">${icon('rotate')} 좌우로 끌어 다른 얼굴도 만나 보세요</p><p class="example-caption">플레이어가 게임에서 직접 빚고 그린 작품이에요.<br>실제 유물의 복원품은 아니에요.</p><button data-action="close" class="secondary">감상 마치기</button></section>`;
    const canvas=root.querySelector('canvas')!,context=canvas.getContext('2d')!,options={signal:this.events.signal};
    const draw=()=>{this.frame=0;this.view.render(context);};
    const refresh=()=>{if(!this.frame)this.frame=requestAnimationFrame(draw);};
    canvas.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||e.button!==0||this.start)return;
      e.preventDefault();canvas.focus({preventScroll:true});
      this.start={id:e.pointerId,x:e.clientX,angle:this.view.rotation};canvas.setPointerCapture(e.pointerId);
    },options);
    canvas.addEventListener('pointermove',e=>{
      if(this.start?.id!==e.pointerId)return;
      this.view.rotation=this.start.angle+(e.clientX-this.start.x)/canvas.getBoundingClientRect().width*Math.PI*2;
      refresh();
    },options);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{this.start=null;},options);
    canvas.addEventListener('keydown',e=>{
      if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
      e.preventDefault();this.view.rotation+=e.key==='ArrowRight'?.18:-.18;refresh();
    },options);
    draw();
  }
  dispose(){this.events.abort();cancelAnimationFrame(this.frame);this.view.dispose();}
}
