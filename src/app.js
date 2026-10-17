import { stages, sourceURL } from './content.js';
import { freshModel,validateModel,createWorkshopHistory,advanceIssue } from './model.js';
import { Pottery } from './pottery.js';
import { Interactions } from './interactions.js';
import { Excavation } from './excavation.js';

const $ = s => document.querySelector(s);
const show = (el,visible) => {el.hidden=!visible;};
const storageKey='face-pottery-v1';
let saved=null;
try{saved=validateModel(JSON.parse(localStorage.getItem(storageKey)));}catch{}
let model=saved||freshModel(),stage=0,tool='shape',pottery,interaction;
const history=createWorkshopHistory();
let fireTimer=null,fireStarted=0;
const excavation=new Excavation($('#soil'),(persist=true)=>{updateProgress(model.dug,model.dug===100?'내 작품을 찾았어요!':`${model.dug}% 찾았어요`);if(persist)save();},()=>{toast('내 토기와 시루를 찾았어요!');save();});

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
    interaction=new Interactions(pottery,$('#stage-surface'),$('#drawing polyline'),before=>{model=pottery.model;history.push(stage,before);save();renderTools();if(stage===7&&model.assembled)$('#action-hint').textContent='함께 놓아 봤어요. 이 배치는 추정한 모습이에요.';},toast);
    $('#stage-surface').addEventListener('render-lost',()=>{show($('#scene-error'),true);$('#scene-error').textContent='입체 화면 연결이 잠시 끊겼어요. 새로고침하면 저장된 작품을 이어갈 수 있어요.';});
    let endDrag=null;
    $('#end-scene').addEventListener('pointerdown',e=>{endDrag={id:e.pointerId,x:e.clientX};$('#end-scene').setPointerCapture(e.pointerId);});
    $('#end-scene').addEventListener('pointermove',e=>{if(endDrag&&e.pointerId===endDrag.id){pottery.rotate((e.clientX-endDrag.x)*.012);endDrag.x=e.clientX;}});
    for(const type of ['pointerup','pointercancel'])$('#end-scene').addEventListener(type,()=>endDrag=null);
    $('#end-scene').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pottery.rotate(e.key==='ArrowLeft'?-.2:.2);}});
    return true;
  }catch(error){console.error(error);show($('#scene-error'),true);$('#scene-error').textContent='입체 화면을 열 수 없어요. Chrome 또는 Edge의 그래픽 가속을 확인한 뒤 새로고침해 주세요.';return false;}
}
function renderTools(){
  $('#tools').replaceChildren();if(stage<1||stage>8)return;
  show($('#rotate-controls'),[3,4,8].includes(stage)||(stage===1&&tool==='rotate'));
  $('#stage-surface').classList.toggle('profile-view',stage===1&&tool==='shape');
  if(stage===1){$('#instruction').textContent=tool==='rotate'?'돌려서 입체 모양을 살펴보세요':stages[1].instruction;$('#action-hint').textContent=tool==='rotate'?'좌우로 끌어 360° 살펴봐요. 다듬기를 누르면 정면으로 돌아와요.':stages[1].hint;}
  for(const [id,label]of stages[stage].tools){
    const b=document.createElement('button');b.textContent=label;b.dataset.tool=id;
    b.classList.toggle('active',id===tool);b.setAttribute('aria-pressed',String(id===tool));b.onclick=()=>selectTool(id);
    if(id==='fire')b.textContent=model.fired?'다시 보기':'과정 보기';$('#tools').append(b);
  }
  if(stage<=3){const undo=document.createElement('button');undo.className='undo';undo.textContent='↶';undo.title='이 단계 되돌리기';undo.setAttribute('aria-label','이 단계 되돌리기');undo.disabled=history.count(stage)===0;undo.onclick=undoEdit;$('#tools').append(undo);}
}
function selectTool(id){
  const destinations={'edit-body':1,'edit-crown':2,'edit-face':3};if(destinations[id])return go(destinations[id]);
  if(id==='fire')return startFire();
  if(id==='brush'){excavation.assist();return;}
  if(id==='move'){if(!model.assembled){model.assembled=true;pottery.update(model);save();$('#action-hint').textContent='함께 놓아 봤어요. 이 배치는 추정한 모습이에요.';toast('시루 위에 내 토기를 놓았어요!');}return;}
  tool=id;interaction?.set(stage,tool);renderTools();
  const hints={rotate:'흙 위를 좌우로 끌어 다른 면을 살펴보세요.',carve:'톡 누르면 작은 구멍, 선을 닫으면 큰 구멍, 열린 선은 홈이 돼요.',ear:'귀 같은 옆 구멍을 만들어요. 톡 누르거나 테두리를 그리면 둘레가 바깥으로 올라와요.',press:'콧등 양옆을 눌러 높낮이를 만들어 보세요.',erase:'지우고 싶은 선이나 구멍의 가장자리를 문질러요.',crown:'넓은 흙 윗면에 원하는 구멍의 테두리를 이어 그려요.'};
  if(stage!==1)$('#action-hint').textContent=hints[id]||stages[stage].hint;
}
function undoEdit(){
  interaction?.cancel();if(pottery)model=pottery.model;
  const old=history.pop(stage,model);if(!old)return;model=old;pottery.update(model);save();renderTools();toast('이 단계에서 한 작업을 되돌렸어요.');
}
function go(n){
  interaction?.cancel();if(pottery)model=pottery.model;
  stopFire();excavation.stop();stage=n;show($('#welcome'),n===0);show($('#workshop'),n>0&&n<9);show($('#ending'),n===9);
  window.scrollTo({top:0,behavior:'instant'});
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
  show($('#face-guides'),n===3);
  if(n===6)setupExcavation();
  if(n===7&&model.assembled)$('#action-hint').textContent='함께 놓아 봤어요. 이 배치는 추정한 모습이에요.';
  save();
}
function next(){
  if(fireTimer)return;
  const issue=advanceIssue(stage,model);if(issue)return toast(issue);
  go(Math.min(9,stage+1));
}
function newWork(){model=freshModel();history.clear();if(pottery)pottery.update(model);go(1);}
$('#start').onclick=()=>saved?dialog('새 작품을 만들까요?','<p>새로 시작하면 이 브라우저에 남아 있는 이전 작품이 지워져요.</p>',[['이어 만들기',()=>{$('#dialog').close();go(model.stage);}],['새로 만들기',()=>{$('#dialog').close();newWork();}]]):newWork();
$('#resume').onclick=()=>go(model.stage);$('#next').onclick=next;$('#previous').onclick=()=>go(Math.max(0,stage-1));
$('#view-again').onclick=()=>go(8);$('#finish').onclick=()=>go(0);
$('#home').onclick=()=>dialog('처음으로 돌아갈까요?','<p>지금 만든 작품은 이어서 만들 수 있어요.</p>',[['계속 만들기',()=>$('#dialog').close()],['처음으로',()=>{$('#dialog').close();go(0);}]]);
$('#dialog-close').onclick=()=>$('#dialog').close();
$('#help').onclick=()=>dialog('손끝으로 만들어 봐요',`<p>${stages[stage].hint}</p><p>${stages[stage].tip.replace(/\n/g,' ')}</p><p>${stage===1?'윤곽을 잡고 원하는 방향으로 천천히 밀고 당겨요. 잡은 곳 주변이 함께 움직여요. 돌리기를 누르면 360도로 볼 수 있어요.':'도구를 선택하고 흙 위를 천천히 움직여 보세요. 회전 버튼이나 키보드의 왼쪽·오른쪽 화살표로 다른 면을 살펴볼 수 있어요.'}</p>`);
document.querySelectorAll('[data-action="about"]').forEach(b=>b.onclick=about);
document.querySelectorAll('[data-rotate]').forEach(b=>b.onclick=()=>pottery?.rotate(Number(b.dataset.rotate)));
$('#guide-count').onchange=e=>pottery?.setGuides(Number(e.target.value));
$('#story-close').onclick=()=>{$('.work-area').classList.add('story-collapsed');$('.work-area').classList.remove('story-open');$('#story-open').setAttribute('aria-expanded','false');$('#story-open').focus();};
$('#story-open').onclick=()=>{$('.work-area').classList.remove('story-collapsed');$('.work-area').classList.add('story-open');$('#story-open').setAttribute('aria-expanded','true');$('#story-close').focus();};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&stage>0&&stage<4&&!$('#dialog').open){e.preventDefault();undoEdit();}});

function updateProgress(value,text){show($('#task-progress'),true);$('#task-progress progress').value=value;$('#task-progress span').textContent=text;}
function stopFire(){if(fireTimer){cancelAnimationFrame(fireTimer);fireTimer=null;}$('#fire-overlay').classList.remove('active');}
function startFire(){
  if(fireTimer)return;fireStarted=performance.now();$('#next').disabled=true;
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?2400:7500;
  const tick=now=>{
    if(stage!==5)return;const t=Math.min(1,(now-fireStarted)/duration);pottery.setFired(t);
    $('#fire-overlay').classList.toggle('active',t>.25&&t<.8);
    const words=t<.25?'천천히 말려요':t<.8?'따뜻하게 구워요':t<1?'조금씩 식혀요':'내 토기가 완성됐어요!';
    updateProgress(Math.round(t*100),words);$('#action-hint').textContent='실제 유물의 제작 시간을 재현한 장면은 아니에요.';
    if(t<1)fireTimer=requestAnimationFrame(tick);else{fireTimer=null;model.fired=true;model.dug=0;model.brush=[];model.assembled=false;pottery.update(model);$('#next').disabled=false;save();renderTools();toast('이제 내 토기를 다시 찾으러 가 볼까요?');}
  };fireTimer=requestAnimationFrame(tick);
}
function setupExcavation(){show($('#soil'),true);excavation.start(model);updateProgress(model.dug,model.dug===100?'내 작품을 찾았어요!':`${model.dug}% 찾았어요`);}

go(0);
