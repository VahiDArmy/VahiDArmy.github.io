/**
 * Characterology List Page
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { characterologyService } from '../services/characterology.service.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createPagination } from '../components/pagination.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { formatNumber, formatDate } from '../utils/format.js';
import { debounce } from '../utils/debounce.js';

export default async function characterologyPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const state = { search: '', page: 1, pageSize: 12, items: [], total: 0 };

  outlet.innerHTML = '';
  const page = el('div', { class: 'container characterology-page' });
  outlet.appendChild(page);

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'شخصیت شناسی',
      subtitle: 'اگر شخص خاصی در یک موقعیت قرار بگیرد، چه واکنشی نشان می‌دهد؟',
      actions: [
        el('a', { class: 'btn btn--primary', href: router.href('/characterology/new') }, [icon('plus'), 'سناریو جدید'])
      ],
    })
  );

  const searchInput = el('input', { type: 'search', class: 'input', placeholder: 'جستجو در عنوان موقعیت‌ها...' });
  const onSearch = debounce((v) => { state.search = v.trim(); state.page = 1; load(); }, 300);
  searchInput.addEventListener('input', () => onSearch(searchInput.value));

  page.appendChild(el('div', { class: 'toolbar' }, [
    el('div', { class: 'search toolbar__search' }, [
      el('span', { class: 'search__icon' }, [icon('search')]),
      searchInput,
    ]),
  ]));

  const listWrap = el('div');
  page.appendChild(listWrap);

  const pagination = createPagination({
    total: 0, page: state.page, pageSize: state.pageSize,
    onChange: ({ page: p, pageSize: s }) => { state.page = p; state.pageSize = s; load(); },
  });
  page.appendChild(pagination.node);

  async function load() {
    listWrap.innerHTML = '';
    listWrap.appendChild(skeletonList({ count: 4, variant: 'row' }));
    
    try {
      const res = await characterologyService.listScenarios({
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
      listWrap.appendChild(emptyState({ iconName: 'alert-circle', title: 'خطا', description: err?.message }));
    }
  }

  function render() {
    listWrap.innerHTML = '';
    if (!state.items.length) {
      listWrap.appendChild(emptyState({
        iconName: 'user',
        title: 'سناریویی وجود ندارد',
        description: 'اولین موقعیت فرضی را ایجاد کنید.',
        actions: [el('a', { class: 'btn btn--primary', href: router.href('/characterology/new') }, [icon('plus'), 'ایجاد سناریو'])]
      }));
      return;
    }

    const list = el('div', { class: 'scenario-list' });
    for (const item of state.items) {
      // Supabase returns answers as an array with a count object
      const answersCount = item.answers && item.answers[0] ? item.answers[0].count : 0;
      
      list.appendChild(
        el('a', { class: 'scenario-card', href: router.href(ROUTES.CHARACTEROLOGY_DETAIL(item.id)) }, [
          el('div', { class: 'scenario-card__icon' }, [icon('user')]),
          el('div', { class: 'scenario-card__main' }, [
            el('div', { class: 'scenario-card__title' }, [item.title]),
            item.description ? el('div', { class: 'scenario-card__desc' }, [item.description]) : null,
            el('div', { class: 'scenario-card__meta' }, [
              el('span', { class: 'scenario-card__meta-item' }, [icon('message'), `${formatNumber(answersCount)} پاسخ`]),
              el('span', { class: 'scenario-card__meta-item' }, [icon('clock'), formatDate(item.created_at)]),
            ])
          ])
        ])
      );
    }
    listWrap.appendChild(list);
  }

  await load();
  return () => {};
}