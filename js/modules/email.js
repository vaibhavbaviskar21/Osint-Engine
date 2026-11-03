import { isEmail } from '../lib/detect.js';
import { md5 } from '../lib/md5.js';
import { digest } from '../lib/hash.js';
import { emailSecurity, rdapDomain } from '../lib/net.js';
import { pivots } from '../lib/pivots.js';
import { emailPermutations } from '../lib/username.js';
import { esc, card, kv, loading, errorBox, empty, pivotList, caseBtn, copyBtn, pageForm, fmtDate, ageFrom } from '../ui.js';

const FREE_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.de',
  'mail.com', 'yandex.com', 'yandex.ru', 'mail.ru', 'zoho.com', 'tutanota.com', 'tuta.io', 'fastmail.com',
  'web.de', 'qq.com', '163.com', 'rediffmail.com',
]);

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'sharklasers.com', '10minutemail.com', 'temp-mail.org',
  'tempmail.com', 'throwawaymail.com', 'yopmail.com', 'getnada.com', 'trashmail.com', 'dispostable.com',
  'maildrop.cc', 'mailnesia.com', 'fakeinbox.com', 'mintemail.com', 'emailondeck.com', 'mohmal.com', 'tempail.com',
  'burnermail.io', 'spamgourmet.com', 'mailcatch.com', 'inboxkitten.com', '33mail.com', 'anonaddy.me', 'simplelogin.com',
]);

async function section(el, fn) {
  try {
    el.innerHTML = await fn();
  } catch (err) {
    el.innerHTML = errorBox(err.message || String(err));
  }
}

function run(root, email) {
  const res = root.querySelector('#results');
  const norm = email.trim().toLowerCase();
  const [local, domain] = norm.split('@');
  const plus = local.includes('+') ? local.split('+')[0] : null;
  const kind = DISPOSABLE.has(domain) ? ['bad', 'Disposable / masking provider'] : FREE_PROVIDERS.has(domain) ? ['info', 'Free webmail provider'] : ['good', 'Custom / organisational domain'];

  res.innerHTML = `
    ${card(`Target: ${email}`, `<p class="mono big">${esc(email)} ${copyBtn(email)} ${caseBtn('email', email)}</p>
      <ul class="flags"><li class="${kind[0]}">${esc(kind[1])}</li>${plus ? `<li class="info">Plus-addressing detected — base mailbox is ${esc(plus)}@${esc(domain)}</li>` : ''}</ul>
      ${kv([['Local part', local], ['Domain', domain]])}
      <div class="actions">
        <a class="btn ghost" href="#/domain?q=${encodeURIComponent(domain)}">Investigate domain →</a>
        <a class="btn ghost" href="#/username?q=${encodeURIComponent((plus || local).replace(/[^a-z0-9_.-]/g, ''))}">Search “${esc(plus || local)}” as username →</a>
      </div>
      <h4>Pivot to</h4>${pivotList(pivots('email', email))}`)}
    <div class="grid two">
      ${card('Mail server & security', `<div id="mx">${loading()}</div>`)}
      ${card('Gravatar', `<div id="grav">${loading()}</div>`)}
    </div>
    ${card('Domain registration', `<div id="rdap">${loading()}</div>`)}
  `;
  const $ = (s) => res.querySelector(s);
  section($('#mx'), async () => {
    const s = await emailSecurity(domain);
    return (
      (s.mx.length ? '<ul class="flags"><li class="good">Domain accepts mail (MX present)</li></ul>' : '<ul class="flags"><li class="bad">No MX records — address cannot receive mail</li></ul>') +
      kv([['MX', s.mx], ['SPF', s.spf], ['DMARC', s.dmarc]])
    );
  });
  section($('#grav'), async () => {
    const h5 = md5(norm);
    const h256 = await digest('SHA-256', norm);
    return `<div class="grav">
        <img src="https://gravatar.com/avatar/${h256}?d=404&s=160" alt="Gravatar" width="96" height="96"
          onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'muted',textContent:'No Gravatar image for this address.'}))" />
        <div>${kv([['MD5', h5, { copy: true }], ['SHA-256', h256, { copy: true }]])}
        <p><a href="https://gravatar.com/${h256}" target="_blank" rel="noopener noreferrer">Open Gravatar profile ↗</a></p></div>
      </div><p class="muted small">Loading the image sends the hashed address to Gravatar.</p>`;
  });
  section($('#rdap'), async () => {
    if (FREE_PROVIDERS.has(domain)) return empty('Free webmail provider — registration data is not informative.');
    const r = await rdapDomain(domain);
    if (!r) return empty('No RDAP record.');
    return kv([
      ['Registrar', r.registrar],
      ['Created', r.created && `${fmtDate(r.created)} (${ageFrom(r.created)})`],
      ['Expires', fmtDate(r.expires)],
      ['Nameservers', r.nameservers],
    ]) + (r.created && Date.now() - Date.parse(r.created) < 90 * 86400000 ? '<ul class="flags"><li class="bad">Domain registered less than 90 days ago — common in phishing.</li></ul>' : '');
  });
}

export function render(root, params) {
  const q = params.get('q') || '';
  root.innerHTML = pageForm({
    ic: 'mail',
    title: 'Email Intelligence',
    intro: 'Validate deliverability, inspect mail security, find Gravatar, and pivot to breach & leak sources.',
    placeholder: 'name@example.com',
    value: q,
  }) +
    card(
      'Email permutator',
      `<p class="muted">Know a person’s name and their organisation’s domain? Generate the likely address formats.</p>
       <div class="row3">
         <input class="input" id="pf" placeholder="First name" />
         <input class="input" id="pl" placeholder="Last name" />
         <input class="input" id="pd" placeholder="company.com" />
       </div>
       <div id="perms"></div>`,
    );
  const go = (v) => {
    if (!isEmail(v)) {
      root.querySelector('#results').innerHTML = errorBox('Enter a valid email address.');
      return;
    }
    run(root, v);
  };
  root.querySelector('#pageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = root.querySelector('#q').value.trim();
    history.replaceState(null, '', `#/email?q=${encodeURIComponent(v)}`);
    go(v);
  });
  const upd = () => {
    const list = emailPermutations(root.querySelector('#pf').value, root.querySelector('#pl').value, root.querySelector('#pd').value);
    root.querySelector('#perms').innerHTML = list.length
      ? `<p><button class="btn sm ghost" data-copy="${esc(list.join('\n'))}">Copy all ${list.length}</button></p>
         <ul class="ioc-list cols">${list.map((m) => `<li><a class="mono" href="#/email?q=${encodeURIComponent(m)}">${esc(m)}</a></li>`).join('')}</ul>`
      : '';
  };
  for (const id of ['#pf', '#pl', '#pd']) root.querySelector(id).addEventListener('input', upd);
  if (q) go(q);
}
