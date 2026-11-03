import { profileUrls, cleanUsername, handlePermutations, SITES } from '../lib/username.js';
import { pivots } from '../lib/pivots.js';
import { esc, card, errorBox, pivotList, caseBtn, copyBtn, pageForm, safeUrl } from '../ui.js';

const VALID = /^[A-Za-z0-9_.-]{1,40}$/;

function run(root, username) {
  const u = cleanUsername(username);
  const res = root.querySelector('#results');
  const list = profileUrls(u);
  const cats = [...new Set(list.map((s) => s.cat))];
  res.innerHTML = `
    ${card(`Handle: ${u}`, `<p class="mono big">${esc(u)} ${copyBtn(u)} ${caseBtn('username', u)}</p>
      <p class="muted">Browsers block cross-site existence checks, so each profile opens in a new tab for you to verify.
      For automated checking use <a href="https://github.com/sherlock-project/sherlock" target="_blank" rel="noopener">Sherlock</a>,
      <a href="https://github.com/soxoj/maigret" target="_blank" rel="noopener">Maigret</a> or
      <a href="https://whatsmyname.app" target="_blank" rel="noopener">WhatsMyName</a>.</p>
      <div class="actions">
        <input class="input filter" id="siteFilter" placeholder="Filter platforms…" />
        <button class="btn sm ghost" id="openVisible" type="button">Open visible (batches of 10)</button>
        <button class="btn sm ghost" data-copy="${esc(list.map((s) => s.profile).join('\n'))}">Copy all URLs</button>
      </div>
      <h4>Search engines</h4>${pivotList(pivots('username', u))}`)}
    <div id="siteGroups">
    ${cats
      .map(
        (c) => card(
          c,
          `<div class="site-grid">${list
            .filter((s) => s.cat === c)
            .map(
              (s) => `<a class="site" data-name="${esc(s.name.toLowerCase())}" href="${esc(safeUrl(s.profile))}" target="_blank" rel="noopener noreferrer">
                <strong>${esc(s.name)}</strong><span class="mono small">${esc(s.profile.replace(/^https?:\/\//, ''))}</span></a>`,
            )
            .join('')}</div>`,
        ),
      )
      .join('')}
    </div>`;
  const filter = res.querySelector('#siteFilter');
  filter.addEventListener('input', () => {
    const v = filter.value.toLowerCase();
    res.querySelectorAll('.site').forEach((a) => (a.hidden = !a.dataset.name.includes(v)));
  });
  let batch = 0;
  res.querySelector('#openVisible').addEventListener('click', (e) => {
    const visible = [...res.querySelectorAll('.site')].filter((a) => !a.hidden);
    const slice = visible.slice(batch * 10, batch * 10 + 10);
    slice.forEach((a) => window.open(a.href, '_blank', 'noopener'));
    batch = (batch + 1) * 10 >= visible.length ? 0 : batch + 1;
    e.target.textContent = batch ? `Open next 10 (${batch * 10}/${visible.length})` : 'Open visible (batches of 10)';
  });
}

export function render(root, params) {
  const q = params.get('q') || '';
  root.innerHTML =
    pageForm({
      title: 'Username Search',
      intro: `Generate profile links for a handle across ${SITES.length} platforms, grouped by category.`,
      placeholder: 'johndoe',
      value: q,
      button: 'Search',
    }) +
    card(
      'Handle generator',
      `<p class="muted">Generate likely usernames from a real name (plus an optional number like a birth year).</p>
       <div class="row3">
         <input class="input" id="hf" placeholder="First name" />
         <input class="input" id="hl" placeholder="Last name" />
         <input class="input" id="hx" placeholder="Extra (e.g. 1990)" />
       </div><div id="handles"></div>`,
    );
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
    history.replaceState(null, '', `#/username?q=${encodeURIComponent(cleanUsername(v))}`);
    go(v);
  });
  const upd = () => {
    const list = handlePermutations(root.querySelector('#hf').value, root.querySelector('#hl').value, root.querySelector('#hx').value);
    root.querySelector('#handles').innerHTML = list.length
      ? `<p><button class="btn sm ghost" data-copy="${esc(list.join('\n'))}">Copy all ${list.length}</button></p>
         <ul class="ioc-list cols">${list.map((h) => `<li><a class="mono" href="#/username?q=${encodeURIComponent(h)}">${esc(h)}</a></li>`).join('')}</ul>`
      : '';
  };
  for (const id of ['#hf', '#hl', '#hx']) root.querySelector(id).addEventListener('input', upd);
  if (q) go(q);
}
