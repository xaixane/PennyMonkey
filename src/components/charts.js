// Chart.js, tree-shaken to what the dashboard draws. Loaded lazily so first paint never waits on it.
import {
  Chart, DoughnutController, BarController, LineController, ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, Tooltip,
} from 'chart.js';
import { money, moneyCompact, compactRupees } from '../utils/format.js';

Chart.register(DoughnutController, BarController, LineController, ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);

const FONT = 'HelveticaLocal, Helvetica, sans-serif';
Chart.defaults.font.family = FONT;
Chart.defaults.font.size = 12;
Chart.defaults.font.weight = 400;
Chart.defaults.animation.duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500;
Chart.defaults.animation.easing = 'easeOutQuart';

const css = (el, n) => getComputedStyle(el).getPropertyValue(n).trim();
const compact = (n) => compactRupees(n);
const rgba = (hex, a) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`; };
const stagger = (step, cap) => (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? Math.min(ctx.dataIndex * step, cap) : 0);

// Tooltips are plain HTML appended to <body>, so no card's overflow:hidden can clip them.
// They sit to the right of the point and flip to its left near the window edge.
let tipEl = null;
const tipNode = () => {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.append(tipEl); }
  return tipEl;
};
const portal = (html) => ({ chart, tooltip }) => {
  const el = tipNode();
  if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) { el.classList.remove('on'); return; }
  el.innerHTML = html(tooltip);
  const r = chart.canvas.getBoundingClientRect();
  const x = r.left + tooltip.caretX, y = r.top + tooltip.caretY;
  const w = el.offsetWidth, h = el.offsetHeight;
  let left = x + 14;
  if (left + w > innerWidth - 8) left = x - w - 14;
  el.style.left = Math.max(8, left) + 'px';
  el.style.top = Math.min(Math.max(8, y - h / 2), innerHeight - h - 8) + 'px';
  el.classList.add('on');
};
addEventListener('scroll', () => tipEl?.classList.remove('on'), { passive: true, capture: true });

// Total spent, drawn in the hole of the donut. It shrinks to fit the hole, then falls back to a compact form (₹1.25L).
const centerText = {
  id: 'centerText',
  afterDatasetsDraw(chart) {
    const c = chart.$center;
    if (!c) return;
    const { ctx, chartArea: a } = chart, cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2;
    const arc = chart.getDatasetMeta(0).data[0];
    const hole = (arc ? arc.innerRadius : Math.min(a.right - a.left, a.bottom - a.top) * 0.33) * 2 * 0.8;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let text = c.value, size = 26;
    const width = () => { ctx.font = `600 ${size}px ${FONT}`; return ctx.measureText(text).width; };
    while (size > 13 && width() > hole) size -= 1;
    if (width() > hole && c.short) { text = c.short; size = 22; while (size > 13 && width() > hole) size -= 1; }
    ctx.fillStyle = css(chart.canvas, '--brand'); ctx.font = `600 ${size}px ${FONT}`;
    ctx.fillText(text, cx, cy - (c.label ? 7 : 0));
    if (c.label) { ctx.fillStyle = css(chart.canvas, '--text3'); ctx.font = `400 12px ${FONT}`; ctx.fillText(c.label, cx, cy + size * 0.65); }
    ctx.restore();
  },
};

// segs: [{label, value, color, text}]
export function createDonut(canvas, { onSelect }) {
  let texts = [];
  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: () => +css(canvas, '--c-stroke-w') || 0, borderColor: () => css(canvas, '--c-stroke') || 'transparent', borderRadius: 6, spacing: 3, offset: [], hoverOffset: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '66%', layout: { padding: 6 },
      animation: { delay: stagger(30, 150) },
      plugins: { legend: { display: false }, tooltip: { enabled: false, external: portal((t) => `<div class="tt">${t.title[0] || ''}</div><b>${texts[t.dataPoints[0].dataIndex]}</b>`) } },
      onClick: (_e, els) => onSelect(els.length ? els[0].index : -1),
    },
    plugins: [centerText],
  });
  return {
    set(segs, selected, center) {
      texts = segs.map((s) => s.text);
      chart.$center = center;
      chart.data.labels = segs.map((s) => s.label);
      const d = chart.data.datasets[0];
      d.data = segs.map((s) => s.value);
      d.backgroundColor = segs.map((s) => s.color);
      d.offset = segs.map((_, i) => (i === selected ? 8 : 0));
      chart.update();
    },
    restyle() { chart.update('none'); },
    replay() { chart.reset(); chart.update(); },
  };
}

// A "nice" ceiling just above the biggest bar (22,140 → 25,000), in rupees.
function niceMax(rupees) {
  if (rupees <= 0) return 1000;
  const mag = 10 ** Math.floor(Math.log10(rupees));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((f) => f * mag).find((v) => v >= rupees * 1.05);
}

// items: [{label, tip, value, text, count, ghost, ghostText}] in minor units.
// opts: {sel, peak, avg, compare}. Slim bars (zero days get none), dashed gridlines, an average line,
// last month's pace as faint outline bars behind, and one lime bar.
export function createBars(canvas, { onSelect }) {
  let items = [], sel = -1, peak = -1, avg = 0, compare = true, daily = true;
  const pal = {};
  const readPal = () => {
    for (const k of ['c1', 'c2', 'c-hover', 'c-ghost', 'c-avg', 'text', 'text3', 'brand', 'card', 'card2', 'edge-hi']) pal[k] = css(canvas, `--${k}`);
  };
  readPal();

  const dashed = {
    id: 'dashed',
    beforeDatasetsDraw(c) {
      const { ctx, chartArea: a, scales: { y } } = c;
      ctx.save();
      ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.strokeStyle = rgba(pal.text, 0.06);
      for (const t of y.ticks) {
        if (!t.value) continue;
        const py = Math.round(y.getPixelForValue(t.value)) + 0.5;
        ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      }
      ctx.restore();
    },
    afterDatasetsDraw(c) {
      const { ctx, chartArea: a, scales: { x, y } } = c;
      ctx.save();
      // average line + right-aligned label
      if (daily && avg > 0) {
        const py = Math.round(y.getPixelForValue(avg)) + 0.5;
        ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = pal['c-avg'];
        ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
        ctx.setLineDash([]);
        const text = `avg ${money(avg)}`;
        ctx.font = `400 11px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        const w = ctx.measureText(text).width;
        ctx.fillStyle = rgba(pal.card, 0.88); ctx.fillRect(a.right - w - 8, py - 17, w + 8, 15);
        ctx.fillStyle = pal.text3; ctx.fillText(text, a.right - 3, py - 4);
      }
      // floating label on the highest bar
      const it = items[peak];
      if (!daily) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        c.getDatasetMeta(1).data.forEach((bar, i) => {
          if (!items[i] || !items[i].value) return;
          ctx.font = `${i === sel ? 600 : 400} 11px ${FONT}`; // only the selected bar's figure is bold
          ctx.fillStyle = i === sel ? pal.brand : pal.text3;
          ctx.fillText(moneyCompact(items[i].value), bar.x, bar.y - 6);
        });
      } else if (it && it.value > 0) {
        const bar = c.getDatasetMeta(1).data[peak];
        if (bar) {
          const text = `${it.text} · ${it.tip}`;
          ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const w = ctx.measureText(text).width + 16, h = 20;
          const lx = Math.min(Math.max(bar.x, a.left + w / 2), a.right - w / 2), ly = bar.y - h / 2 - 6;
          ctx.fillStyle = pal.card2; ctx.strokeStyle = pal['edge-hi']; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(lx - w / 2, ly - h / 2, w, h, 10); ctx.fill(); ctx.stroke();
          ctx.fillStyle = pal.brand; ctx.fillText(text, lx, ly + 0.5);
        }
      }
      ctx.restore();
    },
  };

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: [], datasets: [
      // 0: last month, drawn behind as faint outlines
      { data: [], order: 1, grouped: false, backgroundColor: 'transparent', borderColor: () => pal['c-ghost'], borderWidth: 1, borderRadius: { topLeft: 6, topRight: 6 }, borderSkipped: 'bottom', barPercentage: 0.922, categoryPercentage: 1, maxBarThickness: 22 },
      // 1: this month
      { data: [], order: 0, grouped: false, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'bottom', barPercentage: 0.55, categoryPercentage: 1, maxBarThickness: 8,
        backgroundColor: (c) => (c.dataIndex === sel ? pal.c2 : pal.c1),
        hoverBackgroundColor: (c) => (c.dataIndex === sel ? pal.c2 : pal['c-hover']) },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 26, right: 2 } },
      animation: { delay: stagger(30, 600) },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, border: { display: false },
          ticks: { color: pal.text3, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: false, callback(v, i) { const l = this.getLabelForValue(v); return daily && !(+l === 1 || +l % 5 === 0) ? '' : l; } } },
        y: { beginAtZero: true, min: 0, grid: { display: false, drawTicks: false }, border: { display: false },
          ticks: { color: pal.text3, font: { family: FONT, size: 11 }, padding: 8, callback: (v) => (v ? compact(v / 100) : '') } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false, external: portal((t) => {
        const i = t.dataPoints[0].dataIndex, it = items[i];
        const n = it.count === 1 ? '1 transaction' : `${it.count} transactions`;
        return `<div class="tt">${it.tip}</div><b>${it.text}</b><div class="tc">${n}</div>${compare && it.ghostText ? `<div class="tc">${it.ghostText}</div>` : ''}`;
      }) } },
      onClick: (_e, els) => { const e = els.find((x) => x.datasetIndex === 1) || els[0]; if (e) onSelect(e.index); },
    },
    plugins: [dashed],
  });

  const apply = () => {
    const o = chart.options;
    o.scales.y.ticks.color = o.scales.x.ticks.color = pal.text3;
    chart.data.datasets[0].hidden = !(daily && compare);
  };
  return {
    set(list, opts) {
      items = list; ({ sel, peak, avg = 0, compare = true, daily = true } = opts);
      const max = Math.max(...items.map((i) => Math.max(i.value, daily && compare ? i.ghost || 0 : 0)), avg);
      // one huge day (rent) must not flatten the other thirty: scale to the typical day and clip the outlier
      const nz = items.map((i) => i.value).filter((v) => v > 0).sort((a, b) => a - b);
      const typical = nz.length ? nz[Math.floor(nz.length * 0.85)] : 0;
      const cap = niceMax((typical * 1.8) / 100) * 100;
      const top = daily && typical && max > cap * 1.4 ? cap : niceMax(max / 100) * 100;
      chart.options.scales.y.max = top;
      chart.options.scales.y.ticks.stepSize = top / 2;
      chart.data.labels = items.map((i) => i.label);
      chart.data.datasets[0].data = items.map((i) => i.ghost || null);
      const bars = chart.data.datasets[1];
      bars.data = items.map((i) => (i.value ? Math.min(i.value, top) : null)); // no bar on zero days; outliers are clipped
      bars.maxBarThickness = daily ? 18 : 56; bars.barPercentage = daily ? 0.72 : 0.6;
      bars.borderRadius = daily ? { topLeft: 6, topRight: 6 } : { topLeft: 12, topRight: 12 };
      chart.options.scales.y.ticks.display = daily;
      apply();
      chart.update();
    },
    restyle() { readPal(); apply(); chart.update('none'); },
    replay() { chart.reset(); chart.update(); },
  };
}

// Running total of spending through the month, with last month's pace as a dashed comparison.
// Line colours come from --spark / --spark-prev so the chart suits whichever card it sits on.
export function createSpark(canvas) {
  let names = ['', ''];
  const main = () => css(canvas, '--spark') || css(canvas, '--accent');
  const fill = () => css(canvas, '--spark-fill') || main();
  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [
      { data: [], borderColor: main(), borderWidth: 2, tension: 0.35, fill: true, pointRadius: 0, pointHoverRadius: 4, pointBackgroundColor: main(), pointBorderWidth: 0,
        backgroundColor: (c) => { const a = c.chart.chartArea; if (!a) return 'transparent'; const g = c.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); const k = +css(canvas, '--spark-a') || 0.28; g.addColorStop(0, rgba(fill(), k)); g.addColorStop(1, rgba(fill(), 0)); return g; } },
      { data: [], borderColor: css(canvas, '--spark-prev') || css(canvas, '--text3'), borderWidth: 1.5, borderDash: [4, 4], tension: 0.35, fill: false, pointRadius: 0, pointHoverRadius: 0 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 6, right: 6, bottom: 2, left: 2 } },
      interaction: { mode: 'index', intersect: false },
      scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
      plugins: { legend: { display: false }, tooltip: { enabled: false, external: portal((t) =>
        `<div class="tt">Day ${t.title[0]}</div>${t.dataPoints.filter((p) => p.parsed.y != null).map((p) => `<div class="tc">${names[p.datasetIndex]}</div><b>${money(p.parsed.y)}</b>`).join('')}`) } },
    },
  });
  return {
    set(labels, cur, prev, curName, prevName) {
      names = [curName, prevName];
      chart.data.labels = labels;
      chart.data.datasets[0].data = cur;
      chart.data.datasets[1].data = prev;
      const last = cur.reduce((acc, v, i) => (v == null ? acc : i), -1);
      chart.data.datasets[0].pointRadius = cur.map((_, i) => (i === last ? 4 : 0));
      chart.update();
    },
    restyle() {
      chart.data.datasets[0].borderColor = main(); chart.data.datasets[0].pointBackgroundColor = main();
      chart.data.datasets[1].borderColor = css(canvas, '--spark-prev') || css(canvas, '--text3');
      chart.update('none');
    },
    replay() { chart.reset(); chart.update(); },
  };
}
