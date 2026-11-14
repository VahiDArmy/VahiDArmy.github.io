/** The conversation surface: streaming, branches, edits, models, exact requests. */
import { CONFIG } from '../config.js';
import {
  state,
  setState,
  updateConversationInState,
  removeConversationFromState,
  getModelBySlug,
} from '../store.js';
import * as db from '../services/db.js';
import { runAssistantTurn } from '../services/chat.js';
import { buildContextReport, contextGaugeSvg } from '../services/tokens.js';
import { createRequestSnapshot } from '../services/requestBuilder.js';
import { getModelOrFallback, syncFreeModels } from '../services/models.js';
import {
  getDraft,
  saveDraft,
  clearDraft,
  getApiKey,
  getLastModel,
  setLastModel,
  loadSettings,
} from '../services/settings.js';
import {
  pathToLeaf,
  resolveActiveLeaf,
  deepestLeaf,
  latestLeaf,
  branchSiblingForDirection,
  subtreeIds,
} from '../tree.js';
import { renderMessage, renderWelcome, renderDayDivider } from '../components/message.js';
import { renderErrorCard } from '../components/errorCard.js';
import { openModelPicker } from '../components/modelPicker.js';
import { openContextReport, usageDetailRows } from '../components/contextReport.js';
import { openRequestInspector } from '../components/requestInspector.js';
import { BUILTIN_PERSONAS, PROMPT_STARTERS } from '../services/prompts.js';
import { openModal, promptDialog, confirmDialog } from '../ui/modal.js';
import { openMenu } from '../ui/menu.js';
import { toast, toastError } from '../ui/toast.js';
import { icon, logoMark } from '../ui/icons.js';
import { renderMarkdown, bindCodeCopy } from '../ui/markdown.js';
import { reportError, openErrorDialog } from '../ui/errorDialog.js';
import {
  autoGrow,
  dayKey,
  download,
  escapeHtml,
  formatContext,
  formatNumber,
  formatTokens,
  isNearBottom,
  rafThrottle,
  titleFromText,
  truncate,
  copyText,
} from '../utils.js';
import { conversationToMarkdown, conversationToJson, safeFilename } from '../services/export.js';

const PENDING_SYSTEM_KEY = 'meraj.v1.pending-system';
const PENDING_DRAFT_KEY = 'meraj.v1.pending-draft';
const PENDING_TITLE_KEY = 'meraj.v1.pending-title';

let root = null;
let ctx = null;
let mounted = false;
let conversation = null;
let messages = [];
let path = [];
let selectedModelSlug = '';
let pendingSystem = '';
let pendingParams = null;
let draft = '';
let streaming = false;
let stopping = false;
let busySend = false;
let controller = null;
let streamingMessageId = null;
let runToken = 0;
let loadToken = 0;
let stickToBottom = true;
let firstRender = true;
let scrollEl = null;
let threadEl = null;
let inputEl = null;
let loadError = null;
let routedInRun = null;
let cleanupFns = [];
let saveDraftTimer = null;

/* ───────────────────────────── setup / loading ───────────────────────────── */

function settings() {
  return state.settings || loadSettings();
}

function effectiveConversation() {
  if (conversation) return conversation;
  return {
    id: null,
    title: 'New conversation',
    model_slug: selectedModelSlug,
    system_prompt: pendingSystem || null,
    params: { ...(settings().params || {}), ...(pendingParams || {}) },
    total_tokens: 0,
  };
}

function currentModel() {
  return getModelOrFallback(state.models, selectedModelSlug);
}

function currentParams() {
  return { ...(settings().params || {}), ...(conversation?.params || {}), ...(pendingParams || {}) };
}

function hasKey() {
  return Boolean(getApiKey());
}

function currentDraft() {
  return inputEl ? inputEl.value : draft;
}

function shellMarkup() {
  return `<div class="chat-view">
    <header class="chat-top" id="chat-header"></header>
    <div class="chat-alerts" id="chat-alerts"></div>
    <div class="chat-scroll" id="chat-scroll">
      <div class="chat-thread" id="chat-thread"></div>
    </div>
    <button type="button" class="scroll-bottom" id="scroll-bottom" data-action="scroll-bottom" aria-label="Scroll to the newest message">${icon('chevronDown', { size: 17 })}</button>
    <footer class="composer-dock" id="composer-dock"></footer>
  </div>`;
}

async function loadConversation(routeId) {
  const token = ++loadToken;
  loadError = null;
  conversation = null;
  messages = [];
  path = [];
  pendingSystem = '';
  pendingParams = null;
  draft = '';
  streaming = false;
  streamingMessageId = null;
  routedInRun = null;
  selectedModelSlug = '';

  if (routeId) {
    let found = state.conversations.find((item) => item.id === routeId) || state.archivedConversations.find((item) => item.id === routeId);
    if (!found) {
      const result = await db.getConversation(routeId);
      if (token !== loadToken) return;
      if (result.error) {
        loadError = { ...result.error, kind: 'database', context: 'conversation' };
        return;
      }
      found = result.data;
    }
    if (!found) {
      loadError = { kind: 'client', message: 'This conversation does not exist, or it was deleted.', status: 404 };
      return;
    }
    conversation = found;
    const messageResult = await db.listMessages(routeId);
    if (token !== loadToken) return;
    if (messageResult.error) {
      loadError = { ...messageResult.error, kind: 'database', context: 'messages' };
      return;
    }
    messages = messageResult.data || [];
    const activeLeaf = resolveActiveLeaf(messages, conversation.active_leaf_id);
    if (activeLeaf && activeLeaf !== conversation.active_leaf_id) {
      conversation.active_leaf_id = activeLeaf;
      db.updateConversation(conversation.id, { active_leaf_id: activeLeaf }).then(({ error }) => {
        if (error) console.warn('[معراج] Could not persist repaired active leaf', error);
      });
    }
    path = pathToLeaf(messages, activeLeaf);
    selectedModelSlug = conversation.model_slug || settings().defaultModel || CONFIG.defaults.model;
    draft = getDraft(routeId);
    setState({ activeConversationId: routeId }, 'chat-opened');
  } else {
    const pendingDraft = readPending(PENDING_DRAFT_KEY);
    const pendingSystemValue = readPending(PENDING_SYSTEM_KEY);
    pendingSystem = pendingSystemValue || settings().systemPrompt || '';
    const preferred = getLastModel() || settings().defaultModel || CONFIG.defaults.model;
    const active = state.models.filter((model) => model.is_active !== false).map((model) => model.slug);
    selectedModelSlug = active.includes(preferred) ? preferred : active[0] || CONFIG.defaults.model;
    draft = pendingDraft || getDraft(null);
    setState({ activeConversationId: null }, 'chat-new');
  }
}

function readPending(key) {
  try {
    const value = sessionStorage.getItem(key) || '';
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return '';
  }
}

/* ───────────────────────────── rendering ───────────────────────────── */

function renderHeader() {
  const holder = root?.querySelector('#chat-header');
  if (!holder) return;
  const model = currentModel();
  const report = buildContextReport({
    model,
    conversation: effectiveConversation(),
    path,
    draft: currentDraft(),
    params: currentParams(),
  });
  const pct = report.percent === null ? null : Math.min(100, report.percent);
  const over = report.percent !== null && report.percent > 100;
  const title = conversation?.title || 'New conversation';
  const subBits = [
    model?.name || 'No model',
    `${path.filter((message) => message.role === 'user').length} prompt${path.filter((message) => message.role === 'user').length === 1 ? '' : 's'}`,
  ];
  if (conversation?.system_prompt?.trim() || pendingSystem.trim()) subBits.push('system prompt');
  if (conversation?.pinned) subBits.push('pinned');
  if (conversation?.archived) subBits.push('archived');

  holder.innerHTML = `
    <button type="button" class="icon-btn chat-menu-btn" data-action="open-sidebar" aria-label="Open conversations">${icon('menu', { size: 19 })}</button>
    <div class="chat-title">
      <button type="button" class="chat-title__btn" data-action="rename-conversation" title="Rename conversation">
        <h1>${escapeHtml(title)}</h1>
        ${conversation ? icon('edit', { size: 13, className: 'chat-title__edit' }) : ''}
      </button>
      <p class="chat-subtitle">${subBits.map((bit) => `<span>${escapeHtml(bit)}</span>`).join('<i></i>')}</p>
    </div>
    <div class="chat-top__actions">
      <button type="button" class="model-chip model-chip--header" data-action="change-model" title="Change model for the next reply">
        <span class="model-chip__orb" style="--hue:${model?.slug === 'openrouter/free' ? 42 : 180}">${model?.slug === 'openrouter/free' ? icon('spark', { size: 14 }) : escapeHtml((model?.provider || 'M').slice(0, 1))}</span>
        <span class="model-chip__copy"><strong>${escapeHtml(model?.name || 'Choose a model')}</strong><span>${escapeHtml(model?.provider || 'OpenRouter')}</span></span>
        ${icon('chevronDown', { size: 13 })}
      </button>
      <button type="button" class="context-chip ${over ? 'is-over' : ''}" data-action="context-report" title="Context report">
        <span class="context-chip__gauge">${contextGaugeSvg(pct ?? 0, { size: 30, stroke: 3 })}</span>
        <span class="context-chip__label">${pct === null ? '—' : `${report.percent.toFixed(0)}%`}</span>
      </button>
      <button type="button" class="request-btn" data-action="latest-request" title="Show the exact full text sent to the model">
        <span class="request-btn__glyph mono">{ }</span>
        <span class="request-btn__text">Exact request</span>
      </button>
      <button type="button" class="icon-btn" data-action="conversation-menu" aria-label="Conversation actions">${icon('more', { size: 18 })}</button>
    </div>`;
}

function renderAlerts() {
  const bits = [];
  if (!state.online) {
    bits.push(`<div class="chat-banner chat-banner--warn">${icon('wifiOff', { size: 17 })}<div><strong>You are offline</strong><p>The browser reports no network connection. Requests cannot reach OpenRouter until it returns.</p></div></div>`);
  }
  if (!hasKey()) {
    bits.push(`<div class="chat-banner chat-banner--key">${icon('key', { size: 18 })}<div><strong>OpenRouter key needed</strong><p>Add your own key to send requests. It is stored only in this browser, never in Supabase, and the exact request preview still works without it.</p></div><button type="button" class="btn btn--small btn--primary" data-action="configure-key">Open settings</button></div>`);
  }
  if (state.modelsError) {
    bits.push(`<div class="chat-banner chat-banner--error">${icon('alert', { size: 17 })}<div><strong>Model catalogue error</strong><p>${escapeHtml(state.modelsError.message || 'The free-model catalogue could not be refreshed. Existing models remain usable.')}</p><details class="banner-raw"><summary>Exact error</summary><pre>${escapeHtml(JSON.stringify(state.modelsError, null, 2))}</pre></details></div><button type="button" class="btn btn--small btn--ghost" data-action="sync-models">${icon('refresh', { size: 14 })}<span>Retry</span></button></div>`);
  }
  if (!state.models.length) {
    bits.push(`<div class="chat-banner">${icon('cpu', { size: 17 })}<div><strong>No stored models yet</strong><p>Fetch the free OpenRouter catalogue to choose a model. The router remains available.</p></div><button type="button" class="btn btn--small btn--primary" data-action="sync-models">${state.modelsSyncing ? 'Syncing…' : 'Fetch models'}</button></div>`);
  }
  const model = getModelBySlug(state.models, selectedModelSlug);
  if (model && model.is_active === false) {
    bits.push(`<div class="chat-banner chat-banner--warn">${icon('alert', { size: 17 })}<div><strong>This chat model is inactive</strong><p>${escapeHtml(model.name)} was deactivated in Model Atelier. It still works here; reactivate it to keep it in quick picks.</p></div><button type="button" class="btn btn--small btn--ghost" data-action="reactivate-model">${icon('check', { size: 14 })}<span>Reactivate</span></button></div>`);
  }
  if (selectedModelSlug && !model) {
    bits.push(`<div class="chat-banner chat-banner--warn">${icon('info', { size: 17 })}<div><strong>Model not in the local catalogue</strong><p>The slug <code>${escapeHtml(selectedModelSlug)}</code> will still be sent exactly as the chat model. Refresh the catalogue to restore its metadata.</p></div><button type="button" class="btn btn--small btn--ghost" data-action="sync-models">${icon('refresh', { size: 14 })}<span>Refresh</span></button></div>`);
  }
  const holder = root?.querySelector('#chat-alerts');
  if (holder) holder.innerHTML = bits.join('');
}

function starterCards() {
  return `<section class="starter-grid" aria-label="Conversation starters">
    ${PROMPT_STARTERS.slice(0, 6)
      .map(
        (starter) => `<button type="button" class="starter-card" data-starter="${escapeHtml(starter.id)}">
          <span class="starter-card__icon">${icon(starter.icon, { size: 18 })}</span>
          <span class="starter-card__copy"><strong>${escapeHtml(starter.title)}</strong><span>${escapeHtml(starter.subtitle)}</span></span>
          <span class="starter-card__arrow">${icon('arrowRight', { size: 15 })}</span>
        </button>`,
      )
      .join('')}
  </section>`;
}

function personaStrip() {
  return `<section class="persona-strip">
    <p class="persona-strip__label">${icon('compass', { size: 14 })} Or begin with a guide</p>
    <div class="persona-strip__row">
      ${BUILTIN_PERSONAS.slice(0, 5)
        .map(
          (persona) => `<button type="button" class="persona-chip" data-persona="${escapeHtml(persona.id)}">${icon(persona.icon, { size: 14 })}<span>${escapeHtml(persona.title)}</span></button>`,
        )
        .join('')}
      <button type="button" class="persona-chip persona-chip--ghost" data-action="open-prompts">${icon('arrowRight', { size: 13 })}<span>All ${BUILTIN_PERSONAS.length} personas</span></button>
    </div>
  </section>`;
}

function renderThread({ forceBottom = false, scrollToId = null } = {}) {
  if (!threadEl) return;
  const shouldStick = forceBottom || stickToBottom;
  if (!path.length) {
    threadEl.innerHTML = `<div class="thread-inner thread-inner--welcome">
      ${renderWelcome({
        models: state.models,
        hasKey: hasKey(),
        online: state.online,
        activeCount: state.models.filter((model) => model.is_active !== false).length,
      })}
      ${starterCards()}
      ${personaStrip()}
      <div class="welcome__privacy">${icon('shieldCheck', { size: 15 })}<p>Chats are stored in your Supabase project under row-level security. The OpenRouter key stays on this device. Every request is archived with its response.</p></div>
    </div>`;
  } else {
    let lastDay = '';
    const rendered = path
      .map((message) => {
        const key = dayKey(message.created_at);
        const divider = key !== lastDay ? renderDayDivider(message.created_at) : '';
        lastDay = key;
        return `${divider}${renderMessage(message, {
          messages,
          models: state.models,
          streaming: message.id === streamingMessageId && streaming,
          timestamps: settings().timestamps !== false,
          showReasoning: settings().showReasoning !== false,
        })}`;
      })
      .join('');
    threadEl.innerHTML = `<div class="thread-inner">
      ${rendered}
      ${busySend && !streamingMessageId ? `<div class="pending-turn"><span class="thinking__orb">${icon('spark', { size: 15 })}</span><div><strong>Preparing ${escapeHtml(currentModel()?.name || 'the model')}</strong><p>Writing the prompt and archiving the exact request body…</p></div></div>` : ''}
      <div class="thread-signature">${icon('shieldCheck', { size: 13 })}<span>Every reply above is archived with its exact request body.</span></div>
    </div>`;
  }

  bindCodeCopy(threadEl, (code) => {
    if (code) toast({ title: 'Code copied', message: `${code.length.toLocaleString()} characters`, type: 'success', duration: 1800 });
  });

  requestAnimationFrame(() => {
    if (!scrollEl) return;
    if (scrollToId) {
      const target = threadEl.querySelector(`[data-message-id="${CSS.escape(scrollToId)}"]`);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else if (shouldStick) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
    updateScrollButton();
  });
  if (firstRender) {
    firstRender = false;
    stickToBottom = true;
  }
}

function composerMarkup() {
  const model = currentModel();
  const system = (conversation ? conversation.system_prompt : pendingSystem) || '';
  return `<div class="composer-shell ${streaming ? 'is-streaming' : ''}">
    <div class="composer-status" id="composer-stream-status">${streaming ? `<span class="stream-dot"></span><span id="composer-stream-label">Streaming</span>` : ''}</div>
    <div class="composer-system" id="composer-system">
      ${system ? `<button type="button" class="system-chip" data-action="system-prompt">${icon('quote', { size: 13 })}<span>System prompt</span><em>${escapeHtml(truncate(system.replace(/\s+/g, ' '), 54))}</em>${icon('edit', { size: 11 })}</button>` : `<button type="button" class="system-chip system-chip--ghost" data-action="system-prompt">${icon('plus', { size: 12 })}<span>System prompt</span></button>`}
      ${streaming ? `<span class="composer-stream-model">${escapeHtml(model?.name || '')}</span>` : ''}
    </div>
    <div class="composer-box">
      <textarea id="composer-input" class="composer-input" rows="1" placeholder="Ask ${escapeHtml(model?.name || 'a free model')}…" aria-label="Message" maxlength="60000"></textarea>
      <div class="composer-toolbar">
        <div class="composer-toolbar__left">
          <button type="button" class="composer-model" data-action="change-model" title="Change model for the next reply">
            <span class="model-dot" style="--hue:${42}"></span>
            <span class="composer-model__name">${escapeHtml(truncate(model?.name || 'Choose model', 28))}</span>
            ${icon('chevronDown', { size: 12 })}
          </button>
          <button type="button" class="tool-btn" data-action="params" title="Sampling parameters">${icon('sliders', { size: 16 })}<span>Params</span></button>
          <button type="button" class="tool-btn tool-btn--icon" data-action="open-prompts" title="Prompt library" aria-label="Prompt library">${icon('book', { size: 16 })}</button>
        </div>
        <div class="composer-toolbar__right">
          <button type="button" class="composer-meter" id="composer-context" data-action="context-report" title="Context report"></button>
          <button type="button" class="composer-request" data-action="preview-request" title="Preview the exact full text that will be sent" aria-label="Preview exact request">${icon('code', { size: 16 })}</button>
          <button type="button" class="send-btn" id="composer-send" data-action="send-or-stop" aria-label="Send message">
            ${streaming ? `<span class="stop-square" aria-hidden="true"></span>` : icon('arrowUp', { size: 18 })}
          </button>
        </div>
      </div>
    </div>
    <div class="composer-below">
      <span class="composer-hint">${settings().sendWithEnter === false ? '⌘/Ctrl + Enter to send' : 'Enter to send · Shift + Enter for a new line'}</span>
      <span class="composer-count" id="composer-count"></span>
    </div>
  </div>`;
}

function renderComposer() {
  const dock = root?.querySelector('#composer-dock');
  if (!dock) return;
  dock.innerHTML = composerMarkup();
  inputEl = dock.querySelector('#composer-input');
  if (inputEl) {
    inputEl.value = draft;
    autoGrow(inputEl, 300);
    bindComposerInput();
  }
  updateComposerMeta();
}

function bindComposerInput() {
  if (!inputEl || inputEl.dataset.bound === '1') return;
  inputEl.dataset.bound = '1';
}

const scheduleMeta = rafThrottle(() => updateComposerMeta());

function updateComposerMeta() {
  if (!inputEl) return;
  const value = inputEl.value;
  const model = currentModel();
  const report = buildContextReport({
    model,
    conversation: effectiveConversation(),
    path,
    draft: value,
    params: currentParams(),
  });
  const pct = report.percent === null ? null : Math.min(100, report.percent);
  const over = report.percent !== null && report.percent > 100;
  const gauge = root?.querySelector('#composer-context');
  if (gauge) {
    gauge.innerHTML = `${contextGaugeSvg(pct ?? 0, { size: 28, stroke: 3 })}<span class="${over ? 'is-over' : ''}">${report.percent === null ? '—' : `${report.percent.toFixed(0)}%`}</span>`;
    gauge.title = report.contextLength
      ? `~${formatNumber(report.totalInput)} input tokens + ${formatNumber(report.maxOut)} reply reserve of ${formatContext(report.contextLength)}`
      : 'Context window unknown';
    gauge.classList.toggle('is-over', over);
  }
  const count = root?.querySelector('#composer-count');
  if (count) count.textContent = `${formatNumber(value.length)} characters · ~${formatNumber(report.draftTokens)} draft tokens`;
  const send = root?.querySelector('#composer-send');
  if (send) {
    const disabled = !streaming && (!value.trim() || !hasKey() || busySend);
    send.disabled = disabled;
    send.classList.toggle('is-ready', !disabled);
    send.title = streaming ? 'Stop generating' : !hasKey() ? 'Add an OpenRouter key in Settings' : 'Send message';
  }
  const below = root?.querySelector('.composer-below');
  if (below && !below.querySelector('#composer-tokens')) {
    const hint = below.querySelector('.composer-hint');
    const span = document.createElement('span');
    span.id = 'composer-tokens';
    span.className = 'composer-tokens';
    span.textContent = `~${formatNumber(report.totalInput)} input tokens`;
    hint?.after(span);
  } else {
    const tokenEl = root?.querySelector('#composer-tokens');
    if (tokenEl) tokenEl.textContent = `~${formatNumber(report.totalInput)} input tokens`;
  }
  const streamStatus = root?.querySelector('#composer-stream-status');
  if (streamStatus) {
    if (streaming) {
      const latencyStart = Date.now();
      streamStatus.innerHTML = `<span class="stream-dot"></span><span id="composer-stream-label">Streaming from ${escapeHtml(model?.name || 'model')}${stopping ? ' — stopping…' : ''}</span>`;
      streamStatus.dataset.started = String(latencyStart);
    } else {
      streamStatus.innerHTML = '';
    }
  }
  const systemHolder = root?.querySelector('#composer-system');
  if (systemHolder) {
    const system = (conversation ? conversation.system_prompt : pendingSystem) || '';
    const streamModel = streaming ? `<span class="composer-stream-model">${escapeHtml(model?.name || '')}</span>` : '';
    systemHolder.innerHTML = `${system ? `<button type="button" class="system-chip" data-action="system-prompt">${icon('quote', { size: 13 })}<span>System prompt</span><em>${escapeHtml(truncate(system.replace(/\s+/g, ' '), 54))}</em>${icon('edit', { size: 11 })}</button>` : `<button type="button" class="system-chip system-chip--ghost" data-action="system-prompt">${icon('plus', { size: 12 })}<span>System prompt</span></button>`}${streamModel}`;
  }
  const modelName = root?.querySelector('.composer-model__name');
  if (modelName) modelName.textContent = truncate(model?.name || 'Choose model', 28);
}

function updateScrollButton() {
  if (!scrollEl) return;
  const button = root?.querySelector('#scroll-bottom');
  if (button) button.classList.toggle('is-visible', !isNearBottom(scrollEl, 220));
}

/* ───────────────────────────── stream lifecycle ───────────────────────────── */

function updateStreamingDom() {
  if (!streamingMessageId) return;
  const message = messages.find((item) => item.id === streamingMessageId);
  if (!message) return;
  const article = threadEl?.querySelector(`[data-message-id="${CSS.escape(streamingMessageId)}"]`);
  if (!article) {
    renderThread();
    return;
  }
  const body = article.querySelector('[data-stream-body]');
  if (body) {
    const content = message.content || '';
    body.innerHTML = content
      ? `${renderMarkdown(content, { streaming: true })}<span class="stream-cursor" aria-hidden="true"></span>`
      : `<div class="thinking"><span class="thinking__orb">${icon('spark', { size: 16 })}</span><span class="thinking__label">${escapeHtml(currentModel()?.name || 'Model')} is composing</span><span class="thinking__dots"><i></i><i></i><i></i></span></div><span class="stream-cursor" aria-hidden="true"></span>`;
  }
  if (message.reasoning?.trim() && !article.querySelector('.reasoning')) {
    renderThread();
    return;
  }
  const reasoning = article.querySelector('[data-reasoning-body]');
  if (reasoning && message.reasoning) reasoning.innerHTML = renderMarkdown(message.reasoning, { streaming: true });
  const usage = article.querySelector('[data-stream-usage]');
  if (usage) usage.textContent = `${formatTokens(Math.ceil((message.content || '').length / 4))} tokens streaming`;
  if (stickToBottom && scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
}

const scheduleStreamingDom = rafThrottle(updateStreamingDom);

function finalizeConversationPatch(finalMessage) {
  if (!conversation?.id) return;
  const total = messages.reduce((sum, message) => sum + Number(message.usage?.total_tokens || 0), 0);
  const patch = {
    active_leaf_id: finalMessage?.id || conversation.active_leaf_id || null,
    message_count: messages.length,
    total_tokens: total,
    last_message_at: new Date().toISOString(),
  };
  Object.assign(conversation, patch);
  updateConversationInState(conversation);
  db.updateConversation(conversation.id, patch).then(({ error }) => {
    if (error) reportError('Supabase could not update conversation metadata', error);
  });
}

async function startTurn({ pathForRequest, parentId, userMessage = null }) {
  if (!conversation || streaming) return;
  const model = currentModel();
  const requestedModel = model?.slug || selectedModelSlug;
  const apiKey = getApiKey();
  const requestPath = pathForRequest || path;
  runToken += 1;
  const thisRun = runToken;
  streaming = true;
  stopping = false;
  routedInRun = null;
  streamingMessageId = null;
  controller = new AbortController();
  if (inputEl) inputEl.disabled = false;
  renderHeader();
  updateComposerMeta();
  if (scrollEl) stickToBottom = true;

  const outcome = await runAssistantTurn({
    user: state.user,
    conversation,
    parentId,
    model,
    path: requestPath,
    settings: settings(),
    apiKey,
    signal: controller.signal,
    onAssistantCreated: (assistant) => {
      if (!mounted || thisRun !== runToken) return;
      messages.push(assistant);
      path = pathToLeaf(messages, assistant.id);
      streamingMessageId = assistant.id;
      busySend = false;
      conversation.active_leaf_id = assistant.id;
      renderHeader();
      renderThread({ forceBottom: true });
      updateComposerMeta();
    },
    onDelta: (_delta, full) => {
      if (!mounted || thisRun !== runToken) return;
      const message = messages.find((item) => item.id === streamingMessageId);
      if (message) message.content = full;
      scheduleStreamingDom();
    },
    onReasoning: (_delta, full) => {
      if (!mounted || thisRun !== runToken) return;
      const message = messages.find((item) => item.id === streamingMessageId);
      if (message) message.reasoning = full;
      scheduleStreamingDom();
    },
    onMeta: (meta) => {
      if (!mounted || thisRun !== runToken) return;
      if (meta?.model) {
        const message = messages.find((item) => item.id === streamingMessageId);
        if (message) message.model_slug = meta.model;
      }
    },
    onRoute: (actualModel) => {
      if (!mounted || thisRun !== runToken) return;
      if (requestedModel !== 'openrouter/free') return;
      if (!actualModel || actualModel === selectedModelSlug) return;
      routedInRun = actualModel;
      selectedModelSlug = actualModel;
      conversation.model_slug = actualModel;
      updateConversationInState(conversation);
      db.updateConversation(conversation.id, { model_slug: actualModel }).then(({ error }) => {
        if (error) reportError('Could not persist the router-selected model', error);
      });
      setLastModel(actualModel);
      renderHeader();
      updateComposerMeta();
      toast({
        title: 'Router selected a model',
        message: `${actualModel} is now this chat's model. The response below is labelled with it.`,
        type: 'info',
        duration: 6000,
      });
    },
    onComplete: (assistant) => {
      if (!mounted || thisRun !== runToken) return;
      replaceMessage(assistant);
      if (assistant.conversation_model_update) {
        selectedModelSlug = assistant.conversation_model_update;
        conversation.model_slug = assistant.conversation_model_update;
      }
      finalizeConversationPatch(assistant);
      streaming = false;
      streamingMessageId = null;
      controller = null;
      busySend = false;
      renderHeader();
      renderAlerts();
      renderThread({ forceBottom: true });
      updateComposerMeta();
      stickToBottom = true;
    },
    onAbort: (assistant) => {
      if (!mounted || thisRun !== runToken) return;
      replaceMessage(assistant);
      finalizeConversationPatch(assistant);
      streaming = false;
      stopping = false;
      streamingMessageId = null;
      controller = null;
      busySend = false;
      renderHeader();
      renderAlerts();
      renderThread({ forceBottom: true });
      updateComposerMeta();
      toast({ title: 'Stopped', message: 'The partial reply was saved as its own stopped branch.', type: 'info', duration: 3200 });
    },
    onError: (error, assistant) => {
      if (!mounted || thisRun !== runToken) return;
      if (assistant) replaceMessage(assistant);
      finalizeConversationPatch(assistant);
      streaming = false;
      stopping = false;
      streamingMessageId = null;
      controller = null;
      busySend = false;
      renderHeader();
      renderAlerts();
      renderThread({ forceBottom: true });
      updateComposerMeta();
      reportError('OpenRouter request failed', error);
    },
    onPersistError: (error) => {
      if (!mounted) return;
      reportError('Supabase write failed while streaming', error);
    },
  });

  if (thisRun === runToken) {
    const earlyError = outcome?.status === 'error' && !outcome?.assistant;
    streaming = false;
    stopping = false;
    busySend = false;
    controller = null;
    streamingMessageId = null;
    if (mounted) {
      renderHeader();
      renderAlerts();
      renderThread({ forceBottom: true });
      updateComposerMeta();
      if (earlyError && outcome.error) reportError('The assistant turn could not start', outcome.error);
    }
  }
}

function replaceMessage(next) {
  const index = messages.findIndex((message) => message.id === next.id);
  if (index >= 0) messages[index] = { ...messages[index], ...next };
  else messages.push(next);
  if (conversation?.active_leaf_id) path = pathToLeaf(messages, conversation.active_leaf_id);
  if (next.id === streamingMessageId || next.status !== 'streaming') {
    path = pathToLeaf(messages, next.id);
    if (conversation) conversation.active_leaf_id = next.id;
  }
}

/* ───────────────────────────── sending ───────────────────────────── */

async function ensureConversation(firstText) {
  if (conversation) return conversation;
  const title = titleFromText(readPending(PENDING_TITLE_KEY) || firstText, CONFIG.limits.titleLength);
  const params = { ...((settings().params) || {}), ...(pendingParams || {}) };
  const payload = {
    title,
    model_slug: selectedModelSlug,
    system_prompt: pendingSystem?.trim() ? pendingSystem : null,
    params,
  };
  const { data, error } = await db.createConversation(state.user.id, payload);
  if (error) {
    reportError('Supabase could not create the conversation', error);
    return null;
  }
  conversation = data;
  messages = [];
  path = [];
  setState({ conversations: [data, ...state.conversations], activeConversationId: data.id }, 'conversation-created');
  window.history.replaceState(null, '', `#/c/${data.id}`);
  pendingSystem = '';
  pendingParams = null;
  if (inputEl) inputEl.value = '';
  draft = '';
  return conversation;
}

async function sendMessage() {
  if (busySend) return;
  if (streaming) {
    stopStreaming();
    return;
  }
  if (!state.online) {
    toast({ title: 'You are offline', message: 'The browser has no network connection. Nothing was sent.', type: 'warning' });
    return;
  }
  if (!hasKey()) {
    toast({
      title: 'OpenRouter key required',
      message: 'Add a key in Settings before sending. The exact request preview still works without it.',
      type: 'warning',
      actions: [{ label: 'Open settings', close: true, onClick: () => ctx?.navigate?.('/settings') }],
    });
    return;
  }
  const text = inputEl ? inputEl.value : draft;
  if (!text.trim()) {
    inputEl?.focus();
    return;
  }
  const model = getModelOrFallback(state.models, selectedModelSlug);
  busySend = true;
  updateComposerMeta();

  const conv = await ensureConversation(text);
  if (!conv) {
    busySend = false;
    updateComposerMeta();
    renderThread();
    return;
  }

  const parentId = path.length ? path[path.length - 1].id : null;
  const { data: userMessage, error } = await db.createMessage({
    conversation_id: conv.id,
    user_id: state.user.id,
    parent_id: parentId,
    role: 'user',
    content: text,
    model_slug: selectedModelSlug,
    requested_model: selectedModelSlug,
    status: 'complete',
  });
  if (error || !userMessage) {
    busySend = false;
    if (inputEl && !inputEl.value) {
      inputEl.value = text;
      draft = text;
      autoGrow(inputEl, 300);
    }
    reportError('Supabase could not save your prompt', error || { message: 'No user message was returned.' });
    updateComposerMeta();
    return;
  }

  messages.push(userMessage);
  path = pathToLeaf(messages, userMessage.id);
  conversation.active_leaf_id = userMessage.id;
  draft = '';
  clearDraft(conv.id);
  if (inputEl) {
    inputEl.value = '';
    autoGrow(inputEl, 300);
  }
  saveDraft(conv.id, '');
  busySend = true;
  stickToBottom = true;

  const titlePatch = {};
  if (!conversation.title || conversation.title === 'New conversation') {
    conversation.title = titleFromText(text, CONFIG.limits.titleLength);
    titlePatch.title = conversation.title;
  }
  updateConversationInState(conversation);
  db.updateConversation(conv.id, {
    active_leaf_id: userMessage.id,
    last_message_at: new Date().toISOString(),
    message_count: messages.length,
    ...titlePatch,
  }).then(({ error: updateError }) => {
    if (updateError) reportError('Supabase could not update the conversation', updateError);
  });

  renderHeader();
  renderAlerts();
  renderThread({ forceBottom: true });
  updateComposerMeta();
  setLastModel(selectedModelSlug);

  await startTurn({
    pathForRequest: path,
    parentId: userMessage.id,
    userMessage,
  });

  if (mounted) {
    setState({ conversations: [...state.conversations] }, 'conversation-touched');
    updateComposerMeta();
  }
  void model;
}

function stopStreaming() {
  if (!controller || !streaming) return;
  stopping = true;
  updateComposerMeta();
  controller.abort();
}

/* ───────────────────────────── editing / branching ───────────────────────────── */

async function runEditedPrompt(original, content) {
  if (streaming) {
    toast({ title: 'A reply is streaming', message: 'Stop the current reply before editing a prompt.', type: 'warning' });
    return;
  }
  if (!hasKey()) {
    toast({
      title: 'OpenRouter key required',
      message: 'Add a key before generating a new branch.',
      type: 'warning',
      actions: [{ label: 'Open settings', onClick: () => ctx?.navigate?.('/settings') }],
    });
    return;
  }
  if (!conversation) return;
  const { data, error } = await db.createMessage({
    conversation_id: conversation.id,
    user_id: state.user.id,
    parent_id: original.parent_id || null,
    role: 'user',
    content,
    model_slug: selectedModelSlug,
    requested_model: selectedModelSlug,
    status: 'complete',
  });
  if (error || !data) {
    reportError('Supabase could not save the edited prompt', error || { message: 'No message returned.' });
    return;
  }
  messages.push(data);
  path = pathToLeaf(messages, data.id);
  conversation.active_leaf_id = data.id;
  updateConversationInState(conversation);
  db.updateConversation(conversation.id, {
    active_leaf_id: data.id,
    last_message_at: new Date().toISOString(),
    message_count: messages.length,
  }).then(({ error: updateError }) => {
    if (updateError) reportError('Supabase could not switch the active branch', updateError);
  });
  renderHeader();
  renderAlerts();
  renderThread({ forceBottom: true, scrollToId: data.id });
  updateComposerMeta();
  await startTurn({ pathForRequest: path, parentId: data.id });
  if (mounted) setState({ conversations: [...state.conversations] }, 'conversation-touched');
}

async function openEditModal(message) {
  if (streaming) {
    toast({ title: 'A reply is streaming', message: 'Stop it before editing.', type: 'warning' });
    return;
  }
  if (!hasKey()) {
    toast({
      title: 'OpenRouter key required',
      message: 'Add a key before creating an edited branch.',
      type: 'warning',
      actions: [{ label: 'Open settings', onClick: () => ctx?.navigate?.('/settings') }],
    });
    return;
  }
  let edited = message.content;
  const modal = openModal({
    title: 'Edit sent prompt',
    subtitle: 'This creates a new branch. The original prompt and its whole reply chain remain intact.',
    size: 'lg',
    body: `<div class="edit-prompt">
      <div class="edit-branch-note">${icon('branch', { size: 19 })}<div><strong>Nothing is overwritten.</strong><p>Your edit becomes a sibling of the original prompt. Use the branch arrows on either version to travel between them. Later messages are never deleted.</p></div></div>
      <label class="field-label" for="edit-prompt-input">Prompt text</label>
      <textarea id="edit-prompt-input" class="input textarea edit-prompt__input" rows="8">${escapeHtml(edited)}</textarea>
      <p class="field-help">Model for the new branch: <strong>${escapeHtml(currentModel()?.name || selectedModelSlug)}</strong>. The active chat model is used, which may differ from the original reply.</p>
    </div>`,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Save & generate branch',
        variant: 'primary',
        icon: 'branch',
        busyLabel: 'Saving…',
        close: false,
        onClick: async () => {
          const text = modal.body.querySelector('#edit-prompt-input')?.value ?? '';
          if (!text.trim()) {
            modal.body.querySelector('#edit-prompt-input')?.focus();
            return false;
          }
          modal.close();
          await runEditedPrompt(message, text);
          return false;
        },
      },
    ],
    footerNote: 'The exact request for the new branch is archived before it is sent.',
  });
  const input = modal.body.querySelector('#edit-prompt-input');
  input?.focus();
  input?.setSelectionRange(input.value.length, input.value.length);
}

async function regenerate(message) {
  if (streaming) {
    toast({ title: 'A reply is streaming', message: 'Stop it before regenerating.', type: 'warning' });
    return;
  }
  if (!hasKey()) {
    toast({ title: 'OpenRouter key required', message: 'Add a key before regenerating.', type: 'warning', actions: [{ label: 'Open settings', onClick: () => ctx?.navigate?.('/settings') }] });
    return;
  }
  if (!conversation) return;
  const parentId = message.parent_id;
  if (!parentId) {
    toast({ title: 'Cannot regenerate', message: 'This reply has no parent prompt in the saved tree.', type: 'warning' });
    return;
  }
  const parentPath = pathToLeaf(messages, parentId);
  if (!parentPath.length) {
    toast({ title: 'Cannot regenerate', message: 'The parent prompt could not be found.', type: 'warning' });
    return;
  }
  stickToBottom = true;
  await startTurn({ pathForRequest: parentPath, parentId });
  if (mounted) setState({ conversations: [...state.conversations] }, 'conversation-touched');
}

async function switchBranch(message, direction) {
  if (streaming) {
    toast({ title: 'A reply is streaming', message: 'Stop it before switching branches.', type: 'warning' });
    return;
  }
  const sibling = branchSiblingForDirection(messages, message, direction);
  if (!sibling) return;
  const leaf = deepestLeaf(messages, sibling.id) || sibling;
  conversation.active_leaf_id = leaf.id;
  path = pathToLeaf(messages, leaf.id);
  updateConversationInState(conversation);
  const { error } = await db.updateConversation(conversation.id, { active_leaf_id: leaf.id });
  if (error) reportError('Could not persist the branch switch', error);
  renderHeader();
  renderAlerts();
  renderThread({ forceBottom: true, scrollToId: message.id });
  updateComposerMeta();
}

async function deleteBranch(message) {
  if (streaming) {
    toast({ title: 'A reply is streaming', message: 'Stop it before deleting a branch.', type: 'warning' });
    return;
  }
  const ids = subtreeIds(messages, message.id);
  const count = ids.size;
  const confirmed = await confirmDialog({
    title: 'Delete this branch?',
    message: `“${truncate(message.content || 'This message', 90)}” and ${count - 1} descendant message(s) will be permanently deleted. Other branches stay intact.`,
    confirmLabel: 'Delete branch',
    danger: true,
  });
  if (!confirmed) return;
  const { error } = await db.deleteMessage(message.id);
  if (error) {
    reportError('Supabase could not delete the branch', error);
    return;
  }
  messages = messages.filter((item) => !ids.has(item.id));
  const fallback = message.parent_id
    ? deepestLeaf(messages, message.parent_id) || messages.find((item) => item.id === message.parent_id)
    : latestLeaf(messages);
  conversation.active_leaf_id = fallback?.id || null;
  path = pathToLeaf(messages, conversation.active_leaf_id);
  updateConversationInState(conversation);
  db.updateConversation(conversation.id, {
    active_leaf_id: conversation.active_leaf_id,
    message_count: messages.length,
    total_tokens: messages.reduce((sum, item) => sum + Number(item.usage?.total_tokens || 0), 0),
  }).then(({ error: updateError }) => {
    if (updateError) reportError('Branch deleted, but conversation metadata did not save', updateError);
  });
  renderHeader();
  renderThread({ forceBottom: true });
  updateComposerMeta();
  toast({ title: 'Branch deleted', message: `${count} message(s) removed.`, type: 'success' });
}

/* ───────────────────────────── models / prompts / params ───────────────────────────── */

async function selectModel(slug) {
  if (!slug || slug === selectedModelSlug) return;
  const previous = selectedModelSlug;
  selectedModelSlug = slug;
  setLastModel(slug);
  if (conversation) {
    conversation.model_slug = slug;
    updateConversationInState(conversation);
    const { error } = await db.updateConversation(conversation.id, { model_slug: slug });
    if (error) {
      selectedModelSlug = previous;
      conversation.model_slug = previous;
      updateConversationInState(conversation);
      reportError('Supabase could not change the chat model', error);
    } else {
      toast({
        title: 'Model changed',
        message: `${slug === 'openrouter/free' ? 'The Free Models Router is active. It will choose a free model and this chat will adopt it.' : slug} will answer the next message. Existing replies keep their original model labels.`,
        type: 'info',
        duration: 5200,
      });
    }
  } else {
    toast({ title: 'Model selected', message: `${slug} will be used when this conversation begins.`, type: 'info', duration: 3000 });
  }
  renderHeader();
  renderAlerts();
  updateComposerMeta();
}

function openPicker() {
  const usage = new Map();
  openModelPicker({
    currentSlug: selectedModelSlug,
    models: state.models,
    usageByModel: usage,
    onSelect: (slug) => selectModel(slug),
    onManage: () => ctx?.navigate?.('/models'),
  });
}

async function syncModels() {
  if (state.modelsSyncing) return;
  setState({ modelsSyncing: true }, 'models-syncing');
  renderAlerts();
  const result = await syncFreeModels(state.user.id, { currentModels: state.models, force: true });
  if (result.error) {
    setState({ modelsSyncing: false, modelsError: result.error }, 'models-sync-error');
    reportError('Model catalogue refresh failed', result.error);
  } else {
    const { data, error } = await db.listModels();
    if (error) {
      setState({ modelsSyncing: false, modelsError: { ...error, kind: 'database' } }, 'models-sync-error');
      reportError('Could not read the refreshed catalogue', error);
    } else {
      setState({ models: data || [], modelsLoaded: true, modelsSyncing: false, modelsError: null }, 'models-synced');
      toast({ title: 'Catalogue refreshed', message: `${result.insertedOrUpdated || (data || []).length} free models stored.`, type: 'success' });
    }
  }
  renderAlerts();
  renderHeader();
  updateComposerMeta();
}

async function reactivateModel() {
  const model = getModelBySlug(state.models, selectedModelSlug);
  if (!model || !conversation) return;
  const { data, error } = await db.updateModel(model.id, { is_active: true });
  if (error) {
    reportError('Could not reactivate the model', error);
    return;
  }
  setState({ models: state.models.map((item) => (item.id === data.id ? data : item)) }, 'model-updated');
  toast({ title: 'Model reactivated', message: data.name, type: 'success' });
  renderAlerts();
  updateComposerMeta();
}

function applySystemPrompt(body, title = '') {
  const value = String(body || '');
  if (conversation) {
    const previous = conversation.system_prompt;
    conversation.system_prompt = value || null;
    db.updateConversation(conversation.id, { system_prompt: value || null }).then(({ error }) => {
      if (error) {
        conversation.system_prompt = previous;
        reportError('Could not save the system prompt', error);
      } else {
        updateConversationInState(conversation);
      }
      renderHeader();
      updateComposerMeta();
    });
  } else {
    pendingSystem = value;
  }
  renderHeader();
  updateComposerMeta();
  toast({
    title: value ? 'System prompt active' : 'System prompt cleared',
    message: value ? `${title || 'Prompt'} will be sent verbatim as the system message in every request in this chat.` : 'No system message will be included.',
    type: 'info',
    duration: 4200,
  });
}

function openSystemModal() {
  const current = (conversation ? conversation.system_prompt : pendingSystem) || '';
  let modal;
  modal = openModal({
    title: 'System prompt',
    subtitle: 'Sent verbatim as the first message. Included only when it is non-empty.',
    size: 'lg',
    body: `<div class="system-editor">
      <label class="field-label" for="system-prompt-input">The exact system instruction</label>
      <textarea id="system-prompt-input" class="input textarea" rows="9" placeholder="You are…">${escapeHtml(current)}</textarea>
      <div class="system-presets">
        <p>Start from a persona</p>
        <div class="system-presets__row">
          ${BUILTIN_PERSONAS.map((persona) => `<button type="button" class="tag-btn" data-system-preset="${escapeHtml(persona.id)}">${icon(persona.icon, { size: 12 })}${escapeHtml(persona.title)}</button>`).join('')}
        </div>
      </div>
      <p class="field-help">This is part of the exact request and is visible in the request inspector. The API key is not.</p>
    </div>`,
    actions: [
      {
        label: 'Clear',
        variant: 'ghost',
        onClick: () => {
          applySystemPrompt('', '');
        },
      },
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Save system prompt',
        variant: 'primary',
        close: false,
        onClick: async () => {
          const value = modal.body.querySelector('#system-prompt-input')?.value || '';
          modal.close();
          applySystemPrompt(value, 'Custom prompt');
          return false;
        },
      },
    ],
    footerNote: 'System prompts are stored per conversation in Supabase.',
  });
  modal.body.querySelectorAll('[data-system-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const persona = BUILTIN_PERSONAS.find((item) => item.id === button.dataset.systemPreset);
      const textarea = modal.body.querySelector('#system-prompt-input');
      if (persona && textarea) {
        textarea.value = persona.body;
        textarea.focus();
        textarea.setSelectionRange(0, 0);
      }
    });
  });
  modal.body.querySelector('#system-prompt-input')?.focus();
}

let paramsModal = null;
function openParamsModal() {
  const params = { ...CONFIG.defaults.params, ...(settings().params || {}), ...(conversation?.params || {}), ...(pendingParams || {}) };
  const model = currentModel();
  const supported = model?.supported_parameters || [];
  const support = (name) => (supported.length ? supported.includes(name) : true);
  paramsModal = openModal({
    title: 'Sampling parameters',
    subtitle: 'These values are included only when the selected model supports them. The inspector shows the final body.',
    size: 'lg',
    body: `<div class="params-editor">
      <div class="param-row">
        <div class="param-head"><label for="param-temperature">Temperature</label><output id="out-temperature">${Number(params.temperature).toFixed(2)}</output></div>
        <input type="range" id="param-temperature" min="0" max="2" step="0.05" value="${Number(params.temperature)}" ${support('temperature') ? '' : 'disabled'}>
        <p class="field-help">Lower is more deterministic; higher explores more. ${support('temperature') ? '' : 'This model does not advertise temperature support, so it will be omitted.'}</p>
      </div>
      <div class="param-row">
        <div class="param-head"><label for="param-top-p">Top P</label><output id="out-top-p">${Number(params.top_p).toFixed(2)}</output></div>
        <input type="range" id="param-top-p" min="0.01" max="1" step="0.01" value="${Number(params.top_p)}" ${support('top_p') ? '' : 'disabled'}>
        <p class="field-help">Nucleus sampling threshold.</p>
      </div>
      <div class="param-grid">
        <label class="field"><span>Max reply tokens</span><input id="param-max-tokens" class="input" type="number" min="16" max="262144" step="16" value="${Number(params.max_tokens)}" ${support('max_tokens') || support('max_completion_tokens') ? '' : 'disabled'}></label>
        <label class="field"><span>Reasoning effort</span><select id="param-reasoning" class="input" ${support('reasoning') ? '' : 'disabled'}>
          ${['off', 'low', 'medium', 'high'].map((value) => `<option value="${value}" ${params.reasoning === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select></label>
      </div>
      <div class="param-note">${icon('info', { size: 15 })}<p>Only supported parameters are serialized. For example, <code>temperature</code> is omitted for a model that does not list it. The exact body tab is the final authority.</p></div>
      <p class="param-supported"><strong>Advertised by ${escapeHtml(model?.name || 'this model')}:</strong> ${supported.length ? supported.map((item) => `<span class="tag tag--ghost">${escapeHtml(item)}</span>`).join('') : '<span class="muted">capabilities unknown</span>'}</p>
    </div>`,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Save parameters',
        variant: 'primary',
        close: false,
        onClick: () => {
          const temperature = Number(paramsModal.body.querySelector('#param-temperature')?.value);
          const topP = Number(paramsModal.body.querySelector('#param-top-p')?.value);
          const maxTokens = Math.round(Number(paramsModal.body.querySelector('#param-max-tokens')?.value));
          const reasoning = paramsModal.body.querySelector('#param-reasoning')?.value || 'off';
          const next = {
            temperature: Math.min(2, Math.max(0, Number.isFinite(temperature) ? temperature : 0.7)),
            top_p: Math.min(1, Math.max(0.01, Number.isFinite(topP) ? topP : 1)),
            max_tokens: Math.min(262144, Math.max(16, Number.isFinite(maxTokens) ? maxTokens : 2048)),
            reasoning,
          };
          if (conversation) {
            conversation.params = { ...(conversation.params || {}), ...next };
            db.updateConversation(conversation.id, { params: conversation.params }).then(({ error }) => {
              if (error) reportError('Could not save parameters', error);
              else updateConversationInState(conversation);
            });
          } else {
            pendingParams = { ...(pendingParams || {}), ...next };
          }
          paramsModal.close();
          renderHeader();
          updateComposerMeta();
          toast({ title: 'Parameters saved', message: 'The next request will use these values where supported.', type: 'success', duration: 3200 });
          return false;
        },
      },
    ],
  });
  const temp = paramsModal.body.querySelector('#param-temperature');
  const topP = paramsModal.body.querySelector('#param-top-p');
  temp?.addEventListener('input', () => {
    paramsModal.body.querySelector('#out-temperature').textContent = Number(temp.value).toFixed(2);
  });
  topP?.addEventListener('input', () => {
    paramsModal.body.querySelector('#out-top-p').textContent = Number(topP.value).toFixed(2);
  });
}

/* ───────────────────────────── request inspection ───────────────────────────── */

async function openArchivedRequest(messageOrId) {
  const id = typeof messageOrId === 'string' ? messageOrId : messageOrId?.id;
  if (!id) return;
  const { data, error } = await db.getMessageSnapshot(id);
  if (error) {
    reportError('Could not load the archived request', error);
    return;
  }
  if (!data?.request) {
    toast({
      title: 'No archived request',
      message: 'This message has no request snapshot. Older or imported messages may predate request archiving.',
      type: 'warning',
    });
    return;
  }
  await openRequestInspector({
    snapshot: data.request,
    preview: false,
    message: { ...data, id },
    subtitle:
      data.requested_model === 'openrouter/free' && data.model_slug !== 'openrouter/free'
        ? `Requested via openrouter/free. The router answered with ${data.model_slug}.`
        : '',
  });
}

async function openPreviewRequest() {
  if (!conversation && !selectedModelSlug) return;
  const model = getModelOrFallback(state.models, selectedModelSlug);
  const conv = effectiveConversation();
  try {
    const snapshot = await createRequestSnapshot({
      conversation: conv,
      model,
      path,
      draft: currentDraft(),
      settings: settings(),
      stream: true,
    });
    await openRequestInspector({ snapshot, preview: true });
  } catch (error) {
    reportError('Could not build the request preview', error);
  }
}

async function openLatestRequest() {
  const candidates = [...path].reverse().filter((message) => message.role === 'assistant');
  for (const message of candidates) {
    const { data, error } = await db.getMessageSnapshot(message.id);
    if (error) {
      reportError('Could not load the last request', error);
      return;
    }
    if (data?.request) {
      await openRequestInspector({
        snapshot: data.request,
        preview: false,
        message: { ...message, ...data },
        subtitle: message.requested_model === 'openrouter/free' && message.model_slug !== 'openrouter/free'
          ? `Requested via openrouter/free. OpenRouter answered with ${message.model_slug}.`
          : '',
      });
      return;
    }
  }
  if (streaming || busySend) {
    toast({ title: 'No archived request yet', message: 'The request snapshot is being archived with the assistant message. Try again in a moment, or preview the draft.', type: 'info' });
    return;
  }
  await openPreviewRequest();
}

function openContext() {
  openContextReport({
    conversation: effectiveConversation(),
    path,
    draft: currentDraft(),
    model: currentModel(),
    settings: settings(),
    onInspectRequest: openPreviewRequest,
  });
}

async function openMessageUsage(message) {
  const meta = message.response_meta || {};
  const rows = usageDetailRows(message.usage, meta);
  openModal({
    title: 'Usage & provenance',
    subtitle: `Response from ${message.model_slug || 'unknown model'}`,
    size: 'md',
    body: `<div class="usage-modal">
      <div class="usage-hero">
        <span class="model-orb" style="--hue:${message.model_slug === 'openrouter/free' ? 42 : 180}">${icon('activity', { size: 18 })}</span>
        <div><strong>${escapeHtml(message.model_slug || 'Unknown')}</strong><p>Requested as <code>${escapeHtml(message.requested_model || message.model_slug || '—')}</code></p></div>
      </div>
      <dl class="usage-list">
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd class="mono">${escapeHtml(value)}</dd></div>`).join('') || '<div><dt>Usage</dt><dd>No usage values were returned.</dd></div>'}
      </dl>
      <p class="field-help">Provider <code>usage</code> is authoritative when present. “Estimated locally” appears only when the provider did not return token counts.</p>
    </div>`,
    actions: [
      { label: 'Exact request', variant: 'ghost', icon: 'code', close: false, onClick: () => { openArchivedRequest(message.id); } },
      { label: 'Close', variant: 'primary' },
    ],
  });
}

/* ───────────────────────────── prompt picker ───────────────────────────── */

async function openPromptPicker() {
  let saved = [];
  if (state.user?.id) {
    const { data } = await db.listPrompts(state.user.id);
    saved = data || [];
  }
  let modal;
  const item = (kind, id, title, subtitle, body, iconName) => `<button type="button" class="prompt-pick" data-prompt-kind="${kind}" data-prompt-id="${escapeHtml(id)}" data-prompt-body="${escapeHtml(body)}">
    <span class="prompt-pick__icon">${icon(iconName, { size: 16 })}</span>
    <span class="prompt-pick__copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></span>
    ${icon('plus', { size: 15 })}
  </button>`;
  modal = openModal({
    title: 'Prompt library',
    subtitle: 'Insert a starter into your draft, or apply a persona as the system prompt.',
    size: 'lg',
    body: `<div class="prompt-picker">
      <p class="prompt-picker__label">${icon('zap', { size: 14 })} Starters — inserted into the composer</p>
      <div class="prompt-picker__grid">
        ${PROMPT_STARTERS.map((starter) => item('starter', starter.id, starter.title, starter.subtitle, starter.prompt, starter.icon)).join('')}
      </div>
      <p class="prompt-picker__label">${icon('compass', { size: 14 })} Personas — applied as a system prompt</p>
      <div class="prompt-picker__grid">
        ${BUILTIN_PERSONAS.map((persona) => item('persona', persona.id, persona.title, persona.category, persona.body, persona.icon)).join('')}
      </div>
      ${saved.length ? `<p class="prompt-picker__label">${icon('book', { size: 14 })} Saved prompts</p><div class="prompt-picker__grid">${saved.map((prompt) => item('saved', prompt.id, prompt.title, prompt.category, prompt.body, prompt.icon || 'book')).join('')}</div>` : ''}
      <div class="prompt-picker__foot"><button type="button" class="link-btn" data-prompt-manage>Open prompt atelier</button> to create, edit, and favourite saved prompts.</div>
    </div>`,
    actions: [{ label: 'Close', variant: 'ghost' }],
  });
  modal.body.querySelectorAll('[data-prompt-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.promptKind;
      const body = button.dataset.promptBody || '';
      const title = button.querySelector('.prompt-pick__copy strong')?.textContent || '';
      if (kind === 'persona') {
        applySystemPrompt(body, title);
      } else {
        const current = currentDraft();
        const next = current ? `${body}\n\n${current}` : body;
        if (inputEl) {
          inputEl.value = next;
          autoGrow(inputEl, 300);
          inputEl.focus();
        }
        draft = next;
        saveDraft(conversation?.id || null, next);
        scheduleMeta();
        toast({ title: 'Prompt inserted', message: title, type: 'success', duration: 2200 });
      }
      modal.close();
    });
  });
  modal.body.querySelector('[data-prompt-manage]')?.addEventListener('click', () => {
    modal.close();
    ctx?.navigate?.('/prompts');
  });
}

/* ───────────────────────────── conversation menu ───────────────────────────── */

async function renameConversation() {
  if (!conversation) return;
  const title = await promptDialog({
    title: 'Rename conversation',
    label: 'Title',
    value: conversation.title || '',
    confirmLabel: 'Rename',
    maxLength: 120,
    validate: (value) => (value ? null : 'A title is required.'),
  });
  if (!title || title === conversation.title) return;
  const { error } = await db.updateConversation(conversation.id, { title });
  if (error) {
    reportError('Rename failed', error);
    return;
  }
  conversation.title = title;
  updateConversationInState(conversation);
  renderHeader();
  toast({ title: 'Renamed', message: title, type: 'success', duration: 2200 });
}

async function togglePin() {
  if (!conversation) return;
  const pinned = !conversation.pinned;
  const { error } = await db.updateConversation(conversation.id, { pinned });
  if (error) {
    reportError('Could not pin the conversation', error);
    return;
  }
  conversation.pinned = pinned;
  updateConversationInState(conversation);
  renderHeader();
  toast({ title: pinned ? 'Pinned' : 'Unpinned', message: conversation.title, type: 'info', duration: 2000 });
}

async function archiveCurrent() {
  if (!conversation) return;
  const confirmed = await confirmDialog({
    title: 'Archive this conversation?',
    message: 'It disappears from the main list but all messages and branches remain. Restore it from Archived in the sidebar.',
    confirmLabel: 'Archive',
  });
  if (!confirmed) return;
  const { error } = await db.updateConversation(conversation.id, { archived: true, pinned: false });
  if (error) {
    reportError('Archive failed', error);
    return;
  }
  const archived = { ...conversation, archived: true, pinned: false };
  removeConversationFromState(conversation.id);
  setState({ archivedConversations: [archived, ...state.archivedConversations], activeConversationId: null }, 'conversation-archived');
  toast({ title: 'Archived', message: conversation.title, type: 'success' });
  newChat(true);
}

async function deleteCurrent() {
  if (!conversation) return;
  const confirmed = await confirmDialog({
    title: 'Delete this conversation?',
    message: `“${conversation.title}” and every message, branch, archived request, and error inside it will be permanently deleted. This cannot be undone.`,
    confirmLabel: 'Delete permanently',
    danger: true,
  });
  if (!confirmed) return;
  const { error } = await db.deleteConversation(conversation.id);
  if (error) {
    reportError('Delete failed', error);
    return;
  }
  removeConversationFromState(conversation.id);
  setState({ activeConversationId: null }, 'conversation-deleted');
  toast({ title: 'Conversation deleted', message: conversation.title, type: 'success' });
  newChat(true);
}

async function exportMarkdown() {
  if (!conversation) return;
  download(`${safeFilename(conversation.title)}.md`, conversationToMarkdown(conversation, path), 'text/markdown;charset=utf-8');
  toast({ title: 'Markdown exported', message: `${path.length} visible message(s), current branch only.`, type: 'success' });
}

async function exportJson() {
  if (!conversation) return;
  const { data, error } = await db.listMessages(conversation.id);
  if (error) {
    reportError('Export failed', error);
    return;
  }
  download(`${safeFilename(conversation.title)}.json`, conversationToJson(conversation, data || []), 'application/json');
  toast({ title: 'JSON exported', message: 'Includes every branch in the tree (request snapshots are not included in this lightweight export).', type: 'success' });
}

async function copyConversationLink() {
  if (!conversation) return;
  const url = `${location.origin}${location.pathname}#/c/${conversation.id}`;
  try {
    await copyText(url);
    toast({ title: 'Link copied', message: url, type: 'success' });
  } catch {
    toast({ title: 'Clipboard blocked', message: url, type: 'warning', duration: 7000 });
  }
}

async function openConversationMenu(anchor) {
  if (!conversation) {
    openMenu(anchor, [
      { label: 'System prompt', icon: 'quote', action: openSystemModal },
      { label: 'Sampling parameters', icon: 'sliders', action: openParamsModal },
      { separator: true },
      { label: 'No saved conversation yet', icon: 'info', disabled: true },
    ]);
    return;
  }
  openMenu(anchor, [
    { heading: truncate(conversation.title || 'Conversation', 32) },
    { label: 'Rename', icon: 'edit', action: renameConversation },
    { label: conversation.pinned ? 'Unpin from top' : 'Pin to top', icon: 'pin', action: togglePin },
    { label: 'System prompt', icon: 'quote', action: openSystemModal },
    { label: 'Sampling parameters', icon: 'sliders', action: openParamsModal },
    { separator: true },
    { label: 'Export Markdown', icon: 'download', action: exportMarkdown },
    { label: 'Export JSON', icon: 'code', action: exportJson },
    { label: 'Copy conversation link', icon: 'link', action: copyConversationLink },
    { separator: true },
    { label: 'Archive', icon: 'archive', action: archiveCurrent },
    { label: 'Delete conversation', icon: 'trash', danger: true, action: deleteCurrent },
  ]);
}

async function openMessageMenu(anchor, message) {
  const items = [];
  if (message.role === 'user') {
    items.push({ label: 'Edit prompt as branch', icon: 'edit', action: () => openEditModal(message) });
    items.push({ label: 'Copy prompt', icon: 'copy', action: () => copyMessage(message) });
  } else {
    items.push({ label: 'Regenerate reply', icon: 'refresh', action: () => regenerate(message) });
    items.push({ label: 'Exact request body', icon: 'code', action: () => openArchivedRequest(message) });
    items.push({ label: 'Usage & provenance', icon: 'activity', action: () => openMessageUsage(message) });
    items.push({ label: 'Copy reply', icon: 'copy', action: () => copyMessage(message) });
  }
  items.push({ separator: true });
  items.push({ label: 'Delete this branch', icon: 'trash', danger: true, action: () => deleteBranch(message) });
  openMenu(anchor, items, { align: 'end', width: 238 });
}

async function copyMessage(message) {
  const text = message.content || '';
  try {
    await copyText(text);
    toast({
      title: message.role === 'user' ? 'Prompt copied' : 'Reply copied',
      message: `${formatNumber(text.length)} characters${message.usage?.total_tokens ? ` · ${formatTokens(message.usage.total_tokens)} tokens` : ''}`,
      type: 'success',
      duration: 2200,
    });
  } catch {
    toast({ title: 'Clipboard unavailable', message: 'Your browser refused clipboard access.', type: 'error' });
  }
}

async function copyRawError(message) {
  if (!message?.error) return;
  const text = message.error.bodyText || JSON.stringify(message.error, null, 2);
  try {
    await copyText(text);
    toast({ title: 'Raw error copied', message: `${formatNumber(text.length)} characters, unabridged.`, type: 'success' });
  } catch {
    toast({ title: 'Clipboard unavailable', message: 'Select the raw text and copy manually.', type: 'error' });
  }
}

/* ───────────────────────────── new chat / events ───────────────────────────── */

function newChat(force = false) {
  if (streaming && controller) {
    stopStreaming();
    if (!force) {
      toast({ title: 'Stream stopped', message: 'The partial reply was saved. Starting a new conversation.', type: 'info' });
    }
  }
  runToken += 1;
  controller = null;
  streaming = false;
  streamingMessageId = null;
  busySend = false;
  conversation = null;
  messages = [];
  path = [];
  pendingSystem = settings().systemPrompt || '';
  pendingParams = null;
  draft = getDraft(null);
  streaming = false;
  streamingMessageId = null;
  busySend = false;
  stopping = false;
  controller = null;
  loadError = null;
  const preferred = getLastModel() || settings().defaultModel || CONFIG.defaults.model;
  const active = state.models.filter((model) => model.is_active !== false).map((model) => model.slug);
  selectedModelSlug = active.includes(preferred) ? preferred : active[0] || CONFIG.defaults.model;
  window.history.replaceState(null, '', '#/chat');
  setState({ activeConversationId: null }, 'chat-new');
  firstRender = true;
  stickToBottom = true;
  renderAll();
  inputEl?.focus();
}

function renderAll() {
  if (!root) return;
  root.innerHTML = shellMarkup();
  scrollEl = root.querySelector('#chat-scroll');
  threadEl = root.querySelector('#chat-thread');
  bindChatEvents();
  renderHeader();
  renderAlerts();
  renderThread({ forceBottom: true });
  renderComposer();
  updateScrollButton();
}

function bindChatEvents() {
  root.querySelector('#chat-scroll')?.addEventListener('scroll', () => {
    if (!scrollEl) return;
    stickToBottom = isNearBottom(scrollEl, 180);
    updateScrollButton();
  });
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape' && streaming) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    event.preventDefault();
    stopStreaming();
  }
}

async function handleRootClick(event) {
  const starter = event.target.closest('[data-starter]');
  if (starter) {
    const item = PROMPT_STARTERS.find((entry) => entry.id === starter.dataset.starter);
    if (item) {
      const current = currentDraft();
      const next = current ? `${item.prompt}\n\n${current}` : item.prompt;
      if (inputEl) {
        inputEl.value = next;
        autoGrow(inputEl, 300);
        inputEl.focus();
      }
      draft = next;
      saveDraft(conversation?.id || null, next);
      scheduleMeta();
      if (!hasKey()) {
        toast({ title: 'Starter inserted', message: 'Add an OpenRouter key in Settings to send.', type: 'info' });
      }
    }
    return;
  }
  const persona = event.target.closest('[data-persona]');
  if (persona) {
    const found = BUILTIN_PERSONAS.find((item) => item.id === persona.dataset.persona);
    if (found) applySystemPrompt(found.body, found.title);
    return;
  }

  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;

  switch (action) {
    case 'open-sidebar':
      ctx?.openSidebar?.();
      break;
    case 'rename-conversation':
      await renameConversation();
      break;
    case 'change-model':
      openPicker();
      break;
    case 'context-report':
      openContext();
      break;
    case 'latest-request':
    case 'message-request':
      if (id) await openArchivedRequest(id);
      else await openLatestRequest();
      break;
    case 'preview-request':
      await openPreviewRequest();
      break;
    case 'conversation-menu':
      await openConversationMenu(actionEl);
      break;
    case 'system-prompt':
      openSystemModal();
      break;
    case 'params':
      openParamsModal();
      break;
    case 'open-prompts':
      await openPromptPicker();
      break;
    case 'configure-key':
      ctx?.navigate?.('/settings');
      break;
    case 'sync-models':
      await syncModels();
      break;
    case 'reactivate-model':
      await reactivateModel();
      break;
    case 'scroll-bottom':
      scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      stickToBottom = true;
      break;
    case 'send-or-stop':
      if (streaming) stopStreaming();
      else await sendMessage();
      break;
    case 'copy-message': {
      const message = messages.find((item) => item.id === id);
      if (message) await copyMessage(message);
      break;
    }
    case 'edit-message': {
      const message = messages.find((item) => item.id === id);
      if (message) await openEditModal(message);
      break;
    }
    case 'retry-message': {
      const message = messages.find((item) => item.id === id);
      if (message) {
        if (message.role === 'assistant') await regenerate(message);
        else toast({ title: 'Not a reply', message: 'Retry is available on assistant replies and error cards.', type: 'info' });
      }
      break;
    }
    case 'message-menu': {
      const message = messages.find((item) => item.id === id);
      if (message) await openMessageMenu(actionEl, message);
      break;
    }
    case 'branch': {
      const message = messages.find((item) => item.id === id);
      if (message) await switchBranch(message, Number(actionEl.dataset.dir));
      break;
    }
    case 'copy-error': {
      const message = messages.find((item) => item.id === id);
      if (message) await copyRawError(message);
      break;
    }
    default:
      break;
  }
}

function onInput(event) {
  if (event.target.id !== 'composer-input') return;
  draft = event.target.value;
  autoGrow(event.target, 300);
  scheduleMeta();
  if (saveDraftTimer) window.clearTimeout(saveDraftTimer);
  saveDraftTimer = window.setTimeout(() => {
    saveDraft(conversation?.id || null, draft);
    saveDraftTimer = null;
  }, 260);
}

function onKeydown(event) {
  if (!event.target || event.target.id !== 'composer-input') return;
  if (event.isComposing) return;
  const withEnter = settings().sendWithEnter !== false;
  const shouldSend = (event.key === 'Enter' && !event.shiftKey && withEnter) || (event.key === 'Enter' && (event.metaKey || event.ctrlKey));
  if (shouldSend) {
    event.preventDefault();
    if (streaming) stopStreaming();
    else sendMessage();
  }
}

function onOnline() {
  setState({ online: true }, 'online');
  if (mounted) {
    renderAlerts();
    updateComposerMeta();
    toast({ title: 'Back online', message: 'OpenRouter can be reached again.', type: 'success', duration: 2600 });
  }
}

function onOffline() {
  setState({ online: false }, 'offline');
  if (mounted) {
    renderAlerts();
    updateComposerMeta();
    toast({ title: 'Offline', message: 'The browser lost its network connection. Nothing was sent.', type: 'warning', duration: 4200 });
  }
}

function onNewChatEvent() {
  if (mounted) newChat(true);
}

function onConversationGone(event) {
  if (!mounted) return;
  if (!conversation || event.detail?.id === conversation.id || !event.detail) newChat(true);
}

/* ───────────────────────────── public lifecycle ───────────────────────────── */

export async function mountChat(element, context = {}) {
  root = element;
  ctx = context;
  mounted = true;
  firstRender = true;
  stickToBottom = true;
  loadError = null;
  draft = '';
  inputEl = null;
  threadEl = null;
  scrollEl = null;
  stopping = false;

  root.innerHTML = `<div class="chat-loading"><span class="boot-spinner" aria-hidden="true"></span><p>Opening the observatory…</p></div>`;
  await loadConversation(context.params?.id || null);

  if (!mounted) return;

  if (loadError) {
    root.innerHTML = `<div class="chat-error-page">
      <div class="chat-error-page__inner">
        <a class="brand" href="#/chat"><span class="brand__mark">${logoMark({ size: 36 })}</span><span class="brand__text"><strong>معراج</strong><em>MI'RAJ</em></span></a>
        <h1>${loadError.kind === 'database' ? 'Supabase returned an error.' : 'This conversation could not open.'}</h1>
        <div class="chat-error-page__detail">
          ${loadError.code ? `<span class="mono">code: ${escapeHtml(loadError.code)}</span>` : ''}
          <p>${escapeHtml(loadError.message || 'No message was returned.')}</p>
          ${loadError.details ? `<pre class="verbatim verbatim--small">${escapeHtml(loadError.details)}</pre>` : ''}
        </div>
        <div class="chat-error-page__actions">
          <button type="button" class="btn btn--primary" data-action="retry-load">${icon('refresh', { size: 16 })}<span>Retry</span></button>
          <a class="btn btn--ghost" href="#/chat">${icon('plus', { size: 16 })}<span>New conversation</span></a>
          <button type="button" class="btn btn--ghost" data-action="error-detail">${icon('alert', { size: 16 })}<span>Raw details</span></button>
        </div>
      </div>
    </div>`;
    root.querySelector('[data-action="retry-load"]')?.addEventListener('click', async () => {
      await mountChat(root, ctx);
    });
    root.querySelector('[data-action="error-detail"]')?.addEventListener('click', () => openErrorDialog('Conversation load error', loadError));
    return;
  }

  renderAll();
  updateComposerMeta();

  cleanupFns.push(() => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('keydown', onDocumentKeydown);
    window.removeEventListener('meraj:new-chat', onNewChatEvent);
    window.removeEventListener('meraj:conversation-gone', onConversationGone);
  });

  root.addEventListener('click', handleRootClick);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeydown);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('meraj:new-chat', onNewChatEvent);
  window.addEventListener('meraj:conversation-gone', onConversationGone);

  if (!window.matchMedia('(max-width: 820px)').matches) {
    window.setTimeout(() => {
      if (mounted && !inputEl?.value) inputEl?.focus({ preventScroll: true });
    }, 220);
  }
}

export function unmountChat() {
  mounted = false;
  if (saveDraftTimer) {
    window.clearTimeout(saveDraftTimer);
    saveDraftTimer = null;
    if (draft) saveDraft(conversation?.id || null, draft);
  }
  if (controller && streaming) {
    try {
      controller.abort();
    } catch {
      /* ignore */
    }
  }
  for (const cleanup of cleanupFns) {
    try {
      cleanup();
    } catch {
      /* ignore */
    }
  }
  cleanupFns = [];
  root?.removeEventListener('click', handleRootClick);
  root?.removeEventListener('input', onInput);
  root?.removeEventListener('keydown', onKeydown);
  inputEl = null;
  threadEl = null;
  scrollEl = null;
  root = null;
  ctx = null;
  streaming = false;
  controller = null;
}

export function isStreaming() {
  return streaming;
}

export function focusComposer() {
  inputEl?.focus();
}

void loadSettings;
