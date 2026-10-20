/**
 * Tell-alls list page.
 * Shows subjects and allows creating new ones.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES, DEFAULT_PAGE_SIZE } from '../config/constants.js';
import { tellallsService } from '../services/tellalls.service.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createPagination } from '../components/pagination.js';
import { confirmAndDelete } from '../components/confirm-delete.js';
import { open as openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { getQueryParam, setQuery } from '../utils/url.js';
import { formatNumber, formatDate } from '../utils/format.js';
import { validate, rules, hasErrors } from '../utils/validators.js';
import { debounce } from '../utils/debounce.js';

export default async function tellallsPage(info, outlet) {
  const state = {
    search: getQueryParam('q', ''),
    page: parseInt(getQueryParam('page', '1'), 10) || 1,
    pageSize: DEFAULT_PAGE_SIZE,
    items: [],
    total: 0,
  };

  outlet.innerHTML = '';
  const page = el('div', { class: 'container tellalls-page' });
  outlet.appendChild(page);

  const headerActions = [];
  if (appStore.get('user')) {
    headerActions.push(
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          on: { click: () => createTellall() },
        },
        [icon('plus'), 'موضوع جدید']
      )
    );
  }

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'بگایی‌های داده شده',
      subtitle: 'اینجا می‌توانید هر موضوعی که در اداره شنیده‌اید را با جزئیاتش ثبت کنید.',
      actions: headerActions,
    })
  );

  // Search
  const searchInput = el('input', {
    type: 'search',
    class: 'input',
    placeholder: 'جستجو در عنوان موضوعات...',
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
    });
  }

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonList({ count: 4, variant: 'row' }));
    try {
      const res = await tellallsService.list({
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
          description: err?.message || 'موضوعات بارگذاری نشد.',
        })
      );
    }
  }

  function render() {
    listWrap.innerHTML = '';
    if (!state.items.length) {
      listWrap.appendChild(
        emptyState({
          iconName: 'message',
          title: 'موضوعی ثبت نشده',
          description: state.search
            ? `نتیجه‌ای برای «${state.search}» نیست.`
            : 'اولین موضوع بگایی را شما شروع کنید.',
          actions: appStore.get('user')
            ? [
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'btn btn--primary',
                    on: { click: () => createTellall() },
                  },
                  [icon('plus'), 'موضوع جدید']
                ),
              ]
            : null,
        })
      );
      return;
    }

    const grid = el('div', { class: 'tellalls-grid' });
    for (const item of state.items) {
      grid.appendChild(buildCard(item));
    }
    listWrap.appendChild(grid);
  }

  function buildCard(item) {
    return el(
      'div',
      {
        class: 'tellall-card',
        role: 'link',
        tabindex: '0',
        on: {
          click: () => router.navigate(ROUTES.TELLALL(item.id)),
          keydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              router.navigate(ROUTES.TELLALL(item.id));
            }
          },
        },
      },
      [
        el('div', { class: 'tellall-card__head' }, [
          el('div', { class: 'tellall-card__icon' }, [icon('message')]),
          el('div', { class: 'tellall-card__title' }, [item.title]),
        ]),
        item.description ? el('div', { class: 'tellall-card__desc' }, [item.description]) : null,
        el('div', { class: 'tellall-card__footer' }, [
          el('span', { class: 'tellall-card__stat' }, [
            icon('list'),
            `${formatNumber(item.entries_count || 0)} بگایی`,
          ]),
          item.created_at ? el('span', {}, [formatDate(item.created_at)]) : null,
        ]),
      ]
    );
  }

  async function createTellall() {
    const values = await openTellallForm();
    if (!values) return;
    try {
      const created = await tellallsService.create(values);
      toast.success('موضوع ایجاد شد.');
      router.navigate(ROUTES.TELLALL(created.id));
    } catch (err) {
      toast.error(err?.message || 'ایجاد ناموفق بود.');
    }
  }

  await load();
  return () => {};
}

/* ---- Create/Edit Dialog ---- */
function openTellallForm({ tellall = null } = {}) {
  return new Promise((resolve) => {
    const isEdit = !!tellall;

    const titleInput = el('input', {
      type: 'text',
      class: 'input',
      value: tellall?.title || '',
      placeholder: 'مثلاً: ماجرای دستگاه قهوه‌ساز',
      maxlength: 150,
    });
    const descInput = el('textarea', {
      class: 'textarea',
      rows: 3,
      placeholder: 'توضیح کوتاه درباره این موضوع (اختیاری)',
      maxlength: 500,
    });
    descInput.value = tellall?.description || '';

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
        el('label', { class: 'form-label' }, ['عنوان موضوع ', el('span', { class: 'required' }, ['*'])]),
        titleInput,
      ]),
      el('div', { class: 'form-field' }, [
        el('label', { class: 'form-label' }, ['توضیحات']),
        descInput,
      ]),
    ]);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = {
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
      };
      const errors = validate(values, {
        title: [rules.required('عنوان الزامی است'), rules.maxLength(150)],
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
      title: isEdit ? 'ویرایش موضوع' : 'موضوع جدید',
      body: form,
      footer: el('div', { style: { display: 'flex', gap: '8px' } }, [cancelBtn, submitBtn]),
      size: 'md',
      initialFocus: titleInput,
      onClose: () => resolve(null),
    });
  });
}