import { stages, sourceURL } from './content.js';
import { freshModel,validateModel,createHistory } from './model.js';
import { Pottery } from './pottery.js';
import { Interactions } from './interactions.js';

const $ = s => document.querySelector(s);
const show = (el,visible) => {el.hidden=!visible;};
const storageKey='face-pottery-v1';
let saved=null;
try{saved=validateModel(JSON.parse(localStorage.getItem(storageKey)));}catch{}
let model=saved||freshModel(),stage=0,tool='shape',pottery,interaction;
const history=createHistory();
let fireTimer=null,fireStarted=0;

function toast(message){
  $('#toast').textContent=message;$('#toast').classList.add('show');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200);
}
function save(){
  if(stage>0)model.stage=stage;
  try{localStorage.setItem(storageKey,JSON.stringify(model));saved=model;show($('#resume'),true);}catch{toast('이 브라우저에서는 자동 저장을 할 수 없어요. 화면을 닫기 전에 체험을 마쳐 주세요.');}
}
function dialog(title,html,actions=[['계속하기',()=>$('#dialog').close()]]){
  $('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;$('#dialog-actions').replaceChildren();
  for(const [label,fn]of actions){const b=document.createElement('button');b.textContent=label;b.className='secondary';b.onclick=fn;$('#dialog-actions').append(b);}
  $('#dialog').showModal();
}
function about(){
  dialog('오래된 얼굴 이야기',`<figure><img src="assets/artifact.png" alt="실제 출토 유물"><figcaption>사진: 문화재청 보도자료 (2019)</figcaption></figure><p>경산 소월리에서 세 얼굴이 표현된 토기와 시루가 함께 나왔어요. 토기에는 눈과 입, 작은 콧구멍, 얼굴 사이의 구멍이 있어요.</p><p>시루의 바닥은 의도적으로 제거되어 있고, 옆에는 뿔 모양 손잡이가 두 개 있어요. 위에 토기를 얹어 썼다는 것은 연구자의 추정이에요.</p><p>이 체험에서 만드는 모양과 굽기·발굴 장면에는 상상이 들어 있어요. 실제 유물과 달라도 괜찮아요.</p><p><a href="${sourceURL}" target="_blank" rel="noopener noreferrer">출토 자료 보기 ↗</a></p>`);
}
function ensurePottery(){
  if(pottery)return true;
  try{
    pottery=new Pottery($('#scene'),model);
    interaction=new Interactions(pottery,$('#stage-surface'),$('#drawing polyline'),before=>{model=pottery.model;history.push(before);save();renderTools();},toast);
    $('#stage-surface').addEventListener('render-lost',()=>{show($('#scene-error'),true);$('#scene-error').textContent='입체 화면 연결이 잠시 끊겼어요. 새로고침하면 저장된 작품을 이어갈 수 있어요.';});
    let endDrag=null;
    $('#end-scene').addEventListener('pointerdown',e=>{endDrag={id:e.pointerId,x:e.clientX};$('#end-scene').setPointerCapture(e.pointerId);});
    $('#end-scene').addEventListener('pointermove',e=>{if(endDrag&&e.pointerId===endDrag.id){pottery.rotate((e.clientX-endDrag.x)*.012);endDrag.x=e.clientX;}});
    for(const type of ['pointerup','pointercancel'])$('#end-scene').addEventListener(type,()=>endDrag=null);
    return true;
  }catch(error){console.error(error);show($('#scene-error'),true);$('#scene-error').textContent='입체 화면을 열 수 없어요. Chrome 또는 Edge의 그래픽 가속을 확인한 뒤 새로고침해 주세요.';return false;}
}
function renderTools(){
  $('#tools').replaceChildren();if(stage<1||stage>8)return;
  for(const [id,label]of stages[stage].tools){
    const b=document.createElement('button');b.textContent=label;b.dataset.tool=id;
    b.classList.toggle('active',id===tool);b.setAttribute('aria-pressed',String(id===tool));b.onclick=()=>selectTool(id);
    if(id==='fire')b.textContent=model.fired?'다시 보기':'과정 보기';$('#tools').append(b);
  }
  if(stage<=3){const undo=document.createElement('button');undo.className='undo';undo.textContent='↶';undo.title='되돌리기';undo.setAttribute('aria-label','되돌리기');undo.disabled=history.length===0;undo.onclick=undoEdit;$('#tools').append(undo);}
}
function selectTool(id){
  const destinations={'edit-body':1,'edit-crown':2,'edit-face':3};if(destinations[id])return go(destinations[id]);
  if(id==='fire')return startFire();
  tool=id;interaction?.set(stage,tool);renderTools();
  const hints={rotate:'흙 위를 좌우로 끌어 다른 면을 살펴보세요.',carve:'눈과 입이 될 선을 그려 보세요.',press:'콧등 양옆을 눌러 높낮이를 만들어 보세요.',hole:'작게 톡 누르거나, 구멍의 테두리를 둥글게 그려 보세요.',erase:'지우고 싶은 선이나 구멍의 가장자리를 문질러요.',crown:'가운데 윗면에 테두리를 그려요. 톡 누르면 작은 둥근 구멍이 생겨요.'};
  $('#action-hint').textContent=hints[id]||stages[stage].hint;
}
function undoEdit(){
  const old=history.pop();if(!old)return;model=old;model.stage=stage;pottery.update(model);save();renderTools();toast('한 번 전으로 되돌렸어요.');
}
function go(n){
  interaction?.cancel();if(pottery)model=pottery.model;
  stopFire();stage=n;show($('#welcome'),n===0);show($('#workshop'),n>0&&n<9);show($('#ending'),n===9);
  show($('#soil'),false);show($('#compare'),n===8);show($('#task-progress'),false);$('#next').disabled=false;
  if(n===0){show($('#resume'),!!saved);return;}
  if(!ensurePottery()){$('#next').disabled=true;return;}
  pottery.mount(n===9?$('#end-scene'):$('#scene'));pottery.setStage(n);pottery.setFired(model.fired?1:0);
  if(n===9){save();return;}
  const s=stages[n];$('#stage-title').textContent=s.title;$('#stage-subtitle').textContent=s.subtitle;$('#stage-count').textContent=`${n} / 8`;
  $('#progress-fill').style.width=`${n/8*100}%`;
  for(const id of ['speech','tip','fact','instruction'])$('#'+id).textContent=s[id];
  $('#character').src=`asset/게임용 에셋/${s.character}.png`;$('#action-hint').textContent=s.hint;
  $('#next').innerHTML=`${s.next} <span aria-hidden="true">→</span>`;
  show($('#rotate-controls'),[1,3,4,8].includes(n));tool=s.tools[0][0];interaction.set(n,tool);renderTools();
  if(n===6)setupExcavation();
  save();
}
function next(){
  if(stage===2&&model.crown.length<3)return toast('정수리에 내 구멍을 하나 만들어 볼까요?');
  if(stage===5&&!model.fired)return toast('과정 보기 버튼으로 토기를 먼저 구워 보세요.');
  if(stage===6&&model.dug<65)return toast('흙을 조금 더 걷어 내면 토기와 시루가 보여요.');
  if(stage===7&&!model.assembled)return toast('토기를 시루 위로 옮겨 보세요.');
  go(Math.min(9,stage+1));
}
function newWork(){model=freshModel();history.clear();if(pottery)pottery.update(model);go(1);}
$('#start').onclick=()=>saved?dialog('새 작품을 만들까요?','<p>새로 시작하면 이 브라우저에 남아 있는 이전 작품이 지워져요.</p>',[['이어 만들기',()=>{$('#dialog').close();go(model.stage);}],['새로 만들기',()=>{$('#dialog').close();newWork();}]]):newWork();
$('#resume').onclick=()=>go(model.stage);$('#next').onclick=next;$('#previous').onclick=()=>go(Math.max(0,stage-1));
$('#view-again').onclick=()=>go(8);$('#finish').onclick=()=>go(0);
$('#home').onclick=()=>dialog('처음으로 돌아갈까요?','<p>지금 만든 작품은 이어서 만들 수 있어요.</p>',[['계속 만들기',()=>$('#dialog').close()],['처음으로',()=>{$('#dialog').close();go(0);}]]);
$('#dialog-close').onclick=()=>$('#dialog').close();
$('#help').onclick=()=>dialog('손끝으로 만들어 봐요',`<p>${stages[stage].hint}</p><p>${stages[stage].tip.replace(/\n/g,' ')}</p><p>도구를 선택하고 흙 위를 천천히 움직여 보세요. 회전 버튼이나 키보드의 왼쪽·오른쪽 화살표로 다른 면을 살펴볼 수 있어요.</p>`);
document.querySelectorAll('[data-action="about"]').forEach(b=>b.onclick=about);
document.querySelectorAll('[data-rotate]').forEach(b=>b.onclick=()=>pottery?.rotate(Number(b.dataset.rotate)));
$('#story-close').onclick=()=>{$('.work-area').classList.add('story-collapsed');$('.work-area').classList.remove('story-open');$('#story-open').setAttribute('aria-expanded','false');$('#story-open').focus();};
$('#story-open').onclick=()=>{$('.work-area').classList.remove('story-collapsed');$('.work-area').classList.add('story-open');$('#story-open').setAttribute('aria-expanded','true');$('#story-close').focus();};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&stage>0&&stage<4&&!$('#dialog').open){e.preventDefault();undoEdit();}});

// The next implementation phase connects the timed firing and brush excavation.
function stopFire(){if(fireTimer){cancelAnimationFrame(fireTimer);fireTimer=null;}$('#fire-overlay').classList.remove('active');}
function startFire(){toast('굽기 장면을 준비하고 있어요.');}
function setupExcavation(){}

go(0);
