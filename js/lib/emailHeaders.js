// Email header analysis: hop tracing, authentication results, spoofing red flags.
import { isPrivateIPv4 } from './detect.js';

/** Parse raw headers (RFC 5322) into [{name, value}], unfolding continuation lines. */
export function parseHeaders(raw) {
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  const headers = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (headers.length) break; // blank line ends the header section
      continue;
    }
    if (/^[ \t]/.test(line) && headers.length) {
      headers[headers.length - 1].value += ' ' + line.trim();
      continue;
    }
    const m = /^([!-9;-~]+):\s*(.*)$/.exec(line);
    if (m) headers.push({ name: m[1], value: m[2].trim() });
  }
  return headers;
}

const IPV4_G = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const IPV6_G = /\[?(?:IPv6:)?((?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4})\]?/gi;

export function extractIPs(text) {
  const v4 = String(text).match(IPV4_G) || [];
  const v6 = [...String(text).matchAll(IPV6_G)].map((m) => m[1]);
  return [...new Set([...v4, ...v6])];
}

export function domainOf(addr) {
  const m = /@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(String(addr || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Organisational domain approximation (last two labels, or three for common ccSLDs). */
export function orgDomain(domain) {
  if (!domain) return null;
  const parts = domain.toLowerCase().split('.');
  const cc2 = /^(co|com|net|org|gov|ac|edu)$/;
  if (parts.length > 2 && parts[parts.length - 1].length === 2 && cc2.test(parts[parts.length - 2]))
    return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export function parseReceived(value) {
  const from = /\bfrom\s+([^\s;()]+)(?:\s+\(([^)]*)\))?/i.exec(value);
  const by = /\bby\s+([^\s;()]+)/i.exec(value);
  const proto = /\bwith\s+([A-Za-z0-9-]+)/i.exec(value);
  const semi = value.lastIndexOf(';');
  const dateStr = semi >= 0 ? value.slice(semi + 1).trim() : '';
  const t = Date.parse(dateStr);
  return {
    from: from ? from[1] : null,
    fromDetail: from && from[2] ? from[2] : null,
    by: by ? by[1] : null,
    protocol: proto ? proto[1] : null,
    date: Number.isNaN(t) ? null : new Date(t).toISOString(),
    ips: extractIPs(value),
    raw: value,
  };
}

function parseAuthResults(values) {
  const res = { spf: null, dkim: null, dmarc: null };
  for (const v of values) {
    for (const k of Object.keys(res)) {
      const m = new RegExp(`\\b${k}=([a-z]+)`, 'i').exec(v);
      if (m && !res[k]) res[k] = m[1].toLowerCase();
    }
  }
  return res;
}

export function analyzeHeaders(raw) {
  const headers = parseHeaders(raw);
  const all = (n) => headers.filter((h) => h.name.toLowerCase() === n.toLowerCase()).map((h) => h.value);
  const one = (n) => all(n)[0] ?? null;

  // Received headers are prepended by each hop, so reverse for chronological order.
  const hops = all('Received').map(parseReceived).reverse();
  for (let i = 0; i < hops.length; i++) {
    const prev = hops[i - 1];
    hops[i].delaySec =
      prev && prev.date && hops[i].date ? Math.round((Date.parse(hops[i].date) - Date.parse(prev.date)) / 1000) : null;
  }

  const auth = parseAuthResults([...all('Authentication-Results'), ...all('ARC-Authentication-Results')]);
  const receivedSpf = one('Received-SPF');
  if (!auth.spf && receivedSpf) auth.spf = (/^\s*([a-z]+)/i.exec(receivedSpf) || [])[1]?.toLowerCase() || null;

  const summary = {
    from: one('From'),
    to: one('To'),
    subject: one('Subject'),
    date: one('Date'),
    messageId: one('Message-ID') || one('Message-Id'),
    returnPath: one('Return-Path'),
    replyTo: one('Reply-To'),
    xMailer: one('X-Mailer') || one('User-Agent'),
    xOriginatingIp: one('X-Originating-IP') || one('X-Sender-IP'),
  };

  const fromDom = domainOf(summary.from);
  const flags = [];
  const flag = (level, msg) => flags.push({ level, msg });
  const rpDom = domainOf(summary.returnPath);
  const rtDom = domainOf(summary.replyTo);
  const midDom = domainOf(summary.messageId);
  if (fromDom && rpDom && orgDomain(fromDom) !== orgDomain(rpDom))
    flag('warn', `Return-Path domain (${rpDom}) differs from From domain (${fromDom}).`);
  if (fromDom && rtDom && orgDomain(fromDom) !== orgDomain(rtDom))
    flag('bad', `Reply-To domain (${rtDom}) differs from From domain (${fromDom}) — common in phishing / BEC.`);
  if (fromDom && midDom && orgDomain(fromDom) !== orgDomain(midDom))
    flag('info', `Message-ID domain (${midDom}) differs from From domain — may indicate a third-party sender.`);
  for (const k of ['spf', 'dkim', 'dmarc']) {
    const v = auth[k];
    if (v === 'fail' || v === 'permerror') flag('bad', `${k.toUpperCase()} result: ${v}.`);
    else if (v === 'softfail' || v === 'neutral' || v === 'temperror') flag('warn', `${k.toUpperCase()} result: ${v}.`);
    else if (v === 'none' || v === null) flag('info', `No ${k.toUpperCase()} result recorded.`);
  }
  if (/[^\x00-\x7f]/.test(summary.from || '') || /=\?utf-8\?/i.test(summary.from || ''))
    flag('info', 'From header contains encoded / non-ASCII characters — check for look-alike display names.');
  const negDelay = hops.find((h) => h.delaySec !== null && h.delaySec < -60);
  if (negDelay) flag('warn', 'A hop is timestamped before the previous one — clock skew or forged Received header.');

  const ips = [];
  for (const h of hops) for (const ip of h.ips) if (!ips.includes(ip)) ips.push(ip);
  if (summary.xOriginatingIp) for (const ip of extractIPs(summary.xOriginatingIp)) if (!ips.includes(ip)) ips.push(ip);
  const publicIps = ips.filter((ip) => (ip.includes(':') ? !/^(fe80|::1|fc|fd)/i.test(ip) : !isPrivateIPv4(ip)));

  const totalSec =
    hops.length > 1 && hops[0].date && hops[hops.length - 1].date
      ? Math.round((Date.parse(hops[hops.length - 1].date) - Date.parse(hops[0].date)) / 1000)
      : null;

  return { headers, hops, auth, summary, flags, ips, publicIps, totalSec };
}
