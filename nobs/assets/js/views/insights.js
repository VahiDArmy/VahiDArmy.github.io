/* ==========================================================================
   insights.js — تحلیل‌ها: امتیازها، هزینه، عملکرد پلتفرم و فروشگاه
   ========================================================================== */

import { getState, subscribe } from '../lib/store.js';
import { buildInsights, ratingInfo, entityStats } from '../lib/domain.js';
import { donutChart, barList, sparkline, heatmap, ratingBreakdown } from '../lib/charts.js';
import { kpiCard, emptyState, sectionHead, scoreColor, meterHTML } from '../components/parts.js';
import { openEntitySheet } from '../components/entitySheet.js';
import { openReviewForm } from './reviewForm.js';
import { icon } from '../lib/icons.js';
import { esc, faNum, fmtInt, fmtCompact, copyText, pct } from '../lib/utils.js';
import { formatJalali, JALALI_MONTHS_SHORT } from '../lib/jalali.js';
import { toast, confirmDialog } from '../lib/ui.js';
import * as repo from '../lib/repo.js';

export function mount(container) {
  container.innerHTML = `<div class="page__inner">
    <header class="page__head">
      <div class="page__head-text">
        <span class="eyebrow">تحلیل رفتار خرید</span>
        <h1 class="page__title">تحلیل‌ها</h1>
        <p class="page__sub">از دل تجربه‌های ثبت‌شده: کدام پلتفرم بهتر است، کدام فروشگاه را باید دور بزنی و پولت کجا هدر می‌رود.</p>
      </div>
      <div class="page__actions">
        <button type="button" class="btn btn--ghost" data-copy-report>${icon('copy', 16)} کپی خلاصه</button>
        <button type="button" class="btn btn--primary" data-new-review>${icon('plus', 16)} ثبت خرید</button>
      </div>
    </header>
    <div data-insights></div>
  </div>`;

  const slot = container.querySelector('[data-insights]');

  function render() {
    const state = getState();
    const data = state.data;

    if (!data.reviews.length) {
      slot.innerHTML = emptyState({
        iconName: 'chart',
        title: 'تحلیل‌ها پس از اولین خرید ساخته می‌شوند',
        text: 'کافی است یک تجربه ثبت کنی تا نمودار امتیازها، هزینه‌ها، عملکرد پلتفرم‌ها و بهترین/بدترین فروشگاه‌ها ساخته شوند.',
        actions: `<button type="button" class="btn btn--primary btn--sm" data-new-review>${icon('plus', 14)} ثبت اولین خرید</button>
          <button type="button" class="btn btn--soft btn--sm" data-seed>${icon('sparkles', 14)} داده نمونه</button>`,
      });
      return;
    }

    const ins = buildInsights(data);
    const totals = ins.totals;
    const currency = state.profile?.currency || 'IRT';
    const topVendors = ins.vendorRanking.slice(0, 6);
    const worstShops = [...ins.shopRanking].filter((row) => row.stats.count > 0).slice(0, 6);
    const bestShops = ins.topShops.slice(0, 5);
    const stars = ins.productRanking.slice(0, 6);
    const monthMax = Math.max(...ins.monthly.map((m) => m.spend), 1);

    slot.innerHTML = `
      <div class="grid-kpi stagger">
        ${kpiCard({
          label: 'کل تجربه‌ها',
          value: faNum(totals.count),
          unit: 'خرید',
          foot: `${faNum(new Set(data.reviews.map((r) => r.product_id)).size)} محصول یکتا`,
          iconName: 'receipt',
        })}
        ${kpiCard({
          label: 'هزینه ثبت‌شده',
          value: fmtCompact(totals.spend),
          unit: currency === 'IRR' ? 'ریال' : 'تومان',
          foot: `میانگین هر خرید ${fmtCompact(totals.count ? totals.spend / totals.count : 0)}`,
          iconName: 'wallet',
        })}
        ${kpiCard({
          label: 'میانگین امتیاز',
          value: faNum(totals.avgScore.toFixed(2)),
          unit: 'از ۳',
          foot: `${faNum(totals.good)} خوب · ${faNum(totals.notGood)} نه‌خوب · ${faNum(totals.shit)} افتضاح`,
          iconName: 'star',
        })}
        ${kpiCard({
          label: 'سلامت خرید',
          value: faNum(totals.health),
          unit: '٪',
          foot: 'سهم خریدهای خوب از کل تجربه‌ها',
          iconName: 'shield',
        })}
        ${kpiCard({
          label: 'فروشگاه‌ها',
          value: faNum(data.shops.length),
          unit: 'مورد',
          foot: `${faNum(data.vendors.length)} پلتفرم فعال`,
          iconName: 'store',
        })}
        ${kpiCard({
          label: 'افتضاح‌ها',
          value: faNum(totals.shit),
          unit: 'مورد',
          foot: totals.shit ? 'در لیست «نخر» نگهشان دار' : 'هیچ تجربه افتضاحی نداری 🎉',
          iconName: 'alert',
        })}
      </div>

      <div class="insight-summary reveal" style="--i:1">
        <div class="insight-summary__head">${icon('sparkles', 16)} خلاصه هوشمند از داده‌های تو</div>
        <div class="insight-list">
          ${ins.bullets.map((bullet) => `<div class="insight-item insight-item--${bullet.tone}">${esc(bullet.text)}</div>`).join('')}
        </div>
      </div>

      <div class="grid-charts">
        <section class="card col-4 reveal" style="--i:2">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('chart', 16)} توزیع امتیازها</div>
              <div class="card__sub">نسبت خوب / نه‌خوب / افتضاح</div>
            </div>
          </div>
          <div class="card__body">
            ${donutChart({
              items: ins.ratingRows,
              size: 160,
              thickness: 17,
              centerValue: faNum(totals.count),
              centerLabel: 'تجربه',
              legendMode: 'percent',
            })}
            <div class="u-mt-4">${ratingBreakdown(ins.ratingRows)}</div>
          </div>
        </section>

        <section class="card col-8 reveal" style="--i:3">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('chart-bar', 16)} هزینه ماهانه</div>
              <div class="card__sub">۱۲ ماه اخیر به تقویم شمسی</div>
            </div>
            <span class="badge badge--violet">مجموع ${fmtCompact(totals.spend)} ${currency === 'IRR' ? 'ریال' : 'تومان'}</span>
          </div>
          <div class="card__body">
            ${sparkline({ values: ins.monthly.map((m) => m.spend), height: 78, tone: 'violet' })}
            <div class="u-mt-4">
              ${barList({
                items: ins.monthly.map((m) => ({
                  label: m.label,
                  value: m.spend,
                  display: m.spend ? fmtCompact(m.spend) : '—',
                  tone: 'violet',
                  sub: m.count ? `${faNum(m.count)} خرید` : '',
                })),
                showValue: true,
              })}
            </div>
          </div>
        </section>

        <section class="card col-7 reveal" style="--i:4">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('globe', 16)} عملکرد پلتفرم‌ها</div>
              <div class="card__sub">بر اساس سلامت امتیازها</div>
            </div>
            <button type="button" class="btn btn--ghost btn--sm" data-go="/vendors">همه پلتفرم‌ها ${icon('chevron-left', 13)}</button>
          </div>
          <div class="card__body">
            <div class="vendor-perf">
              ${topVendors
                .map(
                  ({ vendor, stats }) => `<div class="vp-row" data-open-vendor="${esc(vendor.id)}" style="cursor:pointer">
                    <span class="avatar avatar--sm" style="--hue:${stats.health >= 70 ? 158 : stats.health >= 40 ? 42 : 350}">
                      <span class="avatar__emoji">${esc(vendor.emoji || '🛒')}</span>
                    </span>
                    <div class="u-grow" style="min-width:0">
                      <div class="vp-row__name u-truncate">${esc(vendor.name)}</div>
                      <div class="vp-row__meta">${faNum(stats.count)} تجربه · سلامت ${faNum(stats.health)}٪ · ${fmtCompact(stats.spend)} هزینه</div>
                      <div class="u-mt-1">${meterHTML(stats)}</div>
                    </div>
                    <div class="vp-row__score">
                      <b style="color:${scoreColor(stats)}">${faNum(stats.avgScore.toFixed(1))}</b>
                      <span>از ۳</span>
                    </div>
                  </div>`,
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="card col-5 reveal" style="--i:5">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('flame', 16)} پرمصرف‌ترین محصولات</div>
              <div class="card__sub">بیشترین تعداد تجربه ثبت‌شده</div>
            </div>
          </div>
          <div class="card__body">
            ${barList({
              items: stars.map(({ product, stats }) => ({
                label: product?.name || 'حذف‌شده',
                value: stats.count,
                display: `${faNum(stats.count)} · ${stats.count ? faNum(stats.avgScore.toFixed(1)) : '—'}`,
                tone: stats.health >= 70 ? '' : stats.health >= 40 ? 'meh' : 'bad',
              })),
              emptyText: 'هنوز محصولی ثبت نشده',
            })}
          </div>
        </section>

        <section class="card col-12 reveal" style="--i:6">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('calendar', 16)} نقشه خرید سال</div>
              <div class="card__sub">شدت رنگ = تعداد خرید در آن ماه</div>
            </div>
            <div class="heat-legend">
              <span>کم</span>
              <i style="background:rgba(53,224,161,.18)"></i>
              <i style="background:rgba(53,224,161,.45)"></i>
              <i style="background:rgba(53,224,161,.7)"></i>
              <i style="background:rgba(53,224,161,.95)"></i>
              <span>زیاد</span>
            </div>
          </div>
          <div class="card__body">
            ${heatmap({
              cells: ins.monthly.map((m) => ({
                label: m.count ? m.count : '·',
                monthLabel: m.short || JALALI_MONTHS_SHORT[(m.jm || 1) - 1] || m.label,
                value: m.count,
                meta: `${m.label}: ${faNum(m.count)} خرید · ${fmtCompact(m.spend)} تومان`,
              })),
              max: Math.max(...ins.monthly.map((m) => m.count), 1),
            })}
            <div class="u-between u-gap-2 u-wrap u-mt-4 u-xs u-dim">
              <span>${faNum(ins.monthly.reduce((acc, m) => acc + m.count, 0))} خرید در یک سال</span>
              <span>بیشترین ماه: ${esc(ins.monthly.reduce((best, m) => (m.count > (best?.count || 0) ? m : best), ins.monthly[0])?.label || '—')}</span>
            </div>
          </div>
        </section>

        <section class="card col-6 reveal" style="--i:7">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('alert', 16)} فروشگاه‌هایی که باید دور بزنی</div>
              <div class="card__sub">کمترین سلامت امتیاز</div>
            </div>
          </div>
          <div class="card__body stack stack--sm">
            ${worstShops
              .map(
                ({ shop, stats }) => `<div class="vp-row" data-open-shop="${esc(shop.id)}" style="cursor:pointer">
                  <span class="avatar avatar--sm"><span class="avatar__emoji">${esc(shop.emoji || '🏪')}</span></span>
                  <div class="u-grow" style="min-width:0">
                    <div class="vp-row__name u-truncate">${esc(shop.name)}</div>
                    <div class="vp-row__meta">${faNum(stats.count)} تجربه · ${faNum(stats.shit)} افتضاح</div>
                    <div class="u-mt-1">${meterHTML(stats)}</div>
                  </div>
                  <div class="vp-row__score">
                    <b style="color:${scoreColor(stats)}">${faNum(stats.health)}٪</b>
                    <span>سلامت</span>
                  </div>
                </div>`,
              )
              .join('')}
            ${worstShops.length ? '' : '<p class="u-xs u-faint">داده کافی نیست.</p>'}
          </div>
        </section>

        <section class="card col-6 reveal" style="--i:8">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('award', 16)} بهترین فروشگاه‌ها</div>
              <div class="card__sub">بالاترین سلامت امتیاز</div>
            </div>
          </div>
          <div class="card__body stack stack--sm">
            ${bestShops
              .map(
                ({ shop, stats }) => `<div class="vp-row" data-open-shop="${esc(shop.id)}" style="cursor:pointer">
                  <span class="avatar avatar--sm"><span class="avatar__emoji">${esc(shop.emoji || '🏪')}</span></span>
                  <div class="u-grow" style="min-width:0">
                    <div class="vp-row__name u-truncate">${esc(shop.name)}</div>
                    <div class="vp-row__meta">${faNum(stats.count)} تجربه · ${faNum(stats.good)} خوب</div>
                    <div class="u-mt-1">${meterHTML(stats)}</div>
                  </div>
                  <div class="vp-row__score">
                    <b style="color:var(--good)">${faNum(stats.avgScore.toFixed(1))}</b>
                    <span>از ۳</span>
                  </div>
                </div>`,
              )
              .join('')}
            ${bestShops.length ? '' : '<p class="u-xs u-faint">داده کافی نیست.</p>'}
          </div>
        </section>

        <section class="card col-7 reveal" style="--i:9">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('package', 16)} محصولات تکراری</div>
              <div class="card__sub">محصولاتی که از چند فروشگاه/پلتفرم خریده‌اید</div>
            </div>
          </div>
          <div class="card__body">
            ${
              ins.repeats.length
                ? `<div class="table-wrap"><div class="table-scroll"><table class="table">
                    <thead><tr><th>محصول</th><th>تعداد</th><th>فروشگاه</th><th>پلتفرم</th><th>میانگین</th></tr></thead>
                    <tbody>${ins.repeats
                      .slice(0, 8)
                      .map(
                        (row) => `<tr data-product="${esc(row.product?.id || '')}">
                          <td><span class="u-semi u-xs">${esc(row.product?.name || '—')}</span></td>
                          <td class="cell-num">${faNum(row.stats.count)}</td>
                          <td class="cell-num">${faNum(row.shops)}</td>
                          <td class="cell-num">${faNum(row.vendors)}</td>
                          <td><span style="color:${scoreColor(row.stats)};font-weight:700">${faNum(row.stats.avgScore.toFixed(1))}</span></td>
                        </tr>`,
                      )
                      .join('')}</tbody>
                  </table></div></div>`
                : `<p class="u-xs u-faint" style="padding:12px 0">هنوز هیچ محصولی را از بیش از یک منبع نخریده‌اید.</p>`
            }
          </div>
        </section>

        <section class="card col-5 reveal" style="--i:10">
          <div class="card__head">
            <div>
              <div class="card__title">${icon('tag', 16)} پرتکرارترین برچسب‌ها</div>
              <div class="card__sub">کلیک کن تا خریدهای مرتبط را ببینی</div>
            </div>
          </div>
          <div class="card__body">
            <div class="chips">
              ${ins.tags
                .slice(0, 14)
                .map(
                  (tag) =>
                    `<button type="button" class="tag" data-tag-jump="${esc(tag.label)}">#${esc(tag.label)} <span class="u-faint">${faNum(tag.count)}</span></button>`,
                )
                .join('')}
              ${ins.tags.length ? '' : '<p class="u-xs u-faint">برچسبی ثبت نشده.</p>'}
            </div>
            <div class="divider divider--dashed"></div>
            <div class="stack stack--sm">
              <div class="u-xs u-dim">دسته‌بندی‌ها</div>
              ${ins.categories
                .slice(0, 6)
                .map(
                  (cat) => `<div class="legend-row">
                    <span class="u-truncate" style="font-size:10px">${esc(cat.label)}</span>
                    <span class="legend-row__bar"><i style="width:${pct(cat.count, ins.categories[0]?.count || 1)}%;background:var(--acc)"></i></span>
                    <span class="legend-row__val">${faNum(cat.count)}</span>
                  </div>`,
                )
                .join('')}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  container.addEventListener('click', async (event) => {
    const target = event.target;

    if (target.closest('[data-new-review]')) {
      openReviewForm({ onSaved: () => render() });
      return;
    }

    if (target.closest('[data-seed]')) {
      try {
        await repo.importSampleIntoAccount();
        toast.success('داده نمونه بارگذاری شد.');
        render();
      } catch (error) {
        toast.error(error.message);
      }
      return;
    }

    if (target.closest('[data-copy-report]')) {
      const ins = buildInsights(getState().data);
      const text = [
        'خلاصه تحلیل فروشگاه‌یار',
        `تجربه‌ها: ${ins.totals.count}`,
        `میانگین امتیاز: ${ins.totals.avgScore.toFixed(2)} از ۳`,
        `سلامت خرید: ${ins.totals.health}٪`,
        `هزینه ثبت‌شده: ${Math.round(ins.totals.spend)} تومان`,
        '',
        ...ins.bullets.map((bullet) => `• ${bullet.text}`),
      ].join('\n');
      const ok = await copyText(text);
      toast[ok ? 'success' : 'error'](ok ? 'خلاصه تحلیلی کپی شد.' : 'کپی انجام نشد.');
      return;
    }

    const go = target.closest('[data-go]');
    if (go) {
      window.location.hash = `#${go.dataset.go}`;
      return;
    }

    const vendorRow = target.closest('[data-open-vendor]');
    if (vendorRow) {
      openEntitySheet('vendor', vendorRow.dataset.openVendor);
      return;
    }

    const shopRow = target.closest('[data-open-shop]');
    if (shopRow) {
      openEntitySheet('shop', shopRow.dataset.openShop);
      return;
    }

    const productRow = target.closest('[data-product]');
    if (productRow && productRow.dataset.product) {
      openEntitySheet('product', productRow.dataset.product);
      return;
    }

    const tagJump = target.closest('[data-tag-jump]');
    if (tagJump) {
      window.location.hash = `#/?q=${encodeURIComponent(`tag:${tagJump.dataset.tagJump}`)}`;
    }
  });

  const unsubscribe = subscribe((state, keys) => {
    if (!keys || keys.includes('*') || keys.some((key) => ['reviews', 'products', 'shops', 'vendors'].includes(key))) render();
  });

  render();

  return {
    destroy() {
      unsubscribe();
    },
  };
}
