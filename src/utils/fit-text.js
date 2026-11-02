// Shrink a figure until it fits. `room()` returns the width available to it, in px.
export function fitWidth(el, room, min = 14) {
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  const limit = room();
  while (size > min && el.getBoundingClientRect().width > limit) {
    size -= 2;
    el.style.fontSize = size + 'px';
  }
}
