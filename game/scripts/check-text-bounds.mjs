import assert from 'node:assert/strict';

// Check the painted text, including anonymous text inside flex buttons. A
// correctly sized card can still contain a label that spills past either edge.
export async function checkTextBounds(page, selector) {
  const errors = await page.locator(selector).evaluate(root => {
    const errors = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const surfaces = 'button,summary,.brand,.action-panel,.settings-dock,.scene-heading,.guide-bubble p,.welcome-copy,dialog';

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!node.textContent.trim() || !el.checkVisibility({visibilityProperty:true}) ||
          el.closest('svg,.icon-only,.view-icon,[aria-hidden="true"]')) continue;
      range.selectNodeContents(node);
      const lines = [...range.getClientRects()].filter(r => r.width > 0);
      for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
        // The photo strip and tabs are intentionally wider than their scrollport.
        const style = getComputedStyle(ancestor);
        if (['auto','scroll'].includes(style.overflowX) &&
            ancestor.scrollWidth > ancestor.clientWidth + 1) break;
        if (ancestor.matches(surfaces)) {
          const box = ancestor.getBoundingClientRect();
          if (lines.some(line => line.left < box.left - 1 || line.right > box.right + 1)) {
            errors.push(`${node.textContent.trim().slice(0,50)} → ${ancestor.className || ancestor.tagName}`);
            break;
          }
        }
        if (ancestor === root) break;
      }
      if (el.id === 'tool-instruction') {
        for (const word of node.textContent.matchAll(/\S+/gu)) {
          range.setStart(node,word.index);
          range.setEnd(node,word.index + word[0].length);
          if (range.getClientRects().length > 1) errors.push(`split word: ${word[0]}`);
        }
      }
    }
    return errors;
  });
  assert.deepEqual(errors, [], `text layout in ${selector} at ${page.viewportSize().width}px`);
}
