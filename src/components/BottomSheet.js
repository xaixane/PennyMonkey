import * as haptics from '../utils/haptics.js';
import { ui } from '../utils/icons.js';

const root = () => document.getElementById('sheet-root');

// Every open sheet owns one history entry, so the phone's back gesture/button closes the top sheet instead of leaving the app.
const stack = [];
let selfPops = 0; // history.back() calls we made ourselves; their popstate must not close another sheet
addEventListener('popstate', () => {
  if (selfPops > 0) { selfPops--; return; }
  stack[stack.length - 1]?.(true);
});

// Opens a bottom sheet around `content`. Drag the grip down, tap Back or the backdrop, or use the system back to dismiss.
export function openSheet(content, { onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="backdrop"></div><div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet-nav"><button class="sheet-back" aria-label="Back">${ui('left', 20, { sw: 2.25 })}<span>Back</span></button><div class="grip"><i></i></div><span class="sheet-nav-gap"></span></div>
    <div class="sheet-scroll"></div></div>`;
  const sheet = wrap.querySelector('.sheet');
  const backdrop = wrap.querySelector('.backdrop');
  wrap.querySelector('.sheet-scroll').append(content);
  root().append(wrap);
  wrap.offsetHeight; // commit initial transform so the open transition runs
  wrap.classList.add('open');

  let closed = false, pushed = false;
  const close = (fromPop = false) => {
    if (closed) return;
    closed = true;
    const at = stack.indexOf(close);
    if (at >= 0) stack.splice(at, 1);
    if (pushed && fromPop !== true) { try { selfPops++; history.back(); } catch (_) { selfPops--; } }
    wrap.classList.remove('open');
    sheet.style.transform = '';
    backdrop.style.opacity = '';
    setTimeout(() => { wrap.remove(); onClose && onClose(); }, 380);
  };
  try { history.pushState({ sheet: true }, ''); pushed = true; stack.push(close); } catch (_) { /* no history (sandboxed frame) */ }
  backdrop.addEventListener('pointerdown', () => close());
  wrap.querySelector('.sheet-back').addEventListener('click', () => { haptics.tap(); close(); });

  let startY = 0, lastY = 0, lastT = 0, vel = 0, dragging = false, h = 1;
  const grip = sheet.querySelector('.grip');
  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    h = sheet.offsetHeight;
    grip.setPointerCapture(e.pointerId);
    sheet.style.transition = backdrop.style.transition = 'none';
  });
  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);
    vel = (e.clientY - lastY) / Math.max(1, e.timeStamp - lastT);
    lastY = e.clientY; lastT = e.timeStamp;
    sheet.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(1 - Math.min(1, dy / h));
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = backdrop.style.transition = '';
    const dy = Math.max(0, e.clientY - startY);
    if (dy > h * 0.35 || vel > 0.6) { haptics.tap(); close(); }
    else { sheet.style.transform = ''; backdrop.style.opacity = ''; }
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  return { close: () => close(), el: sheet };
}

// Promise-based replacement for window.confirm().
export function confirmSheet({ title, text = '', confirmLabel = 'Delete' }) {
  return new Promise((resolve) => {
    const c = document.createElement('div');
    c.className = 'sheet-body';
    c.innerHTML = `<h3></h3><p class="muted"></p>
      <div class="row-btns"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes"></button></div>`;
    c.querySelector('h3').textContent = title;
    c.querySelector('p').textContent = text;
    c.querySelector('[data-a=yes]').textContent = confirmLabel;
    let answer = false;
    const s = openSheet(c, { onClose: () => resolve(answer) });
    c.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      answer = a.dataset.a === 'yes';
      s.close();
    });
  });
}
