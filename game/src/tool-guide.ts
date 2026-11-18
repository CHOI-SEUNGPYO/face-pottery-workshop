import { toolHelp, toolLabels, lineWidthLabels, type ToolId, type CarveMode } from "./content";

export function toolGuide(tool: ToolId, mode: CarveMode = "opening", lineWidth = 3) {
  const instruction = tool === "carve" && mode === "line"
    ? "선 두께를 고른 뒤 눈썹이나 입을 그려 보세요."
    : toolHelp[tool].instruction;
  const modeButtons = `<div class="drawing-modes" role="group" aria-label="눈·입 표현 방식">
    <button data-action="draw-opening" aria-pressed="${mode === "opening"}"><svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="150" d="M20 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0"/></svg>구멍 뚫기</button>
    <button data-action="draw-line" aria-pressed="${mode === "line"}"><svg class="mode-icon" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="150" d="M4 8Q12 20 20 8"/></svg>선 새기기</button>
  </div>`;
  return `<section class="tool-coach" data-guide="${tool}" aria-label="선택한 도구 사용법">
    <h2>${toolLabels[tool]}</h2>
    ${tool === "carve" ? modeButtons : ""}
    ${tool === 'carve' && mode === 'line' ? `<label class="line-width-control" for="line-width"><span>선 두께</span><input id="line-width" type="range" min="1" max="5" step="1" value="${lineWidth}" aria-label="선 두께" aria-valuetext="${lineWidthLabels[lineWidth-1]}"><output for="line-width" title="${lineWidthLabels[lineWidth-1]}"><svg viewBox="0 0 32 20" aria-hidden="true"><path d="M4 10H28" stroke-width="${lineWidth*1.5}"/></svg><span>${lineWidth}</span></output></label>` : ''}
    <p id="tool-instruction">${instruction}</p>
  </section>`;
}
