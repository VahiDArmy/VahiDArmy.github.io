/* DevSpace service worker — offline shell for static assets only.
   Does not cache API calls (OpenRouter / Supabase). */
const CACHE = 'devspace-shell-v1';
const ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './js/config.js',
  './js/supabase-client.js',
  './js/auth/auth.js',
  './js/projects/store.js',
  './js/files/fs-adapter.js',
  './js/models/registry.js',
  './js/agent/loop.js',
  './js/agent/tools.js',
  './js/agent/context.js',
  './js/ui/chat.js',
  './js/utils/dom.js',
  './js/utils/diff.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache cross-origin API traffic
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok && url.pathname.match(/\.(html|css|js|json|svg|png|ico)$/)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
