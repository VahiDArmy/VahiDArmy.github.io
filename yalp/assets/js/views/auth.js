/**
 * بازاربان — ورود و ثبت‌نام
 * ---------------------------------------------------------------------------
 * دو مسیر: رمز عبور و لینک ایمیل (در حالت واقعی). در حالت نمایشی، حساب محلی
 * ساخته می‌شود تا همهٔ قابلیت‌ها بدون اجرای SQL هم قابل امتحان باشند.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS, CITIES } from '../config.js';
import { esc, attr, toFa, isValidEmail, isStrongEnough } from '../utils.js';
import * as store from '../store.js';
import { breadcrumbs, toast, levelChip } from '../ui.js';
import { modeBanner } from './home.js';

const NEXT_FALLBACK = '#/me';

function visualSide() {
  return `<div class="auth-visual">
    <div class="auth-visual__levels">
      ${LEVELS.map((level) => levelChip(level.id, { size: 'lg' })).join('')}
    </div>
  </div>`;
}

function formFields(mode) {
  if (mode === 'magic') {
    return `<div class="field">
      <label class="label" for="auth-email">ایمیل</label>
      <input class="input input--lg" id="auth-email" name="email" type="email" autocomplete="email" dir="ltr"
        placeholder="you@example.com" required />
      <span class="hint">یک لینک ورود یک‌بارمصرف برایت ایمیل می‌شود.</span>
    </div>`;
  }

  return `<div class="field">
      <label class="label" for="auth-email">ایمیل</label>
      <input class="input input--lg" id="auth-email" name="email" type="email" autocomplete="email" dir="ltr"
        placeholder="you@example.com" required />
    </div>
    <div class="field">
      <label class="label" for="auth-password">رمز عبور
        <span class="label__hint">حداقل ۶ کاراکتر</span>
      </label>
      <div class="input-group">
        <input class="input input--lg" id="auth-password" name="password" type="password"
          autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="••••••••" required minlength="6" />
        <span class="input-group__suffix">
          <button class="icon-btn" type="button" data-toggle-password aria-label="نمایش رمز">${icon('eye', 17)}</button>
        </span>
      </div>
    </div>
    ${
      mode === 'signup'
        ? `<div class="form-grid form-grid--2">
            <div class="field">
              <label class="label" for="auth-name">نام نمایشی</label>
              <input class="input" id="auth-name" name="displayName" maxlength="40" placeholder="مثلاً نگار" />
            </div>
            <div class="field">
              <label class="label" for="auth-city">شهر</label>
              <select class="select" id="auth-city" name="city">
                <option value="">انتخاب کن</option>
                ${CITIES.map((city) => `<option value="${attr(city)}">${esc(city)}</option>`).join('')}
              </select>
            </div>
          </div>`
        : ''
    }`;
}

export const authView = {
  title: 'ورود',
  render(ctx) {
    const mode = ['login', 'signup', 'magic'].includes(ctx.query.mode) ? ctx.query.mode : 'login';
    const next = ctx.query.next || NEXT_FALLBACK;
    const state = store.getState();
    const demo = state.mode === 'demo';

    return `<div class="page">
      ${modeBanner(state)}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: mode === 'signup' ? 'ثبت‌نام' : 'ورود' }])}
        <div class="auth-page">
          ${visualSide()}
          <div class="auth-card">
            <div class="auth-card__head">
              <h1 class="auth-card__title">${mode === 'signup' ? 'ثبت‌نام' : 'ورود'}</h1>
              <p class="auth-card__sub">
                ${demo ? 'حساب محلی با هر ایمیل و رمز ۶ کاراکتری.' : 'با حساب Supabase پروژه وارد شو.'}
              </p>
            </div>

            ${
              store.currentUser()
                ? `<div class="card card--pad center">
                    <div class="empty__icon" style="margin-inline:auto">${icon('check-circle', 24)}</div>
                    <p style="font-weight:600;margin-top:var(--sp-4)">تو با ${esc(store.currentUser().email || '')} وارد شده‌ای.</p>
                    <div class="cluster" style="justify-content:center;margin-top:var(--sp-5)">
                      <a class="btn btn--primary btn--sm" href="#/me" data-link>داشبورد من</a>
                      <button class="btn btn--outline btn--sm" type="button" data-auth-signout>خروج</button>
                    </div>
                  </div>`
                : `
            <div class="auth-switch" role="tablist">
              <button class="auth-switch__btn" type="button" data-auth-mode="login" data-active="${mode === 'login'}">ورود</button>
              <button class="auth-switch__btn" type="button" data-auth-mode="signup" data-active="${mode === 'signup'}">ثبت‌نام</button>
            </div>

            <form class="auth-form" data-auth-form data-mode="${mode}" data-next="${attr(next)}" novalidate>
              <div data-auth-error></div>
              ${formFields(mode)}

              ${
                mode === 'login'
                  ? `<div class="row row--between" style="font-size:var(--fs-2xs)">
                      <label class="check" style="font-size:var(--fs-2xs)">
                        <input type="checkbox" name="remember" checked />
                        <span class="check__box">${icon('check', 11)}</span>
                        <span class="check__text">مرا به خاطر بسپار</span>
                      </label>
                      <button class="link" type="button" data-auth-mode="magic" style="font-size:var(--fs-2xs)">ورود با لینک ایمیل</button>
                    </div>`
                  : ''
              }

              ${
                mode !== 'magic'
                  ? `<button class="btn btn--primary btn--lg btn--block" type="submit">
                      ${icon(mode === 'signup' ? 'user' : 'logout', 17)}
                      ${mode === 'signup' ? 'ساختن حساب' : 'ورود'}
                    </button>`
                  : `<button class="btn btn--primary btn--lg btn--block" type="submit">
                      ${icon('mail', 17)} ارسال لینک ورود
                    </button>`
              }
            </form>

            ${
              mode === 'magic'
                ? `<div class="auth-card__foot">
                    <button class="link" type="button" data-auth-mode="login">بازگشت به ورود با رمز</button>
                  </div>`
                : `<div class="divider-text">یا</div>
                   <button class="btn btn--outline btn--block" type="button" data-auth-mode="magic">
                     ${icon('mail', 16)} ورود با لینک ایمیل (بدون رمز)
                   </button>
                   <div class="auth-card__foot">
                     ${mode === 'signup' ? 'حساب داری؟' : 'حساب نداری؟'}
                     <button class="link" type="button" data-auth-mode="${mode === 'signup' ? 'login' : 'signup'}">
                       ${mode === 'signup' ? 'وارد شو' : 'ثبت‌نام کن'}
                     </button>
                   </div>`
            }

            <div class="auth-note">
              ${icon('info', 14)}
              <span>
                ${demo ? 'این حساب فقط برای نمایش است و رمز عبور ذخیره نمی‌شود. ' : ''}
                با ورود، قواعد استفاده و حریم خصوصی بازاربان را می‌پذیری. هیچ سفارشی ثبت نمی‌شود و بازاربان فروشنده نیست.
              </span>
            </div>`
            }
          </div>
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    const form = root.querySelector('[data-auth-form]');
    if (!form) {
      root.querySelector('[data-auth-signout]')?.addEventListener('click', async () => {
        await store.signOut();
        store.persistDemoSession();
        toast('خارج شدی.', { type: 'info' });
        window.location.hash = '#/';
      });
      return;
    }

    const mode = form.dataset.mode;
    const errorBox = form.querySelector('[data-auth-error]');

    root.querySelectorAll('[data-auth-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextMode = button.dataset.authMode;
        const url = new URL(window.location.href);
        const hash = url.hash.replace(/^#/, '');
        const [path, search] = hash.split('?');
        const params = new URLSearchParams(search || '');
        if (nextMode === 'login') params.delete('mode');
        else params.set('mode', nextMode);
        const qs = params.toString();
        window.location.href = `#${path}${qs ? `?${qs}` : ''}`;
      });
    });

    root.querySelector('[data-toggle-password]')?.addEventListener('click', (event) => {
      const input = form.querySelector('input[name="password"]');
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      event.currentTarget.innerHTML = icon(show ? 'eye-off' : 'eye', 17);
    });

    const showError = (message) => {
      errorBox.innerHTML = `<div class="callout callout--bad" style="margin-bottom:var(--sp-2)">
        <span class="callout__icon">${icon('alert-circle', 14)}</span>
        <div>${esc(message)}</div>
      </div>`;
    };

    let submitting = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      errorBox.innerHTML = '';

      const data = new FormData(form);
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');

      if (!isValidEmail(email)) {
        showError('ایمیل معتبر وارد کن.');
        return;
      }
      if (mode !== 'magic' && !isStrongEnough(password)) {
        showError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
        return;
      }

      submitting = true;
      const submit = form.querySelector('button[type="submit"]');
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = `<span class="btn__spinner"></span> لطفاً صبر کن…`;

      try {
        if (mode === 'magic') {
          await store.magicLink(email);
          toast('لینک ورود به ایمیلت فرستاده شد.', {
            type: 'good',
            title: 'ایمیل را چک کن',
            duration: 7000,
          });
          form.reset();
        } else if (mode === 'signup') {
          const result = await store.signUp({
            email,
            password,
            displayName: String(data.get('displayName') || '').trim(),
            city: String(data.get('city') || ''),
          });
          if (result?.pendingConfirmation) {
            toast('حساب ساخته شد؛ لینک تأیید را در ایمیلت ببین.', {
              type: 'good',
              title: 'تأیید ایمیل',
              duration: 8000,
            });
          } else {
            store.persistDemoSession();
            toast('خوش آمدی! حسابت ساخته شد.', { type: 'good' });
            window.location.hash = form.dataset.next || NEXT_FALLBACK;
          }
        } else {
          await store.signIn({ email, password });
          store.persistDemoSession();
          toast('خوش برگشتی.', { type: 'good' });
          window.location.hash = form.dataset.next || NEXT_FALLBACK;
        }
      } catch (error) {
        showError(error.message || 'انجام این کار ممکن نشد.');
      } finally {
        submitting = false;
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  },
};
