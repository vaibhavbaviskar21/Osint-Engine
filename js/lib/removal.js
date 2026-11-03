// "Remove my data" — data-broker opt-outs, search-engine removals, account deletion, and legal request letters.
// Links change over time; each entry carries the date it was last reviewed.

export const REVIEWED = '2026-11';

/** People-search & data brokers. region: US | Global. effort: easy | medium | hard */
export const BROKERS = [
  { id: 'spokeo', name: 'Spokeo', region: 'US', url: 'https://www.spokeo.com/optout', effort: 'easy', how: 'Find your listing, paste its URL and confirm by email.' },
  { id: 'whitepages', name: 'Whitepages', region: 'US', url: 'https://www.whitepages.com/suppression-requests', effort: 'medium', how: 'Paste your listing URL; verification by phone call.' },
  { id: 'beenverified', name: 'BeenVerified', region: 'US', url: 'https://www.beenverified.com/app/optout/search', effort: 'easy', how: 'Search yourself, select the record, confirm by email.' },
  { id: 'peopleconnect', name: 'PeopleConnect (Intelius, TruthFinder, Instant Checkmate, US Search, ZabaSearch)', region: 'US', url: 'https://suppression.peopleconnect.us/login', effort: 'medium', how: 'One suppression request covers all PeopleConnect brands.' },
  { id: 'peoplefinders', name: 'PeopleFinders', region: 'US', url: 'https://www.peoplefinders.com/opt-out', effort: 'easy', how: 'Search, pick your record, confirm by email.' },
  { id: 'radaris', name: 'Radaris', region: 'US', url: 'https://radaris.com/control/privacy', effort: 'hard', how: 'Requires an account to control or remove the profile.' },
  { id: 'fastpeoplesearch', name: 'FastPeopleSearch', region: 'US', url: 'https://www.fastpeoplesearch.com/removal', effort: 'easy', how: 'Find the record and click “Remove my record”.' },
  { id: 'truepeoplesearch', name: 'TruePeopleSearch', region: 'US', url: 'https://www.truepeoplesearch.com/removal', effort: 'easy', how: 'Find the record and request removal.' },
  { id: 'thatsthem', name: 'ThatsThem', region: 'US', url: 'https://thatsthem.com/optout', effort: 'easy', how: 'Submit the opt-out form with your details.' },
  { id: 'usphonebook', name: 'USPhoneBook', region: 'US', url: 'https://www.usphonebook.com/opt-out', effort: 'easy', how: 'Search, select the listing, confirm by email.' },
  { id: 'nuwber', name: 'Nuwber', region: 'US', url: 'https://nuwber.com/removal/link', effort: 'easy', how: 'Paste your profile URL and confirm by email.' },
  { id: 'searchpeoplefree', name: 'SearchPeopleFree', region: 'US', url: 'https://www.searchpeoplefree.com/opt-out', effort: 'easy', how: 'Find the record and confirm removal by email.' },
  { id: 'cyberbackgroundchecks', name: 'CyberBackgroundChecks', region: 'US', url: 'https://www.cyberbackgroundchecks.com/removal', effort: 'easy', how: 'Find the record and request removal.' },
  { id: 'clustrmaps', name: 'ClustrMaps', region: 'US', url: 'https://clustrmaps.com/bl/opt-out', effort: 'easy', how: 'Submit the profile URL for removal.' },
  { id: 'peekyou', name: 'PeekYou', region: 'Global', url: 'https://www.peekyou.com/about/contact/optout/', effort: 'medium', how: 'Submit the opt-out form with your profile URL.' },
  { id: 'pipl', name: 'Pipl', region: 'Global', url: 'https://pipl.com/personal-information-removal-request', effort: 'medium', how: 'Submit a personal-information removal request.' },
  { id: 'acxiom', name: 'Acxiom (marketing data)', region: 'Global', url: 'https://isapps.acxiom.com/optout/optout.aspx', effort: 'easy', how: 'Opt out of Acxiom marketing data sharing.' },
];

export const SEARCH_REMOVAL = [
  { id: 'google-rav', name: 'Google — Results about you', url: 'https://myactivity.google.com/results-about-you', how: 'Monitor and request removal of results showing your phone, address or email.' },
  { id: 'google-pii', name: 'Google — Remove personal info (help & forms)', url: 'https://support.google.com/websearch/answer/9673730', how: 'Doxxing, ID numbers, explicit images, and other personal information.' },
  { id: 'google-outdated', name: 'Google — Outdated content removal', url: 'https://search.google.com/search-console/remove-outdated-content', how: 'For pages already changed or deleted that still show in results.' },
  { id: 'google-rtbf', name: 'Google — Right to be forgotten (EU/UK)', url: 'https://reportcontent.google.com/forms/rtbf', how: 'Delisting request under European data-protection law.' },
  { id: 'bing', name: 'Bing — Content removal', url: 'https://www.bing.com/webmaster/tools/contentremoval', how: 'Remove outdated pages / cached copies from Bing.' },
];

export const ACCOUNTS = [
  { id: 'google', name: 'Google account', url: 'https://myaccount.google.com/delete-services-or-account' },
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/help/224562897555674' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/accounts/remove/request/permanent/' },
  { id: 'x', name: 'X (Twitter)', url: 'https://x.com/settings/deactivate' },
  { id: 'tiktok', name: 'TikTok', url: 'https://support.tiktok.com/en/account-and-privacy/deleting-an-account' },
  { id: 'snapchat', name: 'Snapchat', url: 'https://accounts.snapchat.com/accounts/delete_account' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/psettings/close-account' },
  { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/settings/account' },
  { id: 'microsoft', name: 'Microsoft account', url: 'https://account.live.com/closeaccount.aspx' },
  { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/privacy/data-deletion' },
  { id: 'discord', name: 'Discord', url: 'https://support.discord.com/hc/en-us/articles/212500837' },
  { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/settings/account-settings' },
  { id: 'tumblr', name: 'Tumblr', url: 'https://www.tumblr.com/settings/account/delete' },
  { id: 'spotify', name: 'Spotify', url: 'https://support.spotify.com/article/close-account/' },
];

export const LAWS = {
  gdpr: {
    name: 'GDPR (EU) — Article 17 erasure',
    region: 'European Union / EEA',
    cite: 'Article 17 of the General Data Protection Regulation (EU) 2016/679',
    deadline: 'one month',
    extra: 'Please also confirm, under Article 15, what personal data you held about me, its sources and the recipients it was disclosed to, and notify those recipients of this erasure as required by Article 19.',
  },
  ukgdpr: {
    name: 'UK GDPR — Article 17 erasure',
    region: 'United Kingdom',
    cite: 'Article 17 of the UK General Data Protection Regulation and the Data Protection Act 2018',
    deadline: 'one month',
    extra: 'Please also confirm what personal data you held about me and the third parties it was shared with, and notify them of this erasure.',
  },
  ccpa: {
    name: 'CCPA / CPRA (California) — Right to delete & opt out',
    region: 'California, USA',
    cite: 'the California Consumer Privacy Act, as amended by the California Privacy Rights Act (Cal. Civ. Code §1798.105 and §1798.120)',
    deadline: '45 days',
    extra: 'I also direct you not to sell or share my personal information (Cal. Civ. Code §1798.120) and to instruct your service providers and contractors to delete my personal information.',
  },
  dpdp: {
    name: 'DPDP Act 2023 (India) — Right to erasure',
    region: 'India',
    cite: 'Section 12 of the Digital Personal Data Protection Act, 2023',
    deadline: 'a reasonable period',
    extra: 'I also withdraw any consent previously given for processing my personal data under Section 6(4) of the Act.',
  },
  generic: {
    name: 'General deletion request',
    region: 'Anywhere',
    cite: 'applicable data protection and privacy law',
    deadline: '30 days',
    extra: '',
  },
};

/**
 * Generate a deletion-request letter.
 * @param {{law:string, company:string, fullName:string, email:string, phone?:string, address?:string, urls?:string, otherNames?:string}} f
 * @returns {{subject:string, body:string}}
 */
export function generateLetter(f) {
  const law = LAWS[f.law] || LAWS.generic;
  const company = (f.company || '').trim() || '[Company name]';
  const name = (f.fullName || '').trim() || '[Your full name]';
  const ids = [
    ['Full name', name],
    ['Other names / usernames', f.otherNames],
    ['Email address', f.email],
    ['Phone number', f.phone],
    ['Postal address', f.address],
    ['URLs of listings about me', f.urls],
  ]
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${String(v).trim().replace(/\n+/g, ', ')}`)
    .join('\n');
  const date = new Date().toISOString().slice(0, 10);
  const subject = `Personal data erasure request — ${name}`;
  const body = `Date: ${date}

To the Data Protection Officer / Privacy Team at ${company},

I am writing to request that you erase all personal data you hold about me, pursuant to ${law.cite}.

The following details are provided solely to help you locate my records:
${ids}

Please:
1. Delete all personal data relating to me from your systems, databases, backups where feasible, and any public-facing listings or profiles.
2. Stop any further collection, processing, sale or sharing of my personal data.
3. Confirm in writing once the erasure has been completed.
${law.extra ? `\n${law.extra}\n` : ''}
Please respond within ${law.deadline} of receiving this request, as required by law. If you need to verify my identity, please tell me the minimum information required; do not use any information I provide for verification for any other purpose.

If you do not hold any personal data about me, please confirm this.

Yours faithfully,
${name}${f.email ? `\n${f.email.trim()}` : ''}`;
  return { subject, body };
}

/** Progress helpers for the checklist (stored as {id: isoDate}). */
export function progress(done, list) {
  const n = list.filter((x) => done[x.id]).length;
  return { done: n, total: list.length, pct: list.length ? Math.round((n / list.length) * 100) : 0 };
}
