/* ============================================================
   js/ui/skeleton.js
   Loading placeholders for various layouts
   ============================================================ */

import { el } from '../utils/dom.js';

/**
 * A single skeleton line.
 * @param {string} [width='100%']
 * @param {string} [height='14px']
 */
export function skeletonLine(width = '100%', height = '14px') {
  return el('div', { class: 'skeleton skeleton--line', style: { width, height } });
}

/**
 * A card-shaped skeleton.
 * @param {{height?:string, lines?:number}} [opts]
 */
export function skeletonCard(opts = {}) {
  const { height = '180px', lines = 3 } = opts;
  const wrap = el('div', { class: 'skeleton-card' });
  wrap.appendChild(el('div', { class: 'skeleton skeleton--card', style: { height: '40%', minHeight: '80px' } }));
  const body = el('div', { class: 'skeleton-card__body' });
  for (let i = 0; i < lines; i++) {
    body.appendChild(skeletonLine(i === lines - 1 ? '60%' : '100%'));
  }
  wrap.appendChild(body);
  return wrap;
}

/**
 * A grid of skeleton cards.
 * @param {number} count
 * @param {number} [columns=3]
 */
export function skeletonGrid(count = 6, columns = 3) {
  const grid = el('div', { class: 'skeleton-grid', style: { gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` } });
  for (let i = 0; i < count; i++) grid.appendChild(skeletonCard());
  return grid;
}

/**
 * A list of skeleton rows.
 * @param {number} count
 */
export function skeletonList(count = 5) {
  const list = el('div', { class: 'skeleton-list' });
  for (let i = 0; i < count; i++) {
    const row = el('div', { class: 'skeleton-row' });
    row.appendChild(el('div', { class: 'skeleton skeleton--avatar', style: { width: '36px', height: '36px' } }));
    const lines = el('div', { class: 'skeleton-row__lines' });
    lines.appendChild(skeletonLine('40%', '12px'));
    lines.appendChild(skeletonLine('80%', '10px'));
    row.appendChild(lines);
    list.appendChild(row);
  }
  return list;
}

/**
 * A full page skeleton (title + content).
 * @param {{variant?:'grid'|'list'|'detail'}} [opts]
 */
export function skeletonPage(opts = {}) {
  const { variant = 'grid' } = opts;
  const wrap = el('div', { class: 'skeleton-page' });
  wrap.appendChild(skeletonLine('30%', '26px'));
  wrap.appendChild(skeletonLine('60%', '14px'));
  if (variant === 'list') wrap.appendChild(skeletonList(6));
  else if (variant === 'detail') {
    wrap.appendChild(skeletonLine('100%', '180px'));
    for (let i = 0; i < 6; i++) wrap.appendChild(skeletonLine(i % 2 ? '85%' : '100%'));
  } else {
    wrap.appendChild(skeletonGrid(6, 3));
  }
  return wrap;
}

export default { skeletonLine, skeletonCard, skeletonGrid, skeletonList, skeletonPage };