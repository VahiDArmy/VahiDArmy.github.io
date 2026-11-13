/* ============================================================
   NEXUS CHAT — COMPARE MODE
   Send the same prompt to 2–4 models simultaneously and view
   responses side by side. Pick a winner to merge into the
   active chat.

   Auto-loaded by index.html. Injects its own CSS.

   Public API:
     window.Nexus.Compare.open()
     window.Nexus.Compare.close()
     window.Nexus.Compare.setModels([modelIds])
     window.Nexus.Compare.getState()
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_compare_loaded__) return;
  window.__nexus_compare_loaded__ = true;

  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const STORAGE_KEY = 'nexus_compare_selection_v1';
  const MIN_MODELS = 2;
  const MAX_MODELS = 4;

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    overlayEl: null,
    promptInput: null,
    columnsHost: null,
    selectedModelIds: [],
    isSending: false,
    currentPrompt: null,
    responses: [],
    lastSendAt: null,
  };

  /* ============================================================
     CSS INJECTION
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-compare-styles')) return;
    const css = `
/* ============================================================
   COMPARE OVERLAY
   ============================================================ */
.nx-compare-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 4, 10, 0.94);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 2600;
  display: flex;
  flex-direction: column;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}
.nx-compare-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-compare-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.nx-compare-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.nx-compare-title svg {
  color: var(--accent-secondary);
}
.nx-compare-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 400;
}
.nx-compare-actions-top {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Model selector row */
.nx-compare-models-row {
  padding: 12px 22px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.nx-compare-models-row::-webkit-scrollbar { display: none; }
.nx-compare-models-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  margin-right: 4px;
}
.nx-compare-model-chip {
  padding: 6px 12px;
  border-radius: 100px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nx-compare-model-chip:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-compare-model-chip.selected {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
  font-weight: 600;
}
.nx-compare-model-chip.selected::before {
  content: '✓';
  font-size: 10px;
}
.nx-compare-model-chip.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Columns */
.nx-compare-columns {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: stretch;
  scrollbar-width: thin;
}
.nx-compare-columns-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.6;
  padding: 40px;
}
.nx-compare-columns-empty .big-icon {
  font-size: 44px;
  margin-bottom: 14px;
  opacity: 0.5;
}

.nx-compare-col {
  flex: 0 0 380px;
  min-width: 320px;
  max-width: 460px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.nx-compare-col:hover {
  border-color: var(--border-strong);
}
.nx-compare-col.winner {
  border-color: var(--success);
  box-shadow: 0 0 20px rgba(0, 184, 148, 0.25);
}
.nx-compare-col-header {
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}
.nx-compare-col-model {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.nx-compare-col-status {
  font-size: 10px;
  font-family: var(--font-mono);
  padding: 2px 7px;
  border-radius: 100px;
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}
.nx-compare-col-status.streaming {
  background: rgba(253, 203, 110, 0.2);
  color: var(--warning);
  animation: nx-compare-pulse 1.2s infinite;
}
@keyframes nx-compare-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
.nx-compare-col-status.done {
  background: rgba(0, 184, 148, 0.2);
  color: var(--success);
}
.nx-compare-col-status.error {
  background: rgba(225, 112, 85, 0.2);
  color: var(--danger);
}
.nx-compare-col-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  min-height: 200px;
}
.nx-compare-col-content.markdown-content {
  white-space: normal;
}
.nx-compare-col-content.error {
  color: #ffb4a8;
  background: rgba(225, 112, 85, 0.06);
}
.nx-compare-col-content-empty {
  color: var(--text-tertiary);
  font-style: italic;
  font-size: 12px;
}
.nx-compare-col-footer {
  padding: 10px 14px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.nx-compare-col-metrics {
  flex: 1;
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nx-compare-col-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.nx-compare-col-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-compare-col-btn.primary {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
}
.nx-compare-col-btn.primary:hover:not(:disabled) {
  background: #00cba3;
  box-shadow: 0 0 12px rgba(0, 184, 148, 0.4);
}
.nx-compare-col-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nx-compare-col-btn.danger {
  color: var(--danger);
  border-color: rgba(225, 112, 85, 0.4);
}
.nx-compare-col-btn.danger:hover {
  background: rgba(225, 112, 85, 0.12);
}

/* Input area */
.nx-compare-input-row {
  padding: 14px 22px 20px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.nx-compare-input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 1100px;
  margin: 0 auto;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.nx-compare-input-wrap:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.nx-compare-textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  padding: 8px 10px;
  resize: none;
  max-height: 140px;
  min-height: 24px;
}
.nx-compare-textarea::placeholder {
  color: var(--text-tertiary);
}
.nx-compare-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  border: none;
  background: var(--accent-primary);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s;
  flex-shrink: 0;
}
.nx-compare-send-btn:hover:not(:disabled) {
  background: var(--accent-secondary);
  box-shadow: 0 0 16px var(--accent-glow);
}
.nx-compare-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nx-compare-send-btn.loading {
  background: var(--bg-elevated);
  pointer-events: none;
}
.nx-compare-send-btn.loading::after {
  content: '';
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-tertiary);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: nx-compare-spin 0.8s linear infinite;
}
@keyframes nx-compare-spin {
  to { transform: rotate(360deg); }
}

/* Close button uses .modal-close styles already defined */

@media (max-width: 900px) {
  .nx-compare-col {
    flex: 0 0 320px;
    min-width: 280px;
  }
}
@media (max-width: 700px) {
  .nx-compare-header { padding: 12px 14px; }
  .nx-compare-title { font-size: 14px; }
  .nx-compare-hint { display: none; }
  .nx-compare-models-row { padding: 10px 14px; }
  .nx-compare-columns { padding: 10px; gap: 10px; }
  .nx-compare-col { flex: 0 0 85vw; min-width: 85vw; }
  .nx-compare-input-row { padding: 10px 14px 14px; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-compare-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     READY
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    loadSelection();
    mountTopBarButton();
    buildOverlay();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.overlayEl && state.overlayEl.classList.contains('open')) {
        if (!state.isSending) close();
      }
    });
  });

  /* ============================================================
     STORAGE
     ============================================================ */
  function loadSelection() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) state.selectedModelIds = arr.slice(0, MAX_MODELS);
      }
    } catch (e) {}
  }

  function saveSelection() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selectedModelIds));
    } catch (e) {}
  }

  /* ============================================================
     MOUNT BUTTON
     ============================================================ */
  function mountTopBarButton() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar) return;
    if (document.getElementById('nxCompareBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxCompareBtn';
    btn.title = 'Compare models side by side';
    btn.setAttribute('aria-label', 'Compare models');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1.5" y="3" width="6" height="10" rx="1"/>
        <rect x="8.5" y="3" width="6" height="10" rx="1"/>
        <path d="M4.5 6h0M4.5 8h0M11.5 6h0M11.5 8h0" stroke-linecap="round" stroke-width="2"/>
      </svg>`;
    btn.addEventListener('click', open);
    topBar.insertBefore(btn, topBar.firstChild);
  }

  /* ============================================================
     OVERLAY
     ============================================================ */
  function buildOverlay() {
    if (state.overlayEl) return;
    const el = document.createElement('div');
    el.className = 'nx-compare-overlay';
    el.id = 'nxCompareOverlay';
    el.innerHTML = `
      <div class="nx-compare-header">
        <div class="nx-compare-title">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1.5" y="3" width="6" height="10" rx="1"/>
            <rect x="8.5" y="3" width="6" height="10" rx="1"/>
          </svg>
          Compare Mode
          <span class="nx-compare-hint">Send one prompt to multiple models · pick the winner</span>
        </div>
        <div class="nx-compare-actions-top">
          <button class="icon-btn" id="nxCompareClear" title="Clear results">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 4h10M6 4V2.5A1.5 1.5 0 017.5 1h1A1.5 1.5 0 0110 2.5V4M5 4l.5 8.5A1.5 1.5 0 007 14h2a1.5 1.5 0 001.5-1.5L11 4"/>
            </svg>
          </button>
          <button class="icon-btn danger" id="nxCompareClose" title="Close compare mode">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3l8 8M11 3l-8 8"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="nx-compare-models-row" id="nxCompareModelsRow">
        <span class="nx-compare-models-label">Models</span>
      </div>
      <div class="nx-compare-columns" id="nxCompareColumns"></div>
      <div class="nx-compare-input-row">
        <div class="nx-compare-input-wrap">
          <textarea class="nx-compare-textarea" id="nxCompareTextarea"
            placeholder="Type a prompt to send to all selected models…" rows="1"></textarea>
          <button class="nx-compare-send-btn" id="nxCompareSend" title="Send to all models">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M2 8l12-6-4 12-3-4-5-2z"/>
            </svg>
          </button>
        </div>
      </div>`;
    document.body.appendChild(el);
    state.overlayEl = el;
    state.promptInput = el.querySelector('#nxCompareTextarea');
    state.columnsHost = el.querySelector('#nxCompareColumns');

    el.querySelector('#nxCompareClose').addEventListener('click', close);
    el.querySelector('#nxCompareClear').addEventListener('click', clearResults);
    el.querySelector('#nxCompareSend').addEventListener('click', sendCompare);

    state.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCompare();
      }
    });
    state.promptInput.addEventListener('input', () => {
      state.promptInput.style.height = 'auto';
      state.promptInput.style.height = Math.min(state.promptInput.scrollHeight, 140) + 'px';
    });

    renderColumns();
  }

  /* ============================================================
     MODEL CHIPS
     ============================================================ */
  function renderModelChips() {
    const row = state.overlayEl.querySelector('#nxCompareModelsRow');
    // Clear everything after the label
    const label = row.querySelector('.nx-compare-models-label');
    row.innerHTML = '';
    if (label) row.appendChild(label);

    const models = (window.__nexus.state.models || []).slice(0, 30);
    if (!models.length) {
      const empty = document.createElement('span');
      empty.style.cssText = 'font-size:11px;color:var(--text-tertiary);';
      empty.textContent = 'No models loaded yet — wait a moment.';
      row.appendChild(empty);
      return;
    }

    const atMax = state.selectedModelIds.length >= MAX_MODELS;

    for (const m of models) {
      const selected = state.selectedModelIds.includes(m.id);
      const chip = document.createElement('button');
      chip.className = 'nx-compare-model-chip' + (selected ? ' selected' : '');
      chip.type = 'button';
      chip.textContent = m.name;
      chip.title = `${m.id} · ctx ${m.context_length || '?'}`;
      if (!selected && atMax) chip.classList.add('disabled');

      chip.addEventListener('click', () => {
        if (state.isSending) return;
        if (selected) {
          state.selectedModelIds = state.selectedModelIds.filter(id => id !== m.id);
        } else {
          if (state.selectedModelIds.length >= MAX_MODELS) {
            window.__nexus.showToast(
              `Maximum ${MAX_MODELS} models. Deselect one first.`,
              'warning',
              2500
            );
            return;
          }
          state.selectedModelIds.push(m.id);
        }
        saveSelection();
        renderModelChips();
      });

      row.appendChild(chip);
    }
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function open() {
    if (!state.overlayEl) buildOverlay();
    // If no selection yet, auto-pick first 2 models
    if (!state.selectedModelIds.length) {
      const models = window.__nexus.state.models || [];
      state.selectedModelIds = models.slice(0, Math.min(MIN_MODELS, models.length)).map(m => m.id);
      saveSelection();
    }
    renderModelChips();
    renderColumns();
    state.overlayEl.classList.add('open');
    setTimeout(() => {
      if (state.promptInput) state.promptInput.focus();
    }, 150);
  }

  function close() {
    if (state.isSending) {
      if (!confirm('A generation is still in progress. Close anyway?')) return;
      abortAll();
    }
    state.overlayEl.classList.remove('open');
  }

  function clearResults() {
    if (state.isSending) {
      window.__nexus.showToast('Wait for generation to finish', 'warning', 2000);
      return;
    }
    state.responses = [];
    state.currentPrompt = null;
    renderColumns();
    if (state.promptInput) {
      state.promptInput.value = '';
      state.promptInput.style.height = 'auto';
    }
  }

  function abortAll() {
    for (const r of state.responses) {
      if (r.abortController) {
        try { r.abortController.abort(); } catch (e) {}
      }
    }
  }

  /* ============================================================
     RENDER COLUMNS
     ============================================================ */
  function renderColumns() {
    const host = state.columnsHost;
    if (!host) return;
    host.innerHTML = '';

    if (!state.currentPrompt && !state.responses.length) {
      host.innerHTML = `
        <div class="nx-compare-columns-empty">
          <div>
            <div class="big-icon">⊞</div>
            <div>Select 2–4 models above, then type a prompt to see responses side by side.</div>
            <div style="margin-top:10px;font-size:11px;opacity:0.7;">Only free models are shown here (same pool as the main chat).</div>
          </div>
        </div>`;
      return;
    }

    for (let i = 0; i < state.responses.length; i++) {
      host.appendChild(renderColumn(state.responses[i], i));
    }
  }

  function renderColumn(resp, index) {
    const col = document.createElement('div');
    col.className = 'nx-compare-col';
    col.dataset.index = String(index);
    if (resp.status === 'done' && resp.isWinner) col.classList.add('winner');

    const modelName = resp.model.name || resp.model.id;
    const shortModel = resp.actualModel || resp.model.id;

    col.innerHTML = `
      <div class="nx-compare-col-header">
        <div class="nx-compare-col-model" title="${escapeAttr(resp.model.id)}">${escapeHtml(modelName)}</div>
        <div class="nx-compare-col-status ${resp.status}">${statusLabel(resp.status)}</div>
      </div>
      <div class="nx-compare-col-content ${resp.status === 'error' ? 'error' : ''}" data-role="content"></div>
      <div class="nx-compare-col-footer">
        <div class="nx-compare-col-metrics" data-role="metrics">${metricsLabel(resp)}</div>
        <button class="nx-compare-col-btn danger" data-role="abort" title="Abort">
          ${resp.status === 'streaming' ? 'Abort' : 'Reset'}
        </button>
        <button class="nx-compare-col-btn primary" data-role="choose" disabled title="Use this response">
          Choose
        </button>
      </div>`;

    const contentEl = col.querySelector('[data-role="content"]');
    if (resp.content) {
      contentEl.classList.add('markdown-content');
      contentEl.innerHTML = renderMarkdown(resp.content);
      if (window.Nexus?.Markdown?.attachCodeCopyButtons) {
        window.Nexus.Markdown.attachCodeCopyButtons(contentEl);
      }
    } else if (resp.status === 'pending' || resp.status === 'streaming') {
      contentEl.innerHTML = '<span class="nx-compare-col-content-empty">Waiting for tokens…</span>';
    } else if (resp.status === 'error') {
      contentEl.textContent = 'Error: ' + (resp.error || 'unknown');
    }

    // Abort / reset button
    col.querySelector('[data-role="abort"]').addEventListener('click', () => {
      if (resp.status === 'streaming') {
        try { resp.abortController.abort(); } catch (e) {}
      } else {
        resp.content = '';
        resp.status = 'pending';
        resp.error = null;
        renderColumns();
      }
    });

    // Choose button
    const chooseBtn = col.querySelector('[data-role="choose"]');
    if (resp.status === 'done' && resp.content) {
      chooseBtn.disabled = false;
      chooseBtn.addEventListener('click', () => pickWinner(index));
    }

    return col;
  }

  function statusLabel(s) {
    return ({
      pending: 'pending',
      streaming: 'streaming…',
      done: 'done',
      error: 'error',
    })[s] || s;
  }

  function metricsLabel(resp) {
    const parts = [];
    if (resp.actualModel && resp.actualModel !== resp.model.id) {
      parts.push(resp.actualModel.split('/').pop());
    }
    if (resp.usage) {
      const t = resp.usage.total_tokens || (
        (resp.usage.prompt_tokens || 0) + (resp.usage.completion_tokens || 0)
      );
      if (t) parts.push(`${t} tok`);
    }
    if (resp.startedAt && resp.finishedAt) {
      const ms = resp.finishedAt - resp.startedAt;
      if (ms > 0) parts.push(`${(ms / 1000).toFixed(1)}s`);
    }
    return parts.length ? parts.join(' · ') : '—';
  }

  /* ============================================================
     SEND
     ============================================================ */
  async function sendCompare() {
    if (state.isSending) return;
    const prompt = state.promptInput.value.trim();
    if (!prompt) return;
    if (state.selectedModelIds.length < MIN_MODELS) {
      window.__nexus.showToast(`Select at least ${MIN_MODELS} models`, 'warning', 2500);
      return;
    }

    const models = window.__nexus.state.models || [];
    const chosenModels = state.selectedModelIds
      .map(id => models.find(m => m.id === id))
      .filter(Boolean);
    if (chosenModels.length < MIN_MODELS) {
      window.__nexus.showToast(`Some selected models are not available`, 'warning', 2500);
      return;
    }

    state.currentPrompt = prompt;
    state.lastSendAt = Date.now();
    state.isSending = true;

    state.responses = chosenModels.map(m => ({
      model: m,
      actualModel: null,
      content: '',
      status: 'pending',
      error: null,
      startedAt: null,
      finishedAt: null,
      usage: null,
      abortController: new AbortController(),
      isWinner: false,
    }));

    renderColumns();

    const sendBtn = state.overlayEl.querySelector('#nxCompareSend');
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');

    // Clear input
    state.promptInput.value = '';
    state.promptInput.style.height = 'auto';

    // Build message context — only this single prompt (no chat history)
    // This keeps comparison clean and deterministic
    const apiMessages = [{ role: 'user', content: prompt }];

    // Fire all in parallel
    await Promise.all(
      state.responses.map((resp, i) => streamOne(resp, i, apiMessages))
    );

    state.isSending = false;
    sendBtn.disabled = false;
    sendBtn.classList.remove('loading');
  }

  async function streamOne(resp, index, apiMessages) {
    resp.status = 'streaming';
    resp.startedAt = Date.now();
    const col = state.columnsHost.querySelector(`.nx-compare-col[data-index="${index}"]`);
    if (col) {
      col.querySelector('.nx-compare-col-status').className = 'nx-compare-col-status streaming';
      col.querySelector('.nx-compare-col-status').textContent = 'streaming…';
    }

    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin || 'https://nexus-chat.local',
          'X-OpenRouter-Title': 'Nexus Chat · Compare',
        },
        body: JSON.stringify({
          model: resp.model.id,
          messages: apiMessages,
          stream: true,
        }),
        signal: resp.abortController.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        let detail = text;
        try {
          const j = JSON.parse(text);
          if (j?.error?.message) detail = j.error.message;
          if (j?.error?.metadata?.provider_code) {
            detail += ` [provider: ${j.error.metadata.provider_code}]`;
          }
        } catch (e) {}
        throw new Error(`HTTP ${res.status}: ${detail}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let raf = null;

      const flush = () => {
        raf = null;
        const c = state.columnsHost.querySelector(`.nx-compare-col[data-index="${index}"] [data-role="content"]`);
        if (c) {
          c.classList.add('markdown-content');
          c.innerHTML = renderMarkdown(full);
          c.scrollTop = c.scrollHeight;
        }
        const m = state.columnsHost.querySelector(`.nx-compare-col[data-index="${index}"] [data-role="metrics"]`);
        if (m) m.textContent = metricsLabel({ ...resp, content: full });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const chunk = JSON.parse(data);
            if (chunk.error) {
              throw new Error(
                (chunk.error.message || 'Provider error') +
                (chunk.error.metadata?.provider_code ? ` [${chunk.error.metadata.provider_code}]` : '')
              );
            }
            if (chunk.model) resp.actualModel = chunk.model;
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              full += delta;
              resp.content = full;
              if (!raf) raf = requestAnimationFrame(flush);
            }
            if (chunk.usage) resp.usage = chunk.usage;
          } catch (e) {
            if (e.message && /Provider|error/i.test(e.message)) throw e;
          }
        }
      }
      if (raf) flush();

      resp.content = full;
      resp.status = 'done';
      resp.finishedAt = Date.now();

      const colDone = state.columnsHost.querySelector(`.nx-compare-col[data-index="${index}"]`);
      if (colDone) {
        colDone.querySelector('.nx-compare-col-status').className = 'nx-compare-col-status done';
        colDone.querySelector('.nx-compare-col-status').textContent = 'done';
        colDone.querySelector('[data-role="metrics"]').textContent = metricsLabel(resp);
        const chooseBtn = colDone.querySelector('[data-role="choose"]');
        if (chooseBtn) {
          chooseBtn.disabled = !resp.content;
          chooseBtn.addEventListener('click', () => pickWinner(index));
        }
        const abortBtn = colDone.querySelector('[data-role="abort"]');
        if (abortBtn) abortBtn.textContent = 'Reset';
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        resp.status = 'error';
        resp.error = 'Aborted';
      } else {
        resp.status = 'error';
        resp.error = err.message || String(err);
        resp.content = '';
      }
      resp.finishedAt = Date.now();

      const colErr = state.columnsHost.querySelector(`.nx-compare-col[data-index="${index}"]`);
      if (colErr) {
        colErr.querySelector('.nx-compare-col-status').className = 'nx-compare-col-status error';
        colErr.querySelector('.nx-compare-col-status').textContent = 'error';
        const contentEl = colErr.querySelector('[data-role="content"]');
        contentEl.classList.remove('markdown-content');
        contentEl.classList.add('error');
        contentEl.textContent = 'Error: ' + resp.error;
        colErr.querySelector('[data-role="metrics"]').textContent = metricsLabel(resp);
        const abortBtn = colErr.querySelector('[data-role="abort"]');
        if (abortBtn) abortBtn.textContent = 'Reset';
      }
    }
  }

  /* ============================================================
     PICK WINNER
     ============================================================ */
  function pickWinner(index) {
    const resp = state.responses[index];
    if (!resp || !resp.content) return;

    // Confirm
    if (!confirm(
      `Continue with the response from ${resp.model.name}?\n\n` +
      `This will:\n` +
      `• Add your prompt + this response to the active chat\n` +
      `• Close compare mode`
    )) return;

    // Determine target chat
    let chat = window.__nexus.getActiveChat();
    if (!chat) {
      chat = window.__nexus.createChat(state.currentPrompt.slice(0, 50));
    }

    // Append user message
    chat.messages.push({
      role: 'user',
      content: state.currentPrompt,
      timestamp: new Date().toISOString(),
    });
    if (chat.messages.length === 1) {
      window.__nexus.updateChatTitle(chat.id, state.currentPrompt.slice(0, 50));
    }

    // Append assistant response
    chat.messages.push({
      role: 'assistant',
      content: resp.content,
      timestamp: new Date().toISOString(),
      model: resp.actualModel || resp.model.id,
      usage: resp.usage || undefined,
      finish_reason: 'stop',
    });

    chat.updatedAt = new Date().toISOString();
    window.__nexus.persistChats();
    window.__nexus.renderChatList();
    window.__nexus.renderActiveChat();

    window.__nexus.showToast(`Kept response from ${resp.model.name}`, 'success', 2500);
    close();
  }

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(s) {
    if (window.__nexus && window.__nexus.escapeHtml) return window.__nexus.escapeHtml(s);
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function renderMarkdown(text) {
    if (window.Nexus && window.Nexus.Markdown) {
      try { return window.Nexus.Markdown.render(text || ''); } catch (e) {}
    }
    return escapeHtml(text || '');
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Compare = {
    open,
    close,
    setModels: (ids) => {
      state.selectedModelIds = (ids || []).slice(0, MAX_MODELS);
      saveSelection();
      if (state.overlayEl) renderModelChips();
    },
    getState: () => ({
      isSending: state.isSending,
      selectedModelIds: state.selectedModelIds.slice(),
      responses: state.responses.map(r => ({
        modelId: r.model.id,
        status: r.status,
        length: (r.content || '').length,
      })),
    }),
  };
})();
