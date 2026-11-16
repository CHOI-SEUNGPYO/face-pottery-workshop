export const MUSEUM_HOME = 'https://www.gbgs.go.kr/museum/main.do';
export const AI_CONTENT_LABEL = 'AI(인공지능) 생성·편집 콘텐츠 포함';

export function museumHomeLink() {
  return `<a class="museum-home-link" href="${MUSEUM_HOME}" target="_blank" rel="noopener noreferrer" aria-label="경산시립박물관 공식 홈페이지 (새 탭)">경산시립박물관 ↗</a>`;
}

export function museumVisitMarkup() {
  return `<aside class="museum-visit" aria-label="박물관 방문 안내"><strong>다음 만남은 경산시립박물관에서</strong><p>게임에서 만난 얼굴모양토기는 경산시립박물관 특별전에서 소개된 유물이에요.</p><small>실물을 보고 싶다면 방문 전 공식 홈페이지에서 현재 전시 여부와 관람 안내를 확인해 주세요.</small>${museumHomeLink()}</aside>`;
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
  context.fillText('내 토기는 사용자가 빚었어요. 오른쪽 전시와 배경·캐릭터는 AI 제작 요소를 포함하며 실제 유물과 다를 수 있어요.', 28, 1066);
  context.textAlign = 'right';
  context.font = '20px Pretendard, sans-serif';
  context.fillText('경산시립박물관  www.gbgs.go.kr/museum', 1892, 1044);
  context.restore();
}
