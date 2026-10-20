/**
 * Auth callback — finalises email confirmation (and other redirects).
 * Supabase signup confirmation lands here with ?code= in the hash.
 */

import { el } from '../utils/dom.js';
import { router } from '../core/router.js';
import { authService } from '../services/auth.service.js';
import { exchangeCodeFromHash } from '../utils/supabase-url.js';
import { toast } from '../ui/toast.js';
import { ROUTES } from '../config/constants.js';

export default async function authCallbackPage(info, outlet) {
  outlet.innerHTML = '';
  outlet.appendChild(buildLoading());

  try {
    await exchangeCodeFromHash();
    await authService.handleCallback();

    toast.success('حساب شما فعال شد. خوش آمدید!');
    const next = info?.query?.get('next') || ROUTES.HOME;
    router.navigate(next, { replace: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth-callback]', err);
    outlet.innerHTML = '';
    outlet.appendChild(buildError());
  }

  return () => {};
}

function buildLoading() {
  return el('div', { class: 'auth-page' }, [
    el('div', { class: 'auth-loading' }, [
      el('div', { class: 'auth-loading__spinner' }),
      el('div', { class: 'auth-loading__text' }, ['در حال تأیید حساب...']),
    ]),
  ]);
}

function buildError() {
  return el('div', { class: 'auth-page' }, [
    el('div', { class: 'auth-card' }, [
      el('div', { class: 'auth-card__brand' }, [
        el('span', { class: 'auth-card__logo' }, ['O']),
      ]),
      el('h1', { class: 'auth-card__title' }, ['تأیید ناموفق']),
      el('p', { class: 'auth-card__subtitle' }, [
        'لینک تأیید منقضی شده یا نامعتبر است. لطفاً دوباره ثبت‌نام کنید یا از پشتیبانی کمک بگیرید.',
      ]),
      el(
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
            ['ثبت‌نام مجدد']
          ),
        ]
      ),
    ]),
  ]);
}