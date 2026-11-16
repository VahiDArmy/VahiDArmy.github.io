/**
 * بازاربان — فهرست محصولات
 * ---------------------------------------------------------------------------
 * جست‌وجو در نام و برند، فیلتر دسته/فروشنده/قیمت/موجودی، مرتب‌سازی قیمتی و
 * نمایش شبکه‌ای یا جدولی. همهٔ فیلترها در آدرس حفظ می‌شوند.
 */

import { icon } from '../icons.js';
import { CONFIG, CATEGORIES } from '../config.js';
import { esc, attr, toFa, fmtPrice, debounce, $ } from '../utils.js';
import * as store from '../store.js';
import {
  entityCard,
  emptyState,
  pageHead,
  breadcrumbs,
  activeFiltersRow,
  setupReveal,
  scoreBadge,
} from '../ui.js';
import {
  baseFilters,
  listOf,
  filtersPanel,
  listingToolbar,
  entityTable,
  paginate,
  pagerFor,
  writeListQuery,
  readFilterInputs,
  mountMobileFilters,
  bindSearchInput,
} from './partials.js';
import { categoryById } from '../config.js';
import { modeBanner } from './home.js';

const PATH = '/products';

function readState(ctx) {
  const base = baseFilters(ctx.query);
  return {
    ...base,
    vendorId: ctx.query.vendor || '',
    categories: listOf(ctx.query.categories),
    verdicts: listOf(ctx.query.verdicts),
    priceMin: ctx.query.priceMin ? Number(ctx.query.priceMin) : null,
    priceMax: ctx.query.priceMax ? Number(ctx.query.priceMax) : null,
    availableOnly: ctx.query.available === '1',
  };
}

const toQuery = (s) => ({
  q: s.q,
  vendor: s.vendorId,
  categories: s.categories,
  verdicts: s.verdicts,
  priceMin: s.priceMin ?? '',
  priceMax: s.priceMax ?? '',
  available: s.availableOnly ? '1' : '',
  sort: s.sort,
  view: s.view,
  page: s.page,
});

function sortProducts(list, sort) {
  const rows = [...list];
  const scoreOf = (p) => store.scoreFor('product', p.id);
  switch (sort) {
    case 'score_asc':
      return rows.sort((a, b) => {
        const sa = scoreOf(a);
        const sb = scoreOf(b);
        if (!sa.total && sb.total) return 1;
        if (!sb.total && sa.total) return -1;
        return sa.score - sb.score;
      });
    case 'price_asc':
      return rows.sort((a, b) => (Number(a.price) || Infinity) - (Number(b.price) || Infinity));
    case 'price_desc':
      return rows.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    case 'newest':
      return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'name_asc':
      return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'));
    case 'score_desc':
    default:
      return rows.sort((a, b) => {
        const sa = scoreOf(a);
        const sb = scoreOf(b);
        if (!sa.total && sb.total) return 1;
        if (!sb.total && sa.total) return -1;
        return sb.score - sa.score || sb.total - sa.total;
      });
  }
}

function vendorOptions(selected) {
  return `<div class="field">
    <label class="label" for="vendor-select">فروشنده</label>
    <select class="select" id="vendor-select" data-vendor-select>
      <option value="">همهٔ فروشنده‌ها</option>
      ${store
        .allVendors()
        .map(
          (v) => `<option value="${attr(v.id)}" ${selected === v.id ? 'selected' : ''}>${esc(v.nameFa)}</option>`,
        )
        .join('')}
    </select>
  </div>`;
}

function renderResults(state, result) {
  if (!result.items.length) {
    return emptyState({
      iconName: 'package',
      title: 'محصولی با این فیلترها نیست',
      text: 'دسته یا بازهٔ قیمت را تغییر بده. اگر محصول تازه‌ای می‌شناسی، اضافه‌اش کن تا بقیه هم ببینند.',
      actions: `
        <button class="btn btn--outline btn--sm" type="button" data-action="clear-all-filters">پاک‌کردن فیلترها</button>
        <a class="btn btn--primary btn--sm" href="#/new?type=product" data-link>${icon('plus', 14)} افزودن محصول</a>`,
    });
  }
  if (state.view === 'table') return `${entityTable('product', result.items)}${pagerFor(result)}`;
  return `<div class="grid grid--auto">${result.items.map((p) => entityCard('product', p)).join('')}</div>${pagerFor(result)}`;
}

export const productsView = {
  title: 'محصولات',
  render(ctx) {
    const state = readState(ctx);
    const all = store.allProducts();
    const filtered = store.filterProducts(all, state);
    const result = paginate(sortProducts(filtered, state.sort), state.page);
    const categories = store.categoryFacets();

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'محصولات' }])}
        ${pageHead({
          eyebrow: 'قفسه به قفسه',
          title: 'کدام محصول را بخرم؟',
          sub: `همان کالا در فروشنده‌های مختلف کیفیت و قیمت متفاوت دارد. ${toFa(all.length)} محصول در ${toFa(
            categories.length,
          )} دسته ثبت شده است.`,
          actions: `
            <a class="btn btn--outline btn--sm" href="#/shops" data-link>${icon('building', 15)} شعبه‌ها</a>
            <a class="btn btn--primary btn--sm" href="#/new?type=product" data-link>${icon('plus', 15)} افزودن محصول</a>`,
        })}

        <div class="chips-row chips-row--scroll mb-6">
          <button class="chip chip--button" type="button" data-quick-cat="" aria-pressed="${!state.categories.length}">
            همه (${toFa(all.length)})
          </button>
          ${categories
            .map(
              (category) => `<button class="chip chip--button" type="button" data-quick-cat="${category.id}"
                aria-pressed="${state.categories.includes(category.id)}">
                ${icon(category.icon, 13)} ${esc(category.label)} <span class="t-faint">${toFa(category.count)}</span>
              </button>`,
            )
            .join('')}
        </div>

        <div class="sidebar-layout">
          <div id="filters-panel">
            <aside class="filter-rail desktop-filters">
              <div class="filter-card" style="padding:var(--sp-5) var(--sp-6)">${vendorOptions(state.vendorId)}</div>
              ${filtersPanel({ type: 'product', filters: state, resultCount: filtered.length, total: all.length })
                .replace('<aside class="filter-rail desktop-filters">', '<div class="filter-rail">')
                .replace(/<\/aside>$/, '</div>')}
            </aside>
          </div>

          <div class="sidebar-layout__main">
            <div class="surface" style="padding:var(--sp-4);margin-bottom:var(--sp-4)">
              <div class="input-group">
                <span class="input-group__icon">${icon('search', 17)}</span>
                <input class="input" type="search" placeholder="نام محصول، برند یا دسته…" value="${attr(state.q)}"
                  data-list-search aria-label="جست‌وجو در محصولات" />
              </div>
              <div class="cluster" style="gap:var(--sp-2);margin-top:var(--sp-3)">
                <button class="chip chip--button" type="button" data-quick-available aria-pressed="${state.availableOnly}">
                  ${icon('check-circle', 13)} فقط موجود
                </button>
                <button class="chip chip--button" type="button" data-quick-cheap aria-pressed="${state.sort === 'price_asc'}">
                  ${icon('trending-down', 13)} ارزان‌ترین
                </button>
              </div>
            </div>

            <div id="list-toolbar">
              ${listingToolbar({
                count: filtered.length,
                total: all.length,
                sortOptions: CONFIG.SORTS.product,
                sort: state.sort,
                view: state.view,
                query: state.q,
              })}
            </div>
            <div id="active-filters" style="margin-top:var(--sp-3)">
              ${activeFiltersRow(
                {
                  q: state.q,
                  categories: state.categories,
                  verdicts: state.verdicts,
                  priceMin: state.priceMin ?? '',
                  priceMax: state.priceMax ?? '',
                  availableOnly: state.availableOnly,
                },
                { q: 'جست‌وجو', categories: 'دسته', verdicts: 'سطح', priceMin: 'از قیمت', priceMax: 'تا قیمت', availableOnly: 'موجود' },
              )}
            </div>
            <div id="list-results" style="margin-top:var(--sp-4)">${renderResults(state, result)}</div>
          </div>
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    setupReveal(root);
    let state = readState(ctx);
    const resultsBox = root.querySelector('#list-results');
    const toolbarBox = root.querySelector('#list-toolbar');
    const chipsBox = root.querySelector('#active-filters');
    const filtersBox = root.querySelector('#filters-panel');

    const paint = () => {
      const all = store.allProducts();
      const filtered = store.filterProducts(all, state);
      const result = paginate(sortProducts(filtered, state.sort), state.page);
      resultsBox.innerHTML = renderResults(state, result);
      toolbarBox.innerHTML = listingToolbar({
        count: filtered.length,
        total: all.length,
        sortOptions: CONFIG.SORTS.product,
        sort: state.sort,
        view: state.view,
        query: state.q,
      });
      chipsBox.innerHTML = activeFiltersRow(
        {
          q: state.q,
          categories: state.categories,
          verdicts: state.verdicts,
          priceMin: state.priceMin ?? '',
          priceMax: state.priceMax ?? '',
          availableOnly: state.availableOnly,
        },
        { q: 'جست‌وجو', categories: 'دسته', verdicts: 'سطح', priceMin: 'از قیمت', priceMax: 'تا قیمت', availableOnly: 'موجود' },
      );
      writeListQuery(PATH, toQuery(state));
      refreshQuickCat();
      bindToolbar();
      setupReveal(resultsBox);
    };

    const apply = (patch) => {
      state = { ...state, ...patch, page: 1 };
      paint();
    };

    const bindToolbar = () => {
      toolbarBox.querySelector('[data-sort-select]')?.addEventListener('change', (e) => {
        state = { ...state, sort: e.target.value, page: 1 };
        paint();
      });
      toolbarBox.querySelectorAll('[data-view]').forEach((button) => {
        button.addEventListener('click', () => {
          state = { ...state, view: button.dataset.view };
          paint();
        });
      });
    };
    bindToolbar();
    bindSearchInput(root, (value) => apply({ q: value }));

    const debouncedApply = debounce(() => {
      const values = readFilterInputs(filtersBox);
      const vendorSelect = filtersBox.querySelector('[data-vendor-select]');
      state = { ...state, ...values, vendorId: vendorSelect?.value || '', page: 1 };
      root.querySelector('[data-quick-available]')?.setAttribute('aria-pressed', String(state.availableOnly));
      paint();
    }, 140);
    filtersBox.addEventListener('change', debouncedApply);
    filtersBox.querySelectorAll('[data-price-min], [data-price-max]').forEach((input) => {
      input.addEventListener('input', debouncedApply);
    });

    function refreshQuickCat() {
      root.querySelectorAll('[data-quick-cat]').forEach((button) => {
        const id = button.dataset.quickCat;
        const active = id ? state.categories.includes(id) : !state.categories.length;
        button.setAttribute('aria-pressed', String(active));
      });
    }

    root.querySelectorAll('[data-quick-cat]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.quickCat;
        const next = !id ? [] : state.categories.includes(id) ? state.categories.filter((c) => c !== id) : [...state.categories, id];
        filtersBox.querySelectorAll('input[data-group="categories"]').forEach((input) => {
          input.checked = next.includes(input.value);
        });
        apply({ categories: next });
      });
    });

    root.querySelector('[data-quick-available]')?.addEventListener('click', () => {
      const next = !state.availableOnly;
      const input = filtersBox.querySelector('input[data-group="availableOnly"]');
      if (input) input.checked = next;
      apply({ availableOnly: next });
    });

    root.querySelector('[data-quick-cheap]')?.addEventListener('click', () => {
      apply({ sort: 'price_asc' });
      root.querySelector('[data-quick-cheap]')?.setAttribute('aria-pressed', 'true');
    });

    root.addEventListener('click', (event) => {
      const pageBtn = event.target.closest('[data-action="goto-page"]');
      if (pageBtn && !pageBtn.disabled) {
        state = { ...state, page: Number(pageBtn.dataset.page) };
        paint();
        resultsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (event.target.closest('[data-action="open-mobile-filters"]')) {
        mountMobileFilters({
          type: 'product',
          filters: state,
          onApply: (values) => {
            state = { ...state, ...values, page: 1 };
            paint();
          },
        });
        return;
      }
      if (event.target.closest('[data-action="clear-all-filters"]')) {
        state = {
          ...state,
          q: '',
          categories: [],
          verdicts: [],
          priceMin: null,
          priceMax: null,
          availableOnly: false,
          page: 1,
        };
        filtersBox.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = false));
        filtersBox.querySelectorAll('[data-price-min], [data-price-max]').forEach((i) => (i.value = ''));
        const search = root.querySelector('[data-list-search]');
        if (search) search.value = '';
        paint();
        return;
      }
      const clear = event.target.closest('[data-action="clear-filter"]');
      if (clear) {
        const { key, value } = clear.dataset;
        const patch = {};
        if (key === 'q') patch.q = '';
        else if (key === 'priceMin' || key === 'priceMax') patch[key] = null;
        else if (key === 'availableOnly') patch.availableOnly = false;
        else if (Array.isArray(state[key])) patch[key] = state[key].filter((v) => v !== value);
        state = { ...state, ...patch, page: 1 };
        filtersBox.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          const group = input.dataset.group;
          if (group === 'availableOnly') input.checked = state.availableOnly;
          else if (Array.isArray(state[group])) input.checked = state[group].includes(input.value);
        });
        paint();
      }
    });
  },
};
