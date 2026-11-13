import { store } from './store.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { validateKey } from './openrouter.js';
import { escapeHtml, copyToClipboard } from './utils.js';
import { icon } from './icons.js';

export function openSettingsModal({ models = [], onSaved } = {}) {
  const settings = store.getSettings();

  const modelOptions = [
    { id: 'openrouter/free', label: 'OpenRouter Auto · free' },
    ...models
      .filter(m => m.is_free !== false)
      .map(m => ({ id: m.id, label: m.label || m.id }))
  ];

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field">
      <label class="label">OpenRouter API Key</label>
      <div class="row">
        <input type="password" class="input mono" id="set-apikey" placeholder="sk-or-v1-..." autocomplete="off" spellcheck="false">
        <button class="btn btn-sm" id="toggle-key-visibility" type="button">Show</button>
      </div>
      <div class="field-hint">Stored locally in your browser only. Never sent to our servers.</div>
      <div class="row" style="margin-top:8px;gap:6px">
        <button class="btn btn-sm" id="test-key" type="button">Test key</button>
        <button class="btn btn-sm btn-ghost" id="paste-key" type="button">${icon('copy', 'icon-sm')} Paste</button>
        <button class="btn btn-sm btn-ghost" id="clear-key" type="button">Clear</button>
      </div>
      <div class="field-hint" id="key-status"></div>
    </div>

    <div class="divider"></div>

    <div class="field">
      <label class="label">Default model</label>
      <select class="select" id="set-model">
        ${modelOptions.map(m => `
          <option value="${escapeHtml(m.id)}" ${settings.defaultModel === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>
        `).join('')}
      </select>
      <div class="field-hint">Used when starting a new chat. You can change the model per-chat any time.</div>
    </div>

    <div class="field">
      <label class="label">Temperature · <span id="temp-value" class="mono">${settings.temperature.toFixed(2)}</span></label>
      <input type="range" id="set-temperature" min="0" max="2" step="0.05" value="${settings.temperature}" style="width:100%">
      <div class="field-hint">Lower = deterministic, higher = creative.</div>
    </div>

    <div class="field">
      <label class="label">Max tokens</label>
      <input type="number" class="input" id="set-max-tokens" min="32" max="32768" step="32" value="${settings.maxTokens}">
      <div class="field-hint">Upper bound for each response.</div>
    </div>

    <div class="divider"></div>

    <div class="field">
      <label class="label">Appearance</label>
      <div class="row" style="gap:6px">
        <button class="btn btn-sm ${settings.theme === 'dark' ? 'btn-primary' : ''}" data-theme-choice="dark">Dark</button>
        <button class="btn btn-sm ${settings.theme === 'light' ? 'btn-primary' : ''}" data-theme-choice="light">Light</button>
      </div>
    </div>

    <div class="divider"></div>

    <div class="field">
      <label class="label" style="color:var(--danger)">Danger zone</label>
      <button class="btn btn-danger btn-sm" id="clear-all-chats" type="button">
        ${icon('trash', 'icon-sm')} Delete all chats
      </button>
    </div>
  `;

  const footer = document.createElement('div');
  footer.className = 'row';
  footer.style.width = '100%';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '8px';
  footer.innerHTML = `
    <button class="btn btn-ghost" data-action="close">Cancel</button>
    <button class="btn btn-primary" data-action="save">Save settings</button>
  `;

  const modal = openModal({
    title: 'Settings',
    body,
    footer,
    size: 'wide'
  });

  const apiKeyInput = body.querySelector('#set-apikey');
  apiKeyInput.value = settings.apiKey || '';

  const statusEl = body.querySelector('#key-status');
  function setStatus(text, color = 'var(--text-dim)') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = color;
  }

  body.querySelector('#toggle-key-visibility').addEventListener('click', (e) => {
    const isPwd = apiKeyInput.type === 'password';
    apiKeyInput.type = isPwd ? 'text' : 'password';
    e.currentTarget.textContent = isPwd ? 'Hide' : 'Show';
  });

  body.querySelector('#paste-key').addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        apiKeyInput.value = t.trim();
        setStatus('Pasted from clipboard', 'var(--success)');
      }
    } catch {
      setStatus('Clipboard access denied', 'var(--warning)');
    }
  });

  body.querySelector('#clear-key').addEventListener('click', () => {
    apiKeyInput.value = '';
    setStatus('Cleared', 'var(--text-dim)');
  });

  body.querySelector('#test-key').addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) return setStatus('Enter a key first', 'var(--warning)');
    setStatus('Testing…', 'var(--text-muted)');
    try {
      const res = await validateKey(key);
      const label = res?.label || res?.data?.label || '';
      setStatus(`✓ Valid${label ? ' · ' + label : ''}`, 'var(--success)');
    } catch (e) {
      setStatus(`✗ ${e.message}`, 'var(--danger)');
    }
  });

  const tempInput = body.querySelector('#set-temperature');
  const tempValue = body.querySelector('#temp-value');
  tempInput.addEventListener('input', () => {
    tempValue.textContent = parseFloat(tempInput.value).toFixed(2);
  });

  body.querySelectorAll('[data-theme-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const choice = btn.getAttribute('data-theme-choice');
      body.querySelectorAll('[data-theme-choice]').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      store.updateSettings({ theme: choice });
    });
  });

  body.querySelector('#clear-all-chats').addEventListener('click', () => {
    if (!confirm('Delete ALL chats? This cannot be undone.')) return;
    store.clearAllChats();
    toast({ type: 'success', title: 'All chats deleted' });
    modal.close();
    onSaved?.();
  });

  footer.querySelector('[data-action="close"]').addEventListener('click', () => modal.close());
  footer.querySelector('[data-action="save"]').addEventListener('click', () => {
    const newSettings = {
      apiKey: apiKeyInput.value.trim(),
      defaultModel: body.querySelector('#set-model').value,
      temperature: parseFloat(tempInput.value),
      maxTokens: parseInt(body.querySelector('#set-max-tokens').value, 10) || 2048,
      theme: store.getSettings().theme
    };
    store.updateSettings(newSettings);
    document.documentElement.setAttribute('data-theme', newSettings.theme);
    toast({ type: 'success', title: 'Settings saved' });
    modal.close();
    onSaved?.();
  });

  setTimeout(() => apiKeyInput.focus(), 120);
}
