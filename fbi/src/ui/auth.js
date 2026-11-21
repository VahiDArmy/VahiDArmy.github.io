import { supabase } from '../lib/supabase.js';
import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/utils.js';
import { t } from '../lib/i18n.js';
import { openModal } from './overlay.js';
import { toast } from './toast.js';

const redirectTo = () => `${window.location.origin}${window.location.pathname}`;

let mode = 'signin';
let busy = false;
let message = null;

export function renderAuthScreen(initialMessage = null) {
  message = initialMessage;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-shell">
      <div class="bg-layers" aria-hidden="true">
        <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
        <div class="grid-veil"></div>
      </div>
      <section class="auth-hero">
        <div class="brand" style="padding:0">
          <div class="logo">${icon('spark')}</div>
          <div class="brand-text"><span class="brand-name">Nebula</span><span class="brand-sub">AI Studio</span></div>
        </div>
        <div>
          <h1>One quiet place for <span class="grad-text">every thought</span>.</h1>
          <p class="auth-lead">
            Free OpenRouter models, streaming reasoning you can actually read, branching
            conversations, and a request inspector that shows every byte sent to the model.
          </p>
          <div class="auth-features">
            <div class="auth-feature"><span class="fi">${icon('branch')}</span><div><b>Branch anything.</b> Edit a message and grow a second path without losing the first.</div></div>
            <div class="auth-feature"><span class="fi">${icon('brain')}</span><div><b>Reasoning, visible.</b> Watch the model think as tokens arrive, or fold it away.</div></div>
            <div class="auth-feature"><span class="fi">${icon('globe')}</span><div><b>Persian & English.</b> Every paragraph picks its own direction, right down to the code blocks.</div></div>
            <div class="auth-feature"><span class="fi">${icon('terminal')}</span><div><b>Full transparency.</b> Inspect the exact JSON payload and raw response stream.</div></div>
          </div>
        </div>
        <div class="auth-hero-foot"><span class="dot"></span> Free models only · your key stays in your own Supabase row</div>
      </section>
      <section class="auth-panel">
        <div class="auth-card" id="auth-card"></div>
      </section>
    </div>`;
  drawCard();
}

function drawCard() {
  const card = document.getElementById('auth-card');
  if (!card) return;
  const isSignIn = mode === 'signin';
  const isSignUp = mode === 'signup';
  const isMagic = mode === 'magic';

  card.innerHTML = `
    <div class="brand" style="padding:0 0 4px">
      <div class="logo">${icon('spark')}</div>
      <div class="brand-text"><span class="brand-name">Nebula</span><span class="brand-sub">AI Studio</span></div>
    </div>
    <h2>${isSignUp ? t('Create your workspace') : isMagic ? t('Magic link sign in') : t('Welcome back')}</h2>
    <p class="auth-sub">${
      isSignUp
        ? t('Your chats, branches and settings stay in your own Supabase account.')
        : isMagic
          ? t('We will email you a one-time sign-in link. No password needed.')
          : t('Sign in to continue your conversations.')
    }</p>

    <div class="auth-tabs">
      <button type="button" class="auth-tab ${isSignIn ? 'active' : ''}" data-auth-mode="signin">${t('Sign in')}</button>
      <button type="button" class="auth-tab ${isSignUp ? 'active' : ''}" data-auth-mode="signup">${t('Sign up')}</button>
      <button type="button" class="auth-tab ${isMagic ? 'active' : ''}" data-auth-mode="magic">${t('Magic link')}</button>
    </div>

    <div id="auth-message">${renderMessage()}</div>

    <form id="auth-form" class="stack" novalidate>
      <div class="field">
        <label for="auth-email">${t('Email')}</label>
        <input id="auth-email" class="input" type="email" autocomplete="email" placeholder="you@example.com" dir="ltr" required />
      </div>
      ${
        isMagic
          ? ''
          : `<div class="field">
              <label for="auth-password">${t('Password')}</label>
              <div style="position:relative">
                <input id="auth-password" class="input" type="password" autocomplete="${isSignUp ? 'new-password' : 'current-password'}" placeholder="••••••••" dir="ltr" required minlength="6" style="padding-inline-end:42px" />
                <button type="button" class="icon-btn tiny" id="toggle-password" style="position:absolute;inset-inline-end:5px;top:50%;transform:translateY(-50%)" aria-label="Show password">${icon('eye')}</button>
              </div>
            </div>`
      }
      <button type="submit" class="btn btn-primary" id="auth-submit" style="width:100%;padding:11px">
        ${isSignUp ? t('Create account') : isMagic ? t('Send magic link') : t('Sign in')}
      </button>
      ${
        isSignIn
          ? `<button type="button" class="btn btn-ghost btn-sm" id="auth-forgot" style="align-self:center">${t('Forgot password?')}</button>`
          : ''
      }
    </form>

    <div class="auth-divider">${t('or')}</div>

    <div class="stack" style="gap:8px">
      <button type="button" class="oauth-btn" data-oauth="google">${icon('google')} ${t('Continue with Google')}</button>
      <button type="button" class="oauth-btn" data-oauth="github">${icon('github')} ${t('Continue with GitHub')}</button>
    </div>

    <details class="auth-note">
      <summary style="cursor:pointer;font-weight:600;color:var(--text-soft)">${t('First-time setup notes')}</summary>
      <div class="stack" style="gap:8px;margin-top:8px">
        <div>${t('If emails or OAuth land on the wrong page, add this exact URL in Supabase → Authentication → URL Configuration:')}</div>
        <code>${escapeHtml(redirectTo())}</code>
        <div>${t('For instant testing, turn off “Confirm email” under Authentication → Providers → Email.')}</div>
        <div>${t('The app needs its five fbai_ tables — the setup screen appears automatically if they are missing.')}</div>
      </div>
    </details>`;

  card.querySelectorAll('[data-auth-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.authMode;
      message = null;
      drawCard();
    });
  });

  card.querySelector('#toggle-password')?.addEventListener('click', () => {
    const input = card.querySelector('#auth-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  card.querySelector('#auth-forgot')?.addEventListener('click', () => forgotPassword(card));
  card.querySelectorAll('[data-oauth]').forEach((btn) => {
    btn.addEventListener('click', () => oauth(btn, btn.dataset.oauth));
  });
  card.querySelector('#auth-form').addEventListener('submit', (event) => submit(event, card));
  card.querySelector('#auth-email')?.focus();
}

function renderMessage() {
  if (!message) return '';
  return `<div class="auth-msg ${message.type}">${escapeHtml(message.text)}</div>`;
}

function setMessage(card, type, text) {
  message = { type, text };
  const holder = card.querySelector('#auth-message');
  if (holder) holder.innerHTML = renderMessage();
}

function setBusy(card, value) {
  busy = value;
  const btn = card.querySelector('#auth-submit');
  if (!btn) return;
  btn.disabled = value;
  if (value) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = `<span class="spin">${icon('refresh')}</span> ${t('Working…')}`;
  } else if (btn.dataset.label) {
    btn.innerHTML = btn.dataset.label;
  }
}

async function submit(event, card) {
  event.preventDefault();
  if (busy) return;
  const email = card.querySelector('#auth-email').value.trim();
  const passwordInput = card.querySelector('#auth-password');
  const password = passwordInput ? passwordInput.value : '';

  if (!email || !email.includes('@')) return setMessage(card, 'err', t('Enter a valid email address.'));
  if (mode !== 'magic' && password.length < 6) {
    return setMessage(card, 'err', t('Password must be at least 6 characters.'));
  }

  setBusy(card, true);
  try {
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo(), data: { full_name: email.split('@')[0] } },
      });
      if (error) throw error;
      if (!data.session) {
        setMessage(card, 'ok', t('Account created. Check your inbox to confirm the email, then sign in.'));
      } else {
        setMessage(card, 'ok', t('Account created. Loading your workspace…'));
      }
    } else if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
      });
      if (error) throw error;
      setMessage(card, 'ok', t('Magic link sent. Open the email on this device to finish signing in.'));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage(card, 'ok', t('Signed in. Loading your workspace…'));
    }
  } catch (error) {
    setMessage(card, 'err', friendlyAuthError(error));
  } finally {
    setBusy(card, false);
  }
}

async function oauth(btn, provider) {
  if (busy) return;
  try {
    btn.disabled = true;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo(), queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined },
    });
    if (error) throw error;
  } catch (error) {
    toast(friendlyAuthError(error), { type: 'err', timeout: 7000 });
    btn.disabled = false;
  }
}

async function forgotPassword(card) {
  const email = card.querySelector('#auth-email').value.trim();
  if (!email || !email.includes('@')) {
    return setMessage(card, 'err', t('Type your email above first, then tap “Forgot password?”.'));
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
    if (error) throw error;
    setMessage(card, 'ok', t('Password reset link sent. Check your inbox.'));
  } catch (error) {
    setMessage(card, 'err', friendlyAuthError(error));
  }
}

function friendlyAuthError(error) {
  const text = error?.message || String(error);
  if (/invalid login credentials/i.test(text)) return t('That email and password do not match an account.');
  if (/email not confirmed/i.test(text)) return t('Confirm your email first — check your inbox for the link.');
  if (/user already registered/i.test(text)) return t('That email already has an account. Try signing in instead.');
  if (/rate limit|too many/i.test(text)) return t('Too many attempts. Wait a minute and try again.');
  if (/provider is not enabled/i.test(text)) return t('That sign-in provider is not enabled in your Supabase project yet.');
  if (/failed to fetch|network/i.test(text)) return t('Could not reach Supabase. Check your connection and project URL.');
  return text;
}

export function openPasswordRecovery() {
  const modal = openModal({
    title: t('Set a new password'),
    iconName: 'key',
    className: 'narrow',
    body: `
      <div class="stack">
        <p class="small muted">${t('You followed a recovery link. Choose a new password for your account.')}</p>
        <div class="field">
          <label for="new-password">${t('New password')}</label>
          <input id="new-password" class="input" type="password" minlength="6" dir="ltr" placeholder="••••••••" />
        </div>
        <div id="recovery-msg"></div>
      </div>`,
    footer: `
      <div class="spacer"></div>
      <button class="btn" data-action="close-modal">${t('Cancel')}</button>
      <button class="btn btn-primary" id="recovery-save">${t('Save password')}</button>`,
  });

  const input = modal.bodyEl.querySelector('#new-password');
  const msg = modal.bodyEl.querySelector('#recovery-msg');
  const btn = modal.scrim.querySelector('#recovery-save');
  btn.addEventListener('click', async () => {
    const password = input.value;
    if (password.length < 6) {
      msg.innerHTML = `<div class="auth-msg err">${t('Password must be at least 6 characters.')}</div>`;
      return;
    }
    btn.disabled = true;
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast(t('Password updated. You are signed in.'), { type: 'ok' });
      modal.close();
    } catch (error) {
      msg.innerHTML = `<div class="auth-msg err">${escapeHtml(friendlyAuthError(error))}</div>`;
      btn.disabled = false;
    }
  });
  input.focus();
}
