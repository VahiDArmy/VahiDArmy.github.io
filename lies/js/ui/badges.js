/* ============================================================
   js/ui/badges.js
   Badges, pills, dots, and status chips
   ============================================================ */

import { el } from '../utils/dom.js';

/**
 * @param {{
 *   label: string,
 *   variant?: 'default'|'accent'|'success'|'warning'|'danger'|'info'|'muted',
 *   icon?: string,
 *   size?: 'xs'|'sm'|'md',
 *   dot?: boolean,
 *   pill?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function badge(opts) {
  const {
    label, variant = 'default', icon, size = 'sm', dot = false, pill = false,
  } = opts;
  const node = el('span', {
    class: [
      'badge',
      `badge--${variant}`,
      `badge--${size}`,
      pill ? 'badge--pill' : '',
    ].filter(Boolean),
  });
  if (dot) node.appendChild(el('span', { class: 'badge__dot' }));
  if (icon) node.appendChild(el('span', { class: 'badge__icon' }, { children: [icon] }));
  node.appendChild(el('span', { class: 'badge__label' }, { children: [label] }));
  return node;
}

/**
 * A status badge from a status string.
 * @param {'active'|'archived'|'trashed'} status
 * @returns {HTMLElement}
 */
export function statusBadge(status) {
  const map = {
    active: { label: 'فعال', variant: 'success', icon: '●' },
    archived: { label: 'بایگانی', variant: 'info', icon: '📦' },
    trashed: { label: 'زباله', variant: 'danger', icon: '🗑️' },
  };
  const def = map[status] || map.active;
  return badge({ label: def.label, variant: def.variant, icon: def.icon, size: 'xs', pill: true });
}

/**
 * A numeric pill (e.g., counts).
 * @param {number|string} value
 * @param {{variant?:string, size?:'xs'|'sm'|'md'}} [opts]
 * @returns {HTMLElement}
 */
export function countPill(value, opts = {}) {
  const { variant = 'default', size = 'sm' } = opts;
  const node = el('span', { class: ['badge', `badge--${variant}`, `badge--${size}`, 'badge--pill', 'badge--num'] });
  node.appendChild(el('span', { class: 'badge__label', style: { fontVariantNumeric: 'tabular-nums' } }, { children: [String(value)] }));
  return node;
}

export default { badge, statusBadge, countPill };