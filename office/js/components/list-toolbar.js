/**
 * Unified list toolbar — search + filters + sort + actions.
 * Every list page uses this for consistency.
 *
 *   const tb = createListToolbar({
 *     searchPlaceholder: 'جستجوی افراد...',
 *     searchValue,
 *     onSearch: (value) => reload({ search: value }),
 *     filters: [
 *       { type: 'select', key: 'status', label: 'وضعیت', value, options: [...] },
 *       { type: 'chips',  key: 'tags',   value, options: [...] },
 *     ],
 *     sort: {
 *       value: 'full_name',
 *       options: [
 *         { value: 'full_name', label: 'نام' },
 *         { value: 'created_at', label: 'جدیدترین' },
 *       ],
 *       direction: 'asc',
 *       onDirectionToggle: () => reload(),
 *     },
 *     actions: [btn1, btn2],
 *     onFilterChange: (key, value) => reload({ [key]: value }),
 *   });
 *   container.appendChild(tb.node);
 */

import { el, icon } from '../utils/dom.js';
import { debounce } from '../utils/debounce.js';

export function createListToolbar({
  searchPlaceholder = 'جستجو...',
  searchValue = '',
  onSearch,
  filters = [],
  sort = null,
  actions = [],
  onFilterChange,
} = {}) {
  const node = el('div', { class: 'toolbar' });

  /* Search */
  const searchInput = el('input', {
    type: 'search',
    class: 'input',
    placeholder: searchPlaceholder,
    value: searchValue,
    'aria-label': searchPlaceholder,
  });
  const clearBtn = el(
    'button',
    {
      type: 'button',
      class: 'search__clear',
      'aria-label': 'پاک کردن جستجو',
      style: { display: searchValue ? '' : 'none' },
      on: {
        click: () => {
          searchInput.value = '';
          clearBtn.style.display = 'none';
          onSearch?.('');
        },
      },
    },
    [icon('x')]
  );

  const debouncedSearch = debounce((v) => onSearch?.(v.trim()), 300);
  searchInput.addEventListener('input', () => {
    clearBtn.style.display = searchInput.value ? '' : 'none';
    debouncedSearch(searchInput.value);
  });

  const searchWrap = el('div', { class: 'search toolbar__search' }, [
    el('span', { class: 'search__icon' }, [icon('search')]),
    searchInput,
    clearBtn,
  ]);
  node.appendChild(searchWrap);

  /* Filters */
  if (filters.length) node.appendChild(el('div', { class: 'toolbar__divider' }));

  for (const f of filters) {
    if (f.type === 'select') {
      node.appendChild(
        el(
          'select',
          {
            class: 'select toolbar__select',
            'aria-label': f.label,
            on: { change: (e) => onFilterChange?.(f.key, e.target.value) },
          },
          f.options.map((o) =>
            el(
              'option',
              { value: String(o.value), selected: String(o.value) === String(f.value) },
              [o.label]
            )
          )
        )
      );
    } else if (f.type === 'toggle') {
      node.appendChild(
        el(
          'button',
          {
            type: 'button',
            class: `btn btn--secondary btn--sm${f.value ? ' is-active' : ''}`,
            on: {
              click: (e) => {
                const next = !e.currentTarget.classList.contains('is-active');
                e.currentTarget.classList.toggle('is-active', next);
                onFilterChange?.(f.key, next);
              },
            },
          },
          [f.label]
        )
      );
    }
  }

  /* Sort */
  if (sort) {
    node.appendChild(el('div', { class: 'toolbar__divider' }));
    node.appendChild(
      el(
        'select',
        {
          class: 'select toolbar__select',
          'aria-label': 'مرتب‌سازی',
          on: { change: (e) => onFilterChange?.(sort.key || 'sort', e.target.value) },
        },
        sort.options.map((o) =>
          el('option', { value: o.value, selected: o.value === sort.value }, [o.label])
        )
      )
    );

    const dirBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary btn--icon btn--sm',
        'aria-label': sort.direction === 'asc' ? 'نزولی' : 'صعودی',
        title: sort.direction === 'asc' ? 'صعودی' : 'نزولی',
        on: {
          click: () => {
            const next = dirBtn.dataset.dir === 'asc' ? 'desc' : 'asc';
            dirBtn.dataset.dir = next;
            dirBtn.innerHTML = '';
            dirBtn.appendChild(icon(next === 'asc' ? 'arrow-up' : 'arrow-down'));
            onFilterChange?.(sort.directionKey || 'direction', next);
          },
        },
      },
      [icon(sort.direction === 'asc' ? 'arrow-up' : 'arrow-down')]
    );
    dirBtn.dataset.dir = sort.direction || 'asc';
    node.appendChild(dirBtn);
  }

  /* Actions */
  if (actions.length) {
    node.appendChild(el('div', { class: 'toolbar__spacer' }));
    for (const a of actions) node.appendChild(a);
  }

  return { node, searchInput };
}

export default createListToolbar;