import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { detectTypes, detectType, isPrivateIPv4, toHostname, isIPv6 } from '../js/lib/detect.js';
import { md5 } from '../js/lib/md5.js';
import { allHashes, identifyHash } from '../js/lib/hash.js';
import * as E from '../js/lib/encoding.js';
import { buildDork, fillTemplate, DORK_TEMPLATES } from '../js/lib/dork.js';
import { parsePhone, phoneVariants } from '../js/lib/phone.js';
import { profileUrls, handlePermutations, emailPermutations, SITES } from '../js/lib/username.js';
import { pivots } from '../js/lib/pivots.js';
import { reverseName, subdomainsFromNames, summariseRdap } from '../js/lib/net.js';
import { TOOLS } from '../js/data/tools.js';

test('detectType classifies common indicators', () => {
  const cases = {
    'example.com': 'domain',
    'sub.example.co.uk': 'domain',
    '8.8.8.8': 'ip',
    '2606:4700:4700::1111': 'ip',
    'jane.doe@example.org': 'email',
    'https://example.com/path?x=1': 'url',
    'd41d8cd98f00b204e9800998ecf8427e': 'hash',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855': 'hash',
    '0x52908400098527886E0F7030069857D2E4169EE7': 'eth',
    '1BoatSLRHtKNngkdXEeobR76b53LETtpyT': 'btc',
    'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq': 'btc',
    '+44 20 7946 0958': 'phone',
    '@some_handle': 'username',
    'some words here': 'keyword',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(detectType(input), expected, input);
  assert.deepEqual(detectTypes(''), []);
  assert.ok(detectTypes('john.doe').includes('username'));
  assert.equal(isIPv6('not:an:ip'), false);
});

test('isPrivateIPv4 and toHostname', () => {
  for (const ip of ['10.1.2.3', '192.168.0.1', '172.16.5.4', '127.0.0.1', '100.64.0.1', '169.254.1.1'])
    assert.equal(isPrivateIPv4(ip), true, ip);
  for (const ip of ['8.8.8.8', '172.32.0.1', '1.1.1.1']) assert.equal(isPrivateIPv4(ip), false, ip);
  assert.equal(toHostname('https://Sub.Example.com/a/b'), 'sub.example.com');
  assert.equal(toHostname('*.example.com'), 'example.com');
});

test('md5 matches RFC 1321 vectors', () => {
  assert.equal(md5(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(md5('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0');
  assert.equal(md5('12345678901234567890123456789012345678901234567890123456789012345678901234567890'), '57edf4a22be3c955ac49da2e2107b67a');
  // Cross-check against Node's OpenSSL MD5 on unicode + every padding boundary length.
  for (const s of ['héllo wörld 🔍', ...Array.from({ length: 130 }, (_, i) => 'x'.repeat(i))])
    assert.equal(md5(s), createHash('md5').update(s).digest('hex'), JSON.stringify(s));
});

test('allHashes computes SHA family', async () => {
  const h = await allHashes('abc');
  assert.equal(h.sha1, 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(h.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(h.md5, '900150983cd24fb0d6963f7d28e17f72');
});

test('identifyHash', () => {
  assert.ok(identifyHash('5f4dcc3b5aa765d61d8327deb882cf99').includes('MD5'));
  assert.ok(identifyHash('a9993e364706816aba3e25717850c26c9cd0d89d').includes('SHA-1'));
  assert.deepEqual(identifyHash('$2b$12$KIXQJxZ7r4dS8m2uG6cKxe1t3v9b1Qm7Gq9wE8jY5n6dL0aB2cD3e'), ['bcrypt']);
  assert.deepEqual(identifyHash('$6$salt$abc'), ['SHA-512-crypt (Unix)']);
  assert.deepEqual(identifyHash('zzz'), []);
});

test('encoding round-trips', () => {
  const s = 'Hello, wörld! 🔍';
  assert.equal(E.b64Decode(E.b64Encode(s)), s);
  assert.equal(E.hexDecode(E.hexEncode(s)), s);
  assert.equal(E.binaryDecode(E.binaryEncode(s)), s);
  assert.equal(E.urlDecode(E.urlEncode(s)), s);
  assert.equal(E.rot13(E.rot13(s)), s);
  assert.equal(E.rot13('abcXYZ'), 'nopKLM');
  assert.equal(E.htmlDecode('&lt;a href=&quot;x&quot;&gt;&#65;&#x42;'), '<a href="x">AB');
  assert.equal(E.b64Decode('aGVsbG8'), 'hello'); // missing padding
});

test('jwtDecode and timestampInfo', () => {
  const tok =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const j = E.jwtDecode(tok);
  assert.equal(j.header.alg, 'HS256');
  assert.equal(j.payload.name, 'John Doe');
  assert.equal(j.times.iat, '2018-01-18T01:30:22.000Z');
  assert.equal(E.timestampInfo('1700000000').iso, '2023-11-14T22:13:20.000Z');
  assert.equal(E.timestampInfo('1700000000000').iso, '2023-11-14T22:13:20.000Z');
  assert.throws(() => E.timestampInfo('nonsense'));
});

test('extractIndicators', () => {
  const text = `Beacon to 45.33.32.156 and evil-domain.net, see https://bad.example.org/payload.exe.
    Contact admin@corp.example.com. Hash 44d88612fea8a8f36de82e1278abb02f. Wallet 1BoatSLRHtKNngkdXEeobR76b53LETtpyT.
    Call +1 415 555 0123.`;
  const r = E.extractIndicators(text);
  assert.deepEqual(r.ipv4, ['45.33.32.156']);
  assert.ok(r.domains.includes('evil-domain.net'));
  assert.ok(!r.domains.includes('corp.example.com'), 'email domains excluded from domains');
  assert.deepEqual(r.urls, ['https://bad.example.org/payload.exe']);
  assert.deepEqual(r.emails, ['admin@corp.example.com']);
  assert.deepEqual(r.hashes, ['44d88612fea8a8f36de82e1278abb02f']);
  assert.deepEqual(r.btc, ['1BoatSLRHtKNngkdXEeobR76b53LETtpyT']);
  assert.equal(r.phones.length, 1);
});

test('buildDork', () => {
  assert.equal(buildDork({ site: 'example.com', filetype: 'pdf, xlsx', exclude: 'jobs' }), 'site:example.com (filetype:pdf | filetype:xlsx) -jobs');
  assert.equal(buildDork({ exact: 'John Smith', intitle: 'cv resume' }), '"John Smith" intitle:"cv resume"');
  assert.equal(buildDork({}), '');
  assert.equal(fillTemplate(DORK_TEMPLATES[0].q, 'acme.com'), 'site:*.acme.com -site:www.acme.com');
});

test('parsePhone', () => {
  const uk = parsePhone('+44 20 7946 0958');
  assert.equal(uk.country, 'United Kingdom');
  assert.equal(uk.e164, '+442079460958');
  assert.equal(parsePhone('+1 (415) 555-0123').country, 'United States / Canada (NANP)');
  assert.equal(parsePhone('+971 50 123 4567').country, 'United Arab Emirates');
  assert.equal(parsePhone('0091 98765 43210').country, 'India');
  assert.equal(parsePhone('415-555-0123').international, false);
  assert.equal(parsePhone('123').valid, false);
  const v = phoneVariants(parsePhone('+1 415 555 0123'));
  assert.ok(v.includes('(415) 555-0123'));
  assert.ok(v.includes('+14155550123'));
});

test('username helpers', () => {
  const urls = profileUrls('@alice');
  assert.equal(urls.length, SITES.length);
  assert.equal(urls.find((s) => s.name === 'GitHub').profile, 'https://github.com/alice');
  assert.ok(urls.every((s) => !s.profile.includes('{u}')));
  assert.ok(SITES.length >= 90);
  const h = handlePermutations('John', 'Doe', '1990');
  for (const x of ['johndoe', 'john.doe', 'jdoe', 'doe_john', 'johndoe1990']) assert.ok(h.includes(x), x);
  const m = emailPermutations('John', 'Doe', 'acme.com');
  for (const x of ['john@acme.com', 'john.doe@acme.com', 'jdoe@acme.com', 'jd@acme.com']) assert.ok(m.includes(x), x);
  assert.deepEqual(emailPermutations('a', 'b', ''), []);
});

test('pivots produce valid https URLs for every type', () => {
  const samples = {
    domain: 'example.com', ip: '8.8.8.8', email: 'a@example.com', username: 'alice',
    hash: 'd41d8cd98f00b204e9800998ecf8427e', btc: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
    eth: '0x52908400098527886E0F7030069857D2E4169EE7', url: 'https://example.com/', phone: '+14155550123', keyword: 'acme corp',
  };
  for (const [t, v] of Object.entries(samples)) {
    const list = pivots(t, v);
    assert.ok(list.length > 0, t);
    for (const p of list) assert.equal(new URL(p.url).protocol, 'https:', `${t}: ${p.url}`);
  }
  assert.deepEqual(pivots('nope', 'x'), []);
});

test('net helpers (offline)', () => {
  assert.equal(reverseName('8.8.4.4'), '4.4.8.8.in-addr.arpa');
  assert.equal(reverseName('2001:db8::1'), '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
  assert.deepEqual(subdomainsFromNames(['*.example.com\nwww.example.com', 'api.example.com', 'other.org', 'EXAMPLE.com'], 'example.com'), [
    'api.example.com', 'example.com', 'www.example.com',
  ]);
  const r = summariseRdap({
    ldhName: 'EXAMPLE.COM',
    status: ['client transfer prohibited'],
    events: [{ eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' }, { eventAction: 'expiration', eventDate: '2025-08-13T04:00:00Z' }],
    nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
    entities: [
      { roles: ['registrar'], publicIds: [{ type: 'IANA Registrar ID', identifier: '376' }], vcardArray: ['vcard', [['fn', {}, 'text', 'RESERVED-Internet Assigned Numbers Authority']]],
        entities: [{ roles: ['abuse'], vcardArray: ['vcard', [['email', {}, 'text', 'abuse@iana.org']]] }] },
    ],
  });
  assert.equal(r.registrar, 'RESERVED-Internet Assigned Numbers Authority');
  assert.equal(r.registrarIana, '376');
  assert.equal(r.abuseEmail, 'abuse@iana.org');
  assert.equal(r.created, '1995-08-14T04:00:00Z');
  assert.deepEqual(r.nameservers, ['a.iana-servers.net']);
});

test('tool directory entries are well-formed and unique per category', () => {
  assert.ok(TOOLS.length >= 150, `only ${TOOLS.length} tools`);
  const seen = new Set();
  for (const t of TOOLS) {
    assert.ok(t.name && t.desc && t.cat, JSON.stringify(t));
    assert.match(new URL(t.url).protocol, /^https?:$/);
    const key = `${t.cat}|${t.url}`;
    assert.ok(!seen.has(key), `duplicate ${key}`);
    seen.add(key);
  }
});

test('unquoteTxt joins split TXT strings', async () => {
  const { unquoteTxt } = await import('../js/lib/net.js');
  assert.equal(unquoteTxt('"v=spf1 include:_spf.google.com " "~all"'), 'v=spf1 include:_spf.google.com ~all');
  assert.equal(unquoteTxt('"a \\"quoted\\" word"'), 'a "quoted" word');
  assert.equal(unquoteTxt('unquoted'), 'unquoted');
});
