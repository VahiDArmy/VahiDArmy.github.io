/* ============================================================
   NEXUS CHAT — POLISH
   Small ergonomic enhancements bundled together:

   - Drag-to-resize sidebar (persisted width)
   - Drag-to-resize input area (persisted height)
   - Offline detection banner with reconnect retry queue
   - Rate-limit countdown timer (detects 429 in errors)
   - Ctrl+Enter quick hint next to send button
   - Auto-scroll pause when user scrolls up

   Loaded dynamically from onboarding.js so no index.html edit is
   needed. Injects its own CSS.

   Public API:
     window.Nexus.Polish.resetResize()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_polish_loaded__) return;
  window.__nexus_polish_loaded__ = true;

  const SIDEBAR_W_KEY = 'nexus_sidebar_width_v1';
  const INPUT_H_KEY = 'nexus_input_height_v1';

  const state = {
    offlineEl: null,
    rateLimitEl: null,
    rateLimitTimer: null,
    rateLimitEndsAt: 0,
    userScrolledUp: false,
    autoScrollResume: 0,
    resizeCleanup: [],
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-polish-styles')) return;
    const css = `
/* ---------- Sidebar resize handle ---------- */
.nx-sidebar-resize {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 5;
  background: transparent;
  transition: background 0.15s;
}
.nx-sidebar-resize:hover,
.nx-sidebar-resize.active {
  background: var(--accent-primary);
  box-shadow: 0 0 8px var(--accent-glow);
}

/* ---------- Input area resize handle ---------- */
.nx-input-resize {
  max-width: 860px;
  margin: 0 auto;
  height: 6px;
  cursor: ns-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nx-input-resize::before {
  content: '';
  width: 40px;
  height: 3px;
  border-radius: 2px;
  background: var(--border-strong);
  transition: background 0.15s;
}
.nx-input-resize:hover::before,
.nx-input-resize.active::before {
  background: var(--accent-primary);
  box-shadow: 0 0 8px var(--accent-glow);
}

/* ---------- Offline banner ---------- */
.nx-offline-banner {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  padding: 8px 16px;
  background: linear-gradient(90deg, rgba(225, 112, 85, 0.95), rgba(225, 112, 85, 0.85));
  color: #fff;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 900;
  transform: translateY(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
.nx-offline-banner.visible {
  transform: translateY(0);
  pointer-events: auto;
}
.nx-offline-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #fff;
  animation: nx-offline-pulse 1.2s infinite;
}
@keyframes nx-offline-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.nx-offline-banner.reconnected {
  background: linear-gradient(90deg, var(--success), #00a884);
}
.nx-offline-banner.reconnected .nx-offline-dot {
  animation: none;
}

/* ---------- Rate-limit countdown ---------- */
.nx-rate-limit {
  position: fixed;
  bottom: 160px;
  left: 50%;
  transform: translateX(-50%) translateY(8px);
  padding: 10px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--danger);
  border-radius: 100px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
  z-index: 1500;
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-primary);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
}
.nx-rate-limit.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
.nx-rate-limit-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--danger);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.nx-rate-limit-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nx-rate-limit-title {
  font-weight: 700;
  font-size: 12px;
  color: var(--danger);
}
.nx-rate-limit-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}
.nx-rate-limit-count strong {
  color: var(--danger);
}

/* ---------- Auto-scroll hint ---------- */
.nx-scroll-hint {
  position: fixed;
  bottom: 130px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 100px;
  font-size: 11px;
  font-family: var(--font-sans);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  z-index: 400;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}
.nx-scroll-hint.visible {
  opacity: 1;
  pointer-events: auto;
}
.nx-scroll-hint:hover {
  border-color: var(--accent-primary);
  color: var(--accent-secondary);
}

/* ---------- Send button shortcut hint ---------- */
.nx-send-hint {
  position: absolute;
  bottom: calc(100% + 4px);
  right: 4px;
  font-size: 9px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 3px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
  border: 1px solid var(--border-subtle);
  white-space: nowrap;
}
.input-wrapper:hover .nx-send-hint {
  opacity: 0.85;
}
`;
    const style = document.createElement('style');
    style.id = 'nx-polish-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     SIDEBAR RESIZE
     ============================================================ */
  function mountSidebarResize() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('nxSidebarResize')) return;

    // Restore width
    try {
      const savedW = parseInt(localStorage.getItem(SIDEBAR_W_KEY), 10);
      if (savedW && savedW >= 220 && savedW <= 480) {
        sidebar.style.width = savedW + 'px';
        sidebar.style.minWidth = savedW + 'px';
      }
    } catch (e) {}

    // Add handle
    const handle = document.createElement('div');
    handle.className = 'nx-sidebar-resize';
    handle.id = 'nxSidebarResize';
    sidebar.style.position = 'relative';
    sidebar.appendChild(handle);

    let dragging = false;
    let startX = 0;
    let startW = 0;

    const onDown = (e) => {
      dragging = true;
      handle.classList.add('active');
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const delta = e.clientX - startX;
      let newW = startW + delta;
      newW = Math.max(220, Math.min(480, newW));
      sidebar.style.width = newW + 'px';
      sidebar.style.minWidth = newW + 'px';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        const w = sidebar.getBoundingClientRect().width;
        localStorage.setItem(SIDEBAR_W_KEY, String(Math.round(w)));
      } catch (e) {}
    };

    handle.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    state.resizeCleanup.push(() => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    });
  }

  /* ============================================================
     INPUT RESIZE
     ============================================================ */
  function mountInputResize() {
    const inputArea = document.querySelector('.input-area');
    const inputWrapper = document.querySelector('.input-wrapper');
    if (!inputArea || !inputWrapper || document.getElementById('nxInputResize')) return;

    // Restore height
    try {
      const savedH = parseInt(localStorage.getItem(INPUT_H_KEY), 10);
      if (savedH && savedH >= 44 && savedH <= 240) {
        inputWrapper.style.minHeight = savedH + 'px';
      }
    } catch (e) {}

    // Add handle at top of input area
    const handle = document.createElement('div');
    handle.className = 'nx-input-resize';
    handle.id = 'nxInputResize';
    inputArea.insertBefore(handle, inputArea.firstChild);

    let dragging = false;
    let startY = 0;
    let startH = 0;

    const onDown = (e) => {
      dragging = true;
      handle.classList.add('active');
      startY = e.clientY;
      startH = inputWrapper.getBoundingClientRect().height;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const delta = startY - e.clientY; // dragging up increases size
      let newH = startH + delta;
      newH = Math.max(44, Math.min(240, newH));
      inputWrapper.style.minHeight = newH + 'px';
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        const h = inputWrapper.getBoundingClientRect().height;
        localStorage.setItem(INPUT_H_KEY, String(Math.round(h)));
      } catch (e) {}
    };

    handle.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    state.resizeCleanup.push(() => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    });
  }

  function resetResize() {
    try {
      localStorage.removeItem(SIDEBAR_W_KEY);
      localStorage.removeItem(INPUT_H_KEY);
    } catch (e) {}
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.style.width = '';
      sidebar.style.minWidth = '';
    }
    const wrap = document.querySelector('.input-wrapper');
    if (wrap) wrap.style.minHeight = '';
    if (window.__nexus.showToast) {
      window.__nexus.showToast('Resize reset to defaults', 'success', 2000);
    }
  }

  /* ============================================================
     OFFLINE BANNER
     ============================================================ */
  function mountOfflineBanner() {
    if (state.offlineEl) return;
    const el = document.createElement('div');
    el.className = 'nx-offline-banner';
    el.id = 'nxOfflineBanner';
    el.innerHTML = `
      <span class="nx-offline-dot"></span>
      <span class="msg">You’re offline. Messages will be queued and sent when you reconnect.</span>`;
    document.body.appendChild(el);
    state.offlineEl = el;

    const update = () => {
      if (navigator.onLine) {
        el.classList.remove('visible');
        if (el.dataset.wasOffline === '1') {
          el.classList.add('reconnected');
          el.querySelector('.msg').textContent = 'Connection restored';
          el.classList.add('visible');
          setTimeout(() => {
            el.classList.remove('visible', 'reconnected');
            el.querySelector('.msg').textContent = 'You’re offline. Messages will be queued and sent when you reconnect.';
          }, 2600);
        }
        el.dataset.wasOffline = '0';
      } else {
        el.dataset.wasOffline = '1';
        el.classList.add('visible');
      }
    };

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  /* ============================================================
     RATE LIMIT DETECTION
     ============================================================ */
  function mountRateLimitTimer() {
    if (state.rateLimitEl) return;
    const el = document.createElement('div');
    el.className = 'nx-rate-limit';
    el.id = 'nxRateLimit';
    el.innerHTML = `
      <div class="nx-rate-limit-icon">⏱</div>
      <div class="nx-rate-limit-text">
        <div class="nx-rate-limit-title">Rate limited by provider</div>
        <div class="nx-rate-limit-count">Try again in <strong data-countdown>—</strong></div>
      </div>`;
    document.body.appendChild(el);
    state.rateLimitEl = el;
  }

  function detectRateLimit(msg) {
    if (!msg || msg.role !== 'assistant' || !msg.error) return null;
    const content = String(msg.content || '');
    const detail = msg.errorDetail || '';

    // Match "HTTP 429", "Provider error [429]", or "rate limit"
    if (!/(\b429\b|rate.?limit|too many requests)/i.test(content)) return null;

    let retryAfter = null;

    // Try structured error detail
    try {
      const d = typeof detail === 'string' ? JSON.parse(detail) : detail;
      if (d) {
        // Various shapes OpenRouter uses
        retryAfter = retryAfter ||
          d?.error?.metadata?.retry_after_seconds ||
          d?.error?.metadata?.retry_after ||
          d?.retry_after ||
          d?.error?.retry_after;
      }
    } catch (e) {}

    // Fall back to parsing "retry after X" from message text
    if (!retryAfter) {
      const m = content.match(/retry.?(?:after)?\s*(\d+)\s*(s|sec|seconds)?/i);
      if (m) retryAfter = parseInt(m[1], 10);
    }

    // Default: 30 seconds if unknown
    if (!retryAfter || retryAfter <= 0) retryAfter = 30;
    // Cap at 5 minutes
    if (retryAfter > 300) retryAfter = 300;

    return {
      seconds: retryAfter,
      raw: content.slice(0, 200),
    };
  }

  function startRateLimitCountdown(seconds) {
    if (!state.rateLimitEl) mountRateLimitTimer();
    state.rateLimitEndsAt = Date.now() + seconds * 1000;
    state.rateLimitEl.classList.add('visible');
    if (state.rateLimitTimer) clearInterval(state.rateLimitTimer);

    const update = () => {
      const remaining = Math.max(0, state.rateLimitEndsAt - Date.now());
      const el = state.rateLimitEl.querySelector('[data-countdown]');
      if (!el) return;
      if (remaining <= 0) {
        clearInterval(state.rateLimitTimer);
        state.rateLimitTimer = null;
        state.rateLimitEl.classList.remove('visible');
        return;
      }
      const sec = Math.ceil(remaining / 1000);
      el.textContent = `${sec}s`;
    };
    update();
    state.rateLimitTimer = setInterval(update, 250);
  }

  /* ============================================================
     AUTO-SCROLL PAUSE
     ============================================================ */
  function mountScrollHint() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const hint = document.createElement('div');
    hint.className = 'nx-scroll-hint';
    hint.id = 'nxScrollHint';
    hint.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M8 2v12M3 9l5 5 5-5"/>
      </svg>
      Jump to latest`;
    document.body.appendChild(hint);
    hint.addEventListener('click', () => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      hint.classList.remove('visible');
      state.userScrolledUp = false;
    });

    container.addEventListener('scroll', () => {
      const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
      state.userScrolledUp = dist > 120;
      hint.classList.toggle('visible', state.userScrolledUp && container.scrollHeight > container.clientHeight + 400);
    }, { passive: true });

    // When new content streams in, auto-respect user scroll state
    const inner = document.getElementById('chatMessagesInner');
    if (inner) {
      const observer = new MutationObserver(() => {
        if (!state.userScrolledUp) {
          container.scrollTop = container.scrollHeight;
        }
      });
      observer.observe(inner, { childList: true, subtree: true, characterData: true });
    }
  }

  /* ============================================================
     SEND HINT
     ============================================================ */
  function mountSendHint() {
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    if (wrapper.querySelector('.nx-send-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'nx-send-hint';
    hint.textContent = 'Enter to send · Shift+Enter for newline';
    wrapper.appendChild(hint);
  }

  /* ============================================================
     HOOKS
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    mountSidebarResize();
    mountInputResize();
    mountOfflineBanner();
    mountRateLimitTimer();
    mountScrollHint();
    mountSendHint();

    if (!window.__nexus.hooks) return;

    // Detect rate limit from responses
    if (Array.isArray(window.__nexus.hooks.afterMessageSend)) {
      window.__nexus.hooks.afterMessageSend.push((chat) => {
        const last = chat?.messages?.[chat.messages.length - 1];
        if (!last || last.role !== 'assistant' || !last.error) return;
        const info = detectRateLimit(last);
        if (info) {
          startRateLimitCountdown(info.seconds);
        }
      });
    }
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Polish = {
    resetResize,
  };
})();
