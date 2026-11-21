import { state, on } from '../lib/state.js';
import { icon } from '../lib/icons.js';
import { t, getLocale } from '../lib/i18n.js';
import { estimateTokens, escapeHtml, formatNum } from '../lib/utils.js';
import { effectiveModelId, modelLabel, openModelPicker } from './models.js';
import { toast } from './toast.js';

let draft = '';
let attachments = [];
let els = null;
let mounted = false;
let subscriptionsBound = false;

const PLACEHOLDERS = {
  en: 'Ask anything. Shift+Enter for a new line…',
  fa: 'هر چیزی بپرسید. برای خط جدید Shift+Enter…',
};

function locale() {
  return getLocale();
}

export function renderComposer(mount) {
  if (!mount) return;
  mount.innerHTML = `
    <div class="composer" id="composer">
      <div class="composer-inner">
        <div class="attachments" id="composer-attachments"></div>
        <textarea id="composer-input" rows="1" dir="auto" autocomplete="off" spellcheck="true"
          placeholder="${escapeHtml(PLACEHOLDERS[locale()] || PLACEHOLDERS.en)}"></textarea>
        <div class="composer-bar">
          <button type="button" class="chip" id="composer-model" title="${t('Switch model')}">
            ${icon('cpu')}<span class="truncate" id="composer-model-label">${t('Auto router')}</span>
          </button>
          <button type="button" class="chip" id="composer-params" title="${t('Model parameters')}">
            ${icon('sliders')}<span id="composer-effort">${t('params')}</span>
          </button>
          <button type="button" class="chip" id="composer-prompts" title="${t('Prompt library')}">
            ${icon('book')}<span class="hide-sm" id="composer-prompts-label">${t('Prompts')}</span>
          </button>
          <span class="spacer"></span>
          <span class="char-count" id="composer-count">0</span>
          <button type="button" class="icon-btn" id="composer-attach" title="${t('Attach text file')}">${icon('paperclip')}</button>
          <button type="button" class="icon-btn" id="composer-inspect" title="${t('View request')}">${icon('eye')}</button>
          <button type="button" class="send-btn" id="composer-send" title="${t('Send')}">${icon('send')}</button>
        </div>
      </div>
      <div class="composer-hint">
        <span id="composer-hint-keys">${t('Enter to send')} <span class="sep">·</span> Shift+Enter ${t('new line')}</span>
        <span class="sep">·</span>
        <span id="composer-lock-note">${t('Free models only')}</span>
      </div>
    </div>
    <input type="file" id="composer-file" accept=".txt,.md,.markdown,.json,.csv,.log,.yaml,.yml,.xml,.html,.css,.js,.mjs,.ts,.tsx,.jsx,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.sh,.sql,.toml,.ini,.env" multiple hidden />`;

  els = {
    root: mount.querySelector('#composer'),
    input: mount.querySelector('#composer-input'),
    count: mount.querySelector('#composer-count'),
    send: mount.querySelector('#composer-send'),
    model: mount.querySelector('#composer-model'),
    modelLabel: mount.querySelector('#composer-model-label'),
    params: mount.querySelector('#composer-params'),
    effort: mount.querySelector('#composer-effort'),
    prompts: mount.querySelector('#composer-prompts'),
    attach: mount.querySelector('#composer-attach'),
    inspect: mount.querySelector('#composer-inspect'),
    file: mount.querySelector('#composer-file'),
    attachmentsEl: mount.querySelector('#composer-attachments'),
    lockNote: mount.querySelector('#composer-lock-note'),
    promptsLabel: mount.querySelector('#composer-prompts-label'),
    hintKeys: mount.querySelector('#composer-hint-keys'),
  };

  mounted = true;
  wire();
  updateComposer();
  return els;
}

function wire() {
  const { input, send, model, params, prompts, attach, inspect, file } = els;

  input.addEventListener('input', () => {
    draft = input.value;
    autosize();
    updateComposer();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (event.isComposing) return;
    const wantSend = event.metaKey || event.ctrlKey || (state.settings?.sendOnEnter !== false && !event.shiftKey);
    if (wantSend) {
      event.preventDefault();
      trySend();
    }
  });

  send.addEventListener('click', () => {
    if (state.streaming) window.dispatchEvent(new CustomEvent('composer:stop'));
    else trySend();
  });

  model.addEventListener('click', () => openModelPicker());
  params.addEventListener('click', () => window.dispatchEvent(new CustomEvent('composer:params')));
  prompts.addEventListener('click', () => window.dispatchEvent(new CustomEvent('composer:prompts')));
  inspect.addEventListener('click', () => window.dispatchEvent(new CustomEvent('composer:preview')));

  attach.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const files = Array.from(file.files || []);
    await addFiles(files);
    file.value = '';
  });

  els.root.addEventListener('dragover', (event) => {
    event.preventDefault();
    els.root.style.borderColor = 'rgba(var(--a2), .7)';
  });
  els.root.addEventListener('dragleave', () => {
    els.root.style.borderColor = '';
  });
  els.root.addEventListener('drop', async (event) => {
    event.preventDefault();
    els.root.style.borderColor = '';
    await addFiles(Array.from(event.dataTransfer?.files || []));
  });

  if (!subscriptionsBound) {
    subscriptionsBound = true;
    on('settings-changed', () => updateComposer());
    on('models-changed', () => updateComposer());
    on('conversation-changed', () => updateComposer());
  }
  autosize();
}

async function addFiles(files) {
  if (!files.length) return;
  for (const file of files.slice(0, 4)) {
    if (attachments.length >= 3) {
      toast(t('Up to 3 text attachments per message.'), { type: 'info' });
      break;
    }
    if (file.size > 220_000) {
      toast(t('{name} is larger than 220 KB and was skipped.', { name: file.name }), { type: 'err' });
      continue;
    }
    try {
      const content = await file.text();
      attachments.push({ name: file.name, size: file.size, content });
    } catch {
      toast(t('Could not read {name}.', { name: file.name }), { type: 'err' });
    }
  }
  renderAttachments();
  updateComposer();
}

function renderAttachments() {
  if (!els) return;
  els.attachmentsEl.innerHTML = attachments
    .map(
      (att, index) => `<span class="attachment">${icon('file')}<span class="name">${escapeHtml(
        att.name,
      )}</span><span class="tiny-text muted">${formatNum(att.size)}b</span><button type="button" data-remove-attachment="${index}" aria-label="Remove">${icon(
        'x',
      )}</button></span>`,
    )
    .join('');
  els.attachmentsEl.querySelectorAll('[data-remove-attachment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      attachments.splice(Number(btn.dataset.removeAttachment), 1);
      renderAttachments();
      updateCount();
    });
  });
}

function autosize() {
  if (!els) return;
  const ta = els.input;
  ta.style.height = 'auto';
  ta.style.height = `${Math.min(ta.scrollHeight || 30, Math.round(window.innerHeight * 0.42))}px`;
}

function updateCount() {
  if (!els) return;
  const chars = els.input.value.length;
  const tokens = estimateTokens(els.input.value + attachments.map((a) => a.content).join('\n'));
  els.count.textContent = chars ? `${formatNum(chars)} · ~${formatNum(tokens)} tok` : '';
  els.count.classList.toggle('warn', chars > 12000);
}

function trySend() {
  if (state.streaming) return;
  const text = els?.input.value || '';
  if (!text.trim() && !attachments.length) {
    els?.input.focus();
    return;
  }
  window.dispatchEvent(
    new CustomEvent('composer:send', {
      detail: { text, attachments: attachments.map((a) => ({ ...a })) },
    }),
  );
}

export function updateComposer() {
  if (!mounted || !els) return;
  const streaming = Boolean(state.streaming);
  els.send.classList.toggle('stop', streaming);
  els.send.innerHTML = streaming ? icon('stop') : icon('send');
  els.send.title = streaming ? t('Stop') : t('Send');
  els.send.disabled = !streaming && !els.input.value.trim() && !attachments.length;

  const modelId = effectiveModelId();
  els.modelLabel.textContent = modelLabel(modelId);
  const record = state.models.find((m) => m.model_id === modelId);
  els.model.title = `${t('Model')}: ${modelId}${record?.context_length ? ` · ${formatNum(record.context_length)} ctx` : ''}`;

  const params = { ...(state.conversation?.params || {}) };
  const effort = params.reasoningEffort || state.settings?.reasoningEffort || 'auto';
  const temp = params.temperature ?? state.settings?.temperature;
  els.effort.textContent = `${effort === 'auto' ? t('auto') : t(effort)} · ${Number(temp ?? 0.7).toFixed(2)}`;

  const lock = state.conversation ? state.conversation.lock_auto_model : state.settings?.lockAutoModel;
  els.lockNote.innerHTML = lock
    ? `${t('Auto model locks after first reply')}`
    : `${t('openrouter/free stays pinned')}`;

  els.input.placeholder = PLACEHOLDERS[locale()] || PLACEHOLDERS.en;
  if (els.promptsLabel) els.promptsLabel.textContent = t('Prompts');
  if (els.hintKeys) {
    els.hintKeys.innerHTML = `${t('Enter to send')} <span class="sep">·</span> Shift+Enter ${t('new line')}`;
  }
  els.attach.title = t('Attach text file');
  els.inspect.title = t('View request');
  updateCount();
  autosize();
}

export function clearComposer() {
  draft = '';
  attachments = [];
  if (els) {
    els.input.value = '';
    renderAttachments();
    autosize();
    updateCount();
    updateComposer();
  }
}

export function resetComposer() {
  clearComposer();
}

export function getDraft() {
  return els?.input.value ?? draft;
}

export function getAttachments() {
  return attachments.map((a) => ({ ...a }));
}

export function setDraft(text) {
  draft = String(text || '');
  if (!els) return;
  els.input.value = draft;
  autosize();
  updateCount();
  updateComposer();
  els.input.focus();
  els.input.setSelectionRange(els.input.value.length, els.input.value.length);
}

export function focusComposer() {
  els?.input.focus({ preventScroll: false });
}
