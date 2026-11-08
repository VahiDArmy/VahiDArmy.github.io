// Project Packer — service worker.
// Caches the app shell for offline use; never caches runtime data.

const VERSION = 'pp-v2.1.1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './README.md',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/views.css',
  './styles/overlays.css',
  './styles/animations.css',
  './styles/extra.css',
  './js/app.js',
  './js/utils/dom.js',
  './js/utils/format.js',
  './js/utils/crc.js',
  './js/utils/bytes.js',
  './js/utils/storage.js',
  './js/utils/id.js',
  './js/utils/hotkeys.js',
  './js/core/parser.js',
  './js/core/state.js',
  './js/core/skip.js',
  './js/core/ingest.js',
  './js/core/zip-build.js',
  './js/core/zip-read.js',
  './js/core/pack-text.js',
  './js/core/log.js',
  './js/core/export.js',
  './js/core/snapshots.js',
  './js/core/templates.js',
  './js/core/undo.js',
  './js/core/tags.js',
  './js/core/favorites.js',
  './js/core/validator.js',
  './js/core/build-shim.js',
  './js/ui/toast.js',
  './js/ui/modal.js',
  './js/ui/popover.js',
  './js/ui/palette.js',
  './js/ui/drawer.js',
  './js/ui/dropveil.js',
  './js/ui/statusbar.js',
  './js/ui/sidebar.js',
  './js/ui/router.js',
  './js/ui/commands.js',
  './js/ui/download.js',
  './js/ui/zip-flow.js',
  './js/ui/search.js',
  './js/ui/search-overlay.js',
  './js/ui/theme.js',
  './js/ui/paste-capture.js',
  './js/ui/help-modal.js',
  './js/ui/topbar.js',
  './js/ui/tooltip.js',
  './js/ui/notifications.js',
  './js/ui/pwa.js',
  './js/ui/confetti.js',
  './js/ui/split-view.js',
  './js/ui/heatmap.js',
  './js/ui/file-tree.js',
  './js/ui/context-menu.js',
  './js/ui/context-wiring.js',
  './js/ui/shortcuts-overlay.js',
  './js/ui/misc-shortcuts.js',
  './js/views/dashboard.js',
  './js/views/files.js',
  './js/views/editor.js',
  './js/views/log.js',
  './js/views/stats.js',
  './js/views/settings.js',
  './js/views/help.js',
  './js/views/diff.js',
  './js/views/snapshots.js',
  './js/views/templates.js',
  './js/views/tags.js',
  './js/views/onboarding.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => {
      return cache.addAll(SHELL).catch((err) => {
        console.warn('[sw] shell preload partial failure', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req).catch(() => caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached || new Response('', { status: 504 }));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
