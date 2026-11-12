import "./style.css";
import "./layout.css";
import {firingFrame} from './firing';
import * as T from "three";
import {
  freshSave,
  cloneDoc,
  changed,
  order,
  uid,
  clamp,
  surfacePoint,
  History,
  setMouth,
  COLS,
  ROWS,
  type SoftForm,
  type SceneId,
  type GameSave,
  type UV,
} from "./model";
import {
  scenes,
  toolLabels,
  toolHelp,
  type ToolId,
  type CarveMode,
} from "./content";
import { World, type ViewPreset } from "./world";
import { toolGuide } from "./tool-guide";
import { finishStroke, strokeIntent, type StrokePoint } from "./stroke";
import { placeOpening, type OpeningPlacement, type ScreenPoint } from "./opening-placement";
import {
  addSurfaceFeature,
  crossToolOverlap,
  nearestFeature,
  refineFeature,
} from "./features";
import {
  createSoftDocument,
  applyForm,
  readForm,
  shapeForm,
  smoothForm,
  adjustMouth,
  forms,
  type FormId,
} from "./form";
import { SaveRepository } from "./save";
import { AudioController } from "./audio";
import { icon } from "./icons";
import { characterImage, asset } from "./assets";
import {PhotoEditor} from './photo-editor';
import { museum, loadMuseum, museumAsset, photoFor, storyCard, escapeHTML as e, factLabels } from './museum';

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML =
  '<div id="world"></div><div class="vignette"></div><svg id="opening-outline" aria-hidden="true"><path class="outline-halo"/><path class="outline-line"/></svg><main id="hud"></main><div id="toast" role="status" aria-live="polite"></div><dialog id="dialog"></dialog><div id="orientation-guide" role="status"><div class="rotate-device" aria-hidden="true">↻</div><h2>가로로 돌려 주세요</h2><p>넓은 화면에서 토기를 함께 만들어 봐요.</p></div><div id="travel" hidden aria-live="polite"><div class="travel-party" role="img" aria-label="세 친구가 옆으로 눕힌 큰 얼굴토기를 함께 들고 달려요"><img class="travel-vessel" alt=""></div><h2></h2><p>경산이 · 독이 · 압이와 함께</p></div><div id="loading"><span class="loading-pot">◡</span><p>햇살 가득한 작업실을 준비하고 있어요</p></div>';
const host = document.querySelector<HTMLDivElement>("#world")!,
  hud = document.querySelector<HTMLDivElement>("#hud")!,
  dialog = document.querySelector<HTMLDialogElement>("#dialog")!,
  toastElement = document.querySelector<HTMLDivElement>("#toast")!,
  openingOutline = document.querySelector<SVGElement>("#opening-outline")!;
function newSave() {
  const value = freshSave();
  value.document = createSoftDocument();
  return value;
}
let save = newSave(),
  saved: GameSave | null = null,
  stage: SceneId = "welcome",
  tool: ToolId = "shape",
  carveMode: CarveMode = "opening",
  fireStart = 0,
  fireTimer = 0,
  fireElapsed = 0,
  fireLast = 0,
  toastTimer = 0,
  loaded = false,
  photoURL = "";
const history = new History(),
  repository = new SaveRepository(),
  audio = new AudioController();
let world: World;
let photoEditor:PhotoEditor|null=null,returnToInspect=false,travelling=false,digComplete=false;
const portrait=matchMedia('(orientation:portrait) and (max-width:1180px)');
function syncPause(){if(!world)return;world.paused=portrait.matches||dialog.open;fireLast=performance.now();document.body.classList.toggle('portrait-paused',portrait.matches);if(!world.paused)world.refresh();}
portrait.addEventListener('change',()=>{cancelGesture();syncPause();});
function closeActions(){hud.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>d.open=false);}
document.addEventListener('pointerdown',event=>{if(!(event.target as HTMLElement).closest('details.actionbar'))closeActions();});
document.addEventListener('toggle',event=>{const el=event.target;if(el instanceof HTMLDetailsElement&&el.open&&el.classList.contains('actionbar'))hud.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>{if(d!==el)d.open=false;});},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeActions();});
function actionbar(label:string,content:string,classes:string){return `<details class="actionbar ${classes}"><summary>${icon(classes==='view-controls'?'rotate':classes==='edit-actions'?'shape':'carve')}<span>${label}</span><span class="action-chevron">＋</span></summary><div class="action-panel">${content}</div></details>`;}
const button = (
  action: string,
  label: string,
  ico = action,
  classes = "",
  disabled = false,
) =>
  `<button type="button" data-action="${action}" class="${classes}" ${disabled ? "disabled" : ""} aria-label="${label}" title="${label}">${icon(ico)}<span>${label}</span></button>`;
function toast(text: string) {
  toastElement.textContent = text;
  toastElement.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => toastElement.classList.remove("visible"),
    3000,
  );
}
async function persist() {
  save.stage = stage === "welcome" ? save.stage : stage;
  try {
    await repository.save(save);
    saved = structuredClone(save);
  } catch {
    toast("이 기기에 저장하지 못했어요. 지금 만드는 작품은 계속 볼 수 있어요.");
  }
}
function layoutUI() {
  const area = hud.querySelector<HTMLElement>(".work-area");
  if (!area || !world) return;
  const w = innerWidth,
    h = innerHeight,
    compact = w < 1100 || h < 600;
  let left = 28,
    top = 140,
    right = w - 28,
    bottom = h - 150;
  if (stage === "welcome") {
    const copy = hud
      .querySelector<HTMLElement>(".welcome-copy")!
      .getBoundingClientRect();
    left = compact ? 28 : Math.max(copy.right + 36, w * 0.51);
    top = compact ? copy.bottom + 18 : 120;
    bottom = h - 64;
  } else {
    left = compact ? 170 : 256;
    right = compact ? w-156 : w-256;
    top = compact ? 62 : 90;
    bottom = compact ? h-72 : h-96;
  }
  area.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(120, right - left)}px;height:${Math.max(120, bottom - top)}px`;
  world.reframe();
  positionFormHandles();
}
window.addEventListener("resize", () => requestAnimationFrame(layoutUI));
function viewControls() {
  return actionbar("보기",`<div class="view-presets">${(
    [
      ["front", "앞", "앞에서 보기"],
      ["angle", "비스듬히", "비스듬히 보기"],
      ["side", "옆", "옆에서 보기"],
      ["top", "위", "위에서 보기"],
    ] as const
  )
    .map(
      ([id, label, name]) =>
        `<button data-action="view-${id}" aria-label="${name}" aria-pressed="${world.viewPreset === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div><div class="view-zoom">${button("zoom-out", "멀리 보기", "minus", "view-icon")}${button("zoom-in", "가까이 보기", "plus", "view-icon")}${button("view-stage", "추천 시점으로", "rotate", "view-icon")}</div>`,"view-controls");
}
function syncViewControls() {
  for (const b of hud.querySelectorAll<HTMLButtonElement>(
    ".view-presets button",
  ))
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.action === `view-${world.viewPreset}`),
    );
}
function formControls() {
  const f = readForm(save.document);
  return `<section class="form-controls" aria-label="몸체 모양 조절"><div class="form-ranges"><label>높이 <output id="height-value">${Math.round(f.height * 100)}%</output><input aria-label="토기 높이" data-form-range="height" type="range" min="65" max="165" value="${Math.round(f.height * 100)}"></label><label>전체 넓이 <output id="width-value">${Math.round(f.width * 100)}%</output><input aria-label="토기 전체 넓이" data-form-range="width" type="range" min="65" max="140" value="${Math.round(f.width * 100)}"></label></div>${button("smooth-form", "매끈하게 정리", "shape", "smooth-button")}</section>`;
}
function positionFormHandles() {
  const handles = hud.querySelector<HTMLElement>(".form-handles");
  if (!handles || !["body", "mouth"].includes(stage)) return;
  world.camera.updateMatrixWorld();
  world.pottery.root.updateWorldMatrix(true, false);
  const box = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity,
  };
  const p = new T.Vector3();
  for (let j = stage === "mouth" ? ROWS : 0; j <= ROWS; j += 4)
    for (let i = 0; i < COLS; i += 4) {
      p.fromArray(save.document.outerXYZ, (j * COLS + i) * 3)
        .applyMatrix4(world.pottery.root.matrixWorld)
        .project(world.camera);
      const x = ((p.x + 1) * innerWidth) / 2,
        y = ((1 - p.y) * innerHeight) / 2;
      box.left = Math.min(box.left, x);
      box.right = Math.max(box.right, x);
      box.top = Math.min(box.top, y);
      box.bottom = Math.max(box.bottom, y);
    }
  const area = hud
    .querySelector<HTMLElement>(".work-area")!
    .getBoundingClientRect();
  const height = handles.querySelector<HTMLElement>(
    '[data-form-handle$="height"]',
  )!;
  const width = handles.querySelector<HTMLElement>(
    '[data-form-handle$="width"]',
  )!;
  const mouth = stage === "mouth", margin = mouth ? 60 : 40;
  height.style.left = `${clamp((box.left + box.right) / 2, area.left + margin, area.right - margin)}px`;
  height.style.top = `${clamp(box.top - (mouth ? 38 : 32), area.top + (mouth ? 24 : 12), area.bottom - 24)}px`;
  width.style.left = `${clamp(box.right + (mouth ? 52 : 42), area.left + margin, area.right - margin)}px`;
  width.style.top = `${clamp((box.top + box.bottom) / 2, area.top + 24, area.bottom - 24)}px`;
  if (mouth) {
    // Keep the whole button outside the projected rim, even when the front
    // view puts the opening above the nominal work area.
    for (const [handle, side] of [[height, -1], [width, 1]] as const) {
      const halfWidth = handle.offsetWidth / 2, halfHeight = handle.offsetHeight / 2;
      const x = clamp(side < 0 ? box.left - halfWidth - 18 : box.right + halfWidth + 18,
        area.left + halfWidth, area.right - halfWidth);
      const beside = side < 0 ? x + halfWidth < box.left - 8 : x - halfWidth > box.right + 8;
      const y = beside ? (box.top + box.bottom) / 2 : box.bottom + halfHeight + 18;
      handle.style.left = `${x}px`;
      handle.style.top = `${clamp(y, area.top + halfHeight, area.bottom - halfHeight)}px`;
    }
  }
  handles.querySelector("path")?.setAttribute("d",
    `M${box.left},${(box.top + box.bottom) / 2} L${parseFloat(height.style.left)},${parseFloat(height.style.top)} M${box.right},${(box.top + box.bottom) / 2} L${parseFloat(width.style.left)},${parseFloat(width.style.top)}`,
  );
}
function mouthControls() {
  const m = save.document.mouth;
  if (!m.opened) return button("open-mouth", "열린 입구로 바꾸기", "mouth", "secondary");
  return '<p class="mouth-hint">입구 옆 손잡이로 넓이와 높이를 바꿔요.</p>';
}
function updateUI() {
  const c = scenes[stage],
    n = order.indexOf(stage),
    isEdit = ["body", "mouth", "faces"].includes(stage),
    fired = save.firedRevision === save.document.revision;
  document.body.dataset.stage = stage;
  host.dataset.tool = tool;
  world.renderer.domElement.setAttribute(
    "aria-description",
    stage === "mouth" ? scenes.mouth.instruction : toolHelp[tool].instruction,
  );
  const header = `<header><a class="brand" href="#" data-action="home"><span class="brand-pot">${icon("mouth")}</span><span>얼굴토기<br><small>작은 흙 공방</small></span></a><nav aria-label="공통 메뉴">${
    stage !== "welcome"
      ? `<div class="journey" aria-label="${n} / 9 단계">${order
          .slice(1)
          .map(
            (s, i) =>
              `<span class="${i < n ? "done" : ""} ${s === stage ? "current" : ""}"></span>`,
          )
          .join("")}</div>`
      : ""
  }${stage==="welcome"?button("story", "유물 이야기", "story", "story-button"):""}${button("sound", audio.muted ? "소리 켜기" : "소리 끄기", audio.muted ? "muted" : "sound", "round icon-only")}${button("help", "도움말", "help", "round icon-only")}</nav></header>`;
  if (stage === "welcome") {
    hud.innerHTML =
      header +
      `<div class="work-area" aria-hidden="true"></div><section class="welcome-copy"><p class="eyebrow">손끝에서 피어나는 작은 발견</p><h1>흙에서 만나는<br><em>나의 얼굴</em></h1><p class="welcome-description">만지고, 빚고, 표정을 담아.<br>나만의 토기가 들려주는 이야기를 만나 보세요.</p><div class="welcome-actions">${button("new", "만들러 가기", "next", "primary large")}${saved ? button("continue", "이어 만들기", "play", "secondary") : ""}</div><p class="welcome-note">정답은 없어요. 당신의 모양이면 충분해요.</p></section><div class="welcome-foot"><span>경산 소월리의 얼굴 토기에서 시작한 창작 체험</span><span>만들기 · 발견하기 · 이야기 나누기</span></div>`;
    layoutUI();
    return;
  }
  const primaryLabel =
    stage === "firing" && !fired
      ? fireStart
        ? "연출 건너뛰기"
        : "과정 보기"
      : returnToInspect&&isEdit ? '수정 마치고 확인하기' : stage==='excavation'&&digComplete ? '발견! 시루에 얹어 보기' : c.next;
  let extras = "";
  if (stage === "body") extras = formControls();
  if (stage === "mouth")
    extras = mouthControls();
  if (stage === "faces")
    extras = '';
  if (stage === "inspect")
    extras = actionbar('수정하기',`<div class="edit-links">${button("edit-body", "몸체 수정", "shape", "secondary")}${button("edit-mouth", "입구 수정", "mouth", "secondary")}${button("edit-faces", "얼굴 수정", "carve", "secondary")}</div>`,'edit-actions');
  if (stage === "firing")
    extras = `<div class="firing-status"><strong id="firing-phase">${fired?"완성":fireStart?"준비":"굽기 체험"}</strong><p class="firing-note">준비 → 가열 → 냉각 → 완성 공개</p><span>${fired ? "내 토기가 완성되었어요" : fireStart ? "빛과 열이 토기를 감싸고 있어요" : "체험을 위해 짧게 보여주는 장면이에요"}</span><div class="meter"><i id="fire-progress" style="width:${fired ? 100 : 0}%"></i></div></div>`;
  if (stage === "excavation") {
    const progress = world.coverage();
    extras = `<div class="dig-status"><span id="dig-progress">토기 ${Math.round(progress[0] * 100)}% · 시루 ${Math.round(progress[1] * 100)}%</span>${button("assist", "함께 찾아보기", "brush", "small-button")}</div>`;
  }
  if (stage === "assembly")
    extras = `<div class="find-event"><strong>${save.assembledRevision===save.document.revision?'함께 놓았어요!':'흙 속에서 만난 두 유물'}</strong><p>토기를 끌거나 아래 버튼을 눌러 시루 위에 얹어 보세요.</p>${button("place", "시루에 얹기", "place", "secondary",save.assembledRevision===save.document.revision)}</div>`;
  if (stage === "ending")
    extras = button("new", "새 작품 만들기", "plus", "secondary");
  hud.innerHTML =
    header +
    `<div class="work-area" aria-hidden="true"></div><div class="scene-info"><section class="scene-heading"><p class="eyebrow">${c.eyebrow}</p><h1>${c.title}</h1><p>${c.instruction}</p></section>
    ${stage==='body' ? '<p class="background-hint">토기 밖을 끌면 돌아가요</p>' : ''}
    <div class="scene-extras">${extras}</div>
    <aside class="guide-bubble"><img class="guide-character" src="${characterImage(c.character)}" alt="${c.character}"><p>${c.speech.replaceAll("\n", "<br>")}</p></aside>
    ${["excavation", "assembly"].includes(stage) ? `<div class="context-label">${stage === "excavation" ? "상상 발굴 체험" : "함께 사용했을 가능성을 살펴보는 장면"}</div>` : ""}
    </div>${viewControls()}${stage === "body" ? '<div class="form-handles"><button data-form-handle="height" aria-label="높이 손잡이: 위아래로 끌기" title="위아래로 끌거나 방향키로 높이 조절">↕ <span>높이</span></button><button data-form-handle="width" aria-label="넓이 손잡이: 좌우로 끌기" title="좌우로 끌거나 방향키로 넓이 조절">↔ <span>넓이</span></button></div>' : ""}
    ${stage === "mouth" && save.document.mouth.opened ? '<div class="form-handles"><svg class="handle-guides" aria-hidden="true"><path/></svg><button data-form-handle="mouth-height" aria-label="입구 높이 손잡이: 위아래로 끌기" title="위아래로 끌거나 방향키로 입구 높이 조절">↕ <span>입구 높이</span></button><button data-form-handle="mouth-width" aria-label="입구 넓이 손잡이: 좌우로 끌기" title="좌우로 끌거나 방향키로 입구 넓이 조절">↔ <span>입구 넓이</span></button></div>' : ""}
    ${storyCard(stage)}
    <footer><div class="left-actions">${button("previous", "이전", "previous", "round icon-only")}${isEdit ? button("undo", "되돌리기", "undo", "round icon-only", !history.undoStack.length) + button("redo", "다시 실행", "redo", "round icon-only", !history.redoStack.length) : button("home", "처음 화면", "home", "round icon-only")}</div>
    ${stage==='faces'?actionbar('그리기 도구',`<div class="tools" role="toolbar" aria-label="작업 도구">${c.tools.map((t) => `<button data-tool="${t}" class="tool ${tool === t ? "selected" : ""}" aria-pressed="${tool === t}" aria-label="${toolLabels[t]}">${icon(t)}<span>${t==='refine'?'구멍 다듬기':toolLabels[t]}</span></button>`).join("")}</div>${toolGuide(tool,carveMode)}`,'drawing-actions'):''}
    ${button("next", primaryLabel, stage === "ending" ? "photo" : "next", "primary next-button")}</footer>`;
  arrangeHUD();
  if(stage==='firing')hud.querySelector('.firing-status')?.insertAdjacentHTML('beforeend',`<button data-action="kiln-inside" class="small-button" aria-pressed="${world.kilnCutaway}">${world.kilnCutaway?'외부로 보기':'내부 보기'}</button><small class="kiln-note">당시 가마 자료를 참고한 장면 · 내부는 설명용 단면</small>`);
  if(stage==='excavation')hud.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled=!digComplete;
  if(stage==='assembly')hud.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled=save.assembledRevision!==save.document.revision;
  layoutUI();
}
function arrangeHUD() {
  const extras=hud.querySelector<HTMLElement>('.scene-extras')!;
  extras.classList.add('settings-dock');
  extras.setAttribute('aria-label','작업 설정');
  hud.append(extras);
  const coach=hud.querySelector<HTMLElement>('.tool-coach');
  if(coach&&!coach.closest('.actionbar')){coach.classList.add('lesson-dock');hud.append(coach);}
  const bubble=hud.querySelector<HTMLElement>('.guide-bubble');
  if(bubble){bubble.classList.add('character-dock');hud.append(bubble);}
  for(const duplicate of extras.querySelectorAll('#tool-instruction'))duplicate.removeAttribute('id');
}
function modal(html: string) {
  cancelGesture();
  photoEditor?.dispose();photoEditor=null;world.paused = true;
  fireLast = performance.now();
  dialog.innerHTML = `${button("close", "닫기", "close", "round icon-only modal-close")}${html}`;
  if(!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLElement>("button")?.focus();
}
function closeModal() {
  photoEditor?.dispose();photoEditor=null;
  dialog.close();
  syncPause();
  fireLast = performance.now();
  world.refresh();
  world.renderer.domElement.focus({ preventScroll: true });
}
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
let storyPage=0,storyPhoto='',storyScene:SceneId='welcome';
function showStory(page=0,photoId=photoFor(stage).id,target:SceneId=stage) {
  storyScene=target;
  const entry=museum.stages[target],photo=museum.photos.find(p=>p.id===photoId)??photoFor(target);
  const pages=entry.blocks.flatMap(block=>{
    const chunks=block.text.match(/[\s\S]{1,360}/g)??[''];
    return chunks.map(text=>({...block,text}));
  });
  storyPage=clamp(page,0,pages.length-1);storyPhoto=photo.id;
  const block=pages[storyPage];
  modal(`<div class="story-layout"><div class="story-photo"><img src="${museumAsset(photo.file)}" alt="${e(photo.alt)}"><p>${e(photo.caption)}</p><p>${e(photo.credit)}</p><div class="photo-picker">${museum.photos.map((p,i)=>`<button data-action="story-photo-${i}" aria-pressed="${photo.id===p.id}">사진 ${i+1}</button>`).join('')}</div></div><div class="story-copy"><p class="eyebrow">실제 유물에서 찾아보기</p><h2>${e(entry.title)}</h2><section><span class="fact-badge ${block.kind}">${factLabels[block.kind]}</span><p>${e(block.text)}</p></section><nav class="story-pages"><button data-action="story-previous" ${storyPage===0?'disabled':''}>이전 이야기</button><span>${storyPage+1} / ${pages.length}</span><button data-action="story-next" ${storyPage===pages.length-1?'disabled':''}>다음 이야기</button></nav>${photo.source?`<a href="${e(photo.source)}" target="_blank" rel="noopener">자료 출처 보기 ↗</a>`:''}</div></div>`);
}
function go(next: SceneId) {
  cancelGesture();
  cancelAnimationFrame(fireTimer);
  fireTimer=0;
  audio.firing(0);
  fireStart = 0;
  stage = next;
  tool = next==='body'?'shape':next==='excavation'?'brush':next==='assembly'?'place':scenes[next].tools[0] ?? "rotate";
  audio.excavation = next === "excavation";
  world.setStage(next);
  digComplete=next==='excavation'&&world.coverage().length===2&&world.coverage().every(n=>n>=.7);
  updateUI();
  if (next !== "welcome") void persist();
}
async function travelTo(next:SceneId,label:string){
  if(travelling)return;travelling=true;cancelGesture();closeActions();
  const overlay=document.querySelector<HTMLElement>('#travel')!;
  overlay.querySelector('h2')!.textContent=label;overlay.hidden=false;
  await new Promise<void>(resolve=>{let elapsed=0,last=performance.now();const tick=(now:number)=>{if(!portrait.matches&&!document.hidden)elapsed+=now-last;last=now;if(elapsed>=(world.reduced?450:1600))resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
  go(next);overlay.hidden=true;travelling=false;
}
function checkDiscovery(){
  if(stage!=='excavation'||digComplete||world.coverage().some(n=>n<.7))return;
  digComplete=true;audio.effect('success');toast('찾았어요! 같은 현장에서 시루 위에 함께 놓아 볼까요?');
  updateUI();setTimeout(()=>{if(stage==='excavation'&&digComplete&&!gesture)go('assembly');},900);
}
function record(before: ReturnType<typeof cloneDoc>) {
  history.push(before, stage);
  changed(save);
  world.update();
  world.react();
  updateUI();
  void persist();
}
function openMouth() {
  if (save.document.mouth.opened) return;
  const before = cloneDoc(save.document);
  save.document.mouth.opened = true;
  record(before);
  audio.effect("hole");
  toast("열린 입구 형태를 적용했어요. 넓이와 테두리를 다듬어 보세요.");
}
function fireDone() {
  world.setFiringProgress(null);
  cancelAnimationFrame(fireTimer);
  fireTimer=0;
  audio.firing(0);
  fireStart = 0;
  save.firedRevision = save.document.revision;
  world.pottery.appearance(1);
  world.refresh();
  audio.effect("success");
  updateUI();
  void persist();
}
function startFire() {
  if (fireStart) {
    fireDone();
    return;
  }
  fireStart = performance.now();
  updateUI();
  fireElapsed=0;fireLast=performance.now();
  const duration=world.reduced?4000:14000;
  const tick=(now:number)=>{
    const delta=Math.max(0,now-fireLast);fireLast=now;
    if(!world.paused&&!document.hidden){
      fireElapsed+=delta;
      const t=clamp(fireElapsed/duration,0,1),frame=firingFrame(t);
      world.setFiringProgress(t);audio.firing(frame.heat);
      const meter=document.querySelector<HTMLElement>('#fire-progress');
      if(meter)meter.style.width=`${t*100}%`;
      const label=document.querySelector('#firing-phase');
      if(label)label.textContent=frame.phase;
      document.body.dataset.firePhase=frame.phase;
      if(t>=1){fireDone();return;}
    }else audio.firing(0);
    fireTimer=requestAnimationFrame(tick);
  };
  fireTimer=requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{
  fireLast=performance.now();
  if(document.hidden)audio.firing(0);
});
function place() {
  save.assembledRevision = save.document.revision;
  world.setStage("assembly");
  audio.effect("success");
  toast("함께 놓아 보았어요! 실제 사용법은 아직 연구 중이에요.");
  updateUI();
  void persist();
}
async function next() {
  if(travelling||portrait.matches)return;
  if(returnToInspect&&['body','mouth','faces'].includes(stage)){returnToInspect=false;go('inspect');return;}
  if (stage === "mouth" && !save.document.mouth.opened) {
    toast("‘열린 입구로 바꾸기’를 눌러 이어서 다듬어 보세요.");
    return;
  }
  if (stage === "firing" && save.firedRevision !== save.document.revision) {
    startFire();
    return;
  }
  if (stage === "excavation" && world.coverage().some((n) => n < 0.7)) {
    toast("토기와 시루가 조금 더 보이도록 흙을 걷어 볼까요?");
    return;
  }
  if (
    stage === "assembly" &&
    save.assembledRevision !== save.document.revision
  ) {
    toast("토기를 끌어 놓거나 시루에 얹기 버튼을 눌러 보세요.");
    return;
  }
  if (stage === "ending"||stage==='compare') {
    try {
      if (photoURL) URL.revokeObjectURL(photoURL);
      const blob = await world.capturePhoto();
      photoURL = URL.createObjectURL(blob);
      modal('<div id="photo-editor-root"></div>');
      photoEditor=new PhotoEditor(dialog.querySelector('#photo-editor-root')!,photoURL);
    } catch {
      toast("사진을 만들지 못했어요. 다시 시도해 주세요.");
    }
    return;
  }
  if(stage==='inspect'){await travelTo('firing','가마로 이동하고 있어요');return;}
  if(stage==='assembly'){await travelTo('compare','박물관으로 이동하고 있어요');return;}
  audio.effect("success");
  go(order[order.indexOf(stage) + 1]);
}
document.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-action],button[data-tool]",
  );
  if (!el || !loaded||travelling||portrait.matches) return;
  e.preventDefault();
  if (el instanceof HTMLButtonElement && el.disabled) return;
  audio.start();
  audio.effect("tap");
  if (el.dataset.tool) {
    cancelGesture();
    tool = el.dataset.tool as ToolId;
    updateUI();
    return;
  }
  const a = el.dataset.action!;
  if(a==='kiln-inside'){world.toggleKiln();el.setAttribute('aria-pressed',String(world.kilnCutaway));el.textContent=world.kilnCutaway?'외부로 보기':'내부 보기';return;}
  if(a==='settings'){
    const opened=hud.classList.toggle('settings-open');el.setAttribute('aria-expanded',String(opened));return;
  }
  if(a==='story-next'||a==='story-previous'){showStory(storyPage+(a==='story-next'?1:-1),storyPhoto,storyScene);return;}
  if(a.startsWith('story-photo-')){showStory(storyPage,museum.photos[Number(a.slice(12))]?.id,storyScene);return;}
  if (a === "draw-opening" || a === "draw-line") {
    cancelGesture();
    carveMode = a === "draw-line" ? "line" : "opening";
    tool = "carve";
    updateUI();
    return;
  }
  if (a.startsWith("view-") || a.startsWith("zoom-")) {
    cancelGesture();
    if (a.startsWith("view-")) world.setView(a.slice(5) as ViewPreset);
    else world.zoomBy(a === "zoom-in" ? 1.1 : 1 / 1.1);
    syncViewControls();
    closeActions();
    return;
  }
  if (a === "close" || a === "retake") {
    closeModal();
    return;
  }
  if (a === "story") {
    showStory();
    return;
  }
  if (a === "sound") {
    audio.toggle();
    updateUI();
    return;
  }
  if (a === "help") {
    modal(
      `<div class="help-copy"><p class="eyebrow">천천히, 마음 가는 대로</p><h2>이렇게 해보세요</h2><p>${scenes[stage].instruction}</p><ul><li>손으로 빚기: 몸체를 좌우로 끌면 잡은 높이 주변이 둥글게 달라져요.</li><li>높이·넓이 손잡이와 조절 막대로 크기를 바꿔요. 매끈하게 정리로 굴곡을 부드럽게 만들 수 있어요.</li><li>눈·입 그리기와 옆 구멍: 원하는 윤곽을 직접 그려 닫아요. 작은 손떨림과 끝의 작은 틈만 보정해요. ‘선’은 입이나 눈썹을 얇게 새겨요.</li><li>돌려 보기: 좌우로 회전하고 위아래로 보는 높이를 바꿔요. 마우스 오른쪽 끌기도 사용할 수 있어요.</li><li>위의 방향 버튼과 ＋/−로 시점을 바꿔요. 마우스 휠도 사용할 수 있어요.</li><li>되돌리기 또는 Ctrl / ⌘ + Z로 복구해요.</li></ul><label class="motion-setting"><input id="reduce-motion" type="checkbox" ${world.reduced ? "checked" : ""}> 움직임 줄이기</label></div>`,
    );
    return;
  }
  if (a === "new") {
    if (saved || stage !== "welcome") {
      modal(
        `<div class="confirm-copy"><h2>새로운 이야기를 시작할까요?</h2><p>이 기기의 현재 작품이 새 작품으로 바뀌어요.<br>사진을 남기려면 먼저 완성품 화면에서 저장해 주세요.</p>${button("confirm-new", "새 작품 만들기", "plus", "primary")}${button("close", "계속 만들기", "previous", "secondary")}</div>`,
      );
      return;
    }
    aNew();
    return;
  }
  if (a === "confirm-new") {
    closeModal();
    aNew();
    return;
  }
  if (a === "continue" && saved) {
    save = structuredClone(saved);
    world.update();
    go(save.stage);
    return;
  }
  if (a === "home") {
    go("welcome");
    return;
  }
  if (a === "previous") {
    go(order[Math.max(0, order.indexOf(stage) - 1)]);
    return;
  }
  if (a === "next") {
    await next();
    return;
  }
  if (a === "undo" || a === "redo") {
    cancelGesture();
    const entry =
      a === "undo"
        ? history.undo(save.document, stage)
        : history.redo(save.document, stage);
    if (entry) {
      save.document = entry.doc;
      changed(save);
      world.update();
      if (entry.stage === stage) {
        // Comparing a refinement must not switch back to carving or reset zoom.
        updateUI();
        void persist();
      } else go(entry.stage);
    }
    return;
  }
  if (a.startsWith("form-") || a === "smooth-form") {
    cancelGesture();
    const before = cloneDoc(save.document);
    if (a === "smooth-form") smoothForm(save.document);
    else applyForm(save.document, forms[a.slice(5) as FormId]);
    record(before);
    audio.effect("clay");
    toast(
      a === "smooth-form"
        ? "굴곡을 부드럽게 정리했어요. 되돌리기로 원래 모양을 볼 수 있어요."
        : "이 모양에서 자유롭게 빚어 보세요.",
    );
    return;
  }
  if (a === "open-mouth") {
    openMouth();
    return;
  }
  if (a.startsWith("edit-")) {
    returnToInspect=true;
    go(a.slice(5) as SceneId);
    return;
  }
  if (a === "next-face") {
    cancelGesture();
    save.rotation += (Math.PI * 2) / 3;
    world.pottery.root.rotation.y = save.rotation;
    world.refresh(true);
    void persist();
    return;
  }
  if (a === "assist") {
    world.assistBrush();
    updateUI();
    void persist();
    checkDiscovery();
    return;
  }
  if (a === "place") {
    place();
    return;
  }
});
document.addEventListener("change", (e) => {
  if ((e.target as HTMLElement).id === "reduce-motion") {
    world.reduced = (e.target as HTMLInputElement).checked;
    localStorage.setItem("togi-reduced", String(world.reduced));
    document.body.classList.toggle("reduced-motion", world.reduced);
    world.refresh();
  }
});
function aNew() {
  returnToInspect=false;
  save = newSave();
  history.undoStack = [];
  history.redoStack = [];
  world.update();
  go("body");
}

function projectedCentreX() {
  const p = new T.Vector3(0, readForm(save.document).height / 2, 0)
    .applyMatrix4(world.pottery.root.matrixWorld)
    .project(world.camera);
  return ((p.x + 1) * innerWidth) / 2;
}
function screenUnits() {
  const center = new T.Vector3(
    0,
    readForm(save.document).height / 2,
    0,
  ).applyMatrix4(world.pottery.root.matrixWorld);
  return (
    (2 *
      world.camera.position.distanceTo(center) *
      Math.tan(T.MathUtils.degToRad(world.camera.fov / 2))) /
    innerHeight
  );
}
type FormKey = "height" | "width" | "mouth-width" | "mouth-height";
function formValue(key: FormKey) {
  if (key === "mouth-width") return save.document.mouth.innerRadius;
  if (key === "mouth-height") return save.document.mouth.neckHeight;
  return readForm(save.document)[key];
}
function canEditForm(key: FormKey) {
  return key.startsWith("mouth-")
    ? stage === "mouth" && save.document.mouth.opened
    : stage === "body";
}
let formEdit: {
  before: ReturnType<typeof cloneDoc>;
  form: SoftForm;
  key: FormKey;
  x: number;
  y: number;
  units: number;
  value: number;
  pointer?: number;
  moved: boolean;
} | null = null;
let formFrame = 0, pendingFormValue: number | null = null;
function beginFormEdit(key: FormKey, x = 0, y = 0, pointer?: number) {
  cancelGesture();
  formEdit = {
    before: cloneDoc(save.document),
    form: readForm(save.document),
    key,
    x,
    y,
    units: screenUnits(),
    value: formValue(key),
    pointer,
    moved: false,
  };
}
function previewFormValue(value: number) {
  pendingFormValue = value;
  if (!formFrame) formFrame = requestAnimationFrame(flushFormValue);
}
function flushFormValue() {
  cancelAnimationFrame(formFrame);
  formFrame = 0;
  const edit = formEdit, value = pendingFormValue;
  pendingFormValue = null;
  if (!edit || value === null) return;
  if (edit.key === "height" || edit.key === "width") {
    applyForm(save.document, { ...edit.form, [edit.key]: value });
  } else {
    // Legacy meshes use a relative edit. Rebase each preview so pointer-event
    // frequency cannot accumulate drift or convert the saved body to a new form.
    if (!edit.before.form) save.document = cloneDoc(edit.before);
    const mouth = edit.before.mouth;
    (edit.before.form ? adjustMouth : setMouth)(
      save.document,
      edit.key === "mouth-width" ? value : mouth.innerRadius,
      edit.key === "mouth-height" ? value : mouth.neckHeight,
    );
  }
  edit.moved = Math.abs(formValue(edit.key) - edit.value) > 1e-7;
  world.update(false);
  syncFormValues();
}
function syncFormValues() {
  for (const key of ["height", "width", "mouth-width", "mouth-height"] as const) {
    const value = formValue(key), body = !key.startsWith("mouth-");
    const input = hud.querySelector<HTMLInputElement>(
      `[data-form-range="${key}"]`,
    );
    if (input) input.value = String(body ? Math.round(value * 100) : value);
    const output = hud.querySelector(`#${key}-value`);
    if (output) output.textContent = `${Math.round(value * 100)}%`;
  }
}
function finishFormEdit() {
  flushFormValue();
  const edit = formEdit;
  formEdit = null;
  if (edit?.moved) {
    record(edit.before);
    audio.effect("clay");
  } else if (edit) {
    save.document = edit.before;
    world.update(false);
    syncFormValues();
  }
  hud.querySelector<HTMLElement>(".form-handles .dragging")?.classList.remove("dragging");
}
document.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement,
    key = el.dataset.formRange as FormKey | undefined;
  if (!key || !canEditForm(key)) return;
  if (!formEdit) beginFormEdit(key);
  previewFormValue(Number(el.value) / (key.startsWith("mouth-") ? 1 : 100));
});
document.addEventListener("change", (e) => {
  const key = (e.target as HTMLElement).dataset.formRange;
  if (!key) return;
  finishFormEdit();
  hud
    .querySelector<HTMLElement>(`[data-form-range="${key}"]`)
    ?.focus({ preventScroll: true });
});
document.addEventListener("pointerdown", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-form-handle]",
  );
  if (!el || !loaded || dialog.open || formEdit || gesture || e.button !== 0 ||
      !canEditForm(el.dataset.formHandle as FormKey) || world.transitioning) return;
  e.preventDefault();
  beginFormEdit(
    el.dataset.formHandle as FormKey,
    e.clientX,
    e.clientY,
    e.pointerId,
  );
  el.setPointerCapture(e.pointerId);
  el.focus({ preventScroll: true });
  el.classList.add("dragging");
});
document.addEventListener("pointermove", (e) => {
  const edit = formEdit;
  if (!edit || edit.pointer !== e.pointerId) return;
  const delta =
    edit.key === "height"
      ? (edit.y - e.clientY) * edit.units
      : edit.key === "width"
        ? ((e.clientX - edit.x) * edit.units) / Math.max(...edit.form.radii)
        : edit.key === "mouth-width"
          ? (e.clientX - edit.x) * edit.units
          : (edit.y - e.clientY) * 0.0005;
  if (edit.moved || pendingFormValue !== null || Math.hypot(e.clientX - edit.x, e.clientY - edit.y) >= 2)
    previewFormValue(edit.value + delta);
});
document.addEventListener("pointerup", (e) => {
  if (formEdit?.pointer === e.pointerId) {
    const key = formEdit.key;
    finishFormEdit();
    hud.querySelector<HTMLElement>(`[data-form-handle="${key}"]`)?.focus({ preventScroll: true });
  }
});
document.addEventListener("lostpointercapture", (e) => {
  if (formEdit?.pointer === e.pointerId) {
    cancelGesture();
    updateUI();
  }
});
document.addEventListener("pointercancel", () => {
  if (formEdit) {
    cancelGesture();
    updateUI();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (gesture || formEdit)) {
    cancelGesture();
    updateUI();
    return;
  }
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-form-handle]",
  );
  if (
    !el ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  e.preventDefault();
  const key = el.dataset.formHandle as FormKey;
  if (!canEditForm(key) || dialog.open || world.transitioning) return;
  beginFormEdit(key);
  previewFormValue(
    formEdit!.value +
      (["ArrowUp", "ArrowRight"].includes(e.key) ? 1 : -1) *
      (key === "mouth-height" ? 0.002 : key === "mouth-width" ? 0.005 : 0.025),
  );
  finishFormEdit();
  hud
    .querySelector<HTMLElement>(`[data-form-handle="${key}"]`)
    ?.focus({ preventScroll: true });
});

interface Gesture {
  pointer: number;
  kind: ToolId;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  uv: UV;
  before: ReturnType<typeof cloneDoc>;
  samples: StrokePoint[];
  screen: ScreenPoint[];
  moved: boolean;
  travel: number;
  form?: SoftForm;
  side: number;
  units: number;
}
let gesture: Gesture | null = null,
  pending: PointerEvent[] = [],
  raf = 0;
function clearOpening() {
  openingOutline.style.display = "none";
  for (const p of openingOutline.querySelectorAll("path")) p.removeAttribute("d");
}
function drawOutline(points: ScreenPoint[], state: "drawing" | "ready" | "outside", closed: boolean) {
  const area = hud.querySelector<HTMLElement>(".work-area")!.getBoundingClientRect();
  openingOutline.style.clipPath = `inset(${area.top}px ${Math.max(0, innerWidth - area.right)}px ${Math.max(0, innerHeight - area.bottom)}px ${area.left}px)`;
  openingOutline.style.display = "block";
  openingOutline.dataset.state = state;
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + (closed ? " Z" : "");
  for (const p of openingOutline.querySelectorAll("path")) p.setAttribute("d", path);
}
function projectOutline(points: UV[]): ScreenPoint[] {
  const rect = world.renderer.domElement.getBoundingClientRect();
  return points.map(uv => {
    const p = world.pottery.root.localToWorld(surfacePoint(save.document, ...uv)).project(world.camera);
    return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
  });
}
function locateOpening(screen: ScreenPoint[]) {
  world.scene.updateMatrixWorld(true);
  return placeOpening(screen, (x, y) => world.openingHit(x, y), screenUnits());
}
function showOpening(placement: OpeningPlacement) {
  const points = placement.samples
    ? projectOutline(finishStroke(placement.samples, true))
    : placement.outline;
  drawOutline(points, placement.samples ? "ready" : "outside", true);
}
function commitFeature(points: UV[], kind: "hole" | "raised-hole" | "groove", width: number, before: ReturnType<typeof cloneDoc>) {
  const feature={id:uid(),kind,points,width};
  if(crossToolOverlap(save.document,feature)){toast('눈·입과 옆 구멍이 겹치는 부분이 있어요. 빈 흙 위에 그려 주세요.');return false;}
  const issue = addSurfaceFeature(save.document, feature);
  if (issue) {
    toast({
      boundary: "입구 테두리나 바닥 안쪽의 흙에 그려 주세요.",
      "too-small": "윤곽을 조금 더 크게 그려 주세요.",
      complex: "표현이 너무 복잡해 처리하지 못했어요. 조금 짧게 나눠 그려 주세요.",
    }[issue]);
    return false;
  }
  record(before);
  audio.effect("hole");
  return true;
}
function cancelGesture() {
  cancelAnimationFrame(raf);
  raf = 0;
  pending = [];
  cancelAnimationFrame(formFrame);
  formFrame = 0;
  pendingFormValue = null;
  hud.querySelector<HTMLElement>(".form-handles .dragging")?.classList.remove("dragging");
  world?.endBrush();
  if (formEdit) {
    save.document = formEdit.before;
    formEdit = null;
    world.update(false);
    syncFormValues();
  }
  if (gesture?.kind === "shape") {
    save.document = gesture.before;
    world.update(false);
  }
  if (gesture?.kind === "place") world.setStage(stage, true);
  gesture = null;
  world?.previewStroke([]);
  clearOpening();
}
function sample(e: PointerEvent) {
  const g = gesture;
  if (!g) return;
  const dx = e.clientX - g.lastX,
    dy = e.clientY - g.lastY;
  g.travel += Math.hypot(dx, dy);
  if (g.kind === "rotate") {
    save.rotation += dx * 0.008;
    world.pottery.root.rotation.y = save.rotation;
    if (Math.abs(dy) > 0) world.tilt(dy * 0.25);
    world.refresh(true);
    syncViewControls();
    g.moved = true;
  } else if (g.kind === "shape") {
    if (g.travel >= 3) {
      applyForm(
        save.document,
        shapeForm(
          g.form!,
          g.uv[1],
          (e.clientX - g.startX) * g.side * g.units * 0.75,
        ),
      );
      world.update(false);
      g.moved = true;
    }
  } else if (g.kind === "brush") {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5));
    for (let i = 1; i <= steps; i++)
      if (world.brushAt(g.lastX + (dx * i) / steps, g.lastY + (dy * i) / steps))
        g.moved = true;
  } else if (g.kind === "place") {
    const p = world.groundHit(e.clientX, e.clientY, world.assemblyHeight);
    if (p) {
      world.pottery.root.position.set(
        clamp(p.x, -1, 1),
        world.assemblyHeight+.04,
        clamp(p.z, -0.4, 0.4),
      );
      world.refresh(true);
      g.moved = true;
    }
  } else if (g.kind === "carve" || g.kind === "pierce") {
    // Collect every hardware sample, including subpixel moves. Fill long
    // screen-space gaps before raycasting. Use the continuous clay surface so
    // crossing an existing opening does not discard the whole drawing.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 1.5));
    for (let i = 1; i <= steps; i++) {
      const x = g.lastX + (dx * i) / steps,
        y = g.lastY + (dy * i) / steps;
      const lastScreen = g.screen.at(-1)!;
      if (Math.hypot(x - lastScreen.x, y - lastScreen.y) >= 0.3)
        g.screen.push({ x, y });
      if (g.kind === "pierce" || carveMode === "opening") continue;
      const prev = g.samples.at(-1)!;
      if (Math.hypot(x - prev.x, y - prev.y) < 0.3) continue;
      const hit = world.hit(x, y, true);
      if (!hit?.uv) {
        // Keep the portion already drawn when the pointer briefly leaves clay.
        continue;
      }
      let u = hit.uv.x;
      while (u - prev.uv[0] > 0.5) u--;
      while (u - prev.uv[0] < -0.5) u++;
      if (
        Math.abs(hit.uv.y - prev.uv[1]) > 0.15 ||
        Math.abs(u - prev.uv[0]) > 0.15
      ) {
        continue;
      }
      g.samples.push({ x, y, uv: [u, hit.uv.y] });
      g.moved = true;
    }
  }
  g.lastX = e.clientX;
  g.lastY = e.clientY;
}
function flushPointer() {
  const events = pending;
  pending = [];
  const exact = gesture && ["carve", "pierce", "brush"].includes(gesture.kind);
  for (const e of exact ? events : events.slice(-1)) sample(e);
  if (gesture && ["carve", "pierce"].includes(gesture.kind)) {
    const opening = gesture.kind === "pierce" || carveMode === "opening";
    if (opening) {
      const closed = strokeIntent(gesture.screen).closed;
      if (closed) showOpening(locateOpening(gesture.screen));
      else drawOutline(gesture.screen, "drawing", false);
    } else world.previewStroke(finishStroke(gesture.samples));
  }
  if (gesture?.kind === "brush") {
    const cov = world.coverage(),
      label = document.querySelector("#dig-progress");
    if (label)
      label.textContent = `토기 ${Math.round(cov[0] * 100)}% · 시루 ${Math.round(cov[1] * 100)}%`;
  }
}
function bindPointer() {
  const canvas = world.renderer.domElement;
  canvas.addEventListener("pointerleave", () => world.hideBrush());
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!loaded || dialog.open || gesture || formEdit || stage === "welcome") return;
      e.preventDefault();
      world.zoomBy(Math.exp(-clamp(e.deltaY, -100, 100) * 0.002));
    },
    { passive: false },
  );
  canvas.addEventListener("pointerdown", (e) => {
    if (
      !loaded ||
      dialog.open ||world.paused||travelling||
      world.transitioning ||
      gesture ||
      formEdit ||
      stage === "welcome" ||
      stage === "firing"
    )
      return;
    audio.start();
    let kind:ToolId = e.button === 2 ? "rotate" : tool;
    const
      hit = world.hit(
        e.clientX,
        e.clientY,
        ["erase", "refine", "carve", "pierce"].includes(kind),
        kind === "shape",
      );
    if(!hit&&['body','mouth','faces','inspect','compare','ending'].includes(stage))kind='rotate';
    if (!hit && kind !== "rotate" && kind !== "brush") return;
    if ((kind === "erase" || kind === "refine") && hit?.uv) {
      const before = cloneDoc(save.document),
        f = nearestFeature(
          save.document,
          [hit.uv.x, hit.uv.y],
          Math.max(0.018, screenUnits() * 18),
        );
      if (f) {
        if (kind === "erase")
          save.document.features = save.document.features.filter(
            (x) => x !== f,
          );
        else if (refineFeature(save.document, f)) {
          toast(
            "이 부분은 더 다듬기 어려워요. 되돌리기로 이전 모양을 고를 수 있어요.",
          );
          return;
        }
        record(before);
        audio.effect("clay");
        if (kind === "refine")
          toast("작은 삐침을 다듬었어요. 한 번 더 누르면 더 부드러워져요.");
      } else if (kind === "refine") {
        toast("다듬고 싶은 구멍이나 선을 톡 눌러 주세요.");
      }
      return;
    }
    if (kind === "carve" || kind === "pierce") toastElement.classList.remove("visible");
    const uv: UV = [hit?.uv?.x ?? 0, hit?.uv?.y ?? 0.5];
    gesture = {
      pointer: e.pointerId,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      uv,
      before: cloneDoc(save.document),
      samples: [{ x: e.clientX, y: e.clientY, uv }],
      screen: [{ x: e.clientX, y: e.clientY }],
      moved: false,
      travel: 0,
      form: kind === "shape" ? readForm(save.document) : undefined,
      side: e.clientX < projectedCentreX() ? -1 : 1,
      units: screenUnits(),
    };
    canvas.setPointerCapture(e.pointerId);
    if (kind === "brush") {
      world.beginBrush();
      sample(e);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (stage === "excavation") world.moveBrush(e.clientX, e.clientY);
    if (!gesture || e.pointerId !== gesture.pointer) return;
    const coalesced = e.getCoalescedEvents?.() ?? [];
    pending.push(...(coalesced.length ? coalesced : [e]));
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        flushPointer();
      });
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!gesture || e.pointerId !== gesture.pointer) return;
    cancelAnimationFrame(raf);
    raf = 0;
    flushPointer();
    sample(e);
    world.endBrush();
    const g = gesture;
    if (!g) return;
    gesture = null;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (g.kind === "shape") {
      if (g.moved) {
        record(g.before);
        audio.effect("clay");
      }
    } else if (g.kind === "carve" || g.kind === "pierce") {
      world.previewStroke([]);
      const opening = g.kind === "pierce" || carveMode === "opening";
      clearOpening();
      const { tap, closed } = strokeIntent(
        opening ? g.screen : g.samples,
      );
      if (opening && !tap && !closed) {
        toast(
          "원하는 윤곽을 그려 시작점 근처에서 닫아 주세요. 선은 ‘선’으로 바꿔 새길 수 있어요.",
        );
        return;
      }
      if (!opening && tap) return;
      const width = clamp(g.units * 3.6 / readForm(save.document).height, 0.0025, 0.014);
      if (opening) {
        // A click stamps a small opening. A drawn contour keeps its own shape.
        const screen = tap ? Array.from({ length: 49 }, (_, i) => ({
          x: g.startX + Math.cos(i * Math.PI / 24) * 14,
          y: g.startY + Math.sin(i * Math.PI / 24) * 14,
        })) : g.screen;
        const placement = locateOpening(screen);
        if (!placement.samples) {
          toast("선이 토기 가장자리를 벗어났어요. 보이는 흙 안쪽에 다시 그려 주세요.");
          return;
        }
        commitFeature(finishStroke(placement.samples, true),
          g.kind === "pierce" ? "raised-hole" : "hole", width, g.before);
      } else {
        const points = finishStroke(g.samples);
        if (points.length >= 2) commitFeature(points, "groove", width, g.before);
      }
    } else if (g.kind === "place") {
      if (
        Math.abs(world.pottery.root.position.x) < 0.25 &&
        Math.abs(world.pottery.root.position.z) < 0.3
      )
        place();
      else {
        world.setStage("assembly");
        toast("시루 위에 가까이 놓아 보세요.");
      }
    } else {void persist();if(g.kind==='brush')checkDiscovery();}
  });
  canvas.addEventListener("pointercancel", cancelGesture);
  canvas.addEventListener("lostpointercapture", () => {
    if (gesture) cancelGesture();
  });
  window.addEventListener("blur", cancelGesture);
  window.addEventListener("resize", cancelGesture);
  canvas.addEventListener("keydown", (e) => {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "=",
      ].includes(e.key)
    ) {
      e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        save.rotation += e.key === "ArrowLeft" ? -0.15 : 0.15;
        world.pottery.root.rotation.y = save.rotation;
        world.refresh(true);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown")
        world.tilt(e.key === "ArrowUp" ? 6 : -6);
      else world.zoomBy(e.key === "-" ? 1 / 1.1 : 1.1);
      syncViewControls();
      void persist();
    }
  });
}
document.addEventListener("keydown", (e) => {
  if (!loaded || dialog.open) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    document
      .querySelector<HTMLButtonElement>(
        `[data-action="${e.shiftKey ? "redo" : "undo"}"]`,
      )
      ?.click();
  }
});
async function boot() {
  try {
    world = new World(host, () => save);
    world.onRender = positionFormHandles;
    world.onExhibit=target=>showStory(0,photoFor(target).id,target);
    world.reduced =
      localStorage.getItem("togi-reduced") === "true" || world.reduced;
    document.body.classList.toggle("reduced-motion", world.reduced);
    try {
      saved = await repository.load();
    } catch {
      saved = await repository.recoverPrevious().catch(() => null);
      toast(
        saved
          ? "이전 정상 저장본을 찾았어요. 이어 만들기로 열 수 있어요."
          : "저장소를 열지 못했어요. 현재 화면에서 체험할 수 있어요.",
      );
    }
    await loadMuseum();
    await world.load();
    loaded = true;
    bindPointer();
    updateUI();
    document.querySelector<HTMLElement>('.travel-party')!.style.backgroundImage=`url("${asset('animations/party-travel.png')}")`;
    document.querySelector<HTMLImageElement>('.travel-vessel')!.src=asset('animations/face-pot.png');
    syncPause();
    void document.fonts.ready.then(layoutUI);
    document.querySelector("#loading")?.remove();
    host.addEventListener("render-lost", () =>
      toast("화면을 다시 연결하고 있어요. 마지막 작업은 보관되어 있어요."),
    );
    if (import.meta.env.DEV)
      (window as unknown as { togi: unknown }).togi = {
        get save() {
          return save;
        },
        get stage() {
          return stage;
        },
        world,
        go,
        get tool() {
          return tool;
        },
      };
  } catch (error) {
    console.error(error);
    document.querySelector("#loading")!.innerHTML =
      '<h2>작업실을 열지 못했어요</h2><p>브라우저의 3D 지원과 파일 연결을 확인해 주세요.</p><button onclick="location.reload()">다시 열기</button>';
  }
}
void boot();
