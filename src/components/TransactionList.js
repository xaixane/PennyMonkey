import { state, subscribe, monthExpenses, deleteExpense, catById } from '../store.js';
import { money, relDay, monthLabel, esc, timeLabel } from '../utils/format.js';
import * as haptics from '../utils/haptics.js';
import { confirmSheet, openSheet } from './BottomSheet.js';
import { icon } from '../utils/icons.js';
import { filterBtnHTML } from './Filters.js';
import { autoFit } from '../utils/fit.js';

const REVEAL = 88;

const signed = (e) => (e.type === 'debit' ? e.amount : -e.amount); // spending is positive, credits are negative

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Per-month facts the rows lean on: which category is on top and what a "large" spend is.
function monthFacts() {
  const all = monthExpenses(), by = new Map();
  for (const e of all) if (e.type === 'debit') by.set(e.categoryId, (by.get(e.categoryId) || 0) + e.amount);
  const top = [...by.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  return { all, top, big: Math.max(4 * median(all.filter((e) => e.type === 'debit').map((e) => e.amount)), 300000) };
}

// One transaction: icon tile, a title (the note, else the category), a quiet second line, tags only where they say something.
function rowParts(e, facts) {
  const c = catById(e.categoryId) || { id: '', name: 'Other', icon: 'other' };
  const tags = (e.type === 'credit' ? '<span class="etag income">Income</span>' : '') + (e.type === 'debit' && e.amount >= facts.big ? '<span class="etag large">Large</span>' : '');
  const sub = (e.note ? `${esc(c.name)} · ` : '') + timeLabel(e.date);
  return { c, tags, sub, ico: `<span class="ico${c.id && c.id === facts.top ? ' top' : ''}">${icon(c.icon, 18)}</span>`,
    main: `<span class="r-main"><span class="r-line"><span class="r-title">${esc(e.note || c.name)}</span>${tags}</span><span class="r-sub">${sub}</span></span>`,
    amt: `<span class="amt ${e.type}">${money(signed(e))}</span>` };
}

function entryHTML(e, facts) {
  const r = rowParts(e, facts);
  return `<div class="swipe" data-id="${e.id}"><button class="del-btn" data-del="${e.id}">Delete</button><div class="row-fg">${r.ico}${r.main}${r.amt}</div></div>`;
}

// Collapse/expand, swipe-to-reveal delete, delete confirmation. Used inside the full-activity sheet.
function bindList(list) {
  let openRow = null, sw = null;
  const setX = (row, x, animate) => {
    const fg = row.querySelector('.row-fg');
    fg.style.transition = animate ? '' : 'none';
    fg.style.transform = x ? `translateX(${x}px)` : '';
    row.classList.toggle('peek', x !== 0);
  };

  list.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-del]');
    if (d) {
      const row = d.closest('.swipe');
      const ok = await confirmSheet({ title: 'Delete transaction?', text: 'This can’t be undone.' });
      if (!ok) { setX(row, 0, true); openRow = null; return; }
      haptics.del();
      row.classList.add('leaving');
      setTimeout(() => deleteExpense(d.dataset.del), 240);
    }
  });

  list.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.swipe');
    if (!row || e.target.closest('.del-btn')) return;
    if (openRow && openRow !== row) { setX(openRow, 0, true); openRow = null; }
    sw = { row, x0: e.clientX, y0: e.clientY, base: openRow === row ? -REVEAL : 0, active: false, id: e.pointerId };
  });
  list.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
    if (!sw.active) {
      if (Math.abs(dx) < 8 || Math.abs(dy) > Math.abs(dx)) { if (Math.abs(dy) > 10) sw = null; return; }
      sw.active = true;
      sw.row.setPointerCapture(e.pointerId);
    }
    setX(sw.row, Math.max(-REVEAL - 24, Math.min(0, sw.base + dx)), false);
  });
  const endSwipe = (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const { row, base, x0, active } = sw;
    sw = null;
    if (!active) { if (openRow === row) { setX(row, 0, true); openRow = null; } return; }
    const x = base + (e.clientX - x0);
    if (x < -REVEAL / 2) { setX(row, -REVEAL, true); openRow = row; haptics.tap(); }
    else { setX(row, 0, true); if (openRow === row) openRow = null; }
  };
  list.addEventListener('pointerup', endSwipe);
  list.addEventListener('pointercancel', endSwipe);
}

// Every transaction of the month in a sheet, newest first, grouped by day. Chips filter by category.
export function openActivity(focus) {
  let filter = focus || null;
  const c = document.createElement('div');
  c.className = 'sheet-body';
  c.innerHTML = `<h3>${monthLabel(state.month)}</h3><p class="sheet-sum"></p><div class="tags filters"></div><div class="sheet-list"></div>`;
  const list = c.querySelector('.sheet-list'), chips = c.querySelector('.filters'), sum = c.querySelector('.sheet-sum');
  const draw = () => {
    const facts = monthFacts();
    const used = state.categories.filter((cat) => facts.all.some((e) => e.categoryId === cat.id));
    if (filter && !used.some((u) => u.id === filter)) filter = null;
    const rows = facts.all.filter((e) => !filter || e.categoryId === filter);
    const spent = rows.reduce((t, e) => t + (e.type === 'debit' ? e.amount : 0), 0);
    sum.textContent = rows.length ? `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'} · ${money(spent)} spent` : '';
    chips.innerHTML = used.length > 1 ? [['', 'All'], ...used.map((u) => [u.id, u.name])].map(([id, name]) => `<button class="tag${(filter || '') === id ? ' on' : ''}" data-f="${id}">${esc(name)}</button>`).join('') : '';
    let day = '';
    list.innerHTML = rows.length ? rows.map((e) => {
      const d = relDay(e.date), label = d !== day ? `<div class="day-label">${d}</div>` : '';
      day = d;
      return label + entryHTML(e, facts);
    }).join('') : '<p class="empty">No transactions this month.</p>';
  };
  draw();
  bindList(list);
  chips.addEventListener('click', (e) => { const f = e.target.closest('[data-f]'); if (f) { haptics.tap(); filter = f.dataset.f || null; draw(); } });
  const off = subscribe((k) => { if (k.has('expenses') || k.has('categories')) draw(); });
  openSheet(c, { onClose: off });
}

export function mountTransactions(root) {
  root.innerHTML = `
    <div class="tile-head"><div class="th"><span class="caps">Recent activity</span></div>
      <div class="head-actions"><button class="link" data-all>See all</button>${filterBtnHTML()}</div></div>
    <div class="fit alist"></div>`;
  const box = root.querySelector('.alist');
  const refit = autoFit(box);

  function render() {
    const facts = monthFacts();
    const items = facts.all.slice(0, 16); // newest first
    let day = '';
    box.innerHTML = items.length
      ? items.map((e) => {
          const r = rowParts(e, facts), d = relDay(e.date);
          const label = d !== day ? `<div class="day-label">${d}</div>` : '';
          day = d;
          return `${label}<button class="arow" data-ripple data-cid="${r.c.id}">${r.ico}${r.main}${r.amt}</button>`;
        }).join('')
      : '<div class="empty"><p>No transactions yet</p><button class="btn ghost" data-add>Add expense</button></div>';
    refit();
  }

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-all]')) { haptics.tap(); openActivity(null); return; }
    if (e.target.closest('[data-add]')) {
      haptics.tap();
      dispatchEvent(new Event('add:open'));
      if (!matchMedia('(min-width: 768px)').matches) document.querySelector('#tabbar .tab')?.click(); // phones: the Add tab
      return;
    }
    const row = e.target.closest('.arow');
    if (row) { haptics.tap(); openActivity(row.dataset.cid); }
  });

  subscribe((k) => {
    if (k.has('expenses') || k.has('categories') || k.has('month')) {
      render();
      if (k.has('month') && state.dir) {
        const c = state.dir > 0 ? 'slide-l' : 'slide-r';
        box.classList.remove('slide-l', 'slide-r');
        box.offsetWidth;
        box.classList.add(c);
      }
    }
  });
  addEventListener('themechange', render);
  render();
}
