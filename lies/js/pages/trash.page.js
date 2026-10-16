/* ============================================================
   js/pages/trash.page.js
   Trash with restore, purge, and auto-purge setting
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as liesService from '../services/lies.service.js';
import * as categoriesService from '../services/categories.service.js';
import { lieRow } from '../features/lies/lie-row.js';
import { toast } from '../ui/toast.js';
import { confirm, confirmDanger } from '../ui/confirm.js';
import { emptyState } from '../ui/empty-state.js';
import { skeletonPage } from '../ui/skeleton.js';
import { badge } from '../ui/badges.js';
import { toFaDigits } from '../utils/format.js';

let _state = { items: [], categories: [], selection: new Set(), total: 0 };

/**
 * @param {HTMLElement} container
 */
export async function renderTrash(container) {
  container.appendChild(skeletonPage({ variant: 'list' }));

  const reload = async () => {
    const [res, cats] = await Promise.all([
      liesService.list({ status: 'trashed', page: 1, pageSize: 200, sort: 'updated_desc' }),
      categoriesService.list().catch(() => []),
    ]);
    _state.items = res.items;
    _state.total = res.total;
    _state.categories = cats;
  };

  try { await reload(); }
  catch (err) { clear(container); container.appendChild(renderError(err)); return; }

  clear(container);

  const page = el('div', { class: 'page page--trash' });

  // Header
  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['🗑️'] }), 'سطل زباله'],
  }));
  headLeft.appendChild(el('p', { class: 'page-subtitle' }, {
    children: ['موردهای حذف‌شده به‌طور موقت اینجا نگه داشته می‌شوند. پس از ۳۰ روز به‌طور خودکار پاک می‌شوند.'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  // Toolbar
  const toolbar = el('div', { class: 'toolbar' });
  toolbar.appendChild(badge({
    label: `${toFaDigits(_state.total)} مورد`,
    variant: _state.total > 0 ? 'danger' : 'muted',
    pill: true,
  }));
  toolbar.appendChild(el('span', { class: 'toolbar__spacer' }));

  if (_state.total > 0) {
    const restoreAllBtn = el('button', {
      class: 'btn btn--ghost btn--sm',
      attrs: { type: 'button' },
    }, { children: ['↺ بازگردانی همه'] });
    restoreAllBtn.addEventListener('click', async () => {
      const ok = await confirm({
        title: 'بازگردانی همه',
        message: 'همهٔ موارد سطل زباله بازگردانی شوند؟',
        confirmLabel: 'بازگردانی',
      });
      if (!ok) return;
      try {
        await liesService.bulk(_state.items.map((it) => it.id), 'restore');
        toast.success('همه بازگردانی شدند.');
        await reload(); renderPage();
      } catch (err) { toast.error(err.message); }
    });
    toolbar.appendChild(restoreAllBtn);

    const purgeBtn = el('button', {
      class: 'btn btn--danger btn--sm',
      attrs: { type: 'button' },
    }, { children: ['🗑️ حذف قطعی همه'] });
    purgeBtn.addEventListener('click', async () => {
      const ok = await confirmDanger({
        title: 'حذف قطعی همه',
        message: `همهٔ ${toFaDigits(_state.total)} مورد برای همیشه حذف شوند؟`,
        phrase: 'حذف',
      });
      if (!ok) return;
      try {
        await liesService.bulk(_state.items.map((it) => it.id), 'hardDelete');
        toast.success('همه حذف شدند.');
        await reload(); renderPage();
      } catch (err) { toast.error(err.message); }
    });
    toolbar.appendChild(purgeBtn);
  }
  page.appendChild(toolbar);

  // Content
  const contentHost = el('div', { class: 'trash-content' });
  page.appendChild(contentHost);

  const renderPage = () => {
    clear(contentHost);

    if (!_state.items.length) {
      contentHost.appendChild(emptyState({
        icon: '✨',
        title: 'سطل زباله خالی است',
        message: 'هیچ دروغ حذف‌شده‌ای وجود ندارد. جای خوبی هستی.',
        action: { label: 'بازگشت به دروغ‌ها', variant: 'outline', onClick: () => { location.hash = '#/lies'; } },
      }));
    } else {
      const list = el('div', { class: 'lies-list' });
      const getCategory = (id) => _state.categories.find((c) => c.id === id);
      for (const lie of _state.items) {
        const row = lieRow(lie, {
          variant: 'list',
          onOpen: () => { location.hash = `#/lie/${lie.id}`; },
          onToggleSelect: () => {},
          onContextMenu: (ev, l) => buildTrashMenu(ev, l, reload, renderPage),
          getCategory,
        });
        list.appendChild(row);
      }
      contentHost.appendChild(list);
    }
  };

  renderPage();
  container.appendChild(page);
}

function buildTrashMenu(ev, lie, reload, rerender) {
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
      label: 'حذف قطعی',
      icon: '✕',
      danger: true,
      action: async () => {
        const ok = await confirmDanger({
          title: 'حذف قطعی',
          message: `«${lie.title}» برای همیشه حذف شود؟`,
          phrase: 'حذف',
        });
        if (!ok) return;
        try {
          await liesService.hardDelete(lie.id);
          toast.success('حذف شد.');
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

export default { renderTrash };