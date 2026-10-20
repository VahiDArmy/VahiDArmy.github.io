/**
 * Render wrapper that catches synchronous errors while building a page node
 * and shows a friendly error state instead.
 *
 *   const node = withErrorBoundary(() => buildView(data));
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES } from '../config/constants.js';

export function errorView({ title = 'خطایی رخ داد', message = '', detail = '' } = {}) {
  return el('div', { class: 'container' }, [
    el('div', { class: 'error-page' }, [
      el('div', { class: 'error-page__icon' }, [icon('alert-triangle')]),
      el('h1', { class: 'error-page__title' }, [title]),
      el('p', { class: 'error-page__desc' }, [
        message || 'در پردازش این صفحه مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
      ]),
      detail ? el('div', { class: 'error-page__detail' }, [detail]) : null,
      el('div', { class: 'error-page__actions' }, [
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary',
            on: { click: () => window.location.reload() },
          },
          [icon('refresh'), 'تلاش دوباره']
        ),
        el(
          'a',
          { class: 'btn btn--secondary', href: router.href(ROUTES.HOME) },
          [icon('home'), 'بازگشت به خانه']
        ),
      ]),
    ]),
  ]);
}

export function withErrorBoundary(builder) {
  try {
    const node = builder();
    if (!node) throw new Error('empty render result');
    return node;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[error-boundary]', err);
    return errorView({
      title: 'مشکلی در نمایش این صفحه پیش آمد',
      message: 'صفحه به درستی بارگذاری نشد. تلاش دوباره یا بازگشت به خانه.',
      detail: err?.message || String(err),
    });
  }
}

export default withErrorBoundary;