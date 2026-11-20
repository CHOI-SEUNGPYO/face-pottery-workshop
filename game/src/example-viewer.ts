import type {ExampleView} from './example-scene';
import {icon} from './icons';
import './exhibition.css';

/** A disposable display copy. No game controls or save repository are involved. */
export class ExampleViewer {
  private events=new AbortController();
  private frame=0;
  private observer:ResizeObserver;
  private start:{id:number;x:number;y:number;width:number;height:number;angle:number;elevation:number}|null=null;
  constructor(root:HTMLElement,private view:ExampleView){
    root.innerHTML=`<section class="example-viewer"><header class="exhibition-heading"><p class="eyebrow">작은 흙 공방 · 창작 예시</p><h2>세 얼굴을 만나 보세요</h2></header><canvas class="exhibition-canvas" width="1440" height="1440" tabindex="0" aria-label="예시 토기. 상하좌우로 끌거나 방향키로 여러 방향에서 살펴보세요."></canvas><aside class="example-details"><p class="example-hint">${icon('rotate')}<span>상하좌우로 끌어<br> 입구와 세 얼굴을 살펴보세요</span></p><p class="example-caption">이 게임을 만든 사람이<br> 빚고 구운 토기예요.<small>실제 유물의 복원품은 아니에요.</small></p><button data-action="close" class="secondary">감상 마치기</button></aside></section>`;
    const placeholder=root.querySelector('canvas')!,canvas=view.canvas,options={signal:this.events.signal};
    canvas.className=placeholder.className;canvas.tabIndex=0;
    canvas.setAttribute('aria-label',placeholder.getAttribute('aria-label')!);placeholder.replaceWith(canvas);
    const draw=()=>{this.frame=0;this.view.render();};
    const refresh=()=>{if(!this.frame)this.frame=requestAnimationFrame(draw);};
    this.observer=new ResizeObserver(refresh);this.observer.observe(canvas);
    canvas.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||e.button!==0||this.start)return;
      e.preventDefault();canvas.focus({preventScroll:true});
      const {width,height}=canvas.getBoundingClientRect();
      this.start={id:e.pointerId,x:e.clientX,y:e.clientY,width,height,angle:this.view.rotation,elevation:this.view.elevation};canvas.setPointerCapture(e.pointerId);
    },options);
    canvas.addEventListener('pointermove',e=>{
      if(this.start?.id!==e.pointerId)return;
      this.view.rotation=this.start.angle+(e.clientX-this.start.x)/this.start.width*Math.PI*2;
      this.view.elevation=this.start.elevation+(e.clientY-this.start.y)/this.start.height*Math.PI;
      refresh();
    },options);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{this.start=null;},options);
    canvas.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();
      if(e.key==='ArrowLeft'||e.key==='ArrowRight')this.view.rotation+=e.key==='ArrowRight'?.18:-.18;
      else this.view.elevation+=e.key==='ArrowUp'?.12:-.12;
      refresh();
    },options);
    draw();
  }
  dispose(){this.events.abort();this.observer.disconnect();cancelAnimationFrame(this.frame);this.view.dispose();}
}
