/**
 * Tables list page — search, pagination, create/edit/delete.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { tablesService } from '../services/tables.service.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createPagination } from '../components/pagination.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { openContextMenu } from '../ui/context-menu.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { getQueryParam, setQuery } from '../utils/url.js';
import { canEditContent } from '../components/auth-guard.js';
import { formatNumber, formatDate, slugify } from '../utils/format.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { debounce } from '../utils/debounce.js';

export default async function tablesPage(info, outlet) {
  const state = {
    search: getQueryParam('q', ''),
    page: parseInt(getQueryParam('page', '1'), 10) || 1,
    pageSize: parseInt(getQueryParam('size', '12'), 10) || 12,
    items: [],
    total: 0,
  };

  outlet.innerHTML = '';
  const page = el('div', { class: 'container tables-page' });
  outlet.appendChild(page);

  const headerActions = [];
  if (appStore.get('user')) {
    headerActions.push(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          on: { click: () => createTable() },
        },
        [icon('plus'), 'جدول جدید']
      )
    );
  }

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'جدول‌ها',
      subtitle: 'جدول‌های داده سفارشی با ستون‌های دلخواه.',
      actions: headerActions,
    })
  );

  // Search
  const searchInput = el('input', {
    type: 'search',
    class: 'input',
    placeholder: 'جستجو در نام جدول...',
    value: state.search,
  });
  const onSearch = debounce((v) => {
    state.search = v.trim();
    state.page = 1;
    persist();
    load();
  }, 300);
  searchInput.addEventListener('input', () => onSearch(searchInput.value));

  page.appendChild(
    el('div', { class: 'toolbar' }, [
      el('div', { class: 'search toolbar__search' }, [
        el('span', { class: 'search__icon' }, [icon('search')]),
        searchInput,
      ]),
    ])
  );

  const listWrap = el('div');
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
      const res = await tablesService.list({
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
          description: err?.message || 'جدول‌ها بارگذاری نشد.',
        })
      );
    }
  }

  function render() {
    listWrap.innerHTML = '';
    if (!state.items.length) {
      listWrap.appendChild(
        emptyState({
          iconName: 'table',
          title: 'جدولی پیدا نشد',
          description: state.search
            ? `نتیجه‌ای برای «${state.search}» نیست.`
            : 'اولین جدول خود را بسازید.',
          actions: appStore.get('user')
            ? [
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'btn btn--primary',
                    on: { click: () => createTable() },
                  },
                  [icon('plus'), 'ایجاد جدول']
                ),
              ]
            : [
                el('a', { class: 'btn btn--primary', href: router.href(ROUTES.LOGIN) }, ['ورود']),
              ],
        })
      );
      return;
    }

    const grid = el('div', { class: 'tables-grid' });
    for (const table of state.items) {
      grid.appendChild(buildCard(table));
    }
    listWrap.appendChild(grid);
  }

  function buildCard(table) {
    return el(
      'div',
      {
        class: 'table-card',
        role: 'link',
        tabindex: '0',
        dataset: { tableId: table.id },
        on: {
          click: () => router.navigate(ROUTES.TABLE(table.id)),
          keydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              router.navigate(ROUTES.TABLE(table.id));
            }
          },
          contextmenu: (e) => openContext(e, table),
        },
      },
      [
        el('div', { class: 'table-card__head' }, [
          el('div', { class: 'table-card__icon' }, [icon('table')]),
          el('div', { class: 'table-card__title' }, [table.name || 'بدون نام']),
        ]),
        table.description
          ? el('div', { class: 'table-card__desc' }, [table.description])
          : null,
        el('div', { class: 'table-card__footer' }, [
          el('span', { class: 'table-card__stat' }, [
            icon('grid'),
            `${formatNumber(table.columns_count || 0)} ستون`,
          ]),
          el('span', { class: 'table-card__stat' }, [
            icon('list'),
            `${formatNumber(table.rows_count || 0)} ردیف`,
          ]),
          table.updated_at
            ? el('span', { style: { marginInlineStart: 'auto' } }, [formatDate(table.updated_at)])
            : null,
        ]),
      ]
    );
  }

  function openContext(e, table) {
    e.preventDefault();
    e.stopPropagation();
    const isOwner = appStore.get('user')?.id === table.created_by;
    const items = [
      {
        label: 'باز کردن',
        icon: 'eye',
        onClick: () => router.navigate(ROUTES.TABLE(table.id)),
      },
      {
        label: 'کپی لینک',
        icon: 'link',
        onClick: () => {
          const url = window.location.origin + window.location.pathname + router.href(ROUTES.TABLE(table.id));
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
        onClick: () => editTable(table),
      });
      items.push({
        label: 'حذف',
        icon: 'trash',
        danger: true,
        onClick: () => deleteTable(table),
      });
    }
    openContextMenu(e.clientX, e.clientY, items);
  }

  async function createTable() {
    const values = await openTableForm();
    if (!values) return;
    try {
      const created = await tablesService.create(values);
      toast.success('جدول ایجاد شد.');
      router.navigate(ROUTES.TABLE(created.id));
    } catch (err) {
      toast.error(err?.message || 'ایجاد ناموفق بود.');
    }
  }

  async function editTable(table) {
    const values = await openTableForm({ table });
    if (!values) return;
    try {
      await tablesService.update(table.id, values);
      toast.success('جدول به‌روز شد.');
      load();
    } catch (err) {
      toast.error(err?.message || 'ویرایش ناموفق بود.');
    }
  }

  async function deleteTable(table) {
    await confirmAndDelete({
      title: 'حذف جدول',
      message: `«${table.name}» و همه ردیف‌های آن حذف شوند؟`,
      onConfirm: () => tablesService.remove(table.id),
      successMessage: 'جدول حذف شد.',
      onDeleted: () => load(),
    });
  }

  await load();

  return () => {};
}

function openTableForm({ table = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!table;

    const nameInput = el('input', {
      type: 'text',
      class: 'input',
      value: table?.name || '',
      placeholder: 'مثلاً: بودجه پروژه‌ها',
      maxlength: 120,
    });
    const descInput = el('textarea', {
      class: 'textarea',
      rows: 3,
      placeholder: 'توضیح کوتاه درباره کاربرد این جدول...',
      maxlength: 500,
    });
    descInput.value = table?.description || '';

    const slugInput = el('input', {
      type: 'text',
      class: 'input',
      dir: 'ltr',
      value: table?.slug || '',
      placeholder: 'auto-generated',
    });

    const submitBtn = el(
      'button',
      { type: 'submit', class: 'btn btn--primary' },
      [isEdit ? 'ذخیره' : 'ایجاد']
    );

    const cancelBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary',
        on: { click: () => { handle.close(); resolve(null); } },
      },
      ['انصراف']
    );

    const form = el('form', { class: 'form-grid' }, [
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['نام جدول ', el('span', { class: 'required' }, ['*'])]),
        nameInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['توضیحات']),
        descInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['شناسه (slug)']),
        slugInput,
      ]),
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        slug: slugInput.value.trim() || slugify(nameInput.value),
      };
      const errors = validate(values, {
        name: [rules.required('نام الزامی است'), rules.maxLength(120)],
      });
      if (hasErrors(errors)) {
        toast.error(Object.values(errors)[0]);
        return;
      }
      submitBtn.classList.add('is-loading');
      handle.close();
      resolve(values);
    });

    const handle = openModal({
      title: isEdit ? 'ویرایش جدول' : 'جدول جدید',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: nameInput,
      onClose: () => resolve(null),
    });
  });
}