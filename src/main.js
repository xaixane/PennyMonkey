import './styles/base.css';
import './styles/animations.css';
import './styles/components.css';
import { init } from './store.js';
import * as haptics from './utils/haptics.js';
import { mountTabBar } from './components/TabBar.js';
import { mountFilters } from './components/Filters.js';
import { mountAdd } from './components/AddExpense.js';
import { mountKpi } from './components/Kpi.js';
import { mountShell } from './components/Shell.js';
import { mountTransactions, openActivity } from './components/TransactionList.js';
import { mountInsights } from './components/Analytics.js';
import { openSettings } from './components/Settings.js';
import { loadDemo, addNovemberTestEntries } from './demo.js';

const $ = (id) => document.getElementById(id);
const views = $('views');
const panes = [...views.children];
let current = 0;

mountFilters();
mountAdd($('t-add'));
mountKpi($('t-spent'));
mountTransactions($('t-tx'));
const insights = mountInsights({ donutEl: $('t-donut'), trendEl: $('t-trend'), budgetEl: $('t-budget') });

mountShell({ onActivity: () => openActivity(null), onBudgets: () => insights.openBudgets() });
const setTab = mountTabBar($('tabbar'), go);

// >=768px: every tile is on screen at once (panes are display:contents), so tabs/inert are bypassed.
const wide = matchMedia('(min-width: 768px)');

function go(i) {
  if (i === current) return;
  current = i;
  views.style.transform = `translate3d(${-i * 100}%,0,0)`;
  panes.forEach((p, j) => p.toggleAttribute('inert', j !== i));
  i === 2 ? insights.activate() : insights.deactivate();
  setTab(i);
}

// On desktop the Add flow is a slide-over drawer: closed it is inert (no tab stops), open it takes focus.
const drawer = $('t-add');
function openAdd() {
  if (!wide.matches) return;
  document.body.classList.add('add-open');
  drawer.removeAttribute('inert');
}
function closeAdd() {
  document.body.classList.remove('add-open');
  if (wide.matches) drawer.setAttribute('inert', '');
}
addEventListener('add:open', openAdd);
addEventListener('add:done', () => wide.matches && setTimeout(closeAdd, 700)); // let the checkmark land first
$('scrim').addEventListener('click', closeAdd);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('add-open') && !$('sheet-root').childElementCount) closeAdd(); });

function layout() {
  if (wide.matches) {
    panes.forEach((p) => p.removeAttribute('inert'));
    document.body.classList.contains('add-open') ? drawer.removeAttribute('inert') : drawer.setAttribute('inert', '');
    insights.activate();
  } else {
    document.body.classList.remove('add-open');
    drawer.removeAttribute('inert');
    panes.forEach((p, j) => p.toggleAttribute('inert', j !== current));
    current === 2 ? insights.activate() : insights.deactivate();
  }
}
wide.addEventListener('change', layout);
layout();

// Settings: the rail button on desktop, the button in the Add header on phones
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-settings-open]')) return;
  haptics.tap();
  openSettings();
});

// Material-style ripple, delegated so every [data-ripple] gets it for free.
document.addEventListener('pointerdown', (e) => {
  const host = e.target.closest('[data-ripple]');
  if (!host) return;
  const r = host.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  host.append(s);
  s.addEventListener('animationend', () => s.remove(), { once: true });
}, { passive: true });
document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS

// First load of this version: replace whatever is stored with seven months of test data (once).
init().then(() => {
  try {
    if (localStorage.getItem('spendly-demo-v1')) return;
    localStorage.setItem('spendly-demo-v1', '1');
    return loadDemo();
  } catch (_) { /* storage unavailable */ }
}).then(() => {
  // One-time: add a full month of November test entries (appended, so existing data stays).
  try {
    if (localStorage.getItem('spendly-nov-v1')) return;
    localStorage.setItem('spendly-nov-v1', '1');
    addNovemberTestEntries();
  } catch (_) { /* storage unavailable */ }
});
// Canvas text needs the faces loaded before it can use them.
document.fonts?.ready.then(() => dispatchEvent(new Event('themechange')));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
