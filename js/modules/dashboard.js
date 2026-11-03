import { detectTypes, TYPE_LABELS, toHostname } from '../lib/detect.js';
import { extractIndicators } from '../lib/encoding.js';
import { pivots } from '../lib/pivots.js';
import { icon } from '../icons.js';
import { esc, card, pivotList, caseBtn, copyBtn } from '../ui.js';
import { loadCase } from '../case.js';
import { TOOLS } from '../data/tools.js';
import { SITES } from '../lib/username.js';
import { ADAPTERS } from '../lib/social.js';
import { loadRecent, clearRecent } from '../recent.js';

export const ROUTE_FOR = { domain: 'domain', url: 'domain', ip: 'ip', email: 'email', username: 'username', phone: 'phone' };

/** [route, icon, name, description, isNew] */
export const MODULES = [
  ['domain', 'globe', 'Domain Intel', 'DNS, WHOIS/RDAP, subdomains from CT logs, mail security and archive history.'],
  ['ip', 'pin', 'IP Intel', 'Geolocation, ASN, network owner, reverse DNS and reputation pivots.'],
  ['email', 'mail', 'Email Intel', 'Deliverability, SPF/DMARC, Gravatar, breach pivots and address permutations.'],
  ['social', 'users', 'Social Profiles', `Confirms accounts on ${ADAPTERS.length} platforms and collects public profiles & posts.`, true],
  ['username', 'user', 'Username Search', `Profile links across ${SITES.length} platforms plus a handle generator.`],
  ['phone', 'phone', 'Phone Intel', 'Country detection, E.164 formats and search variants.'],
  ['image', 'image', 'Image Forensics', 'EXIF & GPS extraction, hashes and reverse image search — fully local.'],
  ['headers', 'inbox', 'Email Headers', 'Trace hops, check SPF/DKIM/DMARC and flag phishing.'],
  ['toolkit', 'key', 'Crypto & Decode', 'Hashes, hash ID, Base64/Hex/URL, JWT and timestamps.'],
  ['dorks', 'search', 'Dork Builder', 'Advanced search queries and 20 recon templates.'],
  ['tools', 'book', 'Tool Directory', `${TOOLS.length} curated OSINT resources, searchable.`],
  ['privacy', 'shield', 'Remove My Data', 'Guided opt-outs from data brokers, search engines and old accounts.', true],
];

const EXAMPLES = ['github.com', '1.1.1.1', 'torvalds', 'support@github.com', '+44 20 7946 0958'];

function routeFor(types, q) {
  const t = types.find((x) => ROUTE_FOR[x]);
  if (!t) return null;
  const v = t === 'url' ? toHostname(q) : t === 'username' ? q.replace(/^@/, '') : q;
  return `#/${ROUTE_FOR[t]}?q=${encodeURIComponent(v)}`;
}

function analyse(q) {
  const types = detectTypes(q);
  if (!types.length) return '';
  const primary = types[0];
  const valueFor = (t) => (t === 'url' ? toHostname(q) : t === 'username' ? q.replace(/^@/, '') : q);
  const actions = types
    .filter((t) => ROUTE_FOR[t])
    .map((t, i) => {
      const label = t === 'url' ? 'Domain' : TYPE_LABELS[t];
      return `<a class="btn ${i ? 'ghost' : ''}" href="#/${ROUTE_FOR[t]}?q=${encodeURIComponent(valueFor(t))}">Investigate as ${esc(label)} ${icon('arrow')}</a>`;
    })
    .concat(types.includes('username') ? [`<a class="btn ghost" href="#/social?q=${encodeURIComponent(valueFor('username'))}">${icon('users')} Collect social profiles</a>`] : [])
    .join('');
  return card(
    `Detected: ${TYPE_LABELS[primary]}`,
    `<p class="mono big">${esc(q)} ${copyBtn(q)} ${caseBtn(primary, q)}</p>
     ${types.length > 1 ? `<p class="muted">Could also be: ${types.slice(1).map((t) => esc(TYPE_LABELS[t])).join(', ')}</p>` : ''}
     ${actions ? `<div class="actions">${actions}</div>` : ''}
     <h4>Quick pivots</h4>${pivotList(pivots(primary, primary === 'url' ? q : valueFor(primary)))}`,
  );
}

function renderExtract(text) {
  const r = extractIndicators(text);
  const groups = [
    ['IPv4 addresses', r.ipv4, 'ip'], ['Domains', r.domains, 'domain'], ['URLs', r.urls, 'url'],
    ['Emails', r.emails, 'email'], ['Hashes', r.hashes, 'hash'], ['Bitcoin', r.btc, 'btc'],
    ['Ethereum', r.eth, 'eth'], ['Phone numbers', r.phones, 'phone'],
  ].filter(([, list]) => list.length);
  if (!groups.length) return '<p class="muted">No indicators found.</p>';
  return groups
    .map(
      ([label, list, type]) => `<h4>${esc(label)} <span class="badge">${list.length}</span> ${copyBtn(list.join('\n'))}</h4>
      <ul class="ioc-list">${list
        .map((v) => {
          const r = ROUTE_FOR[type];
          const val = type === 'url' ? toHostname(v) : v;
          return `<li><span class="mono">${esc(v)}</span>${r ? ` <a href="#/${r}?q=${encodeURIComponent(val)}">investigate</a>` : ''} ${caseBtn(type, v)}</li>`;
        })
        .join('')}</ul>`,
    )
    .join('');
}

function recentHtml() {
  const list = loadRecent();
  if (!list.length) return '';
  return `<div class="section-h"><h2>Recent</h2><button class="btn sm ghost" id="clearRecent" type="button">Clear</button></div>
    <div class="chips">${list
      .map((r) => `<a class="chip" href="#/${esc(r.route)}?q=${encodeURIComponent(r.q)}">${icon(r.icon || 'clock')} ${esc(r.q)}</a>`)
      .join('')}</div>`;
}

export function render(root, params) {
  const c = loadCase();
  root.innerHTML = `
    <section class="hero">
      <span class="eyebrow">${icon('zap')} Open-source intelligence, in your browser</span>
      <h1>Investigate anything.<br /><span class="grad">Leave no trace.</span></h1>
      <p class="lead">One search box for domains, IPs, emails, usernames, phones, URLs, hashes and wallets — with live lookups, social profile collection and a privacy toolkit to take your own data back.</p>
      <form id="uform" class="hero-search" autocomplete="off">
        <div class="field">${icon('search')}
          <input id="uq" placeholder="Search a domain, IP, email, @username, phone…" value="${esc(params.get('q') || '')}" spellcheck="false" aria-label="Search any indicator" />
          <button class="btn" type="submit">Analyze</button>
        </div>
        <div class="detected" id="detected"></div>
        <div class="examples">${EXAMPLES.map((x) => `<button class="chip" type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      </form>
      <div class="stats">
        <span><strong>${MODULES.length}</strong>tools</span>
        <span><strong>${SITES.length}</strong>platforms</span>
        <span><strong>${TOOLS.length}</strong>resources</span>
        <span><strong>0</strong>trackers</span>
      </div>
    </section>
    <div id="uresult"></div>
    ${recentHtml()}
    <div class="banner">
      <span class="tile-i">${icon('shield')}</span>
      <div><h2>Is your personal data out there?</h2><p>Find where you’re exposed and remove yourself from data brokers, search results and old accounts — free, step by step.</p></div>
      <a class="btn" href="#/privacy">Start removing my data ${icon('arrow')}</a>
    </div>
    <div class="section-h"><h2>Toolkit</h2><span class="muted small">Press <kbd>Ctrl</kbd> <kbd>K</kbd> to jump anywhere</span></div>
    <div class="grid tiles">
      ${MODULES.map(([r, ic, name, desc, isNew]) => `<a class="tile" href="#/${r}">${isNew ? '<span class="new">NEW</span>' : ''}<span class="tile-i">${icon(ic)}</span><strong>${esc(name)}</strong><span class="muted">${esc(desc)}</span></a>`).join('')}
    </div>
    <div class="section-h"><h2>Indicator extractor</h2></div>
    ${card('Paste any text', `<p class="muted">Reports, logs, emails or chat transcripts — IPs, domains, URLs, emails, hashes, wallets and phone numbers are extracted locally.</p>
       <textarea id="extractIn" class="input" rows="5" placeholder="Paste text here…"></textarea>
       <div id="extractOut" class="extract-out"></div>`)}
    <div class="trust">
      <div>${icon('lock')}<span><strong>Private by design</strong>No accounts, no tracking. Your searches never touch our servers — there are none.</span></div>
      <div>${icon('zap')}<span><strong>Fast & resilient</strong>Cached responses, automatic retries and backup data sources. <a href="#/status">System status</a></span></div>
      <div>${icon('folder')}<span><strong>Case notebook</strong>${c.entities.length} item(s) in “${esc(c.name)}”. <a href="#/case">Open</a></span></div>
    </div>
  `;
  const out = root.querySelector('#uresult');
  const input = root.querySelector('#uq');
  const detected = root.querySelector('#detected');
  const showDetected = () => {
    const q = input.value.trim();
    const t = detectTypes(q);
    detected.innerHTML = q && t.length ? `Looks like ${t.slice(0, 2).map((x) => `<span class="pill info">${esc(TYPE_LABELS[x])}</span>`).join(' or ')} — press Enter` : '';
  };
  const run = () => {
    const q = input.value.trim();
    if (!q) return;
    const types = detectTypes(q);
    const dest = routeFor(types, q);
    // Best guess has a dedicated page → go straight there; otherwise (hash, wallet, keyword) show pivots here.
    if (dest && ROUTE_FOR[types[0]]) location.hash = dest;
    else {
      out.innerHTML = analyse(q);
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  input.addEventListener('input', showDetected);
  root.querySelector('#uform').addEventListener('submit', (e) => {
    e.preventDefault();
    run();
  });
  root.querySelectorAll('[data-ex]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.ex;
      showDetected();
      out.innerHTML = analyse(b.dataset.ex);
    }),
  );
  root.querySelector('#clearRecent')?.addEventListener('click', () => {
    clearRecent();
    render(root, params);
  });
  if (params.get('q')) {
    showDetected();
    out.innerHTML = analyse(params.get('q'));
  }
  const ta = root.querySelector('#extractIn');
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => (root.querySelector('#extractOut').innerHTML = ta.value.trim() ? renderExtract(ta.value) : ''), 200);
  });
}
