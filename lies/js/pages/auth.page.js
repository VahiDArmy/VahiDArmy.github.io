/* ============================================================
   js/pages/auth.page.js
   FIXED:
     - Checkbox works reliably (explicit toggle on label click)
     - Always shows a visible message (inline banner + toast)
     - Never leaves submit button stuck
     - Removed reliance on `required` attribute (we validate in JS)
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

/* ── Public ──────────────────────────────────────────────── */

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
      // Hide banners on both forms
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

/* ── Password toggles ───────────────────────────────────── */

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

/* ── Terms checkbox — FIX ──────────────────────────────── */

/**
 * Make the terms checkbox clickable by:
 *   1) Removing `required` (we validate in JS — `required` can interfere
 *      with some browsers when wrapped in a custom label).
 *   2) Adding an explicit click handler on the *label* so clicking
 *      anywhere on the label toggles the underlying input and updates
 *      the visual `is-checked` class.
 */
function setupTermsCheckbox() {
  const input = byId('signup-terms');
  if (!input) return;

  // Remove `required` — we validate manually
  input.removeAttribute('required');

  const label = input.closest('label');
  if (!label) return;

  // Sync the visual state when input changes (native or programmatic)
  const syncVisual = () => {
    label.classList.toggle('is-checked', input.checked);
  };
  input.addEventListener('change', syncVisual);
  syncVisual();

  // Explicit toggle on any click inside the label
  label.addEventListener('click', (ev) => {
    // If the click target is already the input, the browser will
    // toggle it natively — don't double-toggle.
    if (ev.target === input) return;

    // Otherwise prevent default label behavior and toggle manually
    ev.preventDefault();
    input.checked = !input.checked;
    syncVisual();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Keyboard support: Space toggles
  label.addEventListener('keydown', (ev) => {
    if (ev.key === ' ' || ev.key === 'Spacebar') {
      ev.preventDefault();
      input.checked = !input.checked;
      syncVisual();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Make label focusable for keyboard users
  label.setAttribute('tabindex', '0');
  label.setAttribute('role', 'checkbox');
  const updateAria = () => label.setAttribute('aria-checked', String(input.checked));
  input.addEventListener('change', updateAria);
  updateAria();
}

/* ── Login ──────────────────────────────────────────────── */

function setupLoginForm() {
  const form = byId('login-form');
  const submit = byId('login-submit');
  if (!form || !submit) return;

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
    showBanner(banner, 'در حال ارتباط با سرور…', 'info');

    try {
      await authService.signIn(email, password, { remember: rememberEl?.checked ?? true });
      hideBanner(banner);
      toast.success('خوش آمدید 👋');
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
      const msg = 'برای ادامه، تأییدیه را بپذیرید.';
      showBanner(banner, msg, 'warning');
      toast.warning(msg);
      // Flash the checkbox label
      const label = termsEl?.closest('label');
      if (label) {
        label.classList.add('anim-shake');
        setTimeout(() => label.classList.remove('anim-shake'), 450);
      }
      return;
    }

    setButtonLoading(submit, true, 'در حال ساخت فضا…');
    showBanner(banner, 'در حال ارتباط با سرور…', 'info');

    try {
      const result = await authService.signUp({ email, password, displayName });

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

      hideBanner(banner);
      toast.success('فضای شخصی شما ساخته شد ✨');
    } catch (err) {
      console.error('[auth] signUp failed', err);
      const msg = err?.message || 'ثبت‌نام ناموفق بود. دوباره تلاش کنید.';

      showBanner(banner, msg, 'error', { sticky: true });
      toast.error(msg, { duration: 7000 });

      if (/ایمیل|email/i.test(msg)) showFieldError(emailEl, msg);
      else if (/رمز|password/i.test(msg)) showFieldError(pwdEl, msg);
      else if (/نام|name/i.test(msg)) showFieldError(nameEl, msg);
    } finally {
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
      message: 'ایمیلی که با آن ثبت‌نام کرده‌اید را وارد کنید.',
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

function ensureBanner(form, submit) {
  let banner = form.querySelector('[data-auth-banner]');
  if (!banner) {
    banner = el('div', {
      class: 'auth-banner',
      attrs: { role: 'alert', 'aria-live': 'assertive' },
      dataset: { authBanner: '1' },
    });
    banner.hidden = true;

    // Hardcoded inline styles so it works even if CSS hasn't loaded
    banner.style.cssText = `
      display: block;
      padding: 10px 14px;
      margin-block-end: 12px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.7;
      border: 1px solid transparent;
      font-family: Vazirmatn, system-ui, sans-serif;
      direction: rtl;
      text-align: right;
      transition: opacity 220ms;
    `;

    if (submit.parentNode === form) form.insertBefore(banner, submit);
    else submit.parentNode.insertBefore(banner, submit);
  }
  return banner;
}

function applyBannerVariant(banner, variant) {
  const base = 'display:block;padding:10px 14px;margin-block-end:12px;border-radius:10px;font-size:13px;line-height:1.7;border:1px solid;font-family:Vazirmatn,system-ui,sans-serif;direction:rtl;text-align:right;transition:opacity 220ms;';
  const styles = {
    info:    'background:rgba(88,179,255,0.12);border-color:rgba(88,179,255,0.35);color:#8bcaff;',
    warning: 'background:rgba(240,166,62,0.12);border-color:rgba(240,166,62,0.35);color:#f5c477;',
    error:   'background:rgba(255,107,107,0.12);border-color:rgba(255,107,107,0.4);color:#ff9b9b;font-weight:500;',
    success: 'background:rgba(62,199,168,0.12);border-color:rgba(62,199,168,0.35);color:#7adfc4;',
  };
  banner.style.cssText = base + (styles[variant] || styles.info);
}

function showBanner(banner, message, variant = 'info', opts = {}) {
  if (!banner) return;
  banner.className = `auth-banner auth-banner--${variant}`;
  applyBannerVariant(banner, variant);
  banner.hidden = false;
  banner.textContent = message;
  banner.style.opacity = '1';

  if (!opts.sticky) {
    clearTimeout(banner._hideTimer);
    banner._hideTimer = setTimeout(() => hideBanner(banner), 8000);
  }
}

function hideBanner(banner) {
  if (!banner) return;
  clearTimeout(banner._hideTimer);
  banner.style.opacity = '0';
  setTimeout(() => { banner.hidden = true; }, 200);
}

/* ── Field errors ──────────────────────────────────────── */

function showFieldError(input, message) {
  if (!input) return;
  const field = input.closest('.field');
  field?.classList.add('has-error');
  const errEl = field?.querySelector('.field__error');
  if (errEl) { errEl.textContent = message; errEl.classList.add('is-visible'); }
  try { input.focus({ preventScroll: true }); } catch { /* noop */ }
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