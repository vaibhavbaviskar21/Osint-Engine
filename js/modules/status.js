import { fetchJSON, stats, clearCache } from '../lib/http.js';
import { icon } from '../icons.js';
import { esc, card, pageHeader, toast } from '../ui.js';

/** Lightweight health probes, one per upstream data source. */
export const PROBES = [
  ['DNS', 'Cloudflare DNS-over-HTTPS', 'https://cloudflare-dns.com/dns-query?name=example.com&type=A', { accept: 'application/dns-json' }],
  ['DNS', 'Google DNS-over-HTTPS', 'https://dns.google/resolve?name=example.com&type=A'],
  ['Registration', 'rdap.org', 'https://rdap.org/domain/example.com'],
  ['Registration', 'Verisign RDAP', 'https://rdap.verisign.com/com/v1/domain/example.com'],
  ['Registration', 'ARIN RDAP', 'https://rdap.arin.net/registry/ip/8.8.8.8'],
  ['Geolocation', 'ipwho.is', 'https://ipwho.is/8.8.8.8'],
  ['Geolocation', 'ipapi.co', 'https://ipapi.co/8.8.8.8/json/'],
  ['Geolocation', 'ipinfo.io', 'https://ipinfo.io/8.8.8.8/json'],
  ['Certificates', 'Cert Spotter', 'https://api.certspotter.com/v1/issuances?domain=example.com'],
  ['Archive', 'Internet Archive', 'https://archive.org/wayback/available?url=example.com'],
  ['Social', 'GitHub API', 'https://api.github.com/rate_limit'],
  ['Social', 'GitLab API', 'https://gitlab.com/api/v4/users?username=gitlab'],
  ['Social', 'Bluesky API', 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=bsky.app'],
  ['Social', 'Mastodon API', 'https://mastodon.social/api/v1/instance'],
  ['Social', 'Reddit', 'https://www.reddit.com/user/reddit/about.json'],
  ['Social', 'Hacker News API', 'https://hacker-news.firebaseio.com/v0/maxitem.json'],
  ['Social', 'DEV API', 'https://dev.to/api/articles?per_page=1'],
  ['Social', 'Lichess API', 'https://lichess.org/api/user/lichess'],
  ['Social', 'Chess.com API', 'https://api.chess.com/pub/player/hikaru'],
  ['Social', 'Keybase API', 'https://keybase.io/_/api/1.0/user/lookup.json?usernames=chris&fields=basics'],
];

async function probe([, , url, accept]) {
  const t0 = performance.now();
  try {
    const j = await fetchJSON(url, { cache: false, retries: 0, timeout: 10000, headers: accept ? accept : undefined });
    const ms = Math.round(performance.now() - t0);
    let note = '';
    if (j?.resources?.core) note = `${j.resources.core.remaining}/${j.resources.core.limit} requests left this hour`;
    return { ok: true, ms, note };
  } catch (err) {
    return { ok: false, ms: Math.round(performance.now() - t0), note: err.message };
  }
}

export function render(root) {
  root.innerHTML = `
    ${pageHeader('System Status', 'Live health of every data source this app depends on, measured from your browser. Each lookup automatically falls back to a backup source when one is down.', 'activity')}
    <div class="card"><div class="card-b">
      <div class="summary-bar">
        <div><span class="num" id="upN">–</span> <span class="muted">of ${PROBES.length} sources operational</span></div>
        <div class="progress"><i id="upBar" style="width:0%"></i></div>
        <button class="btn sm ghost" id="recheck" type="button">${icon('refresh')} Re-check</button>
      </div>
    </div></div>
    ${card('Data sources', `<table class="status"><thead><tr><th>Source</th><th>Status</th><th>Latency</th></tr></thead><tbody id="rows"></tbody></table>`)}
    ${card('This session', `<div class="statrow" id="sess"></div>
      <div class="actions"><button class="btn sm ghost" id="clear" type="button">${icon('trash')} Clear response cache</button></div>
      <p class="muted small">Responses are cached for this browser session to make repeat lookups instant and reduce load on free APIs.</p>`)}
  `;
  const rows = root.querySelector('#rows');
  const sess = () => {
    root.querySelector('#sess').innerHTML = `<span><b>${stats.requests}</b> network requests</span><span><b>${stats.cacheHits}</b> served from cache</span><span><b>${stats.retries}</b> automatic retries</span><span><b>${stats.failures}</b> failures</span>`;
  };
  const runAll = async () => {
    let up = 0;
    let done = 0;
    rows.innerHTML = PROBES.map(
      (p, i) => `<tr id="p${i}"><td><strong>${esc(p[1])}</strong><div class="muted small">${esc(p[0])}</div></td><td><span class="mini"><span class="dot pending"></span>Checking…</span></td><td class="muted">—</td></tr>`,
    ).join('');
    await Promise.all(
      PROBES.map(async (p, i) => {
        const r = await probe(p);
        done++;
        if (r.ok) up++;
        const row = root.querySelector(`#p${i}`);
        if (row)
          row.innerHTML = `<td><strong>${esc(p[1])}</strong><div class="muted small">${esc(p[0])}${r.note ? ` · ${esc(r.note)}` : ''}</div></td>
            <td><span class="mini"><span class="dot ${r.ok ? 'good' : 'bad'}"></span>${r.ok ? 'Operational' : 'Unreachable'}</span></td>
            <td class="${r.ms > 2500 ? 'muted' : ''}">${r.ms} ms</td>`;
        root.querySelector('#upN').textContent = up;
        root.querySelector('#upBar').style.width = `${Math.round((up / PROBES.length) * 100)}%`;
        if (done === PROBES.length) sess();
      }),
    );
  };
  root.querySelector('#recheck').addEventListener('click', runAll);
  root.querySelector('#clear').addEventListener('click', () => {
    clearCache();
    toast('Cache cleared');
  });
  sess();
  runAll();
}
