/**
 * Forgot password — sends reset email.
 * Password reset link redirects to /reset-password.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { supabase } from '../services/supabase.client.js';
import { toast } from '../ui/toast.js';
import { ROUTES } from '../config/constants.js';
import { authLayout } from '../components/auth-layout.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { friendlyError } from '../utils/format.js';

function buildResetUrl() {
  return window.location.origin + window.location.pathname + '#/reset-password';
}

export default function forgotPasswordPage(info, outlet) {
  const emailInput = el('input', {
    type: 'email',
    class: 'input',
    id: 'fp-email',
    autocomplete: 'email',
    required: true,
    dir: 'ltr',
    placeholder: 'name@example.com',
  });

  const submitBtn = el(
    'button',
    { type: 'submit', class: 'btn btn--primary btn--block btn--lg auth-form__submit' },
    ['ارسال لینک بازیابی']
  );

  const form = el('form', { class: 'auth-form', novalidate: true }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'fp-email' }, ['ایمیل حساب']),
      el('div', { class: 'icon-field' }, [
        emailInput,
        el('span', { class: 'icon-field__icon' }, [icon('mail')]),
      ]),
    ]),
    submitBtn,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const errors = validate({ email }, {
      email: [rules.required('ایمیل الزامی است'), rules.email()],
    });
    if (hasErrors(errors)) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: buildResetUrl(),
      });
      if (error) throw error;

      showSuccess(outlet, email);
    } catch (err) {
      toast.error(friendlyError(err, 'ارسال لینک ناموفق بود.'));
    } finally {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  const node = authLayout({
    title: 'بازیابی رمز عبور',
    subtitle: 'ایمیل خود را وارد کنید تا لینک بازیابی برای شما ارسال شود.',
    children: form,
    footer: [el('a', { href: router.href(ROUTES.LOGIN) }, ['بازگشت به ورود'])],
  });

  outlet.innerHTML = '';
  outlet.appendChild(node);
  requestAnimationFrame(() => emailInput.focus());

  return () => {};
}

function showSuccess(outlet, email) {
  const node = authLayout({
    title: 'لینک ارسال شد',
    subtitle: `اگر ${email} در سیستم ثبت شده باشد، به‌زودی لینک بازیابی دریافت می‌کنید.`,
    alert: {
      type: 'success',
      message: 'برای امنیت، وجود یا نبود این ایمیل در سیستم افشا نمی‌شود.',
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
      ]
    ),
  });
  outlet.innerHTML = '';
  outlet.appendChild(node);
}