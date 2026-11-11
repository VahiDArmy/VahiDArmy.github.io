/* ============================================================
   Auth view
   ============================================================ */
import { el, escapeHtml, isEmail } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { signIn, signUp, resetPassword } from '../auth.js';
import { toastError, toastSuccess } from '../ui.js';

export const renderAuth = async (root) => {
  if (state.user) { navigate('/home'); return; }
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'auth-page';
  const card = document.createElement('div');
  card.className = 'auth-card';
  card.innerHTML = `
    <div class="auth-card__logo">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="authGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent-1)" />
            <stop offset="100%" stop-color="var(--accent-3)" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#authGrad)" />
        <path d="M15 34V14h8.4c6.4 0 10 3.2 10 8.2 0 4.9-3.6 8.2-10 8.2h-3.4V34H15Zm5-8h3.3c3.3 0 5.1-1.2 5.1-3.6s-1.8-3.6-5.1-3.6H20v7.2Z" fill="#fff" />
      </svg>
    </div>
    <div class="auth-card__title" data-title>ورود</div>
    <div class="auth-card__subtitle" data-sub>به استودیوی ایده‌ها خوش آمدید</div>
    <form class="auth-form" data-form></form>
    <div class="auth-switch" data-switch></div>
  `;
  wrap.appendChild(card);
  root.appendChild(wrap);

  let mode = 'login';
  const form = card.querySelector('[data-form]');
  const title = card.querySelector('[data-title]');
  const sub = card.querySelector('[data-sub]');
  const switchEl = card.querySelector('[data-switch]');

  const render = () => {
    form.innerHTML = '';
    if (mode === 'login' || mode === 'signup') {
      if (mode === 'signup') {
        title.textContent = 'ثبت‌نام';
        sub.textContent = 'حسابی تازه بسازید و جهان ایده‌ها را شروع کنید';
        const nameField = document.createElement('div');
        nameField.className = 'field';
        nameField.innerHTML = `<label class="field__label">نام نمایشی</label><input class="input" name="display_name" autocomplete="nickname" required minlength="2" maxlength="60" />`;
        form.appendChild(nameField);
      } else {
        title.textContent = 'ورود';
        sub.textContent = 'به استودیوی ایده‌ها خوش آمدید';
      }
      const emailField = document.createElement('div');
      emailField.className = 'field';
      emailField.innerHTML = `<label class="field__label">ایمیل</label><input class="input" type="email" name="email" autocomplete="email" required />`;
      form.appendChild(emailField);
      const pwField = document.createElement('div');
      pwField.className = 'field';
      pwField.innerHTML = `<label class="field__label">رمز عبور</label><input class="input" type="password" name="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6" />`;
      form.appendChild(pwField);
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn btn--primary btn--lg btn--block';
      submit.innerHTML = `<i class="ri-${mode === 'login' ? 'login-box' : 'user-add'}-line"></i>${mode === 'login' ? 'ورود' : 'ثبت‌نام'}`;
      form.appendChild(submit);
      if (mode === 'login') {
        const fp = document.createElement('button');
        fp.type = 'button';
        fp.className = 'btn btn--ghost btn--sm';
        fp.style.alignSelf = 'center';
        fp.textContent = 'رمز را فراموش کرده‌اید؟';
        fp.addEventListener('click', () => { mode = 'reset'; render(); });
        form.appendChild(fp);
      }
    } else if (mode === 'reset') {
      title.textContent = 'بازیابی رمز';
      sub.textContent = 'ایمیل خود را وارد کنید تا لینک بازیابی ارسال شود';
      const emailField = document.createElement('div');
      emailField.className = 'field';
      emailField.innerHTML = `<label class="field__label">ایمیل</label><input class="input" type="email" name="email" required />`;
      form.appendChild(emailField);
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.className = 'btn btn--primary btn--lg btn--block';
      submit.innerHTML = '<i class="ri-mail-send-line"></i>ارسال لینک';
      form.appendChild(submit);
    }
    switchEl.innerHTML = '';
    if (mode === 'login') {
      switchEl.innerHTML = 'حساب ندارید؟ <button type="button" data-go="signup">ثبت‌نام</button>';
    } else if (mode === 'signup') {
      switchEl.innerHTML = 'قبلاً ثبت‌نام کرده‌اید؟ <button type="button" data-go="login">ورود</button>';
    } else {
      switchEl.innerHTML = '<button type="button" data-go="login">بازگشت به ورود</button>';
    }
    switchEl.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.go; render(); }));
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    if (!isEmail(email)) { toastError('ایمیل نامعتبر'); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.classList.add('btn--loading'); btn.disabled = true;
    try {
      if (mode === 'login') {
        await signIn(email, String(fd.get('password')));
        navigate('/home');
      } else if (mode === 'signup') {
        await signUp(email, String(fd.get('password')), String(fd.get('display_name') || ''));
        navigate('/home');
      } else if (mode === 'reset') {
        await resetPassword(email);
        mode = 'login'; render();
      }
    } catch (err) {
      toastError('خطا', err.message || 'عملیات ناموفق');
    } finally {
      btn.classList.remove('btn--loading'); btn.disabled = false;
    }
  });

  render();
};
