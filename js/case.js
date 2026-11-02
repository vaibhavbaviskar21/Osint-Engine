// Case notebook persistence (localStorage). Everything stays on the analyst's machine.

const KEY = 'osint-engine.case.v1';

function blank() {
  return { name: 'Untitled investigation', created: new Date().toISOString(), entities: [], notes: '' };
}

export function loadCase() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const c = JSON.parse(raw);
    return { ...blank(), ...c, entities: Array.isArray(c.entities) ? c.entities : [] };
  } catch {
    return blank();
  }
}

export function saveCase(c) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable (private mode) — keep in-memory only */
  }
  window.dispatchEvent(new CustomEvent('case-changed'));
}

export function addEntity({ type, value, note = '' }) {
  const c = loadCase();
  const existing = c.entities.find((e) => e.type === type && e.value === value);
  if (existing) {
    if (note && !existing.note.includes(note)) existing.note = [existing.note, note].filter(Boolean).join('\n');
  } else {
    c.entities.unshift({ id: crypto.randomUUID?.() || String(Date.now() + Math.random()), type, value, note, tags: [], added: new Date().toISOString() });
  }
  saveCase(c);
}

export function removeEntity(id) {
  const c = loadCase();
  c.entities = c.entities.filter((e) => e.id !== id);
  saveCase(c);
}

export function updateEntity(id, patch) {
  const c = loadCase();
  const e = c.entities.find((x) => x.id === id);
  if (e) Object.assign(e, patch);
  saveCase(c);
}

export function caseToMarkdown(c) {
  const lines = [`# ${c.name}`, '', `_Created: ${c.created}_  `, `_Exported: ${new Date().toISOString()}_`, ''];
  if (c.notes) lines.push('## Notes', '', c.notes, '');
  const byType = {};
  for (const e of c.entities) (byType[e.type] ||= []).push(e);
  lines.push(`## Entities (${c.entities.length})`, '');
  for (const [type, list] of Object.entries(byType)) {
    lines.push(`### ${type}`, '');
    for (const e of list) {
      lines.push(`- \`${e.value}\`${e.tags?.length ? ` [${e.tags.join(', ')}]` : ''} — added ${e.added}`);
      if (e.note) for (const l of e.note.split('\n')) lines.push(`  - ${l}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function caseToCsv(c) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return ['type,value,tags,note,added', ...c.entities.map((e) => [e.type, e.value, (e.tags || []).join(';'), e.note, e.added].map(q).join(','))].join('\n');
}
