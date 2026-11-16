/* ============================================================
   Service Worker — cache shell, network-first for data
   ============================================================ */
const VERSION = 'smyar-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/tokens.css',
  '/assets/css/base.css',
  '/assets/css/layout.css',
  '/assets/css/components.css',
  '/assets/css/table.css',
  '/assets/css/modals.css',
  '/assets/css/pages.css',
  '/assets/js/main.js',
  '/assets/js/app.js',
  '/assets/js/config.js',
  '/assets/js/supabase.js',
  '/assets/js/state.js',
  '/assets/js/utils.js',
  '/assets/js/api.js',
  '/assets/js/selectors.js',
  '/assets/js/components/icons.js',
  '/assets/js/components/toast.js',
  '/assets/js/components/login.js',
  '/assets/js/components/header.js',
  '/assets/js/components/modal-shell.js',
  '/assets/js/components/confirm.js',
  '/assets/js/components/picker.js',
  '/assets/js/components/purchase-modal.js',
  '/assets/js/components/filters.js',
  '/assets/js/components/purchases-table.js',
  '/assets/js/components/details-drawer.js',
  '/assets/js/components/comments.js',
  '/assets/js/components/charts.js',
  '/assets/js/components/settings-modal.js',
  '/assets/js/components/analytics-modal.js',
  '/assets/js/components/seed-demo.js',
  '/assets/js/components/command-palette.js',
  '/assets/js/components/grouped-view.js',
  '/assets/js/components/onboarding.js',
  '/assets/js/utils/import-export.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.all(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] failed to cache', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Skip Supabase and non-GET
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('jsdelivr.net')) {
    // network-first for fonts / CDN, cache fallback
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => cache.match(req))
      )
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (url.origin === self.location.origin)) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // fallback for navigation requests
        if (req.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
