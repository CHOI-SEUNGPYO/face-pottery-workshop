import {characterImage} from './assets';
import {icon} from './icons';
import {AI_CONTENT_LABEL,drawPhotoDisclosure} from './disclosure';
import type {PhotoView} from './photo-scene';

type Sticker={name:string;x:number;y:number;size:number;angle:number};
/** Photo-only overlays never touch the saved pottery document. */
export class PhotoEditor {
  private canvas:HTMLCanvasElement;
  private base=document.createElement('canvas');
  private images=new Map<string,HTMLImageElement>();
  private stickers:Sticker[]=[];
  private history:Sticker[][]=[];
  private selected=-1;
  private events=new AbortController();
  private frame=0;
  private drag:{kind:'sticker';pointer:number;x:number;y:number;ox:number;oy:number}|{kind:'pottery';pointer:number;x:number;angle:number}|null=null;
  constructor(private root:HTMLElement,private view:PhotoView){
    root.innerHTML=`<div class="photo-editor"><p class="eyebrow">${AI_CONTENT_LABEL}</p><h2>내 작품을 사진으로 남겨요</h2><canvas width="1920" height="1080" tabindex="0" aria-label="사진 속 토기: 끌거나 왼쪽·오른쪽 방향키로 돌리세요. 스티커를 선택하면 스티커만 움직여요. AI 제작 표시도 함께 저장됩니다."></canvas><div class="sticker-picker" aria-label="캐릭터 스티커">${['경산이','독이','압이'].map(name=>`<button data-sticker="${name}" aria-label="${name} 스티커 추가"><img src="${characterImage(name)}" alt="">${name}</button>`).join('')}<button data-photo="undo" class="photo-icon" aria-label="꾸미기 되돌리기" title="꾸미기 되돌리기">${icon('undo')}</button></div><div class="sticker-controls"><label>크기<input data-photo="size" aria-label="스티커 크기" type="range" min="90" max="650" value="250"></label><label>회전<input data-photo="angle" aria-label="스티커 회전" type="range" min="-180" max="180" value="0"></label><button data-photo="delete" class="photo-icon" aria-label="선택한 스티커 삭제" title="선택한 스티커 삭제">${icon('erase')}</button></div><div class="photo-actions"><button data-action="retake" class="secondary">다시 찍기</button><button data-photo="download" class="primary">사진 저장</button><button data-action="finish-photo" class="secondary" aria-label="꾸미기 완료">완료</button></div><p role="status" class="photo-status">사진을 끌어 토기를 돌려 보세요. 케이스와 함께 내 작품만 저장돼요.</p></div>`;
    this.canvas=root.querySelector('canvas')!;
    this.base.width=1920;this.base.height=1080;
    this.sync();this.updateView();
    void document.fonts.ready.then(()=>{if(!this.events.signal.aborted)this.draw();});
    for(const name of ['경산이','독이','압이']){const im=new Image();im.onload=()=>this.draw();im.src=characterImage(name);this.images.set(name,im);}
    const options={signal:this.events.signal};
    root.addEventListener('click',event=>{
      const el=(event.target as HTMLElement).closest<HTMLElement>('[data-sticker],[data-photo]');if(!el)return;
      if(el.dataset.sticker){this.remember();this.stickers.push({name:el.dataset.sticker,x:600+this.stickers.length%4*200,y:800,size:250,angle:0});this.selected=this.stickers.length-1;this.sync();this.draw();}
      if(el.dataset.photo==='delete')this.remove();
      if(el.dataset.photo==='undo'){const prev=this.history.pop();if(prev){this.stickers=prev;this.selected=-1;this.sync();this.draw();}}
      if(el.dataset.photo==='download')void this.download();
    },options);
    root.addEventListener('input',event=>{
      const el=event.target as HTMLInputElement,key=el.dataset.photo;
      if((key==='size'||key==='angle')&&this.stickers[this.selected]){this.stickers[this.selected][key]=Number(el.value);this.draw();}
    },options);
    root.addEventListener('pointerdown',event=>{if((event.target as HTMLElement).matches('[data-photo="size"],[data-photo="angle"]'))this.remember();},options);
    root.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement&&['size','angle'].includes(event.target.dataset.photo??'')&&event.key.startsWith('Arrow'))this.remember();},options);
    this.canvas.addEventListener('pointerdown',event=>{
      if(!event.isPrimary||event.button!==0||this.drag)return;
      const p=this.point(event),i=this.stickers.findLastIndex(s=>{
        const im=this.images.get(s.name),a=-s.angle*Math.PI/180,dx=p.x-s.x,dy=p.y-s.y;
        return Math.abs(dx*Math.cos(a)-dy*Math.sin(a))<=s.size*(im?.naturalWidth||1)/(im?.naturalHeight||1)/2&&Math.abs(dx*Math.sin(a)+dy*Math.cos(a))<=s.size/2;
      });
      event.preventDefault();this.selected=i;this.sync();this.draw();
      // Selecting a sticker reveals its controls and may move the dialog.
      // Start the drag from the canvas's new position so the sticker stays put.
      const start=this.point(event);
      if(i<0)this.drag={kind:'pottery',pointer:event.pointerId,x:start.x,angle:this.view.rotation};
      else{this.remember();const s=this.stickers[i];this.drag={kind:'sticker',pointer:event.pointerId,x:start.x,y:start.y,ox:s.x,oy:s.y};}
      this.canvas.setPointerCapture(event.pointerId);
    },options);
    this.canvas.addEventListener('pointermove',event=>{
      const d=this.drag;if(!d||d.pointer!==event.pointerId)return;const p=this.point(event);
      if(d.kind==='pottery'){
        this.view.rotation=d.angle+(p.x-d.x)*Math.PI*2/1920;
        if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.updateView();});
      }else{const s=this.stickers[this.selected];if(s){s.x=Math.max(0,Math.min(1920,d.ox+p.x-d.x));s.y=Math.max(0,Math.min(1080,d.oy+p.y-d.y));this.draw();}}
    },options);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(type,()=>{
      this.drag=null;if(this.frame){cancelAnimationFrame(this.frame);this.frame=0;this.updateView();}
    },options);
    this.canvas.addEventListener('keydown',event=>{
      const s=this.stickers[this.selected];
      if(!s){if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.view.rotation+=event.key==='ArrowRight'?.12:-.12;this.updateView();}return;}
      if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();this.remove();return;}
      const movement:Record<string,number[]>={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]};
      const delta=movement[event.key];if(delta){event.preventDefault();this.remember();s.x=Math.max(0,Math.min(1920,s.x+delta[0]));s.y=Math.max(0,Math.min(1080,s.y+delta[1]));this.draw();}
    },options);
  }
  private remember(){this.history.push(structuredClone(this.stickers));if(this.history.length>40)this.history.shift();}
  private point(event:PointerEvent){const r=this.canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*1920/r.width,y:(event.clientY-r.top)*1080/r.height};}
  private sync(){const s=this.stickers[this.selected];this.root.querySelector<HTMLElement>('.sticker-controls')!.hidden=!s;for(const key of ['size','angle'] as const){const input=this.root.querySelector<HTMLInputElement>(`[data-photo="${key}"]`)!;input.disabled=!s;if(s)input.value=String(s[key]);}this.root.querySelector<HTMLButtonElement>('[data-photo="delete"]')!.disabled=!s;this.root.querySelector<HTMLButtonElement>('[data-photo="undo"]')!.disabled=!this.history.length;}
  private remove(){if(this.selected<0)return;this.remember();this.stickers.splice(this.selected,1);this.selected=-1;this.sync();this.draw();}
  private updateView(fullSize=false){this.view.render(this.base.getContext('2d')!,fullSize);this.draw();}
  private draw(selection=true){
    const c=this.canvas.getContext('2d')!;c.clearRect(0,0,1920,1080);c.drawImage(this.base,0,0,1920,1080);
    this.stickers.forEach((s,i)=>{const im=this.images.get(s.name);if(!im?.naturalWidth)return;const w=s.size*im.naturalWidth/im.naturalHeight;c.save();c.translate(s.x,s.y);c.rotate(s.angle*Math.PI/180);c.drawImage(im,-w/2,-s.size/2,w,s.size);if(selection&&i===this.selected){c.strokeStyle='#fbd46f';c.lineWidth=4;c.setLineDash([12,8]);c.strokeRect(-w/2-10,-s.size/2-10,w+20,s.size+20);}c.restore();});
    drawPhotoDisclosure(c);
  }
  private async download(){
    const status=this.root.querySelector<HTMLElement>('.photo-status')!;
    try{await document.fonts.ready;await Promise.all(this.stickers.map(s=>this.images.get(s.name)!.decode()));this.updateView(true);this.draw(false);const blob=await new Promise<Blob>((resolve,reject)=>this.canvas.toBlob(b=>b?resolve(b):reject(Error('encode')),'image/png'));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`내-얼굴모양토기-${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='선택한 방향 그대로 사진을 저장했어요.';}
    catch{status.textContent='사진을 저장하지 못했어요. 다시 눌러 주세요.';}finally{this.draw();}
  }
  dispose(){this.events.abort();cancelAnimationFrame(this.frame);this.view.dispose();for(const im of this.images.values())im.onload=null;}
}
