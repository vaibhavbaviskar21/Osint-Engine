// Shared UI helpers: escaping, cards, key/value tables, copy & case buttons.
import { addEntity } from './case.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Only allow http(s) links to be rendered. */
export function safeUrl(u) {
  try {
    const url = new URL(u, location.href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '#';
  } catch {
    return '#';
  }
}

export const link = (url, text) =>
  `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(text ?? url)}</a>`;

export function card(title, body, opts = {}) {
  return `<section class="card ${opts.cls || ''}" ${opts.id ? `id="${esc(opts.id)}"` : ''}>
    <header class="card-h"><h3>${esc(title)}</h3>${opts.actions || ''}</header>
    <div class="card-b">${body}</div>
  </section>`;
}

export const loading = (msg = 'Querying…') => `<div class="loading"><span class="spinner"></span>${esc(msg)}</div>`;
export const errorBox = (msg) => `<div class="alert bad">⚠ ${esc(msg)}</div>`;
export const empty = (msg) => `<p class="muted">${esc(msg)}</p>`;

/** Render [[key, value, {raw:boolean, copy:boolean}]] rows; null/empty values are skipped. */
export function kv(rows) {
  const html = rows
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v, o = {}]) => {
      const val = o.raw ? v : esc(Array.isArray(v) ? v.join(', ') : v);
      const copy = o.copy ? copyBtn(Array.isArray(v) ? v.join(', ') : v) : '';
      return `<tr><th>${esc(k)}</th><td><span class="mono">${val}</span>${copy}</td></tr>`;
    })
    .join('');
  return html ? `<table class="kv">${html}</table>` : empty('No data.');
}

export function copyBtn(text) {
  return `<button class="icon-btn" data-copy="${esc(text)}" title="Copy">⧉</button>`;
}

export function caseBtn(type, value, note = '') {
  return `<button class="btn sm ghost" data-case-type="${esc(type)}" data-case-value="${esc(value)}" data-case-note="${esc(note)}" title="Add to case notebook">＋ Case</button>`;
}

export function pivotList(items) {
  return `<div class="pivots">${items.map((p) => `<a class="chip" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.name)} ↗</a>`).join('')}</div>`;
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 1800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Copied to clipboard');
}

/** Global delegated handlers for copy / add-to-case buttons. */
export function installGlobalHandlers() {
  document.addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-copy]');
    if (c) {
      ev.preventDefault();
      copyText(c.getAttribute('data-copy'));
      return;
    }
    const k = ev.target.closest('[data-case-type]');
    if (k) {
      ev.preventDefault();
      addEntity({ type: k.dataset.caseType, value: k.dataset.caseValue, note: k.dataset.caseNote });
      toast('Added to case notebook');
    }
  });
}

/** Standard page scaffold with a title, intro and a single-input form. */
export function pageForm({ title, intro, placeholder, value = '', button = 'Investigate', extra = '' }) {
  return `<div class="page-h"><h1>${esc(title)}</h1><p class="muted">${intro}</p></div>
    <form class="search-row" id="pageForm" autocomplete="off">
      <input id="q" class="input" placeholder="${esc(placeholder)}" value="${esc(value)}" spellcheck="false" />
      <button class="btn" type="submit">${esc(button)}</button>
    </form>${extra}
    <div id="results" class="results"></div>`;
}

export function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
}

export function ageFrom(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (Number.isNaN(days)) return '';
  if (days < 0) return `in ${Math.abs(days)} days`;
  if (days < 60) return `${days} days ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${(days / 365).toFixed(1)} years ago`;
}

export function mapEmbed(lat, lon, zoom = 0.05) {
  const bbox = [lon - zoom, lat - zoom, lon + zoom, lat + zoom].map((n) => n.toFixed(5)).join(',');
  return `<iframe class="map" loading="lazy" referrerpolicy="no-referrer" title="Map"
    src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}"></iframe>
    <div class="pivots">
      ${link(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`, 'OpenStreetMap ↗')}
      ${link(`https://www.google.com/maps?q=${lat},${lon}`, 'Google Maps ↗')}
      ${link(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`, 'Street View ↗')}
      ${link(`https://earth.google.com/web/@${lat},${lon},500a,1000d,35y,0h,0t,0r`, 'Google Earth ↗')}
      ${link(`https://www.suncalc.org/#/${lat},${lon},15/null/null/null/null`, 'SunCalc ↗')}
    </div>`;
}
