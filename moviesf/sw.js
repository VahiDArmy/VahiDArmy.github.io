/* FULL METAL CINEMA — offline shell
   Caches the static shell only. API calls are never cached; your data is
   always the live row, or the localStorage fallback inside the app. */

const CACHE = 'fmc4-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/views.css',
  './assets/js/app.js',
  './assets/js/config.js',
  './assets/js/lib/client.js',
  './assets/js/lib/dom.js',
  './assets/js/lib/store.js',
  './assets/js/lib/ai.js',
  './assets/js/lib/charts.js',
  './assets/js/views/shared.js',
  './assets/js/views/library.js',
  './assets/js/views/dossier.js',
  './assets/js/views/stats.js',
  './assets/js/views/studio.js',
  './assets/js/views/arena.js',
  './assets/js/views/collections.js',
  './assets/js/views/ledger.js',
  './assets/js/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => null))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // never intercept the provider API or Supabase
  if (url.origin !== location.origin) return;

  // code and markup: network first, cache is the offline fallback.
  // (a cache-first shell would strand the user on an old build forever)
  const fresh = request.mode === 'navigate'
    || /\.(?:js|mjs|css|html|webmanifest)$/.test(url.pathname)
    || url.pathname.endsWith('/');

  if (fresh) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // images, fonts, everything else: cache first, refresh in the background
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
