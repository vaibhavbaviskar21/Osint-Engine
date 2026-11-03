# OSINT Engine

A fast, private, browser-based **open-source intelligence workbench**. Paste any indicator — domain, IP, email,
username, phone number, URL, file hash or crypto wallet — and OSINT Engine detects what it is, runs live lookups, and
gives you one-click pivots to the best external sources.

No backend. No accounts. No tracking. No build step. It's a static site you can host anywhere (GitHub Pages included).

## Modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Universal search with automatic indicator-type detection, quick pivots, and an **IOC extractor** that pulls IPs, domains, URLs, emails, hashes, wallets and phone numbers out of any pasted text. |
| **Domain Intel** | Live DNS (A/AAAA/MX/NS/TXT/SOA/CAA via DNS-over-HTTPS), RDAP/WHOIS registration data, hosting geolocation, SPF/DMARC email posture, Wayback Machine history, and **subdomain discovery from certificate-transparency logs**. |
| **IP Intel** | Geolocation, ASN/ISP, RDAP network owner and abuse contact, reverse DNS, an embedded map, and reputation pivots (Shodan, Censys, AbuseIPDB, GreyNoise, VirusTotal, …). |
| **Email Intel** | MX/SPF/DMARC checks, disposable/free-provider detection, plus-addressing detection, Gravatar lookup, domain age (new domains get flagged), breach/leak pivots, and an **email-format permutator**. |
| **Social Profile Collector** | Confirms which accounts exist for a username on 10 platforms via their official public APIs (GitHub, GitLab, Bluesky, Mastodon, Reddit, Hacker News, DEV, Lichess, Chess.com, Keybase) and collects public profiles, stats, recent posts and **linked identities** across platforms. |
| **Username Search** | Profile URLs across 94 platforms grouped by category, batch-open, and a **handle generator** built from a real name. |
| **Phone Intel** | Country from the calling code, E.164 normalisation, every common written variant, and search links for each. |
| **Image Forensics** | Local EXIF parsing (camera, serial numbers, timestamps, **GPS → map**), file-type sniffing, MD5/SHA hashes, and reverse-image-search links. Files never leave your browser. |
| **Email Header Analyzer** | Delivery-path reconstruction with per-hop delays, SPF/DKIM/DMARC verdicts, and phishing red flags (Reply-To / Return-Path mismatches, failed authentication, forged timestamps). |
| **Crypto & Decode** | Hash generator (MD5/SHA-1/256/384/512), hash identifier, Base64/Hex/URL/Binary/HTML/ROT13 transforms, IOC defang/refang, a JWT decoder and a timestamp converter. |
| **Dork Builder** | Visual advanced-search query builder plus 20 ready-made recon templates, runnable on Google, Bing, DuckDuckGo, Yandex and Brave. |
| **Tool Directory** | 157 curated OSINT resources in 19 categories, with search and favourites. |
| **Remove My Data** | A guided privacy cleanup: search yourself, opt out of 17 data brokers with a progress checklist, remove search-engine results, delete old accounts, and generate legal deletion-request letters (GDPR, UK GDPR, CCPA/CPRA, India DPDP Act) ready to email. Everything stays in your browser. |
| **System Status** | Live health and latency of every upstream data source, plus session cache statistics. |
| **Case Notebook** | Click "＋ Case" anywhere to collect indicators, annotate them, and export to Markdown, JSON or CSV. |

## Reliability & performance

- **Fallback providers** for every live lookup (DNS, RDAP, geolocation, certificate transparency); the UI shows which source answered.
- **Resilient HTTP layer** (`js/lib/http.js`): timeouts, retries with exponential backoff on network/429/5xx errors, in-flight de-duplication, and a memory + session cache.
- **Lazy-loaded pages**: each tool's code is fetched only when first opened (and prefetched on hover).
- **Installable PWA** with a service worker so the app shell works offline.
- **Command palette** (`Ctrl/⌘ + K` or `/`) to investigate any indicator or jump to any tool.

## Run locally

ES modules need to be served over HTTP (not `file://`):

```bash
npm start            # python3 -m http.server 8080
# then open http://localhost:8080
```

Any static server works (`npx serve`, nginx, etc.).

## Tests

```bash
npm test             # node --test, no dependencies
```

The tests cover indicator detection, MD5 (checked against OpenSSL), hash identification, encoders, the JWT and
timestamp tools, IOC extraction, dork building, phone parsing, username/email permutations, pivot URL validity,
RDAP summarisation, the HTTP cache/retry/fallback layer, social adapters (against a fake API), legal letter generation, EXIF/GPS parsing (using a synthetic JPEG), and email-header analysis.

## Deploy

`.github/workflows/pages.yml` runs the tests and publishes the site to **GitHub Pages** on every push to `main`.
Enable it under *Settings → Pages → Source: GitHub Actions*.

## Data sources

Live lookups call free, keyless, CORS-enabled APIs directly from your browser:

- DNS: Cloudflare DNS-over-HTTPS (Google DoH fallback)
- Registration: [rdap.org](https://rdap.org) (RDAP bootstrap)
- IP geolocation: [ipwho.is](https://ipwho.is)
- Certificate transparency: [crt.sh](https://crt.sh) (Cert Spotter fallback)
- Archives: Internet Archive Wayback availability API
- Avatars: Gravatar

Everything else (image forensics, header analysis, hashing, decoding, extraction, the case notebook) runs fully
locally. Pivot links open third-party sites in a new tab, and those sites will see what you search.

## Project layout

```
index.html          app shell
css/style.css       theme (light/dark, responsive)
js/app.js           hash router
js/ui.js            shared rendering helpers (all output is HTML-escaped)
js/case.js          case notebook storage
js/lib/             pure logic: detection, hashing, EXIF, headers, DNS/RDAP clients, pivots…
js/modules/         one file per page
js/data/tools.js    tool directory
tests/              node:test suites
```

## Responsible use

OSINT Engine is for legitimate research: security assessments you are authorised to perform, threat intelligence,
journalism, fraud and phishing investigation, due diligence, and missing-person work. Respect privacy and the law,
and never use it to harass, stalk or dox anyone. See the in-app **About & Ethics** page.

## License

MIT
