// ---------------------------------------------------------------------------
// Sign-in screen and the database setup screen.
// ---------------------------------------------------------------------------

import { auth, db } from '../core/db.js';
import { SCHEMA_FILE, APP } from '../config.js';
import { escapeHtml } from '../core/util.js';
import { icon, toast, codeBlockWithCopy } from './dom.js';

export function renderAuth(root) {
  let mode = 'signin';
  let busy = false;

  root.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand"><span class="brand-dot">F</span> ${escapeHtml(APP.name)}</div>
        <p class="lede">An AI development workspace where your project files stay in your hands.</p>
        <div class="segmented" role="tablist">
          <button data-mode="signin" class="active" role="tab">Sign in</button>
          <button data-mode="signup" role="tab">Create account</button>
        </div>
        <form id="auth-form" novalidate>
          <div class="field">
            <label for="email">Email</label>
            <input class="input" id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input class="input" id="password" type="password" autocomplete="current-password" placeholder="At least 8 characters" required minlength="6" />
            <span class="hint" id="pw-hint"></span>
          </div>
          <button class="btn primary" id="submit" type="submit" style="width:100%;min-height:44px">Sign in</button>
        </form>
        <div id="auth-msg" style="margin-top:14px"></div>
        <div class="divider"></div>
        <p class="tiny muted center">
          Your projects are stored in your own Supabase project and guarded by row-level security.
          Nothing is shared between accounts.
        </p>
      </div>
    </div>`;

  const msg = root.querySelector('#auth-msg');
  const submit = root.querySelector('#submit');
  const pwHint = root.querySelector('#pw-hint');
  const password = root.querySelector('#password');

  const setMode = (next) => {
    mode = next;
    root.querySelectorAll('.segmented button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    submit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    password.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    pwHint.textContent = mode === 'signup' ? 'Password confirmation may be required by your Supabase settings.' : '';
    msg.innerHTML = '';
  };

  root.querySelectorAll('.segmented button').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  root.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const email = root.querySelector('#email').value.trim();
    const pass = password.value;
    if (!email || !pass) {
      msg.innerHTML = '<div class="callout danger">Enter your email and password.</div>';
      return;
    }
    busy = true;
    submit.disabled = true;
    submit.textContent = mode === 'signin' ? 'Signing in…' : 'Creating account…';
    msg.innerHTML = '';
    try {
      if (mode === 'signin') {
        await auth.signIn(email, pass);
        toast('Signed in', { kind: 'ok' });
      } else {
        const result = await auth.signUp(email, pass);
        if (result.needsConfirmation) {
          msg.innerHTML = `<div class="callout warn">
            <strong>Confirm your email.</strong><br/>
            We sent a link to ${escapeHtml(email)}. Open it, then sign in here.
            <span class="tiny muted" style="display:block;margin-top:6px">For quicker testing, turn off
            “Confirm email” in Supabase → Authentication → Providers → Email, then create the account again.</span>
          </div>`;
          submit.disabled = false;
          submit.textContent = 'Create account';
          setMode('signin');
          return;
        }
        toast('Account created', { kind: 'ok' });
      }
    } catch (err) {
      msg.innerHTML = `<div class="callout danger">${escapeHtml(err.message)}</div>`;
    } finally {
      busy = false;
      submit.disabled = false;
      if (root.querySelector('#submit') === submit) {
        submit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
      }
    }
  });
}

export async function renderSetup(root, { missing = [], reason = '' } = {}) {
  root.innerHTML = `
    <div class="auth-wrap" style="align-items:flex-start">
      <div class="auth-card" style="max-width:680px">
        <div class="brand" style="justify-content:flex-start"><span class="brand-dot">F</span> ${escapeHtml(APP.name)}</div>
        <h2 style="margin:14px 0 6px;font-size:19px">One-time database setup</h2>
        <p class="small muted" style="margin-bottom:14px">
          Your Supabase project is connected, but the tables this app needs are not there yet.
          Run the SQL below once in the Supabase SQL editor. It creates 11 <code>fb_</code> tables with row-level security.
        </p>
        ${missing.length ? `<div class="callout warn small" style="margin-bottom:12px"><strong>Missing:</strong> ${missing.map(escapeHtml).join(', ')}</div>` : ''}
        ${reason ? `<div class="callout danger small" style="margin-bottom:12px">${escapeHtml(reason)}</div>` : ''}
        <ol class="small" style="color:var(--text-2);padding-left:18px;margin:0 0 14px;line-height:1.7">
          <li>Open your Supabase project → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
          <li>Paste the schema and press <strong>Run</strong>.</li>
          <li>Come back and press <strong>Check again</strong>.</li>
        </ol>
        <div id="schema-host"><div class="skeleton" style="height:120px"></div></div>
        <div class="row" style="margin-top:14px">
          <button class="btn" id="recheck">${icon('refresh')} Check again</button>
          <a class="btn ghost" href="supabase/schema.sql" target="_blank" rel="noopener">${icon('download')} Open schema file</a>
          <span class="spacer"></span>
          <button class="btn ghost" id="signout">Sign out</button>
        </div>
        <div id="setup-msg" style="margin-top:12px"></div>
      </div>
    </div>`;

  const host = root.querySelector('#schema-host');
  let sql = '';
  try {
    const res = await fetch(SCHEMA_FILE, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sql = await res.text();
  } catch (err) {
    host.innerHTML = `<div class="callout danger small">Could not load ${escapeHtml(SCHEMA_FILE)} (${escapeHtml(err.message)}). Open it from the repository root instead.</div>`;
  }
  if (sql) {
    host.innerHTML = codeBlockWithCopy(sql, { language: 'sql' });
    host.querySelector('[data-copy]')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(sql);
        toast('Schema copied', { kind: 'ok' });
      } catch {
        toast('Copy failed — select the SQL manually', { kind: 'warn' });
      }
    });
  }

  root.querySelector('#signout').addEventListener('click', () => auth.signOut());

  root.querySelector('#recheck').addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const status = await db.checkSchema();
    btn.disabled = false;
    if (status.ready) {
      toast('Database ready', { kind: 'ok' });
      window.location.reload();
      return;
    }
    root.querySelector('#setup-msg').innerHTML = status.missing.length
      ? `<div class="callout warn small">Still missing: ${status.missing.map(escapeHtml).join(', ')}</div>`
      : `<div class="callout danger small">${escapeHtml(status.networkProblem || 'Tables exist but are not accessible. Check the RLS policies in the schema.')}</div>`;
    btn.innerHTML = `${icon('refresh')} Check again`;
  });
}
