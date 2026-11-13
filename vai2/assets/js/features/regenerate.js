/* ============================================================
   NEXUS CHAT — REGENERATE & CONTINUE
   - "Continue" button for truncated assistant responses
   - Auto-summarize for chats exceeding 75% context
   - Track and store summaries per chat

   Public API:
     window.Nexus.Regenerate.continueFrom(chatId, messageIndex)
     window.Nexus.Regenerate.continueCurrent()
     window.Nexus.Regenerate.summarizeChat(chatId)
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_regenerate_loaded__) return;
  window.__nexus_regenerate_loaded__ = true;

  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-regen-styles')) return;
    const css = `
.nx-continue-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}
.message:hover .nx-continue-row { opacity: 1; }
.nx-continue-btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--warning);
  background: rgba(253, 203, 110, 0.1);
  color: var(--warning);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nx-continue-btn:hover {
  background: var(--warning);
  color: var(--bg-primary);
  box-shadow: 0 0 12px rgba(253, 203, 110, 0.4);
}
.nx-continue-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nx-continue-note {
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.nx-summary-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(253, 203, 110, 0.08);
  border: 1px solid rgba(253, 203, 110, 0.3);
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--warning);
  line-height: 1.5;
}
.nx-summary-banner .msg { flex: 1; }
.nx-summary-banner button {
  padding: 4px 12px;
  border-radius: 5px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.nx-summary-banner button:hover {
  background: currentColor;
  color: var(--bg-primary);
}

.nx-summary-marker {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  margin: 12px auto;
  max-width: 500px;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-strong);
  border-radius: 100px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  cursor: help;
}
.nx-summary-marker .icon { color: var(--accent-secondary); }
`;
    const style = document.createElement('style');
    style.id = 'nx-regen-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     CONTINUE
     ============================================================ */
  function shouldShowContinue(msg) {
    if (!msg || msg.role !== 'assistant') return false;
    if (msg.error) return false;
    if (msg.streaming) return false;
    if (msg.finish_reason !== 'length') return false;
    return true;
  }

  async function continueFrom(chatId, messageIndex) {
    const state = window.__nexus.state;
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return false;
    const msg = chat.messages[messageIndex];
    if (!msg || msg.role !== 'assistant') return false;

    const model = state.activeModel;
    if (!model) {
      window.__nexus.showToast('No active model', 'error', 2500);
      return false;
    }

    // Build api messages: all messages up to this one, plus a continuation hint
    const apiMessages = chat.messages
      .slice(0, messageIndex + 1)
      .map(m => ({ role: m.role, content: m.content }));

    // Append a "continue" instruction (unless already the last message said continue)
    const last = apiMessages[apiMessages.length - 1];
    if (!last || !/continue|keep going|finish|resume/i.test(last.content.slice(-100))) {
      apiMessages.push({
        role: 'user',
        content:
          'Continue exactly where you left off. Do not repeat any text already provided. ' +
          'Do not add any introduction, commentary, or transition phrase — resume mid-sentence if you were mid-sentence.',
      });
    }

    // Create a temporary continue message that appends to msg.content
    const originalContent = msg.content;
    const originalFinish = msg.finish_reason;

    // Add a UI loading state
    msg.finish_reason = 'stop'; // temporarily hide the Continue button
    msg._continuing = true;
    window.__nexus.persistChats();
    window.__nexus.renderActiveChat();

    // We can't reuse streamAssistantResponse directly because we want to append
    // rather than create a new assistant message. So we do our own request.
    const controller = new AbortController();
    const extra = window.Nexus?.Settings?.getExtraParams?.() || {};
    const sysPrompt = window.Nexus?.Settings?.getSystemPrompt?.();
    const finalMessages = sysPrompt
      ? [{ role: 'system', content: sysPrompt }, ...apiMessages]
      : apiMessages;

    const body = {
      model: model.id,
      messages: finalMessages,
      stream: true,
      ...extra,
    };

    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin || 'https://nexus-chat.local',
          'X-OpenRouter-Title': 'Nexus Chat · Continue',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let continuation = '';
      let finishReason = null;

      // Find the message DOM to update live
      const msgEl = document.querySelector(`.message[data-message-index="${messageIndex}"] .message-content`);
      const baseContent = originalContent + '\n';

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
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              continuation += delta;
              if (msgEl) {
                msgEl.classList.add('markdown-content');
                const rendered = (window.Nexus?.Markdown?.render)
                  ? window.Nexus.Markdown.render(baseContent + continuation)
                  : escapeHtml(baseContent + continuation);
                msgEl.innerHTML = rendered;
                if (window.Nexus?.Markdown?.attachCodeCopyButtons) {
                  window.Nexus.Markdown.attachCodeCopyButtons(msgEl);
                }
              }
            }
            if (chunk.choices?.[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason;
            }
          } catch (e) {}
        }
      }

      // Merge
      msg.content = originalContent + '\n' + continuation;
      msg.finish_reason = finishReason || originalFinish;
      delete msg._continuing;
      msg._continued = true;
      window.__nexus.persistChats();
      window.__nexus.renderActiveChat();
      return true;
    } catch (err) {
      msg.finish_reason = originalFinish;
      delete msg._continuing;
      window.__nexus.persistChats();
      window.__nexus.renderActiveChat();
      window.__nexus.showToast('Continue failed: ' + (err.message || err), 'error', 4000);
      return false;
    }
  }

  function continueCurrent() {
    const chat = window.__nexus.getActiveChat();
    if (!chat) return false;
    // Find last assistant message with finish_reason length
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const m = chat.messages[i];
      if (m.role === 'assistant' && shouldShowContinue(m)) {
        return continueFrom(chat.id, i);
      }
    }
    window.__nexus.showToast('No truncated response to continue', 'info', 2000);
    return false;
  }

  /* ============================================================
     SUMMARIZE
     ============================================================ */
  async function summarizeChat(chatId) {
    const state = window.__nexus.state;
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat || chat.messages.length < 4) {
      window.__nexus.showToast('Chat too short to summarize', 'info', 2500);
      return false;
    }
    const model = state.activeModel;
    if (!model) {
      window.__nexus.showToast('No active model', 'error', 2500);
      return false;
    }

    // Pick which messages to summarize — keep the last 4 intact
    const keepLast = 4;
    const toSummarize = chat.messages.slice(0, Math.max(0, chat.messages.length - keepLast));
    const toKeep = chat.messages.slice(-keepLast);

    if (toSummarize.length < 2) {
      window.__nexus.showToast('Not enough messages to summarize', 'info', 2500);
      return false;
    }

    if (!confirm(
      `Summarize the first ${toSummarize.length} messages?\n\n` +
      `This will replace them with a single summary block. ` +
      `The last ${keepLast} messages remain untouched.\n\n` +
      `You can undo this with Ctrl+Z within the same session... just kidding. ` +
      `This action cannot be undone — a backup file is recommended.`
    )) return;

    window.__nexus.showToast('Summarizing…', 'info', 2500);

    const transcript = toSummarize
      .map(m => `[${m.role}]: ${m.content}`)
      .join('\n\n');

    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin || 'https://nexus-chat.local',
          'X-OpenRouter-Title': 'Nexus Chat · Summarize',
        },
        body: JSON.stringify({
          model: model.id,
          messages: [
            {
              role: 'system',
              content:
                'You are a concise conversation summarizer. Given a chat transcript, produce a factual summary in under 300 words. ' +
                'Preserve: the user’s goals, any decisions made, key facts stated, and open questions. ' +
                'Omit pleasantries and meta-commentary. Output plain prose only — no headings, no bullet lists, no preamble.',
            },
            { role: 'user', content: transcript },
          ],
          temperature: 0.3,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const summary = String(json.choices?.[0]?.message?.content || '').trim();
      if (!summary) throw new Error('Empty summary');

      // Replace the summarized messages with a marker + summary
      const summaryMsg = {
        role: 'assistant',
        content: summary,
        timestamp: new Date().toISOString(),
        model: model.id,
        _isSummary: true,
        _summarizedCount: toSummarize.length,
      };

      chat.messages = [summaryMsg, ...toKeep];
      chat.updatedAt = new Date().toISOString();
      chat._summarizedAt = new Date().toISOString();
      window.__nexus.persistChats();
      window.__nexus.renderActiveChat();
      window.__nexus.showToast(`Summarized ${toSummarize.length} messages into a short block`, 'success', 3500);
      return true;
    } catch (err) {
      window.__nexus.showToast('Summarize failed: ' + (err.message || err), 'error', 4000);
      return false;
    }
  }

  /* ============================================================
     CONTEXT WARNING
     ============================================================ */
  function checkContextWarning(chat) {
    if (!chat || !window.__nexus.state.activeModel) return;
    if (chat._summarizeDeclinedAt && Date.now() - chat._summarizeDeclinedAt < 5 * 60 * 1000) return;

    const max = window.__nexus.state.activeModel.context_length || 0;
    if (max < 4000) return;
    const est = chat.messages.reduce((sum, m) => {
      const text = m.content || '';
      const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
      return sum + Math.ceil((text.length - cjk) / 4) + cjk + 4;
    }, 0);
    const pct = (est / max) * 100;

    if (pct < 75) return;
    if (document.getElementById('nxSummaryBanner')) return;
    if (chat.messages.length < 6) return;

    const wrap = document.getElementById('chatMessagesInner');
    if (!wrap) return;

    const banner = document.createElement('div');
    banner.className = 'nx-summary-banner';
    banner.id = 'nxSummaryBanner';
    banner.innerHTML = `
      <span class="msg">
        <strong>${Math.round(pct)}% context used.</strong>
        Consider summarizing older messages to free up space.
      </span>
      <button data-act="summarize">Summarize</button>
      <button data-act="dismiss" style="opacity:0.6;">Dismiss</button>`;
    banner.querySelector('[data-act="summarize"]').addEventListener('click', () => {
      banner.remove();
      summarizeChat(chat.id);
    });
    banner.querySelector('[data-act="dismiss"]').addEventListener('click', () => {
      chat._summarizeDeclinedAt = Date.now();
      window.__nexus.persistChats();
      banner.remove();
    });

    // Insert above the messages
    wrap.insertBefore(banner, wrap.firstChild);
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

    if (!window.__nexus.hooks) return;

    // Decorate truncated messages with a Continue button + summary marker
    if (Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg, index, chat) => {
        // Summary marker
        if (msg._isSummary && !wrapper.querySelector('.nx-summary-marker')) {
          const body = wrapper.querySelector('.message-body');
          if (body) {
            const marker = document.createElement('div');
            marker.className = 'nx-summary-marker';
            marker.title = `Summarized ${msg._summarizedCount || 'some'} earlier messages.`;
            marker.innerHTML = `<span class="icon">≋</span> Earlier messages summarized`;
            body.insertBefore(marker, body.firstChild);
          }
        }

        // Continue button for truncated messages
        if (shouldShowContinue(msg) && !wrapper.querySelector('.nx-continue-row')) {
          const body = wrapper.querySelector('.message-body');
          if (body) {
            const row = document.createElement('div');
            row.className = 'nx-continue-row';
            row.innerHTML = `
              <button class="nx-continue-btn" type="button" title="Continue generating where it left off">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 3l10 5-10 5V3z"/>
                </svg>
                Continue
              </button>
              <span class="nx-continue-note">hit token limit</span>`;
            row.querySelector('.nx-continue-btn').addEventListener('click', async (e) => {
              e.currentTarget.disabled = true;
              e.currentTarget.textContent = 'Continuing…';
              await continueFrom(chat.id, index);
            });
            body.appendChild(row);
          }
        }
      });
    }

    // Context warning after each chat render
    if (Array.isArray(window.__nexus.hooks.afterActiveChatRender)) {
      window.__nexus.hooks.afterActiveChatRender.push((chat) => {
        setTimeout(() => checkContextWarning(chat), 250);
      });
    }
  });

  function escapeHtml(s) {
    if (window.__nexus && window.__nexus.escapeHtml) return window.__nexus.escapeHtml(s);
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  window.Nexus = window.Nexus || {};
  window.Nexus.Regenerate = {
    continueFrom,
    continueCurrent,
    summarizeChat,
    shouldShowContinue,
  };
})();
