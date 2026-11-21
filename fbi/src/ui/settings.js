import { state, emit, on } from '../lib/state.js';
import * as db from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { TABLE, AUTO_MODEL } from '../lib/config.js';
import { THEMES } from '../lib/themes.js';
import { updateSettings } from '../lib/prefs.js';
import { redactKey, fetchFreeModels } from '../lib/openrouter.js';
import { signOut } from '../lib/supabase.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import {
  escapeHtml,
  copyText,
  download,
  formatNum,
  formatDateTime,
  prettyModel,
  safeFilename,
} from '../lib/utils.js';
import { action } from './actions.js';
import { openModal, closeModal, confirmDialog } from './overlay.js';
import { toast, toastError } from './toast.js';
import { openModelPicker, activeModels, syncFreeModels } from './models.js';
import { setDraft, focusComposer } from './composer.js';

const TABS = [
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'models', label: 'Models', icon: 'cpu' },
  { id: 'api', label: 'API key', icon: 'key' },
  { id: 'prompts', label: 'Prompts', icon: 'book' },
  { id: 'data', label: 'Data', icon: 'shield' },
];

let activeTab = 'appearance';
let modal = null;

export function initSettings() {
  action('open-settings', (el) => openSettings(el?.dataset?.tab || 'appearance'));
  action('open-prompts', () => openSettings('prompts'));
  on('settings:open', (tab) => openSettings(tab || 'appearance'));
  on('prompts:open', () => openSettings('prompts'));
}

export function openSettings(tab = 'appearance') {
  activeTab = TABS.some((x) => x.id === tab) ? tab : 'appearance';
  modal = openModal({
    title: t('Settings'),
    iconName: 'settings',
    tabs: TABS.map((x) => t(x.label)),
    className: 'wide tall',
    body: '<div id="settings-body"></div>',
    footer: `<div class="spacer"></div><button class="btn btn-primary btn-sm" data-action="close-modal">${t(
      'Done',
    )}</button>`,
  });

  const tabButtons = Array.from(modal.scrim.querySelectorAll('[data-modal-tab]'));
  tabButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      activeTab = TABS[index].id;
      syncTabs();
      draw();
    });
  });

  modal.bodyEl.addEventListener('click', onClick);
  modal.bodyEl.addEventListener('input', onInput);
  modal.bodyEl.addEventListener('change', onChange);

  syncTabs();
  draw();
  return modal;
}

function syncTabs() {
  if (!modal) return;
  const buttons = modal.scrim.querySelectorAll('[data-modal-tab]');
  buttons.forEach((btn, index) => btn.classList.toggle('active', TABS[index].id === activeTab));
}

function draw() {
  if (!modal || !modal.bodyEl.isConnected) return;
  modal.bodyEl.innerHTML = panelHtml(activeTab);
  if (activeTab === 'data') loadStats();
}

function currentSettings() {
  return state.settings || {};
}

/* ------------------------------- panels ---------------------------------- */

function panelHtml(tab) {
  if (tab === 'chat') return chatPanel();
  if (tab === 'models') return modelsPanel();
  if (tab === 'api') return apiPanel();
  if (tab === 'prompts') return promptsPanel();
  if (tab === 'data') return dataPanel();
  return appearancePanel();
}

function switchRow(label, hint, key, checked) {
  return `<div class="setting-row">
    <div class="setting-copy"><b>${escapeHtml(label)}</b>${hint ? `<span>${escapeHtml(hint)}</span>` : ''}</div>
    <div class="setting-control">
      <label class="switch"><input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''} /><span class="track"></span></label>
    </div>
  </div>`;
}

function rangeRow(label, hint, key, value, min, max, step) {
  return `<div class="setting-row">
    <div class="setting-copy"><b>${escapeHtml(label)}</b><span>${escapeHtml(hint)}</span></div>
    <div class="setting-control">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-setting="${key}" style="flex:1" />
      <span class="mono small" data-output="${key}" style="width:42px;text-align:end">${value}</span>
    </div>
  </div>`;
}

function appearancePanel() {
  const s = currentSettings();
  return `<div class="settings-grid">
    <div class="setting-group">
      <div class="sg-head">${icon('palette')} ${t('Theme')}</div>
      <div class="theme-grid">
        ${THEMES.map(
          (theme) => `<button type="button" class="theme-card ${s.theme === theme.id ? 'active' : ''}" data-theme-id="${theme.id}">
            <span class="theme-swatch">${theme.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
            <span class="theme-name">${escapeHtml(theme.name)}${s.theme === theme.id ? icon('check') : ''}</span>
          </button>`,
        ).join('')}
      </div>
    </div>

    <div class="setting-group">
      <div class="sg-head">${icon('globe')} ${t('Language & direction')}</div>
      <div class="setting-row">
        <div class="setting-copy"><b>${t('Interface language')}</b><span>${t(
          'Persian flips the whole interface to RTL. Message paragraphs always detect their own direction, line by line.',
        )}</span></div>
        <div class="setting-control">
          <button type="button" class="chip ${s.locale === 'en' ? 'is-accent' : ''}" data-locale="en">English</button>
          <button type="button" class="chip ${s.locale === 'fa' ? 'is-accent' : ''}" data-locale="fa">فارسی</button>
        </div>
      </div>
      ${rangeRow(t('Font size'), t('Scales interface text (0.85 – 1.25).'), 'fontScale', s.fontScale ?? 1, 0.85, 1.25, 0.05)}
      ${switchRow(t('Reduce motion'), t('Stops ambient glows, drifting blobs and entrance animations.'), 'reduceMotion', s.reduceMotion)}
    </div>

    <div class="setting-group">
      <div class="sg-head">${icon('sliders')} ${t('Quick defaults')}</div>
      ${rangeRow(t('Temperature'), t('Higher values wander further.'), 'temperature', s.temperature ?? 0.7, 0, 2, 0.05)}
      ${rangeRow(t('Top P'), t('Nucleus sampling cut-off.'), 'topP', s.topP ?? 1, 0.1, 1, 0.05)}
    </div>
  </div>`;
}

function chatPanel() {
  const s = currentSettings();
  return `<div class="settings-grid">
    <div class="setting-group">
      <div class="sg-head">${icon('message')} ${t('System prompt')}</div>
      <div class="field">
        <span class="hint">${t(
          'Included as the first system message in every new request, unless a chat has its own prompt (Chat menu → Parameters).',
        )}</span>
        <textarea class="textarea" data-setting="systemPrompt" rows="5" dir="auto" style="min-height:120px">${escapeHtml(
          s.systemPrompt || '',
        )}</textarea>
      </div>
    </div>

    <div class="setting-group">
      <div class="sg-head">${icon('sliders')} ${t('Generation')}</div>
      ${rangeRow(t('Temperature'), t('Creativity of the reply.'), 'temperature', s.temperature ?? 0.7, 0, 2, 0.05)}
      ${rangeRow(t('Top P'), t('Tokens considered per step.'), 'topP', s.topP ?? 1, 0.1, 1, 0.05)}
      <div class="setting-row">
        <div class="setting-copy"><b>${t('Max tokens')}</b><span>${t('Upper bound for one reply. Free models often cap around 4096.')}</span></div>
        <div class="setting-control">
          <input class="input" type="number" min="64" max="32000" step="64" value="${s.maxTokens ?? 2048}" data-setting="maxTokens" style="width:110px" />
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><b>${t('Reasoning effort')}</b><span>${t('Passed to models that support OpenRouter reasoning controls.')}</span></div>
        <div class="setting-control">
          <div class="select-wrap" style="flex:1"><select class="select" data-setting="reasoningEffort">
            ${['auto', 'off', 'low', 'medium', 'high']
              .map((v) => `<option value="${v}" ${s.reasoningEffort === v ? 'selected' : ''}>${t(v)}</option>`)
              .join('')}
          </select></div>
        </div>
      </div>
    </div>

    <div class="setting-group">
      <div class="sg-head">${icon('zap')} ${t('Behaviour')}</div>
      ${switchRow(t('Stream responses'), t('Token-by-token rendering with reasoning deltas.'), 'stream', s.stream !== false)}
      ${switchRow(t('Show reasoning'), t('Opens a collapsible pane above replies that expose their thinking.'), 'showReasoning', s.showReasoning !== false)}
      ${switchRow(t('Enter sends the message'), t('When off, use Ctrl/Cmd+Enter to send.'), 'sendOnEnter', s.sendOnEnter !== false)}
      ${switchRow(t('Name chats from the first message'), t('A local, free title — no extra API call.'), 'autoTitle', s.autoTitle !== false)}
      ${switchRow(t('Capture raw requests'), t('Stores the exact JSON payload and raw SSE stream on each reply for the inspector.'), 'keepRawRequest', s.keepRawRequest !== false)}
      ${switchRow(t('Lock resolved auto model'), t('openrouter/free resolves once, then that concrete model sticks to the chat.'), 'lockAutoModel', s.lockAutoModel !== false)}
    </div>
  </div>`;
}

function modelsPanel() {
  const s = currentSettings();
  const active = activeModels().length;
  const unavailable = state.models.filter((m) => m.available === false).length;
  return `<div class="settings-grid">
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${formatNum(state.models.length)}</div><div class="stat-label">${t('known models')}</div></div>
      <div class="stat-card"><div class="stat-num">${formatNum(active)}</div><div class="stat-label">${t('active')}</div></div>
      <div class="stat-card"><div class="stat-num">${formatNum(unavailable)}</div><div class="stat-label">${t('retired')}</div></div>
    </div>
    <div class="setting-group">
      <div class="sg-head">${icon('cpu')} ${t('Free model catalog')}</div>
      <p class="small" style="color:var(--muted);line-height:1.7;margin:0">
        ${t(
          'Syncing pulls OpenRouter’s public catalog, keeps only zero-cost models, and upserts on (user_id, model_id) — so a model is never duplicated. Models that disappear are marked retired instead of deleted, and your active/favourite choices are preserved.',
        )}
      </p>
      <div class="row wrap">
        <button type="button" class="btn btn-primary btn-sm" id="settings-sync">${icon('refresh')} ${t('Sync free models')}</button>
        <button type="button" class="btn btn-sm" id="settings-picker">${icon('cpu')} ${t('Manage models')}</button>
        <span class="muted tiny-text">${t('Default model')}: <span class="mono" dir="ltr">${escapeHtml(
          s.defaultModel || AUTO_MODEL,
        )}</span></span>
      </div>
    </div>
    <div class="setting-group">
      <div class="sg-head">${icon('lock')} ${t('Auto router')}</div>
      <p class="small" style="color:var(--muted);line-height:1.7;margin:0">
        ${t(
          'openrouter/free asks OpenRouter to choose any free model per request. Every reply still reports the concrete model that answered. Keep it pinned, or let the first reply lock the chat to that concrete model.',
        )}
      </p>
    </div>
  </div>`;
}

function apiPanel() {
  const key = state.profile?.openrouter_key || '';
  const active = activeModels().length;
  return `<div class="settings-grid">
    <div class="setting-group">
      <div class="sg-head">${icon('key')} ${t('OpenRouter API key')}</div>
      <div class="field">
        <label>${t('Key')}</label>
        <div style="position:relative">
          <input id="api-key-input" class="input" type="password" dir="ltr" placeholder="sk-or-v1-…" value="${escapeHtml(
            key,
          )}" style="padding-inline-end:42px" autocomplete="off" spellcheck="false" />
          <button type="button" class="icon-btn tiny" id="api-key-toggle" style="position:absolute;inset-inline-end:5px;top:50%;transform:translateY(-50%)" title="${t(
            'Show key',
          )}">${icon('eye')}</button>
        </div>
        <span class="hint">${t(
          'Stored only in your own fbai_profiles row, protected by row-level security. It is sent directly from this browser to OpenRouter — no intermediary server.',
        )}</span>
      </div>
      <div class="row wrap">
        <button type="button" class="btn btn-primary btn-sm" id="save-key">${icon('save')} ${t('Save key')}</button>
        <button type="button" class="btn btn-sm" id="test-key">${icon('activity')} ${t('Test connection')}</button>
        ${
          key
            ? `<button type="button" class="btn btn-ghost btn-sm btn-danger" id="clear-key">${icon('trash')} ${t(
                'Remove',
              )}</button>`
            : ''
        }
        <span class="muted tiny-text">${
          key ? `${t('Saved')} · <span class="mono" dir="ltr">${escapeHtml(redactKey(key))}</span>` : t('No key yet')
        }</span>
      </div>
      <div id="api-status"></div>
    </div>
    <div class="setting-group">
      <div class="sg-head">${icon('shield')} ${t('Good to know')}</div>
      <ul class="small" style="color:var(--muted);line-height:1.8;margin:0;padding-inline-start:1.2em">
        <li>${t('Create and rotate keys at openrouter.ai/keys. Use a key with a spending limit of zero — this app only requests free models.')}</li>
        <li>${t('Requests go straight to openrouter.ai with your key in an Authorization header; the app shows that header redacted.')}</li>
        <li>${t('A publishable Supabase key is public by design. Never put a service-role key in this project.')}</li>
      </ul>
      <div class="row"><a class="btn btn-sm" href="https://openrouter.ai/keys" target="_blank" rel="noopener">${icon(
        'external',
      )} ${t('Open OpenRouter keys')}</a></div>
    </div>
    <div class="setting-group">
      <div class="sg-head">${icon('info')} ${t('Status')}</div>
      <div class="row wrap">
        <span class="badge ${key ? 'ok' : 'warn'}">${key ? t('Key present') : t('Key missing')}</span>
        <span class="badge">${formatNum(active)} ${t('active models')}</span>
        <span class="badge">${formatNum(state.conversations.length)} ${t('chats')}</span>
      </div>
    </div>
  </div>`;
}

function promptsPanel() {
  return `<div class="settings-grid">
    <div class="setting-group">
      <div class="sg-head">${icon('book')} ${t('Prompt library')}</div>
      <div class="stack" style="gap:8px">
        <input class="input" id="prompt-title" placeholder="${t('Title (e.g. Code review)')}" dir="auto" />
        <textarea class="textarea" id="prompt-body" placeholder="${t('The prompt text…')}" dir="auto" style="min-height:90px"></textarea>
        <div class="row"><button type="button" class="btn btn-primary btn-sm" id="prompt-add">${icon('plus')} ${t(
          'Add prompt',
        )}</button><span class="muted tiny-text">${t('Saved prompts are reusable from the composer and this list.')}</span></div>
      </div>
    </div>
    <div class="setting-group">
      <div class="sg-head">${icon('layers')} ${t('Saved')} · ${state.prompts.length}</div>
      <div class="stack" style="gap:8px">
        ${
          state.prompts.length
            ? state.prompts
                .map(
                  (p) => `<div class="ctx-msg" style="align-items:flex-start">
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:600;font-size:.82rem;margin-bottom:2px" dir="auto">${escapeHtml(p.title)}</div>
                      <div class="small muted" dir="auto" style="white-space:pre-wrap;max-height:80px;overflow:hidden">${escapeHtml(
                        p.body,
                      )}</div>
                    </div>
                    <div class="row" style="gap:2px">
                      <button type="button" class="icon-btn tiny" data-prompt-use="${p.id}" title="${t('Use')}">${icon(
                        'arrowUpRight',
                      )}</button>
                      <button type="button" class="icon-btn tiny" data-prompt-delete="${p.id}" title="${t(
                        'Delete',
                      )}">${icon('trash')}</button>
                    </div>
                  </div>`,
                )
                .join('')
            : `<div class="conv-empty">${t('No saved prompts yet.')}</div>`
        }
      </div>
    </div>
  </div>`;
}

function dataPanel() {
  return `<div class="settings-grid">
    <div class="setting-group">
      <div class="sg-head">${icon('user')} ${t('Account')}</div>
      <div class="row wrap" style="justify-content:space-between">
        <div style="min-width:0">
          <div style="font-weight:600" dir="auto">${escapeHtml(state.profile?.display_name || 'Explorer')}</div>
          <div class="muted small" dir="ltr">${escapeHtml(state.user?.email || '')}</div>
        </div>
        <button type="button" class="btn btn-sm" id="copy-user-id">${icon('copy')} ${t('Copy user ID')}</button>
      </div>
      <div class="row wrap">
        <span class="badge">${formatNum(state.conversations.length)} ${t('chats')}</span>
        <span class="badge">${formatNum(state.models.length)} ${t('models')}</span>
        <span class="badge">${formatNum(state.prompts.length)} ${t('prompts')}</span>
      </div>
    </div>

    <div class="setting-group">
      <div class="sg-head">${icon('activity')} ${t('Usage')}</div>
      <div id="stats-holder"><div class="skeleton" style="height:80px"></div></div>
    </div>

    <div class="setting-group">
      <div class="sg-head">${icon('download')} ${t('Backup & transfer')}</div>
      <div class="row wrap">
        <button type="button" class="btn btn-sm" id="export-all">${icon('download')} ${t(
          'Export everything (JSON)',
        )}</button>
        <button type="button" class="btn btn-sm" id="import-trigger">${icon('upload')} ${t('Import JSON')}</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
      </div>
      <span class="hint">${t(
        'The export contains conversations, every branch and message, and your prompts. API keys are never included.',
      )}</span>
    </div>

    <div class="setting-group" style="border-color:rgba(var(--err),.3)">
      <div class="sg-head" style="color:rgb(var(--err))">${icon('alert')} ${t('Danger zone')}</div>
      <div class="setting-row">
        <div class="setting-copy"><b>${t('Delete all chats')}</b><span>${t(
          'Removes every conversation and message for your account. Models and prompts stay.',
        )}</span></div>
        <div class="setting-control" style="justify-content:flex-end">
          <button type="button" class="btn btn-danger btn-sm" id="delete-all">${t('Delete all chats')}</button>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-copy"><b>${t('Sign out')}</b><span>${t('End this browser session.')}</span></div>
        <div class="setting-control" style="justify-content:flex-end">
          <button type="button" class="btn btn-sm" id="sign-out-settings">${icon('logout')} ${t('Sign out')}</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ----------------------------- interactions ------------------------------ */

async function onClick(event) {
  const target = event.target;

  const themeEl = target.closest('[data-theme-id]');
  if (themeEl) {
    updateSettings({ theme: themeEl.dataset.themeId });
    draw();
    return;
  }

  const localeEl = target.closest('[data-locale]');
  if (localeEl) {
    updateSettings({ locale: localeEl.dataset.locale });
    syncTabs();
    draw();
    emit('conversations-changed');
    return;
  }

  if (target.closest('#api-key-toggle')) {
    const input = modal.bodyEl.querySelector('#api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
    return;
  }

  if (target.closest('#save-key')) return saveKey();
  if (target.closest('#clear-key')) return saveKey('');

  if (target.closest('#test-key')) {
    const input = modal.bodyEl.querySelector('#api-key-input');
    const key = input.value.trim();
    const status = modal.bodyEl.querySelector('#api-status');
    if (!key) {
      status.innerHTML = `<div class="auth-msg err" style="margin-top:10px">${t('Paste a key first.')}</div>`;
      return;
    }
    status.innerHTML = `<div class="auth-msg ok" style="margin-top:10px">${t('Contacting OpenRouter…')}</div>`;
    try {
      const { all, free } = await fetchFreeModels(key);
      status.innerHTML = `<div class="auth-msg ok" style="margin-top:10px">${t(
        'Connected. {all} models visible, {free} of them free.',
        { all, free: free.length },
      )}</div>`;
    } catch (error) {
      status.innerHTML = `<div class="auth-msg err" style="margin-top:10px">${escapeHtml(error.message)}</div>`;
    }
    return;
  }

  if (target.closest('#settings-sync')) {
    const btn = target.closest('#settings-sync');
    btn.disabled = true;
    await syncFreeModels();
    draw();
    return;
  }
  if (target.closest('#settings-picker')) {
    openModelPicker();
    return;
  }

  if (target.closest('#prompt-add')) {
    const title = modal.bodyEl.querySelector('#prompt-title').value.trim();
    const body = modal.bodyEl.querySelector('#prompt-body').value.trim();
    if (!title || !body) {
      toast(t('A prompt needs both a title and text.'), { type: 'err' });
      return;
    }
    try {
      const row = await db.createPrompt(state.user.id, title, body);
      state.prompts.unshift(row);
      draw();
      toast(t('Prompt saved.'), { type: 'ok' });
    } catch (error) {
      toastError(t('Could not save the prompt'), error);
    }
    return;
  }

  const usePrompt = target.closest('[data-prompt-use]');
  if (usePrompt) {
    const prompt = state.prompts.find((p) => p.id === usePrompt.dataset.promptUse);
    if (prompt) {
      setDraft(prompt.body);
      closeModal();
      focusComposer();
      toast(t('Prompt loaded into the composer.'), { type: 'info' });
    }
    return;
  }

  const delPrompt = target.closest('[data-prompt-delete]');
  if (delPrompt) {
    const prompt = state.prompts.find((p) => p.id === delPrompt.dataset.promptDelete);
    const ok = await confirmDialog({
      title: t('Delete prompt'),
      message: t('Delete “{title}” from your prompt library?', { title: prompt?.title || '' }),
      confirmLabel: t('Delete'),
    });
    if (!ok) return;
    try {
      await db.deletePrompt(delPrompt.dataset.promptDelete);
      state.prompts = state.prompts.filter((p) => p.id !== delPrompt.dataset.promptDelete);
      draw();
    } catch (error) {
      toastError(t('Could not delete the prompt'), error);
    }
    return;
  }

  if (target.closest('#export-all')) return exportAll();
  if (target.closest('#import-trigger')) {
    modal.bodyEl.querySelector('#import-file')?.click();
    return;
  }
  if (target.closest('#copy-user-id')) {
    const ok = await copyText(state.user?.id || '');
    toast(ok ? t('User ID copied.') : t('Copy failed.'), { type: ok ? 'ok' : 'err' });
    return;
  }
  if (target.closest('#delete-all')) return deleteAllChats();
  if (target.closest('#sign-out-settings')) {
    await signOut();
    return;
  }
}

function onInput(event) {
  const el = event.target.closest('[data-setting]');
  if (!el) return;
  if (el.type === 'checkbox' || el.tagName === 'SELECT') return;
  const key = el.dataset.setting;
  const value = el.type === 'range' || el.type === 'number' ? Number(el.value) : el.value;
  updateSettings({ [key]: value });
  const out = modal?.bodyEl.querySelector(`[data-output="${key}"]`);
  if (out) out.textContent = el.type === 'range' ? Number(el.value).toFixed(2).replace(/\.00$/, '') : el.value;
}

function onChange(event) {
  const el = event.target.closest('[data-setting]');
  if (!el) return;
  if (el.type === 'checkbox') {
    updateSettings({ [el.dataset.setting]: el.checked });
  } else if (el.tagName === 'SELECT') {
    updateSettings({ [el.dataset.setting]: el.value });
  }
  if (event.target.closest('#import-file')) importFile(event.target.files?.[0]);
}

async function saveKey(valueOverride) {
  if (!state.user) return;
  const input = modal.bodyEl.querySelector('#api-key-input');
  const value = valueOverride !== undefined ? valueOverride : (input?.value || '').trim();
  try {
    await db.saveKey(state.user.id, value);
    state.profile.openrouter_key = value || null;
    toast(value ? t('OpenRouter key saved.') : t('Key removed.'), { type: 'ok' });
    draw();
    if (value) syncFreeModels({ silent: false });
  } catch (error) {
    toastError(t('Could not save the key'), error);
  }
}

let statsLoaded = false;
async function loadStats() {
  const holder = modal?.bodyEl.querySelector('#stats-holder');
  if (!holder) return;
  try {
    const usage = await db.loadUsage(state.user.id);
    if (!holder.isConnected) return;
    const totals = usage.reduce(
      (acc, row) => {
        acc.total += row.total_tokens || 0;
        acc.prompt += row.prompt_tokens || 0;
        acc.completion += row.completion_tokens || 0;
        return acc;
      },
      { total: 0, prompt: 0, completion: 0 },
    );
    const byModel = new Map();
    for (const row of usage) {
      const key = row.model || 'unknown';
      byModel.set(key, (byModel.get(key) || 0) + 1);
    }
    const top = [...byModel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = top[0]?.[1] || 1;
    holder.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${formatNum(usage.length)}</div><div class="stat-label">${t(
          'replies',
        )}</div></div>
        <div class="stat-card"><div class="stat-num">${formatNum(totals.total)}</div><div class="stat-label">${t(
          'tokens',
        )}</div></div>
        <div class="stat-card"><div class="stat-num">${formatNum(totals.prompt)}</div><div class="stat-label">${t(
          'prompt',
        )}</div></div>
        <div class="stat-card"><div class="stat-num">${formatNum(totals.completion)}</div><div class="stat-label">${t(
          'completion',
        )}</div></div>
      </div>
      ${
        top.length
          ? `<div class="bar-list" style="margin-top:14px">${top
              .map(
                ([model, count]) => `<div class="bar-item">
                  <span class="bar-name" title="${escapeHtml(model)}">${escapeHtml(model)}</span>
                  <span class="bar-track"><span class="bar-fill" style="width:${Math.round(
                    (count / max) * 100,
                  )}%"></span></span>
                  <span class="bar-num">${formatNum(count)}</span>
                </div>`,
              )
              .join('')}</div>`
          : `<div class="conv-empty" style="margin-top:10px">${t('No completed replies yet.')}</div>`
      }`;
    statsLoaded = true;
  } catch (error) {
    if (holder.isConnected) holder.innerHTML = `<div class="auth-msg err">${escapeHtml(error.message)}</div>`;
  }
}

async function exportAll() {
  try {
    const [{ data: conversations, error: convError }, { data: messages, error: msgError }] = await Promise.all([
      supabase.from(TABLE.conversations).select('*').eq('user_id', state.user.id),
      supabase
        .from(TABLE.messages)
        .select('*')
        .eq('user_id', state.user.id)
        .order('created_at', { ascending: true })
        .limit(20000),
    ]);
    if (convError) throw convError;
    if (msgError) throw msgError;
    const payload = {
      app: 'Nebula AI Studio',
      version: 1,
      exported_at: new Date().toISOString(),
      profile: { display_name: state.profile?.display_name || '' },
      prompts: state.prompts,
      conversations: (conversations || []).map((conv) => ({
        ...conv,
        messages: (messages || []).filter((m) => m.conversation_id === conv.id),
      })),
    };
    download(
      safeFilename(`nebula-backup-${new Date().toISOString().slice(0, 10)}`, 'json'),
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    toast(t('Backup downloaded.'), { type: 'ok' });
  } catch (error) {
    toastError(t('Export failed'), error);
  }
}

async function importFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed.conversations)
      ? parsed.conversations
      : parsed.conversation
        ? [{ ...parsed.conversation, messages: parsed.messages || [] }]
        : Array.isArray(parsed)
          ? parsed
          : null;
    if (!entries) throw new Error(t('This file does not look like a Nebula export.'));

    let imported = 0;
    for (const entry of entries) {
      const conv = await db.createConversation(state.user.id, {
        title: entry.title || 'Imported chat',
        model_id: entry.model_id || AUTO_MODEL,
        lock_auto_model: entry.lock_auto_model !== false,
        system_prompt: entry.system_prompt || null,
        params: entry.params || {},
        pinned: Boolean(entry.pinned),
        archived: Boolean(entry.archived),
      });
      const rows = [...(entry.messages || [])].sort(
        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
      );
      const idMap = new Map();
      for (const row of rows) {
        const inserted = await db.insertMessage({
          conversation_id: conv.id,
          user_id: state.user.id,
          parent_id: row.parent_id ? idMap.get(row.parent_id) || null : null,
          role: row.role === 'assistant' ? 'assistant' : row.role === 'system' ? 'system' : 'user',
          content: row.content || '',
          reasoning: row.reasoning || null,
          model: row.model || null,
          requested_model: row.requested_model || null,
          status: row.status === 'streaming' ? 'complete' : row.status || 'complete',
          error: row.error || null,
          prompt_tokens: row.prompt_tokens ?? null,
          completion_tokens: row.completion_tokens ?? null,
          total_tokens: row.total_tokens ?? null,
        });
        idMap.set(row.id, inserted.id);
      }
      imported++;
    }
    state.conversations = await db.listConversations(state.user.id);
    emit('conversations-changed');
    draw();
    toast(t('Imported {n} conversations.', { n: imported }), { type: 'ok' });
  } catch (error) {
    toastError(t('Import failed'), error);
  }
}

async function deleteAllChats() {
  const ok = await confirmDialog({
    title: t('Delete all chats'),
    message: t('This permanently deletes every conversation and message in your account.'),
    confirmLabel: t('Delete everything'),
    details: t('Models, prompts and settings are kept.'),
  });
  if (!ok) return;
  try {
    await db.deleteAllConversations(state.user.id);
    state.conversations = [];
    state.conversation = null;
    state.messages = [];
    state.leafId = null;
    emit('conversations-changed');
    emit('conversation-changed');
    emit('chat:new');
    closeModal();
    toast(t('All chats deleted.'), { type: 'ok' });
  } catch (error) {
    toastError(t('Could not delete chats'), error);
  }
}
