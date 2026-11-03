// Resilient HTTP layer: timeouts, retries with exponential backoff, in-flight de-duplication,
// and a two-tier (memory + sessionStorage) response cache.

const mem = new Map();
const inflight = new Map();
export const stats = { requests: 0, cacheHits: 0, retries: 0, failures: 0 };

const STORE_PREFIX = 'oe.http.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function storeGet(key) {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSet(key, entry) {
  try {
    globalThis.sessionStorage?.setItem(STORE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded or storage unavailable — memory cache still works */
  }
}

export function clearCache() {
  mem.clear();
  try {
    const s = globalThis.sessionStorage;
    if (!s) return;
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k && k.startsWith(STORE_PREFIX)) s.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const host = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

async function attempt(url, { headers, timeout, fetchImpl }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetchImpl(url, { headers, signal: ctl.signal });
    if (res.status === 404 || res.status === 410) return { value: null };
    if (!res.ok) throw new HttpError(`${host(url)} responded ${res.status}`, res.status);
    return { value: await res.json() };
  } catch (err) {
    if (err.name === 'AbortError') throw new HttpError(`${host(url)} timed out`, 0);
    if (err instanceof HttpError) throw err;
    throw new HttpError(`${host(url)} is unreachable (network or CORS)`, 0);
  } finally {
    clearTimeout(timer);
  }
}

const retryable = (err) => err.status === 0 || err.status === 429 || err.status >= 500;

/**
 * GET a JSON resource. Resolves to `null` for 404/410.
 * @param {string} url
 * @param {{headers?:object, timeout?:number, retries?:number, ttl?:number, cache?:boolean, fetchImpl?:Function, backoff?:number}} [opts]
 */
export async function fetchJSON(url, opts = {}) {
  const {
    headers,
    timeout = 15000,
    retries = 2,
    ttl = 10 * 60 * 1000,
    cache = true,
    fetchImpl = globalThis.fetch.bind(globalThis),
    backoff = 400,
  } = opts;
  const key = url + (headers ? `|${JSON.stringify(headers)}` : '');
  const now = Date.now();

  if (cache) {
    const hit = mem.get(key) || storeGet(key);
    if (hit && hit.exp > now) {
      stats.cacheHits++;
      mem.set(key, hit);
      return hit.v;
    }
  }
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    stats.requests++;
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        const { value } = await attempt(url, { headers, timeout, fetchImpl });
        if (cache) {
          const entry = { v: value, exp: Date.now() + ttl };
          mem.set(key, entry);
          storeSet(key, entry);
        }
        return value;
      } catch (err) {
        lastErr = err;
        if (i === retries || !retryable(err)) break;
        stats.retries++;
        await sleep(backoff * 2 ** i + Math.random() * backoff);
      }
    }
    stats.failures++;
    throw lastErr;
  })();
  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Try a list of named providers in order and return the first success.
 * @param {{name:string, run:() => Promise<any>}[]} providers
 * @returns {Promise<{value:any, source:string}>}
 */
export async function firstSuccessful(providers) {
  const errors = [];
  for (const p of providers) {
    try {
      const value = await p.run();
      if (value !== null && value !== undefined) return { value, source: p.name };
      errors.push(`${p.name}: no data`);
    } catch (err) {
      errors.push(`${p.name}: ${err.message}`);
    }
  }
  throw new Error(`All sources failed — ${errors.join('; ')}`);
}
