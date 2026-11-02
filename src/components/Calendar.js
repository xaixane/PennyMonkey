import { openSheet } from './BottomSheet.js';
import * as haptics from '../utils/haptics.js';
import { ui } from '../utils/icons.js';
import { monthLabel } from '../utils/format.js';

// A month-grid date picker in a sheet, built from the page's own tokens (the native control ignores the theme).
export function openCalendar({ value, onPick }) {
  const today = new Date();
  const picked = value ? new Date(value) : null;
  let view = new Date((picked || today).getFullYear(), (picked || today).getMonth(), 1);

  const c = document.createElement('div');
  c.className = 'sheet-body';
  c.innerHTML = `<h3>Pick a date</h3>
    <div class="cal-head"><button class="icon-btn" data-nav="-1" aria-label="Previous month">${ui('left', 18)}</button><span class="cal-title"></span><button class="icon-btn" data-nav="1" aria-label="Next month">${ui('right', 18)}</button></div>
    <div class="cal-dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid"></div>
    <button class="btn ghost" data-today>Today</button>`;
  const grid = c.querySelector('.cal-grid');

  const same = (a, y, m, d) => a && a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;
  function draw() {
    const y = view.getFullYear(), m = view.getMonth();
    c.querySelector('.cal-title').textContent = monthLabel({ y, m });
    const lead = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    grid.innerHTML = Array.from({ length: lead }, () => '<span class="cal-day blank"></span>').join('') +
      Array.from({ length: days }, (_, i) => {
        const d = i + 1;
        return `<button class="cal-day${same(today, y, m, d) ? ' today' : ''}${same(picked, y, m, d) ? ' sel' : ''}" data-d="${d}">${d}</button>`;
      }).join('');
  }
  draw();

  const s = openSheet(c);
  c.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { haptics.tap(); view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1); draw(); return; }
    const day = e.target.closest('[data-d]');
    if (day) { haptics.tap(); onPick(new Date(view.getFullYear(), view.getMonth(), +day.dataset.d)); s.close(); return; }
    if (e.target.closest('[data-today]')) { haptics.tap(); onPick(new Date()); s.close(); }
  });
}
