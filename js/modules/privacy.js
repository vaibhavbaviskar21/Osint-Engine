import { BROKERS, SEARCH_REMOVAL, ACCOUNTS, LAWS, REVIEWED, generateLetter, progress } from '../lib/removal.js';
import { icon } from '../icons.js';
import { esc, card, pageHeader, safeUrl, copyText, toast, infoBox } from '../ui.js';

const KEY = 'oe.privacy.v1';
const ALL = [...BROKERS, ...SEARCH_REMOVAL, ...ACCOUNTS];

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { done: s.done || {}, profile: s.profile || {}, step: s.step || 0 };
  } catch {
    return { done: {}, profile: {}, step: 0 };
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

const STEPS = ['Find yourself', 'Data brokers', 'Search engines', 'Old accounts', 'Legal requests'];
const g = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function checklist(list, state, { showHow = true } = {}) {
  return `<div class="check-list">${list
    .map((x) => {
      const done = !!state.done[x.id];
      return `<div class="check-row ${done ? 'done' : ''}">
        <input type="checkbox" data-done="${esc(x.id)}" ${done ? 'checked' : ''} aria-label="Mark ${esc(x.name)} done" />
        <div class="body"><div class="title">${esc(x.name)} ${x.region ? `<span class="pill">${esc(x.region)}</span>` : ''} ${x.effort ? `<span class="pill ${x.effort === 'easy' ? 'good' : x.effort === 'hard' ? 'bad' : 'warn'}">${esc(x.effort)}</span>` : ''}</div>
          ${showHow && x.how ? `<div class="how">${esc(x.how)}</div>` : ''}
          ${done ? `<div class="how">Completed ${esc(state.done[x.id].slice(0, 10))}</div>` : ''}</div>
        <div class="act"><a class="btn sm ${done ? 'ghost' : ''}" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">${done ? 'Open again' : 'Start'} ${icon('external')}</a></div>
      </div>`;
    })
    .join('')}</div>`;
}

function selfSearch(p) {
  const searches = [];
  if (p.fullName) searches.push([`“${p.fullName}”`, g(`"${p.fullName}"`)]);
  if (p.fullName && p.city) searches.push([`“${p.fullName}” ${p.city}`, g(`"${p.fullName}" "${p.city}"`)]);
  if (p.email) searches.push([`“${p.email}”`, g(`"${p.email}"`)]);
  if (p.phone) searches.push([`“${p.phone}”`, g(`"${p.phone}"`)]);
  if (p.username) searches.push([`“${p.username}”`, g(`"${p.username}"`)]);
  return `${searches.length ? `<h4>Search yourself</h4><div class="pivots">${searches.map(([l, u]) => `<a class="chip" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${icon('search')} Google ${esc(l)}</a>`).join('')}</div>` : ''}
     <h4>Check your exposure</h4>
     <div class="pivots">
       <a class="chip" href="https://haveibeenpwned.com/" target="_blank" rel="noopener noreferrer">${icon('shield')} Have I Been Pwned (breaches)</a>
       <a class="chip" href="https://myactivity.google.com/results-about-you" target="_blank" rel="noopener noreferrer">${icon('eyeOff')} Google “Results about you”</a>
       ${p.username ? `<a class="chip" href="#/social?q=${encodeURIComponent(p.username)}">${icon('users')} Find my social accounts</a>
       <a class="chip" href="#/username?q=${encodeURIComponent(p.username)}">${icon('user')} Check my username on 94 sites</a>` : ''}
       ${p.email ? `<a class="chip" href="#/email?q=${encodeURIComponent(p.email)}">${icon('mail')} Analyse my email</a>` : ''}
       <a class="chip" href="#/image">${icon('image')} Check my photos for hidden GPS</a>
     </div>`;
}

function stepFind(state) {
  const p = state.profile;
  return card(
    'Step 1 — See what’s out there',
    `<p class="muted">Enter your own details. They’re saved only in this browser (so the letters in step 5 can be pre-filled) and never sent to us.</p>
     <div class="form-grid" id="profileForm">
       ${[['fullName', 'Full name', 'Jane Doe'], ['city', 'City', 'Pune'], ['email', 'Email', 'jane@example.com'], ['phone', 'Phone', '+91 98765 43210'], ['username', 'Username / handle', 'janedoe']]
         .map(([k, l, ph]) => `<label><span>${l}</span><input class="input" data-p="${k}" value="${esc(p[k] || '')}" placeholder="${ph}" /></label>`)
         .join('')}
     </div>
     <div class="actions"><button class="btn sm ghost" id="forget" type="button">${icon('trash')} Forget my details</button></div>
     <div id="selfSearch">${selfSearch(p)}</div>
     <div class="actions"><button class="btn" data-goto="1" type="button">Next: data brokers ${icon('arrow')}</button></div>`,
  );
}

function stepBrokers(state, region) {
  const list = BROKERS.filter((b) => region === 'All' || b.region === region);
  const pr = progress(state.done, BROKERS);
  return card(
    `Step 2 — Opt out of data brokers (${pr.done}/${pr.total})`,
    `<p class="muted">People-search sites compile your name, address, phone, relatives and age from public records and sell it. Each one has a free opt-out. Start with the <span class="pill good">easy</span> ones; tick each off as you finish.</p>
     ${infoBox('Tip: use a separate email address for opt-out confirmations, and re-check every 3–6 months — brokers often re-list people.')}
     <div class="chips" id="regionChips">${['All', 'US', 'Global'].map((r) => `<button class="chip ${r === region ? 'active' : ''}" data-region="${r}" type="button">${r}</button>`).join('')}</div>
     ${checklist(list, state)}
     <div class="actions"><button class="btn" data-goto="2" type="button">Next: search engines ${icon('arrow')}</button></div>`,
  );
}

function stepSearch(state) {
  return card(
    'Step 3 — Remove results from search engines',
    `<p class="muted">Removing a page from Google doesn’t delete it from the website, but it stops most people from finding it. Do this <em>after</em> brokers remove you, so results update.</p>
     ${checklist(SEARCH_REMOVAL, state)}
     <div class="actions"><button class="btn" data-goto="3" type="button">Next: old accounts ${icon('arrow')}</button></div>`,
  );
}

function stepAccounts(state) {
  return card(
    'Step 4 — Delete accounts you no longer use',
    `<p class="muted">Old accounts leak data in breaches and keep your profile public. Download your data first if you want a copy.</p>
     ${checklist(ACCOUNTS, state, { showHow: false })}
     <div class="actions"><button class="btn" data-goto="4" type="button">Next: legal requests ${icon('arrow')}</button></div>`,
  );
}

function stepLetters(state) {
  const p = state.profile;
  return card(
    'Step 5 — Send a legal deletion request',
    `<p class="muted">For companies without an opt-out form, privacy laws give you the right to demand deletion. Generate a ready-to-send letter, then email it to the company’s privacy contact (usually listed in their privacy policy).</p>
     <div class="form-grid">
       <label><span>Law</span><select class="input" data-l="law">${Object.entries(LAWS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select></label>
       <label><span>Company</span><input class="input" data-l="company" list="companyList" placeholder="e.g. Spokeo" /></label>
       <label><span>Send to (privacy email)</span><input class="input" data-l="to" placeholder="privacy@company.com" /></label>
       <label><span>Your full name</span><input class="input" data-l="fullName" value="${esc(p.fullName || '')}" /></label>
       <label><span>Your email</span><input class="input" data-l="email" value="${esc(p.email || '')}" /></label>
       <label><span>Phone (optional)</span><input class="input" data-l="phone" value="${esc(p.phone || '')}" /></label>
       <label><span>Postal address (optional)</span><input class="input" data-l="address" /></label>
       <label><span>Other names / usernames (optional)</span><input class="input" data-l="otherNames" value="${esc(p.username || '')}" /></label>
     </div>
     <label style="display:block;margin-top:.7rem"><span class="field-l">URLs of pages about you (optional, one per line)</span><textarea class="input" data-l="urls" rows="2"></textarea></label>
     <datalist id="companyList">${BROKERS.map((b) => `<option value="${esc(b.name.split(' (')[0])}">`).join('')}</datalist>
     <h4>Preview</h4>
     <pre class="letter" id="letter"></pre>
     <div class="actions">
       <button class="btn" id="copyLetter" type="button">${icon('copy')} Copy letter</button>
       <a class="btn ghost" id="mailLetter" href="#">${icon('mail')} Open in email app</a>
       <button class="btn ghost" id="dlLetter" type="button">${icon('download')} Download .txt</button>
     </div>
     <p class="muted small">This is a template, not legal advice. Companies may ask you to verify your identity — share only the minimum they need.</p>`,
  );
}

export function render(root) {
  const state = load();
  let region = 'All';

  const draw = () => {
    const pr = progress(state.done, ALL);
    const stepDone = [
      !!(state.profile.fullName || state.profile.email),
      progress(state.done, BROKERS).done === BROKERS.length,
      progress(state.done, SEARCH_REMOVAL).done === SEARCH_REMOVAL.length,
      progress(state.done, ACCOUNTS).done > 0,
      false,
    ];
    const body = [stepFind, (s) => stepBrokers(s, region), stepSearch, stepAccounts, stepLetters][state.step](state);
    root.innerHTML = `
      ${pageHeader('Remove My Data', 'Take your personal information back. A guided, free, do-it-yourself privacy cleanup — find where you’re exposed, opt out of data brokers, clean up search results and delete old accounts. Your progress is saved in this browser only.', 'shield')}
      <div class="card"><div class="card-b">
        <div class="summary-bar">
          <div><span class="num">${pr.pct}%</span> <span class="muted">cleanup complete</span></div>
          <div class="progress"><i style="width:${pr.pct}%"></i></div>
          <span class="muted small">${pr.done} of ${pr.total} actions done</span>
        </div>
      </div></div>
      <div class="steps">${STEPS.map((s, i) => `<button class="step ${i === state.step ? 'active' : ''} ${stepDone[i] && i !== state.step ? 'done' : ''}" data-goto="${i}" type="button"><span class="n">${stepDone[i] && i !== state.step ? '✓' : i + 1}</span>${esc(s)}</button>`).join('')}</div>
      ${body}
      ${card('Done-for-you removal', `<p class="muted">A managed service that sends and tracks these requests on your behalf (with your signed authorization) and re-checks brokers every few months is planned. It needs a secure backend, so it isn’t available in this browser-only version yet.</p>
        <p class="muted small">Opt-out links last reviewed ${esc(REVIEWED)}. Data brokers change their processes often — if a link is broken, search “[broker name] opt out”.</p>`)}
    `;
    wire();
  };

  const persist = () => save(state);

  const wire = () => {
    root.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => {
        state.step = Number(b.dataset.goto);
        persist();
        draw();
        root.querySelector('.steps')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
    );
    root.querySelectorAll('[data-done]').forEach((c) =>
      c.addEventListener('change', () => {
        if (c.checked) state.done[c.dataset.done] = new Date().toISOString();
        else delete state.done[c.dataset.done];
        persist();
        draw();
        if (c.checked) toast('Nice — progress saved');
      }),
    );
    root.querySelectorAll('[data-region]').forEach((b) =>
      b.addEventListener('click', () => {
        region = b.dataset.region;
        draw();
      }),
    );
    root.querySelectorAll('[data-p]').forEach((i) => {
      i.addEventListener('input', () => {
        state.profile[i.dataset.p] = i.value.trim();
        persist();
      });
      // Refresh only the search links — never re-render the form, so focus and typing are preserved.
      i.addEventListener('change', () => {
        const box = root.querySelector('#selfSearch');
        if (box) box.innerHTML = selfSearch(state.profile);
      });
    });
    root.querySelector('#forget')?.addEventListener('click', () => {
      state.profile = {};
      persist();
      draw();
      toast('Your details were removed from this browser');
    });

    const letterEl = root.querySelector('#letter');
    if (letterEl) {
      const read = () => {
        const f = {};
        root.querySelectorAll('[data-l]').forEach((i) => (f[i.dataset.l] = i.value));
        return f;
      };
      const update = () => {
        const f = read();
        const { subject, body } = generateLetter(f);
        letterEl.textContent = `Subject: ${subject}\n\n${body}`;
        const mail = root.querySelector('#mailLetter');
        mail.href = `mailto:${encodeURIComponent(f.to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        return { subject, body, f };
      };
      root.querySelectorAll('[data-l]').forEach((i) => i.addEventListener('input', update));
      update();
      root.querySelector('#copyLetter').addEventListener('click', () => {
        const { subject, body } = update();
        copyText(`Subject: ${subject}\n\n${body}`);
      });
      root.querySelector('#dlLetter').addEventListener('click', () => {
        const { subject, body, f } = update();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([`Subject: ${subject}\n\n${body}\n`], { type: 'text/plain' }));
        a.download = `deletion-request-${(f.company || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
    }
  };

  draw();
}
