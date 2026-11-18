/**
 * بازاربان — صفحهٔ فروشگاه / شعبه
 * ---------------------------------------------------------------------------
 * اطلاعات تماس، ساعات کاری، خدمات (حضوری/ارسال)، محصولات همین شعبه و
 * نقدهای مخصوص شعبه. چون تجربهٔ هر شعبه جداست، این صفحه پروندهٔ مستقل دارد.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS } from '../config.js';
import { esc, attr, toFa, fmtPrice, formatJalali, relTime } from '../utils.js';
import * as store from '../store.js';
import {
  breadcrumbs,
  scoreBadge,
  entityCard,
  emptyState,
  kvRow,
  setupReveal,
  toast,
  levelChip,
} from '../ui.js';
import {
  entityHero,
  rateWidget,
  commentComposer,
  mountComposer,
  commentsList,
  statsPanel,
  refreshRateWidget,
} from './detail-kit.js';
import { modeBanner } from './home.js';

function mapFigure(shop) {
  return `<figure class="figure">
    <div style="position:relative;height:190px;background:
      radial-gradient(circle at 62% 38%, var(--brand-tint-strong), transparent 42%),
      linear-gradient(to left, var(--grid-line) 1px, transparent 1px),
      linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px);
      background-size:auto, 26px 26px, 26px 26px;background-color:var(--surface-sunken);overflow:hidden">
      <div style="position:absolute;inset-inline-start:58%;top:34%;transform:translate(-50%,-50%)">
        <span style="display:grid;place-items:center;width:44px;height:44px;border-radius:50% 50% 50% 6px;transform:rotate(45deg);background:var(--brand-400);color:var(--brand-ink);box-shadow:0 16px 34px -12px var(--brand-glow)">
          <span style="transform:rotate(-45deg)">${icon('building', 20)}</span>
        </span>
      </div>
      <span style="position:absolute;inset-inline-start:12px;top:12px;font-size:10px;color:var(--text-faint);background:var(--surface-solid);border:1px solid var(--line);padding:3px 8px;border-radius:999px">نمای شماتیک — بدون نقشهٔ آنلاین</span>
      <span style="position:absolute;inset-inline:16px;bottom:12px;font-size:11px;color:var(--text-soft)">${esc(
        shop.address || shop.city || 'آدرس ثبت نشده',
      )}</span>
    </div>
    <figcaption class="figure__caption">
      موقعیت تقریبی این شعبه بر اساس آدرس متنی. برای مسیریابی دقیق، آدرس را در نقشهٔ موردعلاقه‌ات جست‌وجو کن.
    </figcaption>
  </figure>`;
}

function asidePanel(shop) {
  const vendor = store.getVendor(shop.vendorId);
  return `<div class="detail-layout__aside">
    ${rateWidget('shop', shop)}

    <div class="aside-card">
      <div class="aside-card__head">${icon('info', 14)} اطلاعات شعبه</div>
      <div class="aside-card__body">
        ${vendor ? kvRow('فروشنده', `<a href="${attr(store.entityHref('vendor', vendor))}" data-link>${esc(vendor.nameFa)}</a>`, { iconName: 'store' }) : ''}
        ${kvRow('شهر', esc(shop.city || '—'), { iconName: 'map-pin' })}
        ${kvRow('محله', esc(shop.district || '—'), { iconName: 'compass' })}
        ${kvRow('ساعات', esc(shop.hours || '—'), { iconName: 'clock' })}
        ${shop.phone ? kvRow('تماس', `<span dir="ltr">${esc(shop.phone)}</span>`, { iconName: 'phone' }) : ''}
        ${kvRow('تحویل حضوری', shop.pickup ? '<span class="t-good">دارد</span>' : '<span class="t-faint">ندارد</span>', { iconName: 'bag' })}
        ${kvRow('ارسال', shop.delivery ? '<span class="t-good">دارد</span>' : '<span class="t-faint">ندارد</span>', { iconName: 'truck' })}
      </div>
    </div>

    ${mapFigure(shop)}

    ${
      vendor
        ? `<a class="related-mini" href="${attr(store.entityHref('vendor', vendor))}" data-link>
            <span class="brand-badge brand-badge--sm" style="--bb-hue:${vendor.brandHue}">${esc(
              vendor.nameFa.slice(0, 2),
            )}</span>
            <span class="related-mini__main">
              <span class="related-mini__title">${esc(vendor.nameFa)}</span>
              <span class="related-mini__sub">${toFa(store.shopsOfVendor(vendor.id).length)} شعبه در بازاربان</span>
            </span>
            ${scoreBadge('vendor', vendor)}
          </a>`
        : ''
    }

    <button class="btn btn--ghost btn--sm btn--block" type="button" data-action="report-entity" data-type="shop" data-id="${shop.id}">
      ${icon('flag', 14)} گزارش اطلاعات نادرست
    </button>
  </div>`;
}

export const shopView = {
  title: 'فروشگاه',
  render(ctx) {
    const shop = store.getShop(ctx.params.id);
    if (!shop) {
      return `<div class="container page"><div class="notfound">
        <div class="notfound__code">۴۰۴</div>
        <h1 class="notfound__title">این شعبه پیدا نشد</h1>
        <p class="notfound__text">ممکن است حذف شده باشد یا شناسهٔ آدرس اشتباه باشد.</p>
        <div class="cluster">
          <a class="btn btn--primary" href="#/shops" data-link>فهرست شعبه‌ها</a>
          <a class="btn btn--outline" href="#/new?type=shop" data-link>ثبت شعبهٔ جدید</a>
        </div>
      </div></div>`;
    }

    const products = store.productsOfShop(shop.id);
    const vendor = store.getVendor(shop.vendorId);
    const comments = store.commentsOf('shop', shop.id);
    const score = store.scoreFor('shop', shop.id);

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([
          { label: 'خانه', href: '#/' },
          { label: 'فروشگاه‌ها', href: '#/shops' },
          ...(vendor ? [{ label: vendor.nameFa, href: store.entityHref('vendor', vendor) }] : []),
          { label: shop.name },
        ])}
        ${entityHero('shop', shop)}

        <div class="detail-layout">
          <div class="detail-layout__main">
            <section class="card card--pad mb-6">
              <div class="row row--between" style="align-items:flex-start;flex-wrap:wrap">
                <div>
                  <h2 style="font-size:var(--fs-lg)">${icon('message', 17)} تجربهٔ خرید از این شعبه</h2>
                  <p class="hint mt-2">${toFa(comments.length)} نقد ثبت شده · شاخص رضایت ${toFa(score.score > 0 ? `+${score.score}` : score.score)}</p>
                </div>
                <div class="cluster cluster--sm">
                  ${LEVELS.map(
                    (level) => `<span class="chip chip--${level.className}">${esc(level.label)} ${toFa(score[level.id])}</span>`,
                  ).join('')}
                </div>
              </div>
              ${commentComposer('shop', shop)}
            </section>

            <section class="mb-8">
              <div class="row row--between mb-4">
                <h2 style="font-size:var(--fs-lg)">${icon('comments', 17)} نقدهای این شعبه</h2>
              </div>
              <div data-comments-list>${commentsList('shop', shop, { limit: 30 })}</div>
            </section>

            <section class="mb-8">
              <div class="row row--between mb-4">
                <h2 style="font-size:var(--fs-lg)">${icon('package', 17)} محصولات این شعبه</h2>
                <a class="btn btn--outline btn--sm" href="#/new?type=product&vendor=${attr(shop.vendorId)}&shop=${attr(shop.id)}" data-link>
                  ${icon('plus', 14)} محصول جدید
                </a>
              </div>
              ${
                products.length
                  ? `<div class="grid grid--auto">${products.map((p) => entityCard('product', p)).join('')}</div>`
                  : emptyState({
                      iconName: 'package',
                      title: 'محصولی مخصوص این شعبه ثبت نشده',
                      text: 'محصولات عمومی فروشنده در صفحهٔ فروشنده دیده می‌شوند. اگر قلم خاصی مخصوص این شعبه است، اضافه‌اش کن.',
                      actions: `<a class="btn btn--primary btn--sm" href="#/new?type=product&vendor=${attr(shop.vendorId)}&shop=${attr(shop.id)}" data-link>${icon('plus', 14)} افزودن محصول</a>`,
                    })
              }
            </section>

            <section>
              <h2 style="font-size:var(--fs-lg);margin-bottom:var(--sp-5)">${icon('chart-bar', 17)} آمار این شعبه</h2>
              ${statsPanel('shop', shop)}
            </section>
          </div>
          ${asidePanel(shop)}
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    const shop = store.getShop(ctx.params.id);
    if (!shop) return;
    setupReveal(root);
    store.markViewed('shop', shop);

    const refresh = () => {
      const listBox = root.querySelector('[data-comments-list]');
      if (listBox) listBox.innerHTML = commentsList('shop', shop, { limit: 30 });
      refreshRateWidget(root, 'shop', shop);
    };

    mountComposer(root, { onCreated: refresh });

    const onRated = (event) => {
      if (event.detail?.type === 'shop' && event.detail?.id === shop.id) refresh();
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
