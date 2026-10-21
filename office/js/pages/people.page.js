/**
 * People list page
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES, PEOPLE_STATUS_LABELS, DEFAULT_PAGE_SIZE } from '../config/constants.js';
import { peopleService } from '../services/people.service.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createListToolbar } from '../components/list-toolbar.js';
import { createPagination } from '../components/pagination.js';
import { createPersonCard } from '../components/person-card.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { openContextMenu } from '../ui/context-menu.js';
import { openPersonForm } from '../components/person-form.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { getQueryParam, setQuery } from '../utils/url.js';
import { requireAuthOrRedirect, canEditContent } from '../components/auth-guard.js';
import { formatNumber } from '../utils/format.js';

export default async function peoplePage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const state = {
    search: getQueryParam('q', ''),
    status: getQueryParam('status', 'all'),
    department: getQueryParam('dept', ''),
    sort: getQueryParam('sort', 'full_name'),
    direction: getQueryParam('dir', 'asc'),
    page: parseInt(getQueryParam('page', '1'), 10) || 1,
    pageSize: parseInt(getQueryParam('size', String(DEFAULT_PAGE_SIZE)), 10) || DEFAULT_PAGE_SIZE,
    view: getQueryParam('view', 'grid'),
    selected: new Set(),
    items: [],
    total: 0,
  };

  outlet.innerHTML = '';
  const page = el('div', { class: `container people-page${state.view === 'list' ? ' is-list-view' : ''}` });
  outlet.appendChild(page);

  const headerActions = [];
  if (canEditContent()) {
    headerActions.push(
      el(
        'button',
        { 
          class: 'btn btn--primary', 
          onClick: async () => {
            const created = await openPersonForm();
            if (created) load();
          }
        },
        [icon('plus'), 'افزودن فرد']
      )
    );
  }

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'افراد اداره',
      subtitle: 'همه همکاران — در سایت و خارج از سایت — با اطلاعات کامل.',
      actions: headerActions,
    })
  );

  // View toggle
  const viewToggle = el('div', { class: 'view-toggle', role: 'group', 'aria-label': 'حالت نمایش' }, [
    el('button', { type: 'button', class: `view-toggle__btn${state.view === 'grid' ? ' is-active' : ''}`, 'aria-label': 'نمای کارت', on: { click: () => setView('grid') } }, [icon('grid')]),
    el('button', { type: 'button', class: `view-toggle__btn${state.view === 'list' ? ' is-active' : ''}`, 'aria-label': 'نمای فهرست', on: { click: () => setView('list') } }, [icon('list')]),
  ]);

  // Toolbar
  const toolbar = createListToolbar({
    searchPlaceholder: 'جستجو در نام، سمت یا ایمیل...',
    searchValue: state.search,
    onSearch: (v) => { state.search = v; state.page = 1; persist(); load(); },
    filters: [
      {
        type: 'select',
        key: 'status',
        label: 'وضعیت',
        value: state.status,
        options: [{ value: 'all', label: 'همه وضعیت‌ها' }, ...Object.entries(PEOPLE_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))],
      },
      {
        type: 'select',
        key: 'dept',
        label: 'دپارتمان',
        value: state.department,
        options: [{ value: '', label: 'همه دپارتمان‌ها' }],
      },
    ],
    sort: {
      value: state.sort,
      direction: state.direction,
      options: [
        { value: 'full_name', label: 'نام' },
        { value: 'created_at', label: 'جدیدترین' },
        { value: 'hire_date', label: 'تاریخ استخدام' },
      ],
    },
    actions: [viewToggle],
    onFilterChange: (key, value) => {
      if (key === 'status') state.status = value;
      else if (key === 'dept') state.department = value;
      else if (key === 'sort') state.sort = value;
      else if (key === 'direction') state.direction = value;
      state.page = 1;
      persist();
      load();
    },
  });
  page.appendChild(toolbar.node);

  // Bulk bar
  const bulkBar = el('div', { class: 'bulk-bar', hidden: true });
  page.appendChild(bulkBar);

  // Grid
  const gridWrap = el('div', { id: 'people-results' });
  page.appendChild(gridWrap);

  // Pagination
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

  function setView(v) {
    state.view = v;
    page.classList.toggle('is-list-view', v === 'list');
    viewToggle.querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('is-active', (i === 0 && v === 'grid') || (i === 1 && v === 'list'));
    });
    persist();
    renderResults();
  }

  function persist() {
    setQuery({
      q: state.search || null,
      status: state.status === 'all' ? null : state.status,
      dept: state.department || null,
      sort: state.sort === 'full_name' ? null : state.sort,
      dir: state.direction === 'asc' ? null : state.direction,
      page: state.page === 1 ? null : state.page,
      size: state.pageSize === DEFAULT_PAGE_SIZE ? null : state.pageSize,
      view: state.view === 'grid' ? null : state.view,
    });
  }

  async function load() {
    gridWrap.innerHTML = '';
    gridWrap.appendChild(skeletonList({ count: state.pageSize > 8 ? 8 : state.pageSize }));

    try {
      const res = await peopleService.list({
        search: state.search,
        status: state.status,
        department: state.department,
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
      gridWrap.innerHTML = '';
      gridWrap.appendChild(
        emptyState({
          iconName: 'alert-circle',
          title: 'بارگذاری ناموفق',
          description: err?.message || 'خطا در دریافت اطلاعات افراد.',
        })
      );
    }
  }

  function renderResults() {
    gridWrap.innerHTML = '';
    if (!state.items.length) {
      gridWrap.appendChild(
        emptyState({
          iconName: 'users',
          title: 'فردی پیدا نشد',
          description: state.search
            ? `هیچ نتیجه‌ای برای «${state.search}» وجود ندارد.`
            : 'هنوز فردی به بایگانی اضافه نشده است.',
          actions: canEditContent()
            ? [
                el(
                  'button',
                  { class: 'btn btn--primary', onClick: async () => {
                    const created = await openPersonForm();
                    if (created) load();
                  } },
                  [icon('plus'), 'افزودن اولین فرد']
                ),
              ]
            : null,
        })
      );
      return;
    }

    const grid = el('div', { class: 'people-grid' });
    for (const person of state.items) {
      grid.appendChild(
        createPersonCard(person, {
          selected: state.selected.has(person.id),
          bulkMode: state.selected.size > 0,
          onToggleSelect: (p) => toggleSelect(p),
          onContextMenu: (e, p) => openPersonContext(e, p),
        })
      );
    }
    gridWrap.appendChild(grid);
  }

  function toggleSelect(person) {
    if (state.selected.has(person.id)) state.selected.delete(person.id);
    else state.selected.add(person.id);
    renderBulkBar();
    renderResults();
  }

  function renderBulkBar() {
    bulkBar.innerHTML = '';
    if (!state.selected.size) {
      bulkBar.hidden = true;
      return;
    }
    bulkBar.hidden = false;
    bulkBar.appendChild(el('span', { class: 'bulk-bar__count' }, [`${formatNumber(state.selected.size)} انتخاب شده`]));
    bulkBar.appendChild(el('button', { type: 'button', class: 'btn', on: { click: () => { state.selected.clear(); renderBulkBar(); renderResults(); } } }, [icon('x'), 'لغو انتخاب']));
    if (canEditContent()) {
      bulkBar.appendChild(el('button', { type: 'button', class: 'btn btn--danger', on: { click: bulkDelete } }, [icon('trash'), 'حذف']));
    }
  }

  async function bulkDelete() {
    const ids = Array.from(state.selected);
    const count = ids.length;
    const ok = await confirmAndDelete({
      title: 'حذف افراد',
      message: `آیا ${formatNumber(count)} فرد انتخاب‌شده حذف شوند؟ این عمل بازگشت‌پذیر نیست.`,
      onConfirm: async () => { await Promise.all(ids.map((id) => peopleService.remove(id))); },
      successMessage: `${formatNumber(count)} فرد حذف شد.`,
      onDeleted: () => { state.selected.clear(); renderBulkBar(); load(); },
    });
    return ok;
  }

  function openPersonContext(e, person) {
    e.preventDefault();
    e.stopPropagation();
    const items = [
      { label: 'مشاهده', icon: 'eye', onClick: () => router.navigate(ROUTES.PERSON(person.id)) },
      { label: 'انتخاب', icon: 'check', onClick: () => toggleSelect(person) },
      { label: 'کپی ایمیل', icon: 'copy', onClick: () => {
          if (person.email) {
            navigator.clipboard.writeText(person.email);
            toast.success('ایمیل کپی شد.');
          } else {
            toast.warning('ایمیلی ثبت نشده است.');
          }
        } },
    ];

    if (canEditContent()) {
      items.push({ divider: true });
      items.push({
        label: 'ویرایش',
        icon: 'edit',
        onClick: async () => {
          const updated = await openPersonForm({ person });
          if (updated) load();
        },
      });
      items.push({
        label: 'حذف',
        icon: 'trash',
        danger: true,
        onClick: () =>
          confirmAndDelete({
            title: 'حذف فرد',
            message: `«${person.full_name}» حذف شود؟`,
            onConfirm: () => peopleService.remove(person.id),
            successMessage: 'فرد حذف شد.',
            onDeleted: () => load(),
          }),
      });
    }

    openContextMenu(e.clientX, e.clientY, items);
  }

  peopleService.departments().then((depts) => {
    const allSelects = toolbar.node.querySelectorAll('select');
    const deptSelect = allSelects[1];
    if (!deptSelect) return;
    for (const d of depts) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (d === state.department) opt.selected = true;
      deptSelect.appendChild(opt);
    }
  }).catch(() => {});

  await load();
  return () => { state.selected.clear(); };
}