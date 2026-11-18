/**
 * بازاربان — صفحهٔ محصول
 * ---------------------------------------------------------------------------
 * قیمت، دسته، برند، مسیر خرید (فروشنده و شعبه) و نقدهای مخصوص همان قلم.
 * برای هر محصول، مقایسه با میانگین قیمت همان دسته هم نمایش داده می‌شود.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS, categoryById } from '../config.js';
import { esc, attr, toFa, fmtPrice, fmtPercent, hueFrom, truncate, relTime } from '../utils.js';
import * as store from '../store.js';
import {
  breadcrumbs,
  scoreBadge,
  entityCard,
  emptyState,
  kvRow,
  setupReveal,
  levelChip,
  brandBadge,
} from '../ui.js';
import {
  entityHero,
  rateWidget,
  commentComposer,
  mountComposer,
  commentsList,
  statsPanel,
  buyRoute,
  refreshRateWidget,
} from './detail-kit.js';
import { modeBanner } from './home.js';

function priceInsight(product) {
  const peers = store.allProducts().filter((p) => p.category === product.category && p.price);
  if (peers.length < 2 || !product.price) return '';
  const avg = peers.reduce((acc, p) => acc + Number(p.price || 0), 0) / peers.length;
  const delta = Math.round(((Number(product.price) - avg) / avg) * 100);
  const cheaper = delta <= 0;
  return `<div class="callout ${cheaper ? 'callout--good' : 'callout--meh'}">
    <span class="callout__icon">${icon(cheaper ? 'trending-down' : 'trending-up', 14)}</span>
    <div>
      <div class="callout__title">${cheaper ? 'ارزان‌تر از میانگین دسته' : 'گران‌تر از میانگین دسته'}</div>
      قیمت این محصول حدود <b>${fmtPercent(Math.abs(delta))}</b> ${cheaper ? 'کمتر' : 'بیشتر'} از میانگین
      ${toFa(peers.length)} محصول دستهٔ «${esc(categoryById(product.category).label)}» است.
    </div>
  </div>`;
}

function asidePanel(product) {
  const vendor = store.getVendor(product.vendorId);
  const category = categoryById(product.category);
  return `<div class="detail-layout__aside">
    ${rateWidget('product', product)}

    <div class="aside-card">
      <div class="aside-card__head">${icon('wallet', 14)} قیمت و مشخصات</div>
      <div class="aside-card__body">
        <div style="display:flex;align-items:baseline;gap:8px">
          <strong style="font-size:var(--fs-2xl);letter-spacing:-.03em">${product.price ? esc(fmtPrice(product.price)) : 'نامشخص'}</strong>
        </div>
        ${priceInsight(product)}
        ${kvRow('دسته', esc(category.label), { iconName: category.icon })}
        ${kvRow('برند', esc(product.brand || '—'), { iconName: 'tag' })}
        ${kvRow('واحد فروش', esc(product.unit || '—'), { iconName: 'scale' })}
        ${kvRow('موجودی', product.isAvailable ? '<span class="t-good">موجود</span>' : '<span class="t-bad">ناموجود</span>', { iconName: 'package' })}
        ${product.barcode ? kvRow('بارکد', `<span dir="ltr" class="mono">${esc(product.barcode)}</span>`, { iconName: 'barcode' }) : ''}
      </div>
    </div>

    ${buyRoute('product', product)}

    ${
      vendor
        ? `<a class="related-mini" href="${attr(store.entityHref('vendor', vendor))}" data-link>
            ${brandBadge(vendor.nameFa, vendor.brandHue, 'sm')}
            <span class="related-mini__main">
              <span class="related-mini__title">${esc(vendor.nameFa)}</span>
              <span class="related-mini__sub">فروشندهٔ این محصول</span>
            </span>
            ${scoreBadge('vendor', vendor)}
          </a>`
        : ''
    }

    <button class="btn btn--ghost btn--sm btn--block" type="button" data-action="report-entity" data-type="product" data-id="${product.id}">
      ${icon('flag', 14)} گزارش اطلاعات نادرست
    </button>
  </div>`;
}

function relatedSection(product) {
  const related = store.relatedEntities('product', product, 4);
  if (!related.length) return '';
  return `<section class="section section--tight">
    <div class="container">
      <div class="row row--between mb-6">
        <h2 style="font-size:var(--fs-lg)">${icon('layers', 16)} محصولات مشابه</h2>
        <a class="link" href="#/products?categories=${attr(product.category)}" data-link style="font-size:var(--fs-xs)">
          همهٔ دسته ${icon('arrow-left', 13)}
        </a>
      </div>
      <div class="grid grid--auto">${related.map((p) => entityCard('product', p)).join('')}</div>
    </div>
  </section>`;
}

export const productView = {
  title: 'محصول',
  render(ctx) {
    const product = store.getProduct(ctx.params.id);
    if (!product) {
      return `<div class="container page"><div class="notfound">
        <div class="notfound__code">۴۰۴</div>
        <h1 class="notfound__title">این محصول پیدا نشد</h1>
        <p class="notfound__text">شاید حذف شده یا آدرس اشتباه باشد. از فهرست محصولات دوباره جست‌وجو کن.</p>
        <div class="cluster">
          <a class="btn btn--primary" href="#/products" data-link>فهرست محصولات</a>
          <a class="btn btn--outline" href="#/new?type=product" data-link>ثبت محصول جدید</a>
        </div>
      </div></div>`;
    }

    const comments = store.commentsOf('product', product.id);
    const score = store.scoreFor('product', product.id);

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([
          { label: 'خانه', href: '#/' },
          { label: 'محصولات', href: '#/products' },
          { label: store.entityName('product', product) },
        ])}
        ${entityHero('product', product)}

        <div class="detail-layout">
          <div class="detail-layout__main">
            <section class="card card--pad mb-6">
              <div class="row row--between" style="align-items:flex-start;flex-wrap:wrap">
                <div>
                  <h2 style="font-size:var(--fs-lg)">${icon('message', 17)} تجربهٔ خرید این محصول</h2>
                  <p class="hint mt-2">${toFa(comments.length)} نقد · شاخص رضایت ${toFa(score.score > 0 ? `+${score.score}` : score.score)}</p>
                </div>
                <div class="cluster cluster--sm">
                  ${LEVELS.map(
                    (level) => `<span class="chip chip--${level.className}">${esc(level.label)} ${toFa(score[level.id])}</span>`,
                  ).join('')}
                </div>
              </div>
              ${commentComposer('product', product)}
            </section>

            <section class="mb-8">
              <h2 style="font-size:var(--fs-lg);margin-bottom:var(--sp-4)">${icon('comments', 17)} نقدهای این محصول</h2>
              <div data-comments-list>${commentsList('product', product, { limit: 30 })}</div>
            </section>

            <section>
              <h2 style="font-size:var(--fs-lg);margin-bottom:var(--sp-5)">${icon('chart-bar', 17)} آمار این محصول</h2>
              ${statsPanel('product', product)}
            </section>
          </div>
          ${asidePanel(product)}
        </div>
      </div>
      ${relatedSection(product)}
    </div>`;
  },

  mount(ctx, root) {
    const product = store.getProduct(ctx.params.id);
    if (!product) return;
    setupReveal(root);
    store.markViewed('product', product);

    const refresh = () => {
      const listBox = root.querySelector('[data-comments-list]');
      if (listBox) listBox.innerHTML = commentsList('product', product, { limit: 30 });
      refreshRateWidget(root, 'product', product);
    };

    mountComposer(root, { onCreated: refresh });

    const onRated = (event) => {
      if (event.detail?.type === 'product' && event.detail?.id === product.id) refresh();
    };
    document.addEventListener('bb:rated', onRated);

    root.addEventListener('click', (event) => {
      const report = event.target.closest('[data-action="report-entity"]');
      if (report) {
        document.dispatchEvent(
          new CustomEvent('bb:report', { detail: { type: report.dataset.type, id: report.dataset.id } }),
        );
      }
    });

    return () => document.removeEventListener('bb:rated', onRated);
  },
};
