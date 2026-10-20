/**
 * 404 page — shown by the catch-all router entry.
 */

import { el } from '../utils/dom.js';
import { router } from '../core/router.js';
import { ROUTES } from '../config/constants.js';

export default function notFoundPage(info, outlet) {
  const path = info?.path || '';

  const node = el('div', { class: 'container' }, [
    el('div', { class: 'not-found' }, [
      el('div', { class: 'not-found__code' }, ['404']),
      el('h1', { class: 'not-found__title' }, ['صفحه پیدا نشد']),
      el('p', { class: 'not-found__desc' }, [
        path ? `مسیر «${path}» وجود ندارد یا حذف شده است.` : 'صفحه‌ای که دنبال آن بودید پیدا نشد.',
      ]),
      el('div', { class: 'not-found__actions' }, [
        el('a', { class: 'btn btn--primary', href: router.href(ROUTES.HOME) }, ['بازگشت به خانه']),
        el('a', { class: 'btn btn--secondary', href: router.href(ROUTES.PEOPLE) }, ['مشاهده افراد']),
      ]),
    ]),
  ]);

  outlet.innerHTML = '';
  outlet.appendChild(node);

  return () => {};
}