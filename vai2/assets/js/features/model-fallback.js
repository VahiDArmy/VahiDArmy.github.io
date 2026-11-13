/* ============================================================
   NEXUS CHAT — MODEL FALLBACK & PINNING
   - Per-chat model pin (chat.pinnedModelId)
   - Pin toggle button in the sidebar
   - Automatic retry with fallback chain on error
   - Reads fallback chain from Nexus.ModelManager
     (falls back to chat.fallbackChain if defined)

   Auto-loaded by index.html. Injects its own CSS.

   Public API:
     window.Nexus.Fallback.pinCurrentChat(modelId)
     window.Nexus.Fallback.unpinCurrentChat()
     window.Nexus.Fallback.getEffectiveChain(chat)
     window.Nexus.Fallback.retryWithFallback(chat)
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_fallback_loaded__) return;
  window.__nexus_fallback_loaded__ = true;

  const MAX_RETRIES = 4;
  const RETRY_DELAY_MS = 300;

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    lastActiveChatId: null,
    retryingChats: new Set(),
    originalSendMessage: null,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-fallback-styles')) return;
    const css = `
/* ============================================================
   PIN INDICATOR & BUTTON
   ============================================================ */
.nx-pin-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 100px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 6px;
}
.nx-pin-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-pin-btn.pinned {
  background: rgba(253, 203, 110, 0.15);
  border-color: var(--warning);
  color: var(--warning);
  font-weight: 600;
}
.nx-pin-btn.pinned:hover {
  background: rgba(253, 203, 110, 0.25);
}

.nx-pin-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  background: rgba(253, 203, 110, 0.15);
  border: 1px solid var(--warning);
  border-radius: 100px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--warning);
  font-family: var(--font-mono);
  margin-left: 6px;
}

/* ============================================================
   RETRY BANNER (inline on errored assistant message)
   ============================================================ */
.nx-retry-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(253, 203, 110, 0.1);
  border: 1px solid rgba(253, 203, 110, 0.4);
  border-radius: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--warning);
  font-family: var(--font-sans);
  flex-wrap: wrap;
}
.nx-retry-banner .spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: nx-retry-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes nx-retry-spin { to { transform: rotate(360deg); } }
.nx-retry-banner .msg {
  flex: 1;
  min-width: 0;
}
.nx-retry-banner .model-name {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  background: rgba(253, 203, 110, 0.2);
  border-radius: 4px;
  font-weight: 600;
}
.nx-retry-banner.exhausted {
  background: rgba(225, 112, 85, 0.1);
  border-color: rgba(225, 112, 85, 0.4);
  color: var(--danger);
}
.nx-retry-banner.exhausted .model-name {
  background: rgba(225, 112, 85, 0.2);
}
.nx-retry-btn {
  padding: 3px 10px;
  border-radius: 5px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.nx-retry-btn:hover {
  background: currentColor;
  color: var(--bg-primary);
}

/* ============================================================
   CHAT LIST PIN BADGE
   ============================================================ */
.nx-chat-pin-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin-left: 4px;
  color: var(--warning);
  font-size: 9px;
  flex-shrink: 0;
}
`;
    const style = document.createElement('style');
    style.id = 'nx-fallback-styles';
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
    mountPinButton();
    hookChatSwitch();
    hookSendMessage();
    hookMessageDecoration();
    hookChatListRender();
    hookOriginalSendMessage();
  });

  /* ============================================================
     HOOK: pin toggle button in sidebar
     ============================================================ */
  function mountPinButton() {
    const badge = document.getElementById('modelBadge');
    if (!badge) return;
    if (document.getElementById('nxPinBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'nx-pin-btn';
    btn.id = 'nxPinBtn';
    btn.type = 'button';
    btn.title = 'Pin this model to the current chat';
    btn.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="8" cy="8" r="2.5"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2"/>
      </svg>
      Pin to chat`;
    btn.addEventListener('click', togglePin);

    // Insert after the model-badge (which is inside sidebar-header)
    badge.parentNode.insertBefore(btn, badge.nextSibling);
  }

  function refreshPinButton() {
    const btn = document.getElementById('nxPinBtn');
    if (!btn) return;
    const chat = window.__nexus.getActiveChat();
    const pinned = chat && chat.pinnedModelId;
    btn.classList.toggle('pinned', !!pinned);
    if (pinned) {
      const model = (window.__nexus.state.models || []).find(m => m.id === pinned);
      const name = model ? model.name : pinned;
      btn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1">
          <path d="M10 2l4 4-2 1-4 4-1 2-2-2 2-1 4-4 1-2-2-2z"/>
        </svg>
        Pinned: ${escapeHtml(name.slice(0, 18))}${name.length > 18 ? '…' : ''}`;
      btn.title = `Pinned to ${name} — click to unpin`;
    } else {
      btn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <circle cx="8" cy="8" r="2.5"/>
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2"/>
        </svg>
        Pin to chat`;
      btn.title = 'Pin this model to the current chat';
    }
  }

  function togglePin() {
    const chat = window.__nexus.getActiveChat();
    if (!chat) {
      window.__nexus.showToast('Start a chat first to pin a model', 'warning', 2500);
      return;
    }
    const current = window.__nexus.state.activeModel;
    if (!current) return;

    if (chat.pinnedModelId === current.id) {
      delete chat.pinnedModelId;
      window.__nexus.persistChats();
      refreshPinButton();
      window.__nexus.showToast('Unpinned from chat', 'info', 2000);
    } else {
      chat.pinnedModelId = current.id;
      window.__nexus.persistChats();
      refreshPinButton();
      window.__nexus.showToast(`Pinned ${current.name} to this chat`, 'success', 2500);
    }
    // Re-render chat list to update pin badge
    window.__nexus.renderChatList();
  }

  /* ============================================================
     HOOK: pin application on chat switch
     ============================================================ */
  function hookChatSwitch() {
    if (!window.__nexus.hooks) return;
    window.__nexus.hooks.afterActiveChatRender.push((chat) => {
      refreshPinButton();
      if (!chat) {
        state.lastActiveChatId = null;
        return;
      }
      // Only act on chat switch, not every render
      if (chat.id === state.lastActiveChatId) return;
      state.lastActiveChatId = chat.id;

      const pin = chat.pinnedModelId;
      if (!pin) return;

      const model = (window.__nexus.state.models || []).find(m => m.id === pin);
      if (!model) {
        // Pinned model not available anymore — silently ignore
        window.__nexus.showToast(
          `Pinned model "${pin}" not available. Using current model.`,
          'warning',
          3000
        );
        return;
      }
      // Only switch if different from current
      const cur = window.__nexus.state.activeModel;
      if (cur && cur.id === model.id) return;
      window.__nexus.selectModel(model, { silent: true });
    });
  }

  /* ============================================================
     HOOK: retry after send
     ============================================================ */
  function hookSendMessage() {
    if (!window.__nexus.hooks) return;
    if (window.__nexus.hooks.afterMessageSend.__fallback_hooked__) return;

    window.__nexus.hooks.afterMessageSend.push((chat) => {
      // Check if the last message errored
      const last = chat.messages[chat.messages.length - 1];
      if (!last || last.role !== 'assistant') return;
      if (!last.error) return;
      if (state.retryingChats.has(chat.id)) return;

      // Schedule retry (don't block the hook caller)
      scheduleRetry(chat);
    });
    window.__nexus.hooks.afterMessageSend.__fallback_hooked__ = true;
  }

  async function scheduleRetry(chat) {
    // Short delay so the user sees the error briefly
    await sleep(RETRY_DELAY_MS);

    // Re-verify state
    if (state.retryingChats.has(chat.id)) return;
    const last = chat.messages[chat.messages.length - 1];
    if (!last || !last.error) return;

    const chain = getEffectiveChain(chat);
    if (chain.length <= 1) return;

    // Check retryable
    if (!isRetryable(last)) {
      // Not retryable — add a note
      annotateUnretryable(chat, last, chain);
      return;
    }

    state.retryingChats.add(chat.id);
    try {
      await retryWithFallback(chat, chain);
    } finally {
      state.retryingChats.delete(chat.id);
    }
  }

  /* ============================================================
     HOOK: decorate errored messages with retry banner
     ============================================================ */
  function hookMessageDecoration() {
    if (!window.__nexus.hooks) return;
    if (window.__nexus.hooks.afterMessageElement.__fallback_hooked__) return;
    window.__nexus.hooks.afterMessageElement.push((wrapper, msg, index, chat) => {
      if (msg.role !== 'assistant') return;
      if (!msg.error) return;
      if (wrapper.querySelector('.nx-retry-banner')) return;

      const body = wrapper.querySelector('.message-body');
      if (!body) return;

      const chain = getEffectiveChain(chat);
      const banner = document.createElement('div');
      banner.className = 'nx-retry-banner';

      if (chain.length <= 1) {
        banner.classList.add('exhausted');
        banner.innerHTML = `<div class="msg">No fallback models configured. Add some in Settings → Models.</div>`;
      } else if (msg._fallbackExhausted) {
        banner.classList.add('exhausted');
        banner.innerHTML = `
          <div class="msg">All ${chain.length} models in the fallback chain failed.</div>
          <button class="nx-retry-btn" data-act="retry">Retry</button>`;
        banner.querySelector('[data-act="retry"]').addEventListener('click', () => {
          msg.error = false; // reset
          msg._fallbackExhausted = false;
          window.__nexus.persistChats();
          scheduleRetry(chat);
        });
      } else if (msg._fallbackRetrying) {
        banner.innerHTML = `
          <div class="spinner"></div>
          <div class="msg">
            Retrying with <span class="model-name">${escapeHtml(msg._fallbackRetryingModel || '…')}</span>
          </div>`;
      } else {
        banner.innerHTML = `
          <div class="msg">This response failed.</div>
          <button class="nx-retry-btn" data-act="retry">Retry now</button>`;
        banner.querySelector('[data-act="retry"]').addEventListener('click', () => {
          msg.error = false;
          window.__nexus.persistChats();
          scheduleRetry(chat);
        });
      }

      body.appendChild(banner);
    });
    window.__nexus.hooks.afterMessageElement.__fallback_hooked__ = true;
  }

  /* ============================================================
     HOOK: chat list render — show pin badge
     ============================================================ */
  function hookChatListRender() {
    if (!window.__nexus.hooks) return;
    if (window.__nexus.hooks.afterChatListRender.__fallback_hooked__) return;
    window.__nexus.hooks.afterChatListRender.push((container) => {
      for (const chat of (window.__nexus.state.chats || [])) {
        if (!chat.pinnedModelId) continue;
        const item = container.querySelector(`.chat-list-item[data-chat-id="${chat.id}"]`);
        if (!item) continue;
        const title = item.querySelector('.chat-title');
        if (!title) continue;
        if (title.querySelector('.nx-chat-pin-badge')) continue;
        const badge = document.createElement('span');
        badge.className = 'nx-chat-pin-badge';
        badge.textContent = '📌';
        badge.title = `Model pinned: ${chat.pinnedModelId}`;
        title.appendChild(badge);
      }
    });
    window.__nexus.hooks.afterChatListRender.__fallback_hooked__ = true;
  }

  /* ============================================================
     HOOK: intercept original sendMessage for pre-flight
     ============================================================ */
  function hookOriginalSendMessage() {
    if (state.originalSendMessage) return;
    state.originalSendMessage = window.__nexus.sendMessage;
    // Note: we do NOT replace the internal call. We only wrap the exported
    // reference so external calls benefit from pre-flight. The button click
    // uses the internal reference (fine — pin logic runs on chat switch and
    // fallback runs from the afterMessageSend hook).
  }

  /* ============================================================
     RETRY LOGIC
     ============================================================ */
  function getEffectiveChain(chat) {
    if (!chat) return [];
    // Per-chat override
    if (Array.isArray(chat.fallbackChain) && chat.fallbackChain.length) {
      const pinned = chat.pinnedModelId || (window.__nexus.state.activeModel?.id);
      // Ensure the pinned/active model is first
      const rest = chat.fallbackChain.filter(id => id !== pinned);
      return pinned ? [pinned, ...rest] : rest;
    }
    // Global chain from ModelManager
    const globalChain = (window.Nexus?.ModelManager?.getFallbackChain?.() || []);
    const pinned = chat.pinnedModelId || window.__nexus.state.activeModel?.id;
    if (pinned) {
      const rest = globalChain.filter(id => id !== pinned);
      return [pinned, ...rest];
    }
    return globalChain;
  }

  function isRetryable(msg) {
    // Try structured error detail
    if (msg.errorDetail) {
      try {
        const detail = typeof msg.errorDetail === 'string'
          ? JSON.parse(msg.errorDetail)
          : msg.errorDetail;
        const code = detail?.error?.code ?? detail?.code;
        if (code === 400 || code === 401 || code === 403) return false;
        if (code === 402) return true; // insufficient credits — free fallback may help
        if (code === 404) return true;
        if (code === 429) return true;
        if (typeof code === 'number' && code >= 500) return true;
      } catch (e) {}
    }
    const content = String(msg.content || '');
    if (/HTTP 400|HTTP 401|HTTP 403|invalid.?request|unauthorized|forbidden/i.test(content)) {
      return false;
    }
    // Default: retry (network blips, rate limits, provider outages)
    return true;
  }

  async function retryWithFallback(chat, chain) {
    const currentId = chat.pinnedModelId || window.__nexus.state.activeModel?.id;
    const startIdx = Math.max(0, chain.indexOf(currentId));
    const savedActiveModel = window.__nexus.state.activeModel;

    let lastErr = null;
    for (let i = startIdx + 1; i < chain.length; i++) {
      const modelId = chain[i];
      const model = (window.__nexus.state.models || []).find(m => m.id === modelId);
      if (!model) continue;

      // Pop the failed assistant message
      while (chat.messages.length > 0) {
        const tail = chat.messages[chat.messages.length - 1];
        if (tail.role === 'user') break;
        chat.messages.pop();
      }

      // If the last message isn't a user message, abort
      const tail = chat.messages[chat.messages.length - 1];
      if (!tail || tail.role !== 'user') return;

      // Update UI to show retrying state
      annotateRetrying(chat, model.name);

      // Set model temporarily
      window.__nexus.state.activeModel = model;
      try {
        await window.__nexus.streamAssistantResponse(chat);
      } catch (e) {
        lastErr = e;
        // Continue to next
      }

      // Check result
      const after = chat.messages[chat.messages.length - 1];
      if (after && after.role === 'assistant' && !after.error) {
        window.__nexus.showToast(
          `Responded with fallback model: ${model.name}`,
          'success',
          3000
        );
        return;
      }
    }

    // All exhausted
    window.__nexus.state.activeModel = savedActiveModel;
    annotateExhausted(chat);
    window.__nexus.showToast(
      'All fallback models failed. Check the error details.',
      'error',
      5000
    );
    if (lastErr) console.warn('Fallback retries exhausted:', lastErr);
  }

  function annotateRetrying(chat, modelName) {
    const last = chat.messages[chat.messages.length - 1];
    // We popped the errored message; find any leftover user message
    // and re-render so the banner attaches to the new streaming message
    if (last && last._fallbackRetrying !== undefined) {
      last._fallbackRetrying = true;
      last._fallbackRetryingModel = modelName;
    }
    // Store retry context on chat itself so the next assistant message
    // gets decorated after streaming
    chat._retryState = { modelName, active: true };
    window.__nexus.renderActiveChat();
  }

  function annotateExhausted(chat) {
    // Find last errored assistant message and mark exhausted
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const m = chat.messages[i];
      if (m.role === 'assistant' && m.error) {
        m._fallbackExhausted = true;
        delete m._fallbackRetrying;
        delete m._fallbackRetryingModel;
        break;
      }
    }
    delete chat._retryState;
    window.__nexus.persistChats();
    window.__nexus.renderActiveChat();
  }

  function annotateUnretryable(chat, msg, chain) {
    // Not adding a banner — the error itself is clear enough
    // But log for debugging
    console.debug('Error classified as non-retryable, skipping fallback');
  }

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(str) {
    if (window.__nexus && window.__nexus.escapeHtml) return window.__nexus.escapeHtml(str);
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Fallback = {
    pinCurrentChat: (modelId) => {
      const chat = window.__nexus.getActiveChat();
      if (!chat) return false;
      chat.pinnedModelId = modelId || window.__nexus.state.activeModel?.id;
      window.__nexus.persistChats();
      refreshPinButton();
      window.__nexus.renderChatList();
      return true;
    },
    unpinCurrentChat: () => {
      const chat = window.__nexus.getActiveChat();
      if (!chat) return false;
      delete chat.pinnedModelId;
      window.__nexus.persistChats();
      refreshPinButton();
      window.__nexus.renderChatList();
      return true;
    },
    getEffectiveChain,
    retryWithFallback: async (chat) => {
      const chain = getEffectiveChain(chat);
      if (chain.length <= 1) return false;
      await retryWithFallback(chat, chain);
      return true;
    },
    isRetryable,
  };
})();
