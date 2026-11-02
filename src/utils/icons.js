// Icons come from Lucide (tree-shaken: only the ones imported here ship).
import {
  Utensils, Car, ShoppingBag, Zap, HeartPulse, Clapperboard, Ellipsis, Coffee, House, Gift, BookOpen, Music, Plane,
  ShoppingCart, Briefcase, Gamepad2, Dumbbell, Receipt,
  Plus, List, Gauge, Pencil, LayoutGrid, ArrowUp, ArrowDown, Settings2, Palette, ChevronLeft, ChevronRight, ChevronDown, Calendar, Check, Delete, Asterisk, ChartColumn, Menu, User, ListFilter,
} from 'lucide';

// Category icons, stored by key on each category.
const CAT = {
  food: Utensils, transport: Car, shopping: ShoppingBag, bills: Zap, health: HeartPulse, entertainment: Clapperboard, other: Ellipsis,
  coffee: Coffee, home: House, gift: Gift, book: BookOpen, music: Music, plane: Plane, cart: ShoppingCart, briefcase: Briefcase,
  gamepad: Gamepad2, dumbbell: Dumbbell, receipt: Receipt,
};
// Interface icons.
const UI = { plus: Plus, list: List, gauge: Gauge, palette: Palette, left: ChevronLeft, right: ChevronRight, down: ChevronDown, calendar: Calendar, check: Check, backspace: Delete, logo: Asterisk, chart: ChartColumn, menu: Menu, pencil: Pencil, grid: LayoutGrid, up: ArrowUp, down: ArrowDown, settings: Settings2, user: User, filter: ListFilter };

export const PICKABLE = ['coffee', 'home', 'gift', 'book', 'music', 'plane', 'cart', 'briefcase', 'gamepad', 'dumbbell', 'receipt', 'health'];
export const hasIcon = (k) => k in CAT;

const render = (node, size, sw, cls) =>
  `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('') + '</svg>';

export function icon(key, size = 20) {
  if (!CAT[key]) return `<span class="ic-fallback">${String(key).slice(0, 2)}</span>`; // legacy emoji data
  return render(CAT[key], size, 1.75, 'ic');
}

export const ui = (name, size = 20, { sw = 1.75, cls = 'ic' } = {}) => render(UI[name], size, sw, cls);
