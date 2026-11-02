import { loadCase, saveCase, removeEntity, updateEntity, addEntity, caseToMarkdown, caseToCsv } from '../case.js';
import { detectType, toHostname, TYPE_LABELS } from '../lib/detect.js';
import { esc, card, copyBtn, toast } from '../ui.js';

const ROUTES = { domain: 'domain', ip: 'ip', email: 'email', username: 'username', phone: 'phone', url: 'domain' };

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'case';

export function render(root) {
  const draw = () => {
    const c = loadCase();
    const types = [...new Set(c.entities.map((e) => e.type))];
    root.innerHTML = `
      <div class="page-h"><h1>Case Notebook</h1>
        <p class="muted">Collect indicators as you pivot. Stored only in this browser — export regularly.</p></div>
      ${card('Case', `<input class="input big" id="cname" value="${esc(c.name)}" />
        <p class="muted small">Created ${esc(c.created)} · ${c.entities.length} entities</p>
        <textarea class="input" id="cnotes" rows="4" placeholder="Investigation notes, hypotheses, timeline…">${esc(c.notes)}</textarea>
        <div class="actions">
          <button class="btn sm" id="xmd">Export Markdown</button>
          <button class="btn sm ghost" id="xjson">Export JSON</button>
          <button class="btn sm ghost" id="xcsv">Export CSV</button>
          <label class="btn sm ghost">Import JSON<input type="file" id="ijson" accept="application/json,.json" hidden /></label>
          <button class="btn sm danger" id="clear">New case</button>
        </div>`)}
      ${card('Add entity', `<form class="search-row" id="addForm"><input class="input" id="newv" placeholder="Any indicator — type is auto-detected" /><button class="btn" type="submit">Add</button></form>`)}
      ${card(`Entities (${c.entities.length})`, c.entities.length
        ? `<div class="chips">${types.map((t) => `<span class="pill">${esc(t)}: ${c.entities.filter((e) => e.type === t).length}</span>`).join('')}</div>
           <table class="entities"><thead><tr><th>Type</th><th>Value</th><th>Note</th><th></th></tr></thead><tbody>
           ${c.entities
             .map(
               (e) => `<tr data-id="${esc(e.id)}">
                 <td><span class="pill">${esc(e.type)}</span></td>
                 <td><span class="mono">${esc(e.value)}</span> ${copyBtn(e.value)} ${ROUTES[e.type] ? `<a href="#/${ROUTES[e.type]}?q=${encodeURIComponent(e.type === 'url' ? toHostname(e.value) : e.value)}">→</a>` : ''}<div class="muted small">${esc(e.added)}</div></td>
                 <td><textarea class="input note" rows="2" placeholder="Add a note…">${esc(e.note || '')}</textarea></td>
                 <td><button class="icon-btn del" title="Remove">✕</button></td></tr>`,
             )
             .join('')}</tbody></table>`
        : '<p class="muted">No entities yet. Use the “＋ Case” buttons throughout the app, or add one above.</p>')}
    `;
    const $ = (s) => root.querySelector(s);
    $('#cname').addEventListener('change', () => saveCase({ ...loadCase(), name: $('#cname').value.trim() || 'Untitled investigation' }));
    $('#cnotes').addEventListener('change', () => saveCase({ ...loadCase(), notes: $('#cnotes').value }));
    $('#xmd').addEventListener('click', () => { const x = loadCase(); download(`${slug(x.name)}.md`, caseToMarkdown(x), 'text/markdown'); });
    $('#xjson').addEventListener('click', () => { const x = loadCase(); download(`${slug(x.name)}.json`, JSON.stringify(x, null, 2), 'application/json'); });
    $('#xcsv').addEventListener('click', () => { const x = loadCase(); download(`${slug(x.name)}.csv`, caseToCsv(x), 'text/csv'); });
    $('#ijson').addEventListener('change', async (ev) => {
      try {
        const data = JSON.parse(await ev.target.files[0].text());
        if (!Array.isArray(data.entities)) throw new Error('Missing entities array');
        saveCase(data);
        toast('Case imported');
        draw();
      } catch (err) {
        toast(`Import failed: ${err.message}`);
      }
    });
    $('#clear').addEventListener('click', () => {
      if (!confirm('Start a new case? The current case will be deleted from this browser (export it first!).')) return;
      localStorage.removeItem('osint-engine.case.v1');
      saveCase(loadCase());
      draw();
    });
    $('#addForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = $('#newv').value.trim();
      if (!v) return;
      const t = detectType(v);
      addEntity({ type: t, value: v });
      toast(`Added as ${TYPE_LABELS[t] || t}`);
      draw();
    });
    root.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.querySelector('.del').addEventListener('click', () => { removeEntity(tr.dataset.id); draw(); });
      tr.querySelector('.note').addEventListener('change', (ev) => updateEntity(tr.dataset.id, { note: ev.target.value }));
    });
  };
  draw();
}
