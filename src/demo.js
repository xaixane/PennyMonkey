import { state, replaceAll, clearExpenses, addExpense } from './store.js';

// Small seeded PRNG so the test data is random-looking but the same on every load.
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Seven months of believable spending, ending today: salary and freelance income, rent and bills,
// daily coffee and meals, commuting, the odd big purchase, and one expensive trip (a lakh-plus month).
export function buildDemo() {
  const rand = rng(20261029);
  const between = (a, b) => Math.round(a + rand() * (b - a));
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const id = (name) => state.categories.find((c) => c.name === name)?.id;
  const now = new Date(), out = [];
  const add = (date, hour, cat, amount, type, note) => {
    const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, between(0, 59)).getTime();
    if (t > Date.now() || !id(cat)) return; // nothing in the future
    out.push({ id: crypto.randomUUID(), amount: amount * 100, type, categoryId: id(cat), note, date: t, createdAt: t });
  };

  for (let k = 6; k >= 0; k--) {
    const first = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const D = (n) => new Date(first.getFullYear(), first.getMonth(), Math.min(n, days));

    add(D(1), 9, 'Other', between(82000, 92000), 'credit', 'Salary');
    if (rand() < 0.55) add(D(between(10, 24)), 15, 'Other', between(6000, 18000), 'credit', 'Freelance');
    add(D(3), 10, 'Bills', 22000, 'debit', 'Rent');
    add(D(7), 11, 'Bills', between(1600, 3400), 'debit', 'Electricity');
    add(D(9), 12, 'Bills', 999, 'debit', 'Internet');
    add(D(12), 12, 'Bills', between(300, 700), 'debit', 'Mobile recharge');
    add(D(5), 8, 'Entertainment', 649, 'debit', 'Netflix');
    add(D(6), 8, 'Entertainment', 119, 'debit', 'Spotify');
    if (rand() < 0.3) add(D(between(14, 26)), 16, 'Other', between(1500, 6000), 'debit', 'Gift');

    for (let d = 1; d <= days; d++) {
      const date = D(d);
      if (rand() < 0.62) add(date, between(8, 10), 'Food', between(110, 240), 'debit', 'Coffee');
      if (rand() < 0.55) add(date, between(13, 14), 'Food', between(220, 520), 'debit', pick(['Lunch', 'Biryani', 'Sandwich']));
      if (rand() < 0.28) add(date, between(20, 22), 'Food', between(380, 1100), 'debit', pick(['Dinner', 'Pizza', 'Dinner out']));
      if (rand() < 0.14) add(date, between(18, 19), 'Food', between(900, 2600), 'debit', 'Groceries');
      if (rand() < 0.4) add(date, between(8, 19), 'Transport', between(60, 420), 'debit', pick(['Cab', 'Metro', 'Auto']));
      if (d % 9 === 0) add(date, between(9, 18), 'Transport', between(1200, 2400), 'debit', 'Fuel');
      if (rand() < 0.07) add(date, between(11, 20), 'Shopping', between(1500, 8500), 'debit', pick(['Clothes', 'Shoes', 'Headphones', 'Amazon order']));
      if (rand() < 0.05) add(date, between(10, 18), 'Health', between(250, 2400), 'debit', pick(['Pharmacy', 'Doctor', 'Lab test']));
      if (rand() < 0.08) add(date, between(18, 22), 'Entertainment', between(350, 1200), 'debit', pick(['Movie', 'Concert', 'Gaming']));
    }
    if (k === 2) { // an expensive trip, so one month clears a lakh
      add(D(8), 10, 'Transport', 38000, 'debit', 'Flights');
      add(D(10), 14, 'Other', 26000, 'debit', 'Hotel');
      add(D(11), 19, 'Shopping', 9800, 'debit', 'Souvenirs');
    }
  }
  return out;
}

const BUDGETS = { Food: 22000, Transport: 9000, Shopping: 10000, Bills: 30000, Health: 3000, Entertainment: 4000 };

export const loadDemo = () => replaceAll(buildDemo(), BUDGETS);
export const deleteAll = () => clearExpenses();

// Test entries for the whole of November (this year, or last year once it's past November),
// including days that haven't happened yet. Appends to existing data.
export function addNovemberTestEntries() {
  const now = new Date();
  const year = now.getFullYear();
  const id = (name) => state.categories.find((c) => c.name === name)?.id;
  const at = (day, hour, min) => new Date(year, 10, day, hour, min).getTime();
  const rows = [
    [1, 9, 0, 'Other', 85000, 'credit', 'Salary'],
    [3, 10, 5, 'Bills', 22000, 'debit', 'Rent'],
    [4, 8, 40, 'Food', 180, 'debit', 'Coffee'],
    [4, 13, 15, 'Food', 340, 'debit', 'Lunch'],
    [5, 8, 0, 'Entertainment', 649, 'debit', 'Netflix'],
    [6, 8, 0, 'Entertainment', 119, 'debit', 'Spotify'],
    [7, 11, 30, 'Bills', 2450, 'debit', 'Electricity'],
    [8, 9, 20, 'Transport', 1800, 'debit', 'Fuel'],
    [9, 12, 0, 'Bills', 999, 'debit', 'Internet'],
    [10, 20, 45, 'Food', 760, 'debit', 'Dinner out'],
    [12, 12, 10, 'Bills', 499, 'debit', 'Mobile recharge'],
    [13, 18, 30, 'Food', 2150, 'debit', 'Groceries'],
    [14, 15, 0, 'Shopping', 4200, 'debit', 'Shoes'],
    [15, 17, 20, 'Other', 12000, 'credit', 'Freelance'],
    [16, 19, 0, 'Entertainment', 850, 'debit', 'Movie'],
    [18, 9, 15, 'Transport', 220, 'debit', 'Cab'],
    [19, 13, 40, 'Food', 410, 'debit', 'Biryani'],
    [21, 10, 30, 'Health', 1350, 'debit', 'Doctor'],
    [22, 14, 0, 'Shopping', 6400, 'debit', 'Headphones'],
    [24, 18, 10, 'Food', 1900, 'debit', 'Groceries'],
    [25, 21, 0, 'Food', 980, 'debit', 'Pizza'],
    [27, 16, 0, 'Other', 3000, 'debit', 'Gift'],
    [28, 9, 30, 'Transport', 2100, 'debit', 'Fuel'],
    [30, 11, 0, 'Health', 450, 'debit', 'Pharmacy'],
  ];
  for (const [d, h, m, cat, amt, type, note] of rows) {
    if (!id(cat)) continue;
    addExpense({ amount: amt * 100, type, categoryId: id(cat), note, date: at(d, h, m) });
  }
}
