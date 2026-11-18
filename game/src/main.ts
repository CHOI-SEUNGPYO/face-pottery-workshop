import "./style.css";
import "./layout.css";
import "./museum-presentation.css";
import "./mobile-layout.css";
import "./interaction-guidance.css";
import "./welcome.css";
import {firingFrame} from './firing';
import {advanceFiring} from './firing-progress.mjs';
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
  stageTips,
  lineWidths,
  lineWidthLabels,
  type ToolId,
  type CarveMode,
} from "./content";
import { World } from "./world";
import { toolGuide } from "./tool-guide";
import {BodyGuide} from './body-guide';
import { finishStroke, strokeIntent, tapOpening, closeFingerLoop, type StrokePoint } from "./stroke";
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
import {downloadArtwork,readArtworkFile} from './artwork-file';
import {ExampleViewer} from './example-viewer';
import { AudioController } from "./audio";
import { icon } from "./icons";
import { characterImage } from "./assets";
import {initTravel,prepareTravelArt,playTravel} from './loading';
import {systemMotion,setReducedMotion,syncReducedMotion} from './motion';
import {PhotoEditor} from './photo-editor';
import {AI_CONTENT_LABEL,museumHomeLink,museumVisitMarkup} from './disclosure';
import { museum, loadMuseum, museumAsset, photoFor, storyCard, sourceLinks, escapeHTML as e, factLabels } from './museum';
import {partnerMarks,creditsMarkup,collectionMarkup,endingMarkup,photosIn,availableGroups} from './museum-presentation';
import type {PhotoCategory} from './museum';
import {kilnGuide} from './kiln-guide';
import {EXAMPLE_LABEL} from './artifact-example';

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML =
  '<div id="world"></div><div class="vignette"></div><svg id="opening-outline" aria-hidden="true"><path class="outline-halo"/><path class="outline-line"/></svg><main id="hud"></main><div id="toast" role="status" aria-live="polite"></div><dialog id="dialog"></dialog><div id="travel" hidden aria-live="polite"><div class="travel-party" role="img" aria-label="세 친구가 옆으로 눕힌 큰 얼굴모양토기를 함께 들고 달려요"><img class="travel-vessel" alt=""></div><h2></h2><p>경산이 · 독이 · 압이와 함께</p></div>';
const host = document.querySelector<HTMLDivElement>("#world")!,
  hud = document.querySelector<HTMLDivElement>("#hud")!,
  dialog = document.querySelector<HTMLDialogElement>("#dialog")!,
  toastElement = document.querySelector<HTMLDivElement>("#toast")!,
  openingOutline = document.querySelector<SVGElement>("#opening-outline")!;
initTravel();
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
  lineWidth = 3,
  fireStart = 0,
  fireTimer = 0,
  fireElapsed = 0,
  fireLast = 0,
  toastTimer = 0,
  loaded = false;
const history = new History(),
  repository = new SaveRepository(),
  audio = new AudioController();
let world: World;
let faceTourShown=false, rotationHint=true, refineNudge=false, outlineTimer=0, outlineDeadline=0;
let bodyGuide:BodyGuide|undefined,bodyGuideShown=false;
function stopBodyGuide(){bodyGuide?.stop();}
function startBodyGuide(){
  stopBodyGuide();bodyGuideShown=true;
  bodyGuide=new BodyGuide(world,save.document,hud,()=>{bodyGuide=undefined;syncFaceGuidance();});
  syncFaceGuidance();
}
for(const event of ['pointerdown','keydown','wheel'])document.addEventListener(event,stopBodyGuide,{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopBodyGuide();});
let outlineAnimation:Animation|undefined;
let refineTipUntil=0,refineTipTimer=0;
const loadingStarted=performance.now();
let photoEditor:PhotoEditor|null=null,returnToInspect=false,travelling=false,digComplete=false;
let exampleViewer:ExampleViewer|null=null,exampleRequest:AbortController|null=null;
function syncPause(){if(!world)return;world.paused=dialog.open;fireLast=performance.now();if(!world.paused)world.refresh();}
const portraitPhone=()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches;
const desktopTools=matchMedia('(min-width:1100px) and (min-height:600px) and (hover:hover) and (pointer:fine)');
const pinnedActions=(el:Element)=>(portraitPhone()||desktopTools.matches)&&el.matches('.drawing-actions,.edit-actions');
desktopTools.addEventListener('change',()=>layoutUI());
function closeActions(){hud.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>{if(!pinnedActions(d))d.open=false;});}
document.addEventListener('pointerdown',event=>{if(!(event.target as HTMLElement).closest('details.actionbar'))closeActions();});
document.addEventListener('toggle',event=>{
  const el=event.target;if(!(el instanceof HTMLDetailsElement)||!el.classList.contains('actionbar'))return;
  if(el.open)hud.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(d=>{if(d!==el&&!pinnedActions(d))d.open=false;});
  if(el.classList.contains('drawing-actions'))syncRefineTip();
},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeActions();});
function actionbar(label:string,content:string,classes:string){return `<details class="actionbar ${classes}"><summary>${icon(classes==='edit-actions'?'shape':'carve')}<span>${label}</span><span class="action-chevron">＋</span></summary><div class="action-panel">${content}</div></details>`;}
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
  for(const actions of hud.querySelectorAll<HTMLDetailsElement>('.drawing-actions,.edit-actions')){
    const pinned=pinnedActions(actions);
    if(pinned)actions.open=true;
    else if(actions.dataset.pinned==='true')actions.open=false;
    actions.dataset.pinned=String(pinned);
  }
  let left = 28,
    top = 140,
    right = w - 28,
    bottom = h - 150;
  if (stage === "welcome") {
    const copy = hud
      .querySelector<HTMLElement>(".welcome-copy")!
      .getBoundingClientRect();
    const portrait=w<=600&&h>w;
    left = portrait ? 28 : Math.max(copy.right + (compact?16:36), w * 0.51);
    top = portrait ? copy.bottom + 8 : compact?70:120;
    bottom = portrait ? (hud.querySelector<HTMLElement>(".welcome-start")?.getBoundingClientRect().top ?? h-64)-12 : h-64;
  } else {
    left = compact ? 170 : 256;
    right = compact ? w-156 : w-256;
    top = compact ? 62 : 90;
    bottom = compact ? h-72 : h-96;
    if(w<=600&&h>w){
      left=12;right=w-12;
      top=(hud.querySelector('.scene-info')?.getBoundingClientRect().bottom??130)+12;
      // Fit the artwork to the space actually left by the current tools, including
      // the browser's shorter viewport when its address bar is visible.
      const docks=[...hud.querySelectorAll<HTMLElement>('.settings-dock,.guide-stack,footer')]
        .filter(el=>el.getClientRects().length&&el.getBoundingClientRect().height>0);
      bottom=Math.min(...docks.map(el=>el.getBoundingClientRect().top))-12;
    }
  }
  area.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(120, right - left)}px;height:${Math.max(stage==='welcome'?48:120, bottom - top)}px`;
  world.reframe();
  positionFormHandles();
  syncRefineTip();
}
window.addEventListener("resize", () => requestAnimationFrame(layoutUI));
window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(layoutUI));
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
  const width=readForm(save.document).width;
  const min=save.document.form?width*.1-.035:.06,max=save.document.form?width*.5-.035:.13;
  return `<section class="mouth-controls" aria-label="입구 조절"><label>입구 넓이<input type="range" data-form-range="mouth-width" aria-label="입구 넓이" min="${Math.min(min,m.innerRadius)}" max="${Math.max(max,m.innerRadius)}" step="0.001" value="${m.innerRadius}"></label><label>테두리 높이<input type="range" data-form-range="mouth-height" aria-label="테두리 높이" min="0.02" max="0.06" step="0.001" value="${m.neckHeight}"></label></section>`;
}
function updateUI() {
  const sameStage = document.body.dataset.stage === stage;
  const menuWasOpen = sameStage && !!hud.querySelector('.actionbar[open]');
  const focused = sameStage && hud.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  const focusKey = focused?.dataset.tool ? 'data-tool' : focused?.dataset.action ? 'data-action' : null;
  const restoreFocus = () => {
    if (focusKey) hud.querySelector<HTMLElement>('[' + focusKey + '="' + focused!.getAttribute(focusKey) + '"]')?.focus({preventScroll:true});
  };
  const c = scenes[stage],
    n = order.indexOf(stage),
    isEdit = ["body", "mouth", "faces"].includes(stage),
    fired = save.firedRevision === save.document.revision;
  const drawingLabel=tool==='carve'?(carveMode==='opening'?'눈·입 뚫기':'선 새기기'):toolLabels[tool];
  const drawingInstruction = carveMode === 'opening'
    ? '톡 누르거나 모양을 그려 구멍을 뚫어 보세요.'
    : '선을 그어 눈썹이나 입을 새겨 보세요.';
  const instruction=stage==='faces'?(tool==='carve'?drawingInstruction:toolHelp[tool].instruction):stage==='assembly' && save.assembledRevision===save.document.revision ? '두 유물을 함께 놓았어요. 이제 전시실에서 비교해 보세요.' : stage==='excavation' && digComplete ? '토기와 시루를 모두 찾았어요. 두 유물을 함께 놓아 볼까요?' : c.instruction;
  document.body.dataset.stage = stage;
  host.dataset.tool = tool;
  world.renderer.domElement.setAttribute(
    "aria-description",
    instruction,
  );
  const header = `<header><a class="brand" href="#" data-action="home" aria-label="얼굴모양토기 작은 흙 공방 · ${AI_CONTENT_LABEL} · 처음 화면"><span class="brand-pot">${icon("mouth")}</span><span>얼굴모양토기<br><small class="ai-mark" title="${AI_CONTENT_LABEL}">AI 생성물 포함</small></span></a><nav aria-label="공통 메뉴">${
    stage !== "welcome"
      ? `<div class="journey" aria-label="${n} / 9 단계">${order
          .slice(1)
          .map(
            (s, i) =>
              `<span class="${i < n ? "done" : ""} ${s === stage ? "current" : ""}"></span>`,
          )
          .join("")}</div>`
      : ""
  }${stage==="welcome"?button("collection", "실제 유물 사진", "story", "story-button"):""}${button("sound", audio.muted ? "소리 켜기" : "소리 끄기", audio.muted ? "muted" : "sound", "round icon-only")}${button("help", "도움말", "help", "round icon-only")}</nav></header>`;
  if (stage === "welcome") {
    hud.innerHTML =
      header +
      `<div class="work-area" aria-hidden="true"></div><section class="welcome-copy">${partnerMarks(true)}<h1>세 얼굴을 가진 토기,<br><em>내 손으로 만들어 볼까?</em></h1><figure class="welcome-artifact"><button class="artifact-zoom" data-action="welcome-photo" aria-label="실제 유물의 세 얼굴 크게 보기"></button><img src="${museumAsset('face-three-sides.jpg')}" alt="하나의 실제 얼굴모양토기를 세 방향에서 본 사진. 서로 다른 표정이 새겨져 있어요."><figcaption>실제 유물의 세 얼굴 ⊕<small>문화재청 제공 · 경향신문 게재</small></figcaption></figure><p class="welcome-purpose">경산 소월리의 <strong>얼굴모양토기</strong>를 살펴보고,<br> 내가 빚은 몸체에 눈과 입을 만들어 보세요.</p><ol class="welcome-path" aria-label="체험 순서"><li>몸체 빚기</li><li>얼굴 만들기</li><li>유물과 비교</li></ol><p class="ai-notice">AI(인공지능) 활용 제작 · 실제 제작 과정과는 달라요.</p><div class="welcome-start"><div class="welcome-actions">${saved ? button('continue', saved.stage==='ending'?'완성작 다시 보기':'이어 만들기', 'play', 'primary large') + button('new','새 작품 만들기','plus','secondary') : button('new','얼굴모양토기 만들기','next','primary large')}</div><button data-action="example-artwork" class="welcome-example">${icon("rotate")}예시 작품 감상</button></div></section><nav class="welcome-foot" aria-label="박물관과 제작 안내">${museumHomeLink()}<button data-action="credits" class="credits-link">게임 소개·제작</button></nav>`;
    layoutUI();
    restoreFocus();
    return;
  }
  const primaryLabel =
    stage === "firing" && !fired
      ? fireStart
        ? "연출 건너뛰기"
        : "아궁이에 불 지피기"
      : returnToInspect&&isEdit ? '수정 마치고 확인하기' : c.next;
  let extras = "";
  if (stage === "body") extras = formControls();
  if (stage === "mouth")
    extras = mouthControls();
  if (stage === "faces")
    extras = '';
  if (stage === "inspect")
    extras = actionbar('수정하기',`<div class="edit-links">${button("edit-body", "몸체 수정", "shape", "secondary")}${button("edit-mouth", "입구 수정", "mouth", "secondary")}${button("edit-faces", "얼굴 수정", "carve", "secondary")}</div>`,'edit-actions');
  if (stage === "firing")
    extras = `<div class="firing-status"><strong id="firing-phase">${fired?"완성":fireStart?"준비":"불 지필 준비"}</strong><p class="firing-note" aria-label="준비, 굽기, 식히기, 완성">${['준비','굽기','식히기','완성'].map(label=>`<span>${label}</span>`).join('')}</p><span id="firing-action">${fired ? "가마 안에 놓인 내 토기를 살펴보세요." : fireStart ? "옆벽 너머에 내가 빚은 토기가 있어요." : "마른 토기가 가마 안에 놓였어요. 앞쪽 아궁이에 불을 지펴 보세요."}</span><div class="meter"><i id="fire-progress" style="width:${fired ? 100 : 0}%"></i></div></div>`;
  if (stage === "excavation") {
    const meters = ['토기','시루'].map(name => `<label><span>${name}<strong>0%</strong></span><progress max="100" value="0" aria-label="${name} 발견 진행률"></progress></label>`).join('');
    extras = `<div class="dig-status"><div id="dig-progress">${meters}</div>${digComplete ? '' : button("assist", "함께 찾아보기", "brush", "small-button")}</div>`;
  }
  if (stage === "assembly")
    extras = save.assembledRevision === save.document.revision ? '' : `<div class="find-event"><strong>흙 속에서 만난 두 유물</strong>${button("place", "시루에 얹기", "place", "secondary")}</div>`;
  if (stage === "ending")
    extras = `<div class="ending-links">${button("ending-credits", "유물 사진·마무리", "story", "secondary")}${button("photo", "사진 남기기", "photo", "secondary optional-photo")}</div>`;
  hud.innerHTML =
    header +
    `<div class="work-area" aria-hidden="true"></div><div class="scene-info"><section class="scene-heading"><p class="eyebrow"><span class="stage-count">${String(n).padStart(2, "0")} / ${order.length-1}</span>${c.eyebrow.replace(/^\d+ · /, "")}</p><h1>${c.title}</h1><p class="scene-instruction">${instruction}</p></section>
    ${['body','mouth','faces','inspect','compare','ending'].includes(stage) ? `<p class="background-hint">${world.inGallery?'각 토기를 끌면 따로 돌아가요':'빈 곳을 끌어 돌려요'}</p>` : ''}
    <div class="scene-extras">${extras}</div>
    <aside class="guide-bubble"><img class="guide-character" src="${characterImage(c.character)}" alt="${c.character}"><p>${c.speech.replaceAll("\n", "<br>")}</p></aside>
    ${stage === "assembly" ? '<div class="context-label">함께 사용했을 가능성을 살펴보는 장면</div>' : ""}
    </div>${stage === "body" ? '<div class="form-handles"><button data-form-handle="height" aria-label="높이 손잡이: 위아래로 끌기" title="위아래로 끌거나 방향키로 높이 조절">↕ <span>높이</span></button><button data-form-handle="width" aria-label="넓이 손잡이: 좌우로 끌기" title="좌우로 끌거나 방향키로 넓이 조절">↔ <span>넓이</span></button></div>' : ""}
    ${['body','mouth','faces'].includes(stage)?`<div class="turn-demonstration" aria-hidden="true" hidden><i></i><svg viewBox="0 0 140 36"><path d="M12 22 Q70 -5 128 22 M115 9 L128 22 L110 25"/></svg><span>빈 곳을 끌어 돌려요</span></div>`:''}
    ${storyCard(stage)}
    <footer><div class="left-actions">${button("previous", "이전", "previous", "round icon-only")}${isEdit ? button("undo", "되돌리기", "undo", "round icon-only", !history.undoStack.length) + button("redo", "다시 실행", "redo", "round icon-only", !history.redoStack.length) : button("home", "처음 화면", "home", "round icon-only")}</div>
    ${stage==='faces'?actionbar(drawingLabel,`<div class="tools" role="toolbar" aria-label="작업 도구">${c.tools.map((t) => `<button data-tool="${t}" class="tool ${tool === t ? "selected" : ""}" aria-pressed="${tool === t}" aria-label="${toolLabels[t]}">${icon(t)}<span>${toolLabels[t]}</span></button>`).join("")}</div>${toolGuide(tool,carveMode,lineWidth)}`,'drawing-actions'):''}
    ${stage==='ending'?button('finish-home','완료하고 처음으로','home','primary next-button'):button("next", primaryLabel, "next", "primary next-button")}</footer>`;
  arrangeHUD();
  const menu = hud.querySelector<HTMLDetailsElement>('.actionbar');
  if (menu && menuWasOpen) menu.open = true;
  if(world.inGallery)hud.querySelector('.scene-heading')?.insertAdjacentHTML('beforeend',`<p class="gallery-disclosure">오른쪽 · ${EXAMPLE_LABEL}<small>참고 유물: ${e(museum.artifact?.academicName??'얼굴모양토기')} · 형태와 색은 달라요.</small></p>`);
  if(stage==='faces'){
    hud.querySelector('.scene-heading')?.insertAdjacentHTML('afterbegin',`<div class="face-aspects" role="img" aria-label="세 면에 얼굴을 만들 수 있어요">${[1,2,3].map(n=>`<span data-face="${n}"><svg viewBox="0 0 24 24"><path d="M6 5 Q12 1 18 5 L20 19 Q12 23 4 19 Z M8 10h1 M15 10h1 M9 16q3 2 6 0"/></svg><small>${n}</small></span>`).join('')}</div>`);
    hud.querySelector('[data-tool="refine"]')?.classList.toggle('refine-nudge',refineNudge);
    syncFaceGuidance();
  }
  if(stage==='firing')hud.querySelector('.scene-heading')?.insertAdjacentHTML('beforeend','<button data-action="kiln-guide" class="kiln-help" aria-label="가마와 이 장면 알아보기"><span class="kiln-help-full">가마와 이 장면 알아보기 ↗</span><span class="kiln-help-brief">가마란?</span></button>');
  if(stage==='firing')hud.querySelector('.firing-status')?.insertAdjacentHTML('beforeend',`<small class="kiln-note">${fireStart?'가마 안쪽을 펼쳐 보여주는 장면이에요.':'당시 가마 자료를 참고한 장면 · 내부는 설명용 단면'}</small>`);
  if(stage==='excavation') {
    showDigProgress(world.coverage());
    hud.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled = !digComplete;
  }
  if(stage==='assembly')hud.querySelector<HTMLButtonElement>('[data-action="next"]')!.disabled=save.assembledRevision!==save.document.revision;
  layoutUI();
  restoreFocus();
  syncFaceGuidance();
}
function arrangeHUD() {
  const extras=hud.querySelector<HTMLElement>('.scene-extras')!;
  extras.classList.add('settings-dock');
  extras.setAttribute('aria-label','작업 설정');
  hud.append(extras);
  const coach=hud.querySelector<HTMLElement>('.tool-coach');
  if(coach&&!coach.closest('.actionbar')){coach.classList.add('lesson-dock');hud.append(coach);}
  const bubble=hud.querySelector<HTMLElement>('.guide-bubble');
  if(bubble){
    bubble.classList.add('character-dock');
    const stack=document.createElement('div');stack.className='guide-stack';
    const actions=hud.querySelector('.drawing-actions');
    if(actions)stack.append(actions);
    stack.append(bubble);hud.append(stack);
  }
  for(const duplicate of extras.querySelectorAll('#tool-instruction'))duplicate.removeAttribute('id');
}
let dialogOpener: HTMLElement | null = null;
function modal(html: string) {
  stopBodyGuide();
  clearRefineTip();
  world.stopFaceTour();
  cancelGesture();
  photoEditor?.dispose();photoEditor=null;world.paused = true;
  exampleRequest?.abort();exampleRequest=null;exampleViewer?.dispose();exampleViewer=null;
  fireLast = performance.now();
  if (!dialog.open) dialogOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.innerHTML = `${button("close", "닫기", "close", "round icon-only modal-close")}${html}`;
  dialog.scrollTop=0;
  const heading = dialog.querySelector('h2');
  if (heading) {
    if (!heading.id) heading.id = 'dialog-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.removeAttribute('aria-label');
  } else {
    dialog.removeAttribute('aria-labelledby');
    dialog.setAttribute('aria-label', html.includes('example-viewer-root') ? '예시 작품 감상' : '내 작품 사진');
  }
  if(!dialog.open) dialog.showModal();
  dialog.querySelector<HTMLElement>("button")?.focus();
}
function closeModal() {
  photoEditor?.dispose();photoEditor=null;
  exampleRequest?.abort();exampleRequest=null;exampleViewer?.dispose();exampleViewer=null;
  dialog.close();
  dialog.replaceChildren();
  syncPause();
  fireLast = performance.now();
  world.refresh();
  const previous = dialogOpener;
  dialogOpener = null;
  (previous?.isConnected && previous !== document.body && previous.getClientRects().length ? previous : world.renderer.domElement).focus({preventScroll:true});
}
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
let storyPhoto='',storyScene:SceneId='welcome';
let albumCategory:PhotoCategory='face',albumIndex=0,albumReturn='close';
function showCollection(category=albumCategory,index=0){
  albumCategory=availableGroups().includes(category)?category:availableGroups()[0];
  albumIndex=clamp(index,0,photosIn(albumCategory).length-1);
  const focusAction=dialog.querySelector('.museum-album')?(document.activeElement as HTMLElement)?.dataset.action:undefined;
  modal(collectionMarkup(albumCategory,albumIndex,albumReturn==='ending-credits'?'마무리로 돌아가기':albumReturn==='close'?'공방으로 돌아가기':'이전 안내로'));
  if(focusAction)Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.dataset.action===focusAction&&!b.disabled)?.focus({preventScroll:true});
}
dialog.addEventListener('keydown',event=>{
  if(!dialog.querySelector('.museum-album')||!['ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();showCollection(albumCategory,albumIndex+(event.key==='ArrowRight'?1:-1));
});
function showStory(photoId?:string,target:SceneId=stage) {
  const previousArticle=dialog.querySelector<HTMLElement>('.story-copy');
  const scrollTop=storyScene===target?previousArticle?.scrollTop??0:0;
  const photoScroll=storyScene===target?dialog.querySelector('.photo-picker')?.scrollLeft??0:0;
  const focusAction=previousArticle?(document.activeElement as HTMLElement)?.dataset.action:undefined;
  storyScene=target;
  const entry=museum.stages[target],photo=museum.photos.find(p=>p.id===photoId)??photoFor(target);
  storyPhoto=photo.id;
  const category=photoFor(target).category??'other';
  const related=museum.photos.filter(p=>p.id===entry.photo||entry.blocks.some(block=>block.photo===p.id)||(category!=='other'&&p.category===category));
  const blocks=entry.blocks.map(block=>{
    const illustration=block.photo&&block.photo!==entry.photo?museum.photos.find(p=>p.id===block.photo):undefined;
    return `<section class="story-section"><span class="fact-badge ${block.kind}">${factLabels[block.kind]}</span>${block.heading?`<h3>${e(block.heading)}</h3>`:''}<p>${e(block.text)}</p>${illustration?`<figure class="story-inline-photo"><img src="${museumAsset(illustration.file)}" alt="${e(illustration.alt)}" loading="lazy"><figcaption>${e(illustration.caption)}<small>${e(illustration.credit)}</small>${illustration.source?`<a href="${e(illustration.source)}" target="_blank" rel="noopener noreferrer">사진 출처 보기 ↗</a>`:''}</figcaption></figure>`:''}${block.question?`<p class="observation-question"><strong>직접 살펴봐요</strong>${e(block.question)}</p>`:''}${sourceLinks(block.sources)}</section>`;
  }).join('');
  modal(`<div class="story-layout museum-story"><header class="story-heading"><p class="eyebrow">${target==='excavation'?'발굴 이야기 · 소월리의 현장과 기록':'실제 유물에서 찾아보기'}</p><h2 id="story-title">${e(entry.title)}</h2></header><div class="story-body"><div class="story-photo"><div class="story-image"><img src="${museumAsset(photo.file)}" alt="${e(photo.alt)}"></div><div class="story-photo-caption" tabindex="0" aria-label="사진 설명"><p>${e(photo.caption)}</p><p class="story-photo-credit">${e(photo.credit)}</p></div><nav class="photo-picker" aria-label="참고 사진 선택">${related.map((p,i)=>`<button data-action="story-photo-${museum.photos.indexOf(p)}" aria-pressed="${photo.id===p.id}">사진 ${i+1}</button>`).join('')}</nav></div><article class="story-copy" tabindex="0" aria-labelledby="story-title">${blocks}${museumVisitMarkup()}</article></div><footer class="story-controls"><button data-action="collection" class="secondary">유물 사진첩 전체 보기</button><div class="story-footer-links">${photo.source?`<a href="${e(photo.source)}" target="_blank" rel="noopener noreferrer">사진 출처 보기 ↗</a>`:''}${museumHomeLink()}</div></footer></div>`);
  dialog.querySelector<HTMLElement>('.story-copy')!.scrollTop=scrollTop;
  dialog.querySelector<HTMLElement>('.photo-picker')!.scrollLeft=photoScroll;
  if(focusAction)Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.dataset.action===focusAction)?.focus({preventScroll:true});
}
async function go(next: SceneId) {
  stopBodyGuide();
  clearRefineTip();
  cancelGesture();
  clearTimeout(toastTimer);
  toastElement.classList.remove('visible');
  cancelAnimationFrame(fireTimer);
  fireTimer=0;
  audio.firing(0);
  fireStart = 0;
  if(!world.readyFor(next)){
    const wasTravelling=travelling,overlay=document.querySelector<HTMLElement>('#travel')!;
    travelling=true;closeActions();overlay.hidden=false;
    overlay.querySelector('h2')!.textContent=['compare','ending'].includes(next)?'전시실을 준비하고 있어요':'다음 장면을 준비하고 있어요';
    try{await world.prepareScene(next);}
    catch{toast('장면을 불러오지 못했어요. 연결을 확인하고 다시 눌러 주세요.');return;}
    finally{if(!wasTravelling)overlay.hidden=true;travelling=wasTravelling;}
  }
  stage = next;
  tool = next==='body'?'shape':next==='excavation'?'brush':next==='assembly'&&save.assembledRevision!==save.document.revision?'place':scenes[next].tools[0] ?? "rotate";
  audio.excavation = next === "excavation";
  world.setStage(next);
  digComplete=next==='excavation' && bothDiscovered(world.coverage());
  updateUI();
  if(!world.reduced){
    for(const [i,el] of [...hud.querySelectorAll<HTMLElement>('.scene-info,.guide-stack>.character-dock,.drawing-actions,.settings-dock,footer')].entries())
      el.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:i*25,easing:'ease-out'});
  }
  if(next==='faces'&&!faceTourShown){faceTourShown=true;rotationHint=true;world.startFaceTour();syncFaceGuidance();}
  if(next==='body'&&!bodyGuideShown)startBodyGuide();
  // Prepare the next environment while the player reviews or places their pot.
  // Failed preloads are retried with visible feedback when entering that scene.
  if(next==='inspect')void world.prepareScene('firing').catch(()=>{});
  if(next==='assembly')void world.prepareScene('compare').catch(()=>{});
  if (next !== "welcome") void persist();
}
async function travelTo(next:SceneId,label:string){
  if(travelling)return;travelling=true;cancelGesture();closeActions();
  const overlay=document.querySelector<HTMLElement>('#travel')!;
  overlay.querySelector('h2')!.textContent=label;overlay.hidden=false;
  await playTravel(world.reduced);
  await go(next);overlay.hidden=true;travelling=false;
}
const discoveryThreshold = .7;
function bothDiscovered(progress: number[]) {
  return progress.length === 2 && progress.every(value => value >= discoveryThreshold);
}
function showDigProgress(progress: number[]) {
  hud.querySelectorAll<HTMLProgressElement>('#dig-progress progress').forEach((meter, index) => {
    const percent = Math.min(100, Math.floor((progress[index] ?? 0) * 100 / discoveryThreshold));
    if (meter.value === percent) return;
    meter.value = percent;
    meter.previousElementSibling!.querySelector('strong')!.textContent = percent === 100 ? '발견!' : percent + '%';
  });
}
function checkDiscovery(){
  if (stage !== 'excavation' || digComplete) return;
  const progress = world.coverage();
  showDigProgress(progress);
  if (!bothDiscovered(progress)) return;
  digComplete=true;audio.effect('success');toast('찾았어요! 같은 현장에서 시루 위에 함께 놓아 볼까요?');
  updateUI();
}
function record(before: ReturnType<typeof cloneDoc>, refreshUI = true) {
  history.push(before, stage);
  changed(save);
  world.update();
  world.react();
  if (refreshUI) updateUI();
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
  cancelAnimationFrame(fireTimer);
  fireTimer=0;
  audio.firing(0);
  fireStart = 0;
  save.firedRevision = save.document.revision;
  world.setFiringProgress(null);
  world.pottery.appearance(1);
  world.refresh();
  audio.effect("success");
  updateUI();
  void persist();
  void world.prepareScene('excavation').catch(()=>{});
}
function startFire() {
  if (fireStart) {
    fireDone();
    return;
  }
  fireStart = performance.now();
  updateUI();
  fireElapsed=0;fireLast=performance.now();
  const duration=world.reduced?3000:7000;
  const tick=(now:number)=>{
    const delta=Math.max(0,now-fireLast);fireLast=now;
    if(!world.paused&&!document.hidden){
      fireElapsed=advanceFiring(fireElapsed/duration,delta,duration)*duration;
      const t=clamp(fireElapsed/duration,0,1),frame=firingFrame(t);
      world.setFiringProgress(t);audio.firing(frame.heat);
      const meter=document.querySelector<HTMLElement>('#fire-progress');
      if(meter)meter.style.width=`${t*100}%`;
      const label=document.querySelector('#firing-phase');
      if(label)label.textContent=frame.phase;
      const action=document.querySelector('#firing-action');
      if(action)action.textContent=frame.description;
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
let placing=false;
async function place() {
  if(placing||stage!=='assembly'||save.assembledRevision===save.document.revision)return;
  placing=true;
  const button=hud.querySelector<HTMLButtonElement>('[data-action="place"]');
  if(button){button.disabled=true;button.textContent='시루 위에 놓고 있어요';}
  const completed=await world.placeOnSiru();placing=false;
  if(!completed)return;
  save.assembledRevision = save.document.revision;
  tool='rotate';world.reframe();
  audio.effect("success");
  toast("함께 놓아 보았어요! 실제 사용법은 아직 연구 중이에요.");
  updateUI();
  void persist();
}
async function next() {
  if(travelling)return;
  if(returnToInspect&&['body','mouth','faces'].includes(stage)){returnToInspect=false;go('inspect');return;}
  if (stage === "mouth" && !save.document.mouth.opened) {
    toast("‘열린 입구로 바꾸기’를 눌러 이어서 다듬어 보세요.");
    return;
  }
  if (stage === "firing" && save.firedRevision !== save.document.revision) {
    startFire();
    return;
  }
  if (stage === "excavation" && !digComplete) {
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
  if(stage==='compare'){go('ending');return;}
  if(stage==='ending'){modal(endingMarkup());return;}
  if(stage==='inspect'){await travelTo('firing','가마로 이동하고 있어요');return;}
  if(stage==='assembly'){await travelTo('compare','박물관으로 이동하고 있어요');return;}
  audio.effect("success");
  go(order[order.indexOf(stage) + 1]);
}
document.addEventListener("click", async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-action],button[data-tool]",
  );
  if (!el || !loaded||travelling) return;
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
  if(a==='example-artwork'){
    modal('<div id="example-viewer-root"><p role="status">예시 작품을 불러오고 있어요.</p></div>');
    const root=dialog.querySelector<HTMLElement>('#example-viewer-root')!;
    const request=new AbortController();exampleRequest=request;
    let view:ReturnType<World['createExampleView']>|undefined;
    try{
      const response=await fetch(new URL('../asset/runtime/examples/user-pottery.togi.json',import.meta.url).href,{signal:request.signal});
      if(!response.ok)throw new Error('example-unavailable');
      const example=readArtworkFile(await response.text());
      if(!root.isConnected||request.signal.aborted)return;
      view=world.createExampleView(example);
      exampleViewer=new ExampleViewer(root,view);
    }catch{
      view?.dispose();
      if(root.isConnected&&!request.signal.aborted)root.innerHTML='<p role="alert">예시 작품을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>';
    }
    return;
  }
  if(a==='export-artwork'){
    const artwork=stage==='welcome'?saved:save;
    if(!artwork){toast('아직 저장한 작품이 없어요.');return;}
    try{downloadArtwork(artwork);toast('현재 작품을 별도 파일로 저장했어요. 이어 만들기는 그대로예요.');}
    catch{toast('작품 파일을 저장하지 못했어요. 다시 시도해 주세요.');}
    return;
  }
  if(a==='finish-home'){
    await persist();closeModal();await go('welcome');return;
  }
  if(a==='turn-guide'){
    closeModal();rotationHint=true;
    if(stage==='faces')world.startFaceTour();
    syncFaceGuidance();world.refresh();return;
  }
  if(a==='shape-guide'){closeModal();startBodyGuide();return;}
  if(a==='photo'&&world.inGallery){
    let view:ReturnType<World['createPhotoView']>|undefined;
    try{
      modal('<div id="photo-editor-root"></div>');
      view=world.createPhotoView();
      photoEditor=new PhotoEditor(dialog.querySelector('#photo-editor-root')!,view);
    }catch{view?.dispose();closeModal();toast('사진을 만들지 못했어요. 다시 시도해 주세요.');}
    return;
  }
  if(a==='finish-photo'){closeModal();go('ending');modal(endingMarkup());return;}
  if(a==='kiln-guide'){modal(kilnGuide());return;}
  if(a==='ending-credits'){modal(endingMarkup());return;}
  if (a === 'welcome-photo') {
    albumReturn = 'close';
    showCollection('face', Math.max(0, photosIn('face').findIndex(photo => photo.id === 'face-three-sides')));
    return;
  }
  if(a==='collection'||a.startsWith('collection-')){
    albumReturn=dialog.querySelector('.museum-ending')?'ending-credits':dialog.querySelector('.museum-credits')?'credits':dialog.querySelector('.story-layout')?'story':'close';
    const group=a.startsWith('collection-')?a.slice(11) as PhotoCategory:dialog.querySelector('.story-layout')?museum.photos.find(p=>p.id===storyPhoto)?.category??'face':'face';
    showCollection(group);return;
  }
  if(a.startsWith('album-group-')){showCollection(a.slice(12) as PhotoCategory);return;}
  if(a.startsWith('album-photo-')){showCollection(albumCategory,Number(a.slice(12)));return;}
  if(a==='album-next'||a==='album-previous'){showCollection(albumCategory,albumIndex+(a==='album-next'?1:-1));return;}
  if(a==='album-back'){
    if(albumReturn==='ending-credits')modal(endingMarkup());
    else if(albumReturn==='credits')modal(creditsMarkup());
    else if(albumReturn==='story')showStory(storyPhoto,storyScene);
    else closeModal();
    return;
  }
  if(a==='settings'){
    const opened=hud.classList.toggle('settings-open');el.setAttribute('aria-expanded',String(opened));return;
  }
  if(a.startsWith('story-photo-')){showStory(museum.photos[Number(a.slice(12))]?.id,storyScene);return;}
  if (a === "draw-opening" || a === "draw-line") {
    cancelGesture();
    carveMode = a === "draw-line" ? "line" : "opening";
    tool = "carve";
    updateUI();
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
  if (a === "credits") {
    modal(creditsMarkup());
    return;
  }
  if (a === "help") {
    modal(
      `<div class="help-copy"><p class="eyebrow">${scenes[stage].eyebrow}</p><h2>이 장면에서 해 볼 일</h2><ul class="stage-tips">${stageTips[stage].map(tip => `<li>${tip}</li>`).join("")}</ul>${stage==="body"?button("shape-guide","몸체 빚는 동작 다시 보기","shape","secondary"):""}${["body","mouth","faces"].includes(stage)?button("turn-guide","돌리는 동작 다시 보기","rotate","secondary"):""}<details class="gesture-help"><summary>화면 조작 알아보기</summary><p>체험 중에 토기 주변의 빈 곳을 끌어 방향을 바꿔요. 두 손가락을 벌리거나 마우스 휠을 굴리면 확대할 수 있어요. 만들기 단계에서는 되돌리기 버튼이나 Ctrl / ⌘ + Z로 방금 한 작업을 되돌려요.</p></details><label class="motion-setting"><input id="reduce-motion" type="checkbox" ${world.reduced ? "checked" : ""}> 움직임 줄이기</label><section class="help-credits"><p>${AI_CONTENT_LABEL}</p><div class="credits-actions"><button data-action="credits" class="secondary">AI 제작·출처 안내</button>${museumHomeLink()}</div></section></div>`,
    );
    dialog.querySelector('.help-credits')!.insertAdjacentHTML('beforebegin',`<section class="help-artworks"><h3>작품 감상과 보관</h3><p>예시 작품을 돌려 보고, 내 작품도 파일로 간직해 보세요.</p><div class="help-artwork-actions">${button('example-artwork','예시 작품 감상','rotate','secondary')}${stage!=='welcome'||saved?button('export-artwork','내 작품 파일 저장','download','secondary'):''}</div></section>`);
    return;
  }
  if (a === "new") {
    if (saved || stage !== "welcome") {
      modal(
        `<div class="confirm-copy"><h2>새 작품을 만들까요?</h2><p>이 기기에 저장된 작품이 새 작품으로 바뀌어요.<br>지금 작품을 간직하려면 먼저 파일로 저장하세요.</p><div class="backup-action">${button("export-artwork", "내 작품 파일 저장", "download", "secondary")}</div>${button("close", "돌아가기", "previous", "secondary")}${button("confirm-new", "새 작품 만들기", "plus", "primary")}</div>`,
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
    world.reduced = setReducedMotion((e.target as HTMLInputElement).checked);
    world.stopFaceTour();
    world.refresh();
  }
});
systemMotion.addEventListener('change',()=>{
  const reduced=syncReducedMotion();
  if(world){world.reduced=reduced;world.stopFaceTour();world.refresh();}
  const input=document.querySelector<HTMLInputElement>('#reduce-motion');
  if(input)input.checked=reduced;
});
function aNew() {
  bodyGuideShown=false;
  faceTourShown=false;rotationHint=true;refineNudge=false;carveMode='opening';
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
  range?: HTMLInputElement;
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
    // Leave the native thumb alone during its gesture; rewriting value can
    // disturb the browser's input/change bookkeeping (especially on touch).
    if (input && input !== formEdit?.range) input.value = String(body ? Math.round(value * 100) : value);
    const output = hud.querySelector(`#${key}-value`);
    if (output) output.textContent = `${Math.round(value * 100)}%`;
  }
}
function finishFormEdit(refreshUI = true) {
  flushFormValue();
  const edit = formEdit;
  formEdit = null;
  if (edit?.moved) {
    record(edit.before, refreshUI);
    audio.effect("clay");
  } else if (edit) {
    save.document = edit.before;
    world.update(false);
    syncFormValues();
  }
  hud.querySelector<HTMLElement>(".form-handles .dragging")?.classList.remove("dragging");
}
document.addEventListener("input", (e) => {
  const input=e.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='line-width')return;
  const value=Number(input.value);
  if(!Number.isFinite(value))return;
  lineWidth=clamp(Math.round(value),1,5);
  const label=lineWidthLabels[lineWidth-1],output=input.parentElement!.querySelector('output')!;
  input.setAttribute('aria-valuetext',label);output.title=label;
  output.querySelector('path')!.setAttribute('stroke-width',String(lineWidth*1.5));
  output.querySelector('span')!.textContent=String(lineWidth);
});
document.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement,
    key = el.dataset.formRange as FormKey | undefined;
  if (!key || !canEditForm(key)) return;
  const value = Number(el.value) / (key.startsWith("mouth-") ? 1 : 100);
  // Commit a missed release before changing controls, without replacing the
  // new input element in the middle of its native drag.
  if (formEdit && (formEdit.key !== key || formEdit.range !== el)) finishFormEdit(false);
  if (!formEdit) { beginFormEdit(key); formEdit!.range = el; }
  previewFormValue(value);
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement, key = el.dataset.formRange;
  if (!key || formEdit?.range !== el || formEdit.pointer !== undefined) return;
  finishFormEdit();
  hud
    .querySelector<HTMLElement>(`[data-form-range="${key}"]`)
    ?.focus({ preventScroll: true });
});
document.addEventListener("focusout", (e) => {
  if (formEdit?.range === e.target) finishFormEdit(false);
});
document.addEventListener("pointerdown", (e) => {
  const el = e.target as HTMLInputElement, key = el.dataset.formRange as FormKey | undefined;
  if (!key || !canEditForm(key) || !loaded || dialog.open || travelling || e.button !== 0) return;
  if (formEdit) finishFormEdit(false);
  beginFormEdit(key, e.clientX, e.clientY, e.pointerId);
  formEdit!.range = el;
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
  if (!edit || edit.range || edit.pointer !== e.pointerId) return;
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
    const key = formEdit.key, control = formEdit.range ? 'range' : 'handle';
    finishFormEdit();
    hud.querySelector<HTMLElement>(`[data-form-${control}="${key}"]`)?.focus({ preventScroll: true });
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
  artifact?:'own'|'reference';
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
  touch: boolean;
  refineIds: Set<string>;
}
let gesture: Gesture | null = null,
  pending: PointerEvent[] = [],
  raf = 0;
function clearRefineTip(){
  const wasVisible=refineTipUntil>0;
  clearTimeout(refineTipTimer);refineTipUntil=0;
  hud.querySelector('.refine-tip')?.remove();
  if(wasVisible)syncFaceGuidance();
}
function showRefineTip(){
  clearRefineTip();refineTipUntil=performance.now()+4200;
  syncRefineTip();refineTipTimer=window.setTimeout(clearRefineTip,4200);
}
function syncRefineTip(){
  if(stage!=='faces'||!refineNudge||performance.now()>=refineTipUntil){clearRefineTip();return;}
  const actions=hud.querySelector<HTMLDetailsElement>('.drawing-actions');
  const anchor=actions?.querySelector<HTMLElement>(actions.open?'.action-panel':'summary');
  if(!anchor?.getClientRects().length)return;
  let tip=hud.querySelector<HTMLElement>('.refine-tip');
  if(!tip){
    tip=document.createElement('div');tip.className='refine-tip';tip.setAttribute('role','status');
    tip.textContent='오돌토돌한 테두리를 다듬어 봐요';hud.append(tip);
    if(!world.reduced)tip.animate([{opacity:0},{opacity:1,offset:.07},{opacity:1,offset:.9},{opacity:0}],{duration:Math.max(0,refineTipUntil-performance.now()),fill:'forwards'});
  }
  const box=anchor.getBoundingClientRect(),width=tip.offsetWidth;
  const left=Math.max(12,Math.min(innerWidth-width-12,box.right-width));
  tip.style.left=`${left}px`;tip.style.top=`${Math.max(12,box.top-tip.offsetHeight-9)}px`;
  const button=actions!.querySelector('[data-tool="refine"]')?.getBoundingClientRect();
  const target=button?.width?button.x+button.width/2:box.right-24;
  tip.style.setProperty('--tip-arrow',`${Math.max(14,Math.min(width-14,target-left))}px`);
  syncFaceGuidance();
}
function clearOpening() {
  clearTimeout(outlineTimer);
  outlineDeadline=0;
  outlineAnimation?.cancel();
  outlineAnimation=undefined;
  openingOutline.style.display = "none";
  delete openingOutline.dataset.state;
  for (const p of openingOutline.querySelectorAll("path")) p.removeAttribute("d");
  openingOutline.querySelector('circle')?.remove();
}
function drawOutline(points: ScreenPoint[], state: "drawing" | "ready" | "outside" | "finished", closed: boolean) {
  const area = hud.querySelector<HTMLElement>(".work-area")!.getBoundingClientRect();
  openingOutline.style.clipPath = `inset(${area.top}px ${Math.max(0, innerWidth - area.right)}px ${Math.max(0, innerHeight - area.bottom)}px ${area.left}px)`;
  openingOutline.style.display = "block";
  openingOutline.dataset.state = state;
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + (closed ? " Z" : "");
  for (const p of openingOutline.querySelectorAll("path")) p.setAttribute("d", path);
  openingOutline.querySelector('circle')?.remove();
  if(!closed&&gesture?.touch&&points.length>5){
    const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',String(points[0].x));c.setAttribute('cy',String(points[0].y));c.setAttribute('r','9');
    c.classList.add('loop-target');openingOutline.append(c);
  }
}
function openingFeedback(points:UV[],refined=false){
  clearOpening();
  drawOutline(projectOutline(points),'finished',true);
  const duration=world.reduced?150:refined?260:450;
  outlineDeadline=performance.now()+duration;
  if(!world.reduced){
    outlineAnimation=openingOutline.animate([{opacity:.8},{opacity:0}],{duration,easing:'ease-out',fill:'forwards'});
    outlineAnimation.onfinish=clearOpening;
  }
  // Also remove the path when animations are disabled or a frame is delayed.
  outlineTimer=window.setTimeout(clearOpening,duration);
}
function syncFaceGuidance(){
  if(!['body','mouth','faces'].includes(stage))return;
  hud.querySelectorAll<HTMLElement>('[data-face]').forEach(el=>el.classList.toggle('active',Number(el.dataset.face)===world.faceAspect));
  const demo=hud.querySelector<HTMLElement>('.turn-demonstration'),area=hud.querySelector('.work-area')?.getBoundingClientRect();
  if(demo&&area){demo.hidden=!!bodyGuide||performance.now()<refineTipUntil||(!rotationHint&&!world.demonstratingFaces);demo.style.left=`${area.left+area.width/2}px`;demo.style.top=`${Math.max(area.top,area.bottom-88)}px`;}
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
function commitFeature(points: UV[], kind: "hole" | "raised-hole" | "groove", width: number, before: ReturnType<typeof cloneDoc>, strokeWidth?: number) {
  const feature={id:uid(),kind,points,width,...(strokeWidth===undefined?{}:{strokeWidth})};
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
  const suggestRefine=kind!=='groove'&&!refineNudge;
  if(kind!=='groove')refineNudge=true;
  record(before);
  if(suggestRefine)showRefineTip();
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
  world?.highlightPot(false);
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
    if(g.travel>8){rotationHint=false;syncFaceGuidance();}
    if(g.artifact)world.rotateArtifact(g.artifact,dx,dy);
    else world.orbit(dx,dy);

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
    // SoilTerrain already fills the world-space path between samples.
    if(world.brushAt(e.clientX,e.clientY))g.moved=true;
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
      if (g.kind === "pierce" || carveMode !== "line") continue;
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
  } else if(g.kind==='refine'){
    const hit=world.hit(e.clientX,e.clientY,true);
    if(hit?.uv){const f=nearestFeature(save.document,[hit.uv.x,hit.uv.y],Math.max(.018,g.units*(g.touch?26:18)));if(f)g.refineIds.add(f.id);}
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
    const opening = gesture.kind === "pierce" || carveMode !== "line";
    if (opening) {
      const screen=gesture.touch?closeFingerLoop(gesture.screen):gesture.screen;
      const closed = strokeIntent(screen,gesture.touch).closed;
      if (closed) showOpening(locateOpening(screen));
      else drawOutline(screen, "drawing", false);
    } else world.previewStroke(finishStroke(gesture.samples),lineWidths[lineWidth-1]);
  }
  if (gesture?.kind === "brush") showDigProgress(world.coverage());
}
function bindPointer() {
  const canvas = world.renderer.domElement;
  const touches=new Map<number,{x:number;y:number}>();
  let viewing=false,previousView:{x:number;y:number;distance:number}|null=null;
  let touchSoil:Uint8Array|null=null;
  const touchView=()=>{const [a,b]=[...touches.values()];return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)}:null;};
  const stopPointers=()=>{touches.clear();viewing=false;previousView=null;touchSoil=null;cancelGesture();};
  canvas.addEventListener("pointerleave", () => {world.hideBrush();if(!gesture)world.highlightPot(false);});
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!loaded || world.paused || travelling || gesture || formEdit || placing || stage === "welcome") return;
      e.preventDefault();
      world.stopFaceTour();clearOpening();
      world.zoomBy(Math.exp(-clamp(e.deltaY, -100, 100) * 0.002));
    },
    { passive: false },
  );
  canvas.addEventListener("pointerdown", (e) => {
    world.stopFaceTour();clearOpening();
    if(e.pointerType==='touch'&&loaded&&!world.paused&&!travelling&&!placing&&stage!=='welcome'&&!formEdit){
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      canvas.setPointerCapture(e.pointerId);
      if(touches.size>=2){
        cancelGesture();
        if(touchSoil){
          save.excavationMask.set(touchSoil);
          world.terrain.configure(save.excavationMask,world.terrain.findBounds);
          showDigProgress(world.coverage());
          world.refresh(true);touchSoil=null;
        }
        viewing=true;previousView=touchView();return;
      }
      touchSoil=stage==='excavation'?save.excavationMask.slice():null;
      if(viewing)return;
    }
    if (
      !loaded ||
      dialog.open ||world.paused||travelling||
      world.transitioning ||placing||
      gesture ||
      formEdit ||
      stage === "welcome"
    )
      return;
    audio.start();
    const artifact=e.button!==2?world.artifactAt(e.clientX,e.clientY):null;
    if(artifact)world.selectedArtifact=artifact;
    let kind:ToolId = e.button === 2 || stage==='firing' ? "rotate" : tool;
    const
      hit = kind==='shape'?world.shapeHit(e.clientX,e.clientY):world.hit(
        e.clientX,
        e.clientY,
        ["erase", "refine", "carve", "pierce"].includes(kind),
        false,
      );
    if(!hit&&['body','mouth','faces','inspect','assembly','compare','ending'].includes(stage))kind='rotate';
    if(stage==='excavation'&&!world.terrain.hit(world.pointer(e.clientX,e.clientY).ray))kind='rotate';
    if (!hit && kind !== "rotate" && kind !== "brush") return;
    if (kind === "carve" || kind === "pierce") toastElement.classList.remove("visible");
    const uv: UV = [hit?.uv?.x ?? 0, hit?.uv?.y ?? 0.5];
    gesture = {
      pointer: e.pointerId,
      kind,
      artifact:artifact??undefined,
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
      touch:e.pointerType==='touch',
      refineIds:new Set(),
    };
    if(kind==='refine'){
      const f=nearestFeature(save.document,uv,Math.max(.018,gesture.units*(gesture.touch?26:18)));if(f)gesture.refineIds.add(f.id);
    }
    canvas.setPointerCapture(e.pointerId);
    if(kind==='shape')world.highlightPot(true);
    if (kind === "brush") {
      world.beginBrush();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if(!gesture&&['body','mouth'].includes(stage))world.highlightPot(!!world.shapeHit(e.clientX,e.clientY));
    if(touches.has(e.pointerId)){
      touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(viewing){
        const next=touchView();
        if(next&&previousView&&!world.paused){if(Math.hypot(next.x-previousView.x,next.y-previousView.y)>2){rotationHint=false;syncFaceGuidance();}world.orbit(next.x-previousView.x,next.y-previousView.y);if(previousView.distance>8&&next.distance>8)world.zoomBy(next.distance/previousView.distance);}
        previousView=next;return;
      }
    }
    if (stage === "excavation"&&!gesture&&!world.paused) world.moveBrush(e.clientX, e.clientY);
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
    touches.delete(e.pointerId);
    touchSoil=null;
    if(viewing){
      previousView=null;
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(!touches.size)viewing=false;
      return;
    }
    if (!gesture || e.pointerId !== gesture.pointer) return;
    cancelAnimationFrame(raf);
    raf = 0;
    flushPointer();
    sample(e);
    world.endBrush();
    const g = gesture;
    if (!g) return;
    gesture = null;
    world.highlightPot(false);
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if(stage==='firing'&&!fireStart&&save.firedRevision!==save.document.revision&&e.button===0&&g.travel<(g.touch?9:5)&&world.firemouthAt(e.clientX,e.clientY)){
      startFire();return;
    }
    if(g.kind==='refine'){
      let refined:UV[]|undefined;
      for(const id of g.refineIds){const f=save.document.features.find(f=>f.id===id);if(f&&!refineFeature(save.document,f))refined=save.document.features.find(f=>f.id===id)?.points;}
      if(refined){refineNudge=false;record(g.before);openingFeedback(refined,true);audio.effect('clay');toast('테두리를 부드럽게 다듬었어요. 더 문지르거나 되돌릴 수 있어요.');}
      else toast('다듬고 싶은 구멍의 안쪽이나 테두리를 문질러 보세요.');
      return;
    }
    if (g.kind === "erase" && g.travel<(g.touch?20:6)) {
      const before = g.before,
        f = nearestFeature(
          save.document,
          [g.uv[0], g.uv[1]],
          Math.max(0.018, screenUnits() * 18),
        );
      if (f) {
        save.document.features = save.document.features.filter(
            (x) => x !== f,
          );
        record(before);
        audio.effect("clay");
      }
      return;
    }
    if (g.kind === "shape") {
      if (g.moved) {
        record(g.before);
        audio.effect("clay");
      }
    } else if (g.kind === "carve" || g.kind === "pierce") {
      world.previewStroke([]);
      const opening = g.kind === "pierce" || carveMode !== "line";
      const loop=g.touch?closeFingerLoop(g.screen):g.screen;
      clearOpening();
      const { tap, closed } = strokeIntent(
        opening ? loop : g.samples,g.touch,
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
        const screen = tap ? tapOpening({x:g.startX,y:g.startY},g.touch) : loop;
        const placement = locateOpening(screen);
        if (!placement.samples) {
          toast("선이 토기 가장자리를 벗어났어요. 보이는 흙 안쪽에 다시 그려 주세요.");
          return;
        }
        const points=finishStroke(placement.samples, true,g.touch);
        if(commitFeature(points,g.kind === "pierce" ? "raised-hole" : "hole", width, g.before))openingFeedback(points);
      } else {
        const points = finishStroke(g.samples);
        const strokeWidth=lineWidths[lineWidth-1];
        if (points.length >= 2) commitFeature(points, "groove", strokeWidth/readForm(save.document).height, g.before, strokeWidth);
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
  canvas.addEventListener("pointercancel", stopPointers);
  canvas.addEventListener("lostpointercapture", () => {
    if (gesture) cancelGesture();
  });
  window.addEventListener("blur", stopPointers);
  window.addEventListener("resize", stopPointers);
  canvas.addEventListener("keydown", (e) => {
    world.stopFaceTour();
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
        if(world.inGallery)world.rotateArtifact(world.selectedArtifact,e.key==='ArrowLeft'?-24:24);
        else world.orbit(e.key === "ArrowLeft" ? -24 : 24,0);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown")
        world.tilt(e.key === "ArrowUp" ? 6 : -6);
      else world.zoomBy(e.key === "-" ? 1 / 1.1 : 1.1);

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
    // Let the first loader reach the screen before synchronous WebGL setup.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    world = new World(host, () => save);
    world.onRender = ()=>{
      // A slow 3D frame can postpone timers. Clear expired feedback before paint.
      if(outlineDeadline&&performance.now()>=outlineDeadline)clearOpening();
      positionFormHandles();bodyGuide?.layout();syncFaceGuidance();
    };
    world.onExhibit=target=>showStory(photoFor(target).id,target);
    world.reduced=syncReducedMotion();
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
    const loader=document.querySelector<HTMLElement>('#loading')!;
    loader.querySelector('p')!.textContent='토기와 도구를 준비하고 있어요';
    await world.load();
    loaded = true;
    bindPointer();
    updateUI();
    void prepareTravelArt();
    syncPause();
    void document.fonts.ready.then(layoutUI);
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,(world.reduced?250:900)-(performance.now()-loadingStarted))));
    loader.querySelector('p')!.textContent='작업실이 준비됐어요';
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(!world.reduced)await loader.animate([{opacity:1},{opacity:0}],{duration:160,easing:'ease-out',fill:'forwards'}).finished;
    loader.remove();
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
