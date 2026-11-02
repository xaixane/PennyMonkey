import * as haptics from '../utils/haptics.js';
import { ui } from '../utils/icons.js';

const TABS = [['Add', 'plus'], ['Activity', 'list'], ['Insights', 'chart']];

export function mountTabBar(el, onChange) {
  el.innerHTML = `<div class="tab-ind"></div>` + TABS.map(([label, ic], i) =>
    `<button class="tab" data-i="${i}" aria-label="${label}">${ui(ic, 20)}<span>${label}</span></button>`).join('');
  const ind = el.querySelector('.tab-ind');
  const tabs = [...el.querySelectorAll('.tab')];

  function set(i) {
    ind.style.transform = `translateX(${i * 100}%)`;
    tabs.forEach((t, j) => t.classList.toggle('active', i === j));
  }
  el.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('.tab');
    if (!t) return;
    haptics.tap();
    const i = +t.dataset.i;
    set(i);
    onChange(i);
  });
  set(0);
  return set;
}
