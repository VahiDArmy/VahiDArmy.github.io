/**
 * Tellalls list page — search, pagination, create via new page link.
 */

import { el, icon } from '../utils/dom.js';
import { router } from '../core/router.js';
import { appStore } from '../core/store.js';
import { ROUTES } from '../config/constants.js';
import { pageHeader } from '../components/page-header.js';
import { emptyState } from '../components/empty-state.js';
import { createPagination } from '../components/pagination.js';
import { toast } from '../ui/toast.js';
import { skeletonList } from '../ui/loading.js';
import { getQueryParam, setQuery } from '../utils/url.js';
import { requireAuthOrRedirect } from '../components/auth-guard.js';
import { formatNumber, formatDate } from '../utils/format.js';
import { debounce } from '../utils/debounce.js';
import { supabase } from '../services/supabase.client.js';

export default async function tellallsPage(info, outlet) {
  const session = await requireAuthOrRedirect();
  if (!session) return () => {};

  const state = {
    search: getQueryParam('q', ''),
    page: parseInt(getQueryParam('page', '1'), 10) || 1,
    pageSize: parseInt(getQueryParam('size', '12'), 10) || 12,
    items: [],
    total: 0,
  };

  outlet.innerHTML = '';
  const page = el('div', { class: 'container theories-page' });
  outlet.appendChild(page);

  const headerActions = [];
  if (appStore.get('user')) {
    headerActions.push(
      el(
        'a',
        {
          href: router.href('/tellalls/new'),
          class: 'btn btn--primary',
        },
        [icon('plus'), 'موضوع جدید']
      )
    );
  }

  page.appendChild(
    pageHeader({
      eyebrow: 'بایگانی',
      title: 'بگایی‌های داده شده',
      subtitle: 'اینجا می‌توانید هر بگایی که در اداره بوده را با جزئیاتش ثبت کنید.',
      actions: headerActions,
    })
  );

  // Search bar
  const searchInput = el('input', {
    type: 'search',
    class: 'input',
    placeholder: 'جستجو در عنوان بگایی‌ها...',
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

  const listWrap = el('div', { id: 'tellalls-results' });
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
      let q = supabase.from('tellalls').select('id, title, description, created_at, created_by, person_id, people:person_id(full_name)', { count: 'exact' });
      
      if (state.search) q = q.ilike('title', `%${state.search}%`);
      q = q.order('created_at', { ascending: false }).range((state.page - 1) * state.pageSize, state.page * state.pageSize - 1);
      
      const { data, error, count } = await q;
      if (error) throw error;
      
      state.items = data || [];
      state.total = count || 0;
      render();
      pagination.update({ total: state.total, page: state.page, pageSize: state.pageSize });
    } catch (err) {
      listWrap.innerHTML = '';
      listWrap.appendChild(
        emptyState({
          iconName: 'alert-circle',
          title: 'خطا در بارگذاری',
          description: err?.message || 'بگایی‌ها بارگذاری نشد.',
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
                  'a',
                  { class: 'btn btn--primary', href: router.href('/tellalls/new') },
                  [icon('plus'), 'موضوع جدید']
                ),
              ]
            : [
                el('a', { class: 'btn btn--primary', href: router.href(ROUTES.LOGIN) }, ['ورود']),
              ],
        })
      );
      return;
    }

    const grid = el('div', { class: 'rankings-grid' });
    for (const tellall of state.items) {
      grid.appendChild(buildCard(tellall));
    }
    listWrap.appendChild(grid);
  }

  function buildCard(tellall) {
    const personName = tellall.people?.full_name || 'نامشخص';
    
    return el(
      'div',
      {
        class: 'ranking-card',
        role: 'link',
        tabindex: '0',
        on: {
          click: () => router.navigate(`/tellalls/${tellall.id}`),
        },
      },
      [
        el('div', { class: 'ranking-card__head' }, [
          el('div', { class: 'ranking-card__icon' }, [icon('message')]),
          el('div', { style: { minWidth: 0, flex: '1 1 auto' } }, [
            el('div', { class: 'ranking-card__title' }, [tellall.title || 'بدون عنوان']),
            el('div', { class: 'ranking-card__criteria' }, [`شخص محوری: ${personName}`]),
          ]),
        ]),
        tellall.description
          ? el('div', { class: 'ranking-card__desc', style: { WebkitLineClamp: 3 } }, [tellall.description])
          : null,
        el('div', { class: 'ranking-card__footer' }, [
          el('span', { class: 'ranking-card__count' }, [
            icon('clock'),
            formatDate(tellall.created_at)
          ]),
        ]),
      ]
    );
  }

  await load();

  return () => {};
}