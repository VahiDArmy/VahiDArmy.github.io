// ---------------------------------------------------------------------------
// Settings: OpenRouter key, agent behaviour, account, database status.
// ---------------------------------------------------------------------------

import { auth, db } from '../core/db.js';
import { repo } from '../core/repo.js';
import { getApiKey, setApiKey, maskKey } from '../core/keys.js';
import { LLMGateway } from '../agent/llm.js';
import { escapeHtml, downloadBlob } from '../core/util.js';
import { icon, toast, confirmDialog } from './dom.js';

export async function renderSettings(root, ctx) {
  const settings = ctx.state.settings || {};

  root.innerHTML = `
    <div class="page-head">
      <div style="flex:1">
        <h1>Settings</h1>
        <p>Everything here applies to your account, except the API key which stays on this device.</p>
      </div>
    </div>
    <div class="stack" style="gap:14px">

      <section class="card">
        <div class="section-title">${icon('key')} OpenRouter API key</div>
        <p class="tiny muted" style="margin-bottom:10px">
          Used directly from this browser. It is stored only in this browser's local storage — never sent to Supabase,
          never logged, never synced to your other devices. Get a key at openrouter.ai/keys.
        </p>
        <div class="field">
          <label for="api-key">Key</label>
          <input class="input" id="api-key" type="password" autocomplete="off" spellcheck="false"
            placeholder="sk-or-v1-…" value="${escapeHtml(getApiKey())}" />
          <span class="hint" id="key-status">${keyStatusText()}</span>
        </div>
        <div class="row wrap">
          <button class="btn primary" id="save-key">Save key</button>
          <button class="btn" id="test-key">${icon('shield')} Test</button>
          <button class="btn ghost" id="clear-key">Remove</button>
        </div>
        <div id="key-msg" style="margin-top:10px"></div>
      </section>

      <section class="card">
        <div class="section-title">Agent behaviour</div>
        <div class="field">
          <label for="temperature">Creativity</label>
          <select class="select" id="temperature">
            ${[[0, 'Precise (0)'], [0.2, 'Balanced (0.2)'], [0.5, 'Loose (0.5)'], [0.8, 'Very loose (0.8)']]
              .map(([value, label]) => `<option value="${value}" ${Number(settings.temperature) === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <span class="hint">Lower is better for code. Weak models behave best near 0.</span>
        </div>
        <div class="field">
          <label for="max-steps">Maximum steps per task</label>
          <input class="input" id="max-steps" type="number" min="4" max="60" value="${Number(settings.maxSteps) || 34}" />
          <span class="hint">How many model turns one instruction may use before it stops and asks you to continue.</span>
        </div>
        <div class="row" style="justify-content:space-between;padding:6px 0">
          <div>
            <div class="small">Prefer free models</div>
            <div class="tiny muted">Automatic selection favours free models when they can do the job.</div>
          </div>
          <button class="switch" role="switch" id="prefer-free" aria-checked="${settings.preferFree !== false}" aria-label="Prefer free models"></button>
        </div>
        <div class="row" style="justify-content:space-between;padding:6px 0">
          <div>
            <div class="small">Sync model catalog automatically</div>
            <div class="tiny muted">Refreshes prices and availability from OpenRouter when it is stale.</div>
          </div>
          <button class="switch" role="switch" id="auto-sync" aria-checked="${settings.autoSyncModels !== false}" aria-label="Auto sync models"></button>
        </div>
      </section>

      <section class="card">
        <div class="section-title">Account</div>
        <div class="row" style="justify-content:space-between">
          <div>
            <div class="small">${escapeHtml(auth.user?.email || 'Signed in')}</div>
            <div class="tiny muted">Row-level security keeps your projects private to this account.</div>
          </div>
          <button class="btn" id="sign-out">${icon('logout')} Sign out</button>
        </div>
      </section>

      <section class="card">
        <div class="section-title">Database</div>
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <div class="small">${ctx.state.schema?.ready ? 'All fb_ tables are present' : 'Tables missing'}</div>
            <div class="tiny muted">${db.tables ? Object.values(db.tables).length : 11} tables · Supabase project kehylspimkjheqlsvepd</div>
          </div>
          <button class="btn" id="recheck-schema">${icon('refresh')} Re-check</button>
        </div>
        <div id="schema-msg" style="margin-top:8px"></div>
        <p class="tiny muted" style="margin-top:10px">
          The full schema lives at <a href="supabase/schema.sql" target="_blank" rel="noopener">supabase/schema.sql</a>.
        </p>
      </section>

      <section class="card">
        <div class="section-title">Your data</div>
        <p class="tiny muted" style="margin-bottom:10px">
          Source files stay on this device (and in any folder you linked). Supabase holds project records,
          chat history, memory, roadmap and the file index. Export notes below; export code from a project's menu.
        </p>
        <div class="row wrap">
          <button class="btn" id="export-notes">${icon('download')} Export project notes</button>
          <button class="btn danger" id="clear-local">${icon('trash')} Clear local file copies</button>
        </div>
        <p class="tiny muted" style="margin-top:10px">
          Forgebook ${escapeHtml('1.0.0')} · running entirely in your browser.
        </p>
      </section>
    </div>`;

  function keyStatusText() {
    const key = getApiKey();
    return key ? `Saved on this device: ${maskKey(key)}` : 'No key saved on this device.';
  }

  function refreshKeyStatus() {
    const el = root.querySelector('#key-status');
    if (el) el.textContent = keyStatusText();
  }

  async function saveSettings(patch) {
    try {
      ctx.state.settings = await repo.saveSettings(patch);
    } catch (err) {
      toast(`Could not save: ${err.message}`, { kind: 'bad' });
    }
  }

  root.querySelector('#save-key').addEventListener('click', () => {
    const value = root.querySelector('#api-key').value.trim();
    if (value && !/^sk-or-|^sk-/.test(value)) {
      root.querySelector('#key-msg').innerHTML = '<div class="callout warn small">That does not look like an OpenRouter key. Keys usually start with <code>sk-or-v1-</code>.</div>';
      return;
    }
    setApiKey(value);
    refreshKeyStatus();
    root.querySelector('#key-msg').innerHTML = value
      ? '<div class="callout ok small">Key saved on this device.</div>'
      : '<div class="callout small">Key removed.</div>';
    toast(value ? 'Key saved' : 'Key removed', { kind: 'ok' });
  });

  root.querySelector('#test-key').addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    const value = root.querySelector('#api-key').value.trim();
    if (value) setApiKey(value);
    btn.disabled = true;
    btn.textContent = 'Testing…';
    try {
      const gateway = new LLMGateway({ apiKey: getApiKey() });
      const info = await gateway.verifyKey();
      const limit = info?.limit_remaining ?? info?.limit;
      root.querySelector('#key-msg').innerHTML = `<div class="callout ok small">Key works${limit != null ? ` · ${info.limit_remaining != null ? `${info.limit_remaining} credits remaining` : `limit ${info.limit}`}` : ''}.</div>`;
      refreshKeyStatus();
    } catch (err) {
      root.querySelector('#key-msg').innerHTML = `<div class="callout danger small">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon('shield')} Test`;
    }
  });

  root.querySelector('#clear-key').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Remove the API key?',
      message: 'The agent will not be able to run until you add a key again.',
      confirmLabel: 'Remove key',
      danger: true,
    });
    if (!ok) return;
    setApiKey('');
    root.querySelector('#api-key').value = '';
    refreshKeyStatus();
    toast('Key removed', { kind: 'ok' });
  });

  root.querySelector('#temperature').addEventListener('change', async (event) => {
    await saveSettings({ temperature: Number(event.target.value) });
    toast('Saved', { kind: 'ok' });
  });

  root.querySelector('#max-steps').addEventListener('change', async (event) => {
    const value = Math.max(4, Math.min(60, Number(event.target.value) || 34));
    event.target.value = value;
    await saveSettings({ maxSteps: value });
    toast('Saved', { kind: 'ok' });
  });

  for (const [id, key] of [['prefer-free', 'preferFree'], ['auto-sync', 'autoSyncModels']]) {
    const el = root.querySelector(`#${id}`);
    el.addEventListener('click', async () => {
      const next = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(next));
      await saveSettings({ [key]: next });
    });
  }

  root.querySelector('#sign-out').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Sign out?',
      message: 'Your projects stay safe. Local file copies remain on this device.',
      confirmLabel: 'Sign out',
    });
    if (ok) await auth.signOut();
  });

  root.querySelector('#recheck-schema').addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const status = await db.checkSchema();
    ctx.state.schema = status;
    root.querySelector('#schema-msg').innerHTML = status.ready
      ? '<div class="callout ok small">All tables are reachable.</div>'
      : `<div class="callout warn small">Missing: ${status.missing.map(escapeHtml).join(', ') || 'none'} ${status.networkProblem ? `· ${escapeHtml(status.networkProblem)}` : ''}</div>`;
    btn.disabled = false;
    btn.innerHTML = `${icon('refresh')} Re-check`;
  });

  root.querySelector('#export-notes').addEventListener('click', async () => {
    try {
      const projects = await repo.listProjects();
      const dump = { exportedAt: new Date().toISOString(), projects: [] };
      for (const project of projects) {
        const [memory, tasks, messages] = await Promise.all([
          repo.getMemory(project.id).catch(() => ({})),
          repo.listTasks(project.id).catch(() => []),
          repo.listMessages(project.id, 200).catch(() => []),
        ]);
        dump.projects.push({ project, memory, tasks, messages });
      }
      downloadBlob(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }), 'forgebook-notes.json');
      toast('Notes exported', { kind: 'ok' });
    } catch (err) {
      toast(`Export failed: ${err.message}`, { kind: 'bad' });
    }
  });

  root.querySelector('#clear-local').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Clear local file copies?',
      message: 'Removes project files from this browser. Records in Supabase are kept, and linked folders on disk are not touched.',
      details: 'This cannot be undone from inside the app. Export ZIPs first if you are unsure.',
      confirmLabel: 'Clear local copies',
      danger: true,
    });
    if (!ok) return;
    try {
      const projects = await repo.listProjects();
      const { Vault } = await import('../core/vault.js');
      for (const project of projects) await Vault.get(project.id).clear();
      toast('Local file copies cleared', { kind: 'ok' });
    } catch (err) {
      toast(err.message, { kind: 'bad' });
    }
  });

  return () => {};
}
