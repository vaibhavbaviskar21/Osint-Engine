// Social profile collector: queries platforms' official public, CORS-enabled APIs to confirm whether an
// account exists and collect its public profile + recent public activity. No scraping of logged-in pages.
import { fetchJSON } from './http.js';
import { htmlDecode } from './encoding.js';

export const stripHtml = (html) =>
  htmlDecode(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '')).trim();

const unix = (s) => (typeof s === 'number' ? new Date(s * 1000).toISOString() : null);
const e = encodeURIComponent;

/** Result helpers */
const notFound = () => ({ found: false });
const found = (profile, items = [], links = []) => ({ found: true, profile, items, links });

/**
 * Each adapter: { id, name, profileUrl(u), lookup(u, get) => {found, profile, items, links} }
 * `get` is fetchJSON (injectable for tests). Throwing means "could not check" (network/CORS/rate limit).
 */
export const ADAPTERS = [
  {
    id: 'github',
    name: 'GitHub',
    profileUrl: (u) => `https://github.com/${e(u)}`,
    async lookup(u, get) {
      const p = await get(`https://api.github.com/users/${e(u)}`, { ttl: 30 * 60e3 });
      if (!p) return notFound();
      const repos = await get(`https://api.github.com/users/${e(u)}/repos?sort=updated&per_page=6`, { ttl: 30 * 60e3 }).catch(() => []);
      const links = [];
      if (p.blog) links.push({ label: 'Website', value: p.blog });
      if (p.twitter_username) links.push({ label: 'X / Twitter', value: `https://x.com/${p.twitter_username}`, handle: p.twitter_username });
      if (p.email) links.push({ label: 'Public email', value: p.email });
      return found(
        {
          name: p.name, handle: p.login, avatar: p.avatar_url, bio: p.bio, url: p.html_url,
          location: p.location, company: p.company, created: p.created_at,
          stats: { Followers: p.followers, Following: p.following, Repos: p.public_repos, Gists: p.public_gists },
        },
        (repos || []).map((r) => ({ title: r.name, text: r.description, url: r.html_url, date: r.pushed_at || r.updated_at, meta: r.language })),
        links,
      );
    },
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    profileUrl: (u) => `https://gitlab.com/${e(u)}`,
    async lookup(u, get) {
      const list = await get(`https://gitlab.com/api/v4/users?username=${e(u)}`, { ttl: 30 * 60e3 });
      const p = Array.isArray(list) ? list[0] : null;
      if (!p) return notFound();
      return found({ name: p.name, handle: p.username, avatar: p.avatar_url, url: p.web_url, stats: { State: p.state } });
    },
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    profileUrl: (u) => `https://bsky.app/profile/${e(u.includes('.') ? u : `${u}.bsky.social`)}`,
    async lookup(u, get) {
      const actor = u.includes('.') ? u : `${u}.bsky.social`;
      let p;
      try {
        p = await get(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${e(actor)}`, { retries: 1 });
      } catch (err) {
        if (err.status === 400) return notFound(); // Bluesky answers 400 "Profile not found"
        throw err;
      }
      if (!p) return notFound();
      const feed = await get(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${e(actor)}&limit=6`).catch(() => null);
      return found(
        {
          name: p.displayName, handle: p.handle, avatar: p.avatar, bio: p.description, url: `https://bsky.app/profile/${p.handle}`,
          created: p.createdAt, stats: { Followers: p.followersCount, Following: p.followsCount, Posts: p.postsCount }, id: p.did,
        },
        (feed?.feed || []).map((f) => ({
          text: f.post?.record?.text,
          date: f.post?.record?.createdAt,
          url: `https://bsky.app/profile/${p.handle}/post/${String(f.post?.uri || '').split('/').pop()}`,
          meta: f.reason ? 'repost' : null,
        })),
      );
    },
  },
  {
    id: 'mastodon',
    name: 'Mastodon (mastodon.social)',
    profileUrl: (u) => `https://mastodon.social/@${e(u)}`,
    async lookup(u, get) {
      const p = await get(`https://mastodon.social/api/v1/accounts/lookup?acct=${e(u)}`);
      if (!p) return notFound();
      const posts = await get(`https://mastodon.social/api/v1/accounts/${e(p.id)}/statuses?limit=6&exclude_replies=true`).catch(() => []);
      const links = (p.fields || []).map((f) => ({ label: stripHtml(f.name), value: stripHtml(f.value), verified: !!f.verified_at }));
      return found(
        {
          name: p.display_name, handle: p.acct, avatar: p.avatar, bio: stripHtml(p.note), url: p.url, created: p.created_at,
          stats: { Followers: p.followers_count, Following: p.following_count, Posts: p.statuses_count },
        },
        (posts || []).map((s) => ({ text: stripHtml(s.content), date: s.created_at, url: s.url })),
        links,
      );
    },
  },
  {
    id: 'reddit',
    name: 'Reddit',
    profileUrl: (u) => `https://www.reddit.com/user/${e(u)}`,
    async lookup(u, get) {
      const j = await get(`https://www.reddit.com/user/${e(u)}/about.json?raw_json=1`);
      const p = j?.data;
      if (!p) return notFound();
      if (p.is_suspended) return found({ handle: p.name, url: `https://www.reddit.com/user/${p.name}`, bio: 'Account suspended', stats: {} });
      const sub = await get(`https://www.reddit.com/user/${e(u)}/submitted.json?limit=6&raw_json=1`).catch(() => null);
      return found(
        {
          name: p.subreddit?.title || null, handle: p.name, avatar: (p.icon_img || '').split('?')[0], bio: p.subreddit?.public_description,
          url: `https://www.reddit.com/user/${p.name}`, created: unix(p.created_utc),
          stats: { Karma: p.total_karma, 'Post karma': p.link_karma, 'Comment karma': p.comment_karma },
        },
        (sub?.data?.children || []).map((c) => ({
          title: c.data.title, url: `https://www.reddit.com${c.data.permalink}`, date: unix(c.data.created_utc), meta: `r/${c.data.subreddit}`,
        })),
      );
    },
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    profileUrl: (u) => `https://news.ycombinator.com/user?id=${e(u)}`,
    async lookup(u, get) {
      const p = await get(`https://hacker-news.firebaseio.com/v0/user/${e(u)}.json`);
      if (!p) return notFound();
      const ids = (p.submitted || []).slice(0, 6);
      const items = (await Promise.all(ids.map((id) => get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)))).filter(Boolean);
      return found(
        {
          handle: p.id, bio: stripHtml(p.about), url: `https://news.ycombinator.com/user?id=${e(p.id)}`, created: unix(p.created),
          stats: { Karma: p.karma, Submissions: (p.submitted || []).length },
        },
        items.map((i) => ({
          title: i.title || null, text: i.title ? null : stripHtml(i.text).slice(0, 280), date: unix(i.time),
          url: `https://news.ycombinator.com/item?id=${i.id}`, meta: i.type,
        })),
      );
    },
  },
  {
    id: 'devto',
    name: 'DEV Community',
    profileUrl: (u) => `https://dev.to/${e(u)}`,
    async lookup(u, get) {
      const p = await get(`https://dev.to/api/users/by_username?url=${e(u)}`);
      if (!p || p.error) return notFound();
      const arts = await get(`https://dev.to/api/articles?username=${e(u)}&per_page=6`).catch(() => []);
      const links = [];
      if (p.website_url) links.push({ label: 'Website', value: p.website_url });
      if (p.twitter_username) links.push({ label: 'X / Twitter', value: `https://x.com/${p.twitter_username}`, handle: p.twitter_username });
      if (p.github_username) links.push({ label: 'GitHub', value: `https://github.com/${p.github_username}`, handle: p.github_username });
      return found(
        { name: p.name, handle: p.username, avatar: p.profile_image, bio: p.summary, location: p.location, url: `https://dev.to/${p.username}`, created: p.joined_at, stats: {} },
        (arts || []).map((a) => ({ title: a.title, url: a.url, date: a.published_at })),
        links,
      );
    },
  },
  {
    id: 'lichess',
    name: 'Lichess',
    profileUrl: (u) => `https://lichess.org/@/${e(u)}`,
    async lookup(u, get) {
      const p = await get(`https://lichess.org/api/user/${e(u)}`);
      if (!p) return notFound();
      const links = String(p.profile?.links || '').split(/\s+/).filter(Boolean).map((l) => ({ label: 'Link', value: l }));
      return found(
        {
          name: [p.profile?.firstName, p.profile?.lastName].filter(Boolean).join(' ') || p.profile?.realName || null,
          handle: p.username, bio: p.profile?.bio, location: p.profile?.location, url: p.url,
          created: p.createdAt ? new Date(p.createdAt).toISOString() : null,
          stats: { Games: p.count?.all, 'Last seen': p.seenAt ? new Date(p.seenAt).toISOString().slice(0, 10) : null, Status: p.disabled ? 'closed' : p.tosViolation ? 'ToS violation' : 'active' },
        },
        [],
        links,
      );
    },
  },
  {
    id: 'chesscom',
    name: 'Chess.com',
    profileUrl: (u) => `https://www.chess.com/member/${e(u)}`,
    async lookup(u, get) {
      const p = await get(`https://api.chess.com/pub/player/${e(u.toLowerCase())}`);
      if (!p) return notFound();
      return found({
        name: p.name, handle: p.username, avatar: p.avatar, location: p.location, url: p.url, created: unix(p.joined),
        stats: { Followers: p.followers, Country: String(p.country || '').split('/').pop() || null, 'Last online': unix(p.last_online)?.slice(0, 10), Status: p.status },
      });
    },
  },
  {
    id: 'keybase',
    name: 'Keybase',
    profileUrl: (u) => `https://keybase.io/${e(u)}`,
    async lookup(u, get) {
      const j = await get(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${e(u)}&fields=basics,profile,proofs_summary,pictures`);
      const p = j?.them?.[0];
      if (!p) return notFound();
      const links = (p.proofs_summary?.all || []).map((pr) => ({
        label: `Proof: ${pr.proof_type}`, value: pr.service_url || pr.nametag, handle: pr.nametag, verified: true,
      }));
      return found(
        {
          name: p.profile?.full_name, handle: p.basics?.username, avatar: p.pictures?.primary?.url, bio: p.profile?.bio,
          location: p.profile?.location, url: `https://keybase.io/${p.basics?.username}`, created: unix(p.basics?.ctime), stats: { Proofs: links.length },
        },
        [],
        links,
      );
    },
  },
];

/** Platforms that can't be queried from a browser — offered as manual links with an explanation. */
export const MANUAL_ONLY = [
  ['Instagram', (u) => `https://www.instagram.com/${e(u)}/`],
  ['X (Twitter)', (u) => `https://x.com/${e(u)}`],
  ['TikTok', (u) => `https://www.tiktok.com/@${e(u)}`],
  ['Facebook', (u) => `https://www.facebook.com/${e(u)}`],
  ['YouTube', (u) => `https://www.youtube.com/@${e(u)}`],
  ['Threads', (u) => `https://www.threads.net/@${e(u)}`],
  ['Telegram', (u) => `https://t.me/${e(u)}`],
  ['LinkedIn (search)', (u) => `https://www.linkedin.com/search/results/all/?keywords=${e(u)}`],
];

/**
 * Run every adapter in parallel. `onResult` streams each platform's outcome as it lands.
 * @returns {Promise<Array<{id,name,profileUrl,status:'found'|'not_found'|'error', result?, error?}>>}
 */
export async function collectProfiles(username, { get = fetchJSON, onResult, adapters = ADAPTERS } = {}) {
  const u = String(username).trim().replace(/^@/, '');
  return Promise.all(
    adapters.map(async (a) => {
      const base = { id: a.id, name: a.name, profileUrl: a.profileUrl(u) };
      let out;
      try {
        const result = await a.lookup(u, get);
        out = { ...base, status: result.found ? 'found' : 'not_found', result };
      } catch (err) {
        out = { ...base, status: 'error', error: err.message || String(err) };
      }
      onResult?.(out);
      return out;
    }),
  );
}

/** Aggregate cross-platform identifiers (websites, linked handles, emails) from found profiles. */
export function linkedIdentities(outcomes) {
  const map = new Map();
  for (const o of outcomes) {
    if (o.status !== 'found') continue;
    for (const l of o.result.links || []) {
      const key = String(l.value).toLowerCase().replace(/\/$/, '');
      if (!key) continue;
      if (!map.has(key)) map.set(key, { ...l, sources: [] });
      map.get(key).sources.push(o.name);
    }
  }
  return [...map.values()];
}
