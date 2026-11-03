// Hash router + shell wiring.
import { installGlobalHandlers } from './ui.js';
import { loadCase } from './case.js';
import * as dashboard from './modules/dashboard.js';
import * as domain from './modules/domain.js';
import * as ip from './modules/ip.js';
import * as email from './modules/email.js';
import * as username from './modules/username.js';
import * as phone from './modules/phone.js';
import * as image from './modules/image.js';
import * as headers from './modules/headers.js';
import * as dorks from './modules/dorks.js';
import * as toolkit from './modules/toolkit.js';
import * as tools from './modules/tools.js';
import * as caseMod from './modules/case.js';
import * as about from './modules/about.js';

const ROUTES = {
  '': [dashboard, 'Dashboard'],
  domain: [domain, 'Domain Intel'],
  ip: [ip, 'IP Intel'],
  email: [email, 'Email Intel'],
  username: [username, 'Username Search'],
  phone: [phone, 'Phone Intel'],
  image: [image, 'Image Forensics'],
  headers: [headers, 'Email Headers'],
  dorks: [dorks, 'Dork Builder'],
  toolkit: [toolkit, 'Crypto & Decode'],
  tools: [tools, 'Tool Directory'],
  case: [caseMod, 'Case Notebook'],
  about: [about, 'About & Ethics'],
};

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = h.split('?');
  return { route: path.split('/')[0], params: new URLSearchParams(qs) };
}

let lastKey = null;

function navigate() {
  const { route, params } = parseHash();
  const [mod, title] = ROUTES[route] || ROUTES[''];
  const key = location.hash;
  if (key === lastKey) return;
  lastKey = key;
  const view = document.getElementById('view');
  const page = document.createElement('div');
  page.className = 'page';
  view.replaceChildren(page);
  document.title = `${title} · OSINT Engine`;
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${route}`));
  document.body.classList.remove('nav-open');
  try {
    mod.render(page, params);
  } catch (err) {
    page.innerHTML = `<div class="alert bad">Failed to render: ${String(err.message).replace(/</g, '&lt;')}</div>`;
    console.error(err);
  }
  window.scrollTo(0, 0);
}

// Forms on module pages call history.replaceState, which doesn't fire hashchange;
// keep lastKey in sync so the same hash isn't re-rendered on the next real navigation.
const origReplace = history.replaceState.bind(history);
history.replaceState = (s, t, url) => {
  origReplace(s, t, url);
  lastKey = location.hash;
};

function updateCaseCount() {
  const n = loadCase().entities.length;
  const el = document.getElementById('caseCount');
  if (el) {
    el.textContent = n;
    el.hidden = !n;
  }
}

function initTheme() {
  const root = document.documentElement;
  let saved = null;
  try {
    saved = localStorage.getItem('osint-engine.theme');
  } catch {
    /* ignore */
  }
  if (saved) root.dataset.theme = saved;
  document.getElementById('themeToggle').addEventListener('click', () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try {
      localStorage.setItem('osint-engine.theme', root.dataset.theme);
    } catch {
      /* ignore */
    }
  });
}

function initKeys() {
  let g = false;
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') {
      const i = document.querySelector('#view input.input');
      if (i) {
        e.preventDefault();
        i.focus();
        i.select();
      }
    } else if (g && e.key === 'h') {
      location.hash = '#/';
    }
    g = e.key === 'g';
  });
}

installGlobalHandlers();
initTheme();
initKeys();
document.getElementById('navToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));
window.addEventListener('hashchange', navigate);
window.addEventListener('case-changed', updateCaseCount);
window.addEventListener('storage', updateCaseCount);
updateCaseCount();
navigate();
