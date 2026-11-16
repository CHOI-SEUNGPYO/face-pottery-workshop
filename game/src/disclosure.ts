export const MUSEUM_HOME = 'https://www.gbgs.go.kr/museum/main.do';
export const AI_CONTENT_LABEL = 'AI(인공지능) 생성·편집 콘텐츠 포함';

export function museumHomeLink() {
  return `<a class="museum-home-link" href="${MUSEUM_HOME}" target="_blank" rel="noopener noreferrer" aria-label="경산시립박물관 공식 홈페이지 (새 탭)">경산시립박물관 ↗</a>`;
}

export function museumVisitMarkup() {
  return `<aside class="museum-visit" aria-label="박물관 방문 안내"><strong>경산시립박물관에서 만나 보세요</strong><p>이야기의 시작이 된 실제 얼굴모양토기를 직접 살펴보세요.</p><small>공식 홈페이지에서 관람 시간과 휴관일을 확인할 수 있어요.</small>${museumHomeLink()}</aside>`;
}

// Draw after every sticker and selection overlay so the disclosure remains
// visible in the preview and in the exported pixels. It is not a sticker.
export function drawPhotoDisclosure(context: CanvasRenderingContext2D) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.fillStyle = '#26332e';
  context.fillRect(0, 1008, 1920, 72);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#fff8e9';
  context.font = '600 24px Pretendard, sans-serif';
  context.fillText(AI_CONTENT_LABEL, 28, 1039);
  context.font = '18px Pretendard, sans-serif';
  context.fillText('토기의 모양과 표정은 사용자가 만들었어요. 게임과 캐릭터 제작에 AI를 활용했으며, 실제 유물 사진은 아니에요.', 28, 1066);
  context.textAlign = 'right';
  context.font = '20px Pretendard, sans-serif';
  context.fillText('경산시립박물관  www.gbgs.go.kr/museum', 1892, 1044);
  context.restore();
}
