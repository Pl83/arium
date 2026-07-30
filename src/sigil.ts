/**
 * sigil.ts — Cosmo medallion updater
 *
 * Watches the ordeal list and fills the circular medallion as ordeals are met.
 *
 * Colour is NOT set here. The medallion's SVG uses `currentColor` throughout,
 * so the active palette drives it via `.sigil-svg { color: var(--gold) }` in
 * index.css. Completion only toggles a class; theme.css decides what that
 * looks like in each palette.
 */
(function () {
  'use strict';

  function updateSigil(): void {
    const items = document.querySelectorAll('.center li');
    const total = items.length;
    if (total === 0) return;

    let done = 0;
    items.forEach(li => {
      if (li.querySelector('.striked')) done++;
    });

    const pct = done / total;
    const allDone = done === total;

    // The gradient runs y1=1 → y2=0, so the fill rises from the bottom and
    // the hard stop sits at the completion ratio.
    const splitOffset = (pct * 100).toFixed(1) + '%';
    const stop1 = document.getElementById('csg-stop1');
    const stop2 = document.getElementById('csg-stop2');
    if (stop1) stop1.setAttribute('offset', splitOffset);
    if (stop2) stop2.setAttribute('offset', splitOffset);

    const countEl = document.getElementById('sigil-count');
    const totalEl = document.getElementById('sigil-total');
    if (countEl) countEl.textContent = String(done);
    if (totalEl) totalEl.textContent = '/' + total;

    const svg = document.querySelector('.sigil-svg');
    if (svg) svg.classList.toggle('sigil-complete', allDone);
  }

  function startObserver(): void {
    const center = document.querySelector('.center');
    if (!center) {
      setTimeout(startObserver, 200);
      return;
    }

    updateSigil();

    new MutationObserver(updateSigil).observe(center, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
