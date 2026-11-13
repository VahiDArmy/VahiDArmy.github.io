/* ============================================================
   NEXUS CHAT — LINK PREVIEW CARDS
   Detects URLs in assistant messages and shows rich preview
   cards on hover, using the free Microlink API.
   Results are cached per-URL in localStorage.

   Auto-loaded via markdown-extras.js.

   Public API:
     window.Nexus.LinkPreview.previewUrl(url)
     window.Nexus.LinkPreview.clearCache()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_linkpreview_loaded__) return;
  window.__nexus_linkpreview_loaded__ = true;

  const CACHE_KEY = 'nexus_link_preview_cache_v1';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
  const MAX_CACHE_ENTRIES = 60;
  const HOVER_DELAY_MS = 420;
  const FETCH_TIMEOUT_MS = 4500;
  const MICROLINK_BASE = 'https://api.microlink.io/';
  const IGNORED_HOSTS = [
    'localhost', '127.0.0.1',
  ];

  const state = {
    cache: {},
    inFlight: {},
    cardEl: null,
    hideTimer: null,
    fetchTimer: null,
    hoveredUrl: null,
    hoveredAnchor: null,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-lp-styles')) return;
    const css = `
/* ============================================================
   LINK PREVIEW CARD
   ============================================================ */
.nx-lp-card {
  position: fixed;
  max-width: 360px;
  min-width: 260px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  z-index: 2200;
  opacity: 0;
  transform: translateY(6px) scale(0.98);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
  overflow: hidden;
  font-family: var(--font-sans);
}
.nx-lp-card.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}
.nx-lp-cover {
  width: 100%;
  height: 140px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-tertiary);
  position: relative;
}
.nx-lp-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
}
.nx-lp-body {
  padding: 12px 14px 14px;
}
.nx-lp-domain {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  margin-bottom: 6px;
  text-transform: lowercase;
}
.nx-lp-domain .favicon {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--bg-tertiary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  overflow: hidden;
}
.nx-lp-domain .favicon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.nx-lp-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nx-lp-desc {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nx-lp-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  font-size: 11px;
  color: var(--text-tertiary);
}
.nx-lp-loading .spin {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--text-tertiary);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: nx-lp-spin 0.7s linear infinite;
}
@keyframes nx-lp-spin { to { transform: rotate(360deg); } }
.nx-lp-error {
  padding: 14px;
  font-size: 11px;
  color: var(--danger);
  font-family: var(--font-mono);
}
`;
    const style = document.createElement('style');
    style.id = 'nx-lp-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     CACHE
     ============================================================ */
  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') state.cache = obj;
      }
    } catch (e) {}
  }
  function saveCache() {
    try {
      // Enforce max entries (evict oldest first)
      const entries = Object.entries(state.cache);
      if (entries.length > MAX_CACHE_ENTRIES) {
        entries.sort((a, b) => (b[1]._ts || 0) - (a[1]._ts || 0));
        state.cache = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(state.cache));
    } catch (e) {}
  }
  function getCached(url) {
    const entry = state.cache[url];
    if (!entry) return null;
    if (Date.now() - (entry._ts || 0) > CACHE_TTL_MS) {
      delete state.cache[url];
      saveCache();
      return null;
    }
    return entry;
  }
  function putCache(url, data) {
    state.cache[url] = { ...data, _ts: Date.now() };
    saveCache();
  }

  /* ============================================================
     FETCH PREVIEW
     ============================================================ */
  async function fetchPreview(url) {
    if (state.inFlight[url]) return state.inFlight[url];

    let host;
    try { host = new URL(url).hostname; } catch (e) { return null; }
    if (IGNORED_HOSTS.includes(host)) return { ok: false, reason: 'local' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    state.inFlight[url] = (async () => {
      try {
        const endpoint = MICROLINK_BASE + '?url=' + encodeURIComponent(url) + '&screenshot=false';
        const res = await fetch(endpoint, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.status !== 'success' || !json.data) throw new Error('No data');

        const d = json.data;
        const preview = {
          url,
          title: d.title || host,
          description: d.description || '',
          image: d.image?.url || d.logo?.url || '',
          logo: d.logo?.url || '',
          domain: host,
        };
        putCache(url, preview);
        return { ok: true, data: preview };
      } catch (err) {
        return { ok: false, reason: err.message };
      } finally {
        clearTimeout(timer);
        delete state.inFlight[url];
      }
    })();

    return state.inFlight[url];
  }

  /* ============================================================
     CARD UI
     ============================================================ */
  function ensureCard() {
    if (state.cardEl) return state.cardEl;
    const el = document.createElement('div');
    el.className = 'nx-lp-card';
    el.id = 'nxLpCard';
    document.body.appendChild(el);
    state.cardEl = el;
    return el;
  }

  function showLoadingCard(url, anchor) {
    const card = ensureCard();
    card.innerHTML = `
      <div class="nx-lp-loading">
        <div class="spin"></div>
        <span>Fetching preview from ${escapeHtml(safeHost(url))}…</span>
      </div>`;
    positionCard(card, anchor);
    requestAnimationFrame(() => card.classList.add('visible'));
  }

  function showPreviewCard(url, data, anchor) {
    const card = ensureCard();
    let coverHtml = '';
    if (data.image) {
      coverHtml = `
        <div class="nx-lp-cover" style="background-image: url('${escapeHtml(data.image)}')"></div>`;
    } else {
      coverHtml = `
        <div class="nx-lp-cover nx-lp-cover-placeholder">
          ${escapeHtml(safeHost(url))}
        </div>`;
    }

    const faviconHtml = data.logo
      ? `<img src="${escapeHtml(data.logo)}" alt="" referrerpolicy="no-referrer">`
      : `<span>${escapeHtml(safeHost(url).slice(0, 1).toUpperCase())}</span>`;

    card.innerHTML = `
      ${coverHtml}
      <div class="nx-lp-body">
        <div class="nx-lp-domain">
          <span class="favicon">${faviconHtml}</span>
          ${escapeHtml(safeHost(url))}
        </div>
        <div class="nx-lp-title">${escapeHtml(data.title || safeHost(url))}</div>
        ${data.description ? `<div class="nx-lp-desc">${escapeHtml(data.description)}</div>` : ''}
      </div>`;
    positionCard(card, anchor);
    requestAnimationFrame(() => card.classList.add('visible'));
  }

  function showErrorCard(url, reason, anchor) {
    const card = ensureCard();
    card.innerHTML = `
      <div class="nx-lp-error">Preview unavailable\n${escapeHtml(String(reason || 'unknown'))}</div>`;
    positionCard(card, anchor);
    requestAnimationFrame(() => card.classList.add('visible'));
  }

  function positionCard(card, anchor) {
    const rect = anchor.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    // Bound to viewport
    if (left + cardRect.width > window.innerWidth - 12) {
      left = window.innerWidth - cardRect.width - 12;
    }
    if (left < 12) left = 12;

    // If would overflow bottom, flip above
    if (top + cardRect.height > window.innerHeight - 12) {
      top = rect.top - cardRect.height - 8;
      if (top < 12) top = 12;
    }

    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function hideCard() {
    if (!state.cardEl) return;
    state.cardEl.classList.remove('visible');
  }

  /* ============================================================
     HOVER HANDLING
     ============================================================ */
  function safeHost(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function attachHoverListeners(anchor) {
    if (anchor.dataset.nxLpWired) return;
    anchor.dataset.nxLpWired = '1';
    const url = anchor.href;
    if (!url || !/^https?:\/\//i.test(url)) return;

    anchor.addEventListener('mouseenter', () => {
      if (state.hideTimer) {
        clearTimeout(state.hideTimer);
        state.hideTimer = null;
      }
      state.hoveredUrl = url;
      state.hoveredAnchor = anchor;

      const cached = getCached(url);
      if (cached) {
        showPreviewCard(url, cached, anchor);
        return;
      }

      // Debounce the fetch trigger
      if (state.fetchTimer) clearTimeout(state.fetchTimer);
      state.fetchTimer = setTimeout(async () => {
        if (state.hoveredUrl !== url) return;
        showLoadingCard(url, anchor);
        const result = await fetchPreview(url);
        if (state.hoveredUrl !== url) return; // user moved away
        if (result && result.ok) {
          showPreviewCard(url, result.data, anchor);
        } else if (result) {
          showErrorCard(url, result.reason, anchor);
        }
      }, HOVER_DELAY_MS);
    });

    anchor.addEventListener('mouseleave', () => {
      if (state.fetchTimer) {
        clearTimeout(state.fetchTimer);
        state.fetchTimer = null;
      }
      state.hideTimer = setTimeout(() => {
        state.hoveredUrl = null;
        state.hoveredAnchor = null;
        hideCard();
      }, 200);
    });
  }

  function findLinks(root) {
    if (!root) return [];
    const anchors = root.querySelectorAll('a[href]');
    const external = [];
    for (const a of anchors) {
      if (a.dataset.nxLpWired) continue;
      if (!/^https?:\/\//i.test(a.href)) continue;
      // Skip anchors pointing to the current page
      try {
        if (new URL(a.href).origin === location.origin) continue;
      } catch (e) {}
      external.push(a);
    }
    return external;
  }

  function scanAndWire(root) {
    const links = findLinks(root);
    for (const a of links) attachHoverListeners(a);
  }

  /* ============================================================
     HIDE ON SCROLL / BLUR
     ============================================================ */
  document.addEventListener('scroll', () => {
    if (state.cardEl && state.cardEl.classList.contains('visible')) hideCard();
  }, { passive: true, capture: true });

  window.addEventListener('resize', () => hideCard());

  /* ============================================================
     HOOKS
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    loadCache();
    ensureCard();

    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg) => {
        if (!msg || msg.role !== 'assistant') return;
        if (msg.streaming) return;
        const contentEl = wrapper.querySelector('.message-content.markdown-content');
        if (!contentEl) return;
        scanAndWire(contentEl);
      });
    }

    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterActiveChatRender)) {
      window.__nexus.hooks.afterActiveChatRender.push(() => {
        document.querySelectorAll('.message.assistant .message-content.markdown-content')
          .forEach(el => scanAndWire(el));
      });
    }

    // Handle streaming — wire new links as they appear
    const container = document.getElementById('chatMessagesInner');
    if (container) {
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          scanAndWire(container);
        });
      });
      observer.observe(container, { childList: true, subtree: true });
    }
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.LinkPreview = {
    previewUrl: async (url) => {
      const cached = getCached(url);
      if (cached) return cached;
      const result = await fetchPreview(url);
      return result && result.ok ? result.data : null;
    },
    clearCache: () => {
      state.cache = {};
      try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
    },
  };
})();
