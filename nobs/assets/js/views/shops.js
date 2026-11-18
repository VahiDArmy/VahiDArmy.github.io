/**
 * بازاربان — فهرست فروشگاه‌ها و شعبه‌ها
 * ---------------------------------------------------------------------------
 * شعبه‌ها مهم‌اند: دو شعبه از یک برند می‌توانند زمین تا آسمان فرق کنند.
 * این صفحه امکان فیلتر بر اساس فروشنده، شهر و نوع خدمت (حضوری/ارسال) را می‌دهد.
 */

import { icon } from '../icons.js';
import { CONFIG } from '../config.js';
import { esc, attr, toFa, debounce, $ } from '../utils.js';
import * as store from '../store.js';
import {
  entityCard,
  emptyState,
  pageHead,
  breadcrumbs,
  activeFiltersRow,
  setupReveal,
  scoreBadge,
  brandBadge,
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
import { modeBanner } from './home.js';

const PATH = '/shops';

function readState(ctx) {
  const base = baseFilters(ctx.query);
  return {
    ...base,
    vendorId: ctx.query.vendor || '',
    cities: listOf(ctx.query.cities),
    verdicts: listOf(ctx.query.verdicts),
    pickupOnly: ctx.query.pickup === '1',
    deliveryOnly: ctx.query.delivery === '1',
  };
}

const toQuery = (s) => ({
  q: s.q,
  vendor: s.vendorId,
  cities: s.cities,
  verdicts: s.verdicts,
  pickup: s.pickupOnly ? '1' : '',
  delivery: s.deliveryOnly ? '1' : '',
  sort: s.sort,
  view: s.view,
  page: s.page,
});

function sortShops(list, sort) {
  const rows = [...list];
  const scoreOf = (shop) => store.scoreFor('shop', shop.id);
  switch (sort) {
    case 'reviews_desc':
      return rows.sort((a, b) => scoreOf(b).total - scoreOf(a).total);
    case 'newest':
      return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'name_asc':
      return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'));
    case 'city':
      return rows.sort((a, b) => String(a.city).localeCompare(String(b.city), 'fa'));
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

function renderResults(state, result) {
  if (!result.items.length) {
    return emptyState({
      iconName: 'building',
      title: 'شعبه‌ای با این مشخصات نیست',
      text: 'شاید با نام دیگری ثبت شده. جست‌وجو را ساده‌تر کن یا شعبهٔ جدید را خودت اضافه کن.',
      actions: `
        <button class="btn btn--outline btn--sm" type="button" data-action="clear-all-filters">پاک‌کردن فیلترها</button>
        <a class="btn btn--primary btn--sm" href="#/new?type=shop" data-link>${icon('plus', 14)} افزودن شعبه</a>`,
    });
  }
  if (state.view === 'table') return `${entityTable('shop', result.items)}${pagerFor(result)}`;
  return `<div class="grid grid--auto">${result.items.map((shop) => entityCard('shop', shop)).join('')}</div>${pagerFor(result)}`;
}

function vendorOptions(selected) {
  return `<div class="field">
    <label class="label" for="vendor-filter">فروشنده</label>
    <select class="select" id="vendor-filter" data-vendor-select>
      <option value="">همهٔ فروشنده‌ها</option>
      ${store
        .allVendors()
        .map(
          (vendor) =>
            `<option value="${attr(vendor.id)}" ${selected === vendor.id ? 'selected' : ''}>${esc(
              vendor.nameFa,
            )}</option>`,
        )
        .join('')}
    </select>
  </div>`;
}

export const shopsView = {
  title: 'فروشگاه‌ها',
  render(ctx) {
    const state = readState(ctx);
    const all = store.allShops();
    const filtered = store.filterShops(all, state);
    const result = paginate(sortShops(filtered, state.sort), state.page);
    const vendors = store.allVendors();
    const pickupCount = all.filter((s) => s.pickup).length;

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'فروشگاه‌ها' }])}
        ${pageHead({
          eyebrow: 'شعبه به شعبه',
          title: 'کدام شعبه؟',
          sub: `در بازاربان «فروشگاه» یعنی شعبهٔ مشخص با آدرس و ساعات کاری. ${toFa(all.length)} شعبه از ${toFa(
            vendors.length,
          )} فروشنده؛ ${toFa(pickupCount)} مورد امکان تحویل حضوری دارد.`,
          actions: `
            <a class="btn btn--outline btn--sm" href="#/vendors" data-link>${icon('store', 15)} فروشنده‌ها</a>
            <a class="btn btn--primary btn--sm" href="#/new?type=shop" data-link>${icon('plus', 15)} افزودن شعبه</a>`,
        })}

        <div class="grid grid--4 mb-8" style="gap:var(--sp-3)">
          ${[
            { icon: 'building', label: 'شعبه ثبت‌شده', value: all.length, hue: 'var(--cyan)' },
            { icon: 'bag', label: 'تحویل حضوری', value: pickupCount, hue: 'var(--brand-400)' },
            { icon: 'truck', label: 'ارسال به آدرس', value: all.filter((s) => s.delivery).length, hue: 'var(--violet)' },
            { icon: 'map-pin', label: 'شهر', value: new Set(all.map((s) => s.city)).size, hue: 'var(--meh)' },
          ]
            .map(
              (item) => `<div class="tile">
                <span class="tile__head" style="color:${item.hue}">${icon(item.icon, 14)} ${esc(item.label)}</span>
                <span class="tile__value">${toFa(item.value)}</span>
              </div>`,
            )
            .join('')}
        </div>

        <div class="sidebar-layout">
          <div id="filters-panel">
            <aside class="filter-rail desktop-filters">
              <div class="filter-card" style="padding:var(--sp-5) var(--sp-6)">
                ${vendorOptions(state.vendorId)}
              </div>
              ${filtersPanel({ type: 'shop', filters: state, resultCount: filtered.length, total: all.length })
                .replace('<aside class="filter-rail desktop-filters">', '<div class="filter-rail">')
                .replace(/<\/aside>$/, '</div>')}
            </aside>
          </div>

          <div class="sidebar-layout__main">
            <div class="surface" style="padding:var(--sp-4);margin-bottom:var(--sp-4)">
              <div class="input-group">
                <span class="input-group__icon">${icon('search', 17)}</span>
                <input class="input" type="search" placeholder="نام شعبه، محله، آدرس…" value="${attr(state.q)}"
                  data-list-search aria-label="جست‌وجو در شعبه‌ها" />
              </div>
              <div class="cluster" style="gap:var(--sp-2);margin-top:var(--sp-3)">
                <button class="chip chip--button" type="button" data-quick-pickup aria-pressed="${state.pickupOnly}">
                  ${icon('bag', 13)} تحویل حضوری
                </button>
                <button class="chip chip--button" type="button" data-quick-delivery aria-pressed="${state.deliveryOnly}">
                  ${icon('truck', 13)} ارسال به آدرس
                </button>
              </div>
            </div>

            <div id="list-toolbar">
              ${listingToolbar({
                count: filtered.length,
                total: all.length,
                sortOptions: CONFIG.SORTS.shop,
                sort: state.sort,
                view: state.view,
                query: state.q,
              })}
            </div>
            <div id="active-filters" style="margin-top:var(--sp-3)">
              ${activeFiltersRow(
                {
                  q: state.q,
                  cities: state.cities,
                  verdicts: state.verdicts,
                  pickupOnly: state.pickupOnly,
                  deliveryOnly: state.deliveryOnly,
                },
                { q: 'جست‌وجو', cities: 'شهر', verdicts: 'سطح', pickupOnly: 'حضوری', deliveryOnly: 'ارسال' },
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
      const all = store.allShops();
      const filtered = store.filterShops(all, state);
      const result = paginate(sortShops(filtered, state.sort), state.page);
      resultsBox.innerHTML = renderResults(state, result);
      toolbarBox.innerHTML = listingToolbar({
        count: filtered.length,
        total: all.length,
        sortOptions: CONFIG.SORTS.shop,
        sort: state.sort,
        view: state.view,
        query: state.q,
      });
      chipsBox.innerHTML = activeFiltersRow(
        {
          q: state.q,
          cities: state.cities,
          verdicts: state.verdicts,
          pickupOnly: state.pickupOnly,
          deliveryOnly: state.deliveryOnly,
        },
        { q: 'جست‌وجو', cities: 'شهر', verdicts: 'سطح', pickupOnly: 'حضوری', deliveryOnly: 'ارسال' },
      );
      writeListQuery(PATH, toQuery(state));
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
      state = { ...state, ...values, vendorId: vendorSelect?.value || state.vendorId, page: 1 };
      syncChips();
      paint();
    }, 140);
    filtersBox.addEventListener('change', debouncedApply);
    filtersBox.querySelectorAll('[data-price-min], [data-price-max]').forEach((input) => {
      input.addEventListener('input', debouncedApply);
    });

    const syncChips = () => {
      root.querySelector('[data-quick-pickup]')?.setAttribute('aria-pressed', String(state.pickupOnly));
      root.querySelector('[data-quick-delivery]')?.setAttribute('aria-pressed', String(state.deliveryOnly));
    };

    root.querySelector('[data-quick-pickup]')?.addEventListener('click', () => {
      apply({ pickupOnly: !state.pickupOnly });
      syncChips();
      const input = filtersBox.querySelector('input[data-group="pickupOnly"]');
      if (input) input.checked = state.pickupOnly;
    });
    root.querySelector('[data-quick-delivery]')?.addEventListener('click', () => {
      apply({ deliveryOnly: !state.deliveryOnly });
      syncChips();
      const input = filtersBox.querySelector('input[data-group="deliveryOnly"]');
      if (input) input.checked = state.deliveryOnly;
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
          type: 'shop',
          filters: state,
          onApply: (values) => {
            state = { ...state, ...values, page: 1 };
            syncChips();
            paint();
          },
        });
        return;
      }
      if (event.target.closest('[data-action="clear-all-filters"]')) {
        state = { ...state, q: '', cities: [], verdicts: [], pickupOnly: false, deliveryOnly: false, page: 1 };
        filtersBox.querySelectorAll('input[type="checkbox"]').forEach((i) => (i.checked = false));
        const search = root.querySelector('[data-list-search]');
        if (search) search.value = '';
        syncChips();
        paint();
        return;
      }
      const clear = event.target.closest('[data-action="clear-filter"]');
      if (clear) {
        const { key, value } = clear.dataset;
        const patch = {};
        if (key === 'q') patch.q = '';
        else if (key === 'pickupOnly') patch.pickupOnly = false;
        else if (key === 'deliveryOnly') patch.deliveryOnly = false;
        else if (Array.isArray(state[key])) patch[key] = state[key].filter((v) => v !== value);
        state = { ...state, ...patch, page: 1 };
        filtersBox.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          const group = input.dataset.group;
          if (group === 'pickupOnly') input.checked = state.pickupOnly;
          else if (group === 'deliveryOnly') input.checked = state.deliveryOnly;
          else if (Array.isArray(state[group])) input.checked = state[group].includes(input.value);
        });
        syncChips();
        paint();
      }
    });
  },
};
