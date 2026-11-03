import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchJSON, firstSuccessful, clearCache, stats, HttpError } from '../js/lib/http.js';
import { ADAPTERS, collectProfiles, linkedIdentities, stripHtml } from '../js/lib/social.js';
import { generateLetter, LAWS, BROKERS, SEARCH_REMOVAL, ACCOUNTS, progress } from '../js/lib/removal.js';
import { GEO_NORMALISERS } from '../js/lib/net.js';
import { ICON_NAMES } from '../js/icons.js';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('fetchJSON caches, de-duplicates and maps 404 to null', async () => {
  clearCache();
  let calls = 0;
  const f = async () => { calls++; return res(200, { ok: 1 }); };
  const [a, b] = await Promise.all([fetchJSON('https://x.test/a', { fetchImpl: f }), fetchJSON('https://x.test/a', { fetchImpl: f })]);
  assert.deepEqual(a, { ok: 1 });
  assert.deepEqual(b, { ok: 1 });
  assert.equal(calls, 1, 'concurrent requests de-duplicated');
  const before = stats.cacheHits;
  await fetchJSON('https://x.test/a', { fetchImpl: f });
  assert.equal(calls, 1, 'served from cache');
  assert.equal(stats.cacheHits, before + 1);
  assert.equal(await fetchJSON('https://x.test/404', { fetchImpl: async () => res(404, {}) }), null);
});

test('fetchJSON retries transient failures but not client errors', async () => {
  clearCache();
  let n = 0;
  const flaky = async () => (++n < 3 ? res(503, {}) : res(200, { v: n }));
  assert.deepEqual(await fetchJSON('https://x.test/flaky', { fetchImpl: flaky, backoff: 1 }), { v: 3 });
  let m = 0;
  const bad = async () => { m++; return res(400, {}); };
  await assert.rejects(fetchJSON('https://x.test/bad', { fetchImpl: bad, backoff: 1 }), (e) => e instanceof HttpError && e.status === 400);
  assert.equal(m, 1, 'no retry on 400');
  let k = 0;
  const net = async () => { k++; throw new TypeError('Failed to fetch'); };
  await assert.rejects(fetchJSON('https://x.test/net', { fetchImpl: net, backoff: 1, retries: 2 }), /unreachable/);
  assert.equal(k, 3);
});

test('fetchJSON times out', async () => {
  clearCache();
  const hang = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  await assert.rejects(fetchJSON('https://x.test/hang', { fetchImpl: hang, timeout: 20, retries: 0 }), /timed out/);
});

test('firstSuccessful falls through to the next provider', async () => {
  const r = await firstSuccessful([
    { name: 'a', run: async () => { throw new Error('down'); } },
    { name: 'b', run: async () => null },
    { name: 'c', run: async () => 42 },
  ]);
  assert.deepEqual(r, { value: 42, source: 'c' });
  await assert.rejects(firstSuccessful([{ name: 'a', run: async () => { throw new Error('down'); } }]), /a: down/);
});

test('geo normalisers produce a common shape', () => {
  const a = GEO_NORMALISERS.ipapi({ ip: '8.8.8.8', version: 'IPv4', country_name: 'United States', country_code: 'US', city: 'Mountain View', latitude: 37.4, longitude: -122.1, asn: 'AS15169', org: 'GOOGLE' });
  assert.equal(a.asn, 'AS15169');
  assert.equal(a.flag, '🇺🇸');
  const b = GEO_NORMALISERS.ipinfo({ ip: '1.1.1.1', city: 'Sydney', country: 'AU', loc: '-33.86,151.20', org: 'AS13335 Cloudflare, Inc.' });
  assert.equal(b.lat, -33.86);
  assert.equal(b.asn, 'AS13335');
  assert.equal(b.org, 'Cloudflare, Inc.');
  assert.throws(() => GEO_NORMALISERS.ipwho({ success: false, message: 'Invalid IP' }), /Invalid IP/);
});

// ---- social adapters with a fake API ----
const FAKE = {
  'https://api.github.com/users/alice': { login: 'alice', name: 'Alice', avatar_url: 'https://a/x.png', html_url: 'https://github.com/alice', followers: 10, following: 2, public_repos: 5, blog: 'https://alice.dev', twitter_username: 'alice_tw', created_at: '2015-01-01T00:00:00Z' },
  'https://api.github.com/users/alice/repos?sort=updated&per_page=6': [{ name: 'proj', html_url: 'https://github.com/alice/proj', pushed_at: '2026-01-01T00:00:00Z' }],
  'https://gitlab.com/api/v4/users?username=alice': [],
  'https://mastodon.social/api/v1/accounts/lookup?acct=alice': { id: '1', acct: 'alice', display_name: 'Alice', note: '<p>Hi &amp; welcome</p>', url: 'https://mastodon.social/@alice', followers_count: 3, fields: [{ name: 'Site', value: '<a href="https://alice.dev">https://alice.dev</a>', verified_at: '2024-01-01' }] },
  'https://mastodon.social/api/v1/accounts/1/statuses?limit=6&exclude_replies=true': [{ content: '<p>hello world</p>', url: 'https://mastodon.social/@alice/1', created_at: '2026-01-01T00:00:00Z' }],
  'https://hacker-news.firebaseio.com/v0/user/alice.json': null,
};
const fakeGet = async (url) => {
  if (url.startsWith('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile')) throw new HttpError('bad request', 400);
  if (url.startsWith('https://www.reddit.com')) throw new HttpError('www.reddit.com is unreachable (network or CORS)', 0);
  if (url in FAKE) return FAKE[url];
  return null;
};

test('collectProfiles classifies found / not found / error and streams results', async () => {
  const streamed = [];
  const out = await collectProfiles('@alice', { get: fakeGet, onResult: (o) => streamed.push(o.id) });
  assert.equal(out.length, ADAPTERS.length);
  assert.equal(streamed.length, ADAPTERS.length);
  const by = Object.fromEntries(out.map((o) => [o.id, o]));
  assert.equal(by.github.status, 'found');
  assert.equal(by.github.result.profile.stats.Followers, 10);
  assert.equal(by.github.result.items[0].title, 'proj');
  assert.equal(by.gitlab.status, 'not_found');
  assert.equal(by.bluesky.status, 'not_found', 'Bluesky 400 = not found');
  assert.equal(by.hackernews.status, 'not_found', 'HN null = not found');
  assert.equal(by.reddit.status, 'error');
  assert.equal(by.mastodon.result.profile.bio, 'Hi & welcome');
  assert.equal(by.mastodon.result.items[0].text, 'hello world');
  const ids = linkedIdentities(out);
  const site = ids.find((l) => l.value === 'https://alice.dev');
  assert.deepEqual(site.sources.sort(), ['GitHub', 'Mastodon (mastodon.social)']);
  for (const a of ADAPTERS) assert.match(a.profileUrl('bob'), /^https:\/\//);
});

test('stripHtml', () => {
  assert.equal(stripHtml('<p>a<br>b</p><p>c</p>'), 'a\nb\n\nc');
  assert.equal(stripHtml(null), '');
});

// ---- data removal ----
test('generateLetter fills law, company and identifiers', () => {
  const { subject, body } = generateLetter({ law: 'gdpr', company: 'Acme Data', fullName: 'Jane Doe', email: 'jane@example.com', urls: 'https://acme/jane\nhttps://acme/j2' });
  assert.equal(subject, 'Personal data erasure request — Jane Doe');
  assert.match(body, /Acme Data/);
  assert.match(body, /Article 17/);
  assert.match(body, /one month/);
  assert.match(body, /- Email address: jane@example.com/);
  assert.match(body, /https:\/\/acme\/jane, https:\/\/acme\/j2/);
  assert.doesNotMatch(body, /Phone number/, 'empty fields omitted');
  for (const k of Object.keys(LAWS)) assert.ok(generateLetter({ law: k }).body.includes(LAWS[k].cite));
  assert.match(generateLetter({ law: 'nope' }).body, /\[Company name\]/);
});

test('removal catalogues are well-formed', () => {
  const ids = new Set();
  for (const x of [...BROKERS, ...SEARCH_REMOVAL, ...ACCOUNTS]) {
    assert.ok(x.id && x.name, JSON.stringify(x));
    assert.equal(new URL(x.url).protocol, 'https:', x.url);
    assert.ok(!ids.has(x.id), `duplicate id ${x.id}`);
    ids.add(x.id);
  }
  assert.deepEqual(progress({ spokeo: 'x' }, BROKERS.slice(0, 4)), { done: 1, total: 4, pct: 25 });
});

test('icon set covers every icon referenced in the app', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const files = ['js/app.js', ...readdirSync('js/modules').map((f) => `js/modules/${f}`)];
  const used = new Set();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/icon\('([a-zA-Z]+)'\)|'([a-zA-Z]+)'\]\s*[,\]]/g)) if (m[1]) used.add(m[1]);
  for (const name of used) assert.ok(ICON_NAMES.includes(name), `missing icon: ${name}`);
});
