/* ==========================================================================
   home.js — صفحه اصلی: جست‌وجوی زنده روی لیست خریدها (پیش‌فرض)
   ========================================================================== */

import { getState, subscribe } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import {
  buildIndex,
  hasAnyData,
  allCategories,
  allTags,
  ratingInfo,
  RATING_LIST,
  ENTITY_TYPES,
} from '../lib/domain.js';
import {
  searchReviews,
  EMPTY_FILTERS,
  activeFilterCount,
  SORT_OPTIONS,
  highlightTokens,
  parseQuery,
} from '../lib/search.js';
import { openReviewSheet, openAddToList } from '../components/entitySheet.js';
import { openReviewForm } from './reviewForm.js';
import { openMenu, confirmDialog, toast, openModal, setBusy } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { updateQuery } from '../lib/router.js';
import { esc, faNum, fmtInt, debounce, copyText, todayISO, parseNum } from '../lib/utils.js';
import { formatJalali } from '../lib/jalali.js';
import {
  ratingPill,
  reviewRowHTML,
  tableHeadHTML,
  pagerHTML,
  emptyState,
  callout,
  skeletonRows,
  entityAvatar,
} from '../components/parts.js';
import { createDateInput } from '../components/datepicker.js';

const PAGE_SIZE = 12;

export function mount(container, ctx = {}) {
  const initialQuery = ctx.query?.get('q') || '';
  const view = {
    query: initialQuery,
    filters: { ...EMPTY_FILTERS, ratings: [], vendorIds: [] },
    sort: ctx.query?.get('sort') || 'newest',
    page: 1,
    selection: new Set(),
    searchFocused: false,
  };

  container.innerHTML = `<div class="page__inner home-simple">
    <div class="home-search">
      <div class="searchbox searchbox--solo">
        ${icon('search', 22, 'searchbox__icon')}
        <input class="searchbox__input" type="search" data-home-search autocomplete="off" spellcheck="false"
          placeholder="جست‌وجو در خریدها — محصول، فروشگاه، پلتفرم، برچسب…"
          value="${esc(view.query)}" aria-label="جست‌وجو در خریدها" />
        <span class="searchbox__spinner" data-search-spinner hidden></span>
        <button type="button" class="searchbox__clear" data-search-clear ${view.query ? '' : 'hidden'} aria-label="پاک کردن جست‌وجو">${icon('x', 11)}</button>
        <span class="kbd hide-sm">/</span>
      </div>
    </div>

    <section class="home-list" aria-label="لیست خریدها">
      <div data-home-list></div>
      <div data-home-pager></div>
    </section>

    <div class="home-after">
      <div class="home-after__head">
        <div class="home-after__line" data-results-line>در حال آماده‌سازی…</div>
        <span class="badge badge--outline" data-total-badge>—</span>
        <span class="u-grow"></span>
        <button type="button" class="icon-btn icon-btn--bordered" data-refresh aria-label="بارگذاری مجدد">${icon('refresh', 15)}</button>
        <button type="button" class="btn btn--primary btn--sm" data-new-review>${icon('plus', 15)} ثبت خرید</button>
      </div>

      <div class="home-toolbar">
        <select class="select" data-sort style="width:auto;min-width:150px" aria-label="ترتیب نمایش">
          ${SORT_OPTIONS.map((option) => `<option value="${option.key}" ${view.sort === option.key ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn--soft btn--sm" data-open-filters>
          ${icon('sliders', 15)} فیلترها
          <span class="badge badge--good" data-filter-count hidden>۰</span>
        </button>
      </div>

      <div class="chips chips--scroll" data-rating-chips aria-label="فیلتر امتیاز"></div>

      <div class="filter-bar" data-quick-filters>
        <div class="filter-bar__row">
          <span class="filter-bar__label">پلتفرم</span>
          <div class="chips" data-vendor-chips></div>
        </div>
      </div>

      <div class="active-filters" data-active-filters hidden></div>
      <div class="search-summary" data-search-summary></div>
    </div>
  </div>`;

  const body = container.querySelector('.page__inner');
  const listSlot = container.querySelector('[data-home-list]');
  const pagerSlot = container.querySelector('[data-home-pager]');
  const resultsLine = container.querySelector('[data-results-line]');
  const totalBadge = container.querySelector('[data-total-badge]');
  const activeFilters = container.querySelector('[data-active-filters]');
  const summarySlot = container.querySelector('[data-search-summary]');
  const chipSlot = container.querySelector('[data-rating-chips]');
  const vendorSlot = container.querySelector('[data-vendor-chips]');
  const searchInput = container.querySelector('[data-home-search]');
  const spinner = container.querySelector('[data-search-spinner]');

  /* ------------------------------ محاسبه ------------------------------- */

  function compute() {
    const state = getState();
    const index = buildIndex(state.data);
    return { state, index, result: searchReviews({ query: view.query, filters: view.filters, sort: view.sort }, state.data, index) };
  }

  /* ---------------------------- چیپ‌ها -------------------------------- */

  function renderChips() {
    const { state } = compute();
    const counts = { good: 0, not_good: 0, shit: 0 };
    const vendorCounts = new Map();
    state.data.reviews.forEach((review) => {
      counts[review.rating] += 1;
      vendorCounts.set(review.vendor_id, (vendorCounts.get(review.vendor_id) || 0) + 1);
    });
    const total = state.data.reviews.length;

    chipSlot.innerHTML = `
      <button type="button" class="chip ${view.filters.ratings.length === 0 ? 'is-active' : ''}" data-rating-filter="all">
        ${icon('rows', 14)} همه <span class="chip__count">${faNum(total)}</span>
      </button>
      ${RATING_LIST.map(
        (meta) => `<button type="button" class="chip chip--${meta.tone} ${view.filters.ratings.includes(meta.key) ? 'is-active' : ''}" data-rating-filter="${meta.key}">
          <span class="dot" style="color:${meta.color}"></span>${esc(meta.label)} <span class="chip__count">${faNum(counts[meta.key])}</span>
        </button>`
      ).join('')}
    `;

    const vendors = state.data.vendors
      .map((vendor) => ({ vendor, count: vendorCounts.get(vendor.id) || 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    vendorSlot.innerHTML = `
      <button type="button" class="chip ${view.filters.vendorIds.length === 0 ? 'is-active' : ''}" data-vendor-filter="all">
        همه <span class="chip__count">${faNum(total)}</span>
      </button>
      ${vendors
        .map(
          (row) => `<button type="button" class="${view.filters.vendorIds.includes(row.vendor.id) ? 'is-active' : ''}" data-vendor-filter="${esc(row.vendor.id)}">
            <span class="dot" style="color:${esc(row.vendor.color)}"></span>${esc(row.vendor.name)}
            <span class="chip__count">${faNum(row.count)}</span>
          </button>`
        ).join('')}
      ${state.data.vendors.length > 6
        ? `<button type="button" class="chip chip--dashed" data-open-filters>+${faNum(state.data.vendors.length - 6)} دیگر</button>`
        : ''}
    `;

    const count = activeFilterCount(view.filters);
    const filterBadge = container.querySelector('[data-filter-count]');
    filterBadge.hidden = count === 0;
    filterBadge.textContent = faNum(count);

    renderActiveFilters();
  }

  function renderActiveFilters() {
    const chips = [];
    const filters = view.filters;

    filters.ratings.forEach((key) => {
      const meta = ratingInfo(key);
      chips.push({ label: meta?.label || key, kind: 'rating', value: key, color: meta?.color });
    });
    filters.vendorIds.forEach((id) => {
      const vendor = getState().data.vendors.find((row) => row.id === id);
      if (vendor) chips.push({ label: vendor.name, kind: 'vendor', value: id });
    });
    if (filters.category) chips.push({ label: `دسته: ${filters.category}`, kind: 'category' });
    filters.tags.forEach((tag) => chips.push({ label: `#${tag}`, kind: 'tag', value: tag }));
    if (filters.minPrice !== null || filters.maxPrice !== null) {
      chips.push({
        label: `قیمت: ${filters.minPrice ? fmtInt(filters.minPrice) : '۰'} تا ${filters.maxPrice ? fmtInt(filters.maxPrice) : 'بی‌نهایت'}`,
        kind: 'price',
      });
    }
    if (filters.from || filters.to) {
      chips.push({
        label: `تاریخ: ${filters.from ? formatJalali(filters.from, 'short') : '…'} تا ${filters.to ? formatJalali(filters.to, 'short') : '…'}`,
        kind: 'date',
      });
    }
    if (filters.hasNote) chips.push({ label: 'دارای یادداشت', kind: 'note' });
    if (filters.buyAgainOnly) chips.push({ label: 'دوباره می‌خرم', kind: 'again' });
    if (filters.noBad) chips.push({ label: 'بدون افتضاح', kind: 'nobad' });

    if (!chips.length) {
      activeFilters.hidden = true;
      activeFilters.innerHTML = '';
      return;
    }

    activeFilters.hidden = false;
    activeFilters.innerHTML = `
      <span class="u-row u-gap-1">${icon('filter', 13)} فیلتر فعال:</span>
      ${chips
        .map(
          (chip) => `\n        <button type="button" class="chip chip--static" style="cursor:pointer" data-clear-filter="${chip.kind}" data-value="${esc(chip.value || '')}">
            ${chip.color ? `<i class="vendor-dot" style="background:${chip.color}"></i>` : ''}
            ${esc(chip.label)}
            <span class="chip-remove">${icon('x', 10)}</span>
          </button>`
        ).join('')}
      <button type="button" class="chip chip--dashed" data-clear-all>پاک کردن همه</button>
    `;
  }

  /* ------------------------------ لیست -------------------------------- */

  function renderList() {
    const { state, index, result } = compute();
    const total = result.total;
    const tokens = highlightTokens(view.query);

    resultsLine.innerHTML = view.query
      ? `نتیجه جست‌وجو برای «<b>${esc(view.query)}</b>» — <b>${faNum(total)}</b> مورد`
      : `مجموع خریدهای ثبت‌شده — <b>${faNum(total)}</b> مورد`;
    totalBadge.textContent = `${faNum(total)} مورد`;

    if (!state.data.reviews.length) {
      listSlot.innerHTML = firstRunHTML();
      pagerSlot.innerHTML = '';
      summarySlot.innerHTML = '';
      return;
    }

    if (!total) {
      listSlot.innerHTML = emptyState({
        iconName: 'search',
        title: 'چیزی با این جست‌وجو پیدا نشد',
        text: 'املای عبارت را بررسی کن، فیلترها را بردار یا از جست‌وجوی ساده‌تری استفاده کن.',
        actions: `\n          <button type="button" class="btn btn--soft btn--sm" data-clear-all>پاک کردن جست‌وجو و فیلترها</button>\n          <button type="button" class="btn btn--ghost btn--sm" data-new-review>ثبت خرید جدید</button>\n        `,
      });
      pagerSlot.innerHTML = '';
      summarySlot.innerHTML = '';
      return;
    }

    const start = (view.page - 1) * PAGE_SIZE;
    const pageItems = result.items.slice(start, start + PAGE_SIZE);

    listSlot.innerHTML = `<div class="table-scroll">
      <table class="table table--reviews">
        ${tableHeadHTML({ sort: view.sort, tokens })}
        <tbody>
          ${pageItems.map((review) => reviewRowHTML(review, { selected: view.selection.has(review.id), tokens })).join('')}
        </tbody>
      </table>
    </div>`;

    pagerSlot.innerHTML = pagerHTML({ page: view.page, pageSize: PAGE_SIZE, total });

    const parsed = parseQuery(view.query);
    summarySlot.innerHTML = `
      <span>${icon('info', 12)} الگوهای جست‌وجو:</span>
      <code class="tag">product:نام محصول</code>
      <code class="tag">shop:نام فروشگاه</code>
      <code class="tag">vendor:پلتفرم</code>
      <code class="tag">tag:برچسب</code>
      <code class="tag">-کلمه حذف</code>
      ${parsed.tokens.length ? `<span>· ${faNum(parsed.tokens.length)} شرط فعال</span>` : ''}
    `;
  }

  function firstRunHTML() {
    return `<div class="first-run" style="margin:16px">
      <div class="empty__ico" style="margin:0">${icon('cart', 26)}</div>
      <h2>اولین خریدت را ثبت کن</h2>
      <p>هنوز هیچ تجربه‌ای ذخیره نشده. با ثبت اولین خرید، لیست و تحلیل‌ها ساخته می‌شوند.
      هر ترکیب محصول × فروشگاه × پلتفرم فقط یک بار امتیاز می‌گیرد.</p>
      <div class="first-run__steps">
        <span class="first-run__step">۱. محصول را انتخاب کن</span>
        <span class="first-run__step">۲. فروشگاه و پلتفرم را بگو</span>
        <span class="first-run__step">۳. امتیاز بده</span>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" data-new-review>${icon('plus', 16)} ثبت اولین خرید</button>
        <button type="button" class="btn btn--soft" data-seed-sample>${icon('sparkles', 16)} بارگذاری داده نمونه</button>
      </div>
    </div>`;
  }

  /* ---------------------------- نوار انتخاب ---------------------------- */

  function updateBulkBar() {
    const existing = body.querySelector('.bulkbar');
    if (existing) existing.remove();
    if (!view.selection.size) return;

    const bar = document.createElement('div');
    bar.className = 'bulkbar';
    bar.innerHTML = `
      <span class="u-xs">${faNum(view.selection.size)} مورد انتخاب شد</span>
      <button type="button" class="btn btn--danger btn--sm" data-bulk-delete>${icon('trash', 14)} حذف</button>
      <button type="button" class="btn btn--ghost btn--sm" data-bulk-clear>لغو انتخاب</button>
    `;
    body.appendChild(bar);
  }

  /* ------------------------------ رویداها ----------------------------- */

  function setQuery(value) {
    view.query = value;
    view.page = 1;
    if (searchInput.value !== value) searchInput.value = value;
    spinner.hidden = false;
    setTimeout(() => {
      spinner.hidden = true;
    }, 220);
    debouncedRender();
  }

  const debouncedRender = debounce(() => {
    renderList();
    renderChips();
    updateQuery({ q: view.query });
  }, 130);

  function toggleRating(key) {
    if (key === 'all') view.filters.ratings = [];
    else {
      const set = new Set(view.filters.ratings);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      view.filters.ratings = Array.from(set);
    }
    view.page = 1;
    renderList();
    renderChips();
    updateQuery({ rating: view.filters.ratings.join(',') });
  }

  function toggleVendor(id) {
    if (id === 'all') view.filters.vendorIds = [];
    else {
      const set = new Set(view.filters.vendorIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      view.filters.vendorIds = Array.from(set);
    }
    view.page = 1;
    renderList();
    renderChips();
  }

  function clearAll() {
    view.query = '';
    view.filters = { ...EMPTY_FILTERS, ratings: [], vendorIds: [] };
    view.page = 1;
    view.selection.clear();
    searchInput.value = '';
    renderList();
    renderChips();
    updateQuery({ q: '' });
  }

  container.addEventListener('input', (event) => {
    const target = event.target;
    if (target.matches('[data-home-search]')) {
      setQuery(target.value);
    }
  });

  container.addEventListener('click', async (event) => {
    const target = event.target;

    if (target.closest('[data-search-clear]')) {
      searchInput.value = '';
      setQuery('');
      searchInput.focus();
      return;
    }

    const ratingBtn = target.closest('[data-rating-filter]');
    if (ratingBtn) {
      toggleRating(ratingBtn.dataset.ratingFilter);
      return;
    }

    const vendorBtn = target.closest('[data-vendor-filter]');
    if (vendorBtn) {
      toggleVendor(vendorBtn.dataset.vendorFilter);
      return;
    }

    if (target.closest('[data-open-filters]')) {
      openFilters();
      return;
    }

    if (target.closest('[data-clear-all]')) {
      clearAll();
      return;
    }

    const clearFilter = target.closest('[data-clear-filter]');
    if (clearFilter) {
      const kind = clearFilter.dataset.clearFilter;
      const value = clearFilter.dataset.value;
      if (kind === 'rating') view.filters.ratings = view.filters.ratings.filter((key) => key !== value);
      if (kind === 'vendor') view.filters.vendorIds = view.filters.vendorIds.filter((id) => id !== value);
      if (kind === 'tag') view.filters.tags = view.filters.tags.filter((tag) => tag !== value);
      if (kind === 'category') view.filters.category = '';
      if (kind === 'price') {
        view.filters.minPrice = null;
        view.filters.maxPrice = null;
      }
      if (kind === 'date') {
        view.filters.from = '';
        view.filters.to = '';
      }
      if (kind === 'note') view.filters.hasNote = false;
      if (kind === 'again') view.filters.buyAgainOnly = false;
      if (kind === 'nobad') view.filters.noBad = false;
      view.page = 1;
      renderList();
      renderChips();
      return;
    }

    if (target.closest('[data-new-review]')) {
      openReviewForm({ onSaved: () => renderAll() });
      return;
    }

    if (target.closest('[data-seed-sample]')) {
      const btn = target.closest('[data-seed-sample]');
      setBusy(btn, true);
      try {
        await repo.importSampleIntoAccount();
        toast.success('داده نمونه بارگذاری شد.');
        renderAll();
      } catch (error) {
        toast.error(error.message);
      } finally {
        setBusy(btn, false);
      }
      return;
    }

    if (target.closest('[data-refresh]')) {
      try {
        await repo.reload();
        renderAll();
        toast.success('لیست به‌روزرسانی شد.');
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    const sortTh = target.closest('[data-sort]');
    if (sortTh) {
      const key = sortTh.dataset.sort;
      if (key === 'newest') view.sort = view.sort === 'newest' ? 'oldest' : 'newest';
      else if (key === 'best') view.sort = view.sort === 'best' ? 'worst' : 'best';
      else if (key === 'price-desc') view.sort = view.sort === 'price-desc' ? 'price-asc' : 'price-desc';
      else view.sort = key;
      view.page = 1;
      container.querySelector('[data-sort].select').value = view.sort;
      updateQuery({ sort: view.sort });
      renderList();
      return;
    }

    const pageBtn = target.closest('[data-page]');
    if (pageBtn) {
      const value = pageBtn.dataset.page;
      const pages = Math.max(1, Math.ceil(compute().result.total / PAGE_SIZE));
      if (value === 'prev') view.page = Math.max(1, view.page - 1);
      else if (value === 'next') view.page = Math.min(pages, view.page + 1);
      else view.page = Number(value);
      renderList();
      listSlot.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (target.closest('[data-bulk-clear]')) {
      view.selection.clear();
      renderList();
      return;
    }

    if (target.closest('[data-bulk-delete]')) {
      const count = view.selection.size;
      const ok = await confirmDialog({
        title: 'حذف گروهی',
        message: `${faNum(count)} تجربه انتخاب‌شده حذف شوند؟ این کار قابل بازگشت نیست.`,
        confirmText: 'حذف کن',
      });
      if (!ok) return;
      try {
        await repo.bulkDeleteReviews(Array.from(view.selection));
        view.selection.clear();
        toast.success('تجربه‌ها حذف شدند.');
        renderAll();
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    const checkAll = target.closest('[data-check-all]');
    if (checkAll) {
      const { result } = compute();
      const start = (view.page - 1) * PAGE_SIZE;
      const ids = result.items.slice(start, start + PAGE_SIZE).map((review) => review.id);
      if (view.selection.size >= ids.length && ids.every((id) => view.selection.has(id))) ids.forEach((id) => view.selection.delete(id));
      else ids.forEach((id) => view.selection.add(id));
      renderList();
      return;
    }

    const check = target.closest('[data-row-check]');
    if (check) {
      const row = check.closest('.list-item, tr[data-review-id]');
      const id = row?.dataset.reviewId;
      if (id) {
        if (check.checked) view.selection.add(id);
        else view.selection.delete(id);
        row.classList.toggle('is-selected', check.checked);
        updateBulkBar();
      }
      return;
    }

    const editBtn = target.closest('[data-row-edit]');
    if (editBtn) {
      const id = editBtn.closest('.list-item, tr[data-review-id]')?.dataset.reviewId;
      if (id) openReviewForm({ reviewId: id, onSaved: () => renderAll() });
      return;
    }

    const menuBtn = target.closest('[data-row-menu]');
    if (menuBtn) {
      event.stopPropagation();
      const id = menuBtn.closest('.list-item, tr[data-review-id]')?.dataset.reviewId;
      const review = getState().data.reviews.find((row) => row.id === id);
      if (!review) return;
      const index = buildIndex(getState().data);
      const productName = index.products.get(review.product_id)?.name || 'تجربه';
      openMenu(menuBtn, [
        { label: 'مشاهده جزئیات', icon: 'eye', onClick: () => openReviewSheet(id) },
        { label: 'ویرایش تجربه', icon: 'edit', onClick: () => openReviewForm({ reviewId: id, onSaved: () => renderAll() }) },
        { label: 'صفحه محصول', icon: 'package', onClick: () => import('../components/entitySheet.js').then((mod) => mod.openEntitySheet('product', review.product_id)) },
        { label: 'افزودن به لیست', icon: 'list', onClick: () => openAddToList('review', id) },
        { label: 'کپی خلاصه', icon: 'copy', onClick: async () => {
          const ok = await copyText(`${productName} · ${review.rating}`);
          toast[ok ? 'success' : 'error'](ok ? 'کپی شد.' : 'کپی نشد.');
        } },
        { sep: true },
        {
          label: 'حذف',
          icon: 'trash',
          danger: true,
          onClick: async () => {
            const ok = await confirmDialog({ title: 'حذف تجربه', message: `«${productName}» حذف شود؟`, confirmText: 'حذف کن' });
            if (!ok) return;
            try {
              await repo.deleteReview(id);
              toast.success('حذف شد.');
              renderAll();
            } catch (error) {
              toast.error(error.message);
            }
          },
        },
      ]);
      return;
    }

    const listItem = target.closest('.list-item, tr[data-review-id]');
    if (listItem && !target.closest('button') && !target.closest('input')) {
      openReviewSheet(listItem.dataset.reviewId);
    }
  });

  container.addEventListener('change', (event) => {
    if (event.target.matches('[data-sort].select')) {
      view.sort = event.target.value;
      view.page = 1;
      updateQuery({ sort: view.sort });
      renderList();
    }
  });

  container.addEventListener('keydown', (event) => {
    const listItem = event.target.closest('.list-item, tr[data-review-id]');
    if (listItem && (event.key === 'Enter' || event.key === ' ')) {
      if (event.target.closest('button, input')) return;
      event.preventDefault();
      openReviewSheet(listItem.dataset.reviewId);
    }
  });

  /* ---------------------------- مودال فیلترها --------------------------- */

  function openFilters() {
    const state = getState();
    const categories = allCategories(state.data);
    const tags = allTags(state.data).slice(0, 16);
    const selectedTags = new Set(view.filters.tags);

    const modal = openModal({
      title: 'فیلترهای پیشرفته',
      subtitle: 'هرچه دقیق‌تر فیلتر کنی، جدول سریع‌تر جواب می‌دهد.',
      size: 'lg',
      body: `
        <form class="filter-panel" data-filter-form>
          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="ff-category">دسته‌بندی محصول</label>
              <select class="select" id="ff-category" name="category">
                <option value="">همه دسته‌ها</option>
                ${categories.map((cat) => `<option value="${esc(cat)}" ${view.filters.category === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label class="field__label">امتیاز</label>
              <div class="chips">
                ${RATING_LIST.map(
                  (meta) => `
                    <button type="button" class="chip chip--${meta.tone} ${view.filters.ratings.includes(meta.key) ? 'is-active' : ''}" data-modal-rating="${meta.key}">${esc(meta.label)}</button>
                  `).join('')}
                </div>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field__label" for="ff-min">حداقل هزینه (تومان)</label>
              <input class="input input--num" id="ff-min" name="minPrice" inputmode="numeric" value="${view.filters.minPrice ?? ''}" placeholder="۰" />
            </div>
            <div class="field">
              <label class="field__label" for="ff-max">حداکثر هزینه (تومان)</label>
              <input class="input input--num" id="ff-max" name="maxPrice" inputmode="numeric" value="${view.filters.maxPrice ?? ''}" placeholder="نامحدود" />
            </div>
            <div class="field">
              <label class="field__label">از تاریخ</label>
              <div data-slot="from"></div>
            </div>
            <div class="field">
              <label class="field__label">تا تاریخ</label>
              <div data-slot="to"></div>
            </div>
          </div>

          <div class="field">
            <label class="field__label">برچسب‌ها</label>
            <div class="chips" data-tag-filter>
              ${tags.length ? tags.map((tag) => `<button type="button" class="tag ${selectedTags.has(tag.label) ? 'tag--acc' : ''}" data-modal-tag="${esc(tag.label)}">#${esc(tag.label)} <span class="u-faint">${faNum(tag.count)}</span></button>`).join('') : '<span class="u-xs u-faint">هنوز برچسبی ثبت نشده.</span>'}
            </div>
          </div>

          <div class="stack stack--sm">
            <label class="switch-row">
              <span class="switch-row__text">
                <span class="switch-row__title">محدود کردن به بازه تاریخ</span>
                <span class="switch-row__sub">فقط خریدهای بین «از تاریخ» و «تا تاریخ»</span>
              </span>
              <button type="button" class="switch" role="switch" aria-checked="${Boolean(view.filters.from || view.filters.to)}" data-switch="dateOn"></button>
            </label>
            <label class="switch-row">
              <span class="switch-row__text">
                <span class="switch-row__title">فقط خریدهای دارای یادداشت</span>
                <span class="switch-row__sub">مواردی که توضیح نوشته‌اید</span>
              </span>
              <button type="button" class="switch" role="switch" aria-checked="${view.filters.hasNote}" data-switch="hasNote"></button>
            </label>
            <label class="switch-row">
              <span class="switch-row__text">
                <span class="switch-row__title">فقط «دوباره می‌خرم»</span>
                <span class="switch-row__sub">خریدهای تاییدشده برای تکرار</span>
              </span>
              <button type="button" class="switch" role="switch" aria-checked="${view.filters.buyAgainOnly}" data-switch="buyAgainOnly"></button>
            </label>
            <label class="switch-row">
              <span class="switch-row__text">
                <span class="switch-row__title">بدون موارد افتضاح</span>
                <span class="switch-row__sub">فقط تجربه‌های خوب و nah‑khab</span>
              </span>
              <button type="button" class="switch" role="switch" aria-checked="${view.filters.noBad}" data-switch="noBad"></button>
            </label>
          </div>
        </form>
      `,
      footer: `
        <button type="button" class="btn btn--ghost" data-reset>پاک کردن فیلترها</button>
        <span class="u-grow"></span>
        <button type="button" class="btn btn--primary" data-apply>${icon('check', 16)} اعمال فیلتر</button>
      `,
      onMount({ el, close }) {
        const draft = {
          ratings: [...view.filters.ratings],
          tags: new Set(view.filters.tags),
          switches: {
            dateOn: Boolean(view.filters.from || view.filters.to),
            hasNote: view.filters.hasNote,
            buyAgainOnly: view.filters.buyAgainOnly,
            noBad: view.filters.noBad,
          },
        };

        const fromInput = createDateInput({ value: view.filters.from || todayISO(), onChange: () => {} });
        const toInput = createDateInput({ value: view.filters.to || todayISO(), onChange: () => {} });
        el.querySelector('[data-slot="from"]').appendChild(fromInput.el);
        el.querySelector('[data-slot="to"]').appendChild(toInput.el);

        el.querySelectorAll('[data-modal-rating]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.modalRating;
            if (draft.ratings.includes(key)) draft.ratings = draft.ratings.filter((item) => item !== key);
            else draft.ratings.push(key);
            btn.classList.toggle('is-active');
          });
        });

        el.querySelectorAll('[data-modal-tag]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const tag = btn.dataset.modalTag;
            if (draft.tags.has(tag)) draft.tags.delete(tag);
            else draft.tags.add(tag);
            btn.classList.toggle('tag--acc');
          });
        });

        el.querySelectorAll('[data-switch]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const key = btn.dataset.switch;
            draft.switches[key] = !draft.switches[key];
            btn.setAttribute('aria-checked', String(draft.switches[key]));
          });
        });

        el.querySelector('[data-reset]')?.addEventListener('click', () => {
          clearAll();
          close();
        });

        el.querySelector('[data-apply]')?.addEventListener('click', () => {
          const form = el.querySelector('[data-filter-form]');
          const minRaw = form.querySelector('[name="minPrice"]').value.trim();
          const maxRaw = form.querySelector('[name="maxPrice"]').value.trim();
          const minPrice = minRaw ? parseNum(minRaw) : null;
          const maxPrice = maxRaw ? parseNum(maxRaw) : null;
          const dateOn = Boolean(draft.switches.dateOn);
          view.filters = {
            ...view.filters,
            ratings: draft.ratings,
            tags: Array.from(draft.tags),
            category: form.querySelector('[name="category"]').value,
            minPrice: Number.isFinite(minPrice) ? minPrice : null,
            maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
            from: dateOn ? fromInput.getValue() : '',
            to: dateOn ? toInput.getValue() : '',
            hasNote: Boolean(draft.switches.hasNote),
            buyAgainOnly: Boolean(draft.switches.buyAgainOnly),
            noBad: Boolean(draft.switches.noBad),
          };
          view.page = 1;
          close();
          renderList();
          renderChips();
          toast.success('فیلتر اعمال شد.');
        });
      },
    });

    return modal;
  }

  /* ------------------------------ رندر کل ----------------------------- */

  function renderAll() {
    renderChips();
    renderList();
  }

  const unsubscribe = subscribe((state, keys) => {
    if (!keys || keys.includes('*') || keys.some((key) => ['reviews', 'products', 'shops', 'vendors', 'comments', 'listItems'].includes(key))) {
      renderAll();
    }
  });

  const onKeydown = (event) => {
    if (event.key === '/' && !event.target.closest('input, textarea, select, [contenteditable]')) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  };
  document.addEventListener('keydown', onKeydown);

  renderAll();

  return {
    destroy() {
      unsubscribe();
      document.removeEventListener('keydown', onKeydown);
      debouncedRender.cancel();
    },
    refresh: renderAll,
  };
}