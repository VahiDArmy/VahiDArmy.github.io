/* ============================================================
   js/pages/auth.page.js
   Wires the login / signup / forgot forms on the auth screen.
   FIXED:
     - clearBanner → hideBanner (typo fix in setupTabs)
     - Inline form-level error banner above the submit button
     - Verbose console logging for debugging
     - Never leaves the submit button in a stuck state
   ============================================================ */

import { byId, $$, el } from '../utils/dom.js';
import { toast } from '../ui/toast.js';
import { setButtonLoading } from '../ui/loader.js';
import { validateEmail, validatePassword, validatePasswordMatch, validateDisplayName } from '../utils/validation.js';
import { authService } from '../services/index.js';
import { get as lsGet } from '../utils/storage.js';
import { LS_KEYS } from '../config/app.config.js';
import { prompt } from '../ui/confirm.js';

let initialized = false;

/* ── Public API ─────────────────────────────────────────── */

export function mountAuthPage() {
  if (initialized) return;
  initialized = true;

  setupTabs();
  setupPasswordToggles();
  setupPasswordMeter();
  setupLoginForm();
  setupSignupForm();
  setupForgot();

  // Prefill remembered email
  const remembered = lsGet(LS_KEYS.REMEMBER_EMAIL, '');
  if (remembered) {
    const el0 = byId('login-email');
    if (el0) el0.value = remembered;
    const pwd = byId('login-password');
    if (pwd) setTimeout(() => pwd.focus(), 250);
  }
}

/* ── Tabs ───────────────────────────────────────────────── */

function setupTabs() {
  const tabs = $$('[data-tabs="auth"] .tabs__btn');
  const panels = $$('.auth-form[data-panel]');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      // Clear any stale banners when switching tabs
      const loginForm = byId('login-form');
      const signupForm = byId('signup-form');
      if (loginForm) {
        const b = loginForm.querySelector('[data-auth-banner]');
        if (b) hideBanner(b);
      }
      if (signupForm) {
        const b = signupForm.querySelector('[data-auth-banner]');
        if (b) hideBanner(b);
      }

      tabs.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      panels.forEach((p) => {
        const show = p.dataset.panel === target;
        p.classList.toggle('is-active', show);
        p.hidden = !show;
      });
    });
  });
}

/* ── Password toggles ──────────────────────────────────── */

function setupPasswordToggles() {
  $$('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.togglePassword;
      const input = byId(id);
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.textContent = isPwd ? '🙈' : '👁️';
      btn.setAttribute('aria-label', isPwd ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور');
    });
  });
}

/* ── Password strength meter ───────────────────────────── */

function setupPasswordMeter() {
  const input = byId('signup-password');
  const meter = document.querySelector('[data-pw-meter="signup-password"]');
  const label = document.querySelector('[data-pw-label="signup-password"]');
  if (!input || !meter || !label) return;

  input.addEventListener('input', () => {
    const v = input.value;
    if (!v) {
      meter.removeAttribute('data-strength');
      label.textContent = '';
      return;
    }
    const res = validatePassword(v);
    meter.setAttribute('data-strength', String(res.score || 1));
    label.textContent = `قدرت: ${res.label}`;
    label.style.color = res.score >= 3 ? 'var(--success)' : res.score === 2 ? 'var(--warning)' : 'var(--danger)';
  });
}

/* ── Login ──────────────────────────────────────────────── */

function setupLoginForm() {
  const form = byId('login-form');
  const submit = byId('login-submit');
  if (!form || !submit) return;

  // Ensure a banner exists above the submit button
  const banner = ensureBanner(form, submit);

  const emailEl = byId('login-email');
  const pwdEl = byId('login-password');
  const rememberEl = byId('remember-me');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearErrors(form);
    hideBanner(banner);

    const email = emailEl.value.trim();
    const password = pwdEl.value;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      showFieldError(emailEl, emailCheck.message);
      showBanner(banner, emailCheck.message, 'warning');
      return;
    }
    if (!password) {
      showFieldError(pwdEl, 'رمز عبور را وارد کنید.');
      showBanner(banner, 'رمز عبور را وارد کنید.', 'warning');
      return;
    }

    setButtonLoading(submit, true, 'در حال ورود…');
    try {
      await authService.signIn(email, password, { remember: rememberEl?.checked ?? true });
      toast.success('خوش آمدید 👋');
      // App shell takes over
    } catch (err) {
      console.error('[auth] signIn failed', err);
      const msg = err?.message || 'ورود ناموفق بود. دوباره تلاش کنید.';
      showBanner(banner, msg, 'error', { sticky: true });
      showFieldError(pwdEl, msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setButtonLoading(submit, false);
    }
  });
}

/* ── Signup ─────────────────────────────────────────────── */

function setupSignupForm() {
  const form = byId('signup-form');
  const submit = byId('signup-submit');
  if (!form || !submit) return;

  const banner = ensureBanner(form, submit);

  const nameEl = byId('signup-name');
  const emailEl = byId('signup-email');
  const pwdEl = byId('signup-password');
  const pwd2El = byId('signup-password2');
  const termsEl = byId('signup-terms');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearErrors(form);
    hideBanner(banner);

    const displayName = nameEl.value.trim();
    const email = emailEl.value.trim();
    const password = pwdEl.value;
    const password2 = pwd2El.value;

    // Local validation
    const nameRes = validateDisplayName(displayName);
    if (!nameRes.valid) {
      showFieldError(nameEl, nameRes.message);
      showBanner(banner, nameRes.message, 'warning');
      return;
    }
    const emailRes = validateEmail(email);
    if (!emailRes.valid) {
      showFieldError(emailEl, emailRes.message);
      showBanner(banner, emailRes.message, 'warning');
      return;
    }
    const pwRes = validatePassword(password);
    if (!pwRes.valid) {
      showFieldError(pwdEl, pwRes.message);
      showBanner(banner, pwRes.message, 'warning');
      return;
    }
    const matchRes = validatePasswordMatch(password, password2);
    if (!matchRes.valid) {
      showFieldError(pwd2El, matchRes.message);
      showBanner(banner, matchRes.message, 'warning');
      return;
    }
    if (!termsEl?.checked) {
      showBanner(banner, 'برای ادامه، تأییدیه را بپذیرید.', 'warning');
      toast.warning('برای ادامه، تأییدیه را بپذیرید.');
      termsEl?.focus();
      return;
    }

    // Show progress
    setButtonLoading(submit, true, 'در حال ساخت فضا…');
    showBanner(banner, 'در حال ارتباط با سرور…', 'info');

    try {
      const result = await authService.signUp({ email, password, displayName });

      // Edge case: signUp succeeded but no session (email confirmation is ON)
      if (!result?.session) {
        hideBanner(banner);
        showBanner(
          banner,
          'ثبت‌نام انجام شد، اما تأیید ایمیل در پروژه فعال است. لطفاً ایمیل خود را بررسی کنید و سپس وارد شوید.',
          'info',
          { sticky: true }
        );
        toast.info('ایمیل تأیید برای شما ارسال شد.', { duration: 6000 });
        return;
      }

      // Normal path: signed in
      hideBanner(banner);
      toast.success('فضای شخصی شما ساخته شد ✨');
      // App shell takes over from here.
    } catch (err) {
      console.error('[auth] signUp failed', err);

      // Build the best possible message for the user
      const msg = err?.message || 'ثبت‌نام ناموفق بود. دوباره تلاش کنید.';

      // Show inline banner (persistent) — this is the FIX
      showBanner(banner, msg, 'error', { sticky: true });

      // Also show toast (now visible thanks to z-index fix)
      toast.error(msg, { duration: 7000 });

      // Highlight the relevant field
      if (/ایمیل|email/i.test(msg)) showFieldError(emailEl, msg);
      else if (/رمز|password/i.test(msg)) showFieldError(pwdEl, msg);
      else if (/نام|name/i.test(msg)) showFieldError(nameEl, msg);
    } finally {
      // ALWAYS reset the button — this was missing before on error paths
      setButtonLoading(submit, false);
    }
  });
}

/* ── Forgot password ────────────────────────────────────── */

function setupForgot() {
  const btn = byId('forgot-password-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const email = await prompt({
      title: 'بازیابی رمز عبور',
      message: 'ایمیلی که با آن ثبت‌نام کرده‌اید را وارد کنید. لینک بازنشانی برایتان ارسال می‌شود.',
      placeholder: 'you@example.com',
      okLabel: 'ارسال لینک',
      validate: (v) => validateEmail(v).valid ? null : 'ایمیل معتبر وارد کنید.',
    });
    if (!email) return;

    try {
      await authService.sendPasswordReset(email);
      toast.success('اگر این ایمیل ثبت شده باشد، لینک بازنشانی ارسال شد.');
    } catch (err) {
      toast.error(err.message || 'ارسال لینک ناموفق بود.');
    }
  });
}

/* ── Inline banner ──────────────────────────────────────── */

/**
 * Ensure a banner element exists just above the submit button.
 * @param {HTMLFormElement} form
 * @param {HTMLElement} submit
 * @returns {HTMLElement}
 */
function ensureBanner(form, submit) {
  let banner = form.querySelector('[data-auth-banner]');
  if (!banner) {
    banner = el('div', {
      class: 'auth-banner',
      attrs: { role: 'alert', 'aria-live': 'assertive' },
      dataset: { authBanner: '1' },
    });
    banner.hidden = true;
    // Insert right before the submit button (or its wrapper)
    if (submit.parentNode === form) {
      form.insertBefore(banner, submit);
    } else {
      submit.parentNode.insertBefore(banner, submit);
    }
  }
  return banner;
}

/**
 * @param {HTMLElement} banner
 * @param {string} message
 * @param {'info'|'warning'|'error'|'success'} [variant='info']
 * @param {{sticky?:boolean}} [opts]
 */
function showBanner(banner, message, variant = 'info', opts = {}) {
  if (!banner) return;
  banner.className = `auth-banner auth-banner--${variant}`;
  banner.hidden = false;
  banner.textContent = message;
  // Re-trigger the entrance animation
  banner.classList.remove('is-visible');
  void banner.offsetWidth; // force reflow
  banner.classList.add('is-visible');

  if (!opts.sticky) {
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => hideBanner(banner), 8000);
  }
}

function hideBanner(banner) {
  if (!banner) return;
  clearTimeout(banner._hideTimer);
  banner.classList.remove('is-visible');
  setTimeout(() => { banner.hidden = true; }, 200);
}

/* ── Field errors ───────────────────────────────────────── */

function showFieldError(input, message) {
  if (!input) return;
  const field = input.closest('.field');
  field?.classList.add('has-error');
  const errEl = field?.querySelector('.field__error');
  if (errEl) { errEl.textContent = message; errEl.classList.add('is-visible'); }
  input.focus();
  input.classList.add('anim-shake');
  setTimeout(() => input.classList.remove('anim-shake'), 450);
}

function clearErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field__error').forEach((e) => {
    e.textContent = '';
    e.classList.remove('is-visible');
  });
}

export default { mountAuthPage };