export class Excavation {
  constructor(canvas,onChange,onComplete){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{willReadFrequently:true});this.onChange=onChange;this.onComplete=onComplete;this.active=false;this.pointer=null;
    this.observer=new ResizeObserver(()=>{if(this.active)this.draw();});this.observer.observe(canvas);
    canvas.addEventListener('pointerdown',e=>{if(!this.active||this.model.dug>=100||this.pointer!==null)return;this.pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);this.last=null;this.stroke(e);});
    canvas.addEventListener('pointermove',e=>{if(e.pointerId===this.pointer)this.stroke(e);});
    for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{if(e.pointerId===this.pointer){this.pointer=null;this.last=null;this.measure();this.onChange();}});
  }
  start(model){this.model=model;this.active=true;this.canvas.style.opacity=model.dug>=100?'0':'1';this.canvas.style.pointerEvents=model.dug>=100?'none':'auto';this.draw();}
  stop(){this.active=false;this.pointer=null;this.last=null;}
  draw(){
    const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.canvas.width=Math.round(r.width);this.canvas.height=Math.round(r.height);
    const {width:w,height:h}=this.canvas,ctx=this.ctx;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,h);
    ctx.save();ctx.beginPath();ctx.ellipse(w*.5,h*.53,w*.48,h*.46,0,0,Math.PI*2);ctx.clip();
    const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#bb8658');grad.addColorStop(.5,'#a67148');grad.addColorStop(1,'#7f5438');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    let seed=3547;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<2800;i++){ctx.fillStyle=i%2?'#dcc09b65':'#58341d30';ctx.beginPath();ctx.ellipse(random()*w,random()*h,random()*2.4+.3,random()*1.5+.4,random()*3,0,Math.PI*2);ctx.fill();}
    for(let i=0;i<18;i++){const x=random()*w,y=random()*h,s=3+random()*7;ctx.fillStyle='#79553e80';ctx.beginPath();ctx.ellipse(x,y,s,s*.65,.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d4b18e75';ctx.beginPath();ctx.ellipse(x-1,y-1,s*.7,s*.35,.3,0,Math.PI*2);ctx.fill();}
    ctx.restore();for(const p of this.model.brush)this.erase(p);if(this.model.dug>=100)ctx.clearRect(0,0,w,h);
  }
  erase([x,y]){const ctx=this.ctx,w=this.canvas.width,h=this.canvas.height;ctx.globalCompositeOperation='destination-out';const radius=Math.min(w,h)*.095;const grad=ctx.createRadialGradient(x*w,y*h,radius*.7,x*w,y*h,radius);grad.addColorStop(0,'rgba(0,0,0,1)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x*w,y*h,radius,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';}
  add(p){if(this.model.brush.length<6000)this.model.brush.push(p);this.erase(p);}
  stroke(e){const r=this.canvas.getBoundingClientRect(),p=[Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];if(this.last){const n=Math.ceil(Math.hypot((p[0]-this.last[0])*r.width,(p[1]-this.last[1])*r.height)/12);for(let i=1;i<=n;i++)this.add([this.last[0]+(p[0]-this.last[0])*i/n,this.last[1]+(p[1]-this.last[1])*i/n]);}else this.add(p);this.last=p;this.measure();e.preventDefault();}
  measure(){
    if(!this.active||this.model.dug>=100)return;const w=this.canvas.width,h=this.canvas.height,data=this.ctx.getImageData(0,0,w,h).data;let total=0,empty=0;
    for(let y=8;y<h;y+=12)for(let x=8;x<w;x+=12){if(((x/w-.5)/.47)**2+((y/h-.53)/.45)**2<1){total++;if(data[(y*w+x)*4+3]<100)empty++;}}
    this.model.dug=Math.round(empty/Math.max(1,total)*100);if(this.model.dug>=65){this.model.dug=100;this.canvas.style.opacity='0';this.canvas.style.pointerEvents='none';this.onComplete();}this.onChange(false);
  }
  assist(){if(this.model.dug>=100)return;const w=this.canvas.width,h=this.canvas.height,data=this.ctx.getImageData(0,0,w,h).data;for(let y=.2;y<.9;y+=.13)for(let x=.15;x<.9;x+=.11){if(data[(Math.floor(y*h)*w+Math.floor(x*w))*4+3]>100){this.add([x,y]);this.measure();this.onChange();return;}}}
}
