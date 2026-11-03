import { card, pageHeader } from '../ui.js';

export function render(root) {
  root.innerHTML = `
    ${pageHeader(`About & Ethics`, `OSINT Engine is an open-source intelligence workbench for researchers, journalists, defenders and investigators.`, 'info')}
    <div class="grid two">
      ${card('How it works', `<ul>
        <li><strong>No backend, no accounts, no tracking.</strong> It is a static site; every query runs from your browser.</li>
        <li><strong>Local-only tools:</strong> image forensics, email header analysis, hashing, decoding, indicator extraction and the case notebook never send data anywhere.</li>
        <li><strong>Live lookups</strong> call free public APIs directly, each with a backup: DNS-over-HTTPS (Cloudflare → Google), RDAP (rdap.org → Verisign / ARIN), geolocation (ipwho.is → ipapi.co → ipinfo.io), certificates (crt.sh → Cert Spotter), the Internet Archive and Gravatar. See <a href="#/status">System status</a>.</li>
        <li><strong>Social profile collector</strong> uses platforms’ official public APIs (GitHub, GitLab, Bluesky, Mastodon, Reddit, Hacker News, DEV, Lichess, Chess.com, Keybase). It never logs in or scrapes private pages.</li>
        <li><strong>Remove My Data</strong> stores your details and progress only in this browser. Letters are generated locally and sent from your own email.</li>
        <li><strong>Fast & offline-capable:</strong> pages load on demand, responses are cached per session, failed requests retry automatically, and the app can be installed and used offline.</li>
        <li><strong>Pivot links</strong> open third-party services in a new tab — those services will see what you search.</li>
      </ul>`)}
      ${card('Responsible use', `<ul>
        <li>Only investigate targets you have a legitimate reason and, where needed, authorisation to research.</li>
        <li>Respect privacy and local law (GDPR, CFAA, Computer Misuse Act, etc.). Publicly available ≠ fair game.</li>
        <li>Never use findings to harass, stalk, dox, or discriminate against anyone.</li>
        <li>Verify before you publish: corroborate with multiple independent sources and record provenance.</li>
        <li>Minimise collection — gather only what the investigation actually needs.</li>
      </ul>`)}
      ${card('Investigator OPSEC', `<ul>
        <li>Pivot sites can log your IP and queries. Consider a VPN or dedicated research browser profile.</li>
        <li>Visiting a profile can notify its owner on some platforms (e.g. LinkedIn profile views).</li>
        <li>Clicking links in phishing samples may alert the attacker — use urlscan.io or a sandbox instead.</li>
        <li>Export your case notebook regularly; browser storage can be cleared.</li>
      </ul>`)}
      ${card('Methodology', `<ol>
        <li><strong>Plan</strong> — define the question and scope.</li>
        <li><strong>Collect</strong> — gather from diverse sources; archive pages you rely on.</li>
        <li><strong>Process</strong> — normalise and de-duplicate indicators.</li>
        <li><strong>Analyse</strong> — pivot, correlate, build a timeline, challenge assumptions.</li>
        <li><strong>Report</strong> — state confidence levels and cite every source.</li>
      </ol>`)}
    </div>
    <p class="muted small">Keyboard: <kbd>/</kbd> focus search · <kbd>g</kbd> then <kbd>h</kbd> home. Theme toggle in the sidebar.</p>`;
}
