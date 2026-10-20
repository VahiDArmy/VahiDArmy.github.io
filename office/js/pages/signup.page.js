/**
 * Signup page — display name, username, email, password.
 * On success: shows "check your email" state (unless Supabase auto-signs-in).
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { authService } from '../services/auth.service.js';
import { toast } from '../ui/toast.js';
import { ROUTES } from '../config/constants.js';
import { authLayout } from '../components/auth-layout.js';
import { validate, rules, hasErrors } from '../utils/validators.js';

function passwordToggle(input) {
  const btn = el(
    'button',
    {
      type: 'button',
      class: 'password-field__toggle',
      'aria-label': 'نمایش رمز',
      on: {
        click: () => {
          const isPwd = input.type === 'password';
          input.type = isPwd ? 'text' : 'password';
          btn.innerHTML = '';
          btn.appendChild(icon(isPwd ? 'eye-off' : 'eye'));
          btn.setAttribute('aria-label', isPwd ? 'پنهان کردن رمز' : 'نمایش رمز');
        },
      },
    },
    [icon('eye')]
  );
  return btn;
}

export default function signupPage(info, outlet) {
  const nameInput = el('input', {
    type: 'text',
    class: 'input',
    id: 'su-name',
    autocomplete: 'name',
    required: true,
    placeholder: 'مثلاً: مایکل اسکات',
  });
  const usernameInput = el('input', {
    type: 'text',
    class: 'input',
    id: 'su-username',
    autocomplete: 'username',
    dir: 'ltr',
    placeholder: 'michael',
  });
  const emailInput = el('input', {
    type: 'email',
    class: 'input',
    id: 'su-email',
    autocomplete: 'email',
    required: true,
    dir: 'ltr',
    placeholder: 'name@example.com',
  });
  const passwordInput = el('input', {
    type: 'password',
    class: 'input',
    id: 'su-password',
    autocomplete: 'new-password',
    required: true,
    dir: 'ltr',
  });
  const confirmInput = el('input', {
    type: 'password',
    class: 'input',
    id: 'su-confirm',
    autocomplete: 'new-password',
    required: true,
    dir: 'ltr',
  });

  const submitBtn = el(
    'button',
    { type: 'submit', class: 'btn btn--primary btn--block btn--lg auth-form__submit' },
    ['ایجاد حساب']
  );

  const form = el('form', { class: 'auth-form', novalidate: true }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'su-name' }, ['نام نمایشی']),
      nameInput,
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'su-username' }, [
        'نام کاربری ',
        el('span', { class: 'form-label__hint' }, ['(اختیاری)']),
      ]),
      usernameInput,
      el('p', { class: 'form-help' }, ['حروف لاتین، عدد، نقطه یا زیرخط — بین ۳ تا ۲۴ کاراکتر.']),
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'su-email' }, ['ایمیل']),
      emailInput,
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'su-password' }, ['رمز عبور']),
      el('div', { class: 'password-field' }, [passwordInput, passwordToggle(passwordInput)]),
      el('p', { class: 'form-help' }, ['حداقل ۸ کاراکتر، شامل حرف و رقم.']),
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'su-confirm' }, ['تکرار رمز عبور']),
      el('div', { class: 'password-field' }, [confirmInput, passwordToggle(confirmInput)]),
    ]),
    submitBtn,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {
      displayName: nameInput.value.trim(),
      username: usernameInput.value.trim(),
      email: emailInput.value.trim(),
      password: passwordInput.value,
      confirm: confirmInput.value,
    };
    const errors = validate(values, {
      displayName: [rules.required('نام نمایشی الزامی است')],
      username: [rules.username()],
      email: [rules.required('ایمیل الزامی است'), rules.email()],
      password: [rules.required('رمز عبور الزامی است'), rules.password()],
      confirm: [rules.required('تکرار رمز الزامی است'), rules.matches('password', 'رمزها مطابقت ندارند')],
    });
    if (hasErrors(errors)) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      const result = await authService.signUp({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        username: values.username || null,
      });

      if (result?.session) {
        toast.success('حساب شما ساخته شد!');
        router.navigate(ROUTES.HOME);
        return;
      }

      showConfirmation(outlet, values.email);
    } catch (err) {
      toast.error(err.message || 'ثبت‌نام ناموفق بود.');
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  const node = authLayout({
    title: 'ایجاد حساب',
    subtitle: 'برای پیوستن به بایگانی اداره، اطلاعات زیر را تکمیل کنید.',
    children: form,
    footer: [
      el('span', {}, ['حساب دارید؟ ']),
      el('a', { href: router.href(ROUTES.LOGIN) }, ['وارد شوید']),
    ],
  });

  outlet.innerHTML = '';
  outlet.appendChild(node);
  requestAnimationFrame(() => nameInput.focus());

  return () => {};
}

function showConfirmation(outlet, email) {
  const node = authLayout({
    title: 'ایمیل خود را بررسی کنید',
    subtitle: `لینک تأیید حساب به ${email} ارسال شد. برای فعال‌سازی حساب، روی لینک کلیک کنید.`,
    alert: {
      type: 'info',
      message: 'پس از تأیید، می‌توانید وارد شوید.',
    },
    children: el(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } },
      [
        el(
          'a',
          { class: 'btn btn--primary btn--block', href: router.href(ROUTES.LOGIN) },
          ['رفتن به صفحه ورود']
        ),
        el(
          'a',
          { class: 'btn btn--ghost btn--block', href: router.href(ROUTES.SIGNUP) },
          ['استفاده از ایمیل دیگر']
        ),
      ]
    ),
  });
  outlet.innerHTML = '';
  outlet.appendChild(node);
}