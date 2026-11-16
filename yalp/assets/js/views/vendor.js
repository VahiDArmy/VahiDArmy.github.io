/**
 * بازاربان — صفحهٔ فروشنده
 * ---------------------------------------------------------------------------
 * پروندهٔ کامل یک فروشنده: شاخص رضایت، توزیع سه‌سطحی، شعبه‌ها، محصولات،
 * نقدها و آمار. امتیازدهی و نوشتن نقد در همین صفحه ممکن است.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS } from '../config.js';
import { esc, attr, toFa, fmtPercent, formatJalali, $, $$ } from '../utils.js';
import * as store from '../store.js';
import {
  entityCard,
  emptyState,
  breadcrumbs,
  scoreBadge,
  setupReveal,
  toast,
  levelChip,
  scoreLegend,
  kvRow,
  openModal,
  confirmDialog,
} from '../ui.js';
import {
  entityHero,
  rateWidget,
  commentComposer,
  mountComposer,
  commentsList,
  tabsBar,
  statsPanel,
  shopsGrid,
  refreshRateWidget,
} from './detail-kit.js';
import { modeBanner } from './home.js';

const TABS = [
  { id: 'reviews', label: 'نقدها', icon: 'message' },
  { id: 'shops', label: 'شعبه‌ها', icon: 'building' },
  { id: 'products', label: 'محصولات', icon: 'package' },
  { id: 'stats', label: 'آمار', icon: 'chart-bar' },
];

function commentFilters(counts, level, sort) {
  return `<div class="toolbar" style="margin-bottom:var(--sp-4)">
    <div class="toolbar__group">
      <span class="toolbar__label">سطح</span>
      <div class="segmented segmented--good">
        <button class="segmented__btn" type="button" data-comment-filter="all" aria-pressed="${level === 'all'}">همه</button>
        ${LEVELS.map(
          (l) => `<button class="segmented__btn" type="button" data-comment-filter="${l.id}" aria-pressed="${
            level === l.id
          }"><span class="dot dot--${l.className}"></span> ${esc(l.label)} <span class="t-faint">${toFa(
            counts[l.id] || 0,
          )}</span></button>`,
        ).join('')}
      </div>
    </div>
    <div class="toolbar__spacer"></div>
    <div class="toolbar__group">
      <span class="toolbar__label">ترتیب</span>
      <select class="select" style="min-height:32px;padding-block:4px;width:auto;font-size:var(--fs-xs)" data-comment-sort>
        <option value="new" ${sort === 'new' ? 'selected' : ''}>تازه‌ترین</option>
        <option value="old" ${sort === 'old' ? 'selected' : ''}>قدیمی‌ترین</option>
        <option value="helpful" ${sort === 'helpful' ? 'selected' : ''}>مفیدترین</option>
      </select>
    </div>
  </div>`;
}

function reviewsPanel(vendor, state) {
  const comments = store.commentsOf('vendor', vendor.id);
  const counts = {
    good: comments.filter((c) => c.level === 'good').length,
    meh: comments.filter((c) => c.level === 'meh').length,
    bad: comments.filter((c) => c.level === 'bad').length,
  };

  return `<div class="detail-tabs" id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews">
    ${commentComposer('vendor', vendor)}
    <div style="margin-top:var(--sp-8)">
      <div class="row row--between mb-4">
        <h2 style="font-size:var(--fs-lg)">${icon('message', 17)} چه گفتند
          <span class="t-faint" style="font-size:var(--fs-xs);font-weight:400">(${toFa(comments.length)})</span>
        </h2>
        ${scoreLegend()}
      </div>
      <div data-comment-filters>${commentFilters(counts, state.level, state.sort)}</div>
      <div data-comments-list>${commentsList('vendor', vendor, state)}</div>
    </div>
  </div>`;
}

function shopsPanel(vendor) {
  return `<div class="detail-tabs" id="panel-shops" role="tabpanel" aria-labelledby="tab-shops">
    <div class="row row--between mb-6">
      <div>
        <h2 style="font-size:var(--fs-lg)">${icon('building', 17)} شعبه‌های ${esc(vendor.nameFa)}</h2>
        <p class="hint mt-2">هر شعبه پروندهٔ جدایی دارد؛ کیفیت شعبه‌ها یکسان نیست.</p>
      </div>
      <a class="btn btn--outline btn--sm" href="#/new?type=shop&vendor=${attr(vendor.id)}" data-link>${icon('plus', 14)} شعبهٔ جدید</a>
    </div>
    ${shopsGrid(vendor)}
  </div>`;
}

function productsPanel(vendor) {
  const products = store
    .productsOfVendor(vendor.id)
    .sort((a, b) => store.scoreFor('product', b.id).score - store.scoreFor('product', a.id).score);

  return `<div class="detail-tabs" id="panel-products" role="tabpanel" aria-labelledby="tab-products">
    <div class="row row--between mb-6">
      <div>
        <h2 style="font-size:var(--fs-lg)">${icon('package', 17)} محصولات ثبت‌شده</h2>
        <p class="hint mt-2">${toFa(products.length)} محصول از این فروشنده در بازاربان بررسی شده است.</p>
      </div>
      <a class="btn btn--outline btn--sm" href="#/new?type=product&vendor=${attr(vendor.id)}" data-link>${icon('plus', 14)} محصول جدید</a>
    </div>
    ${
      products.length
        ? `<div class="grid grid--auto">${products.map((product) => entityCard('product', product)).join('')}</div>`
        : emptyState({
            iconName: 'package',
            title: 'محصولی ثبت نشده',
            text: 'اولین محصول این فروشنده را اضافه کن؛ می‌توانی از فهرست موجود انتخاب کنی تا تکراری ساخته نشود.',
            actions: `<a class="btn btn--primary btn--sm" href="#/new?type=product&vendor=${attr(vendor.id)}" data-link>${icon('plus', 14)} افزودن محصول</a>`,
          })
    }
  </div>`;
}

function asidePanel(vendor) {
  const score = store.scoreFor('vendor', vendor.id);
  const comments = store.commentsOf('vendor', vendor.id);
  const latest = comments[0];
  const cityFacets = store.cityFacets('shop');

  return `<div class="detail-layout__aside">
    ${rateWidget('vendor', vendor)}

    <div class="aside-card">
      <div class="aside-card__head">${icon('info', 14)} شناسنامه</div>
      <div class="aside-card__body">
        ${kvRow('نوع', esc(CONFIG.KIND_MAP[vendor.kind] || '—'), { iconName: 'layers' })}
        ${kvRow('شهر', esc(vendor.city || '—'), { iconName: 'map-pin' })}
        ${kvRow('شعبه‌ها', toFa(store.shopsOfVendor(vendor.id).length), { iconName: 'building' })}
        ${kvRow('محصولات', toFa(store.productsOfVendor(vendor.id).length), { iconName: 'package' })}
        ${kvRow('مجموع رأی', toFa(score.total), { iconName: 'star' })}
        ${kvRow('آخرین رأی', latest ? esc(formatJalali(latest.createdAt, { withYear: true })) : '—', { iconName: 'clock' })}
        ${
          vendor.website
            ? kvRow(
                'وب‌سایت',
                `<a href="${attr(vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`)}" target="_blank" rel="noopener noreferrer nofollow">${esc(
                  vendor.website.replace(/^https?:\/\//, ''),
                )}</a>`,
                { iconName: 'globe' },
              )
            : ''
        }
        ${
          vendor.supportPhone
            ? kvRow('پشتیبانی', `<span dir="ltr">${esc(vendor.supportPhone)}</span>`, { iconName: 'phone' })
            : ''
        }
      </div>
    </div>

    <div class="aside-card">
      <div class="aside-card__head">${icon('map-pin', 14)} پوشش شهری شعبه‌ها</div>
      <div class="aside-card__body">
        <div class="filter-rail">
          ${cityFacets
            .slice(0, 6)
            .map(
              (facet) =>
                `<div class="kv"><span class="kv__k">${esc(facet.city)}</span><span class="kv__v">${toFa(
                  store.shopsOfVendor(vendor.id).filter((s) => s.city === facet.city).length,
                )} شعبه</span></div>`,
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="callout callout--meh">
      <span class="callout__icon">${icon('lightbulb', 14)}</span>
      <div>
        <div class="callout__title">قبل از خرید چک کن</div>
        شعبه‌ای که از آن سفارش می‌دهی را جدا بررسی کن؛ بیشتر شکایت‌ها مربوط به شعبه است، نه برند.
        <a class="link" href="#/shops?vendor=${attr(vendor.id)}" data-link style="font-size:var(--fs-2xs)">دیدن شعبه‌ها</a>
      </div>
    </div>

    <button class="btn btn--ghost btn--sm btn--block" type="button" data-action="report-entity" data-type="vendor" data-id="${vendor.id}">
      ${icon('flag', 14)} گزارش اطلاعات نادرست
    </button>
  </div>`;
}

function relatedSection(vendor) {
  const related = store.relatedEntities('vendor', vendor, 4);
  if (!related.length) return '';
  return `<section class="section section--tight">
    <div class="container">
      <div class="row row--between mb-6">
        <h2 style="font-size:var(--fs-lg)">${icon('compass', 16)} فروشنده‌های مشابه</h2>
        <a class="link" href="#/vendors" data-link style="font-size:var(--fs-xs)">همه ${icon('arrow-left', 13)}</a>
      </div>
      <div class="grid grid--auto">${related.map((item) => entityCard('vendor', item)).join('')}</div>
    </div>
  </section>`;
}

export const vendorView = {
  title: 'فروشنده',
  render(ctx) {
    const vendor = store.getVendor(ctx.params.slug);
    if (!vendor) {
      return `<div class="container page">
        <div class="notfound">
          <div class="notfound__code">۴۰۴</div>
          <h1 class="notfound__title">این فروشنده را پیدا نکردیم</h1>
          <p class="notfound__text">ممکن است آدرس عوض شده باشد یا هنوز ثبت نشده باشد.</p>
          <div class="cluster">
            <a class="btn btn--primary" href="#/vendors" data-link>فهرست فروشنده‌ها</a>
            <a class="btn btn--outline" href="#/new?type=vendor" data-link>ثبت فروشندهٔ جدید</a>
          </div>
        </div>
      </div>`;
    }

    const score = store.scoreFor('vendor', vendor.id);
    const comments = store.commentsOf('vendor', vendor.id).length;
    const shops = store.shopsOfVendor(vendor.id).length;
    const products = store.productsOfVendor(vendor.id).length;
    const tabState = {
      level: ctx.query.level || 'all',
      sort: ctx.query.csort || 'new',
    };
    const activeTab = TABS.some((tab) => tab.id === ctx.query.tab) ? ctx.query.tab : 'reviews';

    const tabs = TABS.map((tab) => ({
      ...tab,
      count: tab.id === 'reviews' ? comments : tab.id === 'shops' ? shops : tab.id === 'products' ? products : undefined,
    }));

    const panels = `<div id="detail-panels">
      ${
        activeTab === 'reviews'
          ? reviewsPanel(vendor, tabState)
          : activeTab === 'shops'
            ? shopsPanel(vendor)
            : activeTab === 'products'
              ? productsPanel(vendor)
              : `<div class="detail-tabs" id="panel-stats" role="tabpanel">${statsPanel('vendor', vendor)}</div>`
      }
    </div>`;

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([
          { label: 'خانه', href: '#/' },
          { label: 'فروشنده‌ها', href: '#/vendors' },
          { label: vendor.nameFa },
        ])}
        ${entityHero('vendor', vendor)}

        <div class="detail-layout">
          <div class="detail-layout__main">
            <div data-tabs>${tabsBar({ tabs, active: activeTab })}</div>
            ${panels}
          </div>
          ${asidePanel(vendor)}
        </div>
      </div>
      ${relatedSection(vendor)}
    </div>`;
  },

  mount(ctx, root) {
    const vendor = store.getVendor(ctx.params.slug);
    if (!vendor) return;
    setupReveal(root);
    store.markViewed('vendor', vendor);

    let activeTab = TABS.some((tab) => tab.id === ctx.query.tab) ? ctx.query.tab : 'reviews';
    let level = ctx.query.level || 'all';
    let sort = ctx.query.csort || 'new';

    mountComposer(root, {
      onCreated: (comment) => {
        const listBox = root.querySelector('[data-comments-list]');
        if (listBox) listBox.innerHTML = commentsList('vendor', vendor, { level, sort });
        const tabsEl = root.querySelector('[data-tabs]');
        if (tabsEl) {
          const comments = store.commentsOf('vendor', vendor.id).length;
          tabsEl.innerHTML = tabsBar({
            tabs: TABS.map((tab) => ({
              ...tab,
              count: tab.id === 'reviews' ? comments : tab.id === 'shops' ? store.shopsOfVendor(vendor.id).length : tab.id === 'products' ? store.productsOfVendor(vendor.id).length : undefined,
            })),
            active: activeTab,
          });
        }
      },
    });

    // تب‌ها
    const switchTab = (tabId) => {
      activeTab = tabId;
      const url = new URL(window.location.href);
      const hashParts = url.hash.replace(/^#/, '').split('?');
      const params = new URLSearchParams(hashParts[1] || '');
      if (tabId === 'reviews') params.delete('tab');
      else params.set('tab', tabId);
      const qs = params.toString();
      window.history.replaceState(null, '', `#${hashParts[0]}${qs ? `?${qs}` : ''}`);
      rerenderPanels();
    };

    const rerenderPanels = () => {
      root.querySelector('[data-tabs]').innerHTML = tabsBar({
        tabs: TABS.map((tab) => ({
          ...tab,
          count:
            tab.id === 'reviews'
              ? store.commentsOf('vendor', vendor.id).length
              : tab.id === 'shops'
                ? store.shopsOfVendor(vendor.id).length
                : tab.id === 'products'
                  ? store.productsOfVendor(vendor.id).length
                  : undefined,
        })),
        active: activeTab,
      });
      const panels = root.querySelector('#detail-panels');
      if (activeTab === 'reviews') {
        panels.innerHTML = reviewsPanel(vendor, { level, sort });
      } else if (activeTab === 'shops') {
        panels.innerHTML = shopsPanel(vendor);
      } else if (activeTab === 'products') {
        panels.innerHTML = productsPanel(vendor);
      } else {
        panels.innerHTML = `<div class="detail-tabs" id="panel-stats" role="tabpanel">${statsPanel('vendor', vendor)}</div>`;
      }
      setupReveal(panels);
      if (activeTab === 'reviews') mountComposer(root, { onCreated: refreshComments });
    };

    const refreshComments = () => {
      const listBox = root.querySelector('[data-comments-list]');
      if (listBox) listBox.innerHTML = commentsList('vendor', vendor, { level, sort });
      const filterBox = root.querySelector('[data-comment-filters]');
      const comments = store.commentsOf('vendor', vendor.id);
      if (filterBox) {
        filterBox.innerHTML = commentFilters(
          {
            good: comments.filter((c) => c.level === 'good').length,
            meh: comments.filter((c) => c.level === 'meh').length,
            bad: comments.filter((c) => c.level === 'bad').length,
          },
          level,
          sort,
        );
      }
    };

    root.addEventListener('click', (event) => {
      const tabButton = event.target.closest('[data-detail-tab]');
      if (tabButton) {
        switchTab(tabButton.dataset.detailTab);
        return;
      }
      const filterButton = event.target.closest('[data-comment-filter]');
      if (filterButton) {
        level = filterButton.dataset.commentFilter;
        root.querySelectorAll('[data-comment-filter]').forEach((btn) => {
          btn.setAttribute('aria-pressed', String(btn.dataset.commentFilter === level));
        });
        const listBox = root.querySelector('[data-comments-list]');
        if (listBox) listBox.innerHTML = commentsList('vendor', vendor, { level, sort });
        return;
      }
      const report = event.target.closest('[data-action="report-entity"]');
      if (report) {
        document.dispatchEvent(
          new CustomEvent('bb:report', {
            detail: { type: report.dataset.type, id: report.dataset.id },
          }),
        );
      }
    });

    root.addEventListener('change', (event) => {
      if (event.target.matches('[data-comment-sort]')) {
        sort = event.target.value;
        refreshComments();
      }
    });

    // پس از ثبت امتیاز، ویجت و سربرگ تازه شوند
    const onRated = (event) => {
      if (event.detail?.type !== 'vendor' || event.detail?.id !== vendor.id) return;
      refreshRateWidget(root, 'vendor', vendor);
      refreshComments();
    };
    document.addEventListener('bb:rated', onRated);
    return () => document.removeEventListener('bb:rated', onRated);
  },
};
