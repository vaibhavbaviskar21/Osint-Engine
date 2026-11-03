import { md5 } from './md5.js';

const toBytes = (data) =>
  typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : data;

export const bufToHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function digest(algo, data) {
  return bufToHex(await crypto.subtle.digest(algo, toBytes(data)));
}

/** Compute MD5 / SHA-1 / SHA-256 / SHA-384 / SHA-512 of a string or bytes. */
export async function allHashes(data) {
  const bytes = toBytes(data);
  const [sha1, sha256, sha384, sha512] = await Promise.all(
    ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'].map((a) => digest(a, bytes)),
  );
  return { md5: md5(bytes), sha1, sha256, sha384, sha512 };
}

/** Guess the algorithm(s) that produced a given hash string. */
export function identifyHash(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  const prefixed = [
    [/^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/, 'bcrypt'],
    [/^\$1\$/, 'MD5-crypt (Unix)'],
    [/^\$5\$/, 'SHA-256-crypt (Unix)'],
    [/^\$6\$/, 'SHA-512-crypt (Unix)'],
    [/^\$y\$/, 'yescrypt (Unix)'],
    [/^\$argon2(id|i|d)\$/, 'Argon2'],
    [/^\$apr1\$/, 'Apache MD5 (apr1)'],
    [/^\$P\$|^\$H\$/, 'phpass (WordPress / phpBB)'],
    [/^pbkdf2_sha256\$/, 'Django PBKDF2-SHA256'],
    [/^\{SHA\}/i, 'LDAP SHA-1 (base64)'],
    [/^\{SSHA\}/i, 'LDAP salted SHA-1'],
    [/^\*[A-F0-9]{40}$/i, 'MySQL 4.1+'],
  ];
  for (const [re, name] of prefixed) if (re.test(s)) return [name];

  if (/^[a-f0-9]+$/i.test(s)) {
    const byLen = {
      8: ['CRC32', 'Adler-32'],
      16: ['MySQL 3.x', 'Half MD5'],
      32: ['MD5', 'NTLM', 'MD4', 'LM'],
      40: ['SHA-1', 'RIPEMD-160'],
      56: ['SHA-224', 'SHA3-224'],
      64: ['SHA-256', 'SHA3-256', 'BLAKE2s-256'],
      96: ['SHA-384', 'SHA3-384'],
      128: ['SHA-512', 'SHA3-512', 'BLAKE2b-512', 'Whirlpool'],
    };
    return byLen[s.length] || [];
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(s)) {
    const b64 = { 24: ['MD5 (base64)'], 28: ['SHA-1 (base64)'], 44: ['SHA-256 (base64)'], 88: ['SHA-512 (base64)'] };
    return b64[s.length] || [];
  }
  return [];
}
