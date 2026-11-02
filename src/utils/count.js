const reduce = matchMedia('(prefers-reduced-motion: reduce)');

// Animate a figure from its last value to `to`. render(minor) returns the HTML for a value.
export function countUp(el, to, render, ms = 650, after = () => {}) {
  const from = el._v ?? 0;
  el._v = to;
  cancelAnimationFrame(el._raf);
  if (reduce.matches || from === to) { el.innerHTML = render(to); after(); return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.innerHTML = render(p === 1 ? to : Math.round((from + (to - from) * e) / 100) * 100);
    after();
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}
