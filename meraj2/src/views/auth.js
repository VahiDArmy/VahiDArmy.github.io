/** Sign in, sign up, magic link, and password reset via the existing Supabase Auth. */
import { escapeHtml, isValidHttpUrl } from '../utils.js';
import { icon, logoMark } from '../ui/icons.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import {
  signIn,
  signUp,
  sendMagicLink,
  sendPasswordReset,
} from '../services/auth.js';

let mode = 'signin';
let busy = false;
let statusMessage = null;
let errorState = null;
let values = { email: '', password: '', displayName: '' };
let rootEl = null;

const MODES = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
  { id: 'magic', label: 'Magic link' },
];

function rawAuthDetails(error) {
  if (!error) return '';
  const fields = {
    message: error.message || null,
    code: error.code || null,
    status: error.status || null,
    details: error.details || null,
    hint: error.hint || null,
    name: error.name || null,
  };
  return JSON.stringify(fields, null, 2);
}

function render() {
  if (!rootEl) return;
  const isSignup = mode === 'signup';
  const isMagic = mode === 'magic';
  const heading = isSignup ? 'Begin your ascent' : isMagic ? 'A keyless way in' : 'Welcome back';
  const lede = isSignup
    ? 'Create an account on this Supabase project. Your conversations, branches, and model settings travel with it.'
    : isMagic
      ? 'We will ask Supabase to email you a one-time sign-in link. No password required.'
      : 'Sign in with the account already configured for this project.';

  rootEl.innerHTML = `<div class="auth">
    <div class="auth__atmosphere" aria-hidden="true">
      <span class="auth__glow auth__glow--one"></span>
      <span class="auth__glow auth__glow--two"></span>
      <span class="auth__stars"></span>
    </div>
    <aside class="auth__visual">
      <a class="auth__brand" href="#/" aria-label="معراج">
        <span class="auth__brand-mark">${logoMark({ size: 44, animate: true })}</span>
        <span><strong>معراج</strong><em>MI'RAJ · v1.0</em></span>
      </a>
      <div class="auth__hero">
        <p class="eyebrow"><span class="eyebrow__line"></span> An observatory for thought</p>
        <h1>Every answer<br><em>names its maker.</em></h1>
        <p class="auth__lede">A free-model AI workspace with a spine of glass: branches instead of lost prompts, exact request bodies instead of trust, and provider errors exactly as they arrive.</p>
        <ul class="auth__features">
          <li><span>${icon('code', { size: 17 })}</span><div><strong>Inspect every byte</strong><p>The complete JSON body sent to OpenRouter, archived with every answer.</p></div></li>
          <li><span>${icon('branch', { size: 17 })}</span><div><strong>Edit without erasing</strong><p>Resend any prompt as a new branch while the original stays intact.</p></div></li>
          <li><span>${icon('cpu', { size: 17 })}</span><div><strong>Model provenance</strong><p>Each reply discloses the exact free model that produced it — including router choices.</p></div></li>
          <li><span>${icon('alert', { size: 17 })}</span><div><strong>Errors, untampered</strong><p>HTTP status, request IDs, and the provider's raw response body, always visible.</p></div></li>
        </ul>
      </div>
      <div class="auth__orbit" aria-hidden="true">
        <span class="orbit orbit--1"></span><span class="orbit orbit--2"></span><span class="orbit orbit--3"></span>
        <span class="orbit__core">✦</span>
      </div>
      <footer class="auth__visual-foot">
        <span><i class="status-dot status-dot--ok"></i> Supabase Auth connected</span>
        <span>Free models by OpenRouter</span>
      </footer>
    </aside>

    <main class="auth__panel">
      <a class="auth__mobile-brand" href="#/" aria-label="معراج">
        <span>${logoMark({ size: 30 })}</span>
        <strong>معراج</strong>
        <em class="mono">MI'RAJ</em>
      </a>
      <div class="auth__panel-head">
        <p class="auth__kicker">${icon('spark', { size: 14 })} ${isSignup ? 'New traveller' : isMagic ? 'Passwordless' : 'Returning traveller'}</p>
        <h2>${heading}</h2>
        <p>${lede}</p>
      </div>

      <div class="auth-tabs" role="tablist" aria-label="Authentication mode">
        ${MODES.map((item) => `<button type="button" class="auth-tab ${mode === item.id ? 'is-active' : ''}" role="tab" aria-selected="${mode === item.id}" data-auth-mode="${item.id}">${item.label}</button>`).join('')}
      </div>

      <div class="auth__messages">
        ${errorState ? renderError(errorState) : ''}
        ${statusMessage ? `<div class="auth-success">${icon('checkCircle', { size: 17 })}<p>${escapeHtml(statusMessage)}</p></div>` : ''}
      </div>

      <form class="auth-form" id="auth-form" novalidate>
        ${isSignup ? `<label class="field"><span>Display name <em>optional</em></span><div class="input-wrap">${icon('user', { size: 16 })}<input class="input" type="text" name="displayName" id="auth-name" value="${escapeHtml(values.displayName)}" placeholder="How should we address you?" autocomplete="name" maxlength="60"></div></label>` : ''}
        <label class="field"><span>Email</span><div class="input-wrap">${icon('mail', { size: 16 })}<input class="input" type="email" name="email" id="auth-email" value="${escapeHtml(values.email)}" placeholder="you@example.com" autocomplete="email" required aria-required="true"></div></label>
        ${isMagic ? '' : `<label class="field"><span>Password</span><div class="input-wrap">${icon('lock', { size: 16 })}<input class="input" type="password" name="password" id="auth-password" value="${escapeHtml(values.password)}" placeholder="${isSignup ? 'At least 6 characters' : 'Your password'}" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required minlength="6" aria-required="true"><button type="button" class="input-action" data-toggle-password aria-label="Show password">${icon('eye', { size: 16 })}</button></div></label>`}
        ${mode === 'signin' ? `<div class="auth-form__between"><span class="muted tiny">Sessions are stored by Supabase Auth.</span><button type="button" class="link-btn" data-forgot-password>Forgot password?</button></div>` : ''}
        ${isMagic ? `<p class="auth-note">${icon('mail', { size: 15 })} Supabase will send a sign-in link to this address. The link returns you here.</p>` : ''}
        <button type="submit" class="btn btn--primary btn--large auth-submit" ${busy ? 'disabled' : ''}>
          ${busy ? `${icon('loader', { size: 17, className: 'spin' })}<span>Working…</span>` : `${icon(isMagic ? 'magic' : isSignup ? 'arrowRight' : 'arrowRight', { size: 17 })}<span>${isMagic ? 'Email me a link' : isSignup ? 'Create my account' : 'Enter معراج'}</span>`}
        </button>
      </form>

      <div class="auth__trust">
        <span>${icon('shield', { size: 14 })} Row-level security</span>
        <span>${icon('key', { size: 14 })} OpenRouter key stays local</span>
        <span>${icon('database', { size: 14 })} Chats in Supabase</span>
      </div>

      <p class="auth__fineprint">By continuing you agree to use this workspace responsibly. Free models may log or rate-limit requests according to OpenRouter's policies. Your API key is never stored in Supabase by this app.</p>
      <p class="auth__version">معراج · v1.0.0 · Supabase project nvmevqkaovazhmoznusf</p>
    </main>
  </div>`;

  bind();
  const email = rootEl.querySelector('#auth-email');
  if (email) {
    email.addEventListener('input', () => {
      values.email = email.value;
    });
  }
  if (isSignup) {
    const name = rootEl.querySelector('#auth-name');
    name?.addEventListener('input', () => {
      values.displayName = name.value;
    });
  }
  const password = rootEl.querySelector('#auth-password');
  password?.addEventListener('input', () => {
    values.password = password.value;
  });
  if (!busy) {
    window.setTimeout(() => rootEl?.querySelector(`#auth-${isMagic ? 'email' : values.email ? 'password' : 'email'}`)?.focus(), 50);
  }
}

function renderError(error) {
  return `<div class="auth-error" role="alert">
    <span class="auth-error__icon">${icon('xCircle', { size: 18 })}</span>
    <div class="auth-error__copy">
      <strong>Supabase Auth response</strong>
      <p>${escapeHtml(error.message || 'The authentication request failed.')}</p>
      <div class="auth-error__meta">
        ${error.code ? `<span class="mono">code: ${escapeHtml(error.code)}</span>` : ''}
        ${error.status ? `<span class="mono">HTTP ${escapeHtml(error.status)}</span>` : ''}
      </div>
      ${error.details || error.hint ? `<p class="auth-error__detail">${escapeHtml(error.details || '')}${error.hint ? ` · ${escapeHtml(error.hint)}` : ''}</p>` : ''}
      <details class="auth-error__raw"><summary>Exact error fields</summary><pre>${escapeHtml(rawAuthDetails(error))}</pre></details>
    </div>
  </div>`;
}

function setBusy(next) {
  busy = next;
  render();
}

function setMode(next) {
  if (busy) return;
  mode = next;
  errorState = null;
  statusMessage = null;
  render();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (busy) return;
  const form = rootEl.querySelector('#auth-form');
  const email = form.querySelector('#auth-email')?.value.trim() || '';
  const password = form.querySelector('#auth-password')?.value || '';
  const displayName = form.querySelector('#auth-name')?.value.trim() || '';
  values = { email, password, displayName };
  errorState = null;
  statusMessage = null;

  if (!email) {
    errorState = { message: 'Enter an email address before submitting.', code: 'local-validation', status: null };
    render();
    return;
  }
  if (mode !== 'magic' && password.length < 6) {
    errorState = { message: 'Supabase requires a password of at least 6 characters for this form.', code: 'local-validation', status: null };
    render();
    return;
  }

  setBusy(true);
  if (mode === 'magic') {
    const { error } = await sendMagicLink(email);
    busy = false;
    if (error) {
      errorState = error;
      statusMessage = null;
    } else {
      statusMessage = `Supabase accepted the magic-link request for ${email}. Check that inbox and spam folder.`;
    }
    render();
    return;
  }

  if (mode === 'signup') {
    const { data, error } = await signUp(email, password, displayName);
    busy = false;
    if (error) {
      errorState = error;
      statusMessage = null;
    } else if (data?.session) {
      statusMessage = 'Account created and signed in. Preparing your workspace…';
    } else if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      statusMessage =
        'Supabase returned a user without identities. This usually means the email is already registered; try Sign in or reset the password. The exact auth fields are available in the response.';
    } else {
      statusMessage = 'Account created. If email confirmation is enabled, confirm your address before signing in.';
    }
    render();
    return;
  }

  const { error } = await signIn(email, password);
  busy = false;
  if (error) {
    errorState = error;
    statusMessage = null;
    render();
    return;
  }
  statusMessage = 'Authenticated. Opening your observatory…';
  render();
}

function openResetDialog() {
  const email = values.email || '';
  const modal = openModal({
    title: 'Reset your password',
    subtitle: 'Supabase will email a recovery link. It returns to this app.',
    size: 'sm',
    body: `<form class="form" data-reset-form>
      <label class="field"><span>Email</span><div class="input-wrap">${icon('mail', { size: 16 })}<input class="input" type="email" name="reset-email" value="${escapeHtml(email)}" placeholder="you@example.com" required></div></label>
      <div data-reset-result></div>
    </form>`,
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Send recovery link',
        variant: 'primary',
        close: false,
        busyLabel: 'Sending…',
        onClick: async ({ body }) => {
          const form = body.querySelector('[data-reset-form]');
          const address = form.querySelector('input[name="reset-email"]')?.value.trim() || '';
          const result = body.querySelector('[data-reset-result]');
          if (!address) {
            result.innerHTML = `<p class="notice notice--danger">${icon('alert', { size: 15 })}Enter an email address.</p>`;
            return false;
          }
          const { error } = await sendPasswordReset(address);
          if (error) {
            result.innerHTML = `<div class="auth-error auth-error--compact">${icon('xCircle', { size: 17 })}<div><strong>Supabase response</strong><p>${escapeHtml(error.message)}</p>${error.code ? `<span class="mono">code: ${escapeHtml(error.code)}</span>` : ''}</div></div>`;
            return false;
          }
          result.innerHTML = `<p class="notice notice--ok">${icon('checkCircle', { size: 15 })}Supabase accepted the recovery request. Check ${escapeHtml(address)}.</p>`;
          return false;
        },
      },
    ],
  });
  modal.body.querySelector('input')?.focus();
  modal.body.querySelector('[data-reset-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    modal.root.querySelector('[data-action-index="1"]')?.click();
  });
}

function bind() {
  if (!rootEl) return;
  rootEl.querySelectorAll('[data-auth-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.authMode));
  });
  rootEl.querySelector('#auth-form')?.addEventListener('submit', handleSubmit);
  rootEl.querySelector('[data-toggle-password]')?.addEventListener('click', (event) => {
    const input = rootEl.querySelector('#auth-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.innerHTML = icon(input.type === 'password' ? 'eye' : 'eyeOff', { size: 16 });
    event.currentTarget.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  });
  rootEl.querySelector('[data-forgot-password]')?.addEventListener('click', openResetDialog);
  rootEl.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      rootEl.querySelector('#auth-form')?.requestSubmit();
    }
  });
}

export function mountAuth(root, ctx = {}) {
  rootEl = root;
  mode = 'signin';
  busy = false;
  statusMessage = null;
  errorState = null;
  values = { email: '', password: '', displayName: '' };
  if (ctx.authError) {
    errorState = {
      message: ctx.authError.description || ctx.authError.error || 'The authentication link returned an error.',
      code: ctx.authError.code || ctx.authError.error,
      status: null,
    };
  }
  if (ctx.resetMode) {
    statusMessage = 'Recovery link accepted. Set a new password from Settings once you are signed in.';
  }
  render();
  void isValidHttpUrl;
}

export function unmountAuth() {
  rootEl = null;
  toast({ title: 'Signed out', message: 'Your local session was ended.', type: 'info', duration: 2200 });
}
