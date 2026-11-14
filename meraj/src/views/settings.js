/** Settings: OpenRouter key, defaults, appearance, account, data, diagnostics. */
import { ACCENTS, CONFIG, THEMES } from '../config.js';
import { state, setState } from '../store.js';
import * as db from '../services/db.js';
import { checkSchema } from '../services/db.js';
import { signOut, updatePassword, updateUserMetadata, userDisplayName } from '../services/auth.js';
import { testApiKey } from '../services/openrouter.js';
import {
  clearApiKey,
  getApiKey,
  maskKey,
  saveSettings,
  setApiKey,
} from '../services/settings.js';
import { applyAppearance } from '../ui/theme.js';
import { icon, logoMark } from '../ui/icons.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { reportError, openErrorDialog } from '../ui/errorDialog.js';
import { eventsToCsv } from '../services/export.js';
import {
  copyText,
  download,
  escapeHtml,
  formatDateTime,
  formatNumber,
  formatTokens,
} from '../utils.js';

let rootEl = null;
let ctx = null;
let testState = null;
let testing = false;
let diagnostics = null;
let diagnosticsRunning = false;
let exporting = false;

const SECTIONS = [
  ['openrouter', 'OpenRouter', 'key'],
  ['defaults', 'Defaults', 'sliders'],
  ['appearance', 'Appearance', 'sun'],
  ['account', 'Account', 'user'],
  ['data', 'Data & privacy', 'database'],
  ['diagnostics', 'Diagnostics', 'activity'],
  ['about', 'About', 'spark'],
];

function keyStatus() {
  const key = getApiKey();
  if (!key) {
    return `<span class="status-dot status-dot--warn"></span> Not connected`;
  }
  return `<span class="status-dot status-dot--ok"></span> Key stored on this device · <code>${escapeHtml(maskKey(key))}</code>`;
}

function renderTestResult() {
  if (testing) {
    return `<div class="key-test key-test--loading"><span class="boot-spinner boot-spinner--small"></span><p>Contacting OpenRouter's <code>/key</code> endpoint…</p></div>`;
  }
  if (!testState) {
    return `<div class="key-test key-test--idle">${icon('shield', { size: 17 })}<p>Test the key to see OpenRouter's real response, including limits and request IDs. Nothing is stored except this page's state.</p></div>`;
  }
  if (testState.error) {
    return `<div class="key-test key-test--error">
      <div class="key-test__head">${icon('xCircle', { size: 18 })}<strong>The browser could not reach OpenRouter</strong><span class="mono">${escapeHtml(testState.error.name)}</span></div>
      <p>${escapeHtml(testState.error.message)}</p>
      <p class="field-help">No HTTP response was received. This is not an OpenRouter response body.</p>
    </div>`;
  }
  const raw = testState.bodyText || '';
  const parsed = testState.parsed;
  const data = parsed?.data || parsed || {};
  return `<div class="key-test ${testState.ok ? 'key-test--ok' : 'key-test--error'}">
    <div class="key-test__head">
      ${icon(testState.ok ? 'checkCircle' : 'xCircle', { size: 18 })}
      <strong>${testState.ok ? 'OpenRouter accepted the key' : 'OpenRouter rejected the request'}</strong>
      <span class="mono">HTTP ${escapeHtml(testState.status)} ${escapeHtml(testState.statusText || '')}</span>
      <span class="mono muted">${testState.latencyMs} ms</span>
    </div>
    ${testState.ok && data ? `<div class="key-test__facts">
      <div><span>Label</span><strong>${escapeHtml(data.label || 'not reported')}</strong></div>
      <div><span>Usage</span><strong>${formatNumber(data.usage ?? 0)}</strong></div>
      <div><span>Limit</span><strong>${data.limit === null || data.limit === undefined ? 'unlimited / not reported' : formatNumber(data.limit)}</strong></div>
      <div><span>Free tier</span><strong>${data.is_free_tier === undefined ? 'not reported' : data.is_free_tier ? 'yes' : 'no'}</strong></div>
    </div>` : ''}
    <div class="key-test__raw-head"><span>Exact response body</span>${testState.requestId ? `<code class="mono">request-id: ${escapeHtml(testState.requestId)}</code>` : ''}</div>
    <pre class="verbatim verbatim--small" tabindex="0">${escapeHtml(raw || '(empty body)')}</pre>
    <p class="field-help">${icon('info', { size: 13 })} ${testState.ok ? 'The key is valid for this request. Free-model calls may still be rate-limited or blocked by account privacy settings; those errors appear on the message itself.' : 'The raw body above is authoritative. The key is stored only in this browser. Check that it is an OpenRouter key and not a Supabase key.'}</p>
  </div>`;
}

function switchControl(setting, label, description, value) {
  return `<label class="setting-row setting-row--switch">
    <span class="setting-row__copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span></span>
    <button type="button" class="switch ${value ? 'is-on' : ''}" role="switch" aria-checked="${value}" data-setting="${escapeHtml(setting)}" data-type="boolean"><span class="switch__track"><span class="switch__thumb"></span></span><span>${value ? 'On' : 'Off'}</span></button>
  </label>`;
}

function render() {
  if (!rootEl) return;
  const settings = state.settings || {};
  const profileName = userDisplayName(state.user, state.profile);
  const activeModels = state.models.filter((model) => model.is_active !== false);
  const defaultModel = settings.defaultModel || CONFIG.defaults.model;
  const modelOptions = activeModels.length ? activeModels : [{ slug: 'openrouter/free', name: 'Free Models Router', is_active: true }];
  if (!modelOptions.some((model) => model.slug === defaultModel)) {
    modelOptions.unshift({ slug: defaultModel, name: defaultModel, extra: true });
  }

  rootEl.innerHTML = `<div class="page settings-page" id="settings-page">
    <header class="page-head">
      <button type="button" class="icon-btn page-menu" data-open-sidebar aria-label="Open conversations">${icon('menu', { size: 19 })}</button>
      <div class="page-head__copy">
        <p class="eyebrow"><span class="eyebrow__line"></span> The instrument panel</p>
        <h1>Settings & observatory</h1>
        <p>Connect your own key, tune defaults, shape the interface, and inspect the plumbing. Nothing here is decorative: every switch changes real behaviour.</p>
      </div>
      <div class="page-head__actions">
        <button type="button" class="btn btn--ghost" data-run-diagnostics>${icon('activity', { size: 15 })}<span>Run diagnostics</span></button>
      </div>
    </header>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">
        ${SECTIONS.map(([id, label, iconName], index) => `<a href="#settings-${id}" data-scroll-section="settings-${id}"><span>${String(index + 1).padStart(2, '0')}</span>${icon(iconName, { size: 14 })}${label}</a>`).join('')}
        <div class="settings-nav__foot">v${escapeHtml(CONFIG.app.version)}<br><span>RLS · ${escapeHtml(state.schema.status)}</span></div>
      </nav>

      <div class="settings-sections">
        <section class="settings-card" id="settings-openrouter">
          <div class="settings-card__head">
            <span class="settings-card__icon">${icon('key', { size: 20 })}</span>
            <div><p class="eyebrow">01 · Credential</p><h2>OpenRouter connection</h2><p>Your key is the only credential the app needs from you. It is kept on this device and used directly against OpenRouter.</p></div>
            <span class="key-status" id="key-status-line">${keyStatus()}</span>
          </div>
          <div class="key-form">
            <label class="field"><span>OpenRouter API key</span><div class="input-wrap">${icon('lock', { size: 16 })}<input id="openrouter-key" class="input" type="password" placeholder="${getApiKey() ? 'A key is already stored — paste a new one to replace it' : 'sk-or-v1-…'}" autocomplete="off" spellcheck="false"><button type="button" class="input-action" data-toggle-key aria-label="Show key">${icon('eye', { size: 16 })}</button></div></label>
            <div class="key-form__row">
              <label class="checkline"><input type="checkbox" id="remember-key" ${settings.rememberKey !== false ? 'checked' : ''} data-remember-key><span>Remember on this device</span></label>
              <span class="muted tiny">${icon('info', { size: 13 })} If unchecked, the key is kept only for this tab session.</span>
            </div>
            <div class="key-form__actions">
              <button type="button" class="btn btn--primary" data-save-key>${icon('check', { size: 15 })}<span>Save key</span></button>
              <button type="button" class="btn btn--ghost" data-test-key ${testing ? 'disabled' : ''}>${icon(testing ? 'loader' : 'zap', { size: 15, className: testing ? 'spin' : '' })}<span>${testing ? 'Testing…' : 'Test key'}</span></button>
              <button type="button" class="btn btn--ghost btn--danger-text" data-clear-key>${icon('trash', { size: 15 })}<span>Forget key</span></button>
              <a class="link-btn key-link" href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">${icon('external', { size: 13 })} Get an OpenRouter key</a>
            </div>
            <p class="field-help">${icon('shieldCheck', { size: 13 })} The key never enters Supabase, an error message, a request archive, or a log. The request inspector displays the Authorization header as <code>Bearer [REDACTED]</code>. Testing calls <code>GET /api/v1/key</code> and shows its raw response.</p>
          </div>
          <div id="key-test-panel">${renderTestResult()}</div>
        </section>

        <section class="settings-card" id="settings-defaults">
          <div class="settings-card__head"><span class="settings-card__icon">${icon('sliders', { size: 20 })}</span><div><p class="eyebrow">02 · Defaults</p><h2>New conversation defaults</h2><p>Applied when you start a new chat. Per-conversation prompts and parameters override these.</p></div></div>
          <div class="settings-form-grid">
            <label class="field field--wide"><span>Default model</span><select id="default-model" class="input input--select">${modelOptions.map((model) => `<option value="${escapeHtml(model.slug)}" ${model.slug === defaultModel ? 'selected' : ''}>${escapeHtml(model.name)}${model.is_active === false ? ' (inactive)' : ''}</option>`).join('')}</select><span class="field-help">Only active models are listed. Manage the catalogue in <a href="#/models">Model atelier</a>.</span></label>
            <label class="field field--wide"><span>Default system prompt <em>optional</em></span><textarea id="default-system" class="input textarea" rows="4" placeholder="e.g. Be concise. State assumptions. Never invent sources.">${escapeHtml(settings.systemPrompt || '')}</textarea></label>
            <div class="param-row field--wide">
              <div class="param-head"><label for="default-temperature">Default temperature</label><output id="out-default-temp">${Number(settings.params?.temperature ?? 0.7).toFixed(2)}</output></div>
              <input type="range" id="default-temperature" min="0" max="2" step="0.05" value="${Number(settings.params?.temperature ?? 0.7)}">
            </div>
            <label class="field"><span>Default max reply tokens</span><input id="default-max-tokens" class="input" type="number" min="16" max="262144" step="16" value="${Number(settings.params?.max_tokens ?? 2048)}"></label>
            <label class="field"><span>Reasoning effort</span><select id="default-reasoning" class="input">${['off', 'low', 'medium', 'high'].map((value) => `<option value="${value}" ${(settings.params?.reasoning || 'off') === value ? 'selected' : ''}>${value}</option>`).join('')}</select><span class="field-help">Sent only when the selected model advertises reasoning support.</span></label>
          </div>
          <div class="settings-actions"><button type="button" class="btn btn--primary" data-save-defaults>${icon('check', { size: 15 })}<span>Save defaults</span></button></div>
        </section>

        <section class="settings-card" id="settings-appearance">
          <div class="settings-card__head"><span class="settings-card__icon">${icon('sun', { size: 20 })}</span><div><p class="eyebrow">03 · Atmosphere</p><h2>Appearance</h2><p>Four observatories, six accents. Changes apply immediately and are stored on this device.</p></div></div>
          <div class="theme-grid">
            ${THEMES.map((theme) => `<button type="button" class="theme-card ${settings.theme === theme.id ? 'is-active' : ''}" data-theme-choice="${theme.id}">
              <span class="theme-card__preview" style="--swatch-bg:${theme.swatch[0]};--swatch-accent:${theme.swatch[1]}"><i></i><i></i><i></i></span>
              <span class="theme-card__copy"><strong>${escapeHtml(theme.name)}</strong><span>${escapeHtml(theme.note)}</span></span>
              <span class="theme-card__check">${settings.theme === theme.id ? icon('checkCircle', { size: 16 }) : ''}</span>
            </button>`).join('')}
          </div>
          <div class="appearance-row">
            <div class="appearance-row__copy"><strong>Accent</strong><span>The signal colour for focus, emphasis, and the gauge.</span></div>
            <div class="accent-row">
              ${ACCENTS.map((accent) => `<button type="button" class="accent-swatch ${settings.accent === accent.id ? 'is-active' : ''}" data-accent-choice="${accent.id}" style="--swatch:${accent.hex}" aria-label="${escapeHtml(accent.name)}" title="${escapeHtml(accent.name)}"><span></span>${settings.accent === accent.id ? icon('check', { size: 12 }) : ''}</button>`).join('')}
            </div>
          </div>
          <div class="appearance-grid">
            <div class="appearance-block">
              <p>Density</p>
              <div class="segmented segmented--small">
                <button type="button" class="segmented__item ${settings.density !== 'compact' ? 'is-active' : ''}" data-density-choice="comfortable">Comfortable</button>
                <button type="button" class="segmented__item ${settings.density === 'compact' ? 'is-active' : ''}" data-density-choice="compact">Compact</button>
              </div>
            </div>
            <div class="appearance-block">
              <p>Interface scale <output id="out-font-scale">${Math.round((settings.fontScale || 1) * 100)}%</output></p>
              <input type="range" id="font-scale" min="0.85" max="1.3" step="0.05" value="${Number(settings.fontScale || 1)}">
            </div>
          </div>
          <div class="setting-list">
            ${switchControl('motion', 'Interface motion', 'Orbit, shimmer, and reveal animations.', settings.motion !== false)}
            ${switchControl('timestamps', 'Message timestamps', 'Show the local time beside each message.', settings.timestamps !== false)}
            ${switchControl('tokenMeter', 'Live token estimate', 'Show the context estimate in the composer while typing.', settings.tokenMeter !== false)}
            ${switchControl('sendWithEnter', 'Enter sends', 'When off, use ⌘/Ctrl + Enter. Shift + Enter always inserts a line.', settings.sendWithEnter !== false)}
            ${switchControl('showReasoning', 'Show reasoning blocks', 'Render reasoning returned by reasoning-capable models.', settings.showReasoning !== false)}
          </div>
        </section>

        <section class="settings-card" id="settings-account">
          <div class="settings-card__head"><span class="settings-card__icon">${icon('user', { size: 20 })}</span><div><p class="eyebrow">04 · Identity</p><h2>Account</h2><p>Authentication runs on the project's existing Supabase Auth users.</p></div></div>
          <div class="account-grid">
            <div class="account-avatar">${escapeHtml((profileName || 'M').slice(0, 1).toUpperCase())}</div>
            <div class="account-fields">
              <label class="field"><span>Display name</span><input id="profile-name" class="input" type="text" maxlength="60" value="${escapeHtml(profileName)}"></label>
              <div class="account-meta"><span>Email</span><strong>${escapeHtml(state.user?.email || '—')}</strong></div>
              <div class="account-meta"><span>User ID</span><code>${escapeHtml(state.user?.id || '—')}</code></div>
              <div class="account-meta"><span>Last sign-in</span><strong>${state.user?.last_sign_in_at ? formatDateTime(state.user.last_sign_in_at) : '—'}</strong></div>
            </div>
          </div>
          <div class="settings-actions settings-actions--spread">
            <div>
              <button type="button" class="btn btn--primary" data-save-profile>${icon('check', { size: 15 })}<span>Save name</span></button>
              <button type="button" class="btn btn--ghost" data-change-password>${icon('lock', { size: 15 })}<span>Change password</span></button>
            </div>
            <button type="button" class="btn btn--ghost btn--danger-text" data-signout>${icon('logout', { size: 15 })}<span>Sign out</span></button>
          </div>
        </section>

        <section class="settings-card" id="settings-data">
          <div class="settings-card__head"><span class="settings-card__icon">${icon('database', { size: 20 })}</span><div><p class="eyebrow">05 · Sovereignty</p><h2>Data & privacy</h2><p>Your conversations live in Supabase. Only you can read or write them under RLS.</p></div></div>
          <div class="data-actions">
            <div class="data-action">
              <span class="data-action__icon">${icon('download', { size: 18 })}</span>
              <div><strong>Export the entire workspace</strong><p>Conversations, branches, messages, models, prompts, exact request snapshots, and analytics as one JSON file.</p></div>
              <button type="button" class="btn btn--small btn--ghost" data-export-workspace ${exporting ? 'disabled' : ''}>${icon(exporting ? 'loader' : 'download', { size: 14, className: exporting ? 'spin' : '' })}<span>${exporting ? 'Exporting…' : 'Export JSON'}</span></button>
            </div>
            <div class="data-action">
              <span class="data-action__icon">${icon('chart', { size: 18 })}</span>
              <div><strong>Export analytics</strong><p>Every recorded event as CSV, with provider-reported token counts and raw error fields.</p></div>
              <button type="button" class="btn btn--small btn--ghost" data-export-events>${icon('download', { size: 14 })}<span>Export CSV</span></button>
            </div>
            <div class="data-action">
              <span class="data-action__icon">${icon('code', { size: 18 })}</span>
              <div><strong>Database schema</strong><p>Copy or download the idempotent <code>supabase/schema.sql</code> migration. Every table is prefixed <code>meraj_</code>.</p></div>
              <div class="data-action__buttons"><button type="button" class="btn btn--small btn--ghost" data-copy-schema>${icon('copy', { size: 14 })}<span>Copy SQL</span></button><a class="btn btn--small btn--ghost" href="#/setup">${icon('database', { size: 14 })}<span>Setup</span></a></div>
            </div>
            <div class="data-action">
              <span class="data-action__icon">${icon('trash', { size: 18 })}</span>
              <div><strong>Clear local drafts</strong><p>Remove the unsent text this browser keeps for each conversation. Nothing stored in Supabase is touched.</p></div>
              <button type="button" class="btn btn--small btn--ghost" data-clear-drafts>${icon('trash', { size: 14 })}<span>Clear drafts</span></button>
            </div>
          </div>
          <div class="danger-zone">
            <p class="danger-zone__label">${icon('alert', { size: 14 })} Destructive actions</p>
            <div class="danger-zone__row"><div><strong>Delete analytics events</strong><p>Removes every usage event. Conversations and messages remain.</p></div><button type="button" class="btn btn--small btn--ghost btn--danger-text" data-delete-events>Delete events</button></div>
            <div class="danger-zone__row"><div><strong>Delete all conversations</strong><p>Permanently deletes every chat, branch, archived request, and error. Models and prompts remain.</p></div><button type="button" class="btn btn--small btn--danger-text" data-delete-conversations>Delete all chats</button></div>
          </div>
          <p class="field-help">${icon('shieldCheck', { size: 13 })} Supabase RLS policies restrict rows to <code>auth.uid() = user_id</code>. The anonymous role has no grants on application tables. The OpenRouter key is not stored in Supabase.</p>
        </section>

        <section class="settings-card" id="settings-diagnostics">
          <div class="settings-card__head"><span class="settings-card__icon">${icon('activity', { size: 20 })}</span><div><p class="eyebrow">06 · Instrument check</p><h2>Diagnostics</h2><p>Probe each dependency and display exactly what it returned. No generic success badges.</p></div><button type="button" class="btn btn--small btn--ghost" data-run-diagnostics ${diagnosticsRunning ? 'disabled' : ''}>${icon(diagnosticsRunning ? 'loader' : 'refresh', { size: 14, className: diagnosticsRunning ? 'spin' : '' })}<span>${diagnosticsRunning ? 'Running…' : 'Run checks'}</span></button></div>
          <div id="diagnostics-panel">${renderDiagnostics()}</div>
        </section>

        <section class="settings-card settings-card--about" id="settings-about">
          <div class="about-brand">
            <span>${logoMark({ size: 54 })}</span>
            <div><h2>معراج</h2><p>MI'RAJ · v${escapeHtml(CONFIG.app.version)}</p></div>
          </div>
          <p class="about-lede">An observatory for thought. A buildless single-page application — HTML, CSS, vanilla JavaScript — using Supabase for identity and persistence and OpenRouter for free-model inference.</p>
          <div class="about-grid">
            <div><span>Frontend</span><strong>Vanilla ES modules</strong><p>No framework, no bundler at runtime.</p></div>
            <div><span>Identity & data</span><strong>Supabase</strong><p>Auth + PostgREST with row-level security.</p></div>
            <div><span>Inference</span><strong>OpenRouter</strong><p>Free text models, streamed over SSE.</p></div>
            <div><span>Tables</span><strong>meraj_ prefixed</strong><p>Zero collisions with your existing schema.</p></div>
          </div>
          <div class="about-links">
            <a href="https://openrouter.ai/docs" target="_blank" rel="noopener noreferrer">${icon('external', { size: 14 })} OpenRouter docs</a>
            <a href="https://supabase.com/docs" target="_blank" rel="noopener noreferrer">${icon('external', { size: 14 })} Supabase docs</a>
            <a href="#/setup">${icon('database', { size: 14 })} Schema setup</a>
            <a href="https://openrouter.ai/models?max_price=0" target="_blank" rel="noopener noreferrer">${icon('spark', { size: 14 })} Free models</a>
          </div>
          <p class="about-fineprint">Request snapshots archive the exact serialized body sent to OpenRouter, minus the Authorization header. Provider responses, including errors, are stored verbatim. Model names and availability are controlled by OpenRouter.</p>
        </section>
      </div>
    </div>
  </div>`;

  bind();
  updateTestPanel();
}

function renderDiagnostics() {
  if (diagnosticsRunning) {
    return `<div class="diagnostics-loading"><span class="boot-spinner boot-spinner--small"></span><p>Probing Supabase tables, session, model catalogue, analytics, and local key…</p></div>`;
  }
  if (!diagnostics) {
    return `<div class="diagnostics-idle">${icon('activity', { size: 22 })}<p>Run the checks to see the state of every dependency. Failures include the raw error fields.</p></div>`;
  }
  return `<div class="diagnostics-list">
    ${diagnostics
      .map(
        (check) => `<div class="diagnostic diagnostic--${check.status}">
          <span class="diagnostic__icon">${icon(check.status === 'ok' ? 'checkCircle' : check.status === 'warn' ? 'alert' : 'xCircle', { size: 18 })}</span>
          <div class="diagnostic__copy"><strong>${escapeHtml(check.label)}</strong><p>${escapeHtml(check.detail || '')}</p>${check.error ? `<details><summary>Raw error</summary><pre>${escapeHtml(JSON.stringify(check.error, null, 2))}</pre></details>` : ''}</div>
          <span class="diagnostic__status">${escapeHtml(check.status)}</span>
        </div>`,
      )
      .join('')}
  </div>`;
}

function updateTestPanel() {
  const panel = rootEl?.querySelector('#key-test-panel');
  if (panel) panel.innerHTML = renderTestResult();
}

function updateKeyStatus() {
  const holder = rootEl?.querySelector('#key-status-line');
  if (holder) holder.innerHTML = keyStatus();
}

function bind() {
  const page = rootEl;
  page.querySelector('[data-open-sidebar]')?.addEventListener('click', () => ctx?.openSidebar?.());
  page.querySelectorAll('[data-scroll-section]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = page.querySelector(`#${CSS.escape(link.dataset.scrollSection)}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  page.querySelector('[data-toggle-key]')?.addEventListener('click', (event) => {
    const input = page.querySelector('#openrouter-key');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.innerHTML = icon(input.type === 'password' ? 'eye' : 'eyeOff', { size: 16 });
  });
  page.querySelector('[data-save-key]')?.addEventListener('click', saveKey);
  page.querySelector('[data-test-key]')?.addEventListener('click', runKeyTest);
  page.querySelector('[data-clear-key]')?.addEventListener('click', async () => {
    if (!getApiKey()) {
      toast({ title: 'No key stored', message: 'There is nothing to forget on this device.', type: 'info' });
      return;
    }
    const confirmed = await confirmDialog({
      title: 'Forget this OpenRouter key?',
      message: 'The key will be removed from this browser. Your chats and request archives remain. You can add another key at any time.',
      confirmLabel: 'Forget key',
      danger: true,
    });
    if (!confirmed) return;
    clearApiKey();
    setState({ openRouterKeyPresent: false }, 'key-cleared');
    updateKeyStatus();
    testState = null;
    updateTestPanel();
    toast({ title: 'Key forgotten', message: 'The key is no longer in this browser.', type: 'success' });
  });

  page.querySelector('[data-save-defaults]')?.addEventListener('click', () => {
    const model = page.querySelector('#default-model')?.value || CONFIG.defaults.model;
    const systemPrompt = page.querySelector('#default-system')?.value || '';
    const temperature = Number(page.querySelector('#default-temperature')?.value);
    const maxTokens = Math.round(Number(page.querySelector('#default-max-tokens')?.value));
    const reasoning = page.querySelector('#default-reasoning')?.value || 'off';
    const next = saveSettings({
      defaultModel: model,
      systemPrompt,
      params: {
        temperature: Number.isFinite(temperature) ? Math.min(2, Math.max(0, temperature)) : 0.7,
        max_tokens: Number.isFinite(maxTokens) ? Math.min(262144, Math.max(16, maxTokens)) : 2048,
        reasoning,
      },
    });
    setState({ settings: next }, 'settings-changed');
    toast({ title: 'Defaults saved', message: `New chats start with ${model}.`, type: 'success' });
  });
  page.querySelector('#default-temperature')?.addEventListener('input', (event) => {
    const out = page.querySelector('#out-default-temp');
    if (out) out.textContent = Number(event.target.value).toFixed(2);
  });

  page.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = saveSettings({ theme: button.dataset.themeChoice });
      setState({ settings: next }, 'settings-changed');
      applyAppearance(next);
      page.querySelectorAll('[data-theme-choice]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        const check = item.querySelector('.theme-card__check');
        if (check) check.innerHTML = active ? icon('checkCircle', { size: 16 }) : '';
      });
    });
  });
  page.querySelectorAll('[data-accent-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = saveSettings({ accent: button.dataset.accentChoice });
      setState({ settings: next }, 'settings-changed');
      applyAppearance(next);
      page.querySelectorAll('[data-accent-choice]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        if (active && !item.querySelector('svg')) item.innerHTML = `${'<span></span>'}${icon('check', { size: 12 })}`;
        else if (!active) item.innerHTML = '<span></span>';
      });
    });
  });
  page.querySelectorAll('[data-density-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = saveSettings({ density: button.dataset.densityChoice });
      setState({ settings: next }, 'settings-changed');
      applyAppearance(next);
      page.querySelectorAll('[data-density-choice]').forEach((item) => item.classList.toggle('is-active', item === button));
    });
  });
  const fontScale = page.querySelector('#font-scale');
  fontScale?.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    const output = page.querySelector('#out-font-scale');
    if (output) output.textContent = `${Math.round(value * 100)}%`;
    document.documentElement.style.setProperty('--font-scale', String(value));
  });
  fontScale?.addEventListener('change', (event) => {
    const next = saveSettings({ fontScale: Number(event.target.value) });
    setState({ settings: next }, 'settings-changed');
    applyAppearance(next);
  });
  page.querySelectorAll('[data-setting]').forEach((control) => {
    control.addEventListener('click', () => {
      const key = control.dataset.setting;
      const current = state.settings?.[key];
      const nextValue = !(current !== false);
      const next = saveSettings({ [key]: nextValue });
      setState({ settings: next }, 'settings-changed');
      applyAppearance(next);
      control.classList.toggle('is-on', nextValue);
      control.setAttribute('aria-checked', String(nextValue));
      const label = control.querySelector('span:last-child');
      if (label) label.textContent = nextValue ? 'On' : 'Off';
    });
  });

  page.querySelector('[data-save-profile]')?.addEventListener('click', saveProfile);
  page.querySelector('[data-change-password]')?.addEventListener('click', openPasswordModal);
  page.querySelector('[data-signout]')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Sign out of معراج?',
      message: 'Your chats remain in Supabase. This browser loses the session; the OpenRouter key stays unless you forget it.',
      confirmLabel: 'Sign out',
    });
    if (!confirmed) return;
    const { error } = await signOut();
    if (error) reportError('Sign out failed', error);
  });

  page.querySelector('[data-export-workspace]')?.addEventListener('click', exportWorkspace);
  page.querySelector('[data-export-events]')?.addEventListener('click', exportEvents);
  page.querySelector('[data-copy-schema]')?.addEventListener('click', copySchema);
  page.querySelector('[data-clear-drafts]')?.addEventListener('click', clearDrafts);
  page.querySelector('[data-delete-events]')?.addEventListener('click', deleteEvents);
  page.querySelector('[data-delete-conversations]')?.addEventListener('click', deleteConversations);
  page.querySelectorAll('[data-run-diagnostics]').forEach((button) => button.addEventListener('click', runDiagnostics));
}

async function saveKey() {
  const input = rootEl?.querySelector('#openrouter-key');
  const value = input?.value.trim() || '';
  if (!value) {
    toast({ title: 'Paste a key first', message: 'The field is empty. A stored key is never shown back to you in full.', type: 'warning' });
    input?.focus();
    return;
  }
  if (!/^sk-or-/i.test(value)) {
    toast({
      title: 'This does not look like an OpenRouter key',
      message: 'OpenRouter keys normally begin with “sk-or-”. You can still save it, but the test will reveal the truth.',
      type: 'warning',
      duration: 6000,
    });
  }
  const remember = rootEl?.querySelector('#remember-key')?.checked ?? true;
  setApiKey(value, remember);
  const next = saveSettings({ rememberKey: remember });
  setState({ settings: next, openRouterKeyPresent: true }, 'key-saved');
  if (input) {
    input.value = '';
    input.type = 'password';
  }
  updateKeyStatus();
  testState = null;
  updateTestPanel();
  toast({
    title: 'Key stored',
    message: remember ? 'Saved in this browser’s local storage.' : 'Kept for this tab session only.',
    type: 'success',
  });
}

async function runKeyTest() {
  if (testing) return;
  const entered = rootEl?.querySelector('#openrouter-key')?.value.trim() || '';
  const key = entered || getApiKey();
  if (!key) {
    toast({ title: 'No key to test', message: 'Paste an OpenRouter key or save one first.', type: 'warning' });
    return;
  }
  testing = true;
  testState = null;
  updateTestPanel();
  const button = rootEl?.querySelector('[data-test-key]');
  if (button) button.disabled = true;
  testState = await testApiKey(key);
  testing = false;
  updateTestPanel();
  const refreshButton = rootEl?.querySelector('[data-test-key]');
  if (refreshButton) {
    refreshButton.disabled = false;
    refreshButton.innerHTML = `${icon('zap', { size: 15 })}<span>Test key</span>`;
  }
  if (testState.ok) {
    toast({ title: 'OpenRouter key accepted', message: `HTTP ${testState.status} · ${testState.latencyMs} ms`, type: 'success' });
  } else if (testState.status) {
    toast({
      title: `OpenRouter returned HTTP ${testState.status}`,
      message: 'The exact response body is shown below, unmodified.',
      type: 'error',
      duration: 7000,
      actions: [{ label: 'Raw fields', close: false, onClick: () => openErrorDialog('OpenRouter key test', { ...testState, kind: 'http', bodyText: testState.bodyText, message: testState.parsed?.error?.message || testState.statusText || 'Key test failed.' }) }],
    });
  } else {
    reportError('Key test could not reach OpenRouter', testState.error);
  }
}

async function saveProfile() {
  const name = rootEl?.querySelector('#profile-name')?.value.trim() || '';
  if (!name) {
    toast({ title: 'Display name required', message: 'Enter a name before saving.', type: 'warning' });
    return;
  }
  const [profileResult, metaResult] = await Promise.all([
    db.upsertProfile(state.user.id, { display_name: name }),
    updateUserMetadata({ display_name: name }),
  ]);
  if (profileResult.error) {
    reportError('Supabase could not save the profile row', profileResult.error);
    return;
  }
  if (metaResult.error) {
    reportError('Supabase Auth could not update user metadata', metaResult.error);
  }
  const profile = profileResult.data || { ...(state.profile || {}), display_name: name };
  setState({
    profile,
    user: state.user ? { ...state.user, user_metadata: { ...(state.user.user_metadata || {}), display_name: name } } : state.user,
  }, 'profile-updated');
  toast({ title: 'Name saved', message: name, type: 'success' });
}

function openPasswordModal() {
  const modal = openModal({
    title: 'Change password',
    subtitle: 'Supabase Auth applies its own password policy and returns the exact error if one exists.',
    size: 'sm',
    body: `<div class="form">
      <label class="field"><span>New password</span><div class="input-wrap">${icon('lock', { size: 15 })}<input id="new-password" class="input" type="password" autocomplete="new-password" placeholder="At least 6 characters"></div></label>
      <label class="field"><span>Confirm new password</span><div class="input-wrap">${icon('lock', { size: 15 })}<input id="confirm-password" class="input" type="password" autocomplete="new-password" placeholder="Repeat it"></div></label>
      <p class="field-help">Changing the password does not sign out other devices by itself.</p>
      <div id="password-error"></div>
    </div>`,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Update password',
        variant: 'primary',
        close: false,
        busyLabel: 'Updating…',
        onClick: async ({ body }) => {
          const password = body.querySelector('#new-password')?.value || '';
          const confirmation = body.querySelector('#confirm-password')?.value || '';
          const errorHolder = body.querySelector('#password-error');
          if (password.length < 6) {
            errorHolder.innerHTML = `<p class="notice notice--danger">${icon('alert', { size: 14 })}The password must be at least 6 characters.</p>`;
            return false;
          }
          if (password !== confirmation) {
            errorHolder.innerHTML = `<p class="notice notice--danger">${icon('alert', { size: 14 })}The two passwords do not match.</p>`;
            return false;
          }
          const { error } = await updatePassword(password);
          if (error) {
            errorHolder.innerHTML = `<div class="auth-error auth-error--compact">${icon('xCircle', { size: 17 })}<div><strong>Supabase Auth response</strong><p>${escapeHtml(error.message)}</p>${error.code ? `<span class="mono">code: ${escapeHtml(error.code)}</span>` : ''}</div></div>`;
            return false;
          }
          modal.close();
          toast({ title: 'Password updated', message: 'Supabase accepted the new password.', type: 'success' });
          return false;
        },
      },
    ],
  });
  modal.body.querySelector('#new-password')?.focus();
}

async function exportWorkspace() {
  if (exporting) return;
  exporting = true;
  const button = rootEl?.querySelector('[data-export-workspace]');
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('loader', { size: 14, className: 'spin' })}<span>Exporting…</span>`;
  }
  const loading = toast({ title: 'Building workspace export', message: 'Reading conversations, branches, requests, models, and prompts from Supabase…', type: 'loading', duration: 0 });
  const { data, error } = await db.exportWorkspace(state.user.id);
  loading.close();
  exporting = false;
  if (error) {
    reportError('Workspace export failed', error);
    render();
    return;
  }
  const json = JSON.stringify(data, null, 2);
  download(`meraj-workspace-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
  toast({
    title: 'Workspace exported',
    message: `${formatNumber(data.conversations.length)} conversations · ${formatNumber(data.messages.length)} messages · ${formatTokens(json.length / 4)} approx. tokens of JSON.`,
    type: 'success',
    duration: 5000,
  });
  render();
}

async function exportEvents() {
  const { data, error } = await db.listEvents({ limit: CONFIG.limits.events });
  if (error) {
    reportError('Could not load analytics events', error);
    return;
  }
  if (!data?.length) {
    toast({ title: 'No analytics events', message: 'Nothing has been recorded yet.', type: 'info' });
    return;
  }
  download(`meraj-events-${new Date().toISOString().slice(0, 10)}.csv`, eventsToCsv(data), 'text/csv;charset=utf-8');
  toast({ title: 'Analytics CSV exported', message: `${data.length} rows.`, type: 'success' });
}

async function copySchema() {
  try {
    const response = await fetch(CONFIG.setup.sqlPath);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const text = await response.text();
    const ok = await copyText(text);
    toast(
      ok
        ? { title: 'Schema copied', message: `${text.length.toLocaleString()} characters. Paste into Supabase SQL Editor.`, type: 'success' }
        : { title: 'Clipboard blocked', message: 'Open supabase/schema.sql and copy manually.', type: 'error' },
    );
  } catch (error) {
    reportError('Could not read the schema file', { message: error.message, kind: 'client' });
  }
}

function clearDrafts() {
  let removed = 0;
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(CONFIG.keys.draft)) {
        localStorage.removeItem(key);
        removed += 1;
      }
    }
  } catch (error) {
    reportError('Could not clear local drafts', { message: error.message, kind: 'client' });
    return;
  }
  toast({ title: 'Local drafts cleared', message: `${removed} draft(s) removed from this browser.`, type: 'success' });
}

async function deleteEvents() {
  const confirmed = await confirmDialog({
    title: 'Delete all analytics events?',
    message: 'This removes the recorded usage ledger for this account. Conversations, messages, and request snapshots remain. This cannot be undone.',
    confirmLabel: 'Delete events',
    danger: true,
  });
  if (!confirmed) return;
  const { error } = await db.deleteAllEvents(state.user.id);
  if (error) {
    reportError('Could not delete analytics events', error);
    return;
  }
  toast({ title: 'Analytics deleted', message: 'The usage ledger is empty.', type: 'success' });
}

async function deleteConversations() {
  const confirmed = await confirmDialog({
    title: 'Delete every conversation?',
    message: 'Every chat, branch, message, archived exact request, and error will be permanently deleted. Models, prompts, and analytics events are not touched. This cannot be undone.',
    confirmLabel: 'Delete all conversations',
    danger: true,
  });
  if (!confirmed) return;
  const { error } = await db.deleteAllConversations(state.user.id);
  if (error) {
    reportError('Could not delete conversations', error);
    return;
  }
  setState({ conversations: [], archivedConversations: [], activeConversationId: null }, 'conversations-cleared');
  window.dispatchEvent(new CustomEvent('meraj:conversation-gone'));
  toast({ title: 'All conversations deleted', message: 'The slate is clear.', type: 'success' });
}

async function runDiagnostics() {
  if (diagnosticsRunning) return;
  diagnosticsRunning = true;
  diagnostics = null;
  render();
  const results = [];
  results.push({
    label: 'Authenticated session',
    status: state.user?.id ? 'ok' : 'fail',
    detail: state.user?.id ? `${state.user.email || 'user'} · ${state.user.id}` : 'No user in state.',
  });
  const schema = await checkSchema();
  results.push({
    label: 'Supabase schema',
    status: schema.status === 'ready' ? 'ok' : 'fail',
    detail: schema.status === 'ready' ? 'All six meraj_ tables responded under RLS.' : `${schema.missing.length} missing table(s), ${schema.otherErrors.length} permission/other error(s).`,
    error: schema.status === 'ready' ? null : schema.error,
  });
  const models = await db.listModels();
  results.push({
    label: 'Stored model catalogue',
    status: models.error ? 'fail' : (models.data || []).length ? 'ok' : 'warn',
    detail: models.error ? 'Query failed.' : `${(models.data || []).length} free model(s) stored; ${(models.data || []).filter((model) => model.is_active !== false).length} active.`,
    error: models.error,
  });
  const events = await db.listEvents({ limit: 1 });
  results.push({
    label: 'Analytics events table',
    status: events.error ? 'fail' : 'ok',
    detail: events.error ? 'Query failed.' : 'Readable under RLS.',
    error: events.error,
  });
  const key = getApiKey();
  results.push({
    label: 'OpenRouter key on this device',
    status: key ? 'ok' : 'warn',
    detail: key ? `Stored (${maskKey(key)}).` : 'No key stored. Sending requests is disabled.',
  });
  results.push({
    label: 'Network status',
    status: navigator.onLine ? 'ok' : 'warn',
    detail: navigator.onLine ? 'The browser reports an online connection.' : 'The browser reports offline.',
  });
  diagnostics = results;
  diagnosticsRunning = false;
  render();
  toast({ title: 'Diagnostics complete', message: `${results.filter((row) => row.status === 'ok').length}/${results.length} checks healthy.`, type: results.some((row) => row.status === 'fail') ? 'warning' : 'success' });
}

export function mountSettings(root, context = {}) {
  rootEl = root;
  ctx = context;
  testState = null;
  testing = false;
  diagnostics = null;
  diagnosticsRunning = false;
  exporting = false;
  render();
}

export function unmountSettings() {
  rootEl = null;
  ctx = null;
  testState = null;
  diagnostics = null;
}
