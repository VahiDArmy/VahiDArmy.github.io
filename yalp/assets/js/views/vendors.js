/**
 * بازاربان — فهرست فروشنده‌ها
 * ---------------------------------------------------------------------------
 * جست‌وجو، فیلتر چندگانه (نوع، شهر، سطح)، مرتب‌سازی، نمای شبکه‌ای/جدولی و
 * صفحه‌بندی؛ همه در آدرس ذخیره می‌شوند تا لینک قابل اشتراک باشد.
 */

import { icon } from '../icons.js';
import { CONFIG, KINDS, LEVELS } from '../config.js';
import { esc, attr, toFa, fmtInt, debounce, $ } from '../utils.js';
import * as store from '../store.js';
import {
  entityCard,
  emptyState,
  pageHead,
  breadcrumbs,
  sectionHead,
  activeFiltersRow,
  setupReveal,
  toast,
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

const PATH = '/vendors';

function readState(ctx) {
  const base = baseFilters(ctx.query);
  return {
    ...base,
    kinds: listOf(ctx.query.kinds),
    cities: listOf(ctx.query.cities),
    verdicts: listOf(ctx.query.verdicts),
    verifiedOnly: ctx.query.verified === '1',
    minReviews: Number(ctx.query.minReviews || 0),
  };
}

function toQuery(state) {
  return {
    q: state.q,
    kinds: state.kinds,
    cities: state.cities,
    verdicts: state.verdicts,
    verified: state.verifiedOnly ? '1' : '',
    minReviews: state.minReviews || '',
    sort: state.sort,
    view: state.view,
    page: state.page,
  };
}

function filterLabels() {
  return {
    q: 'جست‌وجو',
    kinds: 'نوع',
    cities: 'شهر',
    verdicts: 'سطح',
    verifiedOnly: 'تأییدشده',
    minReviews: 'حداقل رأی',
  };
}

export const vendorsView = {
  title: 'فروشنده‌ها',
  render(ctx) {
    const state = readState(ctx);
    const all = store.allVendors();
    const filtered = store.filterVendors(all, state);
    const result = paginate(
      sortVendors(store.filterVendors(all, { ...state, q: state.q }), state.sort),
      state.page,
    );
    // filtered بالا برای شمارش کل استفاده می‌شود؛ صفحه‌بندی روی مرتب‌شده انجام شده
    const scored = filtered.filter((v) => store.scoreFor('vendor', v.id).total > 0).length;

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'فروشنده‌ها' }])}
        ${pageHead({
          eyebrow: 'فهرست زندهٔ بازار',
          title: 'فروشنده‌ها را بشناس',
          sub: `پلتفرم‌ها، مارکت‌پلیس‌ها و زنجیره‌ها با شاخص رضایت واقعی. ${toFa(all.length)} فروشنده ثبت شده و ${toFa(scored)} مورد رأی دارد.`,
          actions: `
            <a class="btn btn--outline btn--sm" href="#/compare" data-link>${icon('columns', 15)} مقایسه</a>
            <a class="btn btn--primary btn--sm" href="#/new?type=vendor" data-link>${icon('plus', 15)} فروشندهٔ جدید</a>`,
        })}

        <div class="sidebar-layout">
          <div id="filters-panel">${filtersPanel({ type: 'vendor', filters: state, resultCount: filtered.length, total: all.length })}</div>

          <div class="sidebar-layout__main">
            <div class="listing-controls surface" style="padding:var(--sp-4);margin-bottom:var(--sp-4)">
              <div class="input-group" style="flex:1;min-width:220px">
                <span class="input-group__icon">${icon('search', 17)}</span>
                <input class="input" type="search" placeholder="نام فروشنده، شهر یا نوع…" value="${attr(state.q)}"
                  data-list-search aria-label="جست‌وجو در فروشنده‌ها" />
              </div>
              <div class="cluster" style="gap:var(--sp-2);margin-top:var(--sp-3)">
                ${KINDS.map(
                  (kind) => `<button class="chip chip--button" type="button" data-quick-kind="${kind.id}"
                    aria-pressed="${state.kinds.includes(kind.id)}">${icon(kind.icon, 13)} ${esc(kind.label)}</button>`,
                ).join('')}
                <button class="chip chip--button" type="button" data-quick-verified aria-pressed="${state.verifiedOnly}">
                  ${icon('verified', 13)} تأییدشده
                </button>
              </div>
            </div>

            <div id="list-toolbar">
              ${listingToolbar({
                count: filtered.length,
                total: all.length,
                sortOptions: CONFIG.SORTS.vendor,
                sort: state.sort,
                view: state.view,
                query: state.q,
              })}
            </div>

            <div id="active-filters" style="margin-top:var(--sp-3)">
              ${activeFiltersRow(
                {
                  q: state.q,
                  kinds: state.kinds,
                  cities: state.cities,
                  verdicts: state.verdicts,
                  verifiedOnly: state.verifiedOnly,
                  minReviews: state.minReviews || '',
                },
                filterLabels(),
              )}
            </div>

            <div id="list-results" style="margin-top:var(--sp-4)">
              ${renderResults(state, result)}
            </div>
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
      const all = store.allVendors();
      const filtered = store.filterVendors(all, { ...state, q: state.q });
      const sorted = sortVendors(filtered, state.sort);
      const result = paginate(sorted, state.page);

      resultsBox.innerHTML = renderResults(state, result);
      toolbarBox.innerHTML = listingToolbar({
        count: filtered.length,
        total: all.length,
        sortOptions: CONFIG.SORTS.vendor,
        sort: state.sort,
        view: state.view,
        query: state.q,
      });
      chipsBox.innerHTML = activeFiltersRow(
        {
          q: state.q,
          kinds: state.kinds,
          cities: state.cities,
          verdicts: state.verdicts,
          verifiedOnly: state.verifiedOnly,
          minReviews: state.minReviews || '',
        },
        filterLabels(),
      );
      writeListQuery(PATH, toQuery(state));
      setupReveal(resultsBox);
      bindToolbarEvents();
    };

    const apply = (patch, { resetPage = true } = {}) => {
      state = { ...state, ...patch, ...(resetPage ? { page: 1 } : {}) };
      paint();
    };

    const bindToolbarEvents = () => {
      toolbarBox.querySelector('[data-sort-select]')?.addEventListener('change', (event) => {
        apply({ sort: event.target.value });
      });
      toolbarBox.querySelectorAll('[data-view]').forEach((button) => {
        button.addEventListener('click', () => {
          apply({ view: button.dataset.view });
        });
      });
    };

    bindToolbarEvents();
    bindSearchInput(root, (value) => apply({ q: value }));

    // فیلترهای کنار صفحه: تغییر = اعمال فوری
    const debouncedApply = debounce(() => {
      apply({ ...readFilterInputs(filtersBox) });
    }, 140);
    filtersBox.addEventListener('change', debouncedApply);
    filtersBox.querySelectorAll('[data-price-min], [data-price-max]').forEach((input) => {
      input.addEventListener('input', debouncedApply);
    });

    // کلیدهای سریع
    root.querySelectorAll('[data-quick-kind]').forEach((button) => {
      button.addEventListener('click', () => {
        const kind = button.dataset.quickKind;
        const next = state.kinds.includes(kind)
          ? state.kinds.filter((k) => k !== kind)
          : [...state.kinds, kind];
        button.setAttribute('aria-pressed', String(next.includes(kind)));
        syncFilterInputs(filtersBox, 'kinds', next);
        apply({ kinds: next });
      });
    });
    root.querySelector('[data-quick-verified]')?.addEventListener('click', (event) => {
      const next = !state.verifiedOnly;
      event.currentTarget.setAttribute('aria-pressed', String(next));
      const input = filtersBox.querySelector('input[data-group="verifiedOnly"]');
      if (input) input.checked = next;
      apply({ verifiedOnly: next });
    });

    // رویدادهای کلیک
    root.addEventListener('click', (event) => {
      const pageBtn = event.target.closest('[data-action="goto-page"]');
      if (pageBtn && !pageBtn.disabled) {
        apply({ page: Number(pageBtn.dataset.page) }, { resetPage: false });
        resultsBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (event.target.closest('[data-action="open-mobile-filters"]')) {
        mountMobileFilters({
          type: 'vendor',
          filters: state,
          onApply: (values) => {
            syncQuickButtons(values);
            apply(values);
          },
        });
        return;
      }

      if (event.target.closest('[data-action="clear-all-filters"]')) {
        resetAll();
        return;
      }

      const clear = event.target.closest('[data-action="clear-filter"]');
      if (clear) {
        const key = clear.dataset.key;
        const value = clear.dataset.value;
        const patch = {};
        if (key === 'q') patch.q = '';
        else if (key === 'verifiedOnly') patch.verifiedOnly = false;
        else if (key === 'minReviews') patch.minReviews = 0;
        else if (Array.isArray(state[key])) patch[key] = state[key].filter((v) => v !== value);
        apply(patch);
        syncFilterInputsFromState();
        return;
      }

      if (event.target.closest('[data-action="apply-filters"]')) {
        apply(readFilterInputs(filtersBox));
      }
    });

    function resetAll() {
      state = {
        ...state,
        q: '',
        kinds: [],
        cities: [],
        verdicts: [],
        verifiedOnly: false,
        minReviews: 0,
        page: 1,
      };
      filtersBox.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        input.checked = false;
      });
      const search = root.querySelector('[data-list-search]');
      if (search) search.value = '';
      root.querySelectorAll('[data-quick-kind]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
      root.querySelector('[data-quick-verified]')?.setAttribute('aria-pressed', 'false');
      paint();
    }

    function syncFilterInputs(container, group, values) {
      container.querySelectorAll(`input[data-group="${group}"]`).forEach((input) => {
        input.checked = values.includes(input.value);
      });
    }

    function syncQuickButtons(values) {
      root.querySelectorAll('[data-quick-kind]').forEach((button) => {
        button.setAttribute('aria-pressed', String(values.kinds?.includes(button.dataset.quickKind)));
      });
      root.querySelector('[data-quick-verified]')?.setAttribute('aria-pressed', String(Boolean(values.verifiedOnly)));
    }

    function syncFilterInputsFromState() {
      filtersBox.querySelectorAll('input[type="checkbox"]').forEach((input) => {
        const group = input.dataset.group;
        if (group === 'verifiedOnly') input.checked = Boolean(state.verifiedOnly);
        else if (group === 'minReviews') input.checked = state.minReviews >= 3;
        else if (Array.isArray(state[group])) input.checked = state[group].includes(input.value);
      });
    }

    // اگر شماره صفحه از حد گذشته بود
    const all = store.allVendors();
    const totalPages = Math.max(1, Math.ceil(store.filterVendors(all, state).length / CONFIG.PAGE_SIZE));
    if (state.page > totalPages) {
      state.page = totalPages;
      paint();
    }
  },
};

/* --------------------------------------------------------------------------
   مرتب‌سازی
   -------------------------------------------------------------------------- */
function sortVendors(list, sort) {
  const rows = [...list];
  const scoreOf = (vendor) => store.scoreFor('vendor', vendor.id);
  switch (sort) {
    case 'score_asc':
      return rows.sort((a, b) => {
        const sa = scoreOf(a);
        const sb = scoreOf(b);
        if (!sa.total && sb.total) return 1;
        if (!sb.total && sa.total) return -1;
        return sa.score - sb.score || sb.total - sa.total;
      });
    case 'reviews_desc':
      return rows.sort(
        (a, b) =>
          scoreOf(b).total - scoreOf(a).total ||
          store.commentsOf('vendor', b.id).length - store.commentsOf('vendor', a.id).length,
      );
    case 'newest':
      return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'name_asc':
      return rows.sort((a, b) => String(a.nameFa).localeCompare(String(b.nameFa), 'fa'));
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

/* --------------------------------------------------------------------------
   نتایج
   -------------------------------------------------------------------------- */
function renderResults(state, result) {
  if (!result.items.length) {
    return emptyState({
      iconName: 'search',
      title: 'فروشنده‌ای با این فیلترها پیدا نشد',
      text: 'فیلترها را ساده‌تر کن یا خودت فروشنده را اضافه کن. تجربه‌ات برای بقیه ارزش دارد.',
      actions: `
        <button class="btn btn--outline btn--sm" type="button" data-action="clear-all-filters">پاک‌کردن فیلترها</button>
        <a class="btn btn--primary btn--sm" href="#/new?type=vendor" data-link>${icon('plus', 14)} افزودن فروشنده</a>`,
    });
  }

  if (state.view === 'table') {
    return `${entityTable('vendor', result.items)}${pagerFor(result)}`;
  }

  return `<div class="grid grid--auto">
      ${result.items.map((vendor) => entityCard('vendor', vendor)).join('')}
    </div>
    ${pagerFor(result)}`;
}
