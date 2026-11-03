// Live lookups against free, CORS-enabled public APIs. No API keys required.
// Every lookup has at least one fallback provider; responses are cached by http.js.

import { fetchJSON, firstSuccessful } from './http.js';

// Every lookup below has a backup provider, so fail over quickly: one retry, short backoff.
const getJSON = (url, opts = {}) => fetchJSON(url, { retries: 1, backoff: 250, ...opts });

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
      const j = await getJSON(build(name, type), { headers: { accept: 'application/dns-json' }, ttl: 5 * 60 * 1000, retries: 1 });
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

const VERISIGN_TLDS = { com: 'com', net: 'net', cc: 'cc', tv: 'tv' };

export async function rdapDomain(domain) {
  const tld = domain.split('.').pop().toLowerCase();
  const providers = [{ name: 'rdap.org', run: () => getJSON(`https://rdap.org/domain/${encodeURIComponent(domain)}`) }];
  if (VERISIGN_TLDS[tld])
    providers.push({ name: 'Verisign RDAP', run: () => getJSON(`https://rdap.verisign.com/${tld}/v1/domain/${encodeURIComponent(domain)}`) });
  try {
    const { value, source } = await firstSuccessful(providers);
    return { ...summariseRdap(value), source };
  } catch (err) {
    if (/no data/.test(err.message) && !/unreachable|timed out|responded/.test(err.message)) return null;
    throw err;
  }
}

export async function rdapIp(ip) {
  const { value, source } = await firstSuccessful([
    { name: 'rdap.org', run: () => getJSON(`https://rdap.org/ip/${encodeURIComponent(ip)}`) },
    { name: 'ARIN RDAP', run: () => getJSON(`https://rdap.arin.net/registry/ip/${encodeURIComponent(ip)}`) },
  ]);
  return { ...summariseRdap(value), source };
}

// ---------- IP geolocation ----------

const flagEmoji = (cc) =>
  cc && /^[A-Za-z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '';

export const GEO_NORMALISERS = {
  ipwho: (j) => {
    if (!j || j.success === false) throw new Error(j?.message || 'lookup failed');
    return {
      ip: j.ip, type: j.type, continent: j.continent, country: j.country, countryCode: j.country_code,
      region: j.region, city: j.city, postal: j.postal, lat: j.latitude, lon: j.longitude,
      asn: j.connection?.asn ? `AS${j.connection.asn}` : null, org: j.connection?.org || null,
      isp: j.connection?.isp || null, domain: j.connection?.domain || null, timezone: j.timezone?.id || null,
      flag: j.flag?.emoji || flagEmoji(j.country_code),
    };
  },
  ipapi: (j) => {
    if (!j || j.error) throw new Error(j?.reason || 'lookup failed');
    return {
      ip: j.ip, type: j.version, continent: j.continent_code, country: j.country_name, countryCode: j.country_code,
      region: j.region, city: j.city, postal: j.postal, lat: j.latitude, lon: j.longitude,
      asn: j.asn || null, org: j.org || null, isp: j.org || null, domain: null, timezone: j.timezone || null,
      flag: flagEmoji(j.country_code),
    };
  },
  ipinfo: (j) => {
    if (!j || j.bogon) throw new Error('lookup failed');
    const [lat, lon] = String(j.loc || '').split(',').map(Number);
    const m = /^(AS\d+)\s+(.*)$/.exec(j.org || '');
    return {
      ip: j.ip, type: String(j.ip).includes(':') ? 'IPv6' : 'IPv4', continent: null, country: j.country,
      countryCode: j.country, region: j.region, city: j.city, postal: j.postal,
      lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null,
      asn: m ? m[1] : null, org: m ? m[2] : j.org || null, isp: m ? m[2] : null, domain: null,
      timezone: j.timezone || null, flag: flagEmoji(j.country),
    };
  },
};

export async function ipGeo(ip = '') {
  const e = encodeURIComponent(ip);
  const fresh = !ip; // "my IP" must not be served from cache
  const { value, source } = await firstSuccessful([
    { name: 'ipwho.is', run: async () => GEO_NORMALISERS.ipwho(await getJSON(`https://ipwho.is/${e}`, { cache: !fresh })) },
    { name: 'ipapi.co', run: async () => GEO_NORMALISERS.ipapi(await getJSON(ip ? `https://ipapi.co/${e}/json/` : 'https://ipapi.co/json/', { cache: !fresh })) },
    { name: 'ipinfo.io', run: async () => GEO_NORMALISERS.ipinfo(await getJSON(ip ? `https://ipinfo.io/${e}/json` : 'https://ipinfo.io/json', { cache: !fresh })) },
  ]);
  return { ...value, source };
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
  const { value } = await firstSuccessful([
    {
      name: 'crt.sh',
      run: async () => {
        const j = await getJSON(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`, { timeout: 30000, retries: 1, ttl: 60 * 60 * 1000 });
        return { source: 'crt.sh', names: subdomainsFromNames((j || []).map((c) => c.name_value), domain), certs: (j || []).length };
      },
    },
    {
      name: 'Cert Spotter',
      run: async () => {
        const j = await getJSON(
          `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`,
          { ttl: 60 * 60 * 1000 },
        );
        return { source: 'Cert Spotter', names: subdomainsFromNames((j || []).flatMap((c) => c.dns_names || []), domain), certs: (j || []).length };
      },
    },
  ]);
  return value;
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
