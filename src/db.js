// Thin promise wrapper over IndexedDB with a debounced write queue.
const DB_NAME = 'spendly';
const STORES = ['expenses', 'categories'];
let dbp;

function open() {
  return (dbp ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => STORES.forEach((s) => req.result.createObjectStore(s, { keyPath: 'id' }));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export async function getAll(store) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let queue = [];
let timer = 0;

async function flush() {
  timer = 0;
  if (!queue.length) return;
  const ops = queue;
  queue = [];
  try {
    const db = await open();
    const tx = db.transaction(STORES, 'readwrite');
    for (const [kind, store, val] of ops) {
      const os = tx.objectStore(store);
      kind === 'put' ? os.put(val) : os.delete(val);
    }
  } catch (e) {
    console.error('persist failed', e);
  }
}

const schedule = () => { if (!timer) timer = setTimeout(flush, 300); };

// Empty a store. Pending writes are flushed first so they can't reappear afterwards.
export async function clear(store) {
  await flush();
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export const put = (store, val) => { queue.push(['put', store, val]); schedule(); };
export const remove = (store, id) => { queue.push(['del', store, id]); schedule(); };

// Don't lose the pending batch when the app is backgrounded/closed.
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
addEventListener('pagehide', flush);
