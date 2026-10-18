/* ============================================================
   js/features/lies/lies-list.js
   COMPLETE FILE - NO TRUNCATION.
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import { lieCard, lieCardSkeleton } from './lie-card.js';
import { lieRow, lieTimelineItem } from './lie-row.js';
import { emptyState } from '../../ui/empty-state.js';
import { VIEW_MODES } from '../../config/app.config.js';
import { loadFirstPage } from './lies-store.js';

export function renderLiesList(container, state) {
  clear(container);

  if (state.error && !state.items.length) {
    container.appendChild(renderError(state.error, () => loadFirstPage()));
    return;
  }

  if (state.loading && !state.items.length) {
    container.appendChild(renderSkeletons(state.view));
    return;
  }

  if (!state.items.length) {
    container.appendChild(renderEmpty(state));
    return;
  }

  const getCategory = (id) => state.categories.find((c) => c.id === id);
  
  const typesMap = Object.fromEntries((state.lieTypes || []).map((t) => [t.id, t]));
  const moodsMap = Object.fromEntries((state.moods || []).map((m) => [m.id, m]));

  const commonOpts = {
    onOpen: state.onOpen,
    onToggleSelect: state.onToggleSelect,
    onContextMenu: state.onContextMenu,
    getCategory,
    typesMap,
    moodsMap,
  };

  if (state.view === VIEW_MODES.GRID) {
    const grid = el('div', { class: 'lies-grid' });
    for (const lie of state.items) {
      grid.appendChild(lieCard(lie, { ...commonOpts, selected: state.selection.has(lie.id) }));
    }
    container.appendChild(grid);
  } else if (state.view === VIEW_MODES.LIST) {
    const list = el('div', { class: 'lies-list' });
    for (const lie of state.items) {
      list.appendChild(lieRow(lie, { ...commonOpts, variant: 'list', selected: state.selection.has(lie.id) }));
    }
    container.appendChild(list);
  } else if (state.view === VIEW_MODES.COMPACT) {
    const list = el('div', { class: 'lies-list lies-list--compact' });
    for (const lie of state.items) {
      list.appendChild(lieRow(lie, { ...commonOpts, variant: 'compact', selected: state.selection.has(lie.id) }));
    }
    container.appendChild(list);
  } else if (state.view === VIEW_MODES.TIMELINE) {
    const timeline = el('div', { class: 'lies-timeline' });
    for (const lie of state.items) {
      timeline.appendChild(lieTimelineItem(lie, { ...commonOpts, selected: state.selection.has(lie.id) }));
    }
    container.appendChild(timeline);
  }

  if (state.hasMore) {
    const more = el('div', { class: 'lies-loadmore' });
    if (state.loadingMore) {
      more.appendChild(el('span', { class: 'spinner' }));
      more.appendChild(el('span', {}, { children: ['در حال بارگذاری…'] }));
    } else {
      const btn = el('button', { class: 'btn btn--outline btn--pill', attrs: { type: 'button' } }, { children: ['نمایش بیشتر'] });
      btn.addEventListener('click', state.onLoadMore);
      more.appendChild(btn);
    }
    container.appendChild(more);
  }

  if (!state.hasMore && state.items.length > 12) {
    container.appendChild(el('div', { class: 'lies-end' }, {
      children: [el('span', { class: 'lies-end__line' }), el('span', { class: 'lies-end__dot' }, { children: ['✦'] }), el('span', { class: 'lies-end__line' })],
    }));
  }
}

function renderSkeletons(view) {
  if (view === VIEW_MODES.GRID) {
    const grid = el('div', { class: 'lies-grid' });
    for (let i = 0; i < 6; i++) grid.appendChild(lieCardSkeleton());
    return grid;
  }
  const list = el('div', { class: 'lies-list' });
  for (let i = 0; i < 8; i++) {
    const row = el('div', { class: 'lie-row lie-row--skeleton' });
    row.appendChild(el('div', { class: 'skeleton', style: { width: '28px', height: '28px', borderRadius: '8px' } }));
    const body = el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' } });
    body.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '60%', height: '14px' } }));
    body.appendChild(el('div', { class: 'skeleton skeleton--line', style: { width: '90%', height: '10px' } }));
    row.appendChild(body); list.appendChild(row);
  }
  return list;
}

function renderEmpty(state) {
  const hasFilters = state.total === 0 && state.filtersAreActive;
  if (hasFilters) {
    return emptyState({ icon: '🔍', title: 'نتیجه‌ای پیدا نشد', message: 'هیچ دروغی با فیلترهای فعلی مطابقت ندارد.', action: { label: 'پاک کردن فیلترها', variant: 'outline', onClick: state.onResetFilters }, secondaryAction: { label: 'ثبت دروغ جدید', onClick: state.onCreateNew } });
  }
  return emptyState({ icon: '🌱', title: 'هنوز چیزی ثبت نکرده‌اید', message: 'اولین دروغی که به خودتان می‌گویید را بنویسید.', action: { label: 'ثبت اولین دروغ', icon: '＋', onClick: state.onCreateNew } });
}

function renderError(message, onRetry) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا در بارگذاری'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [message] }));
  const btn = el('button', { class: 'btn btn--primary' }, { children: ['تلاش دوباره'] });
  btn.addEventListener('click', onRetry);
  box.appendChild(btn);
  return box;
}

export default { renderLiesList };