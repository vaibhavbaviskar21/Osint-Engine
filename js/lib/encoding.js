// Encoders / decoders that analysts reach for constantly. All pure functions.

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToBinStr(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

export function b64Encode(str) {
  return btoa(bytesToBinStr(enc.encode(str)));
}

export function b64Decode(b64) {
  let s = String(b64).trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return dec.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const urlEncode = (s) => encodeURIComponent(s);
export const urlDecode = (s) => decodeURIComponent(String(s).replace(/\+/g, ' '));

export function hexEncode(str) {
  return [...enc.encode(str)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexDecode(hex) {
  const clean = String(hex).replace(/^0x/i, '').replace(/[^a-f0-9]/gi, '');
  if (clean.length % 2) throw new Error('Hex string has odd length');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return dec.decode(bytes);
}

export function binaryEncode(str) {
  return [...enc.encode(str)].map((b) => b.toString(2).padStart(8, '0')).join(' ');
}

export function binaryDecode(bin) {
  const groups = String(bin).trim().split(/\s+/).filter(Boolean);
  return dec.decode(Uint8Array.from(groups, (g) => parseInt(g, 2)));
}

export function rot13(s) {
  return String(s).replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export function reverse(s) {
  return [...String(s)].reverse().join('');
}

const HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlDecode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return HTML_ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlEncode(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Decode a JWT without verifying it. */
export function jwtDecode(token) {
  const parts = String(token).trim().split('.');
  if (parts.length < 2) throw new Error('Not a JWT (expected header.payload.signature)');
  const header = JSON.parse(b64Decode(parts[0]));
  const payload = JSON.parse(b64Decode(parts[1]));
  const times = {};
  for (const k of ['iat', 'nbf', 'exp']) {
    if (typeof payload[k] === 'number') times[k] = new Date(payload[k] * 1000).toISOString();
  }
  return { header, payload, times, signed: !!parts[2] };
}

/** Interpret a number as a Unix timestamp (s, ms, µs) or a date string. */
export function timestampInfo(input) {
  const s = String(input).trim();
  let date;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const abs = Math.abs(n);
    if (abs >= 1e14) date = new Date(n / 1000); // microseconds
    else if (abs >= 1e11) date = new Date(n); // milliseconds
    else date = new Date(n * 1000); // seconds
  } else {
    date = new Date(s);
  }
  if (Number.isNaN(date.getTime())) throw new Error('Unrecognised timestamp');
  return {
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toString(),
    unix: Math.floor(date.getTime() / 1000),
    unixMs: date.getTime(),
  };
}

/** Pull indicators out of a blob of free text. */
export function extractIndicators(text) {
  const t = String(text);
  const uniq = (arr) => [...new Set(arr)];
  const urls = uniq(t.match(/\bhttps?:\/\/[^\s"'<>()\]]+/gi) || []).map((u) => u.replace(/[.,;:!?]+$/, ''));
  const emails = uniq(t.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || []);
  const ipv4 = uniq(
    t.match(/\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g) || [],
  );
  const hashes = uniq(t.match(/\b(?:[a-f0-9]{128}|[a-f0-9]{64}|[a-f0-9]{40}|[a-f0-9]{32})\b/gi) || []);
  const btc = uniq(t.match(/\b(?:bc1[ac-hj-np-z02-9]{25,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g) || []);
  const eth = uniq(t.match(/\b0x[a-fA-F0-9]{40}\b/g) || []);
  const emailDomains = new Set(emails.map((e) => e.split('@')[1].toLowerCase()));
  const domains = uniq(
    (t.match(/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi) || [])
      .map((d) => d.toLowerCase())
      .filter((d) => !/^\d+(\.\d+)+$/.test(d) && !emailDomains.has(d)),
  );
  const phones = uniq(
    (t.match(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g) || [])
      .map((p) => p.trim())
      .filter((p) => p.replace(/\D/g, '').length >= 9 && !ipv4.includes(p)),
  );
  return { urls, emails, domains, ipv4, hashes, btc, eth, phones };
}
