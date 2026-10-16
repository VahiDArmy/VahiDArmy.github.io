/* ============================================================
   js/features/dashboard/stat-cards.js
   Stat cards grid for the dashboard
   ============================================================ */

import { el } from '../../utils/dom.js';
import { toFaDigits, formatRelative } from '../../utils/format.js';
import { sparkline } from '../../ui/charts/index.js';

/**
 * @param {{
 *   overview: any,
 *   monthlyCounts?: Array<{month:string,count:number}>,
 * }} data
 * @returns {HTMLElement}
 */
export function statCardsGrid(data) {
  const { overview = {}, monthlyCounts = [] } = data;
  const wrap = el('div', { class: 'stat-grid' });

  wrap.appendChild(statCard({
    icon: '🎭',
    label: 'دروغ‌های فعال',
    value: overview.active || 0,
    hint: overview.this_week ? `${toFaDigits(overview.this_week)} مورد این هفته` : 'این هفته چیزی ثبت نشده',
    trend: monthlyCounts.map((m) => m.count),
    accent: 'var(--accent)',
  }));

  wrap.appendChild(statCard({
    icon: '💭',
    label: 'بازتاب‌ها',
    value: overview.reflections || 0,
    hint: overview.reflections > 0 ? 'تحلیل و بازنگری' : 'اولین بازتاب را بنویسید',
    accent: 'var(--cat-3)',
  }));

  wrap.appendChild(statCard({
    icon: '🏷️',
    label: 'برچسب‌ها',
    value: overview.tags || 0,
    hint: 'سازمان‌دهی موضوعی',
    accent: 'var(--cat-4)',
  }));

  wrap.appendChild(statCard({
    icon: '📦',
    label: 'بایگانی',
    value: overview.archived || 0,
    hint: 'کنار گذاشته‌شده‌ها',
    accent: 'var(--info)',
  }));

  wrap.appendChild(statCard({
    icon: '⚡',
    label: 'میانگین شدت',
    value: overview.avg_intensity?.toFixed(1) || '0',
    hint: 'از ۱۰',
    accent: 'var(--warning)',
    isNumeric: true,
  }));

  wrap.appendChild(statCard({
    icon: '◉',
    label: 'میانگین باور',
    value: overview.avg_belief?.toFixed(1) || '0',
    hint: 'از ۱۰',
    accent: 'var(--cat-2)',
    isNumeric: true,
  }));

  return wrap;
}

function statCard(opts) {
  const { icon, label, value, hint, accent, trend, isNumeric } = opts;
  const card = el('div', { class: 'stat-card', style: { '--stat-accent': accent || 'var(--accent)' } });
  card.appendChild(el('div', { class: 'stat-card__icon' }, { children: [icon] }));
  card.appendChild(el('div', { class: 'stat-card__label' }, { children: [label] }));
  card.appendChild(el('div', {
    class: 'stat-card__value',
    children: [typeof value === 'number' ? toFaDigits(value) : value],
  }));
  if (hint) card.appendChild(el('div', { class: 'stat-card__hint' }, { children: [hint] }));

  if (trend && trend.length > 1) {
    const sp = sparkline(trend, { width: 120, height: 26, color: accent || 'var(--accent)' });
    const spWrap = el('div', { class: 'stat-card__spark' });
    spWrap.appendChild(sp);
    card.appendChild(spWrap);
  }

  return card;
}

export default { statCardsGrid };