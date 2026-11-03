// App shell: navigation, lazy-loaded routes, command palette, theme, offline support.
import { installGlobalHandlers, esc } from './ui.js';
import { loadCase } from './case.js';
import { icon } from './icons.js';
import { pushRecent } from './recent.js';
import { detectTypes, TYPE_LABELS, toHostname } from './lib/detect.js';

/** route -> [loader, title, icon] — modules are fetched only when first visited. */
const ROUTES = {
  '': [() => import('./modules/dashboard.js'), 'Home', 'home'],
  domain: [() => import('./modules/domain.js'), 'Domain Intel', 'globe'],
  ip: [() => import('./modules/ip.js'), 'IP Intel', 'pin'],
  email: [() => import('./modules/email.js'), 'Email Intel', 'mail'],
  social: [() => import('./modules/social.js'), 'Social Profiles', 'users'],
  username: [() => import('./modules/username.js'), 'Username Search', 'user'],
  phone: [() => import('./modules/phone.js'), 'Phone Intel', 'phone'],
  image: [() => import('./modules/image.js'), 'Image Forensics', 'image'],
  headers: [() => import('./modules/headers.js'), 'Email Headers', 'inbox'],
  toolkit: [() => import('./modules/toolkit.js'), 'Crypto & Decode', 'key'],
  dorks: [() => import('./modules/dorks.js'), 'Dork Builder', 'search'],
  privacy: [() => import('./modules/privacy.js'), 'Remove My Data', 'shield'],
  tools: [() => import('./modules/tools.js'), 'Tool Directory', 'book'],
  case: [() => import('./modules/case.js'), 'Case Notebook', 'folder'],
  status: [() => import('./modules/status.js'), 'System Status', 'activity'],
  about: [() => import('./modules/about.js'), 'About & Ethics', 'info'],
};

const NAV = [
  [null, [['', 'Home']]],
  ['Investigate', [['domain', 'Domain'], ['ip', 'IP address'], ['email', 'Email'], ['social', 'Social profiles', 'NEW'], ['username', 'Username'], ['phone', 'Phone']]],
  ['Analyze', [['image', 'Image forensics'], ['headers', 'Email headers'], ['toolkit', 'Crypto & decode'], ['dorks', 'Dork builder']]],
  ['Privacy', [['privacy', 'Remove my data', 'NEW']]],
  ['Workspace', [['case', 'Case notebook'], ['tools', 'Tool directory'], ['status', 'System status'], ['about', 'About & ethics']]],
];

const SEARCHABLE = new Set(['domain', 'ip', 'email', 'social', 'username', 'phone', 'dorks']);
const ROUTE_FOR = { domain: 'domain', url: 'domain', ip: 'ip', email: 'email', username: 'username', phone: 'phone' };

function renderNav() {
  document.getElementById('nav').innerHTML = NAV.map(
    ([h, items]) =>
      (h ? `<div class="nav-h">${esc(h)}</div>` : '') +
      items
        .map(([r, label, tag]) => {
          const extra = r === 'case' ? '<span class="badge" id="caseCount" hidden>0</span>' : tag ? `<span class="new">${tag}</span>` : '';
          return `<a href="#/${r}" data-route="${r}">${icon(ROUTES[r][2])}<span>${esc(label)}</span>${extra}</a>`;
        })
        .join(''),
  ).join('');
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = h.split('?');
  return { route: path.split('/')[0], params: new URLSearchParams(qs) };
}

let lastKey = null;
let navToken = 0;

async function navigate() {
  const { route, params } = parseHash();
  const key = location.hash;
  if (key === lastKey) return;
  lastKey = key;
  const [load, title] = ROUTES[route] || ROUTES[''];
  const r = ROUTES[route] ? route : '';
  const token = ++navToken;
  document.title = r ? `${title} · OSINT Engine` : 'OSINT Engine — Open-source intelligence in your browser';
  document.querySelectorAll('[data-route]').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  document.body.classList.remove('nav-open');

  const view = document.getElementById('view');
  const page = document.createElement('div');
  page.className = 'page';
  try {
    const mod = await load();
    if (token !== navToken) return; // a newer navigation won the race
    view.replaceChildren(page);
    mod.render(page, params);
  } catch (err) {
    if (token !== navToken) return;
    view.replaceChildren(page);
    page.innerHTML = `<div class="alert bad">${icon('alert')}<span>This page failed to load${navigator.onLine ? '' : ' (you appear to be offline)'}: ${esc(err.message)}. <a href="javascript:location.reload()">Reload</a></span></div>`;
    console.error(err);
  }
  window.scrollTo(0, 0);
  const q = params.get('q');
  if (q && SEARCHABLE.has(r)) pushRecent({ route: r, q, icon: ROUTES[r][2] });
}

// Pages call history.replaceState when a form is submitted; keep lastKey in sync so it isn't re-rendered.
const origReplace = history.replaceState.bind(history);
history.replaceState = (s, t, url) => {
  origReplace(s, t, url);
  lastKey = location.hash;
  const { route, params } = parseHash();
  const q = params.get('q');
  if (q && SEARCHABLE.has(route)) pushRecent({ route, q, icon: ROUTES[route][2] });
};

function updateCaseCount() {
  const n = loadCase().entities.length;
  for (const el of document.querySelectorAll('#caseCount, #tabCaseCount')) {
    el.textContent = n;
    el.hidden = !n;
  }
}

// ---------- theme ----------
function currentTheme() {
  const root = document.documentElement;
  return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
function paintThemeIcon() {
  document.getElementById('themeToggle').innerHTML = icon(currentTheme() === 'dark' ? 'sun' : 'moon');
}
function initTheme() {
  try {
    const saved = localStorage.getItem('osint-engine.theme');
    if (saved) document.documentElement.dataset.theme = saved;
  } catch {
    /* ignore */
  }
  paintThemeIcon();
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('osint-engine.theme', next);
    } catch {
      /* ignore */
    }
    paintThemeIcon();
  });
}

// ---------- command palette ----------
function paletteItems(q) {
  const items = [];
  const s = q.trim();
  if (s) {
    const types = detectTypes(s);
    for (const t of types) {
      if (!ROUTE_FOR[t]) continue;
      const v = t === 'url' ? toHostname(s) : t === 'username' ? s.replace(/^@/, '') : s;
      items.push({ group: 'Investigate', icon: ROUTES[ROUTE_FOR[t]][2], label: `Investigate “${v}” as ${t === 'url' ? 'Domain' : TYPE_LABELS[t]}`, href: `#/${ROUTE_FOR[t]}?q=${encodeURIComponent(v)}` });
      if (t === 'username') items.push({ group: 'Investigate', icon: 'users', label: `Collect social profiles for “${v}”`, href: `#/social?q=${encodeURIComponent(v)}` });
    }
    items.push({ group: 'Investigate', icon: 'search', label: `Analyze “${s}” on the home page`, href: `#/?q=${encodeURIComponent(s)}` });
    items.push({ group: 'Investigate', icon: 'book', label: `Search the tool directory for “${s}”`, href: `#/tools?q=${encodeURIComponent(s)}` });
  }
  const low = s.toLowerCase();
  for (const [h, list] of NAV)
    for (const [r, label] of list)
      if (!low || label.toLowerCase().includes(low) || ROUTES[r][1].toLowerCase().includes(low) || (h && h.toLowerCase().includes(low)))
        items.push({ group: 'Go to', icon: ROUTES[r][2], label: ROUTES[r][1], href: `#/${r}`, hint: h || '' });
  return items;
}

function openPalette(initial = '') {
  if (document.querySelector('.cmdk-overlay')) return;
  const ov = document.createElement('div');
  ov.className = 'cmdk-overlay';
  ov.innerHTML = `<div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
    <div class="cmdk-in">${icon('search')}<input placeholder="Type an indicator or jump to a tool…" spellcheck="false" autocomplete="off" /><kbd>Esc</kbd></div>
    <div class="cmdk-list" role="listbox"></div>
    <div class="cmdk-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
  </div>`;
  document.body.appendChild(ov);
  const input = ov.querySelector('input');
  const list = ov.querySelector('.cmdk-list');
  let items = [];
  let sel = 0;
  const draw = () => {
    items = paletteItems(input.value);
    sel = Math.min(sel, Math.max(items.length - 1, 0));
    let lastGroup = '';
    list.innerHTML =
      items
        .map((it, i) => {
          const g = it.group !== lastGroup ? `<div class="cmdk-group">${esc(it.group)}</div>` : '';
          lastGroup = it.group;
          return `${g}<div class="cmdk-item ${i === sel ? 'sel' : ''}" data-i="${i}" role="option">${icon(it.icon)}<span>${esc(it.label)}</span>${it.hint ? `<span class="hint">${esc(it.hint)}</span>` : ''}</div>`;
        })
        .join('') || '<div class="cmdk-group">No matches</div>';
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => ov.remove();
  const go = (i) => {
    const it = items[i];
    if (!it) return;
    close();
    if (location.hash === it.href) lastKey = null;
    location.hash = it.href;
    if (lastKey === null) navigate();
  };
  input.addEventListener('input', () => {
    sel = 0;
    draw();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(items.length, 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % Math.max(items.length, 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    else if (e.key === 'Escape') close();
  });
  list.addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]');
    if (el) go(Number(el.dataset.i));
  });
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  input.value = initial;
  draw();
  input.focus();
}

function initKeys() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      openPalette();
    }
  });
}

// Warm the module cache when the user hovers/touches a nav link.
function initPrefetch() {
  const warm = (e) => {
    const a = e.target.closest?.('[data-route]');
    if (a && ROUTES[a.dataset.route]) ROUTES[a.dataset.route][0]().catch(() => {});
  };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('touchstart', warm, { passive: true });
}

function initServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/(localhost|127\.)/.test(location.href)) return;
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

renderNav();
installGlobalHandlers();
initTheme();
initKeys();
initPrefetch();
initServiceWorker();
document.getElementById('navToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
document.getElementById('tabMenu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
document.querySelectorAll('[data-open-palette]').forEach((b) => b.addEventListener('click', () => openPalette()));
document.addEventListener('click', (e) => {
  if (document.body.classList.contains('nav-open') && !e.target.closest('.sidebar, #navToggle, #tabMenu')) document.body.classList.remove('nav-open');
});
window.addEventListener('hashchange', navigate);
window.addEventListener('case-changed', updateCaseCount);
window.addEventListener('storage', updateCaseCount);
updateCaseCount();
navigate();
