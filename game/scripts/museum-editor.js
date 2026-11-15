const $=id=>document.getElementById(id);
const names={welcome:'시작 화면',body:'몸체 빚기',mouth:'입구 다듬기',faces:'얼굴과 옆 구멍',inspect:'내 토기 살펴보기',firing:'굽기',excavation:'발굴',assembly:'시루에 얹기',compare:'유물과 비교',ending:'완성 사진'};
const kinds={fact:'확인된 내용',interpretation:'연구자의 해석',imagination:'게임 속 상상'};
let catalog,stage='welcome',photoId,dirty=false;
const message=text=>$('message').textContent=text;
const mark=()=>{dirty=true;message('아직 저장하지 않은 변경이 있어요.');preview();};
function option(value,label){const o=document.createElement('option');o.value=value;o.textContent=label;return o;}
function photos(){
 for(const id of ['photo','stage-photo']){const select=$(id);select.replaceChildren(...catalog.photos.map(p=>option(p.id,p.caption||p.id)));}
 $('stage-photo').value=catalog.stages[stage].photo;
 if(!catalog.photos.some(p=>p.id===photoId))photoId=catalog.photos[0].id;
 $('photo').value=photoId;showPhoto();preview();
}
function preview(){if(!catalog)return;const entry=catalog.stages[stage],photo=catalog.photos.find(p=>p.id===entry.photo);$('title-preview').textContent=entry.title;$('summary-preview').textContent=entry.summary;$('summary-count').textContent=entry.summary.length+'/140';$('card-photo').src='/media/'+photo.file;}
function showPhoto(){const p=catalog.photos.find(p=>p.id===photoId);$('photo-preview').src='/media/'+p.file;for(const key of ['caption','alt','credit','source'])$(key).value=p[key];}
function showStage(){
 const entry=catalog.stages[stage];$('title').value=entry.title;$('summary').value=entry.summary;
 $('blocks').replaceChildren();
 entry.blocks.forEach((block,index)=>{
  const wrap=document.createElement('div');wrap.className='block';
  const kind=document.createElement('select');kind.setAttribute('aria-label','문단 구분');kind.append(...Object.entries(kinds).map(([v,n])=>option(v,n)));kind.value=block.kind;kind.onchange=()=>{block.kind=kind.value;mark();};
  const text=document.createElement('textarea');text.maxLength=4000;text.value=block.text;text.setAttribute('aria-label',`이야기 ${index+1}`);text.oninput=()=>{block.text=text.value;mark();};
  const remove=document.createElement('button');remove.textContent='문단 삭제';remove.disabled=entry.blocks.length===1;remove.onclick=()=>{entry.blocks.splice(index,1);showStage();mark();};
  const up=document.createElement('button');up.textContent='위로';up.disabled=index===0;up.onclick=()=>{[entry.blocks[index-1],entry.blocks[index]]=[entry.blocks[index],entry.blocks[index-1]];showStage();mark();};
  wrap.append(kind,text,up,remove);$('blocks').append(wrap);
 });photos();
}
function field(label,value,change,type='text'){
 const l=document.createElement('label');l.textContent=label;const input=document.createElement('input');input.type=type;input.value=value;input.oninput=()=>{change(input.value);mark();};l.append(input);return l;
}
function models(){
 $('exhibits').replaceChildren();catalog.exhibits.forEach((model,i)=>{
  const div=document.createElement('div');div.className='exhibit';
  div.append(field('유물 이름',model.name,v=>model.name=v),field('전시 높이',model.height,v=>model.height=Number(v),'number'));
  const row=document.createElement('div');row.className='row';['가로 X','높이 Y','앞뒤 Z'].forEach((name,n)=>row.append(field(name,model.position[n],v=>model.position[n]=Number(v),'number')));
  div.append(row,field('회전 각도',model.rotation,v=>model.rotation=Number(v),'number'));
  const label=document.createElement('label');label.textContent='누르면 열리는 이야기';const select=document.createElement('select');select.append(...Object.entries(names).map(([v,n])=>option(v,n)));select.value=model.stage;select.onchange=()=>{model.stage=select.value;mark();};label.append(select);div.append(label);
  const remove=document.createElement('button');remove.textContent='전시에서 제외';remove.onclick=()=>{catalog.exhibits.splice(i,1);models();mark();};div.append(remove);$('exhibits').append(div);
 });
}
async function post(path,body,headers={}){const response=await fetch(path,{method:'POST',headers:{'X-Editor-Token':window.editorToken,...headers},body});const data=await response.json();if(!response.ok)throw Error(data.error??'처리하지 못했어요.');return data;}
async function upload(file){return (await post('/api/upload?name='+encodeURIComponent(file.name),file)).file;}
async function action(run){try{await run();}catch(error){message(error.message);}}
$('stage').append(...Object.entries(names).map(([v,n])=>option(v,n)));
$('stage').onchange=()=>{stage=$('stage').value;showStage();};
for(const id of ['title','summary'])$(id).oninput=()=>{catalog.stages[stage][id]=$(id).value;mark();};
$('stage-photo').onchange=()=>{catalog.stages[stage].photo=$('stage-photo').value;mark();};
$('photo').onchange=()=>{photoId=$('photo').value;showPhoto();};
for(const key of ['caption','alt','credit','source'])$(key).oninput=()=>{catalog.photos.find(p=>p.id===photoId)[key]=$(key).value;mark();};
$('add-block').onclick=()=>{catalog.stages[stage].blocks.push({kind:'imagination',text:''});showStage();mark();};
$('photo-upload').onchange=()=>action(async()=>{const file=$('photo-upload').files[0];if(!file)return;const filename=await upload(file);photoId=crypto.randomUUID();catalog.photos.push({id:photoId,file:filename,alt:file.name,caption:file.name,credit:'',source:''});photos();mark();$('photo-upload').value='';});
$('replace-photo').onclick=()=>$('replace-file').click();
$('replace-file').onchange=()=>action(async()=>{const file=$('replace-file').files[0];if(!file)return;catalog.photos.find(p=>p.id===photoId).file=await upload(file);showPhoto();mark();$('replace-file').value='';});
$('delete-photo').onclick=()=>{if(catalog.photos.length===1||Object.values(catalog.stages).some(s=>s.photo===photoId)){message('단계에 연결된 사진은 대표 사진을 바꾼 뒤 삭제해 주세요.');return;}catalog.photos=catalog.photos.filter(p=>p.id!==photoId);photos();mark();};
for(const [id,step]of [['photo-up',-1],['photo-down',1]])$(id).onclick=()=>{const i=catalog.photos.findIndex(p=>p.id===photoId),j=i+step;if(j<0||j>=catalog.photos.length)return;[catalog.photos[i],catalog.photos[j]]=[catalog.photos[j],catalog.photos[i]];photos();mark();};
$('model-upload').onchange=()=>action(async()=>{const file=$('model-upload').files[0];if(!file)return;catalog.exhibits.push({id:crypto.randomUUID(),name:file.name,file:await upload(file),height:.35,position:[-1.65,.7,-.8],rotation:0,stage:'welcome'});models();mark();$('model-upload').value='';});
$('save').onclick=()=>action(async()=>{$('save').disabled=true;try{await post('/api/catalog',JSON.stringify(catalog),{'Content-Type':'application/json'});dirty=false;message('저장했어요. 게임을 새로고침하면 반영돼요.');}finally{$('save').disabled=false;}});
$('restore').onclick=()=>action(async()=>{if(!confirm('직전 저장본으로 복구할까요?'))return;catalog=await post('/api/restore','');dirty=false;showStage();models();message('직전 저장본을 복구했어요.');});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
try{const response=await fetch('/api/catalog');catalog=await response.json();photoId=catalog.photos[0].id;showStage();models();}catch(error){message(error.message);}
