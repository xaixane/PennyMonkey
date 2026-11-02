import { state, subscribe, goToMonth } from '../store.js';
import { currentMonth, monthLabel } from '../utils/format.js';
import * as haptics from '../utils/haptics.js';
import { ui } from '../utils/icons.js';
import { openSheet } from './BottomSheet.js';

// The button that sits where the month switcher used to be. It lights up when the dashboard is not showing the current month.
export const filterBtnHTML = () =>
  `<button class="btn-filter" data-filter-open aria-label="Filter">${ui('filter', 16, { sw: 2 })}<span>Filter</span></button>`;

const same = (a, b) => a.y === b.y && a.m === b.m;

// Month filter: the last twelve months plus any month that has expenses, newest first.
export function openFilters() {
  const now = new Date(), seen = new Map();
  const add = (y, m) => seen.set(y * 12 + m, { y, m });
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); add(d.getFullYear(), d.getMonth()); }
  for (const e of state.expenses) { const d = new Date(e.date); add(d.getFullYear(), d.getMonth()); }
  const months = [...seen.entries()].sort((a, b) => b[0] - a[0]).map(([, v]) => v);

  const c = document.createElement('div');
  c.className = 'sheet-body';
  c.innerHTML = `<h3>Filter</h3>
    <p class="hint">Month</p>
    <div class="tags filter-months">${months.map(({ y, m }) =>
      `<button class="tag${same({ y, m }, state.month) ? ' on' : ''}" data-y="${y}" data-m="${m}">${monthLabel({ y, m })}</button>`).join('')}</div>
    <div class="row-btns"><button class="btn ghost" data-reset>Reset</button><button class="btn primary" data-done>Done</button></div>`;
  const s = openSheet(c);
  const mark = () => c.querySelectorAll('.filter-months .tag').forEach((t) => t.classList.toggle('on', same({ y: +t.dataset.y, m: +t.dataset.m }, state.month)));

  c.addEventListener('click', (e) => {
    const t = e.target.closest('.filter-months .tag');
    if (t) { haptics.tap(); goToMonth({ y: +t.dataset.y, m: +t.dataset.m }); mark(); return; }
    if (e.target.closest('[data-reset]')) { haptics.tap(); goToMonth(currentMonth()); mark(); return; }
    if (e.target.closest('[data-done]')) { haptics.tap(); s.close(); }
  });
}

export function mountFilters() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-filter-open]')) return;
    haptics.tap();
    openFilters();
  });
  const sync = () => {
    const off = !same(state.month, currentMonth());
    document.querySelectorAll('.btn-filter').forEach((b) => b.classList.toggle('on', off));
  };
  subscribe((k) => { if (k.has('month')) sync(); });
  sync();
}
