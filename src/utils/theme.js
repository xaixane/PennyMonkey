// Penny Monkey (the default), two neutral themes (Dark, Light) with the coin green as the accent, plus Coffee, Prussian and Glow.
export const THEMES = [
  { id: 'pennymonkey', name: 'Penny Monkey', note: 'Warm white with coin green and monkey brown', swatch: ['#f7f5ef', '#4b3427', '#5ab951'], bar: '#f7f5ef' },
  { id: 'dark', name: 'Dark', note: 'Lime on midnight: navy-black, slate cards, one lime accent', swatch: ['#0d1118', '#1f2530', '#8df20a'], bar: '#0d1118' },
  { id: 'light', name: 'Light', note: 'Clean white with a coin-green accent', swatch: ['#f4f4f5', '#ffffff', '#5ab951'], bar: '#f4f4f5' },
  { id: 'coffee', name: 'Coffee', note: 'Cream, nude brown and espresso', swatch: ['#efe3d3', '#ead9c3', '#8b5a3c'], bar: '#efe3d3' },
  { id: 'prussian', name: 'Prussian', note: 'Black with Prussian blue depth', swatch: ['#031130', '#185df1', '#f3f7fe'], bar: '#020a1c' },
  { id: 'glow', name: 'Glow', note: 'Pure black with glass cards lit from below', swatch: ['#000000', '#0d1119', '#1fe05c'], bar: '#000000' },
  { id: 'frosted', name: 'Frosted Glass', note: 'Dark glassmorphism: frosted panes over a vivid gradient', swatch: ['#2a1456', '#ff7040', '#3d9bff'], bar: '#0a0b1c' },
  { id: 'frostedlight', name: 'Frosted Glass Light', note: 'Light glassmorphism: white frosted panes over pastels', swatch: ['#bcd8ff', '#ffb078', '#c496ff'], bar: '#efe9fb' },
  { id: 'brutal', name: 'Brutal', note: 'Flat colour, thick outlines, hard shadows', swatch: ['#c8f550', '#84d9ff', '#ff9fd2'], bar: '#efeeea' },
];
const KEY = 'spendly-theme-v3';

export function currentTheme() {
  try {
    const id = localStorage.getItem(KEY);
    if (id === 'lime') return 'dark'; // the old name for the dark theme
    if (id === 'glass' || id === 'aerodark') return 'frosted'; // the Aero and Liquid Glass themes became the frosted-glass ones
    if (id === 'glasslight' || id === 'aero') return 'frostedlight';
    if (THEMES.some((t) => t.id === id)) return id;
  } catch (_) { /* private mode */ }
  return 'pennymonkey';
}

export function applyTheme(id, { save = true } = {}) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  const root = document.documentElement;
  t.id === 'dark' ? root.removeAttribute('data-theme') : (root.dataset.theme = t.id);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = t.bar;
  if (save) { try { localStorage.setItem(KEY, t.id); } catch (_) { /* private mode */ } }
  dispatchEvent(new Event('themechange'));
}

// The donut and legend are coloured by rank, not by category: the biggest slice is the brand colour and
// the rest step down through the theme's neutrals (--rank-1 … --rank-5).
export const rankColor = (i, el = document.documentElement) => getComputedStyle(el).getPropertyValue(`--rank-${Math.min(i, 4) + 1}`).trim() || '#8e8e93';
