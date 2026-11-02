import { ui } from '../utils/icons.js';
import * as haptics from '../utils/haptics.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

// Fires on pointerdown (not click) so feedback lands within a frame of the touch.
export function mountKeypad(el, onKey) {
  el.className = 'keypad';
  el.innerHTML = KEYS.map((k) =>
    `<button class="key" data-k="${k}" data-ripple aria-label="${k === 'back' ? 'Backspace' : k}">${k === 'back' ? ui('backspace', 26) : k}</button>`).join('');
  el.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.key');
    if (!b) return;
    haptics.tap();
    onKey(b.dataset.k);
  });
}
