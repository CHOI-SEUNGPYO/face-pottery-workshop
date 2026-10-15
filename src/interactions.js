import {clamp,reshapeProfile,unwrap,eraseAt,invalidateProcess} from './model.js';
import {strokeContour} from './contour.js';
import {closedStroke,openingLoop} from './openings.js';

export class Interactions {
  constructor(pottery,surface,preview,onCommit,onMessage){
    this.pottery=pottery;this.surface=surface;this.preview=preview;this.onCommit=onCommit;this.onMessage=onMessage;this.stage=1;this.tool='shape';
    surface.addEventListener('pointerdown',e=>this.down(e));surface.addEventListener('pointermove',e=>this.move(e));surface.addEventListener('pointerup',e=>this.up(e));surface.addEventListener('pointercancel',()=>this.cancel());
    surface.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pottery.rotate(e.key==='ArrowLeft'?-.2:.2);}});
  }
  set(stage,tool){this.cancel();this.stage=stage;this.tool=tool;this.pottery.setTool?.(tool);}
  down(e){
    if(e.button!==0||this.drag||![1,2,3,4,7,8,9].includes(this.stage))return;
    if(e.target.closest('button'))return;const hit=this.pottery.hit(e.clientX,e.clientY,this.stage===3);
    const rotate=this.tool==='rotate'||[4,8,9].includes(this.stage);const crown=this.stage===2?this.pottery.crownPoint(e.clientX,e.clientY):null;
    const grab=this.stage===1&&!rotate?this.pottery.shapeGrab(e.clientX,e.clientY):null;
    if(this.stage===1&&!rotate&&!grab)return;
    if(this.stage===2&&(!crown||Math.hypot(...crown)>.98))return;
    if(!rotate&&!hit&&!crown&&!grab)return;
    this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,hit,grab,points:[],screen:[],before:structuredClone(this.pottery.model),changed:false,rotate};
    this.surface.classList.toggle('is-sculpting',!!grab);
    this.surface.setPointerCapture(e.pointerId);this.surface.focus({preventScroll:true});
    this.sample(e);e.preventDefault();
  }
  sample(e){
    const d=this.drag;if(!d)return;const r=this.surface.getBoundingClientRect();
    if(this.stage===2){const p=this.pottery.crownPoint(e.clientX,e.clientY);if(p&&(!d.points.length||Math.hypot(p[0]-d.points.at(-1)[0],p[1]-d.points.at(-1)[1])>.002)){d.points.push(p);d.screen.push([e.clientX-r.left,e.clientY-r.top]);}}
    else if(this.stage===3&&!d.rotate){const h=this.pottery.hit(e.clientX,e.clientY,true);if(h&&h.uv.y>.05&&h.uv.y<.9){d.points.push([h.uv.x,h.uv.y]);d.screen.push([e.clientX-r.left,e.clientY-r.top]);}}
    if((this.stage===2||this.stage===3)&&!d.rotate){
      this.preview.setAttribute('points',d.screen.map(p=>p.join(',')).join(' '));
      const first=d.screen[0],last=d.screen.at(-1),closed=d.screen.length>5&&Math.hypot(first[0]-last[0],first[1]-last[1])<14;
      this.preview.setAttribute('fill',closed&&(this.stage===2||['carve','hole'].includes(this.tool))?'#3e2a1b88':'none');
    }
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;
    if(d.rotate){this.pottery.rotate(dx*.012);return;}
    if(this.stage===1&&d.grab){
      const {v,side,unitsPerPixel}=d.grab;
      const totalX=e.clientX-d.startX,totalY=e.clientY-d.startY;
      if(!d.changed&&Math.hypot(totalX,totalY)<4)return;
      if(d.grab.end)this.pottery.model.height=clamp(d.before.height-totalY*unitsPerPixel*d.grab.end,.65,1.45);
      reshapeProfile(this.pottery.model,d.before,v,d.grab.end?0:totalX*unitsPerPixel*side,d.grab.end?0:-totalY*unitsPerPixel);
      d.changed=true;this.invalidate();if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=null;this.pottery.refreshShape();});
    }else if(this.stage===7){const rect=this.surface.getBoundingClientRect();this.pottery.move(dx/rect.width*(this.pottery.camera.right-this.pottery.camera.left),-dy/rect.height*(this.pottery.camera.top-this.pottery.camera.bottom));d.changed=true;}
    else if(this.stage===2||this.stage===3){const samples=e.getCoalescedEvents?.()||[];for(const sample of samples)this.sample(sample);this.sample(e);}
    e.preventDefault();
  }
  invalidate(){invalidateProcess(this.pottery.model);}
  up(e){
    const d=this.drag;if(!d||e.pointerId!==d.id)return;const model=this.pottery.model;
    if(this.frame){cancelAnimationFrame(this.frame);this.frame=null;}
    if(!d.rotate&&(this.stage===2||this.stage===3))this.sample(e);
    if(this.stage===2&&d.points.length){
      const outside=d.points.some(p=>Math.hypot(...p)>.98),points=outside?[]:strokeContour(d.points);
      if(points.length>=3){model.crown=points;this.invalidate();d.changed=true;this.onMessage('그린 테두리 안쪽의 흙을 뚫었어요!');}
      else this.onMessage(outside?'흙 가장자리 안쪽에 테두리를 그려 주세요.':'점을 찍는 대신, 구멍의 테두리를 이어 그려 보세요.');
    }
    if(this.stage===3&&!d.rotate&&d.points.length){
      if(this.tool==='erase'){const count=model.marks.length;for(const [u,v]of d.points)eraseAt(model,u,v);d.changed=count!==model.marks.length;}
      else if(model.marks.length>=120)this.onMessage('표현이 많이 쌓였어요. 지우기로 조금 정리해 볼까요?');
      else{
        let points=unwrap(d.points),tool=this.tool;
        if(tool==='carve'&&closedStroke(points))tool='hole';
        if(tool==='hole')points=openingLoop({tool,points})||[];
        else{points=points.filter((_,i)=>i%Math.max(1,Math.ceil(points.length/600))===0);if(points.length===1)points.push([points[0][0]+.002,points[0][1]]);}
        if(!points.length)this.onMessage('구멍의 테두리를 이어 그려 보세요.');
        else{model.marks.push({tool,points});d.changed=true;if(tool==='hole')this.onMessage('테두리 안쪽이 뚫렸어요. 돌려서 안쪽도 살펴봐요!');}
      }
      if(d.changed)this.invalidate();
    }
    if(this.stage===7&&d.changed){d.changed=this.pottery.tryAssemble();this.onMessage(d.changed?'두 토기를 함께 놓아 봤어요!':'시루 바로 위로 조금 더 옮겨 보세요.');}
    this.preview.setAttribute('points','');this.drag=null;this.surface.classList.remove('is-sculpting');
    if(d.changed){this.pottery.update();this.onCommit(d.before);}else this.pottery.render();
  }
  cancel(){if(this.frame){cancelAnimationFrame(this.frame);this.frame=null;}if(!this.drag)return;this.pottery.model=this.drag.before;this.pottery.update();this.drag=null;this.preview.setAttribute('points','');this.surface.classList.remove('is-sculpting');}
}
