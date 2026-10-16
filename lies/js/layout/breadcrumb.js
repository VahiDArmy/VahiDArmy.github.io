/* ============================================================
   js/layout/breadcrumb.js
   Renders breadcrumb navigation in the topbar
   ============================================================ */

import { el } from '../utils/dom.js';
import { NAV_ITEMS, ROUTES } from '../config/app.config.js';

/**
 * @typedef {Object} Crumb
 * @property {string} label
 * @property {string} [href]  hash path, e.g. "/lies"
 */

/**
 * Render a breadcrumb trail.
 * @param {HTMLElement} container
 * @param {Crumb[]} crumbs
 */
export function renderBreadcrumb(container, crumbs = []) {
  if (!container) return;
  container.innerHTML = '';

  if (!crumbs.length) return;

  crumbs.forEach((c, idx) => {
    const isLast = idx === crumbs.length - 1;
    const node = isLast
      ? el('span', { class: 'breadcrumb__current' }, { children: [c.label] })
      : el('a', {
          class: 'breadcrumb__link',
          attrs: { href: `#${c.href || '/'}` },
        }, { children: [c.label] });

    container.appendChild(node);

    if (!isLast) {
      container.appendChild(el('span', { class: 'breadcrumb__sep', attrs: { 'aria-hidden': 'true' } }, { children: ['‹'] }));
    }
  });
}

/**
 * Build a breadcrumb trail from a route path.
 * @param {string} path
 * @param {Record<string,any>} [ctx] optional context (e.g. lie title)
 * @returns {Crumb[]}
 */
export function crumbsForPath(path, ctx = {}) {
  const clean = String(path || '').replace(/^\//, '').split('?')[0];
  const [head] = clean.split('/');

  const crumbs = [{ label: 'خانه', href: '/dashboard' }];

  if (head === 'dashboard' || !head) return crumbs;

  const main = NAV_ITEMS.find((n) => n.id === head);
  if (main && head !== 'dashboard') {
    crumbs.push({ label: main.label, href: `/${main.id}` });
  } else if (head === 'lie') {
    crumbs.push({ label: 'دروغ‌ها', href: '/lies' });
    if (ctx.title) crumbs.push({ label: ctx.title });
  } else {
    crumbs.push({ label: clean });
  }

  return crumbs;
}

export default { renderBreadcrumb, crumbsForPath };