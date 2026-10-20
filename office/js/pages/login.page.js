/**
 * Login page — email + password.
 * Supports ?next= query param to redirect back after successful sign-in.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { authService } from '../services/auth.service.js';
import { toast } from '../ui/toast.js';
import { ROUTES } from '../config/constants.js';
import { authLayout } from '../components/auth-layout.js';
import { validate, rules, hasErrors } from '../utils/validators.js';

export default function loginPage(info, outlet) {
  const next = info?.query?.get('next') || '';

  const emailInput = el('input', {
    type: 'email',
    class: 'input',
    id: 'login-email',
    autocomplete: 'email',
    required: true,
    dir: 'ltr',
    placeholder: 'name@example.com',
  });

  const passwordInput = el('input', {
    type: 'password',
    class: 'input',
    id: 'login-password',
    autocomplete: 'current-password',
    required: true,
    dir: 'ltr',
    placeholder: '••••••••',
  });

  const toggle = el(
    'button',
    {
      type: 'button',
      class: 'password-field__toggle',
      'aria-label': 'نمایش رمز',
      on: {
        click: () => {
          const isPwd = passwordInput.type === 'password';
          passwordInput.type = isPwd ? 'text' : 'password';
          toggle.innerHTML = '';
          toggle.appendChild(icon(isPwd ? 'eye-off' : 'eye'));
          toggle.setAttribute('aria-label', isPwd ? 'پنهان کردن رمز' : 'نمایش رمز');
        },
      },
    },
    [icon('eye')]
  );

  const submitBtn = el(
    'button',
    { type: 'submit', class: 'btn btn--primary btn--block btn--lg auth-form__submit' },
    ['ورود']
  );

  const form = el('form', { class: 'auth-form', novalidate: true }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'login-email' }, ['ایمیل']),
      el('div', { class: 'icon-field' }, [
        emailInput,
        el('span', { class: 'icon-field__icon' }, [icon('mail')]),
      ]),
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'login-password' }, ['رمز عبور']),
      el('div', { class: 'password-field' }, [passwordInput, toggle]),
    ]),
    submitBtn,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = { email: emailInput.value.trim(), password: passwordInput.value };
    const errors = validate(values, {
      email: [rules.required(), rules.email()],
      password: [rules.required()],
    });
    if (hasErrors(errors)) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      await authService.signIn(values.email, values.password);
      toast.success('خوش آمدید!');
      router.navigate(next || ROUTES.HOME);
    } catch (err) {
      toast.error(err.message || 'ورود ناموفق بود.');
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  const node = authLayout({
    title: 'ورود به اداره',
    subtitle: 'برای دسترسی به بایگانی، وارد حساب خود شوید.',
    children: form,
    footer: [
      el('span', {}, ['حساب ندارید؟ ']),
      el('a', { href: router.href(ROUTES.SIGNUP) }, ['ثبت‌نام کنید']),
      el('br'),
      el(
        'a',
        { href: router.href(ROUTES.FORGOT_PASSWORD), style: { marginBlockStart: '6px', display: 'inline-block' } },
        ['رمز عبور را فراموش کرده‌اید؟']
      ),
    ],
  });

  outlet.innerHTML = '';
  outlet.appendChild(node);
  requestAnimationFrame(() => emailInput.focus());

  return () => {};
}