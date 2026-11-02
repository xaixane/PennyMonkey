import * as db from './db.js';
import { currentMonth, shiftMonth, inMonth } from './utils/format.js';
import { hasIcon } from './utils/icons.js';

const DEFAULTS = [
  ['Food', 'food', '#ff8a3d'],
  ['Transport', 'transport', '#5b8cff'],
  ['Shopping', 'shopping', '#f472b6'],
  ['Bills', 'bills', '#facc15'],
  ['Health', 'health', '#ff6b6b'],
  ['Entertainment', 'entertainment', '#a78bfa'],
  ['Other', 'other', '#8e8e93'],
];

const GREYS = new Set(['#888', '#8a8a92']);
// colours handed to new categories, in rotation (greys excluded so each one is distinct)
const PALETTE = ['#2dd4bf', '#38bdf8', '#fb7185', '#c084fc', '#f59e0b', '#4ade80', '#e879f9', '#60a5fa'];

export const state = {
  categories: [],
  expenses: [], // newest first
  month: currentMonth(),
  dir: 0, // last month-navigation direction, for slide animation
};

const listeners = new Set();
let pending = new Set();
let scheduled = false;

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function emit(kind) {
  pending.add(kind);
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const kinds = pending;
    pending = new Set();
    listeners.forEach((fn) => fn(kinds));
  });
}

export async function init() {
  const [cats, exps] = await Promise.all([db.getAll('categories'), db.getAll('expenses')]);
  if (!cats.length) {
    DEFAULTS.forEach(([name, icon, color], order) => {
      const c = { id: crypto.randomUUID(), name, icon, color, budget: null, order };
      cats.push(c);
      db.put('categories', c);
    });
  }
  // Migrate emoji icons from earlier builds to line-icon keys.
  for (const c of cats) {
    if (hasIcon(c.icon)) continue;
    const d = DEFAULTS.find(([n]) => n === c.name);
    c.icon = d ? d[1] : 'other';
    db.put('categories', c);
  }
  // Give every category its own colour (older data was all grey).
  cats.sort((a, b) => a.order - b.order);
  cats.forEach((c, i) => {
    if (c.color && !GREYS.has(c.color)) return;
    const d = DEFAULTS.find(([n]) => n === c.name);
    c.color = d ? d[2] : PALETTE[i % PALETTE.length];
    db.put('categories', c);
  });
  state.categories = cats;
  state.expenses = exps.sort((a, b) => b.date - a.date);
  emit('categories');
  emit('expenses');
}

export const catById = (id) => state.categories.find((c) => c.id === id);
export const monthExpenses = (month = state.month) => state.expenses.filter((e) => inMonth(e.date, month));

export function monthSummary(month = state.month) {
  let debit = 0, credit = 0;
  for (const e of state.expenses) if (inMonth(e.date, month)) e.type === 'debit' ? (debit += e.amount) : (credit += e.amount);
  return { debit, credit, net: debit - credit };
}

// `date` is a timestamp for the day the money moved (defaults to now); the list stays newest-first.
export function addExpense({ amount, type, categoryId, note, date }) {
  const now = Date.now();
  const e = { id: crypto.randomUUID(), amount, type, categoryId, note: note.trim(), date: date ?? now, createdAt: now };
  state.expenses.push(e);
  state.expenses.sort((a, b) => b.date - a.date);
  db.put('expenses', e);
  emit('expenses');
  return e;
}

export function deleteExpense(id) {
  const i = state.expenses.findIndex((e) => e.id === id);
  if (i < 0) return;
  state.expenses.splice(i, 1);
  db.remove('expenses', id);
  emit('expenses');
}

export function addCategory({ name, icon, color }) {
  const n = state.categories.length;
  const c = { id: crypto.randomUUID(), name, icon, color: color && !GREYS.has(color) ? color : PALETTE[n % PALETTE.length], budget: null, order: n };
  state.categories.push(c);
  db.put('categories', c);
  emit('categories');
  return c;
}

export function setBudget(id, budget) {
  const c = catById(id);
  if (!c) return;
  c.budget = budget;
  db.put('categories', c);
  emit('categories');
}

// Swap every expense for `list` (and optionally set budgets by category name, in rupees).
export async function replaceAll(list, budgets = {}) {
  await db.clear('expenses');
  state.expenses = [...list].sort((a, b) => b.date - a.date);
  state.expenses.forEach((e) => db.put('expenses', e));
  for (const c of state.categories) {
    if (c.name in budgets) { c.budget = budgets[c.name] * 100; db.put('categories', c); }
  }
  state.month = currentMonth();
  emit('expenses'); emit('categories'); emit('month');
}

export async function clearExpenses() {
  await db.clear('expenses');
  state.expenses = [];
  emit('expenses');
}

export function goToMonth(month) {
  if (month.y === state.month.y && month.m === state.month.m) return;
  state.dir = month.y * 12 + month.m > state.month.y * 12 + state.month.m ? 1 : -1;
  state.month = { y: month.y, m: month.m };
  emit('month');
}

export function moveMonth(delta) {
  state.dir = delta;
  state.month = shiftMonth(state.month, delta);
  emit('month');
}
