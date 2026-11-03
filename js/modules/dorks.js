import { buildDork, ENGINES, engineUrl, DORK_TEMPLATES, fillTemplate } from '../lib/dork.js';
import { esc, card, copyBtn, safeUrl } from '../ui.js';

const FIELDS = [
  ['keywords', 'Keywords', 'annual report'],
  ['exact', 'Exact phrase', 'John Smith'],
  ['site', 'Site / domain', 'example.com, gov.uk'],
  ['filetype', 'File type', 'pdf, xlsx'],
  ['intitle', 'In title', 'confidential'],
  ['inurl', 'In URL', 'admin'],
  ['intext', 'In text', 'password'],
  ['exclude', 'Exclude words', 'jobs, careers'],
  ['excludeSite', 'Exclude sites', 'linkedin.com'],
  ['after', 'After (YYYY-MM-DD)', '2023-01-01'],
  ['before', 'Before (YYYY-MM-DD)', '2024-12-31'],
];

const engineButtons = (q) =>
  ENGINES.map((e) => `<a class="chip" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(engineUrl(e, q)))}">${esc(e.name)} ↗</a>`).join('');

export function render(root, params) {
  root.innerHTML = `
    <div class="page-h"><h1>Dork Builder</h1>
      <p class="muted">Compose advanced search-engine queries, or run ready-made recon templates against a target. Use only on targets you’re authorised to research.</p></div>
    ${card('Query builder', `<div class="form-grid">${FIELDS.map(([k, l, p]) => `<label><span>${esc(l)}</span><input class="input" data-f="${k}" placeholder="${esc(p)}" /></label>`).join('')}</div>
      <p class="muted small">Comma-separate values to OR them together.</p>
      <div class="query-box"><code id="query" class="mono">…</code><span id="qcopy"></span></div>
      <div class="pivots" id="engines"></div>`)}
    ${card('Recon templates', `<form class="search-row" id="tform"><input class="input" id="target" placeholder="Target domain, company or handle" value="${esc(params.get('q') || '')}" /><button class="btn" type="submit">Generate</button></form>
      <div id="templates"></div>`)}
  `;
  const upd = () => {
    const f = {};
    root.querySelectorAll('[data-f]').forEach((i) => (f[i.dataset.f] = i.value));
    const q = buildDork(f);
    root.querySelector('#query').textContent = q || '…';
    root.querySelector('#qcopy').innerHTML = q ? copyBtn(q) : '';
    root.querySelector('#engines').innerHTML = q ? engineButtons(q) : '';
  };
  root.querySelectorAll('[data-f]').forEach((i) => i.addEventListener('input', upd));

  const gen = () => {
    const t = root.querySelector('#target').value.trim();
    if (!t) return;
    const cats = [...new Set(DORK_TEMPLATES.map((d) => d.cat))];
    root.querySelector('#templates').innerHTML = cats
      .map(
        (c) => `<h4>${esc(c)}</h4><div class="dork-list">${DORK_TEMPLATES.filter((d) => d.cat === c)
          .map((d) => {
            const q = fillTemplate(d.q, t);
            return `<div class="dork"><div><strong>${esc(d.name)}</strong> ${copyBtn(q)}<br><code class="mono small">${esc(q)}</code></div>
              <div class="pivots">${engineButtons(q)}</div></div>`;
          })
          .join('')}</div>`,
      )
      .join('');
  };
  root.querySelector('#tform').addEventListener('submit', (e) => {
    e.preventDefault();
    gen();
  });
  if (params.get('q')) gen();
}
