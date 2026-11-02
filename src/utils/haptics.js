const v = (p) => {
  try { if (navigator.vibrate) navigator.vibrate(p); } catch (_) { /* unsupported */ }
};

export const tap = () => v(5);
export const success = () => v([10, 30, 10]);
export const del = () => v(20);
export const error = () => v([5, 50, 5, 50, 5]);
