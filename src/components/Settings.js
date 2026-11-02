import { openSheet, confirmSheet } from './BottomSheet.js';
import * as haptics from '../utils/haptics.js';
import { ui } from '../utils/icons.js';
import { THEMES, currentTheme, applyTheme } from '../utils/theme.js';
import { loadDemo, deleteAll } from '../demo.js';

// Theme, plus tools for the test data.
export function openSettings() {
  const c = document.createElement('div');
  c.className = 'sheet-body';
  const cur = currentTheme();
  c.innerHTML = `<h3>Settings</h3>
    <p class="hint">Theme</p>
    <div class="theme-list">${THEMES.map((t) => `
      <button class="theme-opt${t.id === cur ? ' sel' : ''}" data-theme-id="${t.id}">
        <span class="swatch" style="background:${t.swatch[0]}"><i style="background:${t.swatch[1]}"></i><i style="background:${t.swatch[2]}"></i></span>
        <span class="t-name">${t.name}<small>${t.note}</small></span>
        ${ui('check', 20, { sw: 2.5, cls: 'tick' })}
      </button>`).join('')}</div>
    <p class="hint">Data</p>
    <div class="data-actions">
      <button class="btn ghost" data-demo>Replace with 7 months of test data</button>
      <button class="btn ghost" data-clear>Delete all expenses</button>
    </div>`;
  const s = openSheet(c);

  c.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-theme-id]');
    if (t) {
      haptics.tap();
      c.querySelectorAll('.theme-opt').forEach((o) => o.classList.toggle('sel', o === t));
      applyTheme(t.dataset.themeId);
      return;
    }
    if (e.target.closest('[data-demo]')) {
      if (await confirmSheet({ title: 'Replace all expenses?', text: 'Everything you have added is removed and replaced with seven months of random test data.', confirmLabel: 'Replace' })) {
        haptics.success(); await loadDemo(); s.close();
      }
    } else if (e.target.closest('[data-clear]')) {
      if (await confirmSheet({ title: 'Delete all expenses?', text: 'This removes every expense and can’t be undone.', confirmLabel: 'Delete all' })) {
        haptics.del(); await deleteAll(); s.close();
      }
    }
  });
}
