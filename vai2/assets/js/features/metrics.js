/* ============================================================
   NEXUS CHAT — METRICS, STOP BUTTON, AUTO-TITLE
   - Per-message metrics (tokens, model, latency, truncation flag)
   - Floating "Stop generating" pill visible during streaming
   - Chat-level token totals in the context bar
   - Auto-title generation after first assistant response

   Auto-loaded by index.html. Injects its own CSS.

   Public API:
     window.Nexus.Metrics.getChatStats(chatId)
     window.Nexus.Metrics.getGlobalStats()
     window.Nexus.Metrics.generateTitle(chatId)
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_metrics_loaded__) return;
  window.__nexus_metrics_loaded__ = true;

  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  const TITLE_TRIED_PREFIX = 'nexus_autotitle_done_';

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    stopBtn: null,
    observer: null,
    sendStartTimes: new WeakMap(), // chatId -> start ms
  };

  /* ============================================================
     CSS INJECTION
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-metrics-styles')) return;
    const css = `
/* ============================================================
   PER-MESSAGE METRICS BADGE
   ============================================================ */
.nx-metrics-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity 0.2s;
  flex-wrap: wrap;
  max-width: 100%;
}
.message:hover .nx-metrics-badge,
.nx-metrics-badge.always-show {
  opacity: 1;
}
.nx-metrics-badge > span {
  white-space: nowrap;
}
.nx-metrics-badge .sep {
  color: var(--border-strong);
}
.nx-metrics-badge .warn {
  color: var(--warning);
  font-weight: 600;
}
.nx-metrics-badge .danger {
  color: var(--danger);
  font-weight: 600;
}
.nx-metrics-badge .good {
  color: var(--success);
}
.nx-metrics-badge .model {
  color: var(--accent-secondary);
  font-weight: 600;
}

/* ============================================================
   STOP GENERATING PILL
   ============================================================ */
.nx-stop-pill {
  position: fixed;
  bottom: 110px;
  left: 50%;
  transform: translateX(-50%) translateY(16px);
  padding: 8px 16px 8px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 100px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
  z-index: 1500;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
  font-family: var(--font-sans);
}
.nx-stop-pill.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  pointer-events: auto;
}
.nx-stop-pill:hover {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
.nx-stop-pill:active {
  transform: translateX(-50%) translateY(0) scale(0.97);
}
.nx-stop-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--danger);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nx-stop-pill:hover .nx-stop-icon {
  background: #fff;
  color: var(--danger);
}
.nx-stop-label {
  white-space: nowrap;
}
.nx-stop-hint {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-left: 4px;
}
.nx-stop-pill:hover .nx-stop-hint {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* ============================================================
   CHAT TOTALS IN CONTEXT BAR
   ============================================================ */
.nx-chat-totals {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  cursor: help;
}
.nx-chat-totals .label {
  color: var(--text-secondary);
  font-weight: 600;
}

/* ============================================================
   AUTO-TITLE INDICATOR (subtle)
   ============================================================ */
.nx-title-generating {
  opacity: 0.55;
  position: relative;
}
.nx-title-generating::after {
  content: '';
  position: absolute;
  right: 6px;
  top: 50%;
  width: 8px;
  height: 8px;
  margin-top: -4px;
  border-radius: 50%;
  border: 1.5px solid var(--accent-primary);
  border-top-color: transparent;
  animation: nx-title-spin 0.8s linear infinite;
}
@keyframes nx-title-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 700px) {
  .nx-stop-pill {
    bottom: 90px;
    font-size: 12px;
    padding: 7px 12px 7px 10px;
  }
  .nx-stop-hint { display: none; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-metrics-styles';
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
    hookMessages();
    hookLatency();
    mountStopButton();
    mountChatTotals();
    // One-shot: try to backfill latency for messages missing it
    backfillLatency();
  });

  /* ============================================================
     HOOKS
     ============================================================ */
  function hookMessages() {
    if (!window.__nexus || !window.__nexus.hooks) return;
    const hooks = window.__nexus.hooks;
    if (!Array.isArray(hooks.afterMessageElement)) return;
    if (hooks.afterMessageElement.__metrics_hooked__) return;
    hooks.afterMessageElement.push(decorateWithMetrics);
    hooks.afterMessageElement.__metrics_hooked__ = true;
    if (window.__nexus.state.activeChatId) {
      window.__nexus.renderActiveChat();
    }
  }

  function hookLatency() {
    if (!window.__nexus || !window.__nexus.hooks) return;
    const hooks = window.__nexus.hooks;
    if (!Array.isArray(hooks.beforeMessageSend)) return;
    if (hooks.beforeMessageSend.__metrics_hooked__) return;

    hooks.beforeMessageSend.push((chat) => {
      state.sendStartTimes.set(chat.id, Date.now());
    });

    hooks.afterMessageSend.push((chat) => {
      const start = state.sendStartTimes.get(chat.id);
      state.sendStartTimes.delete(chat.id);
      // Find last assistant message that lacks latency
      for (let i = chat.messages.length - 1; i >= 0; i--) {
        const m = chat.messages[i];
        if (m.role === 'assistant') {
          if (!m._latency) {
            const startTime = m.timestamp ? new Date(m.timestamp).getTime() : start;
            if (startTime) {
              m._latency = Date.now() - startTime;
              window.__nexus.persistChats();
            }
          }
          break;
        }
      }
      // Try auto-title
      autoTitleIfNeeded(chat);
      // Refresh chat totals
      updateChatTotals();
    });
    hooks.beforeMessageSend.__metrics_hooked__ = true;
    hooks.afterMessageSend.__metrics_hooked__ = true;
  }

  function backfillLatency() {
    let changed = false;
    for (const chat of window.__nexus.state.chats) {
      for (const m of chat.messages) {
        if (m.role === 'assistant' && !m._latency && m.timestamp && m.finish_reason) {
          // Use chat.updatedAt as a rough end time if it's close to the message's time
          const start = new Date(m.timestamp).getTime();
          const end = new Date(chat.updatedAt || m.timestamp).getTime();
          if (end > start && end - start < 300000) {
            m._latency = end - start;
            changed = true;
          }
        }
      }
    }
    if (changed) window.__nexus.persistChats();
  }

  /* ============================================================
     MESSAGE METRICS BADGE
     ============================================================ */
  function decorateWithMetrics(wrapper, msg, index, chat) {
    if (msg.role !== 'assistant') return;
    if (msg.streaming) return;
    if (wrapper.querySelector('.nx-metrics-badge')) return;

    const parts = [];

    if (msg.model) {
      const modelShort = String(msg.model).split('/').slice(-1)[0];
      parts.push(`<span class="model">${escapeHtml(modelShort)}</span>`);
    }

    if (msg.usage) {
      const u = msg.usage;
      const prompt = u.prompt_tokens || 0;
      const completion = u.completion_tokens || 0;
      const total = u.total_tokens || (prompt + completion);
      if (total) {
        parts.push(`<span title="${prompt} in / ${completion} out">${total} tok</span>`);
      }
    }

    if (msg._latency && msg._latency > 0) {
      const secs = msg._latency / 1000;
      const cls = secs > 30 ? 'warn' : secs > 60 ? 'danger' : '';
      parts.push(`<span class="${cls}">${secs.toFixed(1)}s</span>`);
    }

    if (msg.finish_reason === 'length') {
      parts.push(`<span class="warn" title="Response was truncated due to max_tokens">⚠ truncated</span>`);
    } else if (msg.finish_reason === 'content_filter') {
      parts.push(`<span class="danger" title="Content was filtered">⚠ filtered</span>`);
    }

    if (!parts.length) return;

    const badge = document.createElement('div');
    badge.className = 'nx-metrics-badge';
    badge.innerHTML = parts.join('<span class="sep">·</span>');

    const body = wrapper.querySelector('.message-body');
    if (body) body.appendChild(badge);
  }

  /* ============================================================
     STOP BUTTON
     ============================================================ */
  function mountStopButton() {
    if (state.stopBtn) return;
    const btn = document.createElement('button');
    btn.className = 'nx-stop-pill';
    btn.type = 'button';
    btn.id = 'nxStopPill';
    btn.setAttribute('aria-label', 'Stop generating');
    btn.innerHTML = `
      <div class="nx-stop-icon">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <rect x="1.5" y="1.5" width="7" height="7" rx="1"/>
        </svg>
      </div>
      <span class="nx-stop-label">Stop generating</span>
      <span class="nx-stop-hint">Esc</span>`;
    document.body.appendChild(btn);
    state.stopBtn = btn;

    btn.addEventListener('click', () => {
      const ctrl = window.__nexus.state.abortController;
      if (ctrl) {
        try { ctrl.abort(); } catch (e) {}
      } else {
        window.__nexus.showToast('No active generation to stop', 'info', 2000);
      }
    });

    // Esc key also stops
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.__nexus.state.isStreaming) {
        const ctrl = window.__nexus.state.abortController;
        if (ctrl) {
          try { ctrl.abort(); } catch (err) {}
        }
      }
    });

    // Watch send button class for `.loading`
    const sendBtn = document.getElementById('sendBtn');
    if (!sendBtn) return;

    const update = () => {
      const streaming = sendBtn.classList.contains('loading');
      btn.classList.toggle('visible', streaming);
    };
    update();

    if (state.observer) state.observer.disconnect();
    state.observer = new MutationObserver(update);
    state.observer.observe(sendBtn, { attributes: true, attributeFilter: ['class'] });
  }

  /* ============================================================
     CHAT TOTALS
     ============================================================ */
  function mountChatTotals() {
    const container = document.getElementById('contextReport');
    if (!container) return;
    if (container.querySelector('.nx-chat-totals')) return;

    const pill = document.createElement('div');
    pill.className = 'nx-chat-totals';
    pill.id = 'nxChatTotals';
    pill.title = 'Chat-wide token totals';
    container.appendChild(pill);

    // Hook into active chat changes by polling lightly
    updateChatTotals();
    setInterval(updateChatTotals, 3000);
  }

  function updateChatTotals() {
    const pill = document.getElementById('nxChatTotals');
    if (!pill) return;
    const chat = window.__nexus.getActiveChat();
    if (!chat || !chat.messages.length) {
      pill.style.display = 'none';
      return;
    }
    let prompt = 0, completion = 0, total = 0, count = 0;
    for (const m of chat.messages) {
      if (m.role !== 'assistant' || !m.usage) continue;
      const u = m.usage;
      prompt += u.prompt_tokens || 0;
      completion += u.completion_tokens || 0;
      total += u.total_tokens || ((u.prompt_tokens || 0) + (u.completion_tokens || 0));
      count++;
    }
    if (!total) {
      pill.style.display = 'none';
      return;
    }
    pill.style.display = 'inline-flex';
    pill.innerHTML = `
      <span class="label">chat</span>
      <span title="Total in + out">${formatCompact(total)} tok</span>
    `;
  }

  /* ============================================================
     AUTO-TITLE
     ============================================================ */
  async function autoTitleIfNeeded(chat) {
    try {
      const settings = window.Nexus?.Settings?.get() || {};
      if (settings.autoTitle === false) return;

      // Only for fresh chats with exactly one exchange
      if (!chat || chat.messages.length !== 2) return;
      const userMsg = chat.messages[0];
      const assistantMsg = chat.messages[1];
      if (userMsg.role !== 'user' || assistantMsg.role !== 'assistant') return;

      // Was the title auto-generated from the user message?
      const autoTitle = String(userMsg.content || '').slice(0, 50);
      if (chat.title !== autoTitle) return; // manually renamed

      // Have we already tried?
      const triedKey = TITLE_TRIED_PREFIX + chat.id;
      try {
        if (localStorage.getItem(triedKey)) return;
        localStorage.setItem(triedKey, '1');
      } catch (e) {}

      // Need a model
      const model = window.__nexus.state.activeModel;
      if (!model) return;

      // Mark chat as generating
      const chatItem = document.querySelector(`.chat-list-item[data-chat-id="${chat.id}"]`);
      if (chatItem) chatItem.classList.add('nx-title-generating');

      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin || 'https://nexus-chat.local',
          'X-OpenRouter-Title': 'Nexus Chat · Auto-Title',
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            {
              role: 'system',
              content:
                'You are a concise title generator. Given a chat exchange, produce a title of 3 to 6 words. Output only the title — no quotes, no trailing punctuation, no explanation. Respond in the same language as the user message.',
            },
            { role: 'user', content: userMsg.content.slice(0, 800) },
            { role: 'assistant', content: (assistantMsg.content || '').slice(0, 800) },
            { role: 'user', content: 'Generate the title now.' },
          ],
          max_tokens: 30,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        // Silent — this is best-effort
        return;
      }

      const json = await res.json();
      const raw = json.choices?.[0]?.message?.content || '';
      const title = String(raw)
        .trim()
        .replace(/^["'`]|["'`]$/g, '')
        .replace(/[.!?]+$/, '')
        .replace(/\n/g, ' ')
        .slice(0, 60);

      if (!title || title.length < 3) return;

      // Apply
      chat.title = title;
      chat.updatedAt = new Date().toISOString();
      window.__nexus.persistChats();
      window.__nexus.renderChatList();

      // Re-sync if this chat is active
      if (window.__nexus.state.activeChatId === chat.id) {
        window.__nexus.renderActiveChat();
      }
    } catch (err) {
      // Silent — best-effort
      console.debug('Auto-title skipped:', err.message);
    } finally {
      // Clean up indicator
      const chatItem = document.querySelector(`.chat-list-item[data-chat-id="${chat.id}"]`);
      if (chatItem) chatItem.classList.remove('nx-title-generating');
    }
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

  function formatCompact(n) {
    if (n < 1000) return String(n);
    if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return (n / 1000000).toFixed(2) + 'M';
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Metrics = {
    getChatStats: (chatId) => {
      const chat = window.__nexus.state.chats.find(c => c.id === chatId);
      if (!chat) return null;
      let prompt = 0, completion = 0, total = 0, msgs = 0, latencySum = 0, latencyCount = 0;
      for (const m of chat.messages) {
        if (m.role === 'assistant') {
          msgs++;
          if (m.usage) {
            prompt += m.usage.prompt_tokens || 0;
            completion += m.usage.completion_tokens || 0;
            total += m.usage.total_tokens || (
              (m.usage.prompt_tokens || 0) + (m.usage.completion_tokens || 0)
            );
          }
          if (m._latency) {
            latencySum += m._latency;
            latencyCount++;
          }
        }
      }
      return {
        assistantMessages: msgs,
        promptTokens: prompt,
        completionTokens: completion,
        totalTokens: total,
        avgLatencyMs: latencyCount ? Math.round(latencySum / latencyCount) : null,
      };
    },
    getGlobalStats: () => {
      let chats = window.__nexus.state.chats.length;
      let messages = 0, totalTokens = 0, assistantMsgs = 0;
      for (const chat of window.__nexus.state.chats) {
        messages += chat.messages.length;
        for (const m of chat.messages) {
          if (m.role === 'assistant') {
            assistantMsgs++;
            if (m.usage) {
              totalTokens += m.usage.total_tokens || (
                (m.usage.prompt_tokens || 0) + (m.usage.completion_tokens || 0)
              );
            }
          }
        }
      }
      return {
        chats,
        messages,
        assistantMessages: assistantMsgs,
        totalTokens,
      };
    },
    generateTitle: async (chatId) => {
      const chat = window.__nexus.state.chats.find(c => c.id === chatId);
      if (!chat) return null;
      try { localStorage.removeItem(TITLE_TRIED_PREFIX + chat.id); } catch (e) {}
      await autoTitleIfNeeded(chat);
      return chat.title;
    },
    stopGeneration: () => {
      const ctrl = window.__nexus.state.abortController;
      if (ctrl) {
        try { ctrl.abort(); return true; } catch (e) { return false; }
      }
      return false;
    },
  };
})();
