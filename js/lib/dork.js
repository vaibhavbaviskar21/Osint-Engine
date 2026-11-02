// Search-engine dork builder.

const quote = (s) => (/\s/.test(s) && !/^".*"$/.test(s) ? `"${s}"` : s);
const split = (s) =>
  String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Build a search query from structured fields. Multi-value fields accept comma-separated lists
 * and are OR-ed together.
 */
export function buildDork(f = {}) {
  const parts = [];
  if (f.keywords) parts.push(f.keywords.trim());
  if (f.exact) parts.push(`"${f.exact.trim().replace(/"/g, '')}"`);
  const orGroup = (op, value) => {
    const vals = split(value).map((v) => `${op}:${quote(v)}`);
    if (vals.length === 1) parts.push(vals[0]);
    else if (vals.length > 1) parts.push(`(${vals.join(' | ')})`);
  };
  orGroup('site', f.site);
  orGroup('filetype', f.filetype);
  orGroup('intitle', f.intitle);
  orGroup('inurl', f.inurl);
  orGroup('intext', f.intext);
  for (const x of split(f.exclude)) parts.push(`-${quote(x)}`);
  for (const x of split(f.excludeSite)) parts.push(`-site:${x}`);
  if (f.after) parts.push(`after:${f.after}`);
  if (f.before) parts.push(`before:${f.before}`);
  return parts.join(' ').trim();
}

export const ENGINES = [
  { name: 'Google', url: 'https://www.google.com/search?q=' },
  { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { name: 'Yandex', url: 'https://yandex.com/search/?text=' },
  { name: 'Brave', url: 'https://search.brave.com/search?q=' },
];

export const engineUrl = (engine, q) => engine.url + encodeURIComponent(q);

/** Ready-made recon templates. `{t}` is replaced with the target. */
export const DORK_TEMPLATES = [
  { cat: 'Domain recon', name: 'Subdomains (excluding www)', q: 'site:*.{t} -site:www.{t}' },
  { cat: 'Domain recon', name: 'Directory listings', q: 'site:{t} intitle:"index of"' },
  { cat: 'Domain recon', name: 'Public documents', q: 'site:{t} (ext:pdf | ext:doc | ext:docx | ext:xls | ext:xlsx | ext:ppt | ext:pptx | ext:csv)' },
  { cat: 'Domain recon', name: 'Login & admin pages', q: 'site:{t} (inurl:login | inurl:signin | inurl:admin | intitle:login)' },
  { cat: 'Domain recon', name: 'Exposed config files', q: 'site:{t} (ext:env | ext:ini | ext:conf | ext:cfg | ext:yml | ext:log)' },
  { cat: 'Domain recon', name: 'Backup / DB files', q: 'site:{t} (ext:bak | ext:old | ext:backup | ext:sql | ext:db)' },
  { cat: 'Domain recon', name: 'Error messages', q: 'site:{t} ("sql syntax" | "warning: mysql" | "stack trace" | "fatal error")' },
  { cat: 'Domain recon', name: 'API docs & endpoints', q: 'site:{t} (inurl:api | inurl:swagger | inurl:graphql | intitle:"api documentation")' },
  { cat: 'Third-party exposure', name: 'Code repositories', q: '(site:github.com | site:gitlab.com | site:bitbucket.org) "{t}"' },
  { cat: 'Third-party exposure', name: 'Paste sites', q: '(site:pastebin.com | site:ghostbin.site | site:paste.ee | site:justpaste.it) "{t}"' },
  { cat: 'Third-party exposure', name: 'Project boards & docs', q: '(site:trello.com | site:notion.site | site:docs.google.com | site:atlassian.net) "{t}"' },
  { cat: 'Third-party exposure', name: 'Cloud storage buckets', q: '(site:s3.amazonaws.com | site:blob.core.windows.net | site:storage.googleapis.com) "{t}"' },
  { cat: 'People & orgs', name: 'Employees on LinkedIn', q: 'site:linkedin.com/in "{t}"' },
  { cat: 'People & orgs', name: 'Email addresses', q: '"@{t}" -site:{t}' },
  { cat: 'People & orgs', name: 'Resumes / CVs', q: '"{t}" (intitle:resume | intitle:cv | inurl:resume) (ext:pdf | ext:doc | ext:docx)' },
  { cat: 'People & orgs', name: 'Social mentions', q: '"{t}" (site:x.com | site:twitter.com | site:reddit.com | site:facebook.com | site:instagram.com)' },
  { cat: 'People & orgs', name: 'News coverage', q: '"{t}" (site:reuters.com | site:apnews.com | site:bbc.co.uk | site:nytimes.com)' },
  { cat: 'Username / handle', name: 'Handle across the web', q: '"{t}" -site:x.com -site:twitter.com' },
  { cat: 'Username / handle', name: 'Handle in profiles', q: '(inurl:"{t}" | intitle:"{t}") (profile | user | member)' },
  { cat: 'Username / handle', name: 'Handle in forums', q: '"{t}" (inurl:forum | inurl:thread | inurl:topic | inurl:viewtopic)' },
];

export function fillTemplate(q, target) {
  return q.replaceAll('{t}', String(target || '').trim());
}
