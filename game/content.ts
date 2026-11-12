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
    instruction: "친구들과 함께 나만의 얼굴 토기를 만들어 보세요.",
    character: "경산이",
    speech: "우리, 어떤 얼굴을 만들어 볼까?",
    next: "만들러 가기",
    tools: [],
    elevation: 15,
  },
  body: {
    title: "마음 가는 대로 빚어요",
    eyebrow: "01 · 나만의 모양",
    instruction: "잡고 옆으로 끌면 곡선이 부드럽게 달라져요.",
    character: "압이",
    speech: "통통하게, 길쭉하게!\n언제든 되돌릴 수 있으니 편하게 해 봐.",
    next: "입구 다듬기",
    tools: [],
    elevation: 12,
  },
  mouth: {
    title: "입구도 나답게",
    eyebrow: "02 · 입구 다듬기",
    instruction: "입구 옆 손잡이를 끌어 넓이와 높이를 조절해요.",
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
    instruction: "빛과 열 속에서 토기가 완성되는 과정을 지켜봐요.",
    character: "경산이",
    speech: "우리가 만든 모양 그대로!\n짧은 변화의 시간을 지켜보자.",
    next: "발굴하러 가기",
    tools: [],
    elevation: 24,
  },
  excavation: {
    title: "흙 속에 누가 있을까요?",
    eyebrow: "06 · 상상 발굴",
    instruction: "지면을 문질러 안쪽에 묻힌 토기와 시루를 찾아요.",
    character: "압이",
    speech: "조금씩 모습을 드러내네!\n두 곳을 골고루 살펴보자.",
    next: "조금 더 발굴하기",
    tools: [],
    elevation: 58,
  },
  assembly: {
    title: "함께 놓으면 어떤 모습일까?",
    eyebrow: "07 · 시루 위에 얹기",
    instruction: "내 토기를 끌어 시루 위에 놓아 보세요.",
    character: "경산이",
    speech: "함께 발견된 두 유물이야.\n이렇게 썼을지는 아직 몰라!",
    next: "실제 유물 만나기",
    tools: [],
    elevation: 14,
  },
  compare: {
    title: "닮은 곳, 다른 곳을 찾아요",
    eyebrow: "08 · 실제 유물과 비교",
    instruction: "얼굴과 입구를 살펴보세요. 내 작품은 달라도 괜찮아요.",
    character: "경산이",
    speech: "실제 유물에는 세 얼굴이 있어.\n네 작품은 어떤 이야기를 들려줄까?",
    next: "사진 찍고 꾸미기",
    tools: [],
    elevation: 15,
  },
  ending: {
    title: "세상에 하나뿐인 내 얼굴토기",
    eyebrow: "우리의 작은 전시회",
    instruction: "돌려 보며 가장 마음에 드는 모습을 사진으로 남겨요.",
    character: "경산이",
    speech: "너의 손끝에서 멋진 이야기가 태어났어!",
    next: "사진 찍기",
    tools: [],
    elevation: 18,
  },
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
    result: "위쪽의 시점 버튼으로도 바꿀 수 있어요.",
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
    short: "원할 때만 더 둥글게",
    instruction: "모양을 더 둥글게 바꾸고 싶을 때만 눌러 보세요.",
    result: "반드시 할 필요는 없어요. 지금 모습 그대로 완성해도 좋아요.",
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
export interface StoryBlock {
  kind: "fact" | "interpretation" | "imagination";
  text: string;
}
