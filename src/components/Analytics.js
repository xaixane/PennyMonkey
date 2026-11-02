import { state, subscribe, monthExpenses, setBudget, catById } from '../store.js';
import { money, moneyCompact, monthShort, monthName, shiftMonth, esc, toMinor, SYMBOL } from '../utils/format.js';
import * as haptics from '../utils/haptics.js';
import { icon, ui } from '../utils/icons.js';
import { filterBtnHTML } from './Filters.js';
import { autoFit } from '../utils/fit.js';
import { openSheet } from './BottomSheet.js';
import { rankColor } from '../utils/theme.js';


export function mountInsights({ donutEl, trendEl, budgetEl }) {
  donutEl.innerHTML = `
    <div class="tile-head"><div class="th"><span class="caps">Where it went</span></div>${filterBtnHTML()}</div>
    <div class="donut-box"><div class="donut-wrap"><canvas class="donut"></canvas></div><ul class="legend"></ul></div>`;
  trendEl.innerHTML = `
    <div class="tile-head"><div class="th"><span class="caps">Trend</span><span class="tsub trend-sub"></span></div>
      <div class="head-actions">
        <div class="seg" data-group="range"><button class="on" data-range="day">Daily</button><button data-range="month">Monthly</button></div>
        <div class="seg" data-group="metric"><button class="on" data-metric="debit">Spent</button><button data-metric="credit">Received</button></div>
        <button class="cmp" data-cmp aria-pressed="false"><i></i><span class="cmp-l"></span></button>
      </div></div>
    <div class="trend-wrap"><canvas class="trend"></canvas></div>`;
  budgetEl.innerHTML = `
    <div class="tile-head"><div class="th"><span class="caps">Budgets</span></div></div>
    <div class="fit blist"></div>`;

  const donut = donutEl.querySelector('.donut'), trend = trendEl.querySelector('.trend');
  const legend = donutEl.querySelector('.legend'), blist = budgetEl.querySelector('.blist');
  const refit = autoFit(blist, { idle: 'Manage budgets' });
  let segs = [], cols = [], selected = -1, total = 0;
  let metric = 'debit', range = 'day', trendSel = -1, compare = false, trendOpts = {};

  // Chart.js loads as its own chunk after first paint; data is pushed as soon as it arrives.
  let donutC = null, barsC = null;
  const pushDonut = () => donutC && donutC.set(segs, selected, { value: money(total), short: moneyCompact(total), label: 'spent' });
  const pushBars = () => barsC && barsC.set(cols, { ...trendOpts, sel: trendSel, compare, daily: range === 'day' });
  import('./charts.js').then((m) => {
    donutC = m.createDonut(donut, { onSelect: (i) => { haptics.tap(); selected = i === selected ? -1 : i; pushDonut(); } });
    barsC = m.createBars(trend, { onSelect: (i) => { haptics.tap(); trendSel = i; pushBars(); } });
    pushDonut(); pushBars();
  });

  function data() {
    const spend = new Map();
    for (const e of monthExpenses()) if (e.type === 'debit') spend.set(e.categoryId, (spend.get(e.categoryId) || 0) + e.amount);
    const rows = state.categories.map((c) => ({ c, v: spend.get(c.id) || 0 })).sort((a, b) => b.v - a.v);
    return { used: rows.filter((r) => r.v > 0), total: rows.reduce((s, r) => s + r.v, 0), spend };
  }

  // Slices are coloured by rank (brand first, then neutrals). More than five collapse into "Other".
  function buildSegs(used) {
    const seg = (r, i) => ({ key: r.c.id, label: r.c.name, value: r.v, color: rankColor(i, document.getElementById('t-donut') || undefined), text: money(r.v) });
    if (used.length <= 5) return used.map(seg);
    const rest = used.slice(4).reduce((s, r) => s + r.v, 0);
    return [...used.slice(0, 4).map(seg), { key: 'other', label: 'Other', value: rest, color: rankColor(4, document.getElementById('t-donut') || undefined), text: money(rest) }];
  }

  function renderLegend() {
    legend.innerHTML = segs.length
      ? segs.map((s) => `<li style="--cc:${s.color}"><i style="background:${s.color}"></i><span class="lg-name">${esc(s.label)}</span><b class="lg-val">${s.text}</b><span class="lg-pct">${s.value / total < 0.01 ? '<1' : Math.round((s.value / total) * 100)}%</span></li>`).join('')
      : '<li class="lg-empty">Nothing spent yet</li>';
  }

  // ---- trend: daily bars for the selected month, or only the months that have data ----
  const daysIn = ({ y, m }) => new Date(y, m + 1, 0).getDate();
  const isNowMonth = () => { const n = new Date(); return state.month.y === n.getFullYear() && state.month.m === n.getMonth(); };
  const tally = (list, n) => {
    const v = Array(n).fill(0), c = Array(n).fill(0);
    for (const e of list) if (e.type === metric) { const i = new Date(e.date).getDate() - 1; v[i] += e.amount; c[i]++; }
    return { v, c };
  };
  function trendItems() {
    const { m } = state.month;
    if (range === 'day') {
      const cur = tally(monthExpenses(), daysIn(state.month));
      const pm = shiftMonth(state.month, -1), prev = tally(monthExpenses(pm), daysIn(pm)).v;
      return cur.v.map((v, i) => ({ label: String(i + 1), tip: `${monthShort(m)} ${i + 1}`, value: v, count: cur.c[i], text: money(v),
        ghost: prev[i] || 0, ghostText: prev[i] ? `${monthShort(pm.m)} ${i + 1}: ${money(prev[i])}` : '' }));
    }
    const all = Array.from({ length: 12 }, (_, i) => {
      const mo = shiftMonth(state.month, i - 11);
      const list = monthExpenses(mo).filter((e) => e.type === metric);
      const v = list.reduce((s, e) => s + e.amount, 0);
      return { label: monthShort(mo.m), tip: `${monthName(mo)} ${mo.y}`, value: v, count: list.length, text: money(v), ghost: 0, ghostText: '' };
    });
    const first = all.findIndex((i) => i.value > 0);
    return all.slice(first < 0 ? 6 : Math.min(first, 6)); // drop leading empty months, keep at least six
  }
  const peakOf = (items) => items.reduce((p, it, i) => (it.value > items[p].value ? i : p), 0);
  // The bar that starts highlighted: today in the current month, otherwise the biggest bar.
  function defaultSel(items) {
    if (range === 'month') return items.length - 1;
    const peak = peakOf(items);
    if (isNowMonth() && items[new Date().getDate() - 1]?.value > 0) return new Date().getDate() - 1;
    return items[peak].value > 0 ? peak : Math.max(0, items.length - 1);
  }
  // "Highest: Oct 3 · ₹22,140 · Rent": the biggest day (or month), and what drove it
  function trendSummary(items) {
    const p = peakOf(items), it = items[p];
    if (!it || !it.value) return metric === 'debit' ? 'Nothing spent yet' : 'Nothing received yet';
    let why = '';
    if (range === 'day') {
      const big = monthExpenses().filter((e) => e.type === metric && new Date(e.date).getDate() === p + 1).sort((a, b) => b.amount - a.amount)[0];
      const c = big && catById(big.categoryId);
      why = big ? ` · ${esc(big.note || (c ? c.name : ''))}` : '';
    }
    return `Highest: ${it.tip} · ${it.text}${why}`;
  }
  function trendOptions(items) {
    const p = peakOf(items);
    let avg = 0;
    if (range === 'day') {
      const days = isNowMonth() ? new Date().getDate() : daysIn(state.month);
      avg = Math.round(items.reduce((s, i) => s + i.value, 0) / days / 100) * 100;
    }
    return { peak: items[p]?.value ? p : -1, avg };
  }

  // ---- budgets: name + status headline, the bar, then spent / budget ----
  const tone = (p) => (p > 1 ? 'red' : p >= 0.8 ? 'amber' : 'ok');
  function budgetRows(spend, onlyRelevant = false) {
    const list = state.categories.filter((c) => !onlyRelevant || c.budget || spend.get(c.id));
    const pct = (c) => (c.budget ? (spend.get(c.id) || 0) / c.budget : -1);
    return list.sort((a, b) => pct(b) - pct(a) || (spend.get(b.id) || 0) - (spend.get(a.id) || 0)).map((c) => {
      const s = spend.get(c.id) || 0, b = c.budget, p = b ? s / b : 0;
      // muted under 80%, amber from 80%, and the whole bar red once over; only the exceptions get a tag
      const fill = !b ? '' : `<i class="${tone(p)}" style="transform:${p > 1 ? 'none' : `scaleX(${p})`}"></i>`;
      const tag = !b ? '' : p > 1 ? `<span class="etag over">${money(s - b)} over</span>` : p >= 0.8 ? `<span class="etag near">${money(b - s)} left</span>` : '';
      const act = b ? `<button class="bedit" data-edit aria-label="Edit ${esc(c.name)} budget">${ui('pencil', 12)}</button>` : '<button class="bedit set" data-edit>Set a limit</button>';
      return `<div class="brow" data-id="${c.id}">
        <div class="b-top"><span class="b-name">${esc(c.name)}</span>${tag}<span class="b-amt">${b ? `${money(s)} / ${money(b)}` : s ? `${money(s)} spent` : 'No spend'}</span><span class="b-act">${act}</span></div>
        ${b ? `<div class="bar">${fill}</div>` : ''}
      </div>`;
    });
  }

  function openBudgets() {
    const c = document.createElement('div');
    c.className = 'sheet-body';
    c.innerHTML = '<h3>Budgets</h3><div class="sheet-list"></div>';
    const list = c.querySelector('.sheet-list');
    const draw = () => { list.innerHTML = budgetRows(data().spend).join(''); };
    draw();
    c.addEventListener('click', (e) => { const ed = e.target.closest('[data-edit]'); if (ed) startEdit(ed); });
    const off = subscribe((k) => { if (k.has('expenses') || k.has('categories')) draw(); });
    openSheet(c, { onClose: off });
  }

  function render() {
    const d = data();
    total = d.total;
    segs = buildSegs(d.used);
    selected = Math.min(selected, segs.length - 1);
    renderLegend();

    const rows = budgetRows(d.spend, true);
    blist.dataset.extra = Math.max(0, rows.length - 6);
    blist.innerHTML = (rows.length ? rows.slice(0, 6).join('') : '<p class="empty">No spending or budgets yet.</p>') + '<button class="more" data-more></button>';
    refit();

    cols = trendItems();
    if (trendSel < 0 || trendSel >= cols.length) trendSel = defaultSel(cols);
    trendOpts = trendOptions(cols);
    trendEl.querySelector('.trend-sub').innerHTML = trendSummary(cols);
    const cmp = trendEl.querySelector('[data-cmp]');
    cmp.hidden = range !== 'day';
    cmp.setAttribute('aria-pressed', compare);
    cmp.querySelector('.cmp-l').textContent = `vs ${monthShort(shiftMonth(state.month, -1).m)}`;
    pushDonut(); pushBars();
  }

  function growBars() {
    budgetEl.querySelectorAll('.bar i').forEach((i) => {
      const t = i.style.transform;
      i.style.transition = 'none'; i.style.transform = 'scaleX(0)';
      i.offsetWidth;
      i.style.transition = ''; i.style.transform = t;
    });
  }

  trendEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-cmp]')) { haptics.tap(); compare = !compare; render(); return; }
    const r = e.target.closest('[data-range]'), mt = e.target.closest('[data-metric]');
    if (!r && !mt) return;
    haptics.tap();
    if (r) { range = r.dataset.range; trendEl.querySelectorAll('[data-range]').forEach((b) => b.classList.toggle('on', b === r)); }
    if (mt) { metric = mt.dataset.metric; trendEl.querySelectorAll('[data-metric]').forEach((b) => b.classList.toggle('on', b === mt)); }
    trendSel = -1;
    render();
  });

  budgetEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-more]')) { haptics.tap(); openBudgets(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) startEdit(ed);
  });

  function startEdit(btn) {
    const id = btn.closest('.brow').dataset.id;
    const cat = catById(id);
    const input = document.createElement('input');
    input.className = 'binput';
    input.inputMode = 'decimal';
    input.placeholder = SYMBOL + ' 0';
    input.value = cat.budget ? String(cat.budget / 100) : '';
    btn.parentElement.replaceChildren(input);
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const v = toMinor(input.value.replace(/[^0-9.]/g, ''));
      setBudget(id, v > 0 ? v : null);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  }

  subscribe((k) => { if (k.has('month')) trendSel = -1; if (k.has('expenses') || k.has('categories') || k.has('month')) render(); });
  // fires on theme switch and once the font has loaded, so chart colours and text re-read
  addEventListener('themechange', () => { donutC && donutC.restyle(); barsC && barsC.restyle(); render(); });

  return {
    activate() { render(); donutC && donutC.replay(); barsC && barsC.replay(); growBars(); },
    deactivate() {},
    openBudgets,
  };
}
