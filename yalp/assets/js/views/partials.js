/**
 * بازاربان — قطعه‌های مشترک صفحه‌ها
 * ---------------------------------------------------------------------------
 * فیلترهای کنار صفحه، نوار ابزار، همگام‌سازی آدرس و مارک‌آپ‌های تکرارشونده
 * بین فهرست فروشنده‌ها، فروشگاه‌ها و محصولات.
 */

import { icon } from '../icons.js';
import { CONFIG, CATEGORIES, CITIES, KINDS, LEVELS } from '../config.js';
import {
  esc,
  attr,
  toFa,
  fmtInt,
  fmtPrice,
  debounce,
  $,
  $$,
  normalizeFa,
} from '../utils.js';
import * as store from '../store.js';
import { emptyState, pager, scoreBadge } from '../ui.js';
import { stackedLevelBar } from '../charts.js';

/* --------------------------------------------------------------------------
   خواندن/نوشتن وضعیت فهرست در آدرس
   -------------------------------------------------------------------------- */
export const listOf = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => item.trim())
    .filter(Boolean);

export const numOr = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function baseFilters(query = {}) {
  return {
    q: String(query.q || '').trim(),
    sort: String(query.sort || 'score_desc'),
    page: Math.max(1, numOr(query.page, 1)),
    view: query.view === 'table' ? 'table' : 'grid',
  };
}

/** نوشتن وضعیت فهرست در آدرس، بدون رفرش و بدون پرش اسکرول */
export function writeListQuery(path, state) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      params.set(key, value.join(','));
    } else if (key === 'page' && Number(value) <= 1) {
      continue;
    } else if (key === 'sort' && value === 'score_desc') {
      continue;
    } else if (key === 'view' && value === 'grid') {
      continue;
    } else {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  const url = `${window.location.pathname}${window.location.search}#${path}${qs ? `?${qs}` : ''}`;
  window.history.replaceState(null, '', url);
}

/* --------------------------------------------------------------------------
   فیلترها
   -------------------------------------------------------------------------- */
export function filterCard({ id, title, body, open = true, hint = '' }) {
  return `<section class="filter-card" data-filter-card="${attr(id)}" data-open="${open}">
    <button class="filter-card__head" type="button" data-action="toggle-filter-card" data-target="${attr(id)}" aria-expanded="${open}">
      <span>${esc(title)} ${hint ? `<span class="t-faint" style="font-weight:400">${esc(hint)}</span>` : ''}</span>
      <span class="filter-card__chev">${icon('chevron-up', 15)}</span>
    </button>
    <div class="filter-card__body" id="filter-${attr(id)}">${body}</div>
  </section>`;
}

export function filterOption({ group, value, label, count = null, checked = false, dot = null }) {
  return `<label class="filter-option">
    <input type="checkbox" name="${attr(group)}" value="${attr(value)}" ${checked ? 'checked' : ''} data-filter-input data-group="${attr(group)}" />
    <span class="filter-option__tick">${icon('check', 11)}</span>
    ${dot ? `<span class="dot dot--${dot}"></span>` : ''}
    <span>${esc(label)}</span>
    ${count !== null ? `<span class="filter-option__count">${toFa(count)}</span>` : ''}
  </label>`;
}

export function verdictOptions(selected = []) {
  const counts = store.levelFacets('vendor');
  return LEVELS.map((level) =>
    filterOption({
      group: 'verdicts',
      value: level.id,
      label: level.label,
      count: counts[level.id] || 0,
      checked: selected.includes(level.id),
      dot: level.className,
    }),
  ).join('');
}

export function levelFilterFor(type, selected = []) {
  const counts = store.levelFacets(type);
  return LEVELS.map((level) =>
    filterOption({
      group: 'verdicts',
      value: level.id,
      label: level.label,
      count: counts[level.id] || 0,
      checked: selected.includes(level.id),
      dot: level.className,
    }),
  ).join('');
}

export function cityFilter(selected = []) {
  return store
    .cityFacets('vendor')
    .slice(0, 10)
    .map((facet) =>
      filterOption({
        group: 'cities',
        value: facet.city,
        label: facet.city,
        count: facet.count,
        checked: selected.includes(facet.city),
      }),
    )
    .join('');
}

export function kindFilter(selected = []) {
  return store
    .kindFacets()
    .filter((kind) => kind.count > 0)
    .map((kind) =>
      filterOption({
        group: 'kinds',
        value: kind.id,
        label: kind.label,
        count: kind.count,
        checked: selected.includes(kind.id),
      }),
    )
    .join('');
}

export function categoryFilter(selected = []) {
  return store
    .categoryFacets()
    .map((category) =>
      filterOption({
        group: 'categories',
        value: category.id,
        label: category.label,
        count: category.count,
        checked: selected.includes(category.id),
        dot: null,
      }),
    )
    .join('');
}

export function filterSummary({ count, total, onReset = '' }) {
  return `<div class="filter-summary">
    <span><b class="t-strong">${toFa(count)}</b> از ${toFa(total)} مورد</span>
    ${onReset || `<button class="link" type="button" data-action="clear-all-filters" style="font-size:var(--fs-2xs)">پاک‌کردن</button>`}
  </div>`;
}

/* --------------------------------------------------------------------------
   نوار ابزار فهرست
   -------------------------------------------------------------------------- */
export function listingToolbar({ count, total, sortOptions, sort, view = 'grid', extra = '', showViewToggle = true, query = '' }) {
  return `<div class="toolbar" role="toolbar" aria-label="ابزار فهرست">
    <button class="btn btn--outline btn--sm filterbar__filters-btn" type="button" data-action="open-mobile-filters">
      ${icon('filter', 15)} فیلترها
    </button>
    <span class="result-count"><b>${toFa(fmtInt(count))}</b> نتیجه${total ? ` از ${toFa(fmtInt(total))}` : ''}</span>
    ${query ? `<span class="chip chip--soft">«${esc(query)}»</span>` : ''}
    <div class="toolbar__spacer"></div>
    ${extra}
    <div class="toolbar__group">
      <span class="toolbar__label">مرتب‌سازی</span>
      <select class="select" style="min-height:32px;padding-block:4px;font-size:var(--fs-xs);width:auto" data-sort-select aria-label="مرتب‌سازی">
        ${sortOptions
          .map(
            (option) =>
              `<option value="${attr(option.id)}" ${option.id === sort ? 'selected' : ''}>${esc(option.label)}</option>`,
          )
          .join('')}
      </select>
    </div>
    ${
      showViewToggle
        ? `<div class="segmented" role="group" aria-label="نمایش">
            <button class="segmented__btn" type="button" data-view="grid" aria-pressed="${view === 'grid'}" aria-label="نمایش شبکه‌ای">${icon(
              'grid',
              14,
            )}</button>
            <button class="segmented__btn" type="button" data-view="table" aria-pressed="${view === 'table'}" aria-label="نمایش جدولی">${icon(
              'list',
              14,
            )}</button>
          </div>`
        : ''
    }
  </div>`;
}

/* --------------------------------------------------------------------------
   پنل فیلترها (دسکتاپ)
   -------------------------------------------------------------------------- */
export function filtersPanel({ type = 'vendor', filters = {}, resultCount = 0, total = 0 }) {
  const sections = [];

  sections.push(
    filterCard({
      id: 'levels',
      title: 'سطح تجربه',
      body: levelFilterFor(type, filters.verdicts || []),
    }),
  );

  if (type === 'vendor') {
    sections.push(
      filterCard({
        id: 'kinds',
        title: 'نوع فروشنده',
        body: kindFilter(filters.kinds || []),
      }),
    );
    sections.push(
      filterCard({
        id: 'cities',
        title: 'شهر',
        body: cityFilter(filters.cities || []),
      }),
    );
    sections.push(
      filterCard({
        id: 'more',
        title: 'بیشتر',
        open: false,
        body: `
          ${filterOption({
            group: 'verifiedOnly',
            value: '1',
            label: 'فقط فروشنده‌های تأییدشده',
            checked: Boolean(filters.verifiedOnly),
          })}
          ${filterOption({
            group: 'minReviews',
            value: '3',
            label: 'حداقل ۳ رأی',
            checked: Number(filters.minReviews) >= 3,
          })}
        `,
      }),
    );
  }

  if (type === 'shop') {
    sections.push(
      filterCard({
        id: 'cities',
        title: 'شهر',
        body: cityFilter(filters.cities || []),
      }),
    );
    sections.push(
      filterCard({
        id: 'services',
        title: 'نوع خدمت',
        body: `
          ${filterOption({ group: 'pickupOnly', value: '1', label: 'امکان تحویل حضوری', checked: Boolean(filters.pickupOnly) })}
          ${filterOption({ group: 'deliveryOnly', value: '1', label: 'ارسال به آدرس', checked: Boolean(filters.deliveryOnly) })}
        `,
      }),
    );
  }

  if (type === 'product') {
    sections.push(
      filterCard({
        id: 'categories',
        title: 'دسته‌بندی',
        body: categoryFilter(filters.categories || []),
      }),
    );
    sections.push(
      filterCard({
        id: 'price',
        title: 'بازهٔ قیمت',
        body: `
          <div class="field">
            <label class="label" for="price-min">از (تومان)</label>
            <input class="input" id="price-min" name="priceMin" type="number" inputmode="numeric" min="0" step="1000"
              value="${filters.priceMin ?? ''}" placeholder="۰" data-price-min />
          </div>
          <div class="field">
            <label class="label" for="price-max">تا (تومان)</label>
            <input class="input" id="price-max" name="priceMax" type="number" inputmode="numeric" min="0" step="1000"
              value="${filters.priceMax ?? ''}" placeholder="بدون سقف" data-price-max />
          </div>
          ${filterOption({
            group: 'availableOnly',
            value: '1',
            label: 'فقط موجود در انبار',
            checked: Boolean(filters.availableOnly),
          })}
        `,
      }),
    );
  }

  sections.push(
    `<div class="filter-rail__actions">
      <button class="btn btn--ghost btn--sm" type="button" data-action="clear-all-filters">${icon('refresh', 14)} پاک‌کردن</button>
      <button class="btn btn--primary btn--sm" type="button" data-action="apply-filters">${icon('check', 14)} اعمال</button>
    </div>`,
  );

  return `<aside class="filter-rail desktop-filters">
    <div class="filter-card">
      <div style="padding:var(--sp-5) var(--sp-6) var(--sp-3)">
        <div class="row row--between">
          <strong style="font-size:var(--fs-xs)">${icon('filter', 14)} فیلترها</strong>
          <span class="chip chip--soft">${toFa(resultCount)} / ${toFa(total)}</span>
        </div>
      </div>
    </div>
    ${sections.join('')}
  </aside>`;
}

/* --------------------------------------------------------------------------
   نمای جدولی
   -------------------------------------------------------------------------- */
export function entityTable(type, rows, { sort, sortOptions } = {}) {
  const head =
    type === 'vendor'
      ? `<th>فروشنده</th><th>نوع</th><th>شهر</th><th class="table__num">شعبه</th><th class="table__num">محصول</th><th>وضعیت</th><th class="table__num">رأی</th>`
      : type === 'shop'
        ? `<th>فروشگاه</th><th>فروشنده</th><th>شهر</th><th>ساعت</th><th>خدمات</th><th>وضعیت</th><th class="table__num">رأی</th>`
        : `<th>محصول</th><th>برند</th><th>دسته</th><th class="table__num">قیمت</th><th>وضعیت</th><th class="table__num">رأی</th>`;

  const body = rows
    .map((entity) => {
      const href = store.entityHref(type, entity);
      const score = store.scoreFor(type, entity.id);
      const name = `<a href="${attr(href)}" data-link style="color:var(--text-strong)">${esc(store.entityName(type, entity))}</a>`;
      if (type === 'vendor') {
        return `<tr>
          <td><span class="table__name">${name}</span></td>
          <td>${esc(CONFIG.KIND_MAP[entity.kind] || '')}</td>
          <td>${esc(entity.city || '—')}</td>
          <td class="table__num">${toFa(store.shopsOfVendor(entity.id).length)}</td>
          <td class="table__num">${toFa(store.productsOfVendor(entity.id).length)}</td>
          <td>${scoreBadge('vendor', entity)}</td>
          <td class="table__num">${toFa(score.total)}</td>
        </tr>`;
      }
      if (type === 'shop') {
        const vendor = store.getVendor(entity.vendorId);
        return `<tr>
          <td><span class="table__name">${name}</span></td>
          <td><a href="${attr(store.entityHref('vendor', vendor))}" data-link class="link--muted">${esc(vendor?.nameFa || '—')}</a></td>
          <td>${esc(entity.city || '—')}</td>
          <td>${esc(entity.hours || '—')}</td>
          <td>${[entity.pickup ? 'حضوری' : '', entity.delivery ? 'ارسال' : ''].filter(Boolean).join(' · ') || '—'}</td>
          <td>${scoreBadge('shop', entity)}</td>
          <td class="table__num">${toFa(score.total)}</td>
        </tr>`;
      }
      return `<tr>
        <td><span class="table__name">${name}</span></td>
        <td>${esc(entity.brand || '—')}</td>
        <td>${esc(CONFIG.CATEGORY_MAP[entity.category] || '—')}</td>
        <td class="table__num">${esc(fmtPrice(entity.price))}</td>
        <td>${scoreBadge('product', entity)}</td>
        <td class="table__num">${toFa(score.total)}</td>
      </tr>`;
    })
    .join('');

  return `<div class="table-wrap">
    <table class="table">
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="7">${emptyState({ title: 'موردی پیدا نشد' })}</td></tr>`}</tbody>
    </table>
  </div>`;
}

/* --------------------------------------------------------------------------
   توزیع نتایج و صفحه‌بندی
   -------------------------------------------------------------------------- */
export function paginate(rows, page, pageSize = CONFIG.PAGE_SIZE) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total,
    pageCount,
    page: safePage,
    from: total ? start + 1 : 0,
    to: Math.min(start + pageSize, total),
  };
}

export function pagerFor(result) {
  return pager(result.page, result.pageCount, {
    info: result.total
      ? `نمایش ${toFa(result.from)}–${toFa(result.to)} از ${toFa(result.total)}`
      : '',
  });
}

/** نمایش آماری بالای نتایج */
export function resultSummary(rows, type) {
  const scored = rows.filter((row) => store.scoreFor(type, row.id).total > 0).length;
  return `<p class="t-faint" style="font-size:var(--fs-2xs);margin-bottom:var(--sp-4)">
    ${toFa(rows.length)} مورد${scored ? ` · ${toFa(scored)} مورد دارای رأی` : ''}
  </p>`;
}

/* --------------------------------------------------------------------------
   فعال‌سازی فیلترها
   -------------------------------------------------------------------------- */
/**
 * خواندن همهٔ فیلترهای داخل یک ریشه
 */
export function readFilterInputs(root) {
  const groups = {};
  $$('input[type="checkbox"][data-filter-input]:checked', root).forEach((input) => {
    const group = input.dataset.group;
    if (!groups[group]) groups[group] = [];
    groups[group].push(input.value);
  });

  const priceMinNode = root.querySelector('[data-price-min]');
  const priceMaxNode = root.querySelector('[data-price-max]');

  return {
    verdicts: groups.verdicts || [],
    kinds: groups.kinds || [],
    cities: groups.cities || [],
    categories: groups.categories || [],
    verifiedOnly: Boolean(groups.verifiedOnly?.length),
    pickupOnly: Boolean(groups.pickupOnly?.length),
    deliveryOnly: Boolean(groups.deliveryOnly?.length),
    availableOnly: Boolean(groups.availableOnly?.length),
    minReviews: groups.minReviews?.length ? numOr(groups.minReviews[0], 0) : 0,
    priceMin: priceMinNode && priceMinNode.value !== '' ? numOr(priceMinNode.value, null) : null,
    priceMax: priceMaxNode && priceMaxNode.value !== '' ? numOr(priceMaxNode.value, null) : null,
  };
}

/** پنل فیلتر موبایل */
export function mountMobileFilters({ type, filters, onApply }) {
  const root = $('#modal-root');
  if (!root) return;
  const existing = $('#mobile-filters');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'mobile-filters';
  wrapper.id = 'mobile-filters';
  wrapper.innerHTML = `
    <div class="overlay-backdrop"></div>
    <div class="mobile-filters__panel" role="dialog" aria-modal="true" aria-label="فیلترها">
      <div class="mobile-filters__head">
        <strong>${icon('filter', 15)} فیلترها</strong>
        <button class="icon-btn" type="button" data-close-filters aria-label="بستن">${icon('close', 18)}</button>
      </div>
      <div class="mobile-filters__body filter-rail">
        ${filtersPanel({ type, filters, resultCount: 0, total: 0 })}
      </div>
      <div class="mobile-filters__foot">
        <button class="btn btn--outline" type="button" data-clear-mobile>پاک‌کردن</button>
        <button class="btn btn--primary" type="button" data-apply-mobile>اعمال فیلترها</button>
      </div>
    </div>`;

  document.body.append(wrapper);
  document.body.dataset.scrollLocked = 'true';

  const close = () => {
    wrapper.remove();
    if (!document.querySelector('.modal, .drawer, .palette, .mobile-filters')) {
      document.body.dataset.scrollLocked = 'false';
    }
  };
  wrapper.querySelector('.overlay-backdrop')?.addEventListener('click', close);
  wrapper.querySelector('[data-close-filters]')?.addEventListener('click', close);
  wrapper.querySelector('[data-clear-mobile]')?.addEventListener('click', () => {
    wrapper.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.checked = false;
    });
    wrapper.querySelectorAll('[data-price-min], [data-price-max]').forEach((input) => {
      input.value = '';
    });
  });
  wrapper.querySelector('[data-apply-mobile]')?.addEventListener('click', () => {
    const panel = wrapper.querySelector('.filter-rail');
    onApply?.(readFilterInputs(panel));
    close();
  });
}

/** یک بازهٔ زمانی آماده برای نمودار فعالیت */
export function activityBuckets(days = 14) {
  const buckets = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86400000);
    buckets.push({
      date,
      label: date.toLocaleDateString('fa-IR', { day: 'numeric' }),
      key: date.toISOString().slice(0, 10),
      value: 0,
    });
  }
  const map = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const comment of store.getState().comments) {
    const key = String(comment.createdAt).slice(0, 10);
    const bucket = map.get(key);
    if (bucket) bucket.value += 1;
  }
  return buckets;
}

/** جست‌وجوی تایپ‌شده با تأخیر در نوار فهرست */
export function bindSearchInput(root, onSearch) {
  const input = root.querySelector('[data-list-search]');
  if (!input) return;
  const run = debounce(() => onSearch(input.value.trim()), 280);
  input.addEventListener('input', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run.flush();
    }
  });
}

export { emptyState, pager, stackedLevelBar, normalizeFa, toFa, fmtInt };
