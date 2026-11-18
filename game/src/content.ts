import type { SceneId } from "./model";
export type CarveMode = "opening" | "line";
export type ToolId =
  | "shape"
  | "rotate"
  | "carve"
  | "pierce"
  | "refine"
  | "erase"
  | "brush"
  | "place";
export const scenes: Record<
  SceneId,
  {
    title: string;
    eyebrow: string;
    instruction: string;
    character: string;
    speech: string;
    next: string;
    tools: ToolId[];
    elevation: number;
  }
> = {
  welcome: {
    title: "흙에서 만나는\n나의 얼굴",
    eyebrow: "작은 손끝에서 시작되는 이야기",
    instruction: "실제 유물의 세 얼굴을 살펴보고 나만의 얼굴모양토기를 만들어 보세요.",
    character: "경산이",
    speech: "우리, 어떤 얼굴을 만들어 볼까?",
    next: "만들러 가기",
    tools: [],
    elevation: 15,
  },
  body: {
    title: "얼굴을 담을 몸체를 빚어요",
    eyebrow: "01 · 얼굴모양토기의 몸체",
    instruction: "토기 윤곽선을 잡고 좌우로 움직여 보세요.",
    character: "압이",
    speech: "이 몸체에 눈과 입을 만들 거야.\n모양은 네 마음대로 빚어 봐!",
    next: "입구 다듬기",
    tools: [],
    elevation: 12,
  },
  mouth: {
    title: "입구도 나답게",
    eyebrow: "02 · 입구 다듬기",
    instruction: "조절 막대로 입구 넓이와 테두리 높이를 바꿔요.",
    character: "경산이",
    speech: "입구의 둥근 테두리를 살펴봐!\n크기도 조금씩 바꿔 볼까?",
    next: "얼굴 만들기",
    tools: [],
    elevation: 48,
  },
  faces: {
    title: "어떤 표정이 좋을까요?",
    eyebrow: "03 · 얼굴과 옆 구멍",
    instruction: "선을 그리거나 동그랗게 이어서 얼굴을 만들어요.",
    character: "독이",
    speech: "웃어도, 무표정해도 좋아!\n돌려서 다른 얼굴도 만들어 봐.",
    next: "내 토기 살펴보기",
    tools: ["carve", "pierce", "erase", "refine"],
    elevation: 9,
  },
  inspect: {
    title: "모두 다른, 나만의 토기",
    eyebrow: "04 · 내 토기 확인",
    instruction: "돌려서 살펴보고, 고치고 싶은 곳을 골라 보세요.",
    character: "경산이",
    speech: "어떤 표정이 숨어 있을까?\n천천히 한 바퀴 둘러보자.",
    next: "이대로 굽기",
    tools: [],
    elevation: 20,
  },
  firing: {
    title: "흙이 토기가 되는 시간",
    eyebrow: "05 · 말리고 굽기",
    instruction: "아궁이에 불을 지피고, 가마 안에서 내 토기가 구워지는 모습을 살펴봐요.",
    character: "경산이",
    speech: "안쪽을 볼 수 있게 벽을 열어 보여줄게!\n실제로는 벽을 닫고 구워.",
    next: "발굴하러 가기",
    tools: [],
    elevation: 12,
  },
  excavation: {
    title: "흙 속에 누가 있을까요?",
    eyebrow: "06 · 상상 발굴",
    instruction: "원 안의 흙을 여러 번 쓸어 보세요. 토기와 시루를 모두 찾으면 다음으로 갈 수 있어요.",
    character: "압이",
    speech: "조금씩 모습을 드러내네!\n두 곳을 골고루 살펴보자.",
    next: "시루에 얹어 보기",
    tools: [],
    elevation: 58,
  },
  assembly: {
    title: "함께 놓으면 어떤 모습일까?",
    eyebrow: "07 · 시루 위에 얹기",
    instruction: "내 토기를 끌어 시루 위에 놓아 보세요.",
    character: "경산이",
    speech: "함께 발견된 두 유물이야.\n이렇게 썼을지는 아직 몰라!",
    next: "전시실에서 비교하기",
    tools: [],
    elevation: 14,
  },
  compare: {
    title: "닮은 곳, 다른 곳을 찾아요",
    eyebrow: "08 · 두 작품 비교",
    instruction: "내 토기와 AI 재현 예시를 각각 잡고 돌려 보세요.",
    character: "경산이",
    speech: "실제 유물에는 세 얼굴이 있어.\n네 작품은 어떤 이야기를 들려줄까?",
    next: "전시 마무리",
    tools: [],
    elevation: 15,
  },
  ending: {
    title: "세상에 하나뿐인 내 얼굴모양토기",
    eyebrow: "우리의 작은 전시회",
    instruction: "내 작품을 돌려 감상해 보세요. 마음에 드는 각도를 사진으로 남길 수도 있어요.",
    character: "경산이",
    speech: "너의 손끝에서 멋진 이야기가 태어났어!",
    next: "유물 사진·마무리",
    tools: [],
    elevation: 18,
  },
};
export const stageTips: Record<SceneId, string[]> = {
  welcome: ["실제 유물 사진에서 세 얼굴이 어떻게 다른지 살펴보세요.", "예시 작품을 먼저 돌려 본 뒤 내 토기를 만들 수도 있어요."],
  body: ["더 볼록하게 만들 곳을 잡고 옆으로 끌어 보세요. 잡은 높이의 곡선이 달라져요.", "토기 전체를 바꾸려면 높이와 넓이 손잡이를 움직여 보세요."],
  mouth: ["입구 넓이를 움직이면 구멍이 넓어지고 좁아져요.", "테두리 높이를 움직이면서 옆에서 보면 변화를 더 쉽게 볼 수 있어요."],
  faces: ["손가락으로 톡 찍으면 작은 구멍이 생겨요. 다른 모양을 원하면 윤곽을 그려 닫아 보세요.", "구멍 다듬기를 골라 거친 가장자리를 문지르세요. 빈 곳을 끌어 돌리면 다른 면에도 표정을 만들 수 있어요."],
  inspect: ["빈 곳을 끌어 만든 얼굴을 한 바퀴 둘러보세요.", "고치고 싶은 부분을 고른 뒤 ‘수정 마치고 확인하기’를 누르면 여기로 돌아와요."],
  firing: ["아궁이에 불을 지피면 가마 안에서 토기가 구워지고 식는 모습을 볼 수 있어요.", "가마 벽이 열리는 장면은 안쪽을 보여 주기 위한 연출이에요."],
  excavation: ["같은 곳을 여러 번 쓸면 흙이 더 깊게 파여요. 유물의 윤곽이 보이면 주변도 쓸어 보세요.", "찾기 어려우면 ‘함께 찾아보기’를 눌러 묻힌 부분의 흙을 걷어 보세요."],
  assembly: ["토기를 시루 쪽으로 끌어 놓거나 ‘시루에 얹기’를 누르세요.", "두 유물을 함께 놓아 보는 상상 체험이에요. 실제로 이렇게 쓰였는지는 아직 알 수 없어요."],
  compare: ["왼쪽에는 내 작품, 오른쪽에는 게임 도구로 만든 재현 예시가 있어요. 각각 잡고 돌려 보세요.", "실제 출토 유물의 사진은 ‘유물 이야기’에서 볼 수 있어요."],
  ending: ["‘유물 사진·마무리’에서 실제 사진과 설명을 볼 수 있어요. 사진 촬영은 원할 때만 해 보세요.", "‘완료하고 처음으로’를 눌러도 이 기기에서 완성작을 다시 열 수 있어요."],
};
export const toolLabels: Record<ToolId, string> = {
  shape: "손으로 빚기",
  rotate: "돌려 보기",
  carve: "눈·입 그리기",
  pierce: "옆 구멍 뚫기",
  refine: "테두리 다듬기",
  erase: "표현 지우기",
  brush: "흙 쓸어내기",
  place: "시루에 얹기",
};
export const toolHelp: Record<
  ToolId,
  { short: string; instruction: string; result: string }
> = {
  shape: {
    short: "좌우로 부드럽게",
    instruction: "몸체를 잡고 좌우로 끌어 곡선을 바꿔 보세요.",
    result: "높이와 전체 넓이는 손잡이로 조절해요.",
  },
  rotate: {
    short: "상하좌우로",
    instruction:
      "좌우로 끌면 토기가 돌아가요. 위아래로 끌면 보는 높이가 달라져요.",
    result: "두 손가락이나 마우스 휠로 가까이 볼 수도 있어요.",
  },
  carve: {
    short: "구멍 또는 새긴 선",
    instruction: "구멍으로 만들지, 선으로 새길지 골라 보세요.",
    result: "그린 윤곽을 유지하고 작은 손떨림만 정리해요.",
  },
  pierce: {
    short: "도톰한 테두리",
    instruction: "톡 누르거나 원하는 모양을 그려 닫아 주세요.",
    result: "구멍 둘레에 도톰한 테두리가 솟아나요.",
  },
  refine: {
    short: "테두리까지 마무리",
    instruction: "구멍 안쪽이나 테두리를 문질러 매끈하게 다듬어요.",
    result: "한 번 문지를 때마다 조금씩 부드러워져요. 되돌리기로 비교할 수 있어요.",
  },
  erase: {
    short: "표현을 톡",
    instruction: "없애고 싶은 구멍이나 선을 톡 누르세요.",
    result: "몸체는 그대로 두고 그 표현만 지워요.",
  },
  brush: {
    short: "흙 위를 쓱쓱",
    instruction: "밝은 원이 닿는 흙을 쓸어내요. 다시 쓸면 더 깊어져요.",
    result: "흙이 낮아지며 토기와 시루가 조금씩 드러나요.",
  },
  place: {
    short: "끌어서 얹어요",
    instruction: "토기를 누른 채 시루 위로 끌어 놓아요.",
    result: "가까이 놓으면 제자리에 맞춰져요.",
  },
};
export const lineWidths = [.002, .004, .007, .012, .02] as const;
export const lineWidthLabels = ['아주 가늘게', '가늘게', '보통', '굵게', '아주 굵게'] as const;

export interface StoryBlock {
  kind: "fact" | "interpretation" | "imagination";
  heading?: string;
  text: string;
  sources?: string[];
  question?: string;
  photo?: string;
}
