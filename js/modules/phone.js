import { parsePhone, phoneVariants } from '../lib/phone.js';
import { pivots } from '../lib/pivots.js';
import { esc, card, kv, errorBox, pivotList, caseBtn, copyBtn, pageForm } from '../ui.js';

function run(root, raw) {
  const p = parsePhone(raw);
  const res = root.querySelector('#results');
  if (!p.valid) {
    res.innerHTML = errorBox('Phone numbers need 7–15 digits. Include the country code with a leading + for country detection.');
    return;
  }
  const variants = phoneVariants(p);
  const display = p.e164 || p.digits;
  const orQuery = variants.map((v) => `"${v}"`).join(' OR ');
  res.innerHTML = `
    ${card(`Number: ${display}`, `<p class="mono big">${esc(display)} ${copyBtn(display)} ${caseBtn('phone', display)}</p>
      ${kv([
        ['Country / region', p.country || 'Unknown — add +countrycode'],
        ['Calling code', p.code ? `+${p.code}` : null],
        ['National number', p.national],
        ['E.164', p.e164, { copy: true }],
      ])}
      ${p.international ? '' : '<div class="alert warn">No international prefix given, so the country cannot be determined. Prefix with + and the calling code (e.g. +44…).</div>'}
      <h4>Pivot to</h4>${pivotList(pivots('phone', display))}`)}
    ${card('Written variants', `<p class="muted">People write numbers many ways. Search each variant — or all at once.</p>
      <ul class="ioc-list cols">${variants.map((v) => `<li><span class="mono">${esc(v)}</span> ${copyBtn(v)}</li>`).join('')}</ul>
      <div class="actions">
        <a class="btn" target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(orQuery)}">Google all variants ↗</a>
        <a class="btn ghost" target="_blank" rel="noopener noreferrer" href="https://www.bing.com/search?q=${encodeURIComponent(orQuery)}">Bing all variants ↗</a>
        ${p.e164 ? `<a class="btn ghost" target="_blank" rel="noopener noreferrer" href="https://wa.me/${p.digits}">WhatsApp ↗</a>
        <a class="btn ghost" target="_blank" rel="noopener noreferrer" href="https://t.me/+${p.digits}">Telegram ↗</a>` : ''}
      </div>`)}
  `;
}

export function render(root, params) {
  const q = params.get('q') || '';
  root.innerHTML = pageForm({
    ic: 'phone',
    title: 'Phone Intelligence',
    intro: 'Identify the country from the calling code, normalise to E.164 and search every written variant.',
    placeholder: '+1 415 555 0123',
    value: q,
  });
  root.querySelector('#pageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = root.querySelector('#q').value.trim();
    history.replaceState(null, '', `#/phone?q=${encodeURIComponent(v)}`);
    run(root, v);
  });
  if (q) run(root, q);
}
