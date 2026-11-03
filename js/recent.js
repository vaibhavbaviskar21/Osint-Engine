// Recent searches (per browser, max 8).
const KEY = 'oe.recent.v1';
const MAX = 8;

export function loadRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry) {
  const list = loadRecent().filter((r) => !(r.route === entry.route && r.q === entry.q));
  list.unshift({ ...entry, t: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
