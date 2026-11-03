import { isIP, isPrivateIPv4 } from '../lib/detect.js';
import { ipGeo, rdapIp, reverseDns } from '../lib/net.js';
import { pivots } from '../lib/pivots.js';
import { esc, card, kv, loading, errorBox, empty, pivotList, caseBtn, copyBtn, pageForm, fmtDate, mapEmbed } from '../ui.js';

async function section(el, fn) {
  try {
    el.innerHTML = await fn();
  } catch (err) {
    el.innerHTML = errorBox(err.message || String(err));
  }
}

function run(root, ip) {
  const res = root.querySelector('#results');
  const priv = isPrivateIPv4(ip);
  res.innerHTML = `
    ${priv ? '<div class="alert warn">This is a private / reserved address — it is not routable on the public internet, so external lookups will return nothing useful.</div>' : ''}
    ${card(`Target: ${ip}`, `<p class="mono big">${esc(ip)} ${copyBtn(ip)} ${caseBtn('ip', ip)}</p><h4>Pivot to</h4>${pivotList(pivots('ip', ip))}`)}
    <div class="grid two">
      ${card('Geolocation & ASN', `<div id="geo">${loading()}</div>`)}
      ${card('Network owner (RDAP)', `<div id="rdap">${loading()}</div>`)}
    </div>
    ${card('Reverse DNS (PTR)', `<div id="ptr">${loading()}</div>`)}
    ${card('Map', `<div id="map">${loading()}</div>`)}
  `;
  const $ = (s) => res.querySelector(s);
  const geoP = ipGeo(ip);
  section($('#geo'), async () => {
    const g = await geoP;
    return kv([
      ['Location', [g.flag, g.city, g.region, g.country].filter(Boolean).join(' ')],
      ['Postal', g.postal],
      ['Coordinates', g.lat != null ? `${g.lat}, ${g.lon}` : null, { copy: true }],
      ['Timezone', g.timezone],
      ['ASN', g.asn],
      ['Organisation', g.org],
      ['ISP', g.isp],
      ['Network domain', g.domain],
      ['Type', g.type],
      ['Data source', g.source],
    ]) + '<p class="muted small">IP geolocation is approximate — often the ISP’s point of presence, not the user.</p>';
  });
  section($('#map'), async () => {
    const g = await geoP;
    return g.lat != null ? mapEmbed(g.lat, g.lon, 0.2) : empty('No coordinates available.');
  });
  section($('#rdap'), async () => {
    const r = await rdapIp(ip);
    if (!r) return empty('No RDAP data.');
    return kv([
      ['Network name', r.name],
      ['Handle', r.handle],
      ['Range', r.startAddress && `${r.startAddress} – ${r.endAddress}`],
      ['CIDR', r.cidr],
      ['Country', r.country],
      ['Type', r.type],
      ['Registrant', r.registrant],
      ['Abuse contact', r.abuseEmail, { copy: true }],
      ['Registered', fmtDate(r.created)],
      ['Last changed', fmtDate(r.updated)],
      ['Data source', r.source],
    ]);
  });
  section($('#ptr'), async () => {
    const r = await reverseDns(ip);
    if (!r.length) return empty('No PTR record.');
    return r
      .map((x) => {
        const host = x.data.replace(/\.$/, '');
        return `<p><span class="mono">${esc(host)}</span> ${copyBtn(host)} <a href="#/domain?q=${encodeURIComponent(host)}">→ domain intel</a></p>`;
      })
      .join('');
  });
}

export function render(root, params) {
  const q = params.get('q') || '';
  root.innerHTML = pageForm({
    ic: 'pin',
    title: 'IP Intelligence',
    intro: 'Geolocation, ASN, network ownership via RDAP, reverse DNS and one-click reputation pivots.',
    placeholder: '8.8.8.8 or 2606:4700::1111',
    value: q,
    extra: '<p><button class="btn sm ghost" id="myip" type="button">Look up my own IP</button></p>',
  });
  const go = (v) => {
    if (!isIP(v)) {
      root.querySelector('#results').innerHTML = errorBox('Enter a valid IPv4 or IPv6 address.');
      return;
    }
    run(root, v);
  };
  root.querySelector('#pageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = root.querySelector('#q').value.trim();
    history.replaceState(null, '', `#/ip?q=${encodeURIComponent(v)}`);
    go(v);
  });
  root.querySelector('#myip').addEventListener('click', async () => {
    try {
      const g = await ipGeo('');
      root.querySelector('#q').value = g.ip;
      history.replaceState(null, '', `#/ip?q=${encodeURIComponent(g.ip)}`);
      go(g.ip);
    } catch (err) {
      root.querySelector('#results').innerHTML = errorBox(err.message);
    }
  });
  if (q) go(q);
}
