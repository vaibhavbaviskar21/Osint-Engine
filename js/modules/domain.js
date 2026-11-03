import { isDomain, toHostname, isIPv4 } from '../lib/detect.js';
import { dnsAll, rdapDomain, ctSubdomains, waybackInfo, emailSecurity, ipGeo } from '../lib/net.js';
import { pivots } from '../lib/pivots.js';
import { esc, card, kv, loading, errorBox, empty, pivotList, caseBtn, copyBtn, pageForm, fmtDate, ageFrom, link } from '../ui.js';

function dnsTable(records) {
  const rows = [];
  for (const [type, list] of Object.entries(records)) {
    if (list?.error) rows.push(`<tr><th>${type}</th><td class="muted">error: ${esc(list.error)}</td></tr>`);
    else
      for (const r of list) {
        const pivot =
          (type === 'A' || type === 'AAAA') ? ` <a href="#/ip?q=${encodeURIComponent(r.data)}">→ IP intel</a> ${caseBtn('ip', r.data)}` : '';
        rows.push(`<tr><th>${type}</th><td><span class="mono">${esc(r.data)}</span>${copyBtn(r.data)}${pivot}</td><td class="muted">${r.ttl}s</td></tr>`);
      }
  }
  return rows.length ? `<table class="kv dns">${rows.join('')}</table>` : empty('No DNS records found — the domain may not exist.');
}

function mailPosture(s) {
  const grade = [];
  grade.push(s.mx.length ? ['good', `MX: ${s.mx.length} mail server(s)`] : ['info', 'No MX records — domain does not receive mail']);
  if (!s.spf) grade.push(['bad', 'No SPF record — anyone can spoof this domain']);
  else if (s.spfAll === '-') grade.push(['good', 'SPF hard-fail (-all)']);
  else if (s.spfAll === '~') grade.push(['warn', 'SPF soft-fail (~all)']);
  else grade.push(['bad', `SPF is permissive (${s.spfAll || 'no'} all)`]);
  if (!s.dmarc) grade.push(['bad', 'No DMARC record']);
  else if (s.dmarcPolicy === 'reject') grade.push(['good', 'DMARC p=reject']);
  else if (s.dmarcPolicy === 'quarantine') grade.push(['warn', 'DMARC p=quarantine']);
  else grade.push(['warn', `DMARC p=${s.dmarcPolicy || 'none'} (monitoring only)`]);
  return `<ul class="flags">${grade.map(([l, m]) => `<li class="${l}">${esc(m)}</li>`).join('')}</ul>
    ${kv([['SPF', s.spf, { copy: true }], ['DMARC', s.dmarc, { copy: true }], ['MX', s.mx]])}`;
}

async function section(el, fn) {
  try {
    el.innerHTML = await fn();
  } catch (err) {
    el.innerHTML = errorBox(err.message || String(err));
  }
}

export async function run(root, domain) {
  const res = root.querySelector('#results');
  res.innerHTML = `
    ${card(`Target: ${domain}`, `<p class="mono big">${esc(domain)} ${copyBtn(domain)} ${caseBtn('domain', domain)}</p><h4>Pivot to</h4>${pivotList(pivots('domain', domain))}`)}
    <div class="grid two">
      ${card('Registration (RDAP / WHOIS)', `<div id="rdap">${loading()}</div>`)}
      ${card('Hosting', `<div id="hosting">${loading()}</div>`)}
    </div>
    ${card('DNS records', `<div id="dns">${loading()}</div>`)}
    <div class="grid two">
      ${card('Email security posture', `<div id="mail">${loading()}</div>`)}
      ${card('Web archive', `<div id="wb">${loading()}</div>`)}
    </div>
    ${card('Subdomains (certificate transparency)', `<div id="subs">${loading('Searching CT logs — can take ~20s…')}</div>`)}
  `;
  const $ = (id) => res.querySelector(id);

  section($('#rdap'), async () => {
    const r = await rdapDomain(domain);
    if (!r) return empty('No RDAP record (unregistered, or the TLD has no RDAP service).');
    return kv([
      ['Domain', r.name],
      ['Registrar', r.registrar],
      ['IANA ID', r.registrarIana],
      ['Registrant', r.registrant],
      ['Created', r.created && `${fmtDate(r.created)} (${ageFrom(r.created)})`],
      ['Updated', fmtDate(r.updated)],
      ['Expires', r.expires && `${fmtDate(r.expires)} (${ageFrom(r.expires)})`],
      ['Status', r.status],
      ['Nameservers', r.nameservers],
      ['DNSSEC', r.secureDNS === null ? null : r.secureDNS ? 'signed' : 'unsigned'],
      ['Abuse contact', r.abuseEmail, { copy: true }],
      ['Data source', r.source],
    ]);
  });

  const dnsP = dnsAll(domain);
  section($('#dns'), async () => dnsTable(await dnsP));
  section($('#hosting'), async () => {
    const d = await dnsP;
    const a = Array.isArray(d.A) ? d.A.map((r) => r.data).filter(isIPv4) : [];
    if (!a.length) return empty('No A records to geolocate.');
    const geos = await Promise.allSettled(a.slice(0, 4).map((ip) => ipGeo(ip)));
    return geos
      .map((g, i) =>
        g.status === 'fulfilled'
          ? `<div class="sub"><a class="mono" href="#/ip?q=${encodeURIComponent(a[i])}">${esc(a[i])}</a>${kv([
              ['Location', [g.value.flag, g.value.city, g.value.region, g.value.country].filter(Boolean).join(' ')],
              ['ASN', g.value.asn],
              ['Org / ISP', [g.value.org, g.value.isp].filter((x, j, arr) => x && arr.indexOf(x) === j).join(' / ')],
            ])}</div>`
          : `<div class="sub mono">${esc(a[i])} — ${esc(g.reason?.message)}</div>`,
      )
      .join('');
  });

  section($('#mail'), async () => mailPosture(await emailSecurity(domain)));

  section($('#wb'), async () => {
    const w = await waybackInfo(domain);
    if (!w.latest && !w.earliest) return empty('No snapshots in the Wayback Machine.') + link(`https://web.archive.org/save/${domain}`, 'Save a snapshot now ↗');
    return kv([
      ['Earliest snapshot', w.earliest ? `${link(w.earliest.url, w.earliest.date)}` : null, { raw: true }],
      ['Latest snapshot', w.latest ? `${link(w.latest.url, w.latest.date)}` : null, { raw: true }],
      ['All captures', link(`https://web.archive.org/web/*/${domain}/*`, 'Browse URL index ↗'), { raw: true }],
    ]);
  });

  section($('#subs'), async () => {
    const r = await ctSubdomains(domain);
    if (!r.names.length) return empty(`No names found via ${r.source}.`);
    return `<p class="muted">${r.names.length} unique names from ${r.certs} certificates (${esc(r.source)}).
        <button class="btn sm ghost" data-copy="${esc(r.names.join('\n'))}">Copy all</button></p>
      <input class="input filter" placeholder="Filter subdomains…" id="subFilter" />
      <ul class="ioc-list cols" id="subList">${r.names
        .map((n) => `<li data-n="${esc(n)}"><a class="mono" href="#/domain?q=${encodeURIComponent(n)}">${esc(n)}</a></li>`)
        .join('')}</ul>`;
  }).then(() => {
    const f = res.querySelector('#subFilter');
    f?.addEventListener('input', () => {
      const v = f.value.toLowerCase();
      res.querySelectorAll('#subList li').forEach((li) => (li.hidden = !li.dataset.n.includes(v)));
    });
  });
}

export function render(root, params) {
  const q = params.get('q') || '';
  root.innerHTML = pageForm({
    ic: 'globe',
    title: 'Domain Intelligence',
    intro: 'Live DNS (DNS-over-HTTPS), RDAP registration data, certificate-transparency subdomains, mail security and archive history.',
    placeholder: 'example.com',
    value: q,
  });
  const go = (v) => {
    const d = toHostname(v);
    const res = root.querySelector('#results');
    if (!isDomain(d)) {
      res.innerHTML = errorBox('That does not look like a valid domain name.');
      return;
    }
    run(root, d);
  };
  root.querySelector('#pageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = root.querySelector('#q').value.trim();
    history.replaceState(null, '', `#/domain?q=${encodeURIComponent(toHostname(v))}`);
    go(v);
  });
  if (q) go(q);
}
