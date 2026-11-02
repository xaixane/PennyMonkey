import { state, subscribe, monthSummary, monthExpenses, catById } from '../store.js';
import { money, moneyHTML, monthName, shiftMonth } from '../utils/format.js';
import { countUp } from '../utils/count.js';
import { fitWidth } from '../utils/fit-text.js';
import { ui } from '../utils/icons.js';

const cell = (label, value, title = '', tone = '') =>
  `<div class="kc" ${title ? `title="${title}"` : ''}><span class="kc-label">${label}</span><b class="kc-value ${tone}">${value}</b></div>`;

const daysIn = ({ y, m }) => new Date(y, m + 1, 0).getDate();

// Running total of spending by day. Days after `upto` are null so the line stops at today.
function cumulative(month, upto) {
  const days = daysIn(month), perDay = Array(days).fill(0);
  for (const e of monthExpenses(month)) if (e.type === 'debit') perDay[new Date(e.date).getDate() - 1] += e.amount;
  let run = 0;
  return perDay.map((v, i) => (i < upto ? (run += v) : null));
}

// Hero figure, then this month's pace against last month's, then a labelled grid of supporting numbers.
export function mountKpi(el) {
  el.innerHTML = `
    <div class="tile-head"><div class="th"><span class="caps kpi-title"></span></div><span class="kpi-pill"></span></div>
    <div class="kpi-hero"><b class="display kpi-num"></b></div>
    <div class="spark-wrap"><canvas class="spark"></canvas></div>
    <div class="kpi-grid"></div>`;
  const $ = (s) => el.querySelector(s);
  let spark = null;
  const fitNum = () => fitWidth($('.kpi-num'), () => $('.kpi-hero').clientWidth, 22);
  new ResizeObserver(fitNum).observe(el);
  import('./charts.js').then((m) => { spark = m.createSpark($('.spark')); drawSpark(); });

  function drawSpark() {
    if (!spark) return;
    const cur = state.month, pm = shiftMonth(cur, -1);
    const now = new Date();
    const isNow = cur.y === now.getFullYear() && cur.m === now.getMonth();
    const a = cumulative(cur, isNow ? now.getDate() : daysIn(cur)), b = cumulative(pm, daysIn(pm));
    const n = Math.max(a.length, b.length), pad = (arr) => [...arr, ...Array(n - arr.length).fill(null)];
    spark.set(Array.from({ length: n }, (_, i) => i + 1), pad(a), pad(b), monthName(cur), monthName(pm));
  }

  function render() {
    const cur = monthSummary(state.month);
    const pm = shiftMonth(state.month, -1);
    const prev = monthSummary(pm);
    const now = new Date();
    const isNow = state.month.y === now.getFullYear() && state.month.m === now.getMonth();
    const days = isNow ? now.getDate() : daysIn(state.month);

    $('.kpi-title').textContent = `Spent in ${monthName(state.month)}`;
    countUp($('.kpi-num'), cur.debit, moneyHTML, 650, fitNum);
    if (prev.debit) {
      const p = Math.round(((cur.debit - prev.debit) / prev.debit) * 100);
      $('.kpi-pill').innerHTML = `<span class="pill" title="Dashed line on the chart: ${monthName(pm)}">${ui(p >= 0 ? 'up' : 'down', 12, { sw: 2.5 })}${Math.abs(p)}% vs ${monthName(pm).slice(0, 3)}</span>`;
    } else $('.kpi-pill').innerHTML = '';

    const by = new Map();
    for (const e of monthExpenses()) if (e.type === 'debit') by.set(e.categoryId, (by.get(e.categoryId) || 0) + e.amount);
    const top = [...by.entries()].sort((x, y) => y[1] - x[1])[0];
    const topCat = top ? catById(top[0]) : null;
    const cells = [
      cell('Avg / day', money(Math.round(cur.debit / days / 100) * 100)),
      cell('Top category', topCat ? topCat.name : '–', top ? money(top[1]) : ''),
    ];
    // received more than you spent: show what was kept, as a positive figure
    if (cur.credit) cells.push(cur.net > 0
      ? cell('Net spent', money(cur.net), `Received ${money(cur.credit)}`, 'bad')
      : cell('Saved', money(-cur.net), `Received ${money(cur.credit)}, spent ${money(cur.debit)}`, 'good'));
    const grid = $('.kpi-grid');
    grid.style.setProperty('--n', cells.length);
    grid.innerHTML = cells.join('');
    drawSpark();
  }
  subscribe((k) => { if (k.has('expenses') || k.has('month')) render(); });
  addEventListener('themechange', () => spark && spark.restyle());
  render();
}
