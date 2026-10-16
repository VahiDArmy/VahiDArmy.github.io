/* ============================================================
   js/pages/auth.page.js
   Wires the login / signup / forgot forms on the auth screen.
   ============================================================ */

import { byId, $$ } from '../utils/dom.js';
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
    const el = byId('login-email');
    if (el) el.value = remembered;
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

  const emailEl = byId('login-email');
  const pwdEl = byId('login-password');
  const rememberEl = byId('remember-me');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearErrors(form);

    const email = emailEl.value.trim();
    const password = pwdEl.value;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) return showError(emailEl, emailCheck.message);
    if (!password) return showError(pwdEl, 'رمز عبور را وارد کنید.');

    setButtonLoading(submit, true, 'در حال ورود…');
    try {
      await authService.signIn(email, password, { remember: rememberEl?.checked ?? true });
      toast.success('خوش آمدید 👋');
    } catch (err) {
      toast.error(err.message || 'ورود ناموفق بود.');
      showError(pwdEl, err.message || 'خطا در ورود');
      setButtonLoading(submit, false);
    }
  });
}

/* ── Signup ─────────────────────────────────────────────── */

function setupSignupForm() {
  const form = byId('signup-form');
  const submit = byId('signup-submit');
  if (!form || !submit) return;

  const nameEl = byId('signup-name');
  const emailEl = byId('signup-email');
  const pwdEl = byId('signup-password');
  const pwd2El = byId('signup-password2');
  const termsEl = byId('signup-terms');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearErrors(form);

    const displayName = nameEl.value.trim();
    const email = emailEl.value.trim();
    const password = pwdEl.value;
    const password2 = pwd2El.value;

    const nameRes = validateDisplayName(displayName);
    if (!nameRes.valid) return showError(nameEl, nameRes.message);

    const emailRes = validateEmail(email);
    if (!emailRes.valid) return showError(emailEl, emailRes.message);

    const pwRes = validatePassword(password);
    if (!pwRes.valid) return showError(pwdEl, pwRes.message);

    const matchRes = validatePasswordMatch(password, password2);
    if (!matchRes.valid) return showError(pwd2El, matchRes.message);

    if (!termsEl?.checked) {
      toast.warning('برای ادامه، تأییدیه را بپذیرید.');
      termsEl?.focus();
      return;
    }

    setButtonLoading(submit, true, 'در حال ساخت فضا…');
    try {
      await authService.signUp({ email, password, displayName });
      toast.success('فضای شخصی شما ساخته شد ✨');
    } catch (err) {
      toast.error(err.message || 'ثبت‌نام ناموفق بود.');
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

/* ── Error helpers ──────────────────────────────────────── */

function showError(input, message) {
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