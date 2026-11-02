// Pivot links: one-click handoff from an indicator to external intelligence sources.

const e = encodeURIComponent;

const G = (q) => ({ name: 'Google (exact)', url: `https://www.google.com/search?q=${e(`"${q}"`)}` });

const BUILDERS = {
  domain: (d) => [
    { name: 'VirusTotal', url: `https://www.virustotal.com/gui/domain/${e(d)}` },
    { name: 'urlscan.io', url: `https://urlscan.io/domain/${e(d)}` },
    { name: 'SecurityTrails', url: `https://securitytrails.com/domain/${e(d)}/dns` },
    { name: 'crt.sh', url: `https://crt.sh/?q=${e(d)}` },
    { name: 'Shodan', url: `https://www.shodan.io/search?query=${e(`hostname:${d}`)}` },
    { name: 'Censys', url: `https://search.censys.io/search?resource=hosts&q=${e(d)}` },
    { name: 'AlienVault OTX', url: `https://otx.alienvault.com/indicator/domain/${e(d)}` },
    { name: 'BuiltWith', url: `https://builtwith.com/${e(d)}` },
    { name: 'Netcraft', url: `https://sitereport.netcraft.com/?url=${e(d)}` },
    { name: 'ViewDNS reverse IP', url: `https://viewdns.info/reverseip/?host=${e(d)}&t=1` },
    { name: 'ICANN Lookup', url: `https://lookup.icann.org/en/lookup?name=${e(d)}` },
    { name: 'Wayback Machine', url: `https://web.archive.org/web/*/${d}/*` },
    { name: 'archive.today', url: `https://archive.ph/${d}` },
    { name: 'Google site:', url: `https://www.google.com/search?q=${e(`site:${d}`)}` },
  ],
  ip: (ip) => [
    { name: 'Shodan', url: `https://www.shodan.io/host/${e(ip)}` },
    { name: 'Censys', url: `https://search.censys.io/hosts/${e(ip)}` },
    { name: 'AbuseIPDB', url: `https://www.abuseipdb.com/check/${e(ip)}` },
    { name: 'GreyNoise', url: `https://viz.greynoise.io/ip/${e(ip)}` },
    { name: 'VirusTotal', url: `https://www.virustotal.com/gui/ip-address/${e(ip)}` },
    { name: 'AlienVault OTX', url: `https://otx.alienvault.com/indicator/ip/${e(ip)}` },
    { name: 'Cisco Talos', url: `https://talosintelligence.com/reputation_center/lookup?search=${e(ip)}` },
    { name: 'IPinfo', url: `https://ipinfo.io/${e(ip)}` },
    { name: 'Hurricane Electric BGP', url: `https://bgp.he.net/ip/${e(ip)}` },
    { name: 'ViewDNS reverse IP', url: `https://viewdns.info/reverseip/?host=${e(ip)}&t=1` },
    G(ip),
  ],
  email: (m) => [
    { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/' },
    { name: 'Intelligence X', url: `https://intelx.io/?s=${e(m)}` },
    { name: 'Epieos', url: 'https://epieos.com/' },
    { name: 'Hunter (domain)', url: `https://hunter.io/search/${e(m.split('@')[1] || '')}` },
    G(m),
    { name: 'Bing (exact)', url: `https://www.bing.com/search?q=${e(`"${m}"`)}` },
    { name: 'GitHub commits', url: `https://github.com/search?q=${e(m)}&type=commits` },
  ],
  username: (u) => [
    { name: 'WhatsMyName', url: 'https://whatsmyname.app/' },
    G(u),
    { name: 'GitHub users', url: `https://github.com/search?q=${e(u)}&type=users` },
    { name: 'Reddit', url: `https://www.reddit.com/user/${e(u)}` },
  ],
  hash: (h) => [
    { name: 'VirusTotal', url: `https://www.virustotal.com/gui/file/${e(h)}` },
    { name: 'MalwareBazaar', url: `https://bazaar.abuse.ch/browse.php?search=${e(`${h.length === 64 ? 'sha256' : h.length === 40 ? 'sha1' : 'md5'}:${h}`)}` },
    { name: 'Hybrid Analysis', url: `https://www.hybrid-analysis.com/search?query=${e(h)}` },
    { name: 'AlienVault OTX', url: `https://otx.alienvault.com/indicator/file/${e(h)}` },
    G(h),
  ],
  btc: (a) => [
    { name: 'Blockchain.com', url: `https://www.blockchain.com/explorer/addresses/btc/${e(a)}` },
    { name: 'Blockchair', url: `https://blockchair.com/bitcoin/address/${e(a)}` },
    { name: 'mempool.space', url: `https://mempool.space/address/${e(a)}` },
    { name: 'WalletExplorer', url: `https://www.walletexplorer.com/address/${e(a)}` },
    G(a),
  ],
  eth: (a) => [
    { name: 'Etherscan', url: `https://etherscan.io/address/${e(a)}` },
    { name: 'Blockchair', url: `https://blockchair.com/ethereum/address/${e(a)}` },
    { name: 'Arkham', url: `https://intel.arkm.com/explorer/address/${e(a)}` },
    G(a),
  ],
  url: (u) => [
    { name: 'urlscan.io (search)', url: `https://urlscan.io/search/#${e(`page.url:"${u}"`)}` },
    { name: 'Wayback Machine', url: `https://web.archive.org/web/*/${u}` },
    { name: 'archive.today', url: `https://archive.ph/${u}` },
    { name: 'URLhaus', url: `https://urlhaus.abuse.ch/browse.php?search=${e(u)}` },
    G(u),
  ],
  phone: (p) => [
    G(p),
    { name: 'Bing (exact)', url: `https://www.bing.com/search?q=${e(`"${p}"`)}` },
    { name: 'NumLookup', url: 'https://www.numlookup.com/' },
    { name: 'Truecaller', url: 'https://www.truecaller.com/' },
  ],
  keyword: (k) => [
    G(k),
    { name: 'Bing', url: `https://www.bing.com/search?q=${e(k)}` },
    { name: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${e(k)}` },
    { name: 'Yandex', url: `https://yandex.com/search/?text=${e(k)}` },
  ],
};

export function pivots(type, value) {
  const b = BUILDERS[type];
  return b ? b(String(value).trim()) : [];
}
