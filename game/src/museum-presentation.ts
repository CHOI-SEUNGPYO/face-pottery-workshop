import {museum,museumAsset,artifactLabel,sourceLinks,escapeHTML as e,type PhotoCategory} from './museum';
import {AI_CONTENT_LABEL,museumHomeLink,museumVisitMarkup} from './disclosure';

const huss=new URL('../asset/runtime/credits/yu-huss.png',import.meta.url).href;
const hussFull=new URL('../asset/runtime/credits/yu-huss-full.png',import.meta.url).href;
const museumLogo=new URL('../asset/runtime/credits/gyeongsan-museum.png',import.meta.url).href;
const institution='영남대학교 인문사회디지털융합인재양성사업단';
const support='2026년 YU Digital HUSS ‘AI를 활용한 디지털 뮤지엄 큐레이팅 과정’ 지원으로 제작되었습니다.';

export function partnerMarks(compact=false){
  return `<div class="partner-marks ${compact?'compact':''}" aria-label="${institution} · 경산시립박물관"><img class="huss-mark" src="${compact?huss:hussFull}" alt="${institution}"><span aria-hidden="true"></span><img class="museum-mark" src="${museumLogo}" alt="경산시립박물관"></div>`;
}

export function creditsMarkup(){
  return `<article class="museum-credits credits-copy"><div class="credits-heading"><p class="eyebrow">흙에서 만나는 나의 얼굴</p><h2>유물에서 시작된<br>우리의 작은 공방</h2></div>${partnerMarks()}<p class="credits-intro">${institution} 참여학과 학생들이 경산시립박물관 소장 유물을 바탕으로 만든 체험 게임입니다.</p><p class="support-credit">${support}</p><div class="credits-actions"><button data-action="collection" class="secondary">실제 유물 사진 보기</button>${museumHomeLink()}</div><section class="creation-note"><h3>게임과 실제 유물을 구분해 주세요</h3><p class="ai-content-label">${AI_CONTENT_LABEL}</p><p>일부 장면과 이미지는 AI로 생성·편집했으며, 3D 유물은 사진과 공개 영상을 참고해 재현했어요. 실제 유물과 다를 수 있어요.</p><dl><dt>제작에 활용한 도구</dt><dd>OpenAI Codex와 이미지 생성 도구를 개발·이미지·3D 모델 제작에 활용했어요. 유물 모형은 실측 스캔이 아니에요.</dd><dt>직접 만드는 내 토기</dt><dd>내 토기의 모양과 표정은 플레이어가 직접 조절해요. 플레이 중 AI가 자동으로 작품을 생성하는 방식은 아니에요.</dd><dt>AI가 게임 도구로 만든 재현 예시</dt><dd>마지막 전시 오른쪽에는 AI가 게임의 몸체 조절·구멍·다듬기 기능으로 만든 예시가 있어요. 실제 사진의 세 얼굴을 참고했지만, 게임의 조형과 흙색으로 만든 창작 예시예요. 실제 유물 사진은 사진첩에서 나란히 살펴볼 수 있어요.</dd><dt>실제 유물 사진과 자료</dt><dd>사진첩과 유물 이야기의 실제 사진은 AI 생성 이미지가 아니에요. 각 사진에 제공자와 출처를 표시했어요. 배경 토기는 전시 사진을 참고해 재구성했으며, 사진 설명은 공식 유물명이 아닌 형태 안내일 수 있어요.</dd><dt>저장하는 기념 이미지</dt><dd>AI 생성·편집 콘텐츠가 포함됐다는 표시를 이미지 안에 함께 저장해요. 스티커를 옮기거나 지워도 이 표시는 유지돼요.</dd></dl></section><section class="research-bibliography"><h3>설명을 만든 자료</h3><p>박물관 안내와 발굴 발표, 공개된 학술논문 초록을 대조했어요. 확인된 특징과 연구자의 해석, 게임 속 상상을 구분해 읽어 주세요. 게임의 설명 전체가 박물관의 공식 해설이나 감수를 받은 것은 아니에요.</p>${sourceLinks((museum.sources??[]).map(s=>s.id))}</section></article>`;
}

export const photoGroups:Record<PhotoCategory,{label:string;title:string;description:string}>= {
  face:{label:'얼굴모양토기',title:'하나의 토기에 담긴 세 얼굴',description:'눈·코·입을 뚫어 표현한 얼굴이 서로 달라요. 내 작품과 실제 유물의 표정, 몸체와 입구를 나란히 떠올려 보세요.'},
  siru:{label:'함께 나온 시루',title:'얼굴모양토기와 함께 발견된 시루',description:'바닥을 없애고 몸통 중간에 소뿔 모양 손잡이 두 개를 붙인 시루예요. 얼굴모양토기와 결합해 썼을 가능성이 있지만, 정확한 사용법은 밝혀지지 않았어요.'},
  background:{label:'배경 토기',title:'공방과 전시실을 채운 토기들',description:'게임의 선반과 전시 공간을 만들 때 참고한 실제 전시 사진이에요. 목과 몸체, 받침의 모양을 살펴보세요. 게임의 배치는 창작이며 실물을 그대로 복제한 것은 아니에요.'},
  other:{label:'더 많은 자료',title:'사진으로 만나는 유물 이야기',description:'함께 살펴볼 수 있도록 모은 사진 자료예요. 사진별 설명과 제공자를 확인해 주세요.'},
};
export const photosIn=(category:PhotoCategory)=>museum.photos.filter(p=>(p.category??'other')===category);
export const availableGroups=()=> (Object.keys(photoGroups) as PhotoCategory[]).filter(c=>photosIn(c).length);

export function collectionMarkup(category:PhotoCategory,index:number,backLabel:string){
  const group=photoGroups[category],photos=photosIn(category),photo=photos[index];
  return `<section class="museum-album" aria-labelledby="album-heading"><div class="album-heading"><p class="eyebrow">경산시립박물관 · 유물 사진첩</p><h2 id="album-heading">게임에서 만난, 실제 유물</h2><p>사진을 살펴보며 게임 속 모습과 비교해 보세요.</p></div><nav class="album-tabs" aria-label="유물 종류">${availableGroups().map(c=>`<button data-action="album-group-${c}" aria-pressed="${c===category}">${photoGroups[c].label}<small>${photosIn(c).length}</small></button>`).join('')}</nav><div class="album-body"><figure class="album-figure"><div class="album-image"><span class="real-photo-label">실제 사진</span><img src="${museumAsset(photo.file)}" alt="${e(photo.alt)}" decoding="async"></div><figcaption><strong>${e(photo.caption)}</strong><span>${e(photo.credit)}</span>${photo.source?`<a href="${e(photo.source)}" target="_blank" rel="noopener noreferrer">이 사진의 출처 ↗</a>`:''}<a class="original-photo" href="${museumAsset(photo.file)}" target="_blank" rel="noopener noreferrer">원본 크기로 보기 ↗</a></figcaption></figure><div class="album-info">${category==='face'?artifactLabel()+museumVisitMarkup():''}<h3>${group.title}</h3><p>${group.description}</p><nav class="album-photo-list" aria-label="${group.label} 사진 선택">${photos.map((p,i)=>`<button data-action="album-photo-${i}" aria-pressed="${i===index}"><span>${String(i+1).padStart(2,'0')}</span>${e(p.title||p.caption)}</button>`).join('')}</nav></div></div><nav class="album-controls" aria-label="사진 이동"><button data-action="album-back" class="secondary">${backLabel}</button><div><button data-action="album-previous" aria-label="이전 사진" ${index===0?'disabled':''}>←</button><span role="status" aria-live="polite">${index+1} / ${photos.length}</span><button data-action="album-next" aria-label="다음 사진" ${index===photos.length-1?'disabled':''}>→</button></div></nav></section>`;
}

export function endingMarkup(){
  const groups=availableGroups().slice(0,3);
  return `<article class="museum-ending" aria-labelledby="ending-credits-heading"><div class="ending-intro"><p class="eyebrow">나의 토기에서, 박물관으로</p><h2 id="ending-credits-heading">서로 다른 얼굴,<br>함께 남긴 이야기</h2><p>당신의 손끝에서 새로운 얼굴모양토기가 태어났어요.<br>이야기의 시작이 된 실제 유물도 만나 보세요.</p></div>${museumVisitMarkup()}<div class="ending-photos">${groups.map(c=>{const p=photosIn(c).find(p=>p.id==='face-three-sides')??photosIn(c)[0];return `<button data-action="collection-${c}"><img src="${museumAsset(p.file)}" alt="${e(p.alt)}"><span>${photoGroups[c].label}<b aria-hidden="true">↗</b></span></button>`;}).join('')}</div>${artifactLabel()}<div class="ending-partners">${partnerMarks()}<p>${institution} 참여학과 학생들 · 경산시립박물관 소장 유물 활용</p><p class="support-credit">${support}</p></div><p class="ending-disclosure">${AI_CONTENT_LABEL} · 게임 속 장면과 3D 재현은 실제 유물과 다를 수 있어요.</p><nav class="ending-actions"><button data-action="close" class="primary">내 작품으로 돌아가기</button><button data-action="credits" class="secondary">제작·출처 자세히</button>${museumHomeLink()}</nav></article>`;
}
