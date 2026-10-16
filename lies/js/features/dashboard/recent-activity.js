/* ============================================================
   js/features/dashboard/recent-activity.js
   Recent lies list + quick stats
   ============================================================ */

import { el } from '../../utils/dom.js';
import { formatRelative, truncate, toFaDigits } from '../../utils/format.js';
import { LIE_TYPES } from '../../config/app.config.js';
import { emptyState } from '../../ui/empty-state.js';

const TYPES_BY_ID = Object.fromEntries(LIE_TYPES.map((t) => [t.id, t]));

/**
 * @param {any[]} items
 * @param {{onOpen?:(lie:any)=>void, onSeeAll?:()=>void}} [opts]
 * @returns {HTMLElement}
 */
export function recentActivity(items = [], opts = {}) {
  const { onOpen, onSeeAll } = opts;

  const wrap = el('section', { class: 'recent-activity' });

  const head = el('header', { class: 'recent-activity__head' });
  head.appendChild(el('h3', { class: 'recent-activity__title' }, {
    children: [el('span', { class: 'recent-activity__title-icon' }, { children: ['⏱'] }), 'فعالیت اخیر'],
  }));
  if (onSeeAll) {
    const btn = el('button', {
      class: 'link-btn',
      attrs: { type: 'button' },
    }, { children: ['همه دروغ‌ها →'] });
    btn.addEventListener('click', onSeeAll);
    head.appendChild(btn);
  }
  wrap.appendChild(head);

  if (!items.length) {
    wrap.appendChild(emptyState({
      icon: '🌱',
      title: 'هنوز چیزی ثبت نکرده‌اید',
      message: 'با ثبت اولین دروغ، مسیر رویارویی با خودت را شروع کن.',
      variant: 'panel',
    }));
    return wrap;
  }

  const list = el('div', { class: 'recent-activity__list' });

  for (const lie of items.slice(0, 6)) {
    const type = TYPES_BY_ID[lie.type] || TYPES_BY_ID.other;
    const item = el('div', {
      class: 'recent-item',
      attrs: { tabindex: '0', role: 'button' },
    });

    const iconWrap = el('div', {
      class: 'recent-item__icon',
      style: { '--type-color': type.color },
    }, { children: [type.icon] });
    item.appendChild(iconWrap);

    const body = el('div', { class: 'recent-item__body' });
    body.appendChild(el('div', { class: 'recent-item__title' }, {
      children: [truncate(lie.title, 70)],
    }));
    if (lie.body) {
      body.appendChild(el('div', { class: 'recent-item__excerpt' }, {
        children: [truncate(String(lie.body).replace(/\s+/g, ' ').trim(), 100)],
      }));
    }
    item.appendChild(body);

    const meta = el('div', { class: 'recent-item__meta' });
    meta.appendChild(el('span', { class: 'recent-item__time' }, {
      children: [formatRelative(lie.updatedAt || lie.createdAt)],
    }));
    if (lie.isPinned) meta.appendChild(el('span', { class: 'recent-item__pin' }, { children: ['📌'] }));
    item.appendChild(meta);

    item.addEventListener('click', () => {
      if (onOpen) onOpen(lie);
      else location.hash = `#/lie/${lie.id}`;
    });
    item.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') item.click();
    });

    list.appendChild(item);
  }

  wrap.appendChild(list);
  return wrap;
}

export default { recentActivity };