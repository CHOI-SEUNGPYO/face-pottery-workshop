import { toolHelp, toolLabels, type ToolId, type CarveMode } from "./content";

export function toolGuide(tool: ToolId, mode: CarveMode = "opening") {
  const help =
    tool === "carve"
      ? mode === "opening"
        ? {
            instruction: "톡 누르면 작은 구멍, 그려서 닫으면 원하는 모양이 돼요.",
            result: "직접 그린 모양은 그대로, 작은 손떨림만 살짝 정리해요.",
          }
        : {
            instruction: "웃는 입이나 눈썹을 가는 선으로 새겨요.",
            result: "동그랗게 그려도 구멍 대신 선으로 남아요.",
          }
      : toolHelp[tool];
  const modeButtons = `<div class="drawing-modes" role="group" aria-label="눈·입 표현 방식">
    <button data-action="draw-opening" aria-label="구멍으로 만들기" aria-pressed="${mode === "opening"}"><svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="150" d="M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0"/></svg>구멍</button>
    <button data-action="draw-line" aria-label="선으로 새기기" aria-pressed="${mode === "line"}"><svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="150" d="M4 8Q12 20 20 8"/></svg>선</button>
  </div>`;
  return `<section class="tool-coach" data-guide="${tool}" aria-label="선택한 도구 사용법">
    <h2>${toolLabels[tool]}</h2>
    ${tool === "carve" ? modeButtons : ""}
    <p id="tool-instruction">${help.instruction}</p>
  </section>`;
}
