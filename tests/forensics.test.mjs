import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseExif, dmsToDecimal, sniffFileType } from '../js/lib/exif.js';
import { analyzeHeaders, parseHeaders, orgDomain } from '../js/lib/emailHeaders.js';

/** Build a minimal little-endian JPEG with an EXIF block: Make, Model, DateTimeOriginal and GPS. */
function buildJpeg({ lat = [40, 26, 46.302], latRef = 'N', lon = [79, 58, 56.484], lonRef = 'W' } = {}) {
  const tiff = [];
  const u16 = (v) => tiff.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v) => tiff.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const at = (off, bytes) => bytes.forEach((b, i) => (tiff[off + i] = b));
  const le32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0)).concat(0);

  // Header
  tiff.push(0x49, 0x49); u16(42); u32(8);
  // IFD0 @8: 4 entries (Make, Model, ExifPtr, GPSPtr)
  const IFD0 = 8, IFD0_N = 4, IFD0_END = IFD0 + 2 + IFD0_N * 12 + 4; // 62
  const make = ascii('Canon'), model = ascii('Canon EOS 5D Mark IV');
  const makeOff = IFD0_END, modelOff = makeOff + make.length;
  const EXIF = modelOff + model.length;
  const dto = ascii('2023:06:01 14:22:05');
  const EXIF_END = EXIF + 2 + 1 * 12 + 4;
  const dtoOff = EXIF_END;
  const GPS = dtoOff + dto.length + ((dtoOff + dto.length) % 2); // word-align
  const GPS_N = 4;
  const GPS_END = GPS + 2 + GPS_N * 12 + 4;
  const latOff = GPS_END, lonOff = latOff + 24;
  const total = lonOff + 24;
  while (tiff.length < total) tiff.push(0);

  const entry = (off, tag, type, count, value) => at(off, [tag & 0xff, tag >> 8, type, 0, ...le32(count), ...value]);
  at(IFD0, [IFD0_N, 0]);
  entry(IFD0 + 2, 0x010f, 2, make.length, le32(makeOff));
  entry(IFD0 + 14, 0x0110, 2, model.length, le32(modelOff));
  entry(IFD0 + 26, 0x8769, 4, 1, le32(EXIF));
  entry(IFD0 + 38, 0x8825, 4, 1, le32(GPS));
  at(makeOff, make); at(modelOff, model);
  at(EXIF, [1, 0]);
  entry(EXIF + 2, 0x9003, 2, dto.length, le32(dtoOff));
  at(dtoOff, dto);
  at(GPS, [GPS_N, 0]);
  entry(GPS + 2, 0x0001, 2, 2, [latRef.charCodeAt(0), 0, 0, 0]);
  entry(GPS + 14, 0x0002, 5, 3, le32(latOff));
  entry(GPS + 26, 0x0003, 2, 2, [lonRef.charCodeAt(0), 0, 0, 0]);
  entry(GPS + 38, 0x0004, 5, 3, le32(lonOff));
  const rat = (off, vals) => vals.forEach((v, i) => at(off + i * 8, [...le32(Math.round(v * 1000)), ...le32(1000)]));
  rat(latOff, lat); rat(lonOff, lon);

  const app1Body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]; // "Exif\0\0"
  const len = app1Body.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1Body, 0xff, 0xda, 0, 2, 0xff, 0xd9];
  return new Uint8Array(bytes).buffer;
}

test('parseExif extracts camera, timestamp and GPS', () => {
  const r = parseExif(buildJpeg());
  assert.equal(r.byteOrder, 'Intel (II)');
  assert.equal(r.ifd0.Make, 'Canon');
  assert.equal(r.ifd0.Model, 'Canon EOS 5D Mark IV');
  assert.equal(r.exif.DateTimeOriginal, '2023:06:01 14:22:05');
  assert.equal(r.gps.GPSLatitudeRef, 'N');
  assert.ok(Math.abs(r.location.lat - 40.446195) < 1e-5, r.location.lat);
  assert.ok(Math.abs(r.location.lon - -79.982357) < 1e-5, r.location.lon);
});

test('parseExif handles southern/eastern hemispheres and missing EXIF', () => {
  const r = parseExif(buildJpeg({ lat: [33, 51, 54], latRef: 'S', lon: [151, 12, 36], lonRef: 'E' }));
  assert.ok(r.location.lat < 0 && r.location.lon > 0);
  const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9]).buffer;
  assert.equal(parseExif(bare), null);
  assert.throws(() => parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), /Not a JPEG/);
});

test('dmsToDecimal and sniffFileType', () => {
  assert.equal(dmsToDecimal([51, 30, 0], 'N'), 51.5);
  assert.equal(dmsToDecimal([0, 7, 39.6], 'W'), -0.1276667);
  assert.equal(dmsToDecimal(null, 'N'), null);
  assert.equal(sniffFileType(buildJpeg()), 'JPEG image');
  assert.equal(sniffFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).buffer), 'PNG image');
  assert.equal(sniffFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer), 'PDF document');
});

const PHISH = `Received: from mx.relay.net (mx.relay.net [198.51.100.9])
        by mx.example.org with ESMTPS id ABC
        for <victim@example.org>; Tue, 14 May 2024 09:12:07 +0000
Received: from [10.0.0.5] ([203.0.113.77])
        by mx.relay.net with ESMTPSA id XYZ;
        Tue, 14 May 2024 09:12:01 +0000
Authentication-Results: mx.example.org;
       dkim=none;
       spf=softfail smtp.mailfrom=bounce@relay.net;
       dmarc=fail header.from=paypal.com
Return-Path: <bounce@relay.net>
From: "PayPal" <service@paypal.com>
Reply-To: help@paypal-refunds.xyz
Subject: Action required
Message-ID: <123@relay.net>

Body text 1.2.3.4 should be ignored`;

test('analyzeHeaders traces hops and flags spoofing', () => {
  const r = analyzeHeaders(PHISH);
  assert.equal(r.hops.length, 2);
  assert.equal(r.hops[0].by, 'mx.relay.net', 'chronological order: oldest hop first');
  assert.equal(r.hops[1].by, 'mx.example.org');
  assert.equal(r.hops[1].delaySec, 6);
  assert.equal(r.totalSec, 6);
  assert.deepEqual(r.auth, { spf: 'softfail', dkim: 'none', dmarc: 'fail' });
  assert.equal(r.summary.subject, 'Action required');
  assert.ok(r.ips.includes('203.0.113.77'));
  assert.ok(r.ips.includes('10.0.0.5'));
  assert.ok(!r.publicIps.includes('10.0.0.5'));
  assert.ok(!r.ips.includes('1.2.3.4'), 'body ignored');
  const msgs = r.flags.map((f) => f.msg).join('\n');
  assert.match(msgs, /Reply-To domain \(paypal-refunds\.xyz\)/);
  assert.match(msgs, /Return-Path domain \(relay\.net\)/);
  assert.match(msgs, /DMARC result: fail/);
  assert.match(msgs, /SPF result: softfail/);
});

test('parseHeaders unfolds continuation lines; orgDomain', () => {
  const h = parseHeaders('Subject: hello\n  world\nX-A: 1\r\n\r\nX-B: body');
  assert.deepEqual(h, [{ name: 'Subject', value: 'hello world' }, { name: 'X-A', value: '1' }]);
  assert.equal(orgDomain('mail.google.com'), 'google.com');
  assert.equal(orgDomain('a.b.example.co.uk'), 'example.co.uk');
  assert.deepEqual(analyzeHeaders('').hops, []);
});
