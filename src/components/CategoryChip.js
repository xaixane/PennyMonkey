import { esc } from '../utils/format.js';
import { icon, ui } from '../utils/icons.js';

export const chipHTML = (c, selected) =>
  `<button class="chip${selected ? ' sel' : ''}" data-id="${c.id}" data-ripple><span class="ci">${icon(c.icon, 18)}</span><span>${esc(c.name)}</span></button>`;

export const newChipHTML = () =>
  `<button class="chip new" data-new data-ripple>${ui('plus', 18)}<span>New</span></button>`;

export function popChip(el) {
  el.classList.remove('pop');
  el.offsetWidth;
  el.classList.add('pop');
}
