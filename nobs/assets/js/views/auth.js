/* ==========================================================================
   auth.js — صفحه ورود / ثبت‌نام / لینک جادویی
   ========================================================================== */

import * as auth from '../lib/auth.js';
import { toast, setBusy } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { esc, faNum } from '../lib/utils.js';
import { enterDemo } from '../lib/repo.js';

const MODES = {
  login: { label: 'ورود', title: 'خوش برگشتی', sub: 'برای دیدن دفترچه تجربه‌هایت وارد شو.' },
  signup: { label: 'ثبت‌نام', title: 'شروع کن', sub: 'یک حساب بساز و اولین خریدت را ثبت کن.' },
  magic: { label: 'لینک جادویی', title: 'ورود بدون رمز', sub: 'لینک ورود یک‌بارمصرف به ایمیلت می‌فرستیم.' },
};

export function mount(container, ctx = {}) {
  let mode = 'login';
  let busy = false;

  container.innerHTML = `
    <div class="auth">
      <aside class="auth__art">
        <div class="auth__art-content">
          <div class="brand">
            <span class="brand__mark">${icon('cart', 22)}</span>
            <span>
              <span class="brand__name">فروشگاه‌یار</span>
              <span class="brand__tag">دفترچه تجربه خرید آنلاین</span>
            </span>
          </div>
          <h1 class="auth__art-title">هر خرید یک درس است.<br />درس‌ها را یادداشت کن.</h1>
          <p class="auth__art-sub">
            یک محصول را از یک فروشگاه در یک پلتفرم خریدی؟ همان ترکیب را یک بار برای همیشه امتیاز بده:
            خوب، نه‌خوب یا افتضاح. دفعه بعد فقط کافی است نگاه کنی.
          </p>
          <div class="auth__points">
            <div class="auth__point">
              <span class="auth__point-ico">${icon('target', 14)}</span>
              <span><b>امتیاز روی ترکیب، نه فقط محصول.</b> ساندویچ از یک فروشگاه در اسنپ‌فود با همان ساندویچ در دیجی‌کالا یکی نیست.</span>
            </div>
            <div class="auth__point">
              <span class="auth__point-ico">${icon('shield', 14)}</span>
              <span><b>دیگر دوبار امتیاز نمی‌دهی.</b> هر ترکیب یکتا است و همیشه قابل ویرایش؛ بدون داده تکراری.</span>
            </div>
            <div class="auth__point">
              <span class="auth__point-ico">${icon('chart', 14)}</span>
              <span><b>تحلیل واقعی از پول و کیفیت.</b> بهترین پلتفرم، بدترین فروشگاه و هزینه ماهانه‌ات را ببین.</span>
            </div>
          </div>
        </div>

        <div class="auth__demo-card">
          <div class="auth__demo-head">${icon('sparkles', 15)} یک نگاه به داده‌های نمونه</div>
          <div class="auth__demo-bars">
            <div class="auth__demo-bar"><span>خوب</span><i style="width:62%;background:var(--good)"></i><b class="u-xs u-num">۶۲٪</b></div>
            <div class="auth__demo-bar"><span>نه‌خوب</span><i style="width:25%;background:var(--meh)"></i><b class="u-xs u-num">۲۵٪</b></div>
            <div class="auth__demo-bar"><span>افتضاح</span><i style="width:13%;background:var(--bad)"></i><b class="u-xs u-num">۱۳٪</b></div>
          </div>
        </div>
      </aside>

      <main class="auth__panel">
        <div class="auth__card">
          <div>
            <div class="auth__brand">
              <span class="brand__mark" style="width:38px;height:38px;border-radius:11px">${icon('cart', 19)}</span>
              <span class="brand__name">فروشگاه‌یار</span>
            </div>
            <h2 class="auth__title u-mt-4" data-auth-title>${esc(MODES[mode].title)}</h2>
            <p class="auth__sub" data-auth-sub>${esc(MODES[mode].sub)}</p>
          </div>

          <div class="auth-seg" role="tablist">
            ${Object.entries(MODES)
              .map(
                ([key, meta]) =>
                  `<button type="button" class="auth-seg__btn ${key === mode ? 'is-active' : ''}" role="tab" aria-selected="${key === mode}" data-mode="${key}">${esc(meta.label)}</button>`,
              )
              .join('')}
          </div>

          <form class="auth-form" data-auth-form novalidate>
            <div class="field" data-name-field hidden>
              <label class="field__label" for="af-name">نام نمایشی</label>
              <input class="input" id="af-name" name="display_name" autocomplete="name" maxlength="60" placeholder="مثلاً علی" />
            </div>
            <div class="field">
              <label class="field__label" for="af-email">ایمیل</label>
              <div class="input-wrap">
                <span class="input__icon">${icon('mail', 16)}</span>
                <input class="input" id="af-email" name="email" type="email" dir="ltr" autocomplete="email" placeholder="you@example.com" required />
              </div>
            </div>
            <div class="field" data-password-field>
              <label class="field__label" for="af-password">رمز عبور</label>
              <div class="pw-wrap">
                <input class="input" id="af-password" name="password" type="password" dir="ltr" autocomplete="current-password" placeholder="••••••••" minlength="6" />
                <button type="button" class="pw-toggle" data-toggle-pw aria-label="نمایش رمز">${icon('eye', 15)}</button>
              </div>
              <div class="strength" data-strength hidden>
                <i></i><i></i><i></i><i></i>
              </div>
              <div class="strength-label" data-strength-label hidden></div>
            </div>

            <div data-auth-error></div>

            <button type="submit" class="btn btn--primary btn--lg btn--block" data-submit>
              ${icon('lock', 17)} <span data-submit-label>${mode === 'signup' ? 'ساخت حساب' : mode === 'magic' ? 'ارسال لینک ورود' : 'ورود به حساب'}</span>
            </button>

            <div class="u-between u-xs">
              <button type="button" class="u-dim" data-forgot>رمز را فراموش کردم</button>
              <span class="u-faint">${faNum(150)}+ خرید قابل ثبت</span>
            </div>
          </form>

          <div class="auth__divider">یا</div>

          <button type="button" class="btn btn--soft btn--block" data-demo>
            ${icon('sparkles', 16)} ورود به حالت نمایشی بدون حساب
          </button>

          <p class="auth__notice">
            ورود با حساب Supabase خودتان انجام می‌شود. داده‌ها با قواعد امنیتی سطح‌سطر (RLS) فقط برای شما قابل خواندن و نوشتن هستند.
          </p>
          <p class="auth__foot">
            با ورود، قوانین استفاده و حفظ حریم خصوصی را می‌پذیرید.
            <a href="${esc('https://supabase.com')}" target="_blank" rel="noopener">قدرت‌گرفته از Supabase</a>
          </p>
        </div>
      </main>
    </div>
  `;

  const form = container.querySelector('[data-auth-form]');
  const emailInput = container.querySelector('#af-email');
  const passwordInput = container.querySelector('#af-password');
  const nameField = container.querySelector('[data-name-field]');
  const passwordField = container.querySelector('[data-password-field]');
  const strengthBars = container.querySelector('[data-strength]');
  const strengthLabel = container.querySelector('[data-strength-label]');
  const errorBox = container.querySelector('[data-auth-error]');

  function setMode(next) {
    mode = next;
    container.querySelectorAll('[data-mode]').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    container.querySelector('[data-auth-title]').textContent = MODES[mode].title;
    container.querySelector('[data-auth-sub]').textContent = MODES[mode].sub;
    container.querySelector('[data-submit-label]').textContent =
      mode === 'signup' ? 'ساخت حساب' : mode === 'magic' ? 'ارسال لینک ورود' : 'ورود به حساب';
    nameField.hidden = mode !== 'signup';
    passwordField.hidden = mode === 'magic';
    strengthBars.hidden = mode !== 'signup';
    strengthLabel.hidden = mode !== 'signup';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    errorBox.innerHTML = '';
  }

  function showError(message) {
    errorBox.innerHTML = `<div class="callout callout--danger">${icon('alert', 16)}<div class="u-grow"><div class="callout__text">${esc(message)}</div></div></div>`;
  }

  function showSuccess(message) {
    errorBox.innerHTML = `<div class="callout callout--success">${icon('check-circle', 16)}<div class="u-grow"><div class="callout__text">${esc(message)}</div></div></div>`;
  }

  function scorePassword(value) {
    let score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 10) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
    return score;
  }

  container.addEventListener('click', (event) => {
    const target = event.target;

    const modeBtn = target.closest('[data-mode]');
    if (modeBtn) {
      setMode(modeBtn.dataset.mode);
      return;
    }

    if (target.closest('[data-toggle-pw]')) {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      target.closest('[data-toggle-pw]').innerHTML = icon(isPassword ? 'eye-off' : 'eye', 15);
      return;
    }

    if (target.closest('[data-forgot]')) {
      const email = emailInput.value.trim();
      if (!email) {
        showError('اول ایمیل را وارد کن.');
        emailInput.focus();
        return;
      }
      setBusy(target.closest('[data-forgot]'), true);
      auth
        .resetPassword(email)
        .then(() => showSuccess('لینک بازیابی رمز به ایمیلت ارسال شد.'))
        .catch((error) => showError(error.message))
        .finally(() => setBusy(target.closest('[data-forgot]'), false));
      return;
    }

    if (target.closest('[data-demo]')) {
      enterDemo();
      toast.success('وارد حالت نمایشی شدی.');
      ctx.onAuthed?.({ demo: true });
    }
  });

  passwordInput.addEventListener('input', () => {
    if (mode !== 'signup') return;
    const score = scorePassword(passwordInput.value);
    const bars = strengthBars.querySelectorAll('i');
    const labels = ['خیلی ضعیف', 'ضعیف', 'متوسط', 'خوب', 'قوی'];
    const classes = ['on-weak', 'on-weak', 'on-meh', 'on-good', 'on-good'];
    bars.forEach((bar, index) => {
      bar.className = index < score ? classes[score] : '';
    });
    strengthLabel.textContent = passwordInput.value ? labels[score] : '';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const displayName = container.querySelector('#af-name')?.value.trim() || '';

    if (!email || !email.includes('@')) {
      showError('ایمیل معتبر وارد کن.');
      emailInput.focus();
      return;
    }
    if (mode !== 'magic' && password.length < 6) {
      showError('رمز عبور باید حداقل ۶ حرف باشد.');
      passwordInput.focus();
      return;
    }

    const submit = container.querySelector('[data-submit]');
    busy = true;
    setBusy(submit, true);
    errorBox.innerHTML = '';

    try {
      if (mode === 'login') {
        await auth.signIn(email, password);
        toast.success('خوش آمدی!');
        ctx.onAuthed?.();
      } else if (mode === 'signup') {
        const result = await auth.signUp(email, password, displayName);
        if (result?.user && !result.session) {
          showSuccess('حساب ساخته شد. برای فعال‌سازی، لینک تایید را در ایمیلت باز کن.');
        } else {
          toast.success('حساب ساخته شد.');
          ctx.onAuthed?.();
        }
      } else {
        await auth.magicLink(email);
        showSuccess('لینک ورود به ایمیلت ارسال شد. صندوق ورودی را بررسی کن.');
      }
    } catch (error) {
      showError(error.message || 'ورود ناموفق بود.');
    } finally {
      busy = false;
      setBusy(submit, false);
    }
  });

  return {
    destroy() {},
  };
}
