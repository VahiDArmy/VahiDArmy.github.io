/**
 * Theories list page — search, filter by status/tag/person, sort, pagination,
 * inline voting, create button, right-click context menu.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES, THEORY_STATUS_LABELS, DEFAULT_PAGE_SIZE } from '../config/constants.js';
import { theoriesService } from '../services/theories.service.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createListToolbar } from '../components/list-toolbar.js';
import { createPagination } from '../components/pagination.js';
import { createTheoryCard } from '../components/theory-card.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { openContextMenu } from '../ui/context-menu.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { getQueryParam, setQuery } from '../utils/url.js';
import { requireAuthOrRedirect, canEditContent } from '../components/auth-guard.js';
import { formatNumber } from '../utils/format.js';

export default async function theoriesPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const state = {
    search: getQueryParam('q', ''),
    status: getQueryParam('status', 'published'),
    tag: getQueryParam('tag', ''),
    personId: getQueryParam('person', ''),
    sort: getQueryParam('sort', 'created_at'),
    direction: getQueryParam('dir', 'desc'),
    page: parseInt(getQueryParam('page', '1'), 10) || 1,
    pageSize: parseInt(getQueryParam('size', String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE,
    compact: getQueryParam('compact', '0') === '1',
    items: [],
    total: 0,
  };

  outlet.innerHTML = '';
  const page = el(
    'div',
    { class: `container theories-page${state.compact ? ' is-compact' : ''}` }
  );
  outlet.appendChild(page);

  const headerActions = [];
  if (appStore.get('user')) {
    headerActions.push(
      el(
        'a',
        { class: 'btn btn--primary', href: router.href('/theories/new') },
        [icon('plus'), 'نظریه جدید']
      )
    );
  }

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'نظریه‌ها',
      subtitle: 'اینجا می‌توانید هر بگایی که در اداره بوده را با جزئیاتش ثبت کنید.',
      actions: headerActions,
    })
  );

  // Toolbar
  const toolbar = createListToolbar({
    searchPlaceholder: 'جستجو در عنوان یا خلاصه...',
    searchValue: state.search,
    onSearch: (v) => { state.search = v; state.page = 1; persist(); load(); },
    filters: [
      {
        type: 'select',
        key: 'status',
        label: 'وضعیت',
        value: state.status,
        options: [
          { value: 'all', label: 'همه' },
          ...Object.entries(THEORY_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
        ],
      },
    ],
    sort: {
      value: state.sort,
      direction: state.direction,
      options: [
        { value: 'created_at', label: 'جدیدترین' },
        { value: 'score', label: 'بیشترین امتیاز' },
        { value: 'comments_count', label: 'بیشترین کامنت' },
        { value: 'title', label: 'عنوان' },
      ],
    },
    actions: [
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--ghost btn--icon btn--sm',
          'aria-label': 'نمای فشرده',
          title: 'نمای فشرده',
          on: {
            click: (e) => {
              state.compact = !state.compact;
              e.currentTarget.classList.toggle('is-active', state.compact);
              page.classList.toggle('is-compact', state.compact);
              persist();
            },
          },
        },
        [icon('list')]
      ),
    ],
    onFilterChange: (key, value) => {
      if (key === 'status') state.status = value;
      else if (key === 'sort') state.sort = value;
      else if (key === 'direction') state.direction = value;
      state.page = 1;
      persist();
      load();
    },
  });
  page.appendChild(toolbar.node);

  // Active filters (person / tag)
  const activeFilters = el('div', { class: 'filter-summary', hidden: true });
  page.appendChild(activeFilters);

  const listWrap = el('div', { id: 'theories-results' });
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
      status: state.status === 'published' ? null : state.status,
      tag: state.tag || null,
      person: state.personId || null,
      sort: state.sort === 'created_at' ? null : state.sort,
      dir: state.direction === 'desc' ? null : state.direction,
      page: state.page === 1 ? null : state.page,
      size: state.pageSize === DEFAULT_PAGE_SIZE ? null : state.pageSize,
      compact: state.compact ? '1' : null,
    });
  }

  function renderActiveFilters() {
    activeFilters.innerHTML = '';
    const chips = [];
    if (state.tag) {
      chips.push(
        el('span', { class: 'chip chip--brand' }, [
          `برچسب: ${state.tag}`,
          el(
            'button',
            {
              type: 'button',
              class: 'chip__close',
              'aria-label': 'حذف فیلتر',
              on: {
                click: () => {
                  state.tag = '';
                  persist();
                  renderActiveFilters();
                  load();
                },
              },
            },
            [icon('x')]
          ),
        ])
      );
    }
    if (state.personId) {
      chips.push(
        el('span', { class: 'chip chip--brand' }, [
          `فرد مرتبط`,
          el(
            'button',
            {
              type: 'button',
              class: 'chip__close',
              'aria-label': 'حذف فیلتر',
              on: {
                click: () => {
                  state.personId = '';
                  persist();
                  renderActiveFilters();
                  load();
                },
              },
            },
            [icon('x')]
          ),
        ])
      );
    }
    if (!chips.length) {
      activeFilters.hidden = true;
      return;
    }
    activeFilters.hidden = false;
    activeFilters.appendChild(el('span', { class: 'filter-summary__label' }, ['فیلترهای فعال:']));
    for (const c of chips) activeFilters.appendChild(c);
  }
  renderActiveFilters();

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonList({ count: 4, variant: 'row' }));

    try {
      const res = await theoriesService.list({
        search: state.search,
        status: state.status,
        tag: state.tag,
        personId: state.personId,
        sort: state.sort,
        direction: state.direction,
        limit: state.pageSize,
        offset: (state.page - 1) * state.pageSize,
      });
      state.items = res.items;
      state.total = res.total;
      renderResults();
      pagination.update({ total: state.total, page: state.page, pageSize: state.pageSize });
    } catch (err) {
      listWrap.innerHTML = '';
      listWrap.appendChild(
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'نظریه‌ها بارگذاری نشد.',
        })
      );
    }
  }

  async function renderResults() {
    listWrap.innerHTML = '';
    if (!state.items.length) {
      listWrap.appendChild(
        emptyState({
          iconName: 'lightbulb',
          title: 'نظریه‌ای پیدا نشد',
          description: state.search
            ? `نتیجه‌ای برای «${state.search}» نیست.`
            : 'اولین نظریه را شما بنویسید.',
          actions: appStore.get('user')
            ? [
                el(
                  'a',
                  { class: 'btn btn--primary', href: router.href('/theories/new') },
                  [icon('plus'), 'ایجاد نظریه']
                ),
              ]
            : [
                el(
                  'a',
                  { class: 'btn btn--primary', href: router.href(ROUTES.LOGIN) },
                  ['ورود برای ایجاد']
                ),
              ],
        })
      );
      return;
    }

    const list = el('div', { class: 'theory-list' });

    // Fetch my votes for all theories on this page
    const myVotes = new Map();
    if (appStore.get('user')) {
      const voteResults = await Promise.all(
        state.items.map((t) =>
          theoriesService
            .myVote(t.id)
            .then((v) => [t.id, v])
            .catch(() => [t.id, 0])
        )
      );
      for (const [id, v] of voteResults) myVotes.set(id, v);
    }

    for (const theory of state.items) {
      list.appendChild(
        createTheoryCard(theory, {
          myVote: myVotes.get(theory.id) || 0,
          onVote: handleVote,
          onContextMenu: (e, t) => openTheoryContext(e, t),
        })
      );
    }
    listWrap.appendChild(list);
  }

  async function handleVote(theory, value) {
    if (!appStore.get('user')) {
      toast.warning('برای رأی دادن وارد شوید.');
      router.navigate(ROUTES.LOGIN);
      return;
    }
    try {
      const updated = await theoriesService.vote(theory.id, value);
      theory.score = updated?.score ?? theory.score;
      toast.success('رأی شما ثبت شد.');
      // Re-fetch just this item on the page
      renderResults();
    } catch (err) {
      toast.error(err?.message || 'ثبت رأی ناموفق بود.');
    }
  }

  function openTheoryContext(e, theory) {
    e.preventDefault();
    e.stopPropagation();
    const user = appStore.get('user');
    const isAuthor = user && theory.author_id === user.id;
    const items = [
      {
        label: 'باز کردن',
        icon: 'eye',
        onClick: () => router.navigate(ROUTES.THEORY(theory.id)),
      },
      {
        label: 'کپی لینک',
        icon: 'link',
        onClick: () => {
          const url = window.location.origin + window.location.pathname + router.href(ROUTES.THEORY(theory.id));
          navigator.clipboard.writeText(url);
          toast.success('لینک کپی شد.');
        },
      },
    ];

    if (isAuthor || canEditContent()) {
      items.push({ divider: true });
      items.push({
        label: 'ویرایش',
        icon: 'edit',
        onClick: () => router.navigate(`/theories/${theory.id}/edit`),
      });
      items.push({
        label: 'حذف',
        icon: 'trash',
        danger: true,
        onClick: () =>
          confirmAndDelete({
            title: 'حذف نظریه',
            message: `«${theory.title}» حذف شود؟`,
            onConfirm: () => theoriesService.remove(theory.id),
            successMessage: 'نظریه حذف شد.',
            onDeleted: () => load(),
          }),
      });
    }

    openContextMenu(e.clientX, e.clientY, items);
  }

  await load();

  return () => {};
}