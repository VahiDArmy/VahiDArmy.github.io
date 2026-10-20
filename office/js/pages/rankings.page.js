/**
 * Rankings list page — search, pagination, create/edit/delete, context menu.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { rankingsService } from '../services/rankings.service.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createPagination } from '../components/pagination.js';
import { openRankingForm } from '../components/ranking-form.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { openContextMenu } from '../ui/context-menu.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { getQueryParam, setQuery } from '../utils/url.js';
import { canEditContent } from '../components/auth-guard.js';
import { formatNumber, formatDate } from '../utils/format.js';
import { debounce } from '../utils/debounce.js';

export default async function rankingsPage(info, outlet) {
  const state = {
    search: getQueryParam('q', ''),
    page: parseInt(getQueryParam('page', '1'), 10) || 1,
    pageSize: parseInt(getQueryParam('size', '12'), 10) || 12,
    items: [],
    total: 0,
  };

  outlet.innerHTML = '';
  const page = el('div', { class: 'container rankings-page' });
  outlet.appendChild(page);

  const headerActions = [];
  if (appStore.get('user')) {
    headerActions.push(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          on: { click: () => createRanking() },
        },
        [icon('plus'), 'رتبه‌بندی جدید']
      )
    );
  }

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'رتبه‌بندی‌ها',
      subtitle: 'فهرست‌های رتبه‌بندی سفارشی افراد بر اساس معیارهای مختلف.',
      actions: headerActions,
    })
  );

  // Search bar
  const searchInput = el('input', {
    type: 'search',
    class: 'input',
    placeholder: 'جستجو در عنوان رتبه‌بندی...',
    value: state.search,
  });
  const onSearch = debounce((v) => {
    state.search = v.trim();
    state.page = 1;
    persist();
    load();
  }, 300);
  searchInput.addEventListener('input', () => onSearch(searchInput.value));

  const toolbar = el('div', { class: 'toolbar' }, [
    el('div', { class: 'search toolbar__search' }, [
      el('span', { class: 'search__icon' }, [icon('search')]),
      searchInput,
    ]),
  ]);
  page.appendChild(toolbar);

  const listWrap = el('div', { id: 'rankings-results' });
  page.appendChild(listWrap);

  const pagination = createPagination({
    total: 0,
    page: state.page,
    pageSize: state.pageSize,
    onChange: ({ page: p, pageSize: s }) => {
      state.page = p;
      state.pageSize = s;
      persist();
      load();
    },
  });
  page.appendChild(pagination.node);

  function persist() {
    setQuery({
      q: state.search || null,
      page: state.page === 1 ? null : state.page,
      size: state.pageSize === 12 ? null : state.pageSize,
    });
  }

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonList({ count: 6 }));
    try {
      const res = await rankingsService.list({
        search: state.search,
        limit: state.pageSize,
        offset: (state.page - 1) * state.pageSize,
      });
      state.items = res.items;
      state.total = res.total;
      render();
      pagination.update({ total: state.total, page: state.page, pageSize: state.pageSize });
    } catch (err) {
      listWrap.innerHTML = '';
      listWrap.appendChild(
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'رتبه‌بندی‌ها بارگذاری نشد.',
        })
      );
    }
  }

  function render() {
    listWrap.innerHTML = '';
    if (!state.items.length) {
      listWrap.appendChild(
        emptyState({
          iconName: 'trophy',
          title: 'رتبه‌بندی‌ای پیدا نشد',
          description: state.search
            ? `نتیجه‌ای برای «${state.search}» نیست.`
            : 'اولین رتبه‌بندی را شما بسازید.',
          actions: appStore.get('user')
            ? [
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'btn btn--primary',
                    on: { click: () => createRanking() },
                  },
                  [icon('plus'), 'ایجاد رتبه‌بندی']
                ),
              ]
            : [
                el(
                  'a',
                  { class: 'btn btn--primary', href: router.href(ROUTES.LOGIN) },
                  ['ورود']
                ),
              ],
        })
      );
      return;
    }

    const grid = el('div', { class: 'rankings-grid' });
    for (const ranking of state.items) {
      grid.appendChild(buildCard(ranking));
    }
    listWrap.appendChild(grid);
  }

  function buildCard(ranking) {
    const card = el(
      'div',
      {
        class: 'ranking-card',
        role: 'link',
        tabindex: '0',
        dataset: { rankingId: ranking.id },
        on: {
          click: () => router.navigate(ROUTES.RANKING(ranking.id)),
          keydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              router.navigate(ROUTES.RANKING(ranking.id));
            }
          },
          contextmenu: (e) => openContext(e, ranking),
        },
      },
      [
        el('div', { class: 'ranking-card__head' }, [
          el('div', { class: 'ranking-card__icon' }, [icon('trophy')]),
          el('div', { style: { minWidth: 0, flex: '1 1 auto' } }, [
            el('div', { class: 'ranking-card__title' }, [ranking.title || 'بدون عنوان']),
            ranking.criteria
              ? el('div', { class: 'ranking-card__criteria' }, [ranking.criteria])
              : null,
          ]),
        ]),
        ranking.description
          ? el('div', { class: 'ranking-card__desc' }, [ranking.description])
          : null,
        el('div', { class: 'ranking-card__footer' }, [
          el('span', { class: 'ranking-card__count' }, [
            icon('users'),
            `${formatNumber(ranking.entries_count || 0)} عضو`,
          ]),
          ranking.created_at
            ? el('span', {}, [formatDate(ranking.created_at)])
            : null,
        ]),
      ]
    );
    return card;
  }

  function openContext(e, ranking) {
    e.preventDefault();
    e.stopPropagation();
    const isOwner = appStore.get('user')?.id === ranking.created_by;
    const items = [
      {
        label: 'باز کردن',
        icon: 'eye',
        onClick: () => router.navigate(ROUTES.RANKING(ranking.id)),
      },
      {
        label: 'کپی لینک',
        icon: 'link',
        onClick: () => {
          const url = window.location.origin + window.location.pathname + router.href(ROUTES.RANKING(ranking.id));
          navigator.clipboard.writeText(url);
          toast.success('لینک کپی شد.');
        },
      },
    ];
    if (isOwner || canEditContent()) {
      items.push({ divider: true });
      items.push({
        label: 'ویرایش',
        icon: 'edit',
        onClick: () => editRanking(ranking),
      });
      items.push({
        label: 'حذف',
        icon: 'trash',
        danger: true,
        onClick: () => deleteRanking(ranking),
      });
    }
    openContextMenu(e.clientX, e.clientY, items);
  }

  async function createRanking() {
    const values = await openRankingForm();
    if (!values) return;
    try {
      const created = await rankingsService.create(values);
      toast.success('رتبه‌بندی ایجاد شد.');
      router.navigate(ROUTES.RANKING(created.id));
    } catch (err) {
      toast.error(err?.message || 'ایجاد ناموفق بود.');
    }
  }

  async function editRanking(ranking) {
    const values = await openRankingForm({ ranking });
    if (!values) return;
    try {
      await rankingsService.update(ranking.id, values);
      toast.success('رتبه‌بندی به‌روز شد.');
      load();
    } catch (err) {
      toast.error(err?.message || 'ویرایش ناموفق بود.');
    }
  }

  async function deleteRanking(ranking) {
    await confirmAndDelete({
      title: 'حذف رتبه‌بندی',
      message: `«${ranking.title}» حذف شود؟ این عمل بازگشت‌پذیر نیست.`,
      onConfirm: () => rankingsService.remove(ranking.id),
      successMessage: 'رتبه‌بندی حذف شد.',
      onDeleted: () => load(),
    });
  }

  await load();

  return () => {};
}