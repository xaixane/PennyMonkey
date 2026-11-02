import { state, subscribe, monthSummary } from '../store.js';
import { monthName, shiftMonth } from '../utils/format.js';
import * as haptics from '../utils/haptics.js';
import { ui } from '../utils/icons.js';
import { filterBtnHTML } from './Filters.js';
import logoUrl from '../assets/logo.png';

// Desktop chrome: icon rail, top bar and greeting. Hidden below 768px via CSS.
export function mountShell({ onActivity, onBudgets }) {
  const $ = (id) => document.getElementById(id);

  $('rail').innerHTML = `
    <img class="rail-logo" src="${logoUrl}" alt="Penny Monkey" />
    <nav class="rail-pill" aria-label="Sections">
      <button class="rail-btn active" aria-label="Overview" title="Overview" aria-current="page">${ui('grid', 20)}</button>
      <button class="rail-btn" data-act="add" aria-label="Add expense" title="Add expense">${ui('plus', 20)}</button>
      <button class="rail-btn" data-act="activity" aria-label="All activity" title="All activity">${ui('list', 20)}</button>
      <button class="rail-btn" data-act="budgets" aria-label="Budgets" title="Budgets">${ui('gauge', 20)}</button>
    </nav>
    <div class="rail-foot"><button class="rail-btn" data-settings-open aria-label="Settings" title="Settings">${ui('settings', 20)}</button></div>`;

  $('topbar').innerHTML = `
    ${filterBtnHTML()}
    <button class="btn-add" data-act="add">${ui('plus', 16)}<span>Add expense</span></button>
    <button class="avatar" aria-label="Profile">${ui('user', 20)}</button>`;

  $('titlebar').innerHTML = `
    <p class="tdate"></p>
    <h1 class="greet"></h1>
    <p class="insight"></p>`;

  const hour = new Date().getHours();
  $('titlebar').querySelector('.greet').textContent = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  $('titlebar').querySelector('.tdate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  // One honest sentence about the month, from the real numbers.
  function refresh() {
    const cur = monthSummary(state.month), pm = shiftMonth(state.month, -1), prev = monthSummary(pm);
    let t;
    if (!cur.debit) t = `No spending recorded in ${monthName(state.month)} yet.`;
    else if (!prev.debit) t = `Here is where your money went in ${monthName(state.month)}.`;
    else {
      const p = Math.round(((cur.debit - prev.debit) / prev.debit) * 100);
      t = p === 0 ? `You've spent the same as in ${monthName(pm)}.` : `You've spent <b class="hl">${Math.abs(p)}% ${p > 0 ? 'more' : 'less'}</b> than in ${monthName(pm)}.`;
    }
    $('titlebar').querySelector('.insight').innerHTML = t;
  }
  subscribe((k) => { if (k.has('month') || k.has('expenses')) refresh(); });
  refresh();

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    haptics.tap();
    const a = b.dataset.act;
    if (a === 'add') dispatchEvent(new Event('add:open'));
    else if (a === 'activity') onActivity();
    else if (a === 'budgets') onBudgets();
  });
}
