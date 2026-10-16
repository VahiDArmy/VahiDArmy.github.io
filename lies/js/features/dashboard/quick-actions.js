/* ============================================================
   js/features/dashboard/quick-actions.js
   Quick action tiles on the dashboard
   ============================================================ */

import { el } from '../../utils/dom.js';

/**
 * @param {{ actions?: Array<{label:string, icon:string, description?:string, onClick:()=>void, accent?:string, badge?:string}> }} [opts]
 * @returns {HTMLElement}
 */
export function quickActions(opts = {}) {
  const defaultActions = [
    {
      label: 'ثبت دروغ جدید',
      icon: '＋',
      description: 'یک دروغ که امروز به خودت گفتی را ثبت کن',
      accent: 'var(--accent)',
      onClick: () => { location.hash = '#/lies?new=1'; },
    },
    {
      label: 'تحلیل و آمار',
      icon: '📊',
      description: 'الگوها، روند و بینش‌ها',
      accent: 'var(--cat-5)',
      onClick: () => { location.hash = '#/analytics'; },
    },
    {
      label: 'دسته‌ها و برچسب‌ها',
      icon: '🏷️',
      description: 'سازمان‌دهی بهتر دروغ‌ها',
      accent: 'var(--cat-4)',
      onClick: () => { location.hash = '#/tags'; },
    },
    {
      label: 'تنظیمات',
      icon: '⚙️',
      description: 'تم، اکسنت، اندازه فونت، حساب',
      accent: 'var(--info)',
      onClick: () => { location.hash = '#/settings'; },
    },
  ];
  const actions = opts.actions || defaultActions;

  const wrap = el('div', { class: 'quick-actions' });

  for (const a of actions) {
    const tile = el('button', {
      class: 'quick-action',
      attrs: { type: 'button' },
      style: { '--qa-accent': a.accent || 'var(--accent)' },
    });
    tile.appendChild(el('span', { class: 'quick-action__icon' }, { children: [a.icon] }));
    const text = el('div', { class: 'quick-action__text' });
    text.appendChild(el('span', { class: 'quick-action__label' }, { children: [a.label] }));
    if (a.description) text.appendChild(el('span', { class: 'quick-action__desc' }, { children: [a.description] }));
    tile.appendChild(text);
    if (a.badge) tile.appendChild(el('span', { class: 'quick-action__badge' }, { children: [a.badge] }));
    tile.addEventListener('click', a.onClick);
    wrap.appendChild(tile);
  }

  return wrap;
}

export default { quickActions };