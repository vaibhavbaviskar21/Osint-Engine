// Service worker: makes the app installable and usable offline.
// Strategy: network-first for our own files (so updates show up immediately), falling back to cache
// when offline. Third-party API requests are never intercepted or cached here.
const VERSION = 'oe-v2';
const SHELL = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg', './icon-192.png',
  './js/app.js', './js/ui.js', './js/icons.js', './js/case.js', './js/recent.js',
  './js/modules/dashboard.js',
  './js/lib/detect.js', './js/lib/encoding.js', './js/lib/pivots.js', './js/lib/username.js', './js/lib/social.js',
  './js/lib/http.js', './js/data/tools.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
