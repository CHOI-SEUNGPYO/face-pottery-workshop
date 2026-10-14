import {clamp,deform,unwrap,area,eraseAt} from './model.js';

export class Interactions {
  constructor(pottery,surface,preview,onCommit,onMessage){
    this.pottery=pottery;this.surface=surface;this.preview=preview;this.onCommit=onCommit;this.onMessage=onMessage;this.stage=1;this.tool='shape';
    surface.addEventListener('pointerdown',e=>this.down(e));surface.addEventListener('pointermove',e=>this.move(e));surface.addEventListener('pointerup',e=>this.up(e));surface.addEventListener('pointercancel',()=>this.cancel());
    surface.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pottery.rotate(e.key==='ArrowLeft'?-.2:.2);}});
  }
  set(stage,tool){this.cancel();this.stage=stage;this.tool=tool;}
  down(e){
    if(e.button!==0||this.drag||![1,2,3,4,7,8,9].includes(this.stage))return;
    if(e.target.closest('button'))return;const hit=this.pottery.hit(e.clientX,e.clientY);
    const rotate=this.tool==='rotate'||[4,8,9].includes(this.stage);const crown=this.stage===2?this.pottery.crownPoint(e.clientX,e.clientY):null;
    if(!rotate&&!hit&&!crown)return;
    this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,hit,points:[],screen:[],before:structuredClone(this.pottery.model),changed:false,rotate};
    this.surface.setPointerCapture(e.pointerId);this.surface.focus({preventScroll:true});
    this.sample(e);e.preventDefault();
  }
  sample(e){
    const d=this.drag;if(!d)return;const r=this.surface.getBoundingClientRect();
    if(this.stage===2){const p=this.pottery.crownPoint(e.clientX,e.clientY);if(p){d.points.push(p);d.screen.push([e.clientX-r.left,e.clientY-r.top]);}}
    else if(this.stage===3&&!d.rotate){const h=this.pottery.hit(e.clientX,e.clientY);if(h&&h.uv.y>.05&&h.uv.y<.94){d.points.push([h.uv.x,h.uv.y]);d.screen.push([e.clientX-r.left,e.clientY-r.top]);}}
    if((this.stage===2||this.stage===3)&&!d.rotate)this.preview.setAttribute('points',d.screen.map(p=>p.join(',')).join(' '));
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;
    if(d.rotate){this.pottery.rotate(dx*.012);return;}
    if(this.stage===1&&d.hit){
      const rect=this.surface.getBoundingClientRect(),u=d.hit.uv.x,v=d.hit.uv.y;const sign=d.startX-rect.left-rect.width/2>0?1:-1;
      deform(this.pottery.model,u,v,dx/rect.width*3*sign,.16);
      if(v>.74||v<.18)this.pottery.model.height=clamp(this.pottery.model.height-dy/rect.height*(v>.74?1:-1),.65,1.45);
      d.changed=true;this.invalidate();this.pottery.update();
    }else if(this.stage===7){const rect=this.surface.getBoundingClientRect();this.pottery.move(dx/rect.width*(this.pottery.camera.right-this.pottery.camera.left),-dy/rect.height*(this.pottery.camera.top-this.pottery.camera.bottom));d.changed=true;}
    else if(this.stage===2||this.stage===3)this.sample(e);
    e.preventDefault();
  }
  invalidate(){const m=this.pottery.model;m.fired=false;m.dug=0;m.brush=[];m.assembled=false;}
  up(e){
    const d=this.drag;if(!d||e.pointerId!==d.id)return;const model=this.pottery.model;
    if(this.stage===2&&d.points.length){
      let points=d.points;if(points.length<4||Math.hypot(e.clientX-d.startX,e.clientY-d.startY)<8){const [x,y]=points[0];points=Array.from({length:32},(_,i)=>[x+Math.cos(i/32*Math.PI*2)*.28,y+Math.sin(i/32*Math.PI*2)*.28]);}
      if(points.every(p=>Math.hypot(...p)<.96)&&area(points)>.025){model.crown=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/180))===0);this.invalidate();d.changed=true;}else this.onMessage('가운데 윗면 안에 조금 더 크게 그려 보세요.');
    }
    if(this.stage===3&&!d.rotate&&d.points.length){
      if(this.tool==='erase'){const count=model.marks.length;for(const [u,v]of d.points)eraseAt(model,u,v);d.changed=count!==model.marks.length;}
      else if(model.marks.length>=120)this.onMessage('표현이 많이 쌓였어요. 지우기로 조금 정리해 볼까요?');
      else{let points=unwrap(d.points);points=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/80))===0);if(points.length===1&&this.tool!=='hole')points.push([points[0][0]+.002,points[0][1]]);if(this.tool==='hole'&&points.length>3&&area(points)<.00015)this.onMessage('구멍의 테두리를 둥글게 그리거나 톡 눌러 보세요.');else{model.marks.push({tool:this.tool,points});d.changed=true;}}
      if(d.changed)this.invalidate();
    }
    if(this.stage===7&&d.changed){d.changed=this.pottery.tryAssemble();this.onMessage(d.changed?'두 토기를 함께 놓아 봤어요!':'시루 바로 위로 조금 더 옮겨 보세요.');}
    this.preview.setAttribute('points','');this.drag=null;
    if(d.changed){this.pottery.update();this.onCommit(d.before);}else this.pottery.render();
  }
  cancel(){if(!this.drag)return;this.pottery.model=this.drag.before;this.pottery.update();this.drag=null;this.preview.setAttribute('points','');}
}
