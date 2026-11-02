export const SYMBOL = '₹';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Indian digit grouping: 1,24,816 (last three digits, then pairs).
export const groupInt = (s) => {
  s = String(s);
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + s.slice(-3);
};

// Short forms for tight spaces: ₹12.5k, ₹1.25L, ₹2.4Cr. `rupees` is a plain rupee number.
export const compactRupees = (rupees) => {
  const n = Math.abs(rupees), t = (v) => String(+v.toFixed(2));
  return n >= 1e7 ? t(n / 1e7) + 'Cr' : n >= 1e5 ? t(n / 1e5) + 'L' : n >= 1e3 ? t(n / 1e3) + 'k' : String(Math.round(n));
};
export const moneyCompact = (minor) => (minor < 0 ? '−' : '') + SYMBOL + compactRupees(minor / 100);

// amount is in minor units (paise/cents)
export function money(minor, { sign = false } = {}) {
  const a = Math.abs(minor);
  const whole = Math.floor(a / 100);
  const frac = a % 100;
  const body = SYMBOL + groupInt(whole) + (frac ? '.' + String(frac).padStart(2, '0') : '');
  if (minor < 0) return '−' + body;
  return sign && minor > 0 ? '+' + body : body;
}

export const monthLabel = ({ y, m }) => `${MONTHS[m]} ${y}`;
export const monthName = ({ m }) => MONTHS[m];
export const monthShort = (m) => MONTHS[m].slice(0, 3);
export const dayLabel = (ts) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export const currentMonth = () => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
};

export const shiftMonth = ({ y, m }, delta) => {
  const t = y * 12 + m + delta;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
};

export const inMonth = (ts, { y, m }) => {
  const d = new Date(ts);
  return d.getFullYear() === y && d.getMonth() === m;
};

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Parse a typed decimal string ("12.5") into minor units.
export const toMinor = (s) => Math.round(parseFloat(s || '0') * 100) || 0;

// "Today" / "Yesterday" / "Tomorrow" / "27 Oct"
export const relDay = (ts) => {
  const a = new Date(ts), b = new Date();
  const d = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 864e5);
  return d === 0 ? 'Today' : d === -1 ? 'Yesterday' : d === 1 ? 'Tomorrow' : dayLabel(ts);
};

// The same calendar day as `base`, at the current time of day (so same-day entries keep a sensible order).
export const atDay = (base, offsetDays = 0) => {
  const n = new Date(), d = new Date(base);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays, n.getHours(), n.getMinutes(), n.getSeconds()).getTime();
};

// Money with a smaller, lighter rupee sign, for hero figures.
export const moneyHTML = (minor) => `${minor < 0 ? '−' : ''}<span class="sym">${SYMBOL}</span>${money(Math.abs(minor)).replace(SYMBOL, '')}`;

// "2:14 PM"
export const timeLabel = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
