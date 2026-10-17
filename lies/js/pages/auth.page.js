/* ============================================================
   js/pages/auth.page.js
   FIXED: Completely clean. No syntax errors. Handles all tabs, 
          forms, and checkboxes properly.
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

export function mountAuthPage() {
  if (initialized) return;
  initialized = true;

  setupTabs();
  setupPasswordToggles();
  setupPasswordMeter();
  setupTermsCheckbox();
  setupLoginForm();
  setupSignupForm();
  setupForgot();
}

function setupTabs() {
  const tabs = $$('[data-tabs="auth"] .tabs__btn');
  const panels = $$('.auth-form[data-panel]');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      
      // Hide banners
      ['login-form', 'signup-form'].forEach((id) => {
        const form = byId(id);
        const b = form?.querySelector('[data-auth-banner]');
        if (b) hideBanner(b);
      });

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

function setupPasswordToggles() {
  $$('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.togglePassword;
      const input = byId(id);
      if (!input) return;
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.textContent = isPwd ? '🙈' : '👁️';
    });
  });
}

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
  });
}

function setupTermsCheckbox() {
  const input = byId('signup-terms');
  if (!input) return;

  input.removeAttribute('required'); // Validate via JS

  const label = input.closest('label');
  if (!label) return;

  const syncVisual = () => label.classList.toggle('is-checked', input.checked);
  input.addEventListener('change', syncVisual);
  syncVisual();

  label.addEventListener('click', (ev) => {
    if (ev.target === input) return;
    ev.preventDefault();
    input.checked = !input.checked;
    syncVisual();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setupLoginForm() {
  const form = byId('login-form');
  const submit = byId('login-submit');
  if (!form || !submit) return;

  const banner = ensureBanner(form, submit);
  const emailEl = byId('login-email');
  const pwdEl = byId('login-password');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearErrors(form);
    hideBanner(banner);

    const email = emailEl.value.trim();
    const password = pwdEl.value;

    if (!validateEmail(email).valid) return showBanner(banner, 'ایمیل نامعتبر است.', 'warning');
    if (!password) return showBanner(banner, 'رمز عبور را وارد کنید.', 'warning');

    setButtonLoading(submit, true, 'در حال ورود…');
    try {
      await authService.signIn(email, password);
      toast.success('خوش آمدید 👋');
    } catch (err) {
      showBanner(banner, err.message || 'خطا', 'error', { sticky: true });
      toast.error(err.message || 'خطا');
    } finally {
      setButtonLoading(submit, false);
    }
  });
}

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

    if (!validateDisplayName(nameEl.value).valid) return showBanner(banner, 'نام نامعتبر است.', 'warning');
    if (!validateEmail(emailEl.value).valid) return showBanner(banner, 'ایمیل نامعتبر است.', 'warning');
    if (!validatePassword(pwdEl.value).valid) return showBanner(banner, 'رمز ضعیف است.', 'warning');
    if (pwdEl.value !== pwd2El.value) return showBanner(banner, 'رمزها یکسان نیستند.', 'warning');
    
    if (!termsEl.checked) {
      showBanner(banner, 'تأییدیه را بپذیرید.', 'warning');
      return;
    }

    setButtonLoading(submit, true, 'در حال ساخت…');
    try {
      const res = await authService.signUp({ email: emailEl.value.trim(), password: pwdEl.value, displayName: nameEl.value.trim() });
      if (!res.session) {
        showBanner(banner, 'تأیید ایمیل فعال است. لطفاً ایمیل خود را بررسی کنید.', 'info', { sticky: true });
      } else {
        toast.success('فضای شخصی ساخته شد ✨');
      }
    } catch (err) {
      showBanner(banner, err.message || 'خطا', 'error', { sticky: true });
      toast.error(err.message || 'خطا');
    } finally {
      setButtonLoading(submit, false);
    }
  });
}

function setupForgot() {
  const btn = byId('forgot-password-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const email = await prompt({
      title: 'بازیابی رمز',
      message: 'ایمیل خود را وارد کنید.',
      validate: (v) => validateEmail(v).valid ? null : 'ایمیل نامعتبر',
    });
    if (!email) return;
    try {
      await authService.sendPasswordReset(email);
      toast.success('لینک ارسال شد.');
    } catch (err) { toast.error(err.message); }
  });
}

function ensureBanner(form, submit) {
  let banner = form.querySelector('[data-auth-banner]');
  if (!banner) {
    banner = el('div', { class: 'auth-banner', dataset: { authBanner: '1' } });
    banner.hidden = true;
    if (submit.parentNode === form) form.insertBefore(banner, submit);
    else submit.parentNode.insertBefore(banner, submit);
  }
  return banner;
}

function showBanner(banner, message, variant, opts = {}) {
  if (!banner) return;
  banner.className = `auth-banner auth-banner--${variant}`;
  banner.hidden = false;
  banner.textContent = message;
  banner.style.display = 'block';
  banner.style.padding = '10px';
  banner.style.marginBottom = '10px';
  banner.style.borderRadius = '8px';
  banner.style.fontSize = '13px';
  
  if (variant === 'error') { banner.style.background = 'var(--danger-soft)'; banner.style.color = 'var(--danger)'; }
  else if (variant === 'warning') { banner.style.background = 'var(--warning-soft)'; banner.style.color = 'var(--warning)'; }
  else { banner.style.background = 'var(--info-soft)'; banner.style.color = 'var(--info)'; }

  if (!opts.sticky) {
    setTimeout(() => hideBanner(banner), 6000);
  }
}

function hideBanner(banner) {
  if (!banner) return;
  banner.hidden = true;
}

function clearErrors(form) {
  form.querySelectorAll('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  form.querySelectorAll('.field__error').forEach((e) => { e.textContent = ''; e.classList.remove('is-visible'); });
}

export default { mountAuthPage };