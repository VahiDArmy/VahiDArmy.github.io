import { AUTO_MODEL, LS } from '../lib/config.js';
import * as db from '../lib/db.js';
import { state, emit, on, rememberLeaf } from '../lib/state.js';
import { buildRequestBody, streamChat } from '../lib/openrouter.js';
import { renderMarkdown, enhanceMarkdown } from '../lib/markdown.js';
import { icon } from '../lib/icons.js';
import { t, getLocale } from '../lib/i18n.js';
import {
  escapeHtml,
  formatTime,
  formatNum,
  formatDateTime,
  clip,
  download,
  safeFilename,
  copyText,
  prettyModel,
  initials,
} from '../lib/utils.js';
import { action } from './actions.js';
import { toast, toastError } from './toast.js';
import { openModal, closeModal, confirmDialog, openMenu } from './overlay.js';
import { renderTopbar, renderSidebar } from './shell.js';
import { effectiveModelId, modelLabel, openModelPicker, syncFreeModels } from './models.js';
import { openInspector, openRequestPreview } from './inspector.js';
import {
  updateComposer,
  clearComposer,
  getDraft,
  getAttachments,
  setDraft,
  focusComposer,
  resetComposer,
} from './composer.js';
import { openSettings } from './settings.js';
import { updateSettings } from '../lib/prefs.js';

const threadEl = () => document.getElementById('thread');
const viewportEl = () => document.getElementById('viewport');
const byCreatedAsc = (a, b) => new Date(a.created_at) - new Date(b.created_at);

let autoScroll = true;
let sending = false;
let lastLocale = getLocale();

/* ------------------------------- bootstrap -------------------------------- */

export function initChat() {
  window.addEventListener('composer:send', (event) => handleSend(event.detail));
  window.addEventListener('composer:stop', () => stopStreaming());
  window.addEventListener('composer:preview', () => previewCurrentRequest());
  window.addEventListener('composer:params', () => openChatParams());
  window.addEventListener('composer:prompts', () => emit('prompts:open'));

  on('chat:new', () => newChat());
  on('chat:open', (id) => openConversation(id));
  on('settings-changed', (settings) => {
    updateComposer();
    if (settings?.locale && settings.locale !== lastLocale) {
      lastLocale = settings.locale;
      renderChatArea();
      if (state.conversation) renderTopbar();
    }
  });

  document.addEventListener(
    'scroll',
    (event) => {
      if (event.target?.id !== 'viewport') return;
      const vp = viewportEl();
      if (!vp) return;
      autoScroll = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 180;
    },
    true,
  );

  action('new-chat', () => newChat());
  action('open-conv', (el) => openConversation(el.dataset.id));
  action('conv-menu', (el) => conversationMenu(el, el.dataset.id));
  action('topbar-menu', (el) => conversationMenu(el, state.conversation?.id));
  action('use-suggestion', (el) => {
    setDraft(el.dataset.text || '');
    focusComposer();
  });
  action('copy-message', (el) => copyMessage(el.dataset.id));
  action('edit-message', (el) => openEditModal(findMessage(el.dataset.id)));
  action('regenerate-message', (el) => regenerate(findMessage(el.dataset.id)));
  action('delete-message', (el) => deleteMessage(findMessage(el.dataset.id)));
  action('fork-message', (el) => forkFrom(findMessage(el.dataset.id)));
  action('inspect-message', (el) => {
    const message = findMessage(el.dataset.id);
    if (message) openInspector(message);
  });
  action('open-inspector-last', () => previewLastRequest());
  action('branch-step', (el) => stepBranch(el.dataset.id, Number(el.dataset.dir)));
  action('branch-map', () => openBranchMap());
  action('export-chat', (el) => exportCurrentChat(el.dataset.format || 'md'));
  action('sync-catalog', () => syncFreeModels());
  action('open-chat-params', () => openChatParams());
}

/* ------------------------------ conversation ------------------------------ */

function sortConversations() {
  state.conversations.sort(
    (a, b) =>
      Number(b.pinned || 0) - Number(a.pinned || 0) ||
      new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at),
  );
}

function findMessage(id) {
  return state.messages.find((m) => m.id === id) || null;
}

function pathTo(messageId) {
  const byId = new Map(state.messages.map((m) => [m.id, m]));
  let current = messageId ? byId.get(messageId) : null;
  const path = [];
  const guard = new Set();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    path.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : null;
  }
  return path;
}

export function activePath() {
  if (!state.messages.length) return [];
  const byId = new Map(state.messages.map((m) => [m.id, m]));
  let current = state.leafId ? byId.get(state.leafId) : null;
  if (!current) {
    const sorted = [...state.messages].sort(byCreatedAsc);
    current = sorted[sorted.length - 1];
    state.leafId = current?.id || null;
  }
  return pathTo(current?.id);
}

function pickLeaf(messages, stored) {
  if (!messages.length) return null;
  if (stored && messages.some((m) => m.id === stored)) return stored;
  const sorted = [...messages].sort(byCreatedAsc);
  return sorted[sorted.length - 1].id;
}

function childrenOf(message) {
  return state.messages.filter((m) => (m.parent_id || null) === (message.parent_id || null)).sort(byCreatedAsc);
}

function deepestLeafFrom(id) {
  let current = findMessage(id);
  const guard = new Set();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    const kids = state.messages.filter((m) => m.parent_id === current.id).sort(byCreatedAsc);
    if (!kids.length) break;
    current = kids[kids.length - 1];
  }
  return current?.id || id;
}

function setLeaf(id) {
  if (!id) return;
  state.leafId = id;
  if (state.conversation) rememberLeaf(state.conversation.id, id);
  renderThread();
  renderTopbar();
  emit('messages-changed');
}

export function renderChatArea() {
  if (!state.conversation) {
    renderWelcome();
    return;
  }
  renderThread();
}

export async function openConversation(id) {
  if (!id) return;
  if (state.streaming) stopStreaming();
  try {
    let conv = state.conversations.find((c) => c.id === id);
    if (!conv) {
      conv = await db.getConversation(id);
      if (!conv) throw new Error(t('That chat could not be found.'));
      state.conversations.unshift(conv);
    }
    state.conversation = conv;
    state.messages = [];
    state.leafId = null;
    emit('conversation-changed');

    const thread = threadEl();
    if (thread) {
      thread.innerHTML = `<div class="stack" style="gap:16px;padding-top:24px">
        <div class="skeleton" style="height:64px;width:70%"></div>
        <div class="skeleton" style="height:120px"></div>
        <div class="skeleton" style="height:64px;width:55%;margin-inline-start:auto"></div>
      </div>`;
    }

    const messages = await db.listMessages(id);
    if (state.conversation?.id !== id) return;
    state.messages = messages;
    state.leafId = pickLeaf(messages, state.leaves[id]);
    if (state.leafId) rememberLeaf(id, state.leafId);
    autoScroll = true;
    renderChatArea();
    updateComposer();
    renderSidebar();
    renderTopbar();
    emit('chat:opened', id);
    try {
      history.replaceState(null, '', `#/c/${id}`);
      localStorage.setItem(LS.lastConversation, id);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => scrollToBottom(true));
  } catch (error) {
    toastError(t('Could not open that chat'), error);
  }
}

export function newChat() {
  if (state.streaming) stopStreaming();
  state.conversation = null;
  state.messages = [];
  state.leafId = null;
  resetComposer();
  renderChatArea();
  updateComposer();
  renderSidebar();
  renderTopbar();
  try {
    history.replaceState(null, '', '#/');
    localStorage.removeItem(LS.lastConversation);
  } catch {
    /* ignore */
  }
  focusComposer();
}

/* -------------------------------- welcome -------------------------------- */

function renderWelcome() {
  const el = threadEl();
  if (!el) return;
  const hasKey = Boolean(state.profile?.openrouter_key);
  const activeCount = state.models.filter((m) => m.active !== false && m.available !== false).length;
  const firstName = (state.profile?.display_name || '').split(/\s+/)[0];

  el.innerHTML = `<div class="welcome">
    <div class="welcome-glow"></div>
    <div class="welcome-orb">${icon('spark')}</div>
    <h1 class="welcome-title">${firstName ? `${t('Welcome back')}, ${escapeHtml(firstName)}.` : t('What are we building today?')}
      <span class="grad-text">${t('Think out loud.')}</span></h1>
    <p class="welcome-sub">${t(
      'Free OpenRouter models with visible reasoning, branching conversations you can reshape at any point, and a request inspector down to the last token.',
    )}</p>
    <div class="welcome-stats">
      <span class="chip"><span class="dot"></span>${formatNum(activeCount)} ${t('free models active')}</span>
      <span class="chip">${icon('branch')}${t('Branch & edit')}</span>
      <span class="chip">${icon('brain')}${t('Streaming reasoning')}</span>
      <span class="chip">${icon('terminal')}${t('Raw request inspector')}</span>
    </div>

    ${
      !hasKey
        ? `<div class="banner" style="max-width:740px;text-align:start">
            <span>${icon('key')}</span>
            <div class="banner-body">
              <strong>${t('Add your OpenRouter key to start.')}</strong>
              ${t(
                'It is stored in your own Supabase profile row (RLS-protected) and used directly from this browser. Only free models are offered.',
              )}
              <div class="banner-actions">
                <button class="btn btn-primary btn-sm" data-action="open-settings" data-tab="api">${icon('key')} ${t(
                  'Add key',
                )}</button>
              </div>
            </div>
          </div>`
        : ''
    }
    ${
      hasKey && !state.models.length
        ? `<div class="banner" style="max-width:740px;text-align:start">
            <span>${icon('cpu')}</span>
            <div class="banner-body"><strong>${t('No models cached yet.')}</strong>
              ${t('Pull the free model catalog from OpenRouter to start chatting.')}
              <div class="banner-actions"><button class="btn btn-sm" data-action="open-model-picker">${icon(
                'refresh',
              )} ${t('Sync free models')}</button></div>
            </div>
          </div>`
        : ''
    }

    <div class="suggestions">
      <button class="suggestion" data-action="use-suggestion" data-text="Explain this codebase like a senior engineer. Walk me through the architecture, the data flow, and the three riskiest parts. Ask for the code if you need it.">
        <span class="s-ico">${icon('code')}</span>
        <span><span class="s-title">${t('Audit a codebase')}</span><span class="s-text">${t(
          'Architecture, data flow, and the riskiest corners.',
        )}</span></span>
      </button>
      <button class="suggestion" data-action="use-suggestion" data-text="این متن را ویرایش کن و به فارسی روان بازنویسی کن، اما اصطلاحات فنی را به انگلیسی نگه دار. متن: ">
        <span class="s-ico">${icon('globe')}</span>
        <span><span class="s-title">فارسی و انگلیسی</span><span class="s-text">${t(
          'Mixed-direction writing with per-paragraph RTL.',
        )}</span></span>
      </button>
      <button class="suggestion" data-action="use-suggestion" data-text="Design a Postgres schema for a multi-tenant AI chat app with branching messages. Give me the DDL, indexes, and the three queries that will hurt first.">
        <span class="s-ico">${icon('layers')}</span>
        <span><span class="s-title">${t('Design a schema')}</span><span class="s-text">${t(
          'Tables, indexes, and the queries that will hurt first.',
        )}</span></span>
      </button>
      <button class="suggestion" data-action="use-suggestion" data-text="You are a blunt, brilliant editor. Read the notes below and turn them into a launch post with a strong opening line, no clichés, and one concrete example.">
        <span class="s-ico">${icon('wand')}</span>
        <span><span class="s-title">${t('Sharpen my writing')}</span><span class="s-text">${t(
          'A blunt editor with taste, not a cheerleader.',
        )}</span></span>
      </button>
    </div>
  </div>`;
}

/* --------------------------------- thread -------------------------------- */

function renderThread() {
  const el = threadEl();
  if (!el) return;
  const path = activePath();
  if (!path.length) {
    el.innerHTML = `<div class="welcome">
      <div class="welcome-glow"></div>
      <div class="welcome-orb">${icon('spark')}</div>
      <h1 class="welcome-title">${t('This chat is empty.')}</h1>
      <p class="welcome-sub">${t('Write the first message below — or press / for the command palette.')}</p>
    </div>`;
    return;
  }

  el.innerHTML =
    path
      .map((message, index) =>
        messageHtml(message, childrenOf(message), index === path.length - 1),
      )
      .join('') + '<div class="thread-end"></div>';

  el.querySelectorAll('.md').forEach((node) => enhanceMarkdown(node));
  scrollToBottom();
}

function messageHtml(message, siblings, isLast) {
  const streaming = state.streaming?.id === message.id;
  const isUser = message.role === 'user';
  const content = streaming ? state.streaming.content : message.content || '';
  const reasoning = streaming ? state.streaming.reasoning : message.reasoning || '';
  const model = streaming ? state.streaming.actualModel || message.model : message.model;
  const requested = message.requested_model;
  const displayModel = model || (requested === AUTO_MODEL ? null : requested);
  const index = siblings.findIndex((s) => s.id === message.id) + 1;

  const modelBadge =
    !isUser && (requested || model)
      ? `<span class="msg-model" data-model-badge title="requested: ${escapeHtml(
          requested || '—',
        )} · actual: ${escapeHtml(model || 'pending')}">
          <span class="spark">✦</span>
          <span dir="ltr" data-model-name>${escapeHtml(
            displayModel ? prettyModel(displayModel) : 'auto routing…',
          )}</span>
          ${requested === AUTO_MODEL ? `<span class="badge" style="padding:0 4px;font-size:.55rem">auto</span>` : ''}
        </span>`
      : '';

  const nav =
    siblings.length > 1
      ? `<div class="msg-nav">
          <button type="button" data-action="branch-step" data-dir="-1" data-id="${message.id}" ${
            index === 1 ? 'disabled' : ''
          } aria-label="Previous branch">‹</button>
          <span class="nav-count">${index}/${siblings.length}</span>
          <button type="button" data-action="branch-step" data-dir="1" data-id="${message.id}" ${
            index === siblings.length ? 'disabled' : ''
          } aria-label="Next branch">›</button>
        </div>`
      : '';

  const reasoningBlock = !isUser
    ? `<details class="reasoning" data-reasoning ${reasoning ? '' : 'hidden'} ${
        streaming && !content ? 'open' : ''
      }>
        <summary>${icon('brain')} <span data-reasoning-label>${
          streaming && !content ? t('Thinking') : t('Reasoning')
        }</span>
          <span class="reasoning-count" data-reasoning-count>${
            reasoning ? t('{n} chars', { n: formatNum(reasoning.length) }) : ''
          }</span>
        </summary>
        <div class="reasoning-body" data-reasoning-body dir="auto">${escapeHtml(reasoning)}</div>
      </details>`
    : '';

  const bodyHtml = content
    ? renderMarkdown(content)
    : streaming
      ? '<span class="typing-dots"><i></i><i></i><i></i></span>'
      : `<span class="muted small">${t('(empty)')}</span>`;

  const errorBlock = message.error
    ? `<div class="msg-error">${escapeHtml(message.error)}</div>`
    : '';

  const stopped =
    message.status === 'stopped' && !streaming
      ? `<span class="msg-pending">${t('stopped')}</span>`
      : '';

  const actions = streaming
    ? ''
    : `<div class="msg-actions ${isLast ? 'always' : ''}">
        <button class="icon-btn tiny" data-action="copy-message" data-id="${message.id}" title="${t(
          'Copy',
        )}">${icon('copy')}</button>
        ${
          isUser
            ? `<button class="icon-btn tiny" data-action="edit-message" data-id="${
                message.id
              }" title="${t('Edit & branch')}">${icon('edit')}</button>`
            : `<button class="icon-btn tiny" data-action="regenerate-message" data-id="${
                message.id
              }" title="${t('Regenerate')}">${icon('refresh')}</button>
               <button class="icon-btn tiny" data-action="edit-message" data-id="${
                 message.id
               }" title="${t('Edit')}">${icon('edit')}</button>`
        }
        <button class="icon-btn tiny" data-action="fork-message" data-id="${
          message.id
        }" title="${t('Fork from here')}">${icon('branch')}</button>
        ${
          message.raw_request
            ? `<button class="icon-btn tiny" data-action="inspect-message" data-id="${
                message.id
              }" title="${t('View request')}">${icon('terminal')}</button>`
            : ''
        }
        <button class="icon-btn tiny" data-action="delete-message" data-id="${
          message.id
        }" title="${t('Delete')}">${icon('trash')}</button>
      </div>`;

  const avatar = isUser
    ? `<div class="msg-avatar">${escapeHtml(
        initials(state.profile?.display_name || '', state.user?.email || 'You'),
      )}</div>`
    : `<div class="msg-avatar">${icon('spark')}</div>`;

  return `<article class="msg ${isUser ? 'msg-user' : 'msg-assistant'}" data-msg-id="${message.id}">
    <div class="msg-rail">${avatar}${isLast ? '' : '<div class="msg-line"></div>'}</div>
    <div class="msg-body">
      <div class="msg-head">
        <span class="msg-who">${isUser ? t('You') : t('Assistant')}</span>
        ${modelBadge}
        <span class="msg-time">${formatTime(message.created_at)}</span>
        ${stopped}
        ${nav}
      </div>
      ${reasoningBlock}
      <div class="md" data-md dir="auto">${bodyHtml}</div>
      ${errorBlock}
      ${actions}
    </div>
  </article>`;
}

/* -------------------------------- scrolling ------------------------------- */

function scrollToBottom(force = false) {
  const vp = viewportEl();
  if (!vp) return;
  if (force || autoScroll) vp.scrollTop = vp.scrollHeight;
}

/* --------------------------------- sending -------------------------------- */

function makeTitle(text) {
  const line = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return clip((line || 'New chat').replace(/[#>*_`~]/g, '').trim(), 52) || 'New chat';
}

function withAttachments(text, attachments) {
  const parts = [];
  if (text) parts.push(text);
  for (const att of attachments || []) {
    const fence = String(att.content).includes('```') ? '````' : '```';
    parts.push(`**Attachment · ${att.name}**\n\n${fence}\n${att.content}\n${fence}`);
  }
  return parts.join('\n\n').trim();
}

function buildContext(pathRows) {
  const system = (state.conversation?.system_prompt || state.settings.systemPrompt || '').trim();
  const out = [];
  if (system) out.push({ role: 'system', content: system });
  for (const row of pathRows) {
    if (row.role !== 'user' && row.role !== 'assistant') continue;
    if (!row.content || !row.content.trim()) continue;
    out.push({ role: row.role, content: row.content });
  }
  // Keep at least the final exchange intact while trimming huge contexts.
  let chars = out.reduce((n, m) => n + m.content.length, 0);
  let guard = 0;
  while (chars > 480_000 && out.length > 2 && guard < 500) {
    const removed = out.splice(system ? 1 : 0, 1)[0];
    chars -= removed.content.length;
    guard++;
  }
  return out;
}

async function touchConversation(conv, text) {
  const now = new Date().toISOString();
  conv.last_message_at = now;
  const shouldTitle =
    state.settings.autoTitle !== false && (!conv.title || conv.title === 'New chat');
  if (shouldTitle) conv.title = makeTitle(text);
  sortConversations();
  renderTopbar();
  renderSidebar();
  try {
    if (shouldTitle) await db.updateConversation(conv.id, { title: conv.title, last_message_at: now });
    else await db.touchConversation(conv.id, now);
  } catch (error) {
    console.warn('could not update conversation timestamp', error.message);
  }
}

async function handleSend(detail) {
  if (state.streaming || sending) return;
  const text = String(detail?.text || '').trim();
  const attachments = Array.isArray(detail?.attachments) ? detail.attachments : [];
  if (!text && !attachments.length) return;

  const key = (state.profile?.openrouter_key || '').trim();
  if (!key) {
    toast(t('Add your OpenRouter key to start chatting.'), { type: 'err', title: t('API key needed') });
    openSettings('api');
    return;
  }

  sending = true;
  try {
    const content = withAttachments(text, attachments);
    let conv = state.conversation;
    if (!conv) {
      conv = await db.createConversation(state.user.id, {
        title: state.settings.autoTitle !== false ? makeTitle(text || attachments[0]?.name) : 'New chat',
        model_id: state.settings.defaultModel || AUTO_MODEL,
        lock_auto_model: state.settings.lockAutoModel !== false,
      });
      state.conversation = conv;
      state.conversations.unshift(conv);
      emit('conversation-changed');
      emit('conversations-changed');
      try {
        history.replaceState(null, '', `#/c/${conv.id}`);
      } catch {
        /* ignore */
      }
    }

    const parentId = activePath().at(-1)?.id || null;
    const userRow = await db.insertMessage({
      conversation_id: conv.id,
      user_id: state.user.id,
      parent_id: parentId,
      role: 'user',
      content,
      status: 'complete',
    });

    state.messages.push(userRow);
    state.leafId = userRow.id;
    rememberLeaf(conv.id, userRow.id);
    clearComposer();
    renderThread();
    updateComposer();
    await touchConversation(conv, text);
    autoScroll = true;
    scrollToBottom(true);

    await generateReply({ conversation: conv, parentId: userRow.id });
  } catch (error) {
    toastError(t('Could not send that message'), error);
    setDraft(text);
  } finally {
    sending = false;
  }
}

async function generateReply({ conversation, parentId }) {
  if (!conversation || conversation.id !== state.conversation?.id) return;
  const key = (state.profile?.openrouter_key || '').trim();
  if (!key) {
    openSettings('api');
    toast(t('Add your OpenRouter key first.'), { type: 'err' });
    return;
  }

  const model = effectiveModelId(conversation);
  const contextPath = pathTo(parentId);
  const apiMessages = buildContext(contextPath);
  if (!apiMessages.length) {
    toast(t('There is nothing to send yet.'), { type: 'err' });
    return;
  }

  const body = buildRequestBody({
    model,
    messages: apiMessages,
    settings: state.settings,
    conversationParams: conversation.params,
  });
  const snapshot = JSON.parse(JSON.stringify(body));
  const keepRaw = state.settings.keepRawRequest !== false;

  let assistantRow;
  try {
    assistantRow = await db.insertMessage({
      conversation_id: conversation.id,
      user_id: state.user.id,
      parent_id: parentId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      model: null,
      requested_model: model,
      raw_request: keepRaw ? snapshot : null,
    });
  } catch (error) {
    toastError(t('Could not save the reply'), error);
    return;
  }

  state.messages.push(assistantRow);
  state.leafId = assistantRow.id;
  rememberLeaf(conversation.id, assistantRow.id);

  const controller = new AbortController();
  const stream = {
    id: assistantRow.id,
    conversationId: conversation.id,
    requestedModel: model,
    controller,
    content: '',
    reasoning: '',
    actualModel: null,
    usage: null,
    finishReason: null,
    raw: [],
    done: false,
    startedAt: Date.now(),
  };
  stream.flush = makeFlush(stream);
  state.streaming = stream;

  renderThread();
  updateComposer();
  renderTopbar();
  renderSidebar();
  emit('stream-state', { streaming: true });
  autoScroll = true;
  scrollToBottom(true);

  try {
    await streamChat({
      key,
      body,
      signal: controller.signal,
      onContent: (chunk) => {
        stream.content += chunk;
        stream.flush();
      },
      onReasoning: (chunk) => {
        stream.reasoning += chunk;
        stream.flush();
      },
      onMeta: (meta) => {
        if (meta.model) {
          stream.actualModel = meta.model;
          updateStreamBadge(stream);
        }
        if (meta.finishReason) stream.finishReason = meta.finishReason;
      },
      onUsage: (usage) => {
        stream.usage = usage;
      },
      onRaw: (line) => {
        if (stream.raw.length < 6000) stream.raw.push(line);
      },
    });
    await finalizeStream(stream, 'complete', null);
  } catch (error) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      await finalizeStream(stream, 'stopped', null);
    } else {
      console.error('chat request failed', error);
      await finalizeStream(stream, 'error', error?.message || String(error));
      toastError(t('The model request failed'), error);
    }
  }
}

function makeFlush(stream) {
  let last = 0;
  let timer = 0;
  const run = () => {
    timer = 0;
    last = Date.now();
    applyStreamContent(stream);
  };
  return () => {
    const now = Date.now();
    if (now - last > 90) run();
    else if (!timer) timer = setTimeout(run, 90 - (now - last));
  };
}

function updateStreamBadge(stream) {
  const root = document.querySelector(`.msg[data-msg-id="${stream.id}"]`);
  const nameEl = root?.querySelector('[data-model-name]');
  if (nameEl && stream.actualModel) nameEl.textContent = prettyModel(stream.actualModel);
}

function applyStreamContent(stream) {
  if (!stream || state.streaming !== stream) return;
  const root = document.querySelector(`.msg[data-msg-id="${stream.id}"]`);
  if (!root) return;

  const body = root.querySelector('[data-md]');
  if (body) {
    body.innerHTML =
      (stream.content ? renderMarkdown(stream.content) : '') +
      (stream.content
        ? '<span class="stream-caret"></span>'
        : '<span class="typing-dots"><i></i><i></i><i></i></span>');
    enhanceMarkdown(body);
  }

  const wrap = root.querySelector('[data-reasoning]');
  if (wrap) {
    if (stream.reasoning) {
      wrap.hidden = false;
      if (!stream.content) wrap.setAttribute('open', '');
      const label = wrap.querySelector('[data-reasoning-label]');
      if (label) label.textContent = stream.content ? t('Reasoning') : t('Thinking');
      const count = wrap.querySelector('[data-reasoning-count]');
      if (count) count.textContent = t('{n} chars', { n: formatNum(stream.reasoning.length) });
      const bodyEl = wrap.querySelector('[data-reasoning-body]');
      if (bodyEl) {
        bodyEl.textContent = stream.reasoning;
        bodyEl.scrollTop = bodyEl.scrollHeight;
      }
    } else {
      wrap.hidden = true;
    }
  }

  updateStreamBadge(stream);
  scrollToBottom();
}

async function finalizeStream(stream, status, errorMessage) {
  if (!stream || stream.done) return;
  stream.done = true;
  if (state.streaming === stream) state.streaming = null;

  const usage = stream.usage || {};
  const keepRaw = state.settings.keepRawRequest !== false;
  const patch = {
    content: stream.content,
    reasoning: stream.reasoning || null,
    model: stream.actualModel || stream.requestedModel || null,
    status,
    error: errorMessage || null,
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    raw_response: keepRaw
      ? {
          model: stream.actualModel,
          finish_reason: stream.finishReason,
          usage,
          raw: stream.raw.join('\n').slice(0, 140_000),
        }
      : null,
  };

  const message = state.messages.find((m) => m.id === stream.id);
  if (message) Object.assign(message, patch);

  const conversation =
    state.conversations.find((c) => c.id === stream.conversationId) ||
    (state.conversation?.id === stream.conversationId ? state.conversation : null);

  try {
    await db.patchMessage(stream.id, patch);
    if (conversation) {
      const now = new Date().toISOString();
      conversation.last_message_at = now;
      await db.touchConversation(conversation.id, now);
    }
  } catch (error) {
    toastError(t('Could not save the finished reply'), error);
  }

  // Auto-router lock: pin the resolved concrete model to this conversation.
  if (
    conversation &&
    stream.requestedModel === AUTO_MODEL &&
    conversation.lock_auto_model &&
    stream.actualModel &&
    stream.actualModel !== AUTO_MODEL
  ) {
    conversation.model_id = stream.actualModel;
    if (state.conversation?.id === conversation.id) state.conversation.model_id = stream.actualModel;
    try {
      await db.updateConversation(conversation.id, { model_id: stream.actualModel });
    } catch (error) {
      console.warn('could not lock resolved model', error.message);
    }
    toast(t('Auto router resolved to {m}. It is locked for this chat.', { m: prettyModel(stream.actualModel) }), {
      type: 'info',
      title: t('Model resolved'),
      timeout: 5200,
    });
  }

  sortConversations();
  updateComposer();
  renderTopbar();
  renderSidebar();
  emit('stream-state', { streaming: false });
  emit('messages-changed');
  emit('conversations-changed');

  if (state.conversation?.id === stream.conversationId) {
    renderThread();
    scrollToBottom();
  }
}

export function stopStreaming() {
  const stream = state.streaming;
  if (!stream) return;
  try {
    stream.controller.abort();
  } catch {
    /* ignore */
  }
  toast(t('Generation stopped.'), { type: 'info' });
}

/* ------------------------------- message ops ------------------------------ */

async function copyMessage(id) {
  const message = findMessage(id);
  if (!message) return;
  const ok = await copyText(message.content || '');
  toast(ok ? t('Message copied.') : t('Copy failed.'), { type: ok ? 'ok' : 'err' });
}

function openEditModal(message) {
  if (!message) return;
  const isAssistant = message.role === 'assistant';
  const modal = openModal({
    title: isAssistant ? t('Edit reply') : t('Edit message'),
    iconName: 'edit',
    body: `<div class="stack">
      <textarea class="textarea" id="edit-content" dir="auto" style="min-height:190px"></textarea>
      <div class="inspector-note">${
        isAssistant
          ? t('Edited in place — the request inspector keeps the original payload.')
          : t('Editing creates a new branch, leaving the original intact.')
      }</div>
    </div>`,
    footer: `<div class="spacer"></div>
      <button class="btn" data-action="close-modal">${t('Cancel')}</button>
      <button class="btn btn-primary" id="edit-save">${t('Save')}</button>`,
  });
  const ta = modal.bodyEl.querySelector('#edit-content');
  ta.value = message.content || '';
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  const save = async () => {
    const value = ta.value.trim();
    if (!value) return;
    modal.close();
    try {
      if (isAssistant) {
        await db.patchMessage(message.id, { content: value });
        message.content = value;
        renderThread();
        toast(t('Reply updated.'), { type: 'ok' });
        return;
      }
      const row = await db.insertMessage({
        conversation_id: message.conversation_id,
        user_id: state.user.id,
        parent_id: message.parent_id,
        role: 'user',
        content: value,
        status: 'complete',
      });
      state.messages.push(row);
      state.leafId = row.id;
      rememberLeaf(message.conversation_id, row.id);
      renderThread();
      updateComposer();
      await generateReply({ conversation: state.conversation, parentId: row.id });
    } catch (error) {
      toastError(t('Could not save the edit'), error);
    }
  };

  modal.scrim.querySelector('#edit-save').addEventListener('click', save);
  ta.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      save();
    }
  });
}

async function regenerate(message) {
  if (!message || state.streaming) return;
  if (!state.conversation) return;
  const parentId = message.role === 'assistant' ? message.parent_id : message.id;
  state.leafId = parentId;
  renderThread();
  await generateReply({ conversation: state.conversation, parentId });
}

function subtreeIds(id) {
  const ids = [];
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    ids.push(current);
    for (const msg of state.messages) if (msg.parent_id === current) stack.push(msg.id);
  }
  return ids;
}

async function deleteMessage(message) {
  if (!message) return;
  const ids = subtreeIds(message.id);
  const ok = await confirmDialog({
    title: t('Delete message'),
    message: t('Delete this message and {n} replies below it? This cannot be undone.', {
      n: Math.max(0, ids.length - 1),
    }),
    confirmLabel: t('Delete'),
  });
  if (!ok) return;
  try {
    await db.deleteMessage(message.id);
    state.messages = state.messages.filter((m) => !ids.includes(m.id));
    if (!state.messages.some((m) => m.id === state.leafId)) {
      const parent = message.parent_id;
      state.leafId = parent && state.messages.some((m) => m.id === parent) ? parent : pickLeaf(state.messages);
      if (state.leafId) rememberLeaf(message.conversation_id, state.leafId);
    }
    renderThread();
    renderTopbar();
    renderSidebar();
    toast(t('Message deleted.'), { type: 'ok' });
  } catch (error) {
    toastError(t('Could not delete the message'), error);
  }
}

async function forkFrom(message) {
  if (!message || !state.conversation) return;
  const source = state.conversation;
  const path = pathTo(message.id);
  if (!path.length) return;
  try {
    const copy = await db.createConversation(state.user.id, {
      title: clip(`${source.title || 'Chat'} · branch`, 64),
      model_id: source.model_id,
      lock_auto_model: source.lock_auto_model,
      system_prompt: source.system_prompt,
      params: source.params,
    });
    let parentId = null;
    for (const row of path) {
      const inserted = await db.insertMessage({
        conversation_id: copy.id,
        user_id: state.user.id,
        parent_id: parentId,
        role: row.role,
        content: row.content,
        reasoning: row.reasoning,
        model: row.model,
        requested_model: row.requested_model,
        status: row.status === 'streaming' ? 'complete' : row.status,
        prompt_tokens: row.prompt_tokens,
        completion_tokens: row.completion_tokens,
        total_tokens: row.total_tokens,
      });
      parentId = inserted.id;
    }
    state.conversations.unshift(copy);
    emit('conversations-changed');
    toast(t('Branch created as a new chat.'), { type: 'ok' });
    await openConversation(copy.id);
  } catch (error) {
    toastError(t('Could not create the branch'), error);
  }
}

function stepBranch(messageId, delta) {
  const message = findMessage(messageId);
  if (!message) return;
  const siblings = childrenOf(message);
  if (siblings.length < 2) return;
  const index = siblings.findIndex((s) => s.id === message.id);
  const target = siblings[(index + delta + siblings.length) % siblings.length];
  if (target) setLeaf(deepestLeafFrom(target.id));
}

/* -------------------------------- branch map ------------------------------ */

export function openBranchMap() {
  if (!state.conversation) {
    toast(t('Open a chat first.'), { type: 'info' });
    return;
  }
  const leaves = state.messages.filter((m) => !state.messages.some((x) => x.parent_id === m.id));
  const rows = leaves
    .map((leaf) => {
      const path = pathTo(leaf.id);
      const lastUser = [...path].reverse().find((m) => m.role === 'user');
      return {
        leaf,
        path,
        preview: clip(lastUser?.content || path[path.length - 1]?.content || t('Empty branch'), 90),
      };
    })
    .sort((a, b) => new Date(b.leaf.created_at) - new Date(a.leaf.created_at));

  const body = `<div class="stack" style="gap:6px">
    <div class="inspector-note">${t(
      'Every leaf below is a complete path through this conversation. Pick one to make it the visible branch — nothing is deleted.',
    )}</div>
    ${
      rows.length
        ? rows
            .map(
              (row) => `<button type="button" class="ctx-msg" data-leaf-id="${row.leaf.id}" style="text-align:start;cursor:pointer;${
                row.leaf.id === state.leafId ? 'border-color:rgba(var(--a1),.6);background:rgba(var(--a1),.1)' : ''
              }">
                <span class="role">${row.path.length} msg</span>
                <span style="flex:1;min-width:0">
                  <span class="small" dir="auto" style="display:block;color:var(--text-soft);line-height:1.5">${escapeHtml(
                    row.preview,
                  )}</span>
                  <span class="tiny-text muted">${escapeHtml(formatDateTime(row.leaf.created_at))} · ${escapeHtml(
                    prettyModel(row.leaf.model || ''),
                  )}</span>
                </span>
                ${row.leaf.id === state.leafId ? `<span class="badge ok">${t('Active')}</span>` : ''}
              </button>`,
            )
            .join('')
        : `<div class="conv-empty">${t('No branches yet.')}</div>`
    }
  </div>`;

  const mapModal = openModal({
    title: t('Branch map'),
    subtitle: `${rows.length} ${t('branches')} · ${state.messages.length} ${t('messages')}`,
    iconName: 'tree',
    body,
    footer: `<div class="spacer"></div><button class="btn btn-primary btn-sm" data-action="close-modal">${t(
      'Close',
    )}</button>`,
  });

  mapModal.bodyEl.querySelectorAll('[data-leaf-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLeaf(btn.dataset.leafId);
      closeModal();
    });
  });
}

/* ------------------------------- export ---------------------------------- */

export function exportCurrentChat(format = 'md') {
  if (!state.conversation) {
    toast(t('Open a chat first.'), { type: 'info' });
    return;
  }
  const conv = state.conversation;
  const path = activePath();
  if (format === 'json') {
    download(
      safeFilename(conv.title, 'json'),
      JSON.stringify(
        {
          app: 'Nebula AI Studio',
          version: 1,
          exported_at: new Date().toISOString(),
          conversation: conv,
          messages: path,
        },
        null,
        2,
      ),
      'application/json',
    );
  } else {
    const chunks = [`# ${conv.title}`, `_${formatDateTime(conv.created_at)} · ${conv.model_id || 'model unknown'}_`];
    for (const message of path) {
      const who =
        message.role === 'user'
          ? 'You'
          : `Assistant${message.model ? ` · ${message.model}` : ''}`;
      chunks.push(`## ${who}\n\n${message.content || ''}`);
      if (message.reasoning) {
        chunks.push(`<details><summary>Reasoning</summary>\n\n${message.reasoning}\n\n</details>`);
      }
    }
    download(safeFilename(conv.title, 'md'), chunks.join('\n\n'), 'text/markdown');
  }
  toast(t('Export downloaded.'), { type: 'ok' });
}

/* ----------------------------- request preview ---------------------------- */

export function previewCurrentRequest() {
  const conv = state.conversation;
  const draft = withAttachments(getDraft().trim(), getAttachments());
  if (!conv && !draft) {
    toast(t('Start a chat or type a draft first.'), { type: 'info' });
    return;
  }
  const apiMessages = buildContext(conv ? pathTo(state.leafId) : []);
  if (draft) apiMessages.push({ role: 'user', content: draft });
  if (!apiMessages.length) {
    toast(t('Nothing to preview yet.'), { type: 'info' });
    return;
  }
  const body = buildRequestBody({
    model: effectiveModelId(conv),
    messages: apiMessages,
    settings: state.settings,
    conversationParams: conv?.params,
  });
  openRequestPreview({
    body,
    note: draft
      ? t('Preview only — includes your unsent draft as the final user message.')
      : t('Preview only — this is the context that would be sent with your next message.'),
  });
}

export function previewLastRequest() {
  const captured = [...state.messages]
    .filter((m) => m.raw_request)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (captured.length) {
    openInspector(captured[0]);
    return;
  }
  if (state.conversation) {
    previewCurrentRequest();
    return;
  }
  toast(t('Nothing to inspect yet — send a message first.'), { type: 'info' });
}

/* ----------------------------- chat parameters ---------------------------- */

export function openChatParams() {
  const conv = state.conversation;
  const params = { ...(conv?.params || {}) };
  const s = state.settings;
  const temp = params.temperature ?? s.temperature ?? 0.7;
  const topP = params.topP ?? s.topP ?? 1;
  const maxTokens = params.maxTokens ?? s.maxTokens ?? 2048;
  const effort = params.reasoningEffort ?? s.reasoningEffort ?? 'auto';
  const systemPrompt = conv ? conv.system_prompt || '' : s.systemPrompt || '';
  const lock = conv ? conv.lock_auto_model !== false : s.lockAutoModel !== false;

  const modal = openModal({
    title: conv ? t('Chat parameters') : t('Default parameters'),
    subtitle: conv ? t('Overrides for this conversation only') : t('Applied to every new chat'),
    iconName: 'sliders',
    body: `<div class="settings-grid">
      <div class="setting-group">
        <div class="sg-head">${icon('message')} ${t('System prompt')}</div>
        <textarea class="textarea" id="param-system" dir="auto" rows="4" style="min-height:110px" placeholder="${t(
          'Leave empty to use the global system prompt',
        )}">${escapeHtml(systemPrompt)}</textarea>
        <div class="row wrap">
          <button type="button" class="btn btn-sm" data-action="open-settings" data-tab="chat">${icon(
            'settings',
          )} ${t('Edit global default')}</button>
          <span class="muted tiny-text">${t('Per-chat prompts replace the global one.')}</span>
        </div>
      </div>
      <div class="setting-group">
        <div class="sg-head">${icon('sliders')} ${t('Sampling')}</div>
        <div class="setting-row">
          <div class="setting-copy"><b>${t('Temperature')}</b></div>
          <div class="setting-control">
            <input type="range" id="param-temp" min="0" max="2" step="0.05" value="${temp}" style="flex:1" />
            <span class="mono small" id="param-temp-out">${Number(temp).toFixed(2)}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><b>${t('Top P')}</b></div>
          <div class="setting-control">
            <input type="range" id="param-topp" min="0.1" max="1" step="0.05" value="${topP}" style="flex:1" />
            <span class="mono small" id="param-topp-out">${Number(topP).toFixed(2)}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><b>${t('Max tokens')}</b></div>
          <div class="setting-control">
            <input class="input" type="number" id="param-max" min="64" max="32000" step="64" value="${maxTokens}" style="width:110px" />
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-copy"><b>${t('Reasoning effort')}</b></div>
          <div class="setting-control">
            <div class="select-wrap" style="flex:1"><select class="select" id="param-effort">
              ${['auto', 'off', 'low', 'medium', 'high']
                .map((v) => `<option value="${v}" ${effort === v ? 'selected' : ''}>${t(v)}</option>`)
                .join('')}
            </select></div>
          </div>
        </div>
      </div>
      <div class="setting-group">
        <div class="sg-head">${icon('cpu')} ${t('Model')}</div>
        <div class="row wrap">
          <button type="button" class="chip is-accent" data-action="open-model-picker">${icon('cpu')}<span class="truncate" dir="ltr">${escapeHtml(
            modelLabel(effectiveModelId(conv)),
          )}</span></button>
          <label class="switch"><input type="checkbox" id="param-lock" ${lock ? 'checked' : ''} /><span class="track"></span><span>${t(
            'Lock actual model',
          )}</span></label>
        </div>
        <span class="hint">${t('Locking applies when openrouter/free resolves to a concrete model.')}</span>
      </div>
    </div>`,
    footer: `<div class="spacer"></div><button class="btn" data-action="close-modal">${t(
      'Cancel',
    )}</button><button class="btn btn-primary" id="param-save">${t('Save')}</button>`,
  });

  const body = modal.bodyEl;
  const tempInput = body.querySelector('#param-temp');
  tempInput.addEventListener('input', () => {
    body.querySelector('#param-temp-out').textContent = Number(tempInput.value).toFixed(2);
  });
  const toppInput = body.querySelector('#param-topp');
  toppInput.addEventListener('input', () => {
    body.querySelector('#param-topp-out').textContent = Number(toppInput.value).toFixed(2);
  });

  modal.scrim.querySelector('#param-save').addEventListener('click', async () => {
    const nextParams = {
      ...(conv?.params || {}),
      temperature: Number(tempInput.value),
      topP: Number(toppInput.value),
      maxTokens: Number(body.querySelector('#param-max').value) || 2048,
      reasoningEffort: body.querySelector('#param-effort').value,
    };
    const nextSystem = body.querySelector('#param-system').value.trim();
    const nextLock = body.querySelector('#param-lock').checked;

    try {
      if (!conv) {
        updateSettings({
          temperature: nextParams.temperature,
          topP: nextParams.topP,
          maxTokens: nextParams.maxTokens,
          reasoningEffort: nextParams.reasoningEffort,
          systemPrompt: nextSystem || s.systemPrompt,
          lockAutoModel: nextLock,
        });
      } else {
        const updated = await db.updateConversation(conv.id, {
          params: nextParams,
          system_prompt: nextSystem || null,
          lock_auto_model: nextLock,
        });
        if (updated) {
          state.conversation = { ...state.conversation, ...updated };
          const cached = state.conversations.find((c) => c.id === conv.id);
          if (cached) Object.assign(cached, updated);
        }
        emit('conversation-changed');
      }
      updateComposer();
      renderTopbar();
      modal.close();
      toast(t('Parameters saved.'), { type: 'ok' });
    } catch (error) {
      toastError(t('Could not save the parameters'), error);
    }
  });
}

/* ------------------------------- chat menu ------------------------------- */

function conversationMenu(anchor, conversationId) {
  const conv = state.conversations.find((c) => c.id === conversationId);
  if (!conv) return;
  const hasMessages = state.conversation?.id === conv.id && state.messages.length > 0;

  openMenu(anchor, [
    { label: t('Rename'), icon: 'edit', onClick: () => renameConversation(conv) },
    {
      label: conv.pinned ? t('Unpin') : t('Pin'),
      icon: 'pin',
      onClick: () => toggleConversationFlag(conv, 'pinned'),
    },
    {
      label: conv.archived ? t('Unarchive') : t('Archive'),
      icon: 'archive',
      onClick: () => toggleConversationFlag(conv, 'archived'),
    },
    'sep',
    {
      label: t('Open chat'),
      icon: 'chat',
      onClick: () => openConversation(conv.id),
    },
    {
      label: t('Branch map'),
      icon: 'tree',
      onClick: () => (state.conversation?.id === conv.id ? openBranchMap() : openConversation(conv.id)),
    },
    {
      label: t('Duplicate'),
      icon: 'copy',
      disabled: !hasMessages,
      onClick: async () => {
        if (state.conversation?.id !== conv.id) await openConversation(conv.id);
        const leaf = activePath().at(-1);
        if (leaf) await forkFrom(leaf);
      },
    },
    'sep',
    {
      label: t('Export as Markdown'),
      icon: 'download',
      disabled: !hasMessages,
      onClick: async () => {
        if (state.conversation?.id !== conv.id) await openConversation(conv.id);
        exportCurrentChat('md');
      },
    },
    {
      label: t('Export as JSON'),
      icon: 'code',
      disabled: !hasMessages,
      onClick: async () => {
        if (state.conversation?.id !== conv.id) await openConversation(conv.id);
        exportCurrentChat('json');
      },
    },
    {
      label: t('Copy transcript'),
      icon: 'file',
      disabled: !hasMessages,
      onClick: async () => {
        if (state.conversation?.id !== conv.id) await openConversation(conv.id);
        const text = activePath()
          .map((m) => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content || ''}`)
          .join('\n\n');
        const ok = await copyText(text);
        toast(ok ? t('Transcript copied.') : t('Copy failed.'), { type: ok ? 'ok' : 'err' });
      },
    },
    'sep',
    {
      label: t('Delete chat'),
      icon: 'trash',
      danger: true,
      onClick: () => deleteConversation(conv),
    },
  ]);
}

function renameConversation(conv) {
  const modal = openModal({
    title: t('Rename chat'),
    iconName: 'edit',
    className: 'narrow',
    body: `<div class="field"><label>${t('Title')}</label><input class="input" id="rename-input" dir="auto" value="${escapeHtml(
      conv.title || '',
    )}" /></div>`,
    footer: `<div class="spacer"></div><button class="btn" data-action="close-modal">${t(
      'Cancel',
    )}</button><button class="btn btn-primary" id="rename-save">${t('Save')}</button>`,
  });
  const input = modal.bodyEl.querySelector('#rename-input');
  input.focus();
  input.select();
  const save = async () => {
    const value = input.value.trim();
    if (!value) return;
    try {
      const updated = await db.updateConversation(conv.id, { title: value });
      conv.title = value;
      if (state.conversation?.id === conv.id) state.conversation.title = value;
      renderSidebar();
      renderTopbar();
      modal.close();
      if (updated) emit('conversations-changed');
    } catch (error) {
      toastError(t('Could not rename the chat'), error);
    }
  };
  modal.scrim.querySelector('#rename-save').addEventListener('click', save);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') save();
  });
}

async function toggleConversationFlag(conv, flag) {
  const next = !conv[flag];
  try {
    await db.updateConversation(conv.id, { [flag]: next });
    conv[flag] = next;
    if (state.conversation?.id === conv.id) state.conversation[flag] = next;
    sortConversations();
    renderSidebar();
    renderTopbar();
    if (flag === 'archived' && next) {
      toast(t('Chat archived.'), { type: 'ok' });
      if (state.conversation?.id === conv.id) newChat();
    }
  } catch (error) {
    toastError(t('Could not update the chat'), error);
  }
}

async function deleteConversation(conv) {
  const ok = await confirmDialog({
    title: t('Delete chat'),
    message: t('Delete “{title}” and all of its branches? This cannot be undone.', {
      title: conv.title || 'Chat',
    }),
    confirmLabel: t('Delete'),
  });
  if (!ok) return;
  try {
    await db.deleteConversation(conv.id);
    state.conversations = state.conversations.filter((c) => c.id !== conv.id);
    if (state.conversation?.id === conv.id) {
      state.conversation = null;
      state.messages = [];
      state.leafId = null;
      renderChatArea();
      updateComposer();
    }
    renderSidebar();
    renderTopbar();
    emit('conversations-changed');
    toast(t('Chat deleted.'), { type: 'ok' });
  } catch (error) {
    toastError(t('Could not delete the chat'), error);
  }
}
