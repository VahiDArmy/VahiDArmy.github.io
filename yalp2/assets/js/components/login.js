/* ============================================================
   Login / Signup screen with forgot password link
   ============================================================ */
import { el } from '../utils.js';
import { icon } from './icons.js';
import { signInWithPassword, signUpWithPassword } from '../api.js';
import { notify } from './toast.js';
import { CONFIG } from '../config.js';
import { openForgotPasswordModal } from './password-reset.js';

let currentMode = 'login';

export function renderLogin(root) {
  root.innerHTML = '';
  const page = el('div', { class: 'login-page' });

  const bg = el('div', { class: 'login-page__bg' }, [
    el('div', { class: 'login-page__blob' }),
    el('div', { class: 'login-page__blob' }),
    el('div', { class: 'login-page__blob' }),
  ]);

  const hero = el('div', { class: 'login-pane' }, [
    el('div', { class: 'login-hero' }, [
      el('div', { class: 'login-hero__tag', html: `${icon('sparkles', 14)}<span>دفترچهٔ خرید شخصی</span>` }),
      el('h1', { class: 'login-hero__title', text: CONFIG.appName }),
      el('p', { class: 'login-hero__desc',
        text: 'فروشگاه‌ها و محصولات خوب را به یاد بسپار، فروشنده‌های افتضاح را علامت بزن، و دیگر هیچ‌وقت از جای اشتباه خرید نکن.' }),
      el('div', { class: 'login-hero__features' }, [
        feature('store', 'امتیاز فروشگاه‌ها را نگه‌دار'),
        feature('package', 'محصولات را با پلتفرم مقایسه کن'),
        feature('search', 'جستجوی زنده در همهٔ خریدها'),
        feature('message', 'یادداشت روی هر خرید بگذار'),
      ]),
    ]),
  ]);

  const card = el('div', { class: 'login-pane' }, [
    el('div', { class: 'login-card' }, [
      el('div', { class: 'login-card__brand' }, [
        el('span', { class: 'brand__mark', html: brandSvg() }),
        el('span', { class: 'brand__text' }, [
          el('span', { class: 'brand__title', text: CONFIG.appName }),
          el('span', { class: 'brand__sub', text: CONFIG.appTagline }),
        ]),
      ]),
      el('div', {}, [
        el('div', { class: 'login-card__title', id: 'login-title', text: 'خوش برگشتی' }),
        el('div', { class: 'login-card__subtitle', id: 'login-subtitle',
          text: 'برای دیدن دفترچهٔ خریدت وارد شو' }),
      ]),
      el('div', { class: 'login-tabs', id: 'login-tabs' }, [
        el('button', {
          class: 'login-tabs__btn is-active',
          dataset: { mode: 'login' }, type: 'button', text: 'ورود',
        }),
        el('button', {
          class: 'login-tabs__btn',
          dataset: { mode: 'signup' }, type: 'button', text: 'ثبت‌نام',
        }),
      ]),
      renderForm(),
      el('p', { class: 'login-footnote',
        text: 'با ورود، داده‌های قبلی حسابت به‌طور خودکار بارگذاری می‌شوند.' }),
    ]),
  ]);

  page.append(bg, hero, card);
  root.appendChild(page);

  page.querySelectorAll('.login-tabs__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode === currentMode) return;
      currentMode = mode;
      page.querySelectorAll('.login-tabs__btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.mode === mode);
      });
      updateHeadings(mode);
      resetError();
      updateSubmitLabel();
    });
  });

  const form = page.querySelector('#login-form');
  form.addEventListener('submit', handleSubmit);

  const toggle = page.querySelector('#password-toggle');
  const pwdInput = page.querySelector('#password');
  toggle.addEventListener('click', () => {
    const isPwd = pwdInput.type === 'password';
    pwdInput.type = isPwd ? 'text' : 'password';
    toggle.innerHTML = icon(isPwd ? 'eyeOff' : 'eye', 16);
  });

  const forgotBtn = page.querySelector('#forgot-password-link');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = String(document.getElementById('email')?.value || '').trim();
      openForgotPasswordModal({ defaultEmail: email });
    });
  }

  setTimeout(() => page.querySelector('#email')?.focus(), 80);
}

function feature(iconName, label) {
  return el('div', { class: 'login-hero__feature' }, [
    el('span', { class: 'login-hero__feature-icon', html: icon(iconName, 16) }),
    el('span', { text: label }),
  ]);
}

function brandSvg() {
  return `
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M6 10h20l-2.5 15h-15L6 10z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      <path d="M11 10a5 5 0 0 1 10 0" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
}

function renderForm() {
  const email = el('input', {
    class: 'input', type: 'email', id: 'email', name: 'email',
    required: 'required', autocomplete: 'email',
    placeholder: 'name@example.com', dir: 'ltr', style: { textAlign: 'left' },
  });

  const password = el('input', {
    class: 'input', type: 'password', id: 'password', name: 'password',
    required: 'required', autocomplete: 'current-password',
    placeholder: '••••••••', minlength: '6',
    dir: 'ltr', style: { textAlign: 'left', paddingInlineEnd: '40px' },
  });

  const toggle = el('button', {
    type: 'button', id: 'password-toggle',
    class: 'login-password-toggle',
    'aria-label': 'نمایش رمز', html: icon('eye', 16),
  });

  return el('form', { class: 'login-form', id: 'login-form', novalidate: 'novalidate' }, [
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'email', text: 'ایمیل' }),
      email,
    ]),
    el('div', { class: 'field' }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        el('label', { class: 'field__label', for: 'password', text: 'رمز عبور' }),
        el('a', {
          href: '#', id: 'forgot-password-link',
          style: { fontSize: 'var(--fs-xs)', color: 'var(--violet-1)', fontWeight: 'var(--fw-semibold)' },
          text: 'فراموش کردی؟',
        }),
      ]),
      el('div', { class: 'login-field-wrap' }, [password, toggle]),
      el('div', { class: 'field__hint', text: 'حداقل ۶ کاراکتر' }),
    ]),
    el('div', { class: 'login-form__error', id: 'login-error' }),
    el('div', { class: 'login-form__success', id: 'login-success' }),
    el('button', {
      type: 'submit', class: 'btn btn--primary btn--lg btn--block',
      id: 'login-submit', text: 'ورود',
    }),
  ]);
}

function updateHeadings(mode) {
  const t = document.getElementById('login-title');
  const s = document.getElementById('login-subtitle');
  const f = document.getElementById('forgot-password-link');
  if (!t || !s) return;
  if (mode === 'login') {
    t.textContent = 'خوش برگشتی';
    s.textContent = 'برای دیدن دفترچهٔ خریدت وارد شو';
    if (f) f.style.display = '';
  } else {
    t.textContent = 'حساب تازه بساز';
    s.textContent = 'در چند ثانیه ثبت‌نام کن و شروع کن';
    if (f) f.style.display = 'none';
  }
}

function updateSubmitLabel() {
  const btn = document.getElementById('login-submit');
  if (btn) btn.textContent = currentMode === 'login' ? 'ورود' : 'ساخت حساب';
  const pwd = document.getElementById('password');
  if (pwd) pwd.autocomplete = currentMode === 'login' ? 'current-password' : 'new-password';
}

function resetError() {
  const err = document.getElementById('login-error');
  const ok = document.getElementById('login-success');
  if (err) { err.classList.remove('is-shown'); err.textContent = ''; }
  if (ok) { ok.classList.remove('is-shown'); ok.textContent = ''; }
}

function showError(msg) {
  const err = document.getElementById('login-error');
  if (!err) return;
  err.textContent = msg;
  err.classList.add('is-shown');
}

function showSuccess(msg) {
  const ok = document.getElementById('login-success');
  if (!ok) return;
  ok.textContent = msg;
  ok.classList.add('is-shown');
}

async function handleSubmit(e) {
  e.preventDefault();
  resetError();

  const email = String(document.getElementById('email')?.value || '').trim();
  const password = String(document.getElementById('password')?.value || '');
  const btn = document.getElementById('login-submit');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('یک ایمیل معتبر وارد کن');
    return;
  }
  if (password.length < 6) {
    showError('رمز عبور باید حداقل ۶ کاراکتر باشد');
    return;
  }

  btn.classList.add('is-loading');
  btn.disabled = true;

  try {
    if (currentMode === 'login') {
      await signInWithPassword(email, password);
      notify.success('خوش آمدی 👋');
    } else {
      const data = await signUpWithPassword(email, password);
      if (data?.session) {
        notify.success('حساب ساخته شد. خوش آمدی!');
      } else {
        showSuccess('ثبت‌نام انجام شد. لطفاً ایمیلت را برای تأیید بررسی کن.');
        currentMode = 'login';
        document.querySelectorAll('.login-tabs__btn').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.mode === 'login');
        });
        updateHeadings('login');
        updateSubmitLabel();
      }
    }
  } catch (err) {
    showError(err.message || 'خطایی رخ داد');
  } finally {
    btn.classList.remove('is-loading');
    btn.disabled = false;
  }
}
