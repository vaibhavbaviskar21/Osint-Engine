// Indicator type detection — figures out what the analyst pasted.

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_RE = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);
const DOMAIN_RE = /^(?=.{1,253}$)((?!-)[a-z0-9-]{1,63}(?<!-)\.)+(xn--[a-z0-9-]{1,59}|[a-z]{2,63})$/i;
const EMAIL_RE = /^[^\s@]{1,64}@([^\s@]+)$/;
const BTC_RE = /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;
const HEX_RE = /^[a-fA-F0-9]+$/;
const USERNAME_RE = /^@?[A-Za-z0-9_.-]{2,40}$/;

export function isIPv4(s) {
  return IPV4_RE.test(s);
}

export function isIPv6(s) {
  if (!s.includes(':') || !/^[0-9a-f:.]+$/i.test(s)) return false;
  try {
    new URL(`http://[${s}]/`);
    return true;
  } catch {
    return false;
  }
}

export function isIP(s) {
  return isIPv4(s) || isIPv6(s);
}

export function isDomain(s) {
  return DOMAIN_RE.test(s);
}

export function isEmail(s) {
  const m = EMAIL_RE.exec(s);
  return !!m && isDomain(m[1]);
}

export function isUrl(s) {
  if (!/^https?:\/\//i.test(s)) return false;
  try {
    const u = new URL(s);
    return !!u.hostname;
  } catch {
    return false;
  }
}

const HASH_LENGTHS = { 32: 'md5', 40: 'sha1', 64: 'sha256', 128: 'sha512' };

export function hashKind(s) {
  if (!HEX_RE.test(s)) return null;
  return HASH_LENGTHS[s.length] || null;
}

export function isPhone(s) {
  if (!/^\+?[\d\s().-]{7,22}$/.test(s)) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Private / reserved IPv4 ranges (RFC 1918, loopback, link-local, CGNAT, etc). */
export function isPrivateIPv4(ip) {
  if (!isIPv4(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/**
 * Returns an ordered list of candidate indicator types for the input.
 * The first entry is the best guess.
 */
export function detectTypes(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  const out = [];
  if (isUrl(s)) out.push('url');
  if (isEmail(s)) out.push('email');
  if (isIPv4(s) || isIPv6(s)) out.push('ip');
  if (ETH_RE.test(s)) out.push('eth');
  if (hashKind(s)) out.push('hash');
  if (BTC_RE.test(s) && !hashKind(s)) out.push('btc');
  if (isDomain(s)) out.push('domain');
  if (isPhone(s) && !isIPv4(s)) out.push('phone');
  if (USERNAME_RE.test(s) && !out.includes('ip') && !out.includes('hash') && !out.includes('phone'))
    out.push('username');
  if (!out.length) out.push('keyword');
  return out;
}

export function detectType(raw) {
  return detectTypes(raw)[0] || null;
}

/** Extract hostname from a URL or bare domain string. */
export function toHostname(s) {
  s = String(s || '').trim();
  if (isUrl(s)) return new URL(s).hostname;
  return s.replace(/^\*\./, '').replace(/\/.*$/, '').toLowerCase();
}

export const TYPE_LABELS = {
  url: 'URL',
  email: 'Email address',
  ip: 'IP address',
  eth: 'Ethereum address',
  btc: 'Bitcoin address',
  hash: 'File hash',
  domain: 'Domain',
  phone: 'Phone number',
  username: 'Username',
  keyword: 'Keyword',
};
