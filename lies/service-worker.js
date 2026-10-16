/* ============================================================
   service-worker.js
   Offline-first PWA with version-based cache + network-only for API.
   Strategy:
     - App shell (HTML/CSS/JS): stale-while-revalidate
     - CDN fonts/icons:         cache-first (immutable)
     - Supabase API:            network-only (never cache)
     - Everything else:         network with cache fallback
   ============================================================ */

const VERSION = 'v1.0.0';
const STATIC_CACHE = `ayeneh-static-${VERSION}`;
const RUNTIME_CACHE = `ayeneh-runtime-${VERSION}`;

/* Assets to precache (relative to scope root). */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/main.css',
  './js/main.js',
];

/* URL patterns we never cache. */
const NETWORK_ONLY = [
  /supabase\.co\//,
  /supabase\.in\//,
  /\/auth\/v1\//,
  /\/rest\/v1\//,
  /\/realtime\/v1\//,
  /\/storage\/v1\//,
  /googleapis\.com\/css/,
];

/* URL patterns we cache-first (immutable CDN assets). */
const CACHE_FIRST = [
  /fonts\.gstatic\.com/,
  /cdn\.jsdelivr\.net/,
  /fonts\.googleapis\.com/,
];

/* ── Install ─────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {
        // Ignore individual failures — we still want the SW to install
      }))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate ────────────────────────────────────────────── */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => !k.endsWith(VERSION) && (k.startsWith('ayeneh-')))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ── Fetch ───────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip non-http(s)
  if (!/^https?:$/.test(url.protocol)) return;

  // Network-only for API calls
  if (NETWORK_ONLY.some((rx) => rx.test(url.href))) {
    // Let it go to network. No caching.
    return;
  }

  // Cache-first for immutable CDN
  if (CACHE_FIRST.some((rx) => rx.test(url.href))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Same-origin navigation (SPA) → network with offline fallback to index.html
  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }

  // Same-origin static → stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: network with cache fallback
  event.respondWith(networkWithCacheFallback(request));
});

/* ── Strategies ──────────────────────────────────────────── */

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function networkWithCacheFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match('./index.html');
    if (cached) return cached;
    const shell = await caches.match('./');
    if (shell) return shell;
    return new Response('آفلاین هستید.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('', { status: 504 });
}

/* ── Message handler ────────────────────────────────────── */

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data.type === 'PING') {
    event.source?.postMessage({ type: 'PONG', version: VERSION });
  }
});

/* ── Notification click ─────────────────────────────────── */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        return existing.navigate(url);
      }
      return self.clients.openWindow(url);
    })
  );
});