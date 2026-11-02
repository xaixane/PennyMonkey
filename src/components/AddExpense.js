import { state, subscribe, addExpense, addCategory, catById, goToMonth } from '../store.js';
import { SYMBOL, groupInt, toMinor, esc, atDay, dayLabel } from '../utils/format.js';
import * as haptics from '../utils/haptics.js';
import { mountKeypad } from './NumericKeypad.js';
import { chipHTML, newChipHTML, popChip } from './CategoryChip.js';
import { openSheet } from './BottomSheet.js';
import { icon, ui, PICKABLE } from '../utils/icons.js';
import { fitWidth } from '../utils/fit-text.js';
import { openCalendar } from './Calendar.js';

const CHECK = ui('check', 28, { sw: 3, cls: 'check' });
const TITLES = ['Amount', 'Category', 'Note & date'];
const isDrawer = matchMedia('(min-width: 768px)'); // on desktop this tile is a slide-over drawer

// Three short steps instead of one crowded form: amount → category → note (optional).
export function mountAdd(root) {
  root.innerHTML = `
    <div class="tile-head add-head">
      <button class="icon-btn back" aria-label="Back" hidden>${ui('left', 18)}</button>
      <span class="caps add-title">${TITLES[0]}</span>
      <span class="step-of label">Step 1 of 3</span>
      <button class="icon-btn theme-btn" data-settings-open aria-label="Settings">${ui('settings', 16)}</button>
    </div>
    <div class="add-body" data-step="0">
      <div class="amount-wrap"><span class="cur">${SYMBOL}</span><div class="amount" aria-live="polite"></div><span class="kind"></span></div>

      <div class="step" data-step="0">
        <div class="toggle" data-type="debit">
          <div class="thumb"></div>
          <button data-t="debit">Debit</button><button data-t="credit">Credit</button>
        </div>
        <div class="keypad-slot"></div>
      </div>

      <div class="step" data-step="1" hidden>
        <p class="hint">Which category?</p>
        <div class="chips"></div>
      </div>

      <div class="step" data-step="2" hidden>
        <button class="chip sel cat-sum" aria-label="Change category"></button>
        <input class="note" type="text" enterkeyhint="done" autocomplete="off" placeholder="Add a note (optional)" maxlength="80" />
        <p class="hint">Date</p>
        <div class="tags dates">
          <button class="tag on" data-day="0">Today</button>
          <button class="tag" data-day="-1">Yesterday</button>
          <button class="tag" data-day="1">Tomorrow</button>
          <button class="tag pick-date" data-pick>${ui('calendar', 14)}<span class="pd-label">Pick date</span></button>
        </div>
      </div>

      <button class="btn primary add-btn" data-ripple><span class="lbl">Continue</span>${CHECK}</button>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const body = $('.add-body'), amtEl = $('.amount'), amountWrap = $('.amount-wrap'), toggle = $('.toggle'), chips = $('.chips');
  const note = $('.note'), addBtn = $('.add-btn'), lbl = $('.lbl'), back = $('.back'), title = $('.add-title'), kind = $('.kind'), catSum = $('.cat-sum');
  const panels = [...root.querySelectorAll('.step')], stepOf = $('.step-of');
  const dateTags = [...root.querySelectorAll('.dates .tag')], pdLabel = $('.pd-label');

  // the typed amount shrinks so nine digits still fit beside the ₹ sign and the Debit/Credit tag
  const fitAmount = () => fitWidth(amtEl, () => amountWrap.clientWidth - $('.cur').offsetWidth - (kind.offsetWidth || 0) - 24, 26);
  let raw = '', type = 'debit', sel = null, shown = '', step = 0, dayOffset = 0, custom = null;

  function renderAmount() {
    const [i, d] = raw.split('.');
    const text = groupInt(i || '0') + (d !== undefined ? '.' + d : '');
    if (text === shown) return;
    const grew = text.length > shown.length && text.startsWith(shown.slice(0, -1));
    amtEl.classList.toggle('zero', !raw);
    // Only the newly typed glyph animates; existing ones stay put.
    const keep = grew ? shown.length : text.length;
    amtEl.innerHTML = [...text].map((ch, n) => `<span${n >= keep ? ' class="dg"' : ''}>${ch}</span>`).join('');
    shown = text;
    fitAmount();
  }

  function onKey(k) {
    if (k === 'back') raw = raw.slice(0, -1);
    else if (k === '.') { if (!raw.includes('.')) raw = (raw || '0') + '.'; }
    else {
      const [i, d] = raw.split('.');
      if (d !== undefined ? d.length >= 2 : i.length >= 9) return;
      raw = raw === '0' ? k : raw + k;
    }
    renderAmount();
  }
  mountKeypad($('.keypad-slot'), onKey);

  toggle.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b || b.dataset.t === type) return;
    haptics.tap();
    type = toggle.dataset.type = b.dataset.t;
  });

  // ---- steps ----
  function go(n) {
    const dir = n > step ? 1 : -1;
    step = n;
    body.dataset.step = n;
    amtEl.style.fontSize = '';
    panels.forEach((p, i) => { p.hidden = i !== n; });
    const p = panels[n];
    p.classList.remove('slide-l', 'slide-r'); p.offsetWidth; p.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    title.textContent = TITLES[n];
    back.hidden = n === 0;
    stepOf.textContent = `Step ${n + 1} of 3`;
    requestAnimationFrame(fitAmount);
    lbl.textContent = n === 2 ? 'Add expense' : 'Continue';
    kind.textContent = type === 'debit' ? 'Debit' : 'Credit';
    if (n === 2) {
      const c = catById(sel);
      catSum.innerHTML = c ? `<span class="ci">${icon(c.icon, 14)}</span><span>${esc(c.name)}</span>` : '';
      if (matchMedia('(pointer: fine)').matches) setTimeout(() => step === 2 && note.focus(), 260);
    }
  }
  // ---- date ----
  const when = () => (custom ? atDay(custom, 0) : atDay(Date.now(), dayOffset));
  function setDate(offset, customValue) {
    dayOffset = offset; custom = customValue || null;
    dateTags.forEach((t) => t.classList.toggle('on', custom ? t.classList.contains('pick-date') : t.dataset.day === String(offset)));
    pdLabel.textContent = custom ? dayLabel(custom.getTime()) : 'Pick date';
  }
  root.querySelector('.dates').addEventListener('click', (e) => {
    const t = e.target.closest('[data-day]');
    if (t) { haptics.tap(); setDate(+t.dataset.day); return; }
    if (e.target.closest('[data-pick]')) { haptics.tap(); openCalendar({ value: custom, onPick: (d) => setDate(0, d) }); }
  });

  back.addEventListener('click', () => { haptics.tap(); go(step - 1); });
  catSum.addEventListener('click', () => { haptics.tap(); go(1); });

  // ---- categories ----
  function renderChips() {
    chips.innerHTML = state.categories.map((c) => chipHTML(c, c.id === sel)).join('') + newChipHTML();
  }
  chips.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.chip');
    if (!b || b.dataset.new !== undefined) return;
    haptics.tap();
    chips.querySelector('.sel')?.classList.remove('sel');
    b.classList.add('sel');
    popChip(b);
    sel = b.dataset.id;
  });
  chips.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) return openNewCategory();
    const b = e.target.closest('.chip[data-id]');
    if (!b) return;
    sel = b.dataset.id;
    setTimeout(() => step === 1 && go(2), 170); // let the selection pop land, then move on
  });

  function openNewCategory() {
    const c = document.createElement('div');
    c.className = 'sheet-body';
    let pickedIcon = PICKABLE[0];
    c.innerHTML = `<h3>New category</h3>
      <input class="field" placeholder="Name" maxlength="20" />
      <div class="pick">${PICKABLE.map((k, i) => `<button class="opt${i ? '' : ' sel'}" data-icon="${k}" aria-label="${k}">${icon(k, 22)}</button>`).join('')}</div>
      <button class="btn primary" data-ripple data-save>Create</button>`;
    const name = c.querySelector('.field');
    const s = openSheet(c);
    c.addEventListener('click', (e) => {
      const o = e.target.closest('.opt');
      if (o) {
        o.parentElement.querySelector('.sel')?.classList.remove('sel');
        o.classList.add('sel');
        popChip(o);
        pickedIcon = o.dataset.icon || pickedIcon;
        return;
      }
      if (e.target.closest('[data-save]')) {
        const n = name.value.trim();
        if (!n) { haptics.error(); name.classList.remove('shake'); name.offsetWidth; name.classList.add('shake'); return; }
        sel = addCategory({ name: n, icon: pickedIcon, color: '#888' }).id;
        s.close();
        setTimeout(() => step === 1 && go(2), 380);
      }
    });
  }

  const shake = (el) => { el.classList.remove('shake'); el.offsetWidth; el.classList.add('shake'); haptics.error(); };

  // ---- primary button: Continue → Continue → Add expense ----
  addBtn.addEventListener('click', () => {
    if (step === 0) { if (toMinor(raw) <= 0) return shake(amountWrap); haptics.tap(); return go(1); }
    if (step === 1) { if (!sel) return shake(chips); haptics.tap(); return go(2); }
    const date = when();
    addExpense({ amount: toMinor(raw), type, categoryId: sel, note: note.value, date });
    const d = new Date(date);
    goToMonth({ y: d.getFullYear(), m: d.getMonth() }); // so a back-dated entry is visible straight away
    haptics.success();
    addBtn.classList.add('ok');
    setTimeout(() => addBtn.classList.remove('ok'), 600);
    raw = ''; note.value = ''; shown = '';
    renderAmount();
    setDate(0);
    go(0); // the last category stays selected for next time
    dispatchEvent(new Event('add:done'));
  });
  note.addEventListener('keydown', (e) => { if (e.key === 'Enter') { note.blur(); addBtn.click(); } });

  // Desktop: type straight into the amount; Enter continues; Backspace steps back.
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) return;
    if (document.getElementById('sheet-root').childElementCount) return;
    const open = isDrawer.matches ? document.body.classList.contains('add-open') : !root.closest('[inert]');
    if (!open) {
      // desktop: typing a digit anywhere opens the drawer and starts the amount
      if (!(isDrawer.matches && step === 0 && /^[0-9.]$/.test(e.key))) return;
      dispatchEvent(new Event('add:open'));
    }
    if (step === 0 && /^[0-9.]$/.test(e.key)) onKey(e.key);
    else if (e.key === 'Backspace') step === 0 ? onKey('back') : go(step - 1);
    else if (e.key === 'Enter') addBtn.click();
    else return;
    e.preventDefault();
  });
  root.addEventListener('animationend', (e) => e.target.classList.remove('shake'));

  addEventListener('themechange', renderChips);
  subscribe((k) => {
    if (!k.has('categories')) return;
    if (sel && !state.categories.some((c) => c.id === sel)) sel = null;
    renderChips();
  });
  renderAmount();
}
