// Live lookups against free, CORS-enabled public APIs. No API keys required.

const TIMEOUT_MS = 15000;

async function getJSON(url, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: opts.headers, signal: ctl.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`${new URL(url).hostname} timed out`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- DNS over HTTPS ----------

export const DNS_TYPES = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 33: 'SRV', 257: 'CAA' };

const DOH_PROVIDERS = [
  (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
];

/** TXT data arrives as one or more quoted strings: "v=spf1 " "include:x -all" -> v=spf1 include:x -all */
export function unquoteTxt(data) {
  const parts = String(data).match(/"((?:[^"\\]|\\.)*)"/g);
  return parts ? parts.map((p) => p.slice(1, -1).replace(/\\(.)/g, '$1')).join('') : String(data);
}

export async function dnsQuery(name, type = 'A') {
  let lastErr;
  for (const build of DOH_PROVIDERS) {
    try {
      const j = await getJSON(build(name, type), { headers: { accept: 'application/dns-json' } });
      return (j?.Answer || [])
        .filter((a) => DNS_TYPES[a.type] === type)
        .map((a) => ({ type: DNS_TYPES[a.type], ttl: a.TTL, data: type === 'TXT' ? unquoteTxt(a.data) : String(a.data) }));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function dnsAll(domain, types = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA', 'CAA']) {
  const results = await Promise.allSettled(types.map((t) => dnsQuery(domain, t)));
  const out = {};
  types.forEach((t, i) => {
    out[t] = results[i].status === 'fulfilled' ? results[i].value : { error: results[i].reason?.message };
  });
  return out;
}

export function reverseName(ip) {
  if (ip.includes(':')) {
    // Expand IPv6 to 32 nibbles.
    const [head, tail = ''] = ip.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    const groups = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t].map((g) => g.padStart(4, '0'));
    return groups.join('').split('').reverse().join('.') + '.ip6.arpa';
  }
  return ip.split('.').reverse().join('.') + '.in-addr.arpa';
}

export async function reverseDns(ip) {
  return dnsQuery(reverseName(ip), 'PTR');
}

/** Summarise SPF / DMARC posture from TXT records. */
export async function emailSecurity(domain) {
  const [txt, dmarc, mx] = await Promise.all([
    dnsQuery(domain, 'TXT').catch(() => []),
    dnsQuery(`_dmarc.${domain}`, 'TXT').catch(() => []),
    dnsQuery(domain, 'MX').catch(() => []),
  ]);
  const spf = txt.find((r) => /^v=spf1/i.test(r.data))?.data || null;
  const dmarcRec = dmarc.find((r) => /^v=DMARC1/i.test(r.data))?.data || null;
  const policy = dmarcRec ? (/\bp=(\w+)/i.exec(dmarcRec) || [])[1] : null;
  return {
    mx: mx.map((r) => r.data).sort((a, b) => parseInt(a) - parseInt(b)),
    spf,
    spfAll: spf ? (/([~?+-])all\b/.exec(spf) || [])[1] || null : null,
    dmarc: dmarcRec,
    dmarcPolicy: policy,
  };
}

// ---------- RDAP (modern WHOIS) ----------

function vcardName(entity) {
  const v = entity?.vcardArray?.[1];
  if (!Array.isArray(v)) return null;
  const fn = v.find((x) => x[0] === 'fn');
  const org = v.find((x) => x[0] === 'org');
  return (fn && fn[3]) || (org && org[3]) || null;
}

function vcardEmail(entity) {
  const v = entity?.vcardArray?.[1];
  const em = Array.isArray(v) ? v.find((x) => x[0] === 'email') : null;
  return em ? em[3] : null;
}

function flattenEntities(entities = [], out = []) {
  for (const ent of entities) {
    out.push(ent);
    if (ent.entities) flattenEntities(ent.entities, out);
  }
  return out;
}

export function summariseRdap(j) {
  if (!j) return null;
  const events = {};
  for (const ev of j.events || []) events[ev.eventAction] = ev.eventDate;
  const ents = flattenEntities(j.entities);
  const byRole = (role) => ents.filter((x) => (x.roles || []).includes(role));
  const registrar = byRole('registrar')[0];
  const abuse = byRole('abuse')[0];
  const registrant = byRole('registrant')[0];
  return {
    handle: j.handle || null,
    name: j.ldhName || j.name || null,
    status: j.status || [],
    registrar: vcardName(registrar),
    registrarIana: registrar?.publicIds?.find((p) => /iana/i.test(p.type))?.identifier || null,
    registrant: vcardName(registrant),
    abuseEmail: vcardEmail(abuse),
    created: events.registration || null,
    updated: events['last changed'] || null,
    expires: events.expiration || null,
    nameservers: (j.nameservers || []).map((n) => n.ldhName?.toLowerCase()).filter(Boolean),
    // IP network fields
    startAddress: j.startAddress || null,
    endAddress: j.endAddress || null,
    cidr: (j.cidr0_cidrs || []).map((c) => `${c.v4prefix || c.v6prefix}/${c.length}`),
    country: j.country || null,
    type: j.type || null,
    secureDNS: j.secureDNS?.delegationSigned ?? null,
  };
}

export async function rdapDomain(domain) {
  return summariseRdap(await getJSON(`https://rdap.org/domain/${encodeURIComponent(domain)}`));
}

export async function rdapIp(ip) {
  return summariseRdap(await getJSON(`https://rdap.org/ip/${encodeURIComponent(ip)}`));
}

// ---------- IP geolocation ----------

export async function ipGeo(ip = '') {
  const j = await getJSON(`https://ipwho.is/${encodeURIComponent(ip)}`);
  if (!j || j.success === false) throw new Error(j?.message || 'Geolocation lookup failed');
  return {
    ip: j.ip,
    type: j.type,
    continent: j.continent,
    country: j.country,
    countryCode: j.country_code,
    region: j.region,
    city: j.city,
    postal: j.postal,
    lat: j.latitude,
    lon: j.longitude,
    asn: j.connection?.asn ? `AS${j.connection.asn}` : null,
    org: j.connection?.org || null,
    isp: j.connection?.isp || null,
    domain: j.connection?.domain || null,
    timezone: j.timezone?.id || null,
    flag: j.flag?.emoji || '',
  };
}

// ---------- Certificate transparency (subdomain discovery) ----------

export function subdomainsFromNames(names, domain) {
  const set = new Set();
  const suffix = `.${domain.toLowerCase()}`;
  for (const raw of names) {
    for (let n of String(raw).split(/\s+/)) {
      n = n.trim().toLowerCase().replace(/^\*\./, '');
      if (n === domain.toLowerCase() || n.endsWith(suffix)) set.add(n);
    }
  }
  return [...set].sort();
}

export async function ctSubdomains(domain) {
  try {
    const j = await getJSON(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`, { timeout: 30000 });
    return { source: 'crt.sh', names: subdomainsFromNames((j || []).map((c) => c.name_value), domain), certs: (j || []).length };
  } catch (err) {
    const j = await getJSON(
      `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`,
    );
    return { source: 'Cert Spotter', names: subdomainsFromNames((j || []).flatMap((c) => c.dns_names || []), domain), certs: (j || []).length };
  }
}

// ---------- Web archive ----------

export async function waybackInfo(target) {
  const [avail, first] = await Promise.allSettled([
    getJSON(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}`),
    getJSON(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}&timestamp=19900101`),
  ]);
  const snap = (r) => (r.status === 'fulfilled' ? r.value?.archived_snapshots?.closest : null);
  const fmt = (s) => (s ? { url: s.url, timestamp: s.timestamp, date: tsToIso(s.timestamp) } : null);
  return { latest: fmt(snap(avail)), earliest: fmt(snap(first)) };
}

function tsToIso(ts) {
  if (!ts || ts.length < 8) return null;
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}
