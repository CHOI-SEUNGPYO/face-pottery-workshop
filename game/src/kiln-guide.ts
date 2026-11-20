import {sourceLinks} from './museum';

export function kilnGuide(){
  return `<article class="museum-credits kiln-guide">
    <p class="eyebrow">흙이 단단한 토기가 되기까지</p>
    <h2>토기를 굽는 가마</h2>
    <p>가마는 흙으로 빚은 그릇을 불과 열로 구워 완성하는 시설이에요. 아래는 경사면을 따라 만든 옛 토기가마에서 열과 연기가 흐르는 모습을 간단히 그린 그림이에요.</p>
    <div class="kiln-flow" aria-label="불과 열의 흐름을 단순화한 설명">
      <div><span>01</span><strong>불을 피우는 곳</strong><p>아궁이로 땔감을 넣고<br>연소실에서 불을 피워요</p></div>
      <b aria-hidden="true">→</b>
      <div><span>02</span><strong>소성실</strong><p>토기를 놓고<br>열로 구워요</p></div>
      <b aria-hidden="true">→</b>
      <div><span>03</span><strong>연도</strong><p>연기가 지나<br>밖으로 나가는 통로예요</p></div>
    </div>
    <section class="creation-note">
      <h3>가마 안을 어떻게 볼 수 있나요?</h3>
      <p>벽과 천장은 가마 안의 열을 유지하는 데 도움이 돼요. 게임에서는 토기가 놓인 자리를 볼 수 있게 옆면을 투명하게 보여줘요. 불을 지피고 토기가 식는 과정은 체험에 맞게 줄였어요.</p>
      <h3>가마 뒤로 보이는 풍경</h3>
      <p>소월리 유적은 청통천 주변의 넓은 들을 내려다보는 낮은 언덕에 있어요. 이 지형을 참고해 AI로 배경을 그렸어요. 물길의 모양과 가마·건조막의 배치는 게임에 맞게 구성했어요.</p>
      <p class="support-credit">소월리에서도 토기가마가 발견됐어요. 얼굴모양토기를 어느 가마에서 구웠는지는 현재 확인한 자료로 알 수 없어요.</p>
    </section>
    ${sourceLinks(['kiln-dictionary','excavation-2019'])}
    <div class="credits-actions"><button data-action="close" class="secondary">가마 장면으로 돌아가기</button></div>
  </article>`;
}
