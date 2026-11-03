import { ADAPTERS, MANUAL_ONLY, collectProfiles, linkedIdentities } from '../lib/social.js';
import { cleanUsername } from '../lib/username.js';
import { addEntity } from '../case.js';
import { icon } from '../icons.js';
import { esc, card, errorBox, caseBtn, copyBtn, pageForm, safeUrl, fmtDate, toast, infoBox } from '../ui.js';

const VALID = /^[A-Za-z0-9_.-]{1,60}$/;
const n = (v) => (typeof v === 'number' ? v.toLocaleString() : v);

function avatar(src, label) {
  // Restricted to [A-Z0-9] because it is also embedded in the inline onerror handler below.
  const initial = (/[A-Z0-9]/.exec(String(label || '').trim().charAt(0).toUpperCase()) || ['?'])[0];
  if (!src) return `<div class="avatar">${initial}</div>`;
  return `<img class="avatar" src="${esc(safeUrl(src))}" alt="" loading="lazy" referrerpolicy="no-referrer"
    onerror="this.outerHTML='<div class=&quot;avatar&quot;>${initial}</div>'" />`;
}

function profileCard(o) {
  const p = o.result.profile || {};
  const stats = Object.entries(p.stats || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const items = (o.result.items || []).filter((i) => i.title || i.text).slice(0, 5);
  const links = o.result.links || [];
  const url = p.url || o.profileUrl;
  return `<article class="profile found">
    <div class="profile-h">${avatar(p.avatar, p.name || p.handle)}
      <div class="who"><strong>${esc(p.name || p.handle || '—')}</strong>
        <span class="muted small">${esc(o.name)} · @${esc(p.handle || '')}</span></div>
      <a class="icon-btn" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer" title="Open profile">${icon('external')}</a>
    </div>
    <div class="profile-b">
      ${p.bio ? `<div class="bio">${esc(p.bio.slice(0, 400))}</div>` : ''}
      <div class="statrow">
        ${stats.map(([k, v]) => `<span><b>${esc(n(v))}</b> ${esc(k)}</span>`).join('')}
        ${p.created ? `<span>${icon('clock')} Joined <b>${esc(String(p.created).slice(0, 10))}</b></span>` : ''}
        ${p.location ? `<span>${icon('pin')} ${esc(p.location)}</span>` : ''}
        ${p.company ? `<span>${esc(p.company)}</span>` : ''}
      </div>
      ${links.length ? `<div class="chips">${links.map((l) => `<span class="pill ${l.verified ? 'good' : ''}" title="${esc(l.label)}">${l.verified ? icon('check') : ''}${esc(l.value)}</span>`).join('')}</div>` : ''}
      ${items.length ? `<h4>Recent public activity</h4><ul class="posts">${items
        .map((i) => `<li>${i.url ? `<a href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer">${esc(i.title || (i.text || '').slice(0, 220))}</a>` : esc(i.title || (i.text || '').slice(0, 220))}
          ${i.title && i.text ? `<div class="muted small">${esc(i.text.slice(0, 160))}</div>` : ''}
          <span class="meta">${[i.meta, i.date ? fmtDate(i.date) : null].filter(Boolean).map(esc).join(' · ')}</span></li>`)
        .join('')}</ul>` : ''}
      <div>${caseBtn('profile', url, `${o.name}: ${p.name || p.handle || ''}`)}</div>
    </div>
  </article>`;
}

function run(root, username) {
  const u = cleanUsername(username);
  const res = root.querySelector('#results');
  const total = ADAPTERS.length;
  let done = 0;
  let hits = 0;
  res.innerHTML = `
    ${card(`Scanning “${u}”`, `
      <div class="summary-bar">
        <div><span class="num" id="hitN">0</span> <span class="muted">accounts found</span></div>
        <div class="progress"><i id="bar" style="width:0%"></i></div>
        <span class="muted small" id="progTxt">0 / ${total} checked</span>
      </div>
      <div class="mini-list" id="minis" style="margin-top:.9rem">${ADAPTERS.map((a) => `<span class="mini" id="m-${a.id}"><span class="dot pending"></span>${esc(a.name)}</span>`).join('')}</div>
      <div class="actions" id="exportBar" hidden>
        <button class="btn sm" id="addAll" type="button">${icon('plus')} Add all found to case</button>
        <button class="btn sm ghost" id="dlJson" type="button">${icon('download')} Download JSON</button>
        <a class="btn sm ghost" href="#/username?q=${encodeURIComponent(u)}">${icon('grid')} Check ${esc('94')} more sites manually</a>
      </div>`)}
    <div id="links"></div>
    <div class="profile-grid" id="profiles"></div>
    <div id="misses"></div>
    ${card('Platforms that block automated lookups', `
      ${infoBox('Instagram, X, TikTok, Facebook, LinkedIn and others require login or prohibit automated collection in their terms, and block requests from browsers. Open them manually below — collecting them automatically would need a server using each platform’s official API.')}
      <div class="pivots">${MANUAL_ONLY.map(([name, fn]) => `<a class="chip" href="${esc(safeUrl(fn(u)))}" target="_blank" rel="noopener noreferrer">${esc(name)} ${icon('external')}</a>`).join('')}</div>`)}
  `;
  const $ = (s) => res.querySelector(s);

  collectProfiles(u, {
    onResult(o) {
      done++;
      const dot = o.status === 'found' ? 'good' : o.status === 'error' ? 'warn' : 'bad';
      const mini = $(`#m-${o.id}`);
      if (mini) mini.innerHTML = `<span class="dot ${dot}"></span>${esc(o.name)}`;
      if (o.status === 'found') {
        hits++;
        $('#profiles').insertAdjacentHTML('beforeend', profileCard(o));
      }
      $('#hitN').textContent = hits;
      $('#bar').style.width = `${Math.round((done / total) * 100)}%`;
      $('#progTxt').textContent = `${done} / ${total} checked`;
    },
  }).then((outcomes) => {
    const ids = linkedIdentities(outcomes);
    if (ids.length)
      $('#links').innerHTML = card(
        'Linked identities',
        `<p class="muted small">Websites, handles and proofs the person published on their own profiles — strong pivots for correlation.</p>
         <ul class="ioc-list">${ids.map((l) => `<li><span class="pill">${esc(l.label)}</span> <span class="mono">${esc(l.value)}</span> ${copyBtn(l.value)}
           <span class="muted small">from ${esc(l.sources.join(', '))}</span></li>`).join('')}</ul>`,
      );
    const nf = outcomes.filter((o) => o.status === 'not_found');
    const err = outcomes.filter((o) => o.status === 'error');
    $('#misses').innerHTML =
      (nf.length ? card(`Not found (${nf.length})`, `<div class="mini-list">${nf.map((o) => `<a class="mini" href="${esc(safeUrl(o.profileUrl))}" target="_blank" rel="noopener noreferrer"><span class="dot bad"></span>${esc(o.name)}</a>`).join('')}</div>`) : '') +
      (err.length ? card(`Couldn’t check (${err.length})`, `<p class="muted small">The platform didn’t answer (rate limit, outage or browser block). Retry later or open manually.</p>
        <ul class="ioc-list">${err.map((o) => `<li><a href="${esc(safeUrl(o.profileUrl))}" target="_blank" rel="noopener noreferrer">${esc(o.name)}</a> <span class="muted small">— ${esc(o.error)}</span></li>`).join('')}</ul>`) : '');
    if (!hits) $('#profiles').innerHTML = '';
    $('#exportBar').hidden = false;
    $('#addAll').addEventListener('click', () => {
      const found = outcomes.filter((o) => o.status === 'found');
      for (const o of found) addEntity({ type: 'profile', value: o.result.profile?.url || o.profileUrl, note: `${o.name} account for “${u}”` });
      toast(found.length ? `Added ${found.length} profiles to case` : 'Nothing to add');
    });
    $('#dlJson').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ username: u, collected: new Date().toISOString(), outcomes }, null, 2)], { type: 'application/json' }));
      a.download = `social-${u}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  });
}

export function render(root, params) {
  const q = params.get('q') || '';
  root.innerHTML = pageForm({
    ic: 'users',
    title: 'Social Profile Collector',
    intro: `Confirms which accounts exist for a username on ${ADAPTERS.length} platforms using their official public APIs, then collects the public profile, stats, linked identities and recent public posts.`,
    placeholder: 'username (e.g. torvalds)',
    value: q,
    button: 'Collect',
  });
  const go = (v) => {
    const u = cleanUsername(v);
    if (!VALID.test(u)) {
      root.querySelector('#results').innerHTML = errorBox('Usernames may contain letters, numbers, dot, dash and underscore.');
      return;
    }
    run(root, u);
  };
  root.querySelector('#pageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = root.querySelector('#q').value.trim();
    history.replaceState(null, '', `#/social?q=${encodeURIComponent(cleanUsername(v))}`);
    go(v);
  });
  if (q) go(q);
}
