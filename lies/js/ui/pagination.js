/* ============================================================
   js/ui/pagination.js
   Page navigation with ellipsis, jump, page size selector
   ============================================================ */

import { el } from '../utils/dom.js';
import { toFaDigits } from '../utils/format.js';

/**
 * @param {{
 *   page: number,
 *   pageSize: number,
 *   total: number,
 *   onChange?: (page:number) => void,
 *   onPageSizeChange?: (size:number) => void,
 *   pageSizes?: number[],
 *   showPageSize?: boolean,
 *   compact?: boolean,
 * }} opts
 * @returns {HTMLElement}
 */
export function pagination(opts) {
  const {
    page = 1, pageSize = 12, total = 0,
    onChange, onPageSizeChange,
    pageSizes = [12, 24, 48, 96],
    showPageSize = true,
    compact = false,
  } = opts;

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const root = el('nav', { class: ['pagination', compact ? 'pagination--compact' : ''].filter(Boolean), attrs: { 'aria-label': 'صفحه‌بندی' } });

  if (showPageSize) {
    const sizeWrap = el('div', { class: 'pagination__sizes' });
    sizeWrap.appendChild(el('span', { class: 'pagination__sizes-label' }, { children: ['در هر صفحه:'] }));
    const sel = el('select', { class: 'select select--sm' });
    for (const s of pageSizes) {
      const opt = el('option', { attrs: { value: String(s) } }, { children: [toFaDigits(s)] });
      if (s === pageSize) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => onPageSizeChange?.(Number(sel.value)));
    sizeWrap.appendChild(sel);
    root.appendChild(sizeWrap);
  }

  const nav = el('div', { class: 'pagination__nav' });

  const mkBtn = (label, targetPage, extra = {}) => {
    const btn = el('button', {
      class: ['pagination__btn', extra.class || ''].filter(Boolean),
      attrs: {
        type: 'button',
        'aria-label': extra.ariaLabel || '',
        disabled: extra.disabled ? 'true' : undefined,
      },
      on: { click: () => { if (!extra.disabled && targetPage !== page) onChange?.(targetPage); } },
      children: [label],
    });
    return btn;
  };

  nav.appendChild(mkBtn('‹', page - 1, {
    disabled: page <= 1,
    class: 'pagination__btn--nav',
    ariaLabel: 'قبلی',
  }));

  // Build page list with ellipsis
  const range = buildRange(page, pages);
  for (const p of range) {
    if (p === '…') {
      nav.appendChild(el('span', { class: 'pagination__ellipsis' }, { children: ['…'] }));
    } else {
      const btn = mkBtn(toFaDigits(p), p, { class: p === page ? 'is-active' : '' });
      if (p === page) btn.setAttribute('aria-current', 'page');
      nav.appendChild(btn);
    }
  }

  nav.appendChild(mkBtn('›', page + 1, {
    disabled: page >= pages,
    class: 'pagination__btn--nav',
    ariaLabel: 'بعدی',
  }));

  root.appendChild(nav);

  if (!compact) {
    const info = el('div', { class: 'pagination__info' });
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    info.appendChild(el('span', {}, {
      children: [`${toFaDigits(from)}–${toFaDigits(to)} از ${toFaDigits(total)}`],
    }));
    root.appendChild(info);
  }

  return root;
}

function buildRange(current, total, span = 1) {
  const out = [];
  const left = Math.max(2, current - span);
  const right = Math.min(total - 1, current + span);
  out.push(1);
  if (left > 2) out.push('…');
  for (let i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push('…');
  if (total > 1) out.push(total);
  return out;
}

export default { pagination };