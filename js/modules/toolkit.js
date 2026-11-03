import { allHashes, identifyHash } from '../lib/hash.js';
import { hashKind } from '../lib/detect.js';
import { pivots } from '../lib/pivots.js';
import * as E from '../lib/encoding.js';
import { esc, card, kv, errorBox, pivotList, caseBtn, pageHeader } from '../ui.js';

const TRANSFORMS = [
  ['b64e', 'Base64 encode', E.b64Encode],
  ['b64d', 'Base64 decode', E.b64Decode],
  ['urle', 'URL encode', E.urlEncode],
  ['urld', 'URL decode', E.urlDecode],
  ['hexe', 'Hex encode', E.hexEncode],
  ['hexd', 'Hex decode', E.hexDecode],
  ['bine', 'Binary encode', E.binaryEncode],
  ['bind', 'Binary decode', E.binaryDecode],
  ['htmld', 'HTML entity decode', E.htmlDecode],
  ['htmle', 'HTML entity encode', E.htmlEncode],
  ['rot13', 'ROT13', E.rot13],
  ['rev', 'Reverse', E.reverse],
  ['lower', 'lowercase', (s) => s.toLowerCase()],
  ['upper', 'UPPERCASE', (s) => s.toUpperCase()],
  ['defang', 'Defang IOCs', (s) => s.replace(/\./g, '[.]').replace(/^http/gim, 'hxxp').replace(/@/g, '[@]')],
  ['refang', 'Refang IOCs', (s) => s.replace(/\[\.\]/g, '.').replace(/^hxxp/gim, 'http').replace(/\[@\]/g, '@')],
];

export function render(root) {
  root.innerHTML = `
    ${pageHeader(`Crypto & Decode Toolkit`, `Everyday analyst utilities. Everything runs locally in your browser.`, 'key')}
    <div class="grid two">
      ${card('Hash generator', `<textarea id="hin" class="input" rows="4" placeholder="Text to hash…"></textarea><div id="hout"></div>`)}
      ${card('Hash identifier', `<input id="hid" class="input" placeholder="Paste a hash: 5f4dcc3b5aa765d61d8327deb882cf99" /><div id="hidout"></div>`)}
    </div>
    ${card('Encoder / decoder', `
      <textarea id="ein" class="input" rows="4" placeholder="Input…"></textarea>
      <div class="chips" id="ops">${TRANSFORMS.map(([id, name]) => `<button class="chip" data-op="${id}">${esc(name)}</button>`).join('')}</div>
      <textarea id="eout" class="input mono" rows="4" placeholder="Output…" readonly></textarea>
      <div class="actions"><button class="btn sm ghost" id="swap">⇅ Use output as input</button></div>`)}
    <div class="grid two">
      ${card('JWT decoder', `<textarea id="jwt" class="input" rows="3" placeholder="eyJhbGciOi…"></textarea><div id="jwtout"></div>`)}
      ${card('Timestamp converter', `<input id="ts" class="input" placeholder="1700000000 · 1700000000000 · 2024-05-14T09:12:07Z" />
        <p><button class="btn sm ghost" id="now">Now</button></p><div id="tsout"></div>`)}
    </div>`;

  const $ = (s) => root.querySelector(s);
  let ht;
  $('#hin').addEventListener('input', () => {
    clearTimeout(ht);
    ht = setTimeout(async () => {
      const v = $('#hin').value;
      if (!v) return ($('#hout').innerHTML = '');
      const h = await allHashes(v);
      $('#hout').innerHTML = kv(Object.entries(h).map(([k, x]) => [k.toUpperCase(), x, { copy: true }]));
    }, 150);
  });

  $('#hid').addEventListener('input', () => {
    const v = $('#hid').value.trim();
    if (!v) return ($('#hidout').innerHTML = '');
    const c = identifyHash(v);
    const kind = hashKind(v);
    $('#hidout').innerHTML =
      (c.length ? `<p>Possible algorithms: ${c.map((x, i) => `<span class="pill ${i ? '' : 'good'}">${esc(x)}</span>`).join(' ')}</p>` : '<p class="muted">Unrecognised format.</p>') +
      (kind ? `<p>${caseBtn('hash', v)}</p><h4>Look up</h4>${pivotList(pivots('hash', v))}` : '');
  });

  let lastOp = null;
  const apply = (op) => {
    const t = TRANSFORMS.find((x) => x[0] === op);
    if (!t) return;
    lastOp = op;
    root.querySelectorAll('#ops .chip').forEach((b) => b.classList.toggle('active', b.dataset.op === op));
    try {
      $('#eout').value = t[2]($('#ein').value);
      $('#eout').classList.remove('err');
    } catch (err) {
      $('#eout').value = `Error: ${err.message}`;
      $('#eout').classList.add('err');
    }
  };
  $('#ops').addEventListener('click', (e) => {
    const b = e.target.closest('[data-op]');
    if (b) apply(b.dataset.op);
  });
  $('#ein').addEventListener('input', () => lastOp && apply(lastOp));
  $('#swap').addEventListener('click', () => {
    $('#ein').value = $('#eout').value;
    if (lastOp) apply(lastOp);
  });

  $('#jwt').addEventListener('input', () => {
    const v = $('#jwt').value.trim();
    if (!v) return ($('#jwtout').innerHTML = '');
    try {
      const j = E.jwtDecode(v);
      $('#jwtout').innerHTML = `<h4>Header</h4><pre class="mono">${esc(JSON.stringify(j.header, null, 2))}</pre>
        <h4>Payload</h4><pre class="mono">${esc(JSON.stringify(j.payload, null, 2))}</pre>
        ${kv(Object.entries(j.times))}<p class="muted small">Signature is not verified.</p>`;
    } catch (err) {
      $('#jwtout').innerHTML = errorBox(err.message);
    }
  });

  const ts = () => {
    const v = $('#ts').value.trim();
    if (!v) return ($('#tsout').innerHTML = '');
    try {
      const t = E.timestampInfo(v);
      $('#tsout').innerHTML = kv([
        ['ISO 8601', t.iso, { copy: true }], ['UTC', t.utc], ['Local', t.local],
        ['Unix (s)', t.unix, { copy: true }], ['Unix (ms)', t.unixMs, { copy: true }],
      ]);
    } catch (err) {
      $('#tsout').innerHTML = errorBox(err.message);
    }
  };
  $('#ts').addEventListener('input', ts);
  $('#now').addEventListener('click', () => {
    $('#ts').value = String(Math.floor(Date.now() / 1000));
    ts();
  });
}
