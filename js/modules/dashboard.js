import { detectTypes, TYPE_LABELS, toHostname } from '../lib/detect.js';
import { extractIndicators } from '../lib/encoding.js';
import { pivots } from '../lib/pivots.js';
import { esc, card, pivotList, caseBtn, copyBtn } from '../ui.js';
import { loadCase } from '../case.js';
import { TOOLS } from '../data/tools.js';
import { SITES } from '../lib/username.js';

const ROUTE_FOR = { domain: 'domain', url: 'domain', ip: 'ip', email: 'email', username: 'username', phone: 'phone' };

export const MODULES = [
  ['domain', '🌐', 'Domain Intel', 'DNS, WHOIS/RDAP, subdomains from CT logs, mail security, archives.'],
  ['ip', '📍', 'IP Intel', 'Geolocation, ASN, network owner, reverse DNS, reputation pivots.'],
  ['email', '✉️', 'Email Intel', 'MX / SPF / DMARC, Gravatar, breach pivots, address permutations.'],
  ['username', '👤', 'Username Search', `Profile links across ${SITES.length} platforms + handle generator.`],
  ['phone', '☎️', 'Phone Intel', 'Country detection, number formats and search dorks.'],
  ['image', '🖼️', 'Image Forensics', 'EXIF & GPS extraction, hashes, reverse image search — 100% local.'],
  ['headers', '📨', 'Email Headers', 'Trace hops, auth results and phishing red flags.'],
  ['dorks', '🔎', 'Dork Builder', 'Compose advanced search queries and recon templates.'],
  ['toolkit', '🧰', 'Crypto & Decode', 'Hashes, hash ID, Base64/Hex/URL, JWT, timestamps, IOC extractor.'],
  ['tools', '📚', 'Tool Directory', `${TOOLS.length} curated OSINT resources, searchable.`],
  ['case', '🗂️', 'Case Notebook', 'Collect findings, annotate and export to Markdown / JSON / CSV.'],
];

function analyse(q) {
  const types = detectTypes(q);
  if (!types.length) return '';
  const primary = types[0];
  const valueFor = (t) => (t === 'url' ? toHostname(q) : t === 'username' ? q.replace(/^@/, '') : q);
  const actions = types
    .filter((t) => ROUTE_FOR[t])
    .map((t, i) => {
      const label = t === 'url' ? 'Domain' : TYPE_LABELS[t];
      return `<a class="btn ${i ? 'ghost' : ''}" href="#/${ROUTE_FOR[t]}?q=${encodeURIComponent(valueFor(t))}">Investigate as ${esc(label)} →</a>`;
    })
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
      ([label, list, type]) => `<h4>${esc(label)} <span class="badge">${list.length}</span>
        <button class="icon-btn" data-copy="${esc(list.join('\n'))}" title="Copy all">⧉</button></h4>
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

export function render(root, params) {
  const c = loadCase();
  root.innerHTML = `
    <div class="hero">
      <h1>OSINT <span class="accent">Engine</span></h1>
      <p class="muted">Paste any indicator — domain, IP, email, username, phone, URL, hash or wallet — and pivot instantly.</p>
      <form id="uform" class="search-row hero-search" autocomplete="off">
        <input id="uq" class="input" placeholder="e.g. example.com · 8.8.8.8 · jane@doe.org · @handle · +44 20 7946 0958" value="${esc(params.get('q') || '')}" spellcheck="false" autofocus />
        <button class="btn" type="submit">Analyse</button>
      </form>
      <div id="uresult"></div>
    </div>
    <div class="grid tiles">
      ${MODULES.map(([r, icon, name, desc]) => `<a class="tile" href="#/${r}"><span class="tile-i">${icon}</span><strong>${esc(name)}</strong><span class="muted">${esc(desc)}</span></a>`).join('')}
    </div>
    ${card(
      'Indicator extractor',
      `<p class="muted">Paste a report, log file, email or chat transcript. Indicators are extracted locally — nothing leaves your browser.</p>
       <textarea id="extractIn" class="input" rows="6" placeholder="Paste text here…"></textarea>
       <div id="extractOut" class="extract-out"></div>`,
    )}
    ${card(
      'Active case',
      `<p><strong>${esc(c.name)}</strong> — ${c.entities.length} entities collected. <a href="#/case">Open notebook →</a></p>`,
    )}
  `;
  const out = root.querySelector('#uresult');
  const run = () => {
    const q = root.querySelector('#uq').value.trim();
    out.innerHTML = q ? analyse(q) : '';
  };
  root.querySelector('#uform').addEventListener('submit', (e) => {
    e.preventDefault();
    run();
  });
  if (params.get('q')) run();
  const ta = root.querySelector('#extractIn');
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => (root.querySelector('#extractOut').innerHTML = ta.value.trim() ? renderExtract(ta.value) : ''), 200);
  });
}
