/* ============================================================
   Filter bar — ratings, platforms, shops, sort, count
   ============================================================ */
import { store } from '../state.js';
import { el, formatNumber } from '../utils.js';
import { icon } from './icons.js';
import { RATINGS, RATING_ORDER } from '../state.js';
import { computeFilteredPurchases, hasActiveFilters } from '../selectors.js';

export function mountFilters() {
  const wrap = el('div', { class: 'filters-panel' });

  function render() {
    const filters = store.filters.get();
    const purchases = store.purchases.get();
    const platforms = store.platforms.get();
    const shops = store.shops.get();
    const filtered = computeFilteredPurchases(purchases, filters);
    const active = hasActiveFilters(filters);

    wrap.innerHTML = '';

    /* Row 1 — rating + sort + clear + count */
    const ratingChips = el('div', { class: 'filters-group' }, [
      el('span', { class: 'filters-label', text: 'امتیاز' }),
      ...RATING_ORDER.map((key) => {
        const r = RATINGS[key];
        const isActive = filters.ratings.has(key);
        return el('button', {
          type: 'button',
          class: `chip chip--${key}${isActive ? ' is-active' : ''}`,
          onclick: () => toggleRating(key),
        }, [
          el('span', { class: 'chip__dot' }),
          el('span', { text: r.label }),
        ]);
      }),
    ]);

    const sortOptions = [
      { v: 'recent', l: 'جدیدترین' },
      { v: 'oldest', l: 'قدیمی‌ترین' },
      { v: 'rating-desc', l: 'امتیاز (خوب → بد)' },
      { v: 'rating-asc', l: 'امتیاز (بد → خوب)' },
      { v: 'price-desc', l: 'قیمت (زیاد → کم)' },
      { v: 'price-asc', l: 'قیمت (کم → زیاد)' },
      { v: 'shop', l: 'بر اساس فروشگاه' },
      { v: 'product', l: 'بر اساس محصول' },
    ];
    const sortSelect = el('select', { class: 'select filters-sort' });
    for (const o of sortOptions) {
      const opt = el('option', { value: o.v, text: o.l });
      if (filters.sort === o.v) opt.selected = true;
      sortSelect.appendChild(opt);
    }
    sortSelect.addEventListener('change', () => {
      store.filters.set({ ...filters, sort: sortSelect.value });
    });

    const clearBtn = active ? el('button', {
      type: 'button',
      class: 'btn btn--ghost btn--sm',
      html: `${icon('close', 14)}<span>پاک کردن فیلترها</span>`,
      onclick: clearFilters,
    }) : null;

    const countBadge = el('span', { class: 'count-badge' },
      `${formatNumber(filtered.length)} از ${formatNumber(purchases.length)}`);

    const row1 = el('div', { class: 'filters-row filters-row--between' }, [
      ratingChips,
      el('div', { class: 'filters-group' }, [
        countBadge,
        sortSelect,
        clearBtn,
      ].filter(Boolean)),
    ]);

    /* Row 2 — platforms */
    const row2 = platforms.length
      ? el('div', { class: 'filters-row' }, [
          el('span', { class: 'filters-label', text: 'پلتفرم' }),
          el('div', { class: 'filters-scroll' },
            platforms.map((p) => {
              const isActive = filters.platformIds.has(p.id);
              return el('button', {
                type: 'button',
                class: `chip${isActive ? ' is-active' : ''}`,
                onclick: () => toggleSet('platformIds', p.id),
              }, [
                el('span', {
                  class: 'chip__dot',
                  style: { background: p.color || '#6366f1', boxShadow: `0 0 8px ${p.color || '#6366f1'}` },
                }),
                el('span', { text: p.name }),
              ]);
            })
          ),
        ])
      : null;

    /* Row 3 — shops (only shops that appear in purchases) */
    const usedShopIds = new Set(purchases.map((p) => p.shop_id));
    const usedShops = shops.filter((s) => usedShopIds.has(s.id));
    const row3 = usedShops.length
      ? el('div', { class: 'filters-row' }, [
          el('span', { class: 'filters-label', text: 'فروشگاه' }),
          el('div', { class: 'filters-scroll' },
            usedShops.map((s) => {
              const isActive = filters.shopIds.has(s.id);
              return el('button', {
                type: 'button',
                class: `chip${isActive ? ' is-active' : ''}`,
                onclick: () => toggleSet('shopIds', s.id),
              }, [
                el('span', { class: 'chip__avatar', text: (s.name?.[0] || '؟').toUpperCase() }),
                el('span', { text: s.name }),
              ]);
            })
          ),
        ])
      : null;

    wrap.append(...[row1, row2, row3].filter(Boolean));
  }

  function toggleRating(key) {
    const f = store.filters.get();
    const ratings = new Set(f.ratings);
    ratings.has(key) ? ratings.delete(key) : ratings.add(key);
    store.filters.set({ ...f, ratings });
  }

  function toggleSet(field, id) {
    const f = store.filters.get();
    const next = new Set(f[field]);
    next.has(id) ? next.delete(id) : next.add(id);
    store.filters.set({ ...f, [field]: next });
  }

  function clearFilters() {
    store.filters.set({
      ...store.filters.get(),
      ratings: new Set(),
      platformIds: new Set(),
      shopIds: new Set(),
      productIds: new Set(),
    });
  }

  store.filters.subscribe(render);
  store.purchases.subscribe(render);
  store.platforms.subscribe(render);
  store.shops.subscribe(render);

  render();
  return wrap;
}
