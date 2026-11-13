/* ============================================================
   NEXUS CHAT — MERMAID
   Renders ```mermaid code blocks as SVG diagrams.
   Loads Mermaid from CDN on first encounter (lazy). Falls back
   to plain code block on failure. Auto-loaded via
   markdown-extras.js.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_mermaid_loaded__) return;
  window.__nexus_mermaid_loaded__ = true;

  const MERMAID_VERSION = '10.6.1';
  const MERMAID_JS = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;

  const state = {
    loaded: false,
    loading: null,
    failed: false,
    renderQueue: [],
    rendering: false,
    counter: 0,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-mermaid-styles')) return;
    const css = `
/* ============================================================
   MERMAID DIAGRAM
   ============================================================ */
.nx-mermaid-wrap {
  margin: 1em 0;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}
.nx-mermaid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--bg-code-header);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 600;
}
.nx-mermaid-header .actions {
  display: flex;
  gap: 4px;
}
.nx-mermaid-btn {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.12s;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}
.nx-mermaid-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-mermaid-body {
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60px;
  overflow-x: auto;
  background: var(--bg-code);
}
.nx-mermaid-body svg {
  max-width: 100%;
  height: auto;
}
.nx-mermaid-loading {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  padding: 12px;
}
.nx-mermaid-error {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--danger);
  background: rgba(225, 112, 85, 0.08);
  border: 1px solid rgba(225, 112, 85, 0.3);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.nx-mermaid-fallback {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  padding: 10px 14px;
  background: var(--bg-code);
  border-radius: 6px;
}
`;
    const style = document.createElement('style');
    style.id = 'nx-mermaid-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     LOAD MERMAID
     ============================================================ */
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

    state.loading = (async () => {
      try {
        if (typeof window.mermaid === 'undefined') {
          await loadScript(MERMAID_JS);
        }
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            fontFamily: 'Inter, system-ui, sans-serif',
            primaryColor: '#6c5ce7',
            primaryTextColor: '#f0f0f5',
            primaryBorderColor: '#a29bfe',
            lineColor: '#3a3a55',
            secondaryColor: '#1a1a26',
            tertiaryColor: '#12121a',
            background: '#12121a',
            mainBkg: '#1a1a26',
            nodeBorder: '#a29bfe',
            clusterBkg: '#12121a',
            clusterBorder: '#3a3a55',
            titleColor: '#f0f0f5',
            edgeLabelBackground: '#1a1a26',
            actorBkg: '#1a1a26',
            actorBorder: '#a29bfe',
            actorTextColor: '#f0f0f5',
            signalColor: '#a29bfe',
            signalTextColor: '#f0f0f5',
          },
          flowchart: { curve: 'basis', htmlLabels: true },
          securityLevel: 'strict',
        });
        state.loaded = true;
        return true;
      } catch (err) {
        state.failed = true;
        console.warn('[mermaid] failed to load:', err);
        return false;
      } finally {
        state.loading = null;
      }
    })();
    return state.loading;
  }

  /* ============================================================
     BLOCK FINDER
     ============================================================ */
  function findMermaidBlocks(root) {
    if (!root) return [];
    const blocks = [];
    // Our markdown module emits: <div class="code-block" data-lang="mermaid">
    root.querySelectorAll('.code-block[data-lang="mermaid"]').forEach(el => {
      if (!el.dataset.nxMermaidDone) blocks.push(el);
    });
    return blocks;
  }

  /* ============================================================
     TRANSFORM
     ============================================================ */
  async function transformBlock(blockEl) {
    if (blockEl.dataset.nxMermaidDone) return;
    blockEl.dataset.nxMermaidDone = '1';

    const codeEl = blockEl.querySelector('pre code');
    if (!codeEl) return;
    const source = codeEl.textContent || '';
    if (!source.trim()) return;

    // Build the wrapper
    const wrap = document.createElement('div');
    wrap.className = 'nx-mermaid-wrap';
    wrap.innerHTML = `
      <div class="nx-mermaid-header">
        <span>Mermaid diagram</span>
        <div class="actions">
          <button class="nx-mermaid-btn" data-act="source">View source</button>
          <button class="nx-mermaid-btn" data-act="copy">Copy</button>
        </div>
      </div>
      <div class="nx-mermaid-body">
        <div class="nx-mermaid-loading">Rendering diagram…</div>
      </div>`;

    // Replace the code block (visually)
    blockEl.parentNode.insertBefore(wrap, blockEl);
    blockEl.style.display = 'none';

    const bodyEl = wrap.querySelector('.nx-mermaid-body');

    wrap.querySelector('[data-act="source"]').addEventListener('click', () => {
      if (blockEl.style.display === 'none') {
        blockEl.style.display = '';
        wrap.querySelector('[data-act="source"]').textContent = 'Hide source';
      } else {
        blockEl.style.display = 'none';
        wrap.querySelector('[data-act="source"]').textContent = 'View source';
      }
    });

    wrap.querySelector('[data-act="copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText(source).then(() => {
        const btn = wrap.querySelector('[data-act="copy"]');
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
      }).catch(() => {});
    });

    // Attempt render
    const ok = await ensureLoaded();
    if (!ok) {
      bodyEl.innerHTML = '';
      const fb = document.createElement('div');
      fb.className = 'nx-mermaid-fallback';
      fb.textContent = source;
      bodyEl.appendChild(fb);
      return;
    }

    // Render
    const id = `nx-mermaid-${Date.now()}-${state.counter++}`;
    try {
      const { svg } = await window.mermaid.render(id, source);
      bodyEl.innerHTML = svg;
    } catch (err) {
      bodyEl.innerHTML = '';
      const errEl = document.createElement('div');
      errEl.className = 'nx-mermaid-error';
      errEl.textContent = 'Failed to render diagram:\n' + (err.message || String(err));
      bodyEl.appendChild(errEl);
    }
  }

  /* ============================================================
     PROCESS QUEUE (serialized)
     ============================================================ */
  async function processBlocks(blocks) {
    for (const b of blocks) {
      await transformBlock(b);
    }
  }

  function scanAndSchedule(root) {
    const blocks = findMermaidBlocks(root);
    if (!blocks.length) return;
    state.renderQueue.push(...blocks);
    flushQueue();
  }

  async function flushQueue() {
    if (state.rendering) return;
    if (!state.renderQueue.length) return;
    state.rendering = true;
    try {
      while (state.renderQueue.length) {
        const batch = state.renderQueue.splice(0, state.renderQueue.length);
        await processBlocks(batch);
      }
    } finally {
      state.rendering = false;
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
        scanAndSchedule(contentEl);
      });
    }

    if (window.__nexus.hooks && Array.isArray(window.__nexus.hooks.afterActiveChatRender)) {
      window.__nexus.hooks.afterActiveChatRender.push(() => {
        document.querySelectorAll('.message.assistant .message-content.markdown-content')
          .forEach(el => scanAndSchedule(el));
      });
    }

    // Also process any existing diagrams already on the page (e.g. after reload)
    setTimeout(() => {
      document.querySelectorAll('.message.assistant .message-content.markdown-content')
        .forEach(el => scanAndSchedule(el));
    }, 500);
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Mermaid = {
    renderSource: async (source) => {
      const ok = await ensureLoaded();
      if (!ok) throw new Error('Mermaid not loaded');
      const id = `nx-mermaid-manual-${Date.now()}`;
      const { svg } = await window.mermaid.render(id, source);
      return svg;
    },
    isLoaded: () => state.loaded,
  };
})();
