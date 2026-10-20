/**
 * Reset password — user arrives here from a recovery email.
 * Exchanges the code from the hash, then presents a new-password form.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { supabase } from '../services/supabase.client.js';
import { authService } from '../services/auth.service.js';
import { exchangeCodeFromHash } from '../utils/supabase-url.js';
import { toast } from '../ui/toast.js';
import { ROUTES } from '../config/constants.js';
import { authLayout } from '../components/auth-layout.js';
import { validate, rules, hasErrors } from '../utils/validators.js';

export default async function resetPasswordPage(info, outlet) {
  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  try {
    // If the code lives in the hash, exchange it now
    await exchangeCodeFromHash();

    // Give Supabase a beat to settle any auto-detected session
    await new Promise((r) => setTimeout(r, 60));
    const { data } = await supabase.auth.getSession();

    if (!data?.session) {
      outlet.innerHTML = '';
      outlet.appendChild(buildError());
      return () => {};
    }

    outlet.innerHTML = '';
    outlet.appendChild(buildForm(outlet));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[reset-password]', err);
    outlet.innerHTML = '';
    outlet.appendChild(buildError(err));
  }

  return () => {};
}

function buildLoading() {
  return el('div', { class: 'auth-page' }, [
    el('div', { class: 'auth-loading' }, [
      el('div', { class: 'auth-loading__spinner' }),
      el('div', { class: 'auth-loading__text' }, ['در حال آماده‌سازی...']),
    ]),
  ]);
}

function buildError() {
  return authLayout({
    title: 'لینک نامعتبر',
    subtitle: 'لینک بازیابی شما منقضی شده یا نامعتبر است.',
    alert: { type: 'error', message: 'لطفاً یک درخواست بازیابی جدید صادر کنید.' },
    children: el(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } },
      [
        el(
          'a',
          { class: 'btn btn--primary btn--block', href: router.href(ROUTES.FORGOT_PASSWORD) },
          ['درخواست لینک جدید']
        ),
        el(
          'a',
          { class: 'btn btn--ghost btn--block', href: router.href(ROUTES.LOGIN) },
          ['بازگشت به ورود']
        ),
      ]
    ),
  });
}

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

function buildForm(outlet) {
  const pwdInput = el('input', {
    type: 'password',
    class: 'input',
    id: 'rp-new',
    autocomplete: 'new-password',
    required: true,
    dir: 'ltr',
  });
  const confirmInput = el('input', {
    type: 'password',
    class: 'input',
    id: 'rp-confirm',
    autocomplete: 'new-password',
    required: true,
    dir: 'ltr',
  });

  const submitBtn = el(
    'button',
    { type: 'submit', class: 'btn btn--primary btn--block btn--lg auth-form__submit' },
    ['ذخیره رمز جدید']
  );

  const form = el('form', { class: 'auth-form', novalidate: true }, [
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'rp-new' }, ['رمز جدید']),
      el('div', { class: 'password-field' }, [pwdInput, passwordToggle(pwdInput)]),
      el('p', { class: 'form-help' }, ['حداقل ۸ کاراکتر، شامل حرف و رقم.']),
    ]),
    el('div', { class: 'form-field' }, [
      el('label', { class: 'form-label', for: 'rp-confirm' }, ['تکرار رمز جدید']),
      el('div', { class: 'password-field' }, [confirmInput, passwordToggle(confirmInput)]),
    ]),
    submitBtn,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = { password: pwdInput.value, confirm: confirmInput.value };
    const errors = validate(values, {
      password: [rules.required('رمز جدید الزامی است'), rules.password()],
      confirm: [rules.required('تکرار رمز الزامی است'), rules.matches('password', 'رمزها مطابقت ندارند')],
    });
    if (hasErrors(errors)) {
      toast.error(Object.values(errors)[0]);
      return;
    }

    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      await authService.updatePassword(values.password);
      toast.success('رمز عبور با موفقیت تغییر کرد.');
      await authService.signOut();
      router.navigate(ROUTES.LOGIN, { replace: true });
    } catch (err) {
      toast.error(err.message || 'تغییر رمز ناموفق بود.');
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  });

  return authLayout({
    title: 'تعیین رمز جدید',
    subtitle: 'رمز جدیدی برای حساب خود انتخاب کنید.',
    children: form,
    footer: [el('a', { href: router.href(ROUTES.LOGIN) }, ['انصراف و بازگشت'])],
  });
}