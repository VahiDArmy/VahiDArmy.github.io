/**
 * Pagination controller — renders numbered pages with a window around
 * the current page. Also shows total info and page-size selector.
 *
 *   const pg = createPagination({
 *     total, page, pageSize,
 *     onChange: ({ page, pageSize }) => reload(),
 *   });
 *   container.appendChild(pg.node);
 */

import { el, icon } from '../utils/dom.js';
import { formatNumber } from '../utils/format.js';
import { PAGE_SIZES } from '../config/constants.js';

function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function windowPages(page, totalPages, radius = 1) {
  const start = Math.max(1, page - radius);
  const end = Math.min(totalPages, page + radius);
  return range(start, end);
}

export function createPagination({
  total = 0,
  page = 1,
  pageSize = 12,
  showPageSize = true,
  onChange,
} = {}) {
  const node = el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingBlock: 'var(--space-3)',
    },
  });

  let state = { total, page, pageSize };

  function render() {
    node.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const safePage = Math.min(Math.max(1, state.page), totalPages);
    state.page = safePage;

    const from = (safePage - 1) * state.pageSize + 1;
    const to = Math.min(safePage * state.pageSize, state.total);

    const info = el(
      'div',
      { class: 'pagination__info' },
      state.total > 0
        ? [`${formatNumber(from)}–${formatNumber(to)} از ${formatNumber(state.total)}`]
        : ['نتیجه‌ای وجود ندارد']
    );

    const pager = el('div', { class: 'pagination' });

    const prev = el(
      'button',
      {
        type: 'button',
        class: 'pagination__btn',
        'aria-label': 'صفحه قبل',
        disabled: safePage === 1,
        on: { click: () => go(safePage - 1) },
      },
      [icon('chevron-right')]
    );

    const next = el(
      'button',
      {
        type: 'button',
        class: 'pagination__btn',
        'aria-label': 'صفحه بعد',
        disabled: safePage === totalPages,
        on: { click: () => go(safePage + 1) },
      },
      [icon('chevron-left')]
    );

    pager.appendChild(prev);

    const pages = windowPages(safePage, totalPages, 1);
    const showStartDots = pages[0] > 2;
    const showEndDots = pages[pages.length - 1] < totalPages - 1;

    if (pages[0] > 1) {
      pager.appendChild(pageBtn(1, safePage === 1));
      if (showStartDots) pager.appendChild(el('span', { class: 'pagination__ellipsis' }, ['…']));
    }

    for (const p of pages) pager.appendChild(pageBtn(p, p === safePage));

    if (pages[pages.length - 1] < totalPages) {
      if (showEndDots) pager.appendChild(el('span', { class: 'pagination__ellipsis' }, ['…']));
      pager.appendChild(pageBtn(totalPages, safePage === totalPages));
    }

    pager.appendChild(next);

    let pageSizeNode = null;
    if (showPageSize) {
      pageSizeNode = el(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } },
        [
          el('span', { class: 'toolbar__label' }, ['تعداد در صفحه:']),
          el(
            'select',
            {
              class: 'select toolbar__select',
              style: { minWidth: '70px' },
              on: {
                change: (e) => {
                  state.pageSize = parseInt(e.target.value, 10) || 12;
                  state.page = 1;
                  render();
                  onChange?.({ page: state.page, pageSize: state.pageSize });
                },
              },
            },
            PAGE_SIZES.map((n) =>
              el('option', { value: String(n), selected: n === state.pageSize }, [formatNumber(n)])
            )
          ),
        ]
      );
    }

    node.append(info, pager);
    if (pageSizeNode) node.appendChild(pageSizeNode);
  }

  function pageBtn(n, active) {
    return el(
      'button',
      {
        type: 'button',
        class: `pagination__btn${active ? ' is-active' : ''}`,
        'aria-current': active ? 'page' : undefined,
        on: { click: () => go(n) },
      },
      [formatNumber(n)]
    );
  }

  function go(p) {
    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const target = Math.min(Math.max(1, p), totalPages);
    if (target === state.page) return;
    state.page = target;
    render();
    onChange?.({ page: state.page, pageSize: state.pageSize });
  }

  render();

  return {
    node,
    update({ total, page, pageSize } = {}) {
      if (total != null) state.total = total;
      if (page != null) state.page = page;
      if (pageSize != null) state.pageSize = pageSize;
      render();
    },
    get state() { return { ...state }; },
  };
}

export default createPagination;