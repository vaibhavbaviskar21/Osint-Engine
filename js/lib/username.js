// Username enumeration: profile URL templates across platforms, and handle permutations.

/** `{u}` is replaced with the username. */
export const SITES = [
  // Social
  ['X (Twitter)', 'https://x.com/{u}', 'Social'],
  ['Instagram', 'https://www.instagram.com/{u}/', 'Social'],
  ['Facebook', 'https://www.facebook.com/{u}', 'Social'],
  ['TikTok', 'https://www.tiktok.com/@{u}', 'Social'],
  ['Threads', 'https://www.threads.net/@{u}', 'Social'],
  ['Bluesky', 'https://bsky.app/profile/{u}.bsky.social', 'Social'],
  ['Mastodon (mastodon.social)', 'https://mastodon.social/@{u}', 'Social'],
  ['Reddit', 'https://www.reddit.com/user/{u}', 'Social'],
  ['Pinterest', 'https://www.pinterest.com/{u}/', 'Social'],
  ['Tumblr', 'https://{u}.tumblr.com', 'Social'],
  ['Snapchat', 'https://www.snapchat.com/add/{u}', 'Social'],
  ['Telegram', 'https://t.me/{u}', 'Social'],
  ['VK', 'https://vk.com/{u}', 'Social'],
  ['OK.ru', 'https://ok.ru/{u}', 'Social'],
  ['Quora', 'https://www.quora.com/profile/{u}', 'Social'],
  ['Flipboard', 'https://flipboard.com/@{u}', 'Social'],
  ['Linktree', 'https://linktr.ee/{u}', 'Social'],
  ['About.me', 'https://about.me/{u}', 'Social'],
  ['Gravatar', 'https://gravatar.com/{u}', 'Social'],
  ['Disqus', 'https://disqus.com/by/{u}/', 'Social'],
  // Video & streaming
  ['YouTube', 'https://www.youtube.com/@{u}', 'Video & Streaming'],
  ['Twitch', 'https://www.twitch.tv/{u}', 'Video & Streaming'],
  ['Kick', 'https://kick.com/{u}', 'Video & Streaming'],
  ['Vimeo', 'https://vimeo.com/{u}', 'Video & Streaming'],
  ['Dailymotion', 'https://www.dailymotion.com/{u}', 'Video & Streaming'],
  ['Rumble', 'https://rumble.com/user/{u}', 'Video & Streaming'],
  ['Odysee', 'https://odysee.com/@{u}', 'Video & Streaming'],
  // Music
  ['SoundCloud', 'https://soundcloud.com/{u}', 'Music'],
  ['Mixcloud', 'https://www.mixcloud.com/{u}/', 'Music'],
  ['Bandcamp', 'https://{u}.bandcamp.com', 'Music'],
  ['Last.fm', 'https://www.last.fm/user/{u}', 'Music'],
  ['Genius', 'https://genius.com/{u}', 'Music'],
  ['Discogs', 'https://www.discogs.com/user/{u}', 'Music'],
  // Developer
  ['GitHub', 'https://github.com/{u}', 'Developer'],
  ['GitLab', 'https://gitlab.com/{u}', 'Developer'],
  ['Bitbucket', 'https://bitbucket.org/{u}/', 'Developer'],
  ['Codeberg', 'https://codeberg.org/{u}', 'Developer'],
  ['npm', 'https://www.npmjs.com/~{u}', 'Developer'],
  ['PyPI', 'https://pypi.org/user/{u}/', 'Developer'],
  ['Docker Hub', 'https://hub.docker.com/u/{u}', 'Developer'],
  ['Hugging Face', 'https://huggingface.co/{u}', 'Developer'],
  ['Kaggle', 'https://www.kaggle.com/{u}', 'Developer'],
  ['Replit', 'https://replit.com/@{u}', 'Developer'],
  ['CodePen', 'https://codepen.io/{u}', 'Developer'],
  ['Dev.to', 'https://dev.to/{u}', 'Developer'],
  ['Hacker News', 'https://news.ycombinator.com/user?id={u}', 'Developer'],
  ['Keybase', 'https://keybase.io/{u}', 'Developer'],
  ['LeetCode', 'https://leetcode.com/u/{u}/', 'Developer'],
  ['HackerRank', 'https://www.hackerrank.com/profile/{u}', 'Developer'],
  ['Codeforces', 'https://codeforces.com/profile/{u}', 'Developer'],
  ['Product Hunt', 'https://www.producthunt.com/@{u}', 'Developer'],
  // Security
  ['HackerOne', 'https://hackerone.com/{u}', 'Security'],
  ['Bugcrowd', 'https://bugcrowd.com/{u}', 'Security'],
  ['TryHackMe', 'https://tryhackme.com/p/{u}', 'Security'],
  // Creative
  ['DeviantArt', 'https://www.deviantart.com/{u}', 'Creative'],
  ['Behance', 'https://www.behance.net/{u}', 'Creative'],
  ['Dribbble', 'https://dribbble.com/{u}', 'Creative'],
  ['ArtStation', 'https://www.artstation.com/{u}', 'Creative'],
  ['Flickr', 'https://www.flickr.com/people/{u}', 'Creative'],
  ['500px', 'https://500px.com/p/{u}', 'Creative'],
  ['Imgur', 'https://imgur.com/user/{u}', 'Creative'],
  ['Giphy', 'https://giphy.com/{u}', 'Creative'],
  ['Wattpad', 'https://www.wattpad.com/user/{u}', 'Creative'],
  // Blogging & writing
  ['Medium', 'https://medium.com/@{u}', 'Blogging'],
  ['Substack', 'https://{u}.substack.com', 'Blogging'],
  ['WordPress.com', 'https://{u}.wordpress.com', 'Blogging'],
  ['Blogger', 'https://{u}.blogspot.com', 'Blogging'],
  ['LiveJournal', 'https://{u}.livejournal.com', 'Blogging'],
  ['Wikipedia', 'https://en.wikipedia.org/wiki/User:{u}', 'Blogging'],
  ['Internet Archive', 'https://archive.org/details/@{u}', 'Blogging'],
  ['Slideshare', 'https://www.slideshare.net/{u}', 'Blogging'],
  ['Pastebin', 'https://pastebin.com/u/{u}', 'Blogging'],
  // Gaming
  ['Steam', 'https://steamcommunity.com/id/{u}', 'Gaming'],
  ['Chess.com', 'https://www.chess.com/member/{u}', 'Gaming'],
  ['Lichess', 'https://lichess.org/@/{u}', 'Gaming'],
  ['NameMC (Minecraft)', 'https://namemc.com/profile/{u}', 'Gaming'],
  ['Speedrun.com', 'https://www.speedrun.com/users/{u}', 'Gaming'],
  ['Roblox (search)', 'https://www.roblox.com/search/users?keyword={u}', 'Gaming'],
  // Lifestyle
  ['Letterboxd', 'https://letterboxd.com/{u}/', 'Lifestyle'],
  ['MyAnimeList', 'https://myanimelist.net/profile/{u}', 'Lifestyle'],
  ['Duolingo', 'https://www.duolingo.com/profile/{u}', 'Lifestyle'],
  ['Untappd', 'https://untappd.com/user/{u}', 'Lifestyle'],
  // Commerce & payments
  ['Patreon', 'https://www.patreon.com/{u}', 'Commerce & Payments'],
  ['Ko-fi', 'https://ko-fi.com/{u}', 'Commerce & Payments'],
  ['Buy Me a Coffee', 'https://www.buymeacoffee.com/{u}', 'Commerce & Payments'],
  ['Gumroad', 'https://{u}.gumroad.com', 'Commerce & Payments'],
  ['Etsy', 'https://www.etsy.com/shop/{u}', 'Commerce & Payments'],
  ['eBay', 'https://www.ebay.com/usr/{u}', 'Commerce & Payments'],
  ['Fiverr', 'https://www.fiverr.com/{u}', 'Commerce & Payments'],
  ['Cash App', 'https://cash.app/${u}', 'Commerce & Payments'],
  ['Venmo', 'https://account.venmo.com/u/{u}', 'Commerce & Payments'],
  ['PayPal.me', 'https://www.paypal.com/paypalme/{u}', 'Commerce & Payments'],
  ['OpenSea', 'https://opensea.io/{u}', 'Commerce & Payments'],
  ['Trello', 'https://trello.com/{u}', 'Commerce & Payments'],
].map(([name, url, cat]) => ({ name, url, cat }));

export function cleanUsername(u) {
  return String(u || '').trim().replace(/^@/, '');
}

export function profileUrls(username) {
  const u = cleanUsername(username);
  const enc = encodeURIComponent(u);
  return SITES.map((s) => ({ ...s, profile: s.url.replaceAll('{u}', enc) }));
}

/** Generate likely handles from a real name (and optional extras like a birth year). */
export function handlePermutations(first, last, extra = '') {
  const f = String(first || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const l = String(last || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = String(extra || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!f && !l) return [];
  const base = new Set();
  const seps = ['', '.', '_', '-'];
  if (f && l) {
    for (const s of seps) {
      base.add(`${f}${s}${l}`);
      base.add(`${l}${s}${f}`);
      base.add(`${f[0]}${s}${l}`);
      base.add(`${f}${s}${l[0]}`);
      base.add(`${l}${s}${f[0]}`);
    }
    base.add(`${f}${l}`.slice(0, 15));
    base.add(`the${f}${l}`);
    base.add(`real${f}${l}`);
    base.add(`${f}${l}official`);
  } else {
    const n = f || l;
    base.add(n);
    base.add(`the${n}`);
    base.add(`real${n}`);
    base.add(`${n}official`);
  }
  const out = new Set(base);
  if (x) for (const b of base) { out.add(`${b}${x}`); out.add(`${b}_${x}`); }
  return [...out];
}

/** Common corporate email address formats. */
export function emailPermutations(first, last, domain) {
  const f = String(first || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const l = String(last || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const d = String(domain || '').trim().toLowerCase().replace(/^@/, '');
  if (!d || (!f && !l)) return [];
  const locals = new Set();
  if (f) locals.add(f);
  if (l) locals.add(l);
  if (f && l) {
    for (const s of ['', '.', '_', '-']) {
      locals.add(`${f}${s}${l}`);
      locals.add(`${l}${s}${f}`);
      locals.add(`${f[0]}${s}${l}`);
      locals.add(`${f}${s}${l[0]}`);
      locals.add(`${l}${s}${f[0]}`);
    }
    locals.add(`${f[0]}${l[0]}`);
  }
  return [...locals].map((x) => `${x}@${d}`);
}
