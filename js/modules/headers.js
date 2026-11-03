import { analyzeHeaders } from '../lib/emailHeaders.js';
import { esc, card, kv, empty, caseBtn, copyBtn, pageHeader } from '../ui.js';

const SAMPLE = `Received: from mail-ej1-f41.google.com (mail-ej1-f41.google.com [209.85.218.41])
        by mx.example.org (Postfix) with ESMTPS id 4A1B2C3D4E
        for <victim@example.org>; Tue, 14 May 2024 09:12:07 +0000 (UTC)
Received: by mail-ej1-f41.google.com with SMTP id a640c23a62f3a-a59a5f81af4so
        for <victim@example.org>; Tue, 14 May 2024 02:12:05 -0700 (PDT)
Received: from [192.168.1.23] ([203.0.113.77])
        by smtp.gmail.com with ESMTPSA id x12-20020a170906b08c00b00a59b2cd4d5bsm
        for <victim@example.org>; Tue, 14 May 2024 02:12:03 -0700 (PDT)
Authentication-Results: mx.example.org;
       dkim=pass header.d=gmail.com;
       spf=pass smtp.mailfrom=billing.paypa1@gmail.com;
       dmarc=pass header.from=gmail.com
Return-Path: <billing.paypa1@gmail.com>
From: "PayPal Billing" <billing.paypa1@gmail.com>
Reply-To: refunds@secure-paypal-support.net
To: victim@example.org
Subject: Your account has been limited
Date: Tue, 14 May 2024 02:11:58 -0700
Message-ID: <CAF3x9q=abc123@mail.gmail.com>
X-Mailer: Microsoft Outlook 16.0`;

function fmtDelay(s) {
  if (s === null || s === undefined) return '';
  if (Math.abs(s) < 60) return `${s}s`;
  if (Math.abs(s) < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function renderResult(r) {
  if (!r.headers.length) return empty('No headers detected. Paste the raw message source (in Gmail: ⋮ → Show original).');
  const authBadge = (k) => {
    const v = r.auth[k];
    const cls = v === 'pass' ? 'good' : v === 'fail' || v === 'permerror' ? 'bad' : v ? 'warn' : 'info';
    return `<span class="pill ${cls}">${k.toUpperCase()}: ${esc(v || 'n/a')}</span>`;
  };
  return `
    <div class="grid two">
      ${card('Summary', kv([
        ['From', r.summary.from], ['Reply-To', r.summary.replyTo], ['Return-Path', r.summary.returnPath],
        ['To', r.summary.to], ['Subject', r.summary.subject], ['Date', r.summary.date],
        ['Message-ID', r.summary.messageId], ['Mailer', r.summary.xMailer], ['Originating IP', r.summary.xOriginatingIp],
      ]))}
      ${card('Verdict', `<div class="pills">${authBadge('spf')}${authBadge('dkim')}${authBadge('dmarc')}</div>
        <ul class="flags">${r.flags.length ? r.flags.map((f) => `<li class="${f.level}">${esc(f.msg)}</li>`).join('') : '<li class="good">No red flags detected.</li>'}</ul>`)}
    </div>
    ${card(`Delivery path — ${r.hops.length} hop(s)${r.totalSec !== null ? `, ${fmtDelay(r.totalSec)} total` : ''}`,
      r.hops.length
        ? `<ol class="hops">${r.hops
            .map(
              (h, i) => `<li><div class="hop-h"><span class="badge">${i + 1}</span>
                <span class="mono">${esc(h.from || '?')}</span> → <span class="mono">${esc(h.by || '?')}</span>
                ${h.protocol ? `<span class="pill">${esc(h.protocol)}</span>` : ''}
                ${h.delaySec !== null ? `<span class="pill ${h.delaySec > 300 || h.delaySec < -60 ? 'warn' : ''}">+${fmtDelay(h.delaySec)}</span>` : ''}</div>
                <div class="muted small">${esc(h.date || 'no timestamp')} ${h.fromDetail ? `· ${esc(h.fromDetail)}` : ''}</div>
                ${h.ips.length ? `<div>${h.ips.map((ip) => `<a class="chip" href="#/ip?q=${encodeURIComponent(ip)}">${esc(ip)}</a>`).join(' ')}</div>` : ''}</li>`,
            )
            .join('')}</ol>`
        : empty('No Received headers.'))}
    ${card('IP addresses', r.ips.length
      ? `<ul class="ioc-list">${r.ips.map((ip) => `<li><span class="mono">${esc(ip)}</span> ${copyBtn(ip)} ${r.publicIps.includes(ip) ? `<a href="#/ip?q=${encodeURIComponent(ip)}">investigate</a> ${caseBtn('ip', ip, 'From email headers')}` : '<span class="muted">(private)</span>'}</li>`).join('')}</ul>`
      : empty('None found.'))}
    ${card(`All headers (${r.headers.length})`, `<details><summary>Show raw parsed headers</summary>${kv(r.headers.map((h) => [h.name, h.value]))}</details>`)}
  `;
}

export function render(root) {
  root.innerHTML = `
    ${pageHeader(`Email Header Analyzer`, `Trace the delivery path, check SPF / DKIM / DMARC and surface phishing red flags. Parsed locally in your browser.`, 'inbox')}
    <textarea id="raw" class="input" rows="10" placeholder="Paste full raw email headers here…"></textarea>
    <div class="actions"><button class="btn" id="go">Analyse</button><button class="btn ghost" id="sample">Load phishing sample</button></div>
    <div id="results" class="results"></div>`;
  const go = () => (root.querySelector('#results').innerHTML = renderResult(analyzeHeaders(root.querySelector('#raw').value)));
  root.querySelector('#go').addEventListener('click', go);
  root.querySelector('#sample').addEventListener('click', () => {
    root.querySelector('#raw').value = SAMPLE;
    go();
  });
}
