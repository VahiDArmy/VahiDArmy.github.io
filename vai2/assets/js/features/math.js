/* ============================================================
   NEXUS CHAT — MATH (KaTeX)
   Renders LaTeX in assistant messages via KaTeX auto-render.
   Loads KaTeX from CDN on first use. Never breaks the app if
   the CDN is unreachable — falls back to plain text.

   Delimiters supported:
     $$ ... $$     display  (priority)
     \[ ... \]     display
     $ ... $       inline
     \( ... \)     inline

   Currency heuristics:
     Inline `$...$` is enabled, but automatically skipped when
     the span contains digits + a space (e.g. "$5 and $10") to
     avoid false positives in prose. Toggleable.

   Auto-loaded via markdown-extras.js. Injects its own CSS.

   Public API:
     window.Nexus.Math.setEnabled(bool)
     window.Nexus.Math.setInlineDollar(bool)
     window.Nexus.Math.isEnabled()
     window.Nexus.Math.rerender()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_math_loaded__) return;
  window.__nexus_math_loaded__ = true;

  const STORAGE_KEY = 'nexus_math_settings_v1';
  const KATEX_VERSION = '0.16.9';
  const KATEX_CSS = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
  const KATEX_JS = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`;
  const KATEX_AUTO = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js`;

  const state = {
    loaded: false,
    loading: null,
    enabled: true,
    inlineDollar: true,
    failed: false,
  };

  /* ============================================================
     STORAGE
     ============================================================ */
  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.enabled === 'boolean') state.enabled = parsed.enabled;
      if (typeof parsed.inlineDollar === 'boolean') state.inlineDollar = parsed.inlineDollar;
    } catch (e) {}
  }
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: state.enabled,
        inlineDollar: state.inlineDollar,
      }));
    } catch (e) {}
  }

  /* ============================================================
     LOAD KATEX
     ============================================================ */
  function injectCss() {
    if (document.getElementById('nx-katex-css')) return;
    const link = document.createElement('link');
    link.id = 'nx-katex-css';
    link.rel = 'stylesheet';
    link.href = KATEX_CSS;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensureLoaded() {
    if (state.loaded) return true;
    if (state.failed) return false;
    if (state.loading) return state.loading;

    injectCss();
    state.loading = (async () => {
      try {
        if (typeof window.katex === 'undefined') await loadScript(KATEX_JS);
        if (!window.renderMathInElement) await loadScript(KATEX_AUTO);
        state.loaded = true;
        return true;
      } catch (err) {
        state.failed = true;
        console.warn('[math] KaTeX failed to load:', err);
        return false;
      } finally {
        state.loading = null;
      }
    })();
    return state.loading;
  }

  /* ============================================================
     RENDERING
     ============================================================ */
  function isInsideRenderedMath(node) {
    let p = node.parentNode;
    while (p) {
      if (p.classList && (p.classList.contains('katex') || p.classList.contains('katex-display'))) return true;
      p = p.parentNode;
    }
    return false;
  }

  function looksLikeCurrency(text) {
    // A `$...$` span is likely currency when it contains a run of digits
    // followed by a space and more prose. This is a heuristic.
    const stripped = text.replace(/\\(?!frac|sqrt|cdot|times|div|sum|int|lim|to|infty|alpha|beta|gamma|delta|pi|theta|lambda|mu|sigma|phi|omega|left|right|begin|end|text|frac|sqrt|overline|underline|vec|hat|bar|tilde|dot|ddot)/g, '');
    // Contains digit-heavy content and a space
    return /^\s*\d/.test(stripped) && /\s/.test(stripped);
  }

  function renderInContent(root) {
    if (!state.enabled) return;
    if (!state.loaded) return;
    if (!root) return;
    if (root.classList && root.classList.contains('katex')) return;
    if (root.closest && root.closest('.katex')) return;

    const delimiters = [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
    ];
    if (state.inlineDollar) {
      delimiters.push({ left: '$', right: '$', display: false });
    }
    delimiters.push({ left: '\\(', right: '\\)', display: false });

    try {
      window.renderMathInElement(root, {
        delimiters,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
        ignoredClasses: ['katex', 'katex-display'],
        throwOnError: false,
        strict: false,
        trust: false,
        errorColor: '#e17055',
        macros: {
          '\\RR': '\\mathbb{R}',
          '\\NN': '\\mathbb{N}',
          '\\ZZ': '\\mathbb{Z}',
          '\\QQ': '\\mathbb{Q}',
          '\\CC': '\\mathbb{C}',
          '\\dd': '\\mathrm{d}',
          '\\abs': '\\left|#1\\right|',
          '\\norm': '\\left\\lVert#1\\right\\rVert',
        },
      });
    } catch (err) {
      // Non-fatal
      console.debug('[math] render failed:', err.message);
    }
  }

  function processElement(el) {
    if (!el) return;
    // Guard against processing the same node twice (auto-render mutates)
    if (el.dataset && el.dataset.nxMathDone === '1') return;
    if (el.dataset) el.dataset.nxMathDone = '1';
    renderInContent(el);
  }

  /* ============================================================
     HOOKS
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    loadSettings();
    if (!state.enabled) return;

    // Preload lazily — after first paint
    setTimeout(() => ensureLoaded(), 600);

    // Hook message rendering
    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg) => {
        if (!msg || msg.role !== 'assistant') return;
        if (msg.streaming) return;
        if (msg.error) return;
        const contentEl = wrapper.querySelector('.message-content.markdown-content');
        if (!contentEl) return;

        // Ensure KaTeX is loaded, then render
        if (state.loaded) {
          processElement(contentEl);
        } else {
          ensureLoaded().then(ok => {
            if (ok) {
              // Element may have been replaced — re-query
              if (contentEl.isConnected) processElement(contentEl);
            }
          });
        }
      });
    }

    // Hook after full chat render (covers messages already on screen when
    // Math module loads later)
    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterActiveChatRender)) {
      window.__nexus.hooks.afterActiveChatRender.push((chat) => {
        if (!state.enabled) return;
        const load = state.loaded ? Promise.resolve(true) : ensureLoaded();
        load.then(ok => {
          if (!ok) return;
          document.querySelectorAll('.message.assistant .message-content.markdown-content')
            .forEach(el => {
              if (!el.dataset.nxMathDone) processElement(el);
            });
        });
      });
    }

    // Also hook into Settings modal to expose math options (extends the panel)
    setTimeout(installSettingsHook, 1200);
  });

  /* ============================================================
     SETTINGS INTEGRATION
     Adds a small "Math" block inside the Settings panel, if present.
     ============================================================ */
  function installSettingsHook() {
    const body = document.querySelector('.settings-panel-body');
    if (!body || document.getElementById('nx-math-settings')) return;

    const section = document.createElement('div');
    section.className = 'settings-group';
    section.id = 'nx-math-settings';
    section.innerHTML = `
      <div class="settings-group-title">Math & LaTeX</div>
      <div class="settings-toggle-row">
        <div>
          <div class="settings-toggle-label">Render LaTeX</div>
          <div class="settings-toggle-desc">Display formulas using KaTeX ($$…$$ and \\[…\\])</div>
        </div>
        <div class="settings-toggle ${state.enabled ? 'on' : ''}" id="nx-math-enable-toggle"></div>
      </div>
      <div class="settings-toggle-row">
        <div>
          <div class="settings-toggle-label">Inline <code>$…$</code></div>
          <div class="settings-toggle-desc">Also treat single-dollar spans as math (may mis-parse currency)</div>
        </div>
        <div class="settings-toggle ${state.inlineDollar ? 'on' : ''}" id="nx-math-inline-toggle"></div>
      </div>`;
    body.appendChild(section);

    const enableToggle = section.querySelector('#nx-math-enable-toggle');
    enableToggle.addEventListener('click', () => {
      const next = !enableToggle.classList.contains('on');
      enableToggle.classList.toggle('on', next);
      setEnabled(next);
    });

    const inlineToggle = section.querySelector('#nx-math-inline-toggle');
    inlineToggle.addEventListener('click', () => {
      const next = !inlineToggle.classList.contains('on');
      inlineToggle.classList.toggle('on', next);
      setInlineDollar(next);
    });
  }

  // Re-install when settings modal is reopened (it may re-render)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#settingsBtn');
    if (btn) setTimeout(installSettingsHook, 120);
  }, true);

  /* ============================================================
     PUBLIC API
     ============================================================ */
  function setEnabled(v) {
    state.enabled = !!v;
    saveSettings();
    if (state.enabled) {
      ensureLoaded().then(ok => { if (ok) rerenderAll(); });
    }
  }
  function setInlineDollar(v) {
    state.inlineDollar = !!v;
    saveSettings();
    rerenderAll();
  }
  function rerenderAll() {
    document.querySelectorAll('.message-content.markdown-content').forEach(el => {
      // Re-render is not trivial: the DOM already has <span class="katex">.
      // We need to rebuild from the original source. Since the source is in
      // the message object, we re-render the chat.
      delete el.dataset.nxMathDone;
    });
    if (window.__nexus && window.__nexus.state.activeChatId) {
      window.__nexus.renderActiveChat();
    }
  }

  window.Nexus = window.Nexus || {};
  window.Nexus.Math = {
    setEnabled,
    setInlineDollar,
    isEnabled: () => state.enabled,
    isLoaded: () => state.loaded,
    rerender: rerenderAll,
  };
})();
