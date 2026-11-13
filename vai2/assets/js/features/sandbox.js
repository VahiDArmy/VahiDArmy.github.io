/* ============================================================
   NEXUS CHAT — CODE SANDBOX
   Adds a "Run" button to HTML, CSS, and JS code blocks.
   Clicking opens a modal with a sandboxed iframe that executes
   the code. Uses `sandbox="allow-scripts"` — no same-origin
   access to the parent document.

   Auto-loaded via markdown-extras.js.

   Public API:
     window.Nexus.Sandbox.run(code, language)
     window.Nexus.Sandbox.close()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_sandbox_loaded__) return;
  window.__nexus_sandbox_loaded__ = true;

  const SUPPORTED = ['html', 'css', 'js', 'javascript', 'ts', 'typescript'];

  const state = {
    overlayEl: null,
    iframeEl: null,
    codeEl: null,
    langEl: null,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-sandbox-styles')) return;
    const css = `
/* ============================================================
   SANDBOX — RUN BUTTON ON CODE BLOCKS
   ============================================================ */
.nx-run-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--accent-primary);
  background: var(--accent-glow);
  color: var(--accent-secondary);
  border-radius: 5px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  letter-spacing: 0.3px;
}
.nx-run-btn:hover {
  background: var(--accent-primary);
  color: #fff;
}
.nx-run-btn svg {
  width: 9px;
  height: 9px;
}

/* ============================================================
   SANDBOX MODAL
   ============================================================ */
.nx-sandbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 4, 10, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.nx-sandbox-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-sandbox-modal {
  width: 100%;
  max-width: 1200px;
  height: 88vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(0.97);
  transition: transform 0.2s;
}
.nx-sandbox-overlay.open .nx-sandbox-modal {
  transform: scale(1);
}
.nx-sandbox-header {
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.nx-sandbox-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.nx-sandbox-title .lang-badge {
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.nx-sandbox-title .warn-badge {
  padding: 2px 8px;
  background: rgba(253, 203, 110, 0.15);
  border: 1px solid var(--warning);
  border-radius: 100px;
  font-size: 10px;
  color: var(--warning);
  font-weight: 600;
  font-family: var(--font-mono);
}
.nx-sandbox-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.nx-sandbox-action {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nx-sandbox-action:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-sandbox-action.danger {
  color: var(--danger);
  border-color: rgba(225, 112, 85, 0.4);
}
.nx-sandbox-action.danger:hover {
  background: rgba(225, 112, 85, 0.12);
  border-color: var(--danger);
}
.nx-sandbox-iframe-wrap {
  flex: 1;
  background: #ffffff;
  position: relative;
  overflow: hidden;
}
.nx-sandbox-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: #ffffff;
}
.nx-sandbox-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  pointer-events: none;
}
.nx-sandbox-footer {
  padding: 8px 18px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  flex-shrink: 0;
  background: var(--bg-tertiary);
}
.nx-sandbox-footer .left,
.nx-sandbox-footer .right {
  display: flex;
  gap: 10px;
  align-items: center;
}
.nx-sandbox-footer .stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.nx-sandbox-footer .stat.success { color: var(--success); }
.nx-sandbox-footer .stat.error { color: var(--danger); }
.nx-sandbox-footer .stat.warning { color: var(--warning); }
.nx-sandbox-footer .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

@media (max-width: 700px) {
  .nx-sandbox-overlay { padding: 10px; }
  .nx-sandbox-modal { height: 95vh; }
  .nx-sandbox-header { padding: 10px 12px; }
  .nx-sandbox-action { padding: 5px 9px; font-size: 11px; }
  .nx-sandbox-footer { font-size: 10px; padding: 6px 12px; }
  .nx-sandbox-footer .stat { display: none; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-sandbox-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     BUILD OVERLAY
     ============================================================ */
  function buildOverlay() {
    if (state.overlayEl) return;

    const overlay = document.createElement('div');
    overlay.className = 'nx-sandbox-overlay';
    overlay.id = 'nxSandboxOverlay';
    overlay.innerHTML = `
      <div class="nx-sandbox-modal" role="dialog" aria-modal="true" aria-label="Code sandbox">
        <div class="nx-sandbox-header">
          <div class="nx-sandbox-title">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 3l-3 5 3 5"/>
              <path d="M12 3l3 5-3 5"/>
              <path d="M9.5 2l-3 12" opacity="0.6"/>
            </svg>
            Code Sandbox
            <span class="lang-badge" id="nxSbLang">html</span>
            <span class="warn-badge" id="nxSbWarn" style="display:none;">isolated</span>
          </div>
          <div class="nx-sandbox-actions">
            <button class="nx-sandbox-action" id="nxSbReload" title="Reload iframe">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M14 8a6 6 0 11-6-6"/>
                <path d="M8 2l3 3M8 2l-3 3"/>
              </svg>
              Reload
            </button>
            <button class="nx-sandbox-action" id="nxSbNewTab" title="Open in new tab">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M9 3h4v4M13 3l-6 6"/>
                <path d="M12 10v3a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h3"/>
              </svg>
              Open
            </button>
            <button class="nx-sandbox-action danger" id="nxSbClose" title="Close sandbox">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M3 3l8 8M11 3l-8 8"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="nx-sandbox-iframe-wrap" id="nxSbIframeWrap">
          <iframe class="nx-sandbox-iframe" id="nxSbIframe"
            sandbox="allow-scripts"
            referrerpolicy="no-referrer"
            title="Sandbox"></iframe>
          <div class="nx-sandbox-empty" id="nxSbEmpty" style="display:none;">
            Loading…
          </div>
        </div>
        <div class="nx-sandbox-footer">
          <div class="left">
            <span class="stat success" id="nxSbStatus">
              <span class="dot"></span>
              <span id="nxSbStatusText">Ready</span>
            </span>
          </div>
          <div class="right">
            <span class="stat" id="nxSbSize">—</span>
            <span class="stat" id="nxSbSrc">source</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    state.overlayEl = overlay;
    state.iframeEl = overlay.querySelector('#nxSbIframe');
    state.langEl = overlay.querySelector('#nxSbLang');
    state.codeEl = overlay.querySelector('#nxSbEmpty');

    overlay.querySelector('#nxSbClose').addEventListener('click', close);
    overlay.querySelector('#nxSbReload').addEventListener('click', () => reloadIframe());
    overlay.querySelector('#nxSbNewTab').addEventListener('click', openInNewTab);

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    // Detect iframe load via load event
    state.iframeEl.addEventListener('load', () => {
      updateStatus('success', 'Loaded');
    });
  }

  /* ============================================================
     BUILD SANDBOX DOCUMENT
     ============================================================ */
  function buildDocument(code, language) {
    const lang = String(language || '').toLowerCase();
    if (lang === 'html') {
      // If it looks like a full document, pass through
      if (/<html[\s>]/i.test(code) || /<!doctype/i.test(code)) {
        return code;
      }
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sandbox</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 16px; color: #111; }
  </style>
</head>
<body>
${code}
</body>
</html>`;
    }

    if (lang === 'css') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>CSS Sandbox</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .nx-demo {
      padding: 40px 60px;
      background: #f5f5f8;
      border-radius: 12px;
      border: 1px solid #e2e2ea;
      color: #1a1a24;
      font-family: system-ui, sans-serif;
      text-align: center;
    }
    .nx-demo h1 { font-size: 22px; margin: 0 0 8px; }
    .nx-demo p { color: #6a6a88; margin: 0; }
  </style>
  <style>
${code}
  </style>
</head>
<body>
  <div class="nx-demo">
    <h1>CSS Preview</h1>
    <p>Style this markup with your CSS.</p>
    <button style="margin-top:16px;padding:8px 16px;border-radius:8px;border:1px solid #6c5ce7;background:#6c5ce7;color:#fff;font-family:inherit;cursor:pointer;">Sample button</button>
  </div>
</body>
</html>`;
    }

    if (lang === 'js' || lang === 'javascript') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>JS Sandbox</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 16px; background: #fafafa; color: #111; }
    .nx-console {
      background: #0a0a0f;
      color: #d4d4e0;
      padding: 12px 14px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      line-height: 1.55;
      min-height: 200px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 60vh;
      overflow-y: auto;
    }
    .nx-console-line { margin-bottom: 2px; }
    .nx-console-line.log { color: #d4d4e0; }
    .nx-console-line.info { color: #74b9ff; }
    .nx-console-line.warn { color: #fdcb6e; }
    .nx-console-line.error { color: #e17055; }
    .nx-console-line.result { color: #00b894; }
    .nx-console-line.return { color: #a29bfe; }
    .nx-console-line .timestamp { color: #6a6a88; margin-right: 8px; }
    h3 { margin-top: 0; font-size: 13px; color: #555; }
  </style>
</head>
<body>
  <h3>Console output</h3>
  <div class="nx-console" id="nx-console"></div>
  <script>
    (function () {
      const out = document.getElementById('nx-console');
      const log = (kind, args) => {
        const line = document.createElement('div');
        line.className = 'nx-console-line ' + kind;
        const ts = document.createElement('span');
        ts.className = 'timestamp';
        ts.textContent = new Date().toLocaleTimeString();
        line.appendChild(ts);
        const body = document.createElement('span');
        body.textContent = Array.from(args).map(a => {
          if (a === null) return 'null';
          if (a === undefined) return 'undefined';
          if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2); } catch (e) { return String(a); }
          }
          return String(a);
        }).join(' ');
        line.appendChild(body);
        out.appendChild(line);
        out.scrollTop = out.scrollHeight;
      };
      const origLog = console.log;
      const origInfo = console.info;
      const origWarn = console.warn;
      const origError = console.error;
      console.log = (...a) => { log('log', a); origLog.apply(console, a); };
      console.info = (...a) => { log('info', a); origInfo.apply(console, a); };
      console.warn = (...a) => { log('warn', a); origWarn.apply(console, a); };
      console.error = (...a) => { log('error', a); origError.apply(console, a); };
      window.addEventListener('error', (e) => {
        log('error', ['Uncaught: ' + e.message]);
      });
      window.addEventListener('unhandledrejection', (e) => {
        log('error', ['Unhandled rejection: ' + (e.reason && e.reason.message || e.reason)]);
      });
    })();
  </script>
  <script>
    try {
${code}
    } catch (e) {
      console.error(e.message || String(e));
    }
  </script>
</body>
</html>`;
    }

    if (lang === 'ts' || lang === 'typescript') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TypeScript Sandbox</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; background: #fafafa; color: #111; }
    .nx-console { background: #0a0a0f; color: #d4d4e0; padding: 12px 14px; border-radius: 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.55; white-space: pre-wrap; min-height: 200px; }
    h3 { margin-top: 0; font-size: 13px; color: #555; }
    .note { color: #6c5ce7; font-size: 12px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="note">TypeScript is compiled in-browser using TypeScript compiler. This may take a moment.</div>
  <h3>Console output</h3>
  <div class="nx-console" id="nx-console"></div>
  <script src="https://cdn.jsdelivr.net/npm/typescript@5.3.3/lib/typescript.js"><\/script>
  <script>
    (function () {
      const out = document.getElementById('nx-console');
      const log = (kind, args) => {
        const line = document.createElement('div');
        line.style.color = kind === 'error' ? '#e17055' : kind === 'warn' ? '#fdcb6e' : '#d4d4e0';
        line.textContent = Array.from(args).map(a => {
          if (a === null) return 'null';
          if (a === undefined) return 'undefined';
          if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
          return String(a);
        }).join(' ');
        out.appendChild(line);
      };
      console.log = (...a) => log('log', a);
      console.error = (...a) => log('error', a);
      console.warn = (...a) => log('warn', a);
      window.addEventListener('error', (e) => log('error', ['Error: ' + e.message]));

      try {
        const source = ${JSON.stringify(code)};
        const result = ts.transpileModule(source, {
          compilerOptions: { target: 'ES2020', module: 'ES2020' }
        });
        const compiled = result.outputText;
        try { eval(compiled); } catch (e) { log('error', ['Error: ' + (e.message || e)]); }
      } catch (e) {
        log('error', ['Compile error: ' + (e.message || e)]);
      }
    })();
  <\/script>
</body>
</html>`;
    }

    // Fallback: just wrap in a pre
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Sandbox</title>
<style>body { font-family: monospace; padding: 16px; background: #0a0a0f; color: #d4d4e0; }</style>
</head><body><pre></pre></body></html>`;
  }

  /* ============================================================
     RUN / OPEN / CLOSE
     ============================================================ */
  let currentCode = '';
  let currentLang = '';

  function run(code, language) {
    injectStyles();
    buildOverlay();
    currentCode = code || '';
    currentLang = String(language || 'html').toLowerCase();
    state.langEl.textContent = currentLang;

    const doc = buildDocument(currentCode, currentLang);
    const bytes = new Blob([doc]).size;
    overlayInfo(bytes);

    state.iframeEl.srcdoc = doc;
    updateStatus('warning', 'Running…');

    state.overlayEl.classList.add('open');
    // Reset to loaded status after a beat
    setTimeout(() => {
      updateStatus('success', 'Rendered');
    }, 800);
  }

  function overlayInfo(bytes) {
    const sizeEl = state.overlayEl.querySelector('#nxSbSize');
    if (sizeEl) {
      sizeEl.textContent = bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB';
    }
    const warn = state.overlayEl.querySelector('#nxSbWarn');
    if (warn) {
      warn.style.display = currentLang === 'html' || currentLang === 'css' ? 'inline-block' : 'inline-block';
    }
  }

  function reloadIframe() {
    if (!state.iframeEl) return;
    const doc = buildDocument(currentCode, currentLang);
    updateStatus('warning', 'Reloading…');
    state.iframeEl.srcdoc = doc;
    setTimeout(() => updateStatus('success', 'Reloaded'), 500);
  }

  function openInNewTab() {
    const doc = buildDocument(currentCode, currentLang);
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      window.__nexus.showToast('Popup blocked. Allow popups for this site.', 'warning', 3500);
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function close() {
    if (state.overlayEl) state.overlayEl.classList.remove('open');
    if (state.iframeEl) state.iframeEl.srcdoc = '';
  }

  function updateStatus(kind, text) {
    if (!state.overlayEl) return;
    const statusEl = state.overlayEl.querySelector('#nxSbStatus');
    const textEl = state.overlayEl.querySelector('#nxSbStatusText');
    if (!statusEl || !textEl) return;
    statusEl.className = 'stat ' + kind;
    textEl.textContent = text;
  }

  /* ============================================================
     ATTACH RUN BUTTONS TO CODE BLOCKS
     ============================================================ */
  function findRunCandidates(root) {
    if (!root) return [];
    const candidates = [];
    root.querySelectorAll('.code-block[data-lang]').forEach(el => {
      const lang = String(el.dataset.lang || '').toLowerCase();
      if (!SUPPORTED.includes(lang)) return;
      if (el.dataset.nxRunAdded) return;
      candidates.push({ el, lang });
    });
    return candidates;
  }

  function decorateBlock(blockEl, lang) {
    if (blockEl.dataset.nxRunAdded) return;
    blockEl.dataset.nxRunAdded = '1';

    // Add Run button to code block header
    const header = blockEl.querySelector('.code-block-header');
    if (!header) return;
    const copyBtn = header.querySelector('.code-copy-btn');

    const runBtn = document.createElement('button');
    runBtn.className = 'nx-run-btn';
    runBtn.type = 'button';
    runBtn.title = 'Run this code in a sandbox';
    runBtn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
      Run`;
    runBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const codeEl = blockEl.querySelector('pre code');
      if (!codeEl) return;
      const source = codeEl.textContent || '';
      if (!source.trim()) return;
      run(source, lang);
    });

    if (copyBtn && copyBtn.parentNode === header) {
      header.insertBefore(runBtn, copyBtn);
    } else {
      header.appendChild(runBtn);
    }
  }

  function scanAndDecorate(root) {
    const candidates = findRunCandidates(root);
    for (const { el, lang } of candidates) {
      decorateBlock(el, lang);
    }
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

    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg) => {
        if (!msg || msg.role !== 'assistant') return;
        if (msg.streaming) return;
        if (msg.error) return;
        const contentEl = wrapper.querySelector('.message-content.markdown-content');
        if (!contentEl) return;
        scanAndDecorate(contentEl);
      });
    }

    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterActiveChatRender)) {
      window.__nexus.hooks.afterActiveChatRender.push(() => {
        document.querySelectorAll('.message.assistant .message-content.markdown-content')
          .forEach(el => scanAndDecorate(el));
      });
    }

    // Handle blocks that appear during streaming (MutationObserver on the chat area)
    const container = document.getElementById('chatMessagesInner');
    if (container) {
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          scanAndDecorate(container);
        });
      });
      observer.observe(container, { childList: true, subtree: true });
    }
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Sandbox = { run, close };
})();
