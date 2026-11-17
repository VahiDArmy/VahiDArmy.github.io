/* ==========================================================================
   entityList.js — نما‌ی مشترک محصولات / فروشگاه‌ها / پلتفرم‌ها
   ========================================================================== */

import { getState, subscribe } from '../lib/store.js';
import * as repo from '../lib/repo.js';
import {
  buildIndex,
  computeStats,
  entityStats,
  allCategories,
  shopCategories,
  entityMeta,
  ENTITY_TYPES,
} from '../lib/domain.js';
import { searchEntities } from '../lib/search.js';
import { openEntitySheet, openAddToList } from '../components/entitySheet.js';
import { openEntityForm, deleteEntityWithConfirm } from './entityForms.js';
import { openMenu, toast, confirmDialog } from '../lib/ui.js';
import { icon } from '../lib/icons.js';
import { updateQuery } from '../lib/router.js';
import { esc, faNum, fmtInt, debounce, copyText } from '../lib/utils.js';
import { formatJalali } from '../lib/jalali.js';
import {
  entityCard,
  entityAvatar,
  ratingPill,
  emptyState,
  pagerHTML,
  meterHTML,
  scoreColor,
  scoreBadge,
} from '../components/parts.js';

const PAGE_SIZE = 12;

const CONFIG = {
  product: {
    title: 'محصولات',
    sub: 'همه محصولاتی که خریداری کرده‌اید، با میانگین امتیاز در همه فروشگاه‌ها و پلتفرم‌ها.',
    label: 'محصول',
    icon: 'package',
    createLabel: 'محصول جدید',
    categories: (data) => allCategories(data),
    sorts: [
      { key: 'latest', label: 'آخرین خرید' },
      { key: 'reviews', label: 'بیشترین تجربه' },
      { key: 'health-desc', label: 'بهترین امتیاز' },
      { key: 'health-asc', label: 'بدترین امتیاز' },
      { key: 'name', label: 'نام محصول' },
    ],
  },
  shop: {
    title: 'فروشگاه‌ها',
    sub: 'کیفیت هر فروشگاه بر اساس همه محصولاتی که از آن خریده‌اید سنجیده می‌شود.',
    label: 'فروشگاه',
    icon: 'store',
    createLabel: 'فروشگاه جدید',
    categories: (data) => shopCategories(data),
    sorts: [
      { key: 'latest', label: 'آخرین خرید' },
      { key: 'reviews', label: 'بیشترین تجربه' },
      { key: 'health-desc', label: 'بهترین امتیاز' },
      { key: 'health-asc', label: 'بدترین امتیاز' },
      { key: 'name', label: 'نام فروشگاه' },
    ],
  },
  vendor: {
    title: 'پلتفرم‌ها',
    sub: 'هر پلتفرم با تجربه‌های خرید ثبت‌شده روی آن سنجیده می‌شود؛ از دیجی‌کالا و اسنپ‌فود تا خرید حضوری.',
    label: 'پلتفرم',
    icon: 'globe',
    createLabel: 'پلتفرم جدید',
    categories: () => [],
    sorts: [
      { key: 'latest', label: 'آخرین خرید' },
      { key: 'reviews', label: 'بیشترین تجربه' },
      { key: 'health-desc', label: 'بهترین امتیاز' },
      { key: 'health-asc', label: 'بدترین امتیاز' },
      { key: 'name', label: 'نام پلتفرم' },
    ],
  },
};

export function mountEntityList(type) {
  const conf = CONFIG[type];

  return function mount(container, ctx = {}) {
    const view = {
      query: ctx.query?.get('q') || '',
      category: ctx.query?.get('cat') || '',
      sort: ctx.query?.get('sort') || 'latest',
      page: 1,
      layout: 'grid',
    };

    container.innerHTML = `<div class="page__inner">
      <header class="page__head">
        <div class="page__head-text">
          <span class="eyebrow">${esc(ENTITY_TYPES[type]?.plural || conf.title)}</span>
          <h1 class="page__title">${esc(conf.title)}</h1>
          <p class="page__sub">${esc(conf.sub)}</p>
        </div>
        <div class="page__actions">
          <button type="button" class="btn btn--ghost" data-export>${icon('download', 16)} خروجی CSV</button>
          <button type="button" class="btn btn--primary" data-create>${icon('plus', 16)} ${esc(conf.createLabel)}</button>
        </div>
      </header>

      <div class="toolbar">
        <div class="searchbox" style="flex:1;min-width:220px">
          ${icon('search', 17, 'searchbox__icon')}
          <input class="searchbox__input" type="search" data-search value="${esc(view.query)}" placeholder="جست‌وجو در ${esc(conf.title)}…" aria-label="جست‌وجو" />
        </div>
        ${conf.categories(getState().data).length
          ? `<select class="select" data-category style="width:auto;min-width:150px" aria-label="دسته‌بندی">
              <option value="">همه دسته‌ها</option>
              ${conf
                .categories(getState().data)
                .map((cat) => `<option value="${esc(cat)}" ${view.category === cat ? 'selected' : ''}>${esc(cat)}</option>`)
                .join('')}
            </select>`
          : ''}
        <select class="select" data-sort-select style="width:auto;min-width:150px" aria-label="ترتیب">
          ${conf.sorts.map((option) => `<option value="${option.key}" ${view.sort === option.key ? 'selected' : ''}>${esc(option.label)}</option>`).join('')}
        </select>
        <div class="segmented" data-layout-toggle>
          <button type="button" class="segmented__btn is-active" data-layout="grid" aria-label="نمایش کارتی">${icon('grid', 14)}</button>
          <button type="button" class="segmented__btn" data-layout="table" aria-label="نمایش جدولی">${icon('rows', 14)}</button>
        </div>
      </div>

      <div class="results-line">
        <span data-count-line>—</span>
        <span class="u-row u-gap-2">
          <span class="badge badge--outline" data-health-line></span>
        </span>
      </div>

      <div data-list></div>
      <div data-pager></div>
    </div>`;

    const listSlot = container.querySelector('[data-list]');
    const pagerSlot = container.querySelector('[data-pager]');
    const countLine = container.querySelector('[data-count-line]');
    const healthLine = container.querySelector('[data-health-line]');
    const searchInput = container.querySelector('[data-search]');

    function compute() {
      const state = getState();
      const stats = entityStats(state.data);
      const statMap = type === 'product' ? stats.products : type === 'shop' ? stats.shops : stats.vendors;
      const source = type === 'product' ? state.data.products : type === 'shop' ? state.data.shops : state.data.vendors;

      let items = source.map((entity) => ({ entity, stats: statMap.get(entity.id) || computeStats([]) }));

      if (view.query.trim()) {
        const matched = new Set(
          searchEntities({
            items: source,
            query: view.query,
            keys: type === 'vendor' ? ['name', 'note', 'website'] : ['name', 'category', 'brand', 'city', 'address', 'note'],
          }).map((row) => row.id),
        );
        items = items.filter((row) => matched.has(row.entity.id));
      }

      if (view.category) {
        items = items.filter((row) => (row.entity.category || '') === view.category);
      }

      const dir = view.sort === 'health-asc' ? 'asc' : 'desc';
      items.sort((a, b) => {
        switch (view.sort) {
          case 'reviews':
            return b.stats.count - a.stats.count;
          case 'health-desc':
            return b.stats.health - a.stats.health || b.stats.count - a.stats.count;
          case 'health-asc':
            return a.stats.health - b.stats.health || b.stats.count - a.stats.count;
          case 'name':
            return a.entity.name.localeCompare(b.entity.name, 'fa');
          case 'latest':
          default:
            return String(b.stats.lastPurchasedAt || '').localeCompare(String(a.stats.lastPurchasedAt || ''));
        }
      });

      return { state, items, dir };
    }

    function rowsTable(items) {
      return `<div class="table-wrap">
        <div class="table-scroll">
          <table class="table table--stack">
            <thead>
              <tr>
                <th scope="col">${esc(conf.label)}</th>
                <th scope="col">جزئیات</th>
                <th scope="col">تجربه</th>
                <th scope="col">میانگین</th>
                <th scope="col">سلامت</th>
                <th scope="col">آخرین خرید</th>
                <th scope="col" class="cell-actions"><span class="u-sr-only">عملیات</span></th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  ({ entity, stats }) => `<tr data-entity-id="${esc(entity.id)}" data-entity-type="${type}" tabindex="0">
                    <td data-main>
                      <div class="product-cell">
                        ${entityAvatar(type, entity, 'sm')}
                        <div class="product-cell__text">
                          <span class="product-cell__name">${esc(entity.name)}</span>
                          <span class="product-cell__meta">${esc(entityMeta(type, entity) || '—')}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="جزئیات">${entity.website ? `<span class="u-xs u-dim" dir="ltr">${esc(entity.website.replace(/^https?:\/\//, ''))}</span>` : `<span class="u-faint u-xs">${esc(entity.note ? entity.note.slice(0, 40) : '—')}</span>`}</td>
                    <td data-label="تجربه" class="cell-num">${faNum(stats.count)}</td>
                    <td data-label="میانگین"><span style="color:${scoreColor(stats)};font-weight:700">${stats.count ? faNum(stats.avgScore.toFixed(1)) : '—'}</span></td>
                    <td data-label="سلامت" style="min-width:120px">${meterHTML(stats)}</td>
                    <td data-label="آخرین خرید" class="cell-num">${stats.lastPurchasedAt ? formatJalali(stats.lastPurchasedAt, 'short') : '—'}</td>
                    <td class="cell-actions">
                      <div class="row-actions">
                        <button type="button" class="icon-btn" data-entity-edit aria-label="ویرایش">${icon('edit', 15)}</button>
                        <button type="button" class="icon-btn" data-entity-menu aria-label="گزینه‌ها">${icon('more-horizontal', 15)}</button>
                      </div>
                    </td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    function render() {
      const { state, items } = compute();
      const total = items.length;
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (view.page > pages) view.page = pages;
      const pageItems = items.slice((view.page - 1) * PAGE_SIZE, view.page * PAGE_SIZE);

      countLine.innerHTML = `${faNum(total)} ${esc(conf.label)} در ${faNum(state.data.vendors.length)} پلتفرم`;
      const withStats = items.filter((row) => row.stats.count > 0);
      const avgHealth = withStats.length ? Math.round(withStats.reduce((acc, row) => acc + row.stats.health, 0) / withStats.length) : 0;
      healthLine.textContent = withStats.length ? `میانگین سلامت ${faNum(avgHealth)}٪` : 'بدون تجربه ثبت‌شده';

      if (!items.length) {
        listSlot.innerHTML = emptyState({
          iconName: conf.icon,
          title: state.data[type === 'product' ? 'products' : type === 'shop' ? 'shops' : 'vendors'].length
            ? 'موردی با این جست‌وجو پیدا نشد'
            : `هنوز ${esc(conf.label)}ی ندارید`,
          text: state.data[type === 'product' ? 'products' : type === 'shop' ? 'shops' : 'vendors'].length
            ? 'عبارت جست‌وجو یا فیلتر دسته‌بندی را تغییر دهید.'
            : `اولین ${esc(conf.label)} را بسازید یا آن را هنگام ثبت تجربه، همان‌جا ایجاد کنید.`,
          actions: `<button type="button" class="btn btn--primary btn--sm" data-create>${icon('plus', 14)} ${esc(conf.createLabel)}</button>`,
        });
        pagerSlot.innerHTML = '';
        return;
      }

      listSlot.innerHTML =
        view.layout === 'grid'
          ? `<div class="grid-cards stagger">${pageItems
              .map((row, index) =>
                entityCard({
                  type,
                  entity: row.entity,
                  stats: row.stats,
                  index,
                  tags: type === 'vendor' ? [] : [],
                }),
              )
              .join('')}</div>`
          : rowsTable(pageItems);

      if (type === 'vendor') {
        listSlot.querySelectorAll('.ecard').forEach((card) => {
          const entity = state.data.vendors.find((row) => row.id === card.dataset.entityId);
          if (!entity) return;
          card.classList.add('ecard--vendor');
          card.style.setProperty('--vc', entity.color || '#35e0a1');
          card.insertAdjacentHTML('afterbegin', '<div class="ecard__glow"></div>');
        });
      }

      pagerSlot.innerHTML = total > PAGE_SIZE ? pagerHTML({ page: view.page, pageSize: PAGE_SIZE, total }) : '';

      if (view.layout === 'grid') {
        listSlot.querySelectorAll('.ecard').forEach((card) => {
          card.style.setProperty('--i', String(Array.from(listSlot.querySelectorAll('.ecard')).indexOf(card) % 12));
        });
      }
    }

    /* ------------------------------ رویدادها ---------------------------- */

    const debounced = debounce(() => {
      render();
      updateQuery({ q: view.query });
    }, 140);

    container.addEventListener('input', (event) => {
      if (event.target.matches('[data-search]')) {
        view.query = event.target.value;
        view.page = 1;
        debounced();
      }
    });

    container.addEventListener('change', (event) => {
      if (event.target.matches('[data-category]')) {
        view.category = event.target.value;
        view.page = 1;
        updateQuery({ cat: view.category });
        render();
      }
      if (event.target.matches('[data-sort-select]')) {
        view.sort = event.target.value;
        view.page = 1;
        updateQuery({ sort: view.sort });
        render();
      }
    });

    container.addEventListener('click', async (event) => {
      const target = event.target;

      if (target.closest('[data-create]')) {
        openEntityForm(type, null, { onSaved: () => render() });
        return;
      }

      const layoutBtn = target.closest('[data-layout]');
      if (layoutBtn) {
        view.layout = layoutBtn.dataset.layout;
        container.querySelectorAll('[data-layout]').forEach((btn) => btn.classList.toggle('is-active', btn === layoutBtn));
        render();
        return;
      }

      const pageBtn = target.closest('[data-page]');
      if (pageBtn) {
        const { items } = compute();
        const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        if (pageBtn.dataset.page === 'prev') view.page = Math.max(1, view.page - 1);
        else if (pageBtn.dataset.page === 'next') view.page = Math.min(pages, view.page + 1);
        else view.page = Number(pageBtn.dataset.page);
        render();
        return;
      }

      if (target.closest('[data-export]')) {
        const { items } = compute();
        const rows = items.map(({ entity, stats }) => ({
          name: entity.name,
          meta: entityMeta(type, entity),
          reviews: stats.count,
          avg: stats.avgScore,
          health: stats.health,
          spend: stats.spend,
          last: stats.lastPurchasedAt || '',
        }));
        const { toCSV, downloadFile } = await import('../lib/utils.js');
        downloadFile(
          `${type}-${new Date().toISOString().slice(0, 10)}.csv`,
          toCSV(rows, [
            { key: 'name', label: 'نام' },
            { key: 'meta', label: 'جزئیات' },
            { key: 'reviews', label: 'تجربه' },
            { key: 'avg', label: 'میانگین' },
            { key: 'health', label: 'سلامت' },
            { key: 'spend', label: 'هزینه' },
            { key: 'last', label: 'آخرین خرید' },
          ]),
          'text/csv;charset=utf-8',
        );
        toast.success('فایل CSV دانلود شد.');
        return;
      }

      const menuBtn = target.closest('[data-entity-menu]');
      if (menuBtn) {
        event.stopPropagation();
        const row = menuBtn.closest('[data-entity-id]');
        const id = row?.dataset.entityId;
        const entity =
          type === 'product'
            ? getState().data.products.find((item) => item.id === id)
            : type === 'shop'
              ? getState().data.shops.find((item) => item.id === id)
              : getState().data.vendors.find((item) => item.id === id);
        if (!entity) return;
        const index = buildIndex(getState().data);
        const stats = computeStats(
          getState().data.reviews.filter((review) =>
            type === 'product' ? review.product_id === id : type === 'shop' ? review.shop_id === id : review.vendor_id === id,
          ),
        );
        openMenu(menuBtn, [
          { label: 'مشاهده جزئیات', icon: 'eye', onClick: () => openEntitySheet(type, id) },
          { label: 'ثبت تجربه جدید', icon: 'plus', onClick: () => import('./reviewForm.js').then((mod) => mod.openReviewForm({ prefill: type === 'product' ? { product_id: id } : type === 'shop' ? { shop_id: id } : { vendor_id: id } })) },
          { label: 'ویرایش', icon: 'edit', onClick: () => openEntityForm(type, entity, { onSaved: () => render() }) },
          { label: 'افزودن به لیست', icon: 'list', onClick: () => openAddToList(type, id) },
          {
            label: 'کپی خلاصه',
            icon: 'copy',
            onClick: async () => {
              const text = `${entity.name} · ${faNum(stats.count)} تجربه · میانگین ${stats.count ? stats.avgScore.toFixed(1) : '—'}`;
              const ok = await copyText(text);
              toast[ok ? 'success' : 'error'](ok ? 'کپی شد.' : 'کپی نشد.');
            },
          },
          { sep: true },
          { label: 'حذف', icon: 'trash', danger: true, onClick: () => deleteEntityWithConfirm(type, entity, { onDeleted: () => render() }) },
        ]);
        return;
      }

      const editBtn = target.closest('[data-entity-edit]');
      if (editBtn) {
        event.stopPropagation();
        const id = editBtn.closest('[data-entity-id]')?.dataset.entityId;
        const entity =
          type === 'product'
            ? getState().data.products.find((item) => item.id === id)
            : type === 'shop'
              ? getState().data.shops.find((item) => item.id === id)
              : getState().data.vendors.find((item) => item.id === id);
        if (entity) openEntityForm(type, entity, { onSaved: () => render() });
        return;
      }

      const card = target.closest('[data-entity-id]');
      if (card && !target.closest('button')) {
        openEntitySheet(type, card.dataset.entityId);
      }
    });

    container.addEventListener('keydown', (event) => {
      const card = event.target.closest('[data-entity-id]');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        if (event.target.closest('button, input')) return;
        event.preventDefault();
        openEntitySheet(type, card.dataset.entityId);
      }
    });

    const unsubscribe = subscribe((state, keys) => {
      if (!keys || keys.includes('*') || keys.some((key) => ['reviews', 'products', 'shops', 'vendors'].includes(key))) render();
    });

    render();

    return {
      destroy() {
        unsubscribe();
        debounced.cancel();
      },
    };
  };
}
