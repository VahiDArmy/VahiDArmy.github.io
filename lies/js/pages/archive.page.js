/* ============================================================
   js/pages/archive.page.js
   View of archived lies with restore/delete actions
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as liesService from '../services/lies.service.js';
import * as categoriesService from '../services/categories.service.js';
import { lieRow } from '../features/lies/lie-row.js';
import { toast } from '../ui/toast.js';
import { confirm, confirmDanger } from '../ui/confirm.js';
import { emptyState } from '../ui/empty-state.js';
import { skeletonPage } from '../ui/skeleton.js';
import { pagination } from '../ui/pagination.js';
import { badge } from '../ui/badges.js';
import { toFaDigits, formatRelative } from '../utils/format.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

let _state = {
  page: 1,
  pageSize: 24,
  total: 0,
  items: [],
  categories: [],
  selection: new Set(),
};

/**
 * @param {HTMLElement} container
 */
export async function renderArchive(container) {
  container.appendChild(skeletonPage({ variant: 'list' }));

  const reload = async () => {
    const [res, cats] = await Promise.all([
      liesService.list({ status: 'archived', page: _state.page, pageSize: _state.pageSize, sort: 'updated_desc' }),
      categoriesService.list().catch(() => []),
    ]);
    _state.items = res.items;
    _state.total = res.total;
    _state.categories = cats;
  };

  try { await reload(); }
  catch (err) { clear(container); container.appendChild(renderError(err)); return; }

  clear(container);

  const page = el('div', { class: 'page page--archive' });

  // Header
  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['📦'] }), 'بایگانی'],
  }));
  headLeft.appendChild(el('p', { class: 'page-subtitle' }, {
    children: ['دروغ‌هایی که کنار گذاشته‌ای. می‌توانی هر زمان بازگردانی یا حذف کنی.'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  // Toolbar
  const toolbar = el('div', { class: 'toolbar' });
  toolbar.appendChild(badge({
    label: `${toFaDigits(_state.total)} مورد بایگانی‌شده`,
    variant: 'muted',
    pill: true,
  }));
  toolbar.appendChild(el('span', { class: 'toolbar__spacer' }));

  if (_state.total > 0) {
    const purgeBtn = el('button', {
      class: 'btn btn--ghost btn--sm',
      attrs: { type: 'button', title: 'پاک کردن همهٔ بایگانی' },
    }, { children: ['🗑️ پاک کردن همه'] });
    purgeBtn.addEventListener('click', async () => {
      const ok = await confirmDanger({
        title: 'پاک کردن بایگانی',
        message: `همهٔ ${toFaDigits(_state.total)} مورد بایگانی‌شده به سطل زباله منتقل شوند؟`,
        phrase: 'پاک',
      });
      if (!ok) return;
      try {
        const ids = _state.items.map((it) => it.id);
        await liesService.bulk(ids, 'trash');
        toast.success('به سطل زباله منتقل شد.');
        await reload();
        renderPage();
      } catch (err) { toast.error(err.message); }
    });
    toolbar.appendChild(purgeBtn);
  }
  page.appendChild(toolbar);

  // Content host
  const contentHost = el('div', { class: 'archive-content' });
  page.appendChild(contentHost);

  // Pagination host
  const paginationHost = el('div', { class: 'lies-pagination-host' });
  page.appendChild(paginationHost);

  const renderPage = () => {
    clear(contentHost);

    if (!_state.items.length) {
      contentHost.appendChild(emptyState({
        icon: '📦',
        title: 'بایگانی خالی است',
        message: 'هر وقت خواستی دروغی را کنار بگذاری، از منوی راست‌کلیک گزینهٔ «بایگانی» را انتخاب کن.',
        action: { label: 'بازگشت به دروغ‌ها', variant: 'outline', onClick: () => { location.hash = '#/lies'; } },
      }));
    } else {
      const list = el('div', { class: 'lies-list' });
      const getCategory = (id) => _state.categories.find((c) => c.id === id);
      for (const lie of _state.items) {
        const row = lieRow(lie, {
          variant: 'list',
          selected: _state.selection.has(lie.id),
          onOpen: () => { location.hash = `#/lie/${lie.id}`; },
          onToggleSelect: (id, opts) => {
            if (opts.mode === 'single') _state.selection = new Set([id]);
            else if (_state.selection.has(id)) _state.selection.delete(id);
            else _state.selection.add(id);
            renderPage();
          },
          onContextMenu: (ev, l) => buildArchiveMenu(ev, l, reload, renderPage),
          getCategory,
        });
        list.appendChild(row);
      }
      contentHost.appendChild(list);
    }

    clear(paginationHost);
    if (_state.total > _state.pageSize) {
      paginationHost.appendChild(pagination({
        page: _state.page,
        pageSize: _state.pageSize,
        total: _state.total,
        onChange: async (p) => { _state.page = p; await reload(); renderPage(); },
        showPageSize: false,
      }));
    }
  };

  renderPage();
  container.appendChild(page);
}

function buildArchiveMenu(ev, lie, reload, rerender) {
  return [
    {
      label: 'بازگردانی',
      icon: '↺',
      action: async () => {
        try {
          await liesService.restore(lie.id);
          toast.success('بازگردانی شد.');
          await reload(); rerender();
        } catch (err) { toast.error(err.message); }
      },
    },
    {
      label: 'باز کردن',
      icon: '↗',
      action: () => { location.hash = `#/lie/${lie.id}`; },
    },
    { divider: true },
    {
      label: 'انتقال به سطل زباله',
      icon: '🗑️',
      danger: true,
      action: async () => {
        try {
          await liesService.trash(lie.id);
          toast.success('به سطل زباله رفت.');
          await reload(); rerender();
        } catch (err) { toast.error(err.message); }
      },
    },
  ];
}

function renderError(err) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [err?.message || 'خطای نامشخص'] }));
  return box;
}

export default { renderArchive };