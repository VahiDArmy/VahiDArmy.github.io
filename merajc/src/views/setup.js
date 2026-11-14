/** One-time Supabase schema setup. The publishable key cannot execute DDL. */
import { CONFIG } from '../config.js';
import { escapeHtml, copyText, download } from '../utils.js';
import { state, setState } from '../store.js';
import { checkSchema } from '../services/db.js';
import { icon, logoMark } from '../ui/icons.js';
import { toast, toastError } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';

let sqlCache = '';
let rootEl = null;

const TABLES = [
  ['meraj_profiles', 'Your display name and preferences'],
  ['meraj_models', 'The stored free-model catalogue and your on/off flags'],
  ['meraj_conversations', 'Chats, active branches, params, system prompts'],
  ['meraj_messages', 'Every message, branch, exact request body, and raw error'],
  ['meraj_prompts', 'Your saved prompts and personas'],
  ['meraj_events', 'Per-model analytics events'],
];

function tableRows() {
  const missing = new Set((state.schema.missing || []).map((item) => item.table));
  const errored = new Set((state.schema.otherErrors || []).map((item) => item.table));
  return TABLES.map(([name, purpose]) => {
    const status = state.schema.status === 'ready' ? 'ok' : missing.has(name) ? 'missing' : errored.has(name) ? 'error' : 'ok';
    return `<div class="setup-table setup-table--${status}">
      <span class="setup-table__icon">${icon(status === 'ok' ? 'checkCircle' : status === 'error' ? 'alert' : 'circle', { size: 17 })}</span>
      <div><code>${escapeHtml(name)}</code><p>${escapeHtml(purpose)}</p></div>
      <span class="setup-table__status">${status === 'ok' ? 'ready' : status === 'error' ? 'permission error' : 'not created'}</span>
    </div>`;
  }).join('');
}

function errorDetails() {
  const errors = [
    ...(state.schema.missing || []).map((item) => ({ table: item.table, error: item.error })),
    ...(state.schema.otherErrors || []).map((item) => ({ table: item.table, error: item.error })),
  ];
  if (!errors.length) return '';
  return `<div class="setup-errors">
    <p class="setup-errors__head">${icon('alert', { size: 16 })} Raw Supabase errors</p>
    ${errors
      .map(
        (item) => `<details class="setup-error" ${errors.length === 1 ? 'open' : ''}>
          <summary><code>${escapeHtml(item.table)}</code><span class="mono">${escapeHtml(item.error?.code || 'error')}</span></summary>
          <pre>${escapeHtml(JSON.stringify({ message: item.error?.message, code: item.error?.code, details: item.error?.details, hint: item.error?.hint }, null, 2))}</pre>
        </details>`,
      )
      .join('')}
  </div>`;
}

async function loadSql() {
  if (sqlCache) return sqlCache;
  try {
    const response = await fetch(CONFIG.setup.sqlPath, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not fetch ${CONFIG.setup.sqlPath}: HTTP ${response.status} ${response.statusText}`);
    sqlCache = await response.text();
    return sqlCache;
  } catch (error) {
    toastError('Schema file unavailable', error);
    return '';
  }
}

async function copySchema() {
  const sql = await loadSql();
  if (!sql) return;
  const ok = await copyText(sql);
  toast(
    ok
      ? { title: 'Schema SQL copied', message: `${sql.length.toLocaleString()} characters — paste into the Supabase SQL editor.`, type: 'success' }
      : { title: 'Clipboard blocked', message: 'Open supabase/schema.sql and copy it manually.', type: 'error' },
  );
}

async function downloadSchema() {
  const sql = await loadSql();
  if (sql) download('meraj-schema.sql', sql, 'text/plain;charset=utf-8');
}

async function recheck() {
  const button = rootEl?.querySelector('[data-recheck]');
  if (button) {
    button.disabled = true;
    button.innerHTML = `${icon('loader', { size: 16, className: 'spin' })}<span>Checking…</span>`;
  }
  const result = await checkSchema();
  setState({ schema: { ...result, checkedAt: new Date().toISOString() } }, 'schema-check');
  if (result.status === 'ready') {
    toast({ title: 'Database ready', message: 'All معراج tables responded. Opening the workspace.', type: 'success' });
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('meraj:retry-workspace')), 400);
  } else if (result.status === 'missing') {
    toast({
      title: 'Tables still missing',
      message: `${result.missing.length} meraj_ table(s) were not found. Run the SQL in the Supabase SQL editor.`,
      type: 'warning',
      duration: 7000,
    });
  } else {
    toastError('Schema check failed', result.error);
  }
  render();
}

function render() {
  if (!rootEl) return;
  const ready = state.schema.status === 'ready';
  const userEmail = state.user?.email || 'signed in';
  rootEl.innerHTML = `<div class="setup-page">
    <header class="setup-top">
      <a class="brand" href="#/chat"><span class="brand__mark">${logoMark({ size: 34 })}</span><span class="brand__text"><strong>معراج</strong><em>MI'RAJ</em></span></a>
      <div class="setup-top__actions">
        <span class="setup-user">${icon('user', { size: 14 })} ${escapeHtml(userEmail)}</span>
        <button type="button" class="btn btn--small btn--ghost" data-signout>${icon('logout', { size: 14 })}<span>Sign out</span></button>
      </div>
    </header>
    <main class="setup-main">
      <section class="setup-hero">
        <div class="setup-hero__eyebrow"><span class="status-dot ${ready ? 'status-dot--ok' : 'status-dot--warn'}"></span>${ready ? 'Database connected' : 'One-time database step'}</div>
        <h1>${ready ? 'Your observatory is ready.' : 'Give معراج its tables.'}</h1>
        <p>${ready ? 'Every meraj_ table responded under row-level security. You can open the workspace.' : 'Your Supabase Auth is already working. The application data needs six prefixed tables so nothing collides with your existing schema — including public.profiles.'}</p>
        <div class="setup-actions">
          ${ready ? `<button type="button" class="btn btn--primary btn--large" data-enter>${icon('arrowRight', { size: 17 })}<span>Enter the workspace</span></button>` : ''}
          <button type="button" class="btn btn--primary btn--large" data-copy-sql>${icon('copy', { size: 16 })}<span>Copy schema SQL</span></button>
          <button type="button" class="btn btn--ghost" data-download-sql>${icon('download', { size: 16 })}<span>Download .sql</span></button>
          <button type="button" class="btn btn--ghost" data-recheck>${icon('refresh', { size: 16 })}<span>Recheck tables</span></button>
          <a class="btn btn--ghost" href="https://supabase.com/dashboard/project/nvmevqkaovazhmoznusf/sql/new" target="_blank" rel="noopener noreferrer">${icon('external', { size: 16 })}<span>Open SQL editor</span></a>
        </div>
      </section>

      <div class="setup-grid">
        <section class="setup-card">
          <div class="setup-card__head"><span class="setup-step">01</span><div><h2>Run the migration</h2><p>Paste the included SQL into your project's SQL editor. It is idempotent, so a second run is safe.</p></div></div>
          <ol class="setup-steps">
            <li><span>Open</span> the Supabase dashboard for <code>nvmevqkaovazhmoznusf</code>.</li>
            <li><span>Go to</span> <strong>SQL Editor → New query</strong>.</li>
            <li><span>Paste</span> the entire schema and press <strong>Run</strong>.</li>
            <li><span>Return</span> here and press <strong>Recheck tables</strong>.</li>
          </ol>
          <pre class="setup-sql-preview">${escapeHtml('-- meraj_ tables, indexes, RLS policies, profile trigger\n-- see supabase/schema.sql — copy the full file, not this preview')}</pre>
        </section>

        <section class="setup-card">
          <div class="setup-card__head"><span class="setup-step">02</span><div><h2>Why this step exists</h2><p>The Supabase publishable key is intentionally powerless to create tables. DDL needs the dashboard or a service-role connection.</p></div></div>
          <ul class="setup-notes">
            <li>${icon('shieldCheck', { size: 16 })}<div><strong>Your existing tables are untouched.</strong><p>Every new table is prefixed <code>meraj_</code>. The SQL never alters <code>public.profiles</code>.</p></div></li>
            <li>${icon('lock', { size: 16 })}<div><strong>RLS on every table.</strong><p>Each policy restricts rows to <code>auth.uid() = user_id</code>. Anonymous visitors have no access.</p></div></li>
            <li>${icon('key', { size: 16 })}<div><strong>No key is stored in the database.</strong><p>The OpenRouter key lives only in your browser. Request snapshots redact the Authorization header.</p></div></li>
            <li>${icon('database', { size: 16 })}<div><strong>Exact requests are archived.</strong><p>The <code>request</code> JSON column stores the byte-exact body with every assistant message.</p></div></li>
          </ul>
        </section>
      </div>

      <section class="setup-card setup-card--wide">
        <div class="setup-card__head"><span class="setup-step">03</span><div><h2>Table checklist</h2><p>A live RLS-protected probe. Errors below are exactly what Supabase returned.</p></div></div>
        <div class="setup-tables">${tableRows()}</div>
        ${errorDetails()}
        <div class="setup-statusline">
          <span>Last checked: ${state.schema.checkedAt ? escapeHtml(new Date(state.schema.checkedAt).toLocaleString()) : 'not yet'}</span>
          <span class="mono">${state.schema.status}</span>
        </div>
      </section>

      <details class="setup-sql">
        <summary>View the full schema before you run it</summary>
        <div class="setup-sql__body" data-sql-body><p class="muted">Loading supabase/schema.sql…</p></div>
      </details>
    </main>
  </div>`;

  rootEl.querySelector('[data-copy-sql]')?.addEventListener('click', copySchema);
  rootEl.querySelector('[data-download-sql]')?.addEventListener('click', downloadSchema);
  rootEl.querySelector('[data-recheck]')?.addEventListener('click', recheck);
  rootEl.querySelector('[data-enter]')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('meraj:retry-workspace')));
  rootEl.querySelector('[data-signout]')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Sign out?',
      message: 'Your database remains untouched. You can sign back in at any time.',
      confirmLabel: 'Sign out',
    });
    if (confirmed) window.dispatchEvent(new CustomEvent('meraj:signout'));
  });

  loadSql().then((sql) => {
    const holder = rootEl?.querySelector('[data-sql-body]');
    if (!holder || !sql) return;
    holder.innerHTML = `<pre class="setup-sql__pre">${escapeHtml(sql)}</pre>`;
  });
}

export function mountSetup(root) {
  rootEl = root;
  render();
}

export function unmountSetup() {
  rootEl = null;
}
