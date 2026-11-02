// Show only the rows that fit the box's height; hide the rest and surface a "+N more" button.
// The box must be position:relative with a definite (flex/grid) height and overflow hidden.
export function fit(box) {
  const more = box.querySelector('.more');
  const rows = [...box.children].filter((c) => c !== more);
  rows.forEach((r) => { r.hidden = false; });
  if (more) more.hidden = true;
  const H = box.clientHeight;
  const last = rows[rows.length - 1];
  const idle = box.dataset.idle;
  const extra0 = +(box.dataset.extra || 0);
  if (!last || last.offsetTop + last.offsetHeight <= H) {
    if (more && extra0) { more.hidden = false; more.textContent = `+${extra0} more`; }
    else if (more && idle) { more.hidden = false; more.textContent = idle; }
    return;
  }
  const limit = H - (more ? more.offsetHeight || 36 : 0);
  let hid = 0, cut = false;
  for (const r of rows) {
    if (!cut && r.offsetTop + r.offsetHeight > limit) cut = true;
    if (cut) { r.hidden = true; if (!r.classList.contains('day-label')) hid++; }
  }
  // a day label with no row under it is just noise
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].classList.contains('day-label') && (!rows[i + 1] || rows[i + 1].hidden)) rows[i].hidden = true;
  }
  const extra = +(box.dataset.extra || 0);
  if (more && hid + extra) { more.hidden = false; more.textContent = `+${hid + extra} more`; }
}

export function autoFit(box, { idle } = {}) {
  if (idle) box.dataset.idle = idle;
  const ro = new ResizeObserver(() => fit(box));
  ro.observe(box);
  return () => fit(box);
}
