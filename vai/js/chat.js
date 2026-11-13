import { store } from './store.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import {
  $, $$, escapeHtml, escapeAttr, formatTime, formatDateTime,
  autoResize, copyToClipboard, isNearBottom, scrollToBottom,
  debounce, formatNumber, truncate
} from './utils.js';
import { renderMarkdown } from './markdown.js';
import { streamChat, OpenRouterError } from './openrouter.js';
import { contextReport } from './tokens.js';
import { openModal } from './modal.js';
import { switchView } from './app.js';

let models = new Map();
let abortCtrl = null;
let isStreaming = false;
let currentStreamingMsgId = null;
let bound = false;

const SUGGESTIONS = [
  { title: 'Explain quantum entanglement', desc: 'Simple analogy plus technical details.' },
  { title: 'Write a Python web scraper', desc: 'Using requests and BeautifulSoup.' },
  { title: 'Review my code for bugs', desc: 'Paste a snippet — I\'ll audit it.' },
  { title: 'Plan a 3-day trip to Kyoto', desc: 'Food, culture, and hidden spots.' }
];

export function setModelsContext(m) {
  models = m instanceof Map ? m : new Map();
}

function modelLabel(id) {
  if (!id) return 'unknown';
  if (id === 'openrouter/free') return 'OpenRouter Auto · free';
  const m = models.get(id);
  return m?.label || id;
}

function getContextLimit(modelId) {
  if (!modelId || modelId === 'openrouter/free') return 0;
  const m = models.get(modelId);
  if (!m) return 0;
  return parseInt(m.context, 10) || 0;
}

function extractProvider(e) {
  if (!e) return null;
  if (e.provider) return e.provider;
  if (e.parsed?.error?.metadata?.provider_name) return e.parsed.error.metadata.provider_name;
  if (e.parsed?.provider) return e.parsed.provider;
  return null;
}

function extractRawMessage(e) {
  if (!e) return null;
  if (e.parsed?.error?.message) return e.parsed.error.message;
  if (e.parsed?.message) return e.parsed.message;
  if (e.body && typeof e.body === 'string') {
    try {
      const j = JSON.parse(e.body);
      return j?.error?.message || j?.message || null;
    } catch { return e.body.slice(0, 400); }
  }
  return null;
}

export function renderChatView(container, modelsById) {
  models = modelsById instanceof Map ? modelsById : new Map();

  const chat = store.getActiveChat();
  const settings = store.getSettings();

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <button class="btn btn-ghost btn-icon btn-sm mobile-menu-btn" data-action="open-sidebar" title="Menu">
          ${icon('menu')}
        </button>
        <div style="min-width:0;flex:1">
          <div class="topbar-title">${escapeHtml(chat?.title || 'New chat')}</div>
          <div class="topbar-meta" id="topbar-meta">
            ${chat ? `${chat.messages.length} message${chat.messages.length === 1 ? '' : 's'}` : 'Ready'}
          </div>
        </div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-ghost btn-icon btn-sm" data-action="open-models" title="Models">
          ${icon('layers')}
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" data-action="open-settings" title="Settings">
          ${icon('settings')}
        </button>
      </div>
    </header>

    <div class="content-area">
      <div class="chat-scroll" id="chat-scroll">
        <div class="chat-inner" id="chat-inner">
          ${chat && chat.messages.length ? '' : renderWelcome()}
        </div>
      </div>
      <button class="scroll-bottom-btn" id="scroll-bottom-btn" title="Scroll to bottom">
        ${icon('arrowDown')}
      </button>
    </div>

    <div class="composer-wrap">
      <div class="composer-inner">
        <div class="composer-box" id="composer-box">
          <textarea class="composer-textarea" id="composer-input" placeholder="Message ${escapeAttr(modelLabel(chat?.model || settings.defaultModel))}…" rows="1"></textarea>
          <div class="composer-toolbar">
            <button class="model-quick-pick" id="model-quick-pick" type="button">
              <span class="dot"></span>
              <span class="name">${escapeHtml(modelLabel(chat?.model || settings.defaultModel))}</span>
              ${icon('chevronDown', 'icon-sm')}
            </button>
            <div class="spacer"></div>
            <div class="context-bar" id="context-bar">
              <span class="context-bar-label" id="context-bar-label">0 tok</span>
              <div class="context-bar-track">
                <div class="context-bar-fill" id="context-bar-fill" style="width:0%"></div>
              </div>
            </div>
            <button class="btn btn-icon btn-sm" id="stop-btn" title="Stop" style="display:none">
              ${icon('stop')}
            </button>
            <button class="btn btn-primary btn-icon btn-sm" id="send-btn" title="Send (Enter)">
              ${icon('send')}
            </button>
          </div>
        </div>
        <div class="dim" style="font-size:11px;text-align:center;padding:0 4px">
          Enter to send · Shift+Enter for newline · Ctrl/⌘+K to focus
        </div>
      </div>
    </div>
  `;

  if (chat && chat.messages.length) {
    renderMessages(container);
  }

  requestAnimationFrame(() => {
    const scroll = container.querySelector('#chat-scroll');
    if (scroll) scrollToBottom(scroll, false);
    updateContextBar(container);
  });
}

function renderWelcome() {
  return `
    <div class="welcome-hero">
      <div class="welcome-orb">${icon('sparkles', 'icon-lg')}</div>
      <div class="welcome-title">How can I help you?</div>
      <div class="welcome-sub">Ask anything — coding, writing, analysis, planning. Choose a model any time.</div>
      <div class="suggestions-grid">
        ${SUGGESTIONS.map(s => `
          <button class="suggestion-card" data-suggestion="${escapeAttr(s.title)}">
            <div class="suggestion-title">${escapeHtml(s.title)}</div>
            <div class="suggestion-desc">${escapeHtml(s.desc)}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderMessages(container) {
  const chat = store.getActiveChat();
  if (!chat) return;
  const inner = container.querySelector('#chat-inner');
  if (!inner) return;
  inner.innerHTML = chat.messages.map(m => renderMessageHtml(m, chat)).join('');
  bindMessageActions(container);
  requestAnimationFrame(() => {
    const scroll = container.querySelector('#chat-scroll');
    if (scroll) scrollToBottom(scroll, false);
  });
}

function renderMessageHtml(m, chat) {
  const isUser = m.role === 'user';
  const avatar = isUser
    ? `<div class="msg-avatar">${icon('user', 'icon-sm')}</div>`
    : `<div class="msg-avatar">${icon('bot', 'icon-sm')}</div>`;

  if (m.error) {
    const provider = m.errorDetail?.provider ? `<div class="dim" style="font-size:11px;margin-top:6px">provider: <span class="mono">${escapeHtml(m.errorDetail.provider)}</span></div>` : '';
    const status = m.errorDetail?.status ? `<span class="mono" style="font-size:11px">HTTP ${escapeHtml(String(m.errorDetail.status))}</span>` : '';
    const body = m.errorDetail?.body
      ? `<pre>${escapeHtml(truncate(String(m.errorDetail.body), 1200))}</pre>`
      : '';
    return `
      <div class="msg assistant" data-msg-id="${m.id}">
        ${avatar}
        <div class="msg-body">
          <div class="msg-meta">
            <span class="msg-author">Assistant</span>
            <span class="msg-time">${formatTime(m.createdAt)}</span>
            ${status ? `<span class="msg-model-badge">${status}</span>` : ''}
          </div>
          <div class="msg-error">
            <div class="msg-error-title">${icon('xCircle', 'icon-sm')} Request failed</div>
            <div>${escapeHtml(m.error)}</div>
            ${provider}
            ${body}
          </div>
          <div class="msg-actions">
            <button class="msg-action-btn" data-action="retry" data-id="${m.id}" title="Retry">
              ${icon('refresh', 'icon-sm')}
            </button>
            <button class="msg-action-btn danger" data-action="delete-msg" data-id="${m.id}" title="Delete">
              ${icon('trash', 'icon-sm')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const content = isUser
    ? escapeHtml(m.content).replace(/\n/g, '<br>')
    : renderMarkdown(m.content) + (m.pending ? '<span class="streaming-cursor"></span>' : '');

  const usedModelBadge = (!isUser && m.model)
    ? `<span class="msg-model-badge" title="Model used">${escapeHtml(modelLabel(m.model))}</span>`
    : '';

  const warning = m.warning ? `<div class="msg-warning">${escapeHtml(m.warning)}</div>` : '';

  return `
    <div class="msg ${isUser ? 'user' : 'assistant'}" data-msg-id="${m.id}">
      ${avatar}
      <div class="msg-body">
        <div class="msg-meta">
          <span class="msg-author">${isUser ? 'You' : 'Assistant'}</span>
          <span class="msg-time">${formatTime(m.createdAt)}</span>
          ${usedModelBadge}
        </div>
        <div class="bubble">${content}</div>
        ${warning}
        <div class="msg-actions">
          ${isUser ? `
            <button class="msg-action-btn" data-action="edit" data-id="${m.id}" title="Edit & resend">
              ${icon('edit', 'icon-sm')}
            </button>
          ` : `
            <button class="msg-action-btn" data-action="regenerate" data-id="${m.id}" title="Regenerate">
              ${icon('refresh', 'icon-sm')}
            </button>
          `}
          <button class="msg-action-btn" data-action="copy" data-id="${m.id}" title="Copy">
            ${icon('copy', 'icon-sm')}
          </button>
          <button class="msg-action-btn danger" data-action="delete-msg" data-id="${m.id}" title="Delete">
            ${icon('trash', 'icon-sm')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindMessageActions(container) {
  const inner = container.querySelector('#chat-inner');
  if (!inner) return;

  inner.addEventListener('click', async (e) => {
    const copyCode = e.target.closest('[data-copy]');
    if (copyCode) {
      const pre = copyCode.closest('pre');
      const code = pre?.querySelector('code')?.textContent || '';
      const ok = await copyToClipboard(code);
      if (ok) {
        copyCode.textContent = 'Copied!';
        setTimeout(() => { copyCode.textContent = 'Copy'; }, 1400);
      }
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const id = actionEl.getAttribute('data-id');
    const action = actionEl.getAttribute('data-action');
    const chat = store.getActiveChat();
    if (!chat) return;
    const msg = chat.messages.find(m => m.id === id);
    if (!msg) return;

    if (action === 'copy') {
      const ok = await copyToClipboard(msg.content || '');
      toast({ type: ok ? 'success' : 'error', title: ok ? 'Copied' : 'Copy failed', duration: 1500 });
    }
    if (action === 'delete-msg') {
      store.deleteMessage(chat.id, msg.id);
      renderMessages(container);
      updateContextBar(container);
    }
    if (action === 'edit') {
      startEditMessage(container, msg);
    }
    if (action === 'regenerate') {
      regenerateFrom(container, msg.id);
    }
    if (action === 'retry') {
      const idx = chat.messages.findIndex(x => x.id === msg.id);
      if (idx < 0) return;
      const userMsg = [...chat.messages.slice(0, idx)].reverse().find(x => x.role === 'user');
      if (!userMsg) return;
      store.truncateAfter(chat.id, userMsg.id);
      renderMessages(container);
      sendTurn(container, userMsg.content, { skipAddUser: true });
    }
  });
}

function startEditMessage(container, msg) {
  const chat = store.getActiveChat();
  if (!chat) return;
  const node = container.querySelector(`[data-msg-id="${msg.id}"]`);
  if (!node) return;

  const body = node.querySelector('.msg-body');
  const originalHTML = body.innerHTML;

  const editWrap = document.createElement('div');
  editWrap.className = 'msg-edit';
  editWrap.innerHTML = `
    <textarea>${escapeHtml(msg.content)}</textarea>
    <div class="msg-edit-actions">
      <button class="btn btn-sm btn-ghost" data-cancel>Cancel</button>
      <button class="btn btn-sm btn-primary" data-save>Resend</button>
    </div>
  `;

  body.innerHTML = '';
  body.appendChild(editWrap);
  const ta = editWrap.querySelector('textarea');
  autoResize(ta, 400);
  ta.addEventListener('input', () => autoResize(ta, 400));
  setTimeout(() => {
    ta.focus();
    ta.selectionStart = ta.selectionEnd = ta.value.length;
  }, 30);

  const cancel = () => { body.innerHTML = originalHTML; };

  editWrap.querySelector('[data-cancel]').addEventListener('click', cancel);
  editWrap.querySelector('[data-save]').addEventListener('click', () => {
    const newText = ta.value.trim();
    if (!newText) return cancel();
    if (newText === msg.content) return cancel();

    // Truncate everything after this user message and replace
    const idx = chat.messages.findIndex(m => m.id === msg.id);
    if (idx < 0) return cancel();
    chat.messages = chat.messages.slice(0, idx);
    chat.updatedAt = Date.now();
    store.updateMessage(chat.id, msg.id, { content: newText });
    // NOTE: updateMessage won't fire after slice; instead do it manually
    chat.messages.push({
      ...msg,
      content: newText,
      createdAt: Date.now()
    });
    store.emit();

    renderMessages(container);
    sendTurn(container, newText, { skipAddUser: true });
  });

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      editWrap.querySelector('[data-save]').click();
    }
  });
}

function regenerateFrom(container, msgId) {
  const chat = store.getActiveChat();
  if (!chat) return;
  const idx = chat.messages.findIndex(m => m.id === msgId);
  if (idx < 0) return;

  // Truncate this assistant message and everything after
  chat.messages = chat.messages.slice(0, idx);
  chat.updatedAt = Date.now();
  store.emit();
  renderMessages(container);

  // Find last user message
  const userMsg = [...chat.messages].reverse().find(m => m.role === 'user');
  if (!userMsg) return;
  sendTurn(container, userMsg.content, { skipAddUser: true });
}

function updateContextBar(container) {
  const chat = store.getActiveChat();
  if (!chat) return;
  const modelId = chat.model || store.getSettings().defaultModel;
  const limit = getContextLimit(modelId);
  const messagesForApi = buildApiMessages(chat);
  const report = contextReport(messagesForApi, limit);

  const label = container.querySelector('#context-bar-label');
  const fill = container.querySelector('#context-bar-fill');
  const bar = container.querySelector('#context-bar');
  if (!label || !fill) return;

  if (limit > 0) {
    label.textContent = `${formatNumber(report.used)} / ${formatNumber(limit)} tok`;
    fill.style.width = `${Math.min(100, report.pct)}%`;
    fill.classList.toggle('warn', report.pct >= 80);
  } else {
    label.textContent = `${formatNumber(report.used)} tok`;
    fill.style.width = '8%';
    fill.classList.remove('warn');
  }
  if (bar) bar.title = limit > 0
    ? `Context: ~${report.used} tokens used of ${limit} (${report.pct.toFixed(1)}%). Remaining: ${report.remaining}.`
    : `Estimated ~${report.used} tokens. Context limit unknown for this model.`;
}

export function bindChatEvents() {
  if (bound) {
    // rebind on new DOM
    bound = false;
  }
  bound = true;

  const container = document.getElementById('main-area');
  if (!container) return;

  const input = container.querySelector('#composer-input');
  const sendBtn = container.querySelector('#send-btn');
  const stopBtn = container.querySelector('#stop-btn');
  const composerBox = container.querySelector('#composer-box');
  const scroll = container.querySelector('#chat-scroll');
  const scrollBottomBtn = container.querySelector('#scroll-bottom-btn');
  const quickPick = container.querySelector('#model-quick-pick');

  container.querySelector('[data-action="open-sidebar"]')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebar-overlay')?.classList.add('visible');
  });
  container.querySelector('[data-action="open-models"]')?.addEventListener('click', () => {
    switchView('models');
  });
  container.querySelector('[data-action="open-settings"]')?.addEventListener('click', async () => {
    const { openSettingsModal } = await import('./settings.js');
    openSettingsModal({
      models: Array.from(models.values()),
      onSaved: () => {
        renderChatView(container, models);
        bindChatEvents();
      }
    });
  });

  if (input) {
    input.addEventListener('focus', () => composerBox?.classList.add('focused'));
    input.addEventListener('blur', () => composerBox?.classList.remove('focused'));
    input.addEventListener('input', () => autoResize(input, 280));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        sendBtn?.click();
      }
    });
  }

  sendBtn?.addEventListener('click', () => {
    if (isStreaming) return;
    const text = (input?.value || '').trim();
    if (!text) return;
    input.value = '';
    autoResize(input, 280);
    sendTurn(container, text);
  });

  stopBtn?.addEventListener('click', () => {
    if (abortCtrl) abortCtrl.abort();
  });

  quickPick?.addEventListener('click', () => openModelPicker(container));

  container.querySelectorAll('[data-suggestion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-suggestion');
      if (input) {
        input.value = text;
        autoResize(input, 280);
        input.focus();
      }
    });
  });

  scroll?.addEventListener('scroll', () => {
    if (!scrollBottomBtn) return;
    if (isNearBottom(scroll, 200)) {
      scrollBottomBtn.classList.remove('visible');
    } else {
      scrollBottomBtn.classList.add('visible');
    }
  });

  scrollBottomBtn?.addEventListener('click', () => {
    if (scroll) scrollToBottom(scroll, true);
  });

  requestAnimationFrame(() => updateContextBar(container));
}

function openModelPicker(container) {
  const chat = store.getActiveChat();
  const currentId = chat?.model || store.getSettings().defaultModel;
  const freeModels = Array.from(models.values()).filter(m => m.is_free !== false);
  freeModels.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="models-search" style="margin-bottom:10px">
      <span class="models-search-icon">${icon('search', 'icon-sm')}</span>
      <input type="text" class="input" id="picker-search" placeholder="Search models…">
    </div>
    <div class="modal-models-list" id="picker-list">
      <div class="modal-model-row ${currentId === 'openrouter/free' ? 'selected' : ''}" data-id="openrouter/free">
        <span style="color:var(--accent)">${icon('sparkles', 'icon-sm')}</span>
        <span class="modal-model-row-name">OpenRouter Auto · free</span>
        <span class="badge badge-free">AUTO</span>
      </div>
      ${freeModels.map(m => `
        <div class="modal-model-row ${currentId === m.id ? 'selected' : ''}" data-id="${escapeAttr(m.id)}">
          <span class="mono dim" style="font-size:10px;flex-shrink:0">${formatNumber(parseInt(m.context, 10) || 0)}</span>
          <span class="modal-model-row-name" title="${escapeAttr(m.id)}">${escapeHtml(m.label || m.id)}</span>
        </div>
      `).join('')}
    </div>
  `;

  const modal = openModal({
    title: 'Switch model for this chat',
    body,
    size: 'wide',
    footer: `<button class="btn btn-ghost" data-close>Close</button>`
  });

  modal.footer?.querySelector('[data-close]')?.addEventListener('click', () => modal.close());

  const listEl = body.querySelector('#picker-list');
  const searchEl = body.querySelector('#picker-search');

  searchEl?.addEventListener('input', () => {
    const q = searchEl.value.toLowerCase().trim();
    listEl.querySelectorAll('.modal-model-row').forEach(row => {
      const id = row.getAttribute('data-id') || '';
      row.style.display = q && !id.toLowerCase().includes(q) ? 'none' : '';
    });
  });

  listEl.addEventListener('click', (e) => {
    const row = e.target.closest('.modal-model-row');
    if (!row) return;
    const id = row.getAttribute('data-id');
    const c = store.getActiveChat();
    if (c) {
      store.updateChat(c.id, { model: id, usedModel: null });
    } else {
      store.updateSettings({ defaultModel: id });
    }
    modal.close();
    renderChatView(container, models);
    bindChatEvents();
    toast({ type: 'success', title: 'Model switched', message: modelLabel(id), duration: 2000 });
  });

  setTimeout(() => searchEl?.focus(), 100);
}

function buildApiMessages(chat) {
  const api = [];
  for (const m of chat.messages) {
    if (m.error) continue;
    if (m.pending && !m.content) continue;
    if (!m.content) continue;
    api.push({ role: m.role, content: m.content });
  }
  return api;
}

async function sendTurn(container, userText, opts = {}) {
  if (isStreaming) return;
  const chat = store.getActiveChat();
  if (!chat) {
    toast({ type: 'warning', title: 'No active chat' });
    return;
  }

  const settings = store.getSettings();
  if (!settings.apiKey) {
    toast({
      type: 'error',
      title: 'Missing API key',
      message: 'Open Settings and paste your OpenRouter API key.',
      duration: 6500,
      actions: [{
        label: 'Open Settings',
        onClick: async () => {
          const { openSettingsModal } = await import('./settings.js');
          openSettingsModal({
            models: Array.from(models.values()),
            onSaved: () => { renderChatView(container, models); bindChatEvents(); }
          });
        }
      }]
    });
    return;
  }

  const userMsg = opts.skipAddUser
    ? chat.messages[chat.messages.length - 1]
    : store.addMessage(chat.id, { role: 'user', content: userText });

  // Build the API payload
  const apiMessages = buildApiMessages(chat);
  if (!apiMessages.length || apiMessages[apiMessages.length - 1]?.role !== 'user') {
    if (!opts.skipAddUser) {
      apiMessages.push({ role: 'user', content: userText });
    }
  }

  const modelId = chat.model || settings.defaultModel;
  const limit = getContextLimit(modelId);
  const report = contextReport(apiMessages, limit);

  if (limit > 0 && report.over) {
    toast({
      type: 'error',
      title: 'Context limit exceeded',
      message: `~${report.used} tokens vs limit ${limit}. Delete or edit messages, or switch to a larger model.`,
      duration: 8000
    });
    return;
  }

  // Add placeholder assistant message
  const assistantMsg = store.addMessage(chat.id, {
    role: 'assistant',
    content: '',
    pending: true,
    model: modelId === 'openrouter/free' ? null : modelId
  });
  currentStreamingMsgId = assistantMsg.id;

  renderMessages(container);
  updateContextBar(container);
  setStreaming(container, true);
  const scroll = container.querySelector('#chat-scroll');
  if (scroll) scrollToBottom(scroll, true);

  // Prepare abort
  abortCtrl = new AbortController();
  const signal = abortCtrl.signal;

  let accumulated = '';
  let resolvedModel = null;

  const flushRender = debounce(() => {
    const node = container.querySelector(`[data-msg-id="${assistantMsg.id}"] .bubble`);
    if (!node) return;
    node.innerHTML = renderMarkdown(accumulated) + '<span class="streaming-cursor"></span>';
    const chatScroll = container.querySelector('#chat-scroll');
    if (chatScroll && isNearBottom(chatScroll, 220)) {
      chatScroll.scrollTop = chatScroll.scrollHeight;
    }
  }, 55);

  try {
    const generator = streamChat({
      apiKey: settings.apiKey,
      model: modelId,
      messages: apiMessages,
      temperature: chat.temperature ?? settings.temperature,
      maxTokens: chat.maxTokens ?? settings.maxTokens,
      signal,
      onModelResolved: (m) => {
        resolvedModel = m;
        store.updateMessage(chat.id, assistantMsg.id, { model: m });
      }
    });

    for await (const chunk of generator) {
      if (chunk.delta) {
        accumulated += chunk.delta;
        store.updateMessage(chat.id, assistantMsg.id, {
          content: accumulated,
          pending: true
        });
        flushRender();
      }
      if (chunk.model) {
        resolvedModel = chunk.model;
      }
    }

    store.updateMessage(chat.id, assistantMsg.id, {
      content: accumulated,
      pending: false,
      model: resolvedModel || (modelId === 'openrouter/free' ? null : modelId)
    });

    // If openrouter/free and we resolved a specific model, note it on the chat
    if (modelId === 'openrouter/free' && resolvedModel) {
      store.updateChat(chat.id, { usedModel: resolvedModel });
    }

    renderMessages(container);
    updateContextBar(container);

    if (!accumulated.trim()) {
      store.updateMessage(chat.id, assistantMsg.id, {
        content: '',
        pending: false,
        error: 'Empty response received from the provider.',
        errorDetail: { provider: resolvedModel || null }
      });
      renderMessages(container);
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      store.updateMessage(chat.id, assistantMsg.id, {
        content: accumulated || '(stopped)',
        pending: false,
        model: resolvedModel
      });
      renderMessages(container);
      toast({ type: 'info', title: 'Generation stopped', duration: 2000 });
    } else {
      const provider = extractProvider(err);
      const raw = extractRawMessage(err);
      const isOpenRouterError = err instanceof OpenRouterError;

      let displayMsg = raw || err?.message || 'Unknown error';
      if (isOpenRouterError && err.status) {
        displayMsg = `${displayMsg}`;
      }

      store.updateMessage(chat.id, assistantMsg.id, {
        content: accumulated,
        pending: false,
        error: displayMsg,
        errorDetail: {
          provider,
          status: err?.status ?? null,
          stage: err?.stage ?? null,
          body: err?.body ?? (err?.parsed ? JSON.stringify(err.parsed, null, 2) : null)
        }
      });
      renderMessages(container);
      toast({
        type: 'error',
        title: 'API error',
        message: provider ? `${displayMsg} · ${provider}` : displayMsg,
        duration: 9000
      });
      console.error('[stream]', err);
    }
  } finally {
    isStreaming = false;
    currentStreamingMsgId = null;
    abortCtrl = null;
    setStreaming(container, false);
    updateContextBar(container);
    if (scroll && isNearBottom(scroll, 260)) scrollToBottom(scroll, true);
  }
}

function setStreaming(container, on) {
  isStreaming = on;
  const sendBtn = container.querySelector('#send-btn');
  const stopBtn = container.querySelector('#stop-btn');
  const input = container.querySelector('#composer-input');
  if (sendBtn) sendBtn.style.display = on ? 'none' : '';
  if (stopBtn) stopBtn.style.display = on ? '' : 'none';
  if (input) input.placeholder = on
    ? 'Generating…'
    : `Message ${modelLabel(store.getActiveChat()?.model || store.getSettings().defaultModel)}…`;
}
