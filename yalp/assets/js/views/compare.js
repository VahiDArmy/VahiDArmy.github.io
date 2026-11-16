/**
 * بازاربان — میز مقایسه
 * ---------------------------------------------------------------------------
 * تا چهار موجودیت را کنار هم می‌گذارد؛ شاخص رضایت، توزیع سه‌سطحی، تعداد نقد و
 * ویژگی‌های اختصاصی هر نوع. بهترین مقدار هر ردیف برجسته می‌شود.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS, categoryById } from '../config.js';
import { esc, attr, toFa, fmtPrice, fmtInt, copyText, $, $$ } from '../utils.js';
import * as store from '../store.js';
import {
  emptyState,
  pageHead,
  breadcrumbs,
  scoreBadge,
  brandBadge,
  toast,
  setupReveal,
  ringFor,
  avatar,
} from '../ui.js';
import { radarChart } from '../charts.js';
import { modeBanner } from './home.js';

/* --------------------------------------------------------------------------
   افزودن/حذف از آدرس
   -------------------------------------------------------------------------- */
function readIds(ctx) {
  const raw = ctx.query.ids;
  if (!raw) return false;
  const entries = String(raw)
    .split(',')
    .map((pair) => {
      const [type, ...rest] = pair.split(':');
      const id = rest.join(':');
      if (!['vendor', 'shop', 'product'].includes(type) || !id) return null;
      return { type, id: decodeURIComponent(id) };
    })
    .filter(Boolean)
    .slice(0, CONFIG.COMPARE_MAX);

  store.clearCompare();
  entries.forEach((entry) => store.toggleCompare(entry.type, entry.id));
  return true;
}

function compareHref(entries) {
  const ids = entries.map(({ type, entity }) => `${type}:${encodeURIComponent(entity.id)}`).join(',');
  return `#/compare?ids=${ids}`;
}

/* --------------------------------------------------------------------------
   جدول
   -------------------------------------------------------------------------- */
function tableFor(type, entries) {
  const rows = [];

  if (type === 'vendor') {
    rows.push({
      label: 'شاخص رضایت',
      values: entries.map(({ entity }) => store.scoreFor(type, entity.id).score),
      render: (value, { entity }) => scoreBadge(type, entity),
      best: 'max',
    });
    rows.push({
      label: 'تعداد رأی',
      values: entries.map(({ entity }) => store.scoreFor(type, entity.id).total),
      render: (value) => toFa(value),
      best: 'max',
    });
    rows.push({
      label: 'نوع',
      values: entries.map(({ entity }) => CONFIG.KIND_MAP[entity.kind] || '—'),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'شهر',
      values: entries.map(({ entity }) => entity.city || '—'),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'شعبه',
      values: entries.map(({ entity }) => store.shopsOfVendor(entity.id).length),
      render: (value) => toFa(value),
      best: 'max',
    });
    rows.push({
      label: 'محصول',
      values: entries.map(({ entity }) => store.productsOfVendor(entity.id).length),
      render: (value) => toFa(value),
    });
    rows.push({
      label: 'نقد',
      values: entries.map(({ entity }) => store.commentsOf(type, entity.id).length),
      render: (value) => toFa(value),
      best: 'max',
    });
    rows.push({
      label: 'تأییدشده',
      values: entries.map(({ entity }) => Boolean(entity.isVerified)),
      render: (value) => (value ? `<span class="t-good">${icon('verified', 13)} بله</span>` : '<span class="t-faint">خیر</span>'),
    });
    rows.push({
      label: 'وب‌سایت',
      values: entries.map(({ entity }) => entity.website || ''),
      render: (value) =>
        value
          ? `<a class="link" href="${attr(value.startsWith('http') ? value : `https://${value}`)}" target="_blank" rel="noopener noreferrer nofollow">${icon('external', 12)} بازکردن</a>`
          : '<span class="t-faint">—</span>',
    });
  }

  if (type === 'shop') {
    rows.push({
      label: 'شاخص رضایت',
      values: entries.map(({ entity }) => store.scoreFor(type, entity.id).score),
      render: (value, { entity }) => scoreBadge(type, entity),
      best: 'max',
    });
    rows.push({
      label: 'تعداد رأی',
      values: entries.map(({ entity }) => store.scoreFor(type, entity.id).total),
      render: (value) => toFa(value),
      best: 'max',
    });
    rows.push({
      label: 'فروشنده',
      values: entries.map(({ entity }) => store.getVendor(entity.vendorId)?.nameFa || '—'),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'شهر / محله',
      values: entries.map(({ entity }) => `${entity.city || '—'}${entity.district ? ` / ${entity.district}` : ''}`),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'ساعات کاری',
      values: entries.map(({ entity }) => entity.hours || '—'),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'تحویل حضوری',
      values: entries.map(({ entity }) => Boolean(entity.pickup)),
      render: (value) => (value ? '<span class="t-good">دارد</span>' : '<span class="t-faint">ندارد</span>'),
    });
    rows.push({
      label: 'ارسال',
      values: entries.map(({ entity }) => Boolean(entity.delivery)),
      render: (value) => (value ? '<span class="t-good">دارد</span>' : '<span class="t-faint">ندارد</span>'),
    });
    rows.push({
      label: 'محصول',
      values: entries.map(({ entity }) => store.productsOfShop(entity.id).length),
      render: (value) => toFa(value),
      best: 'max',
    });
  }

  if (type === 'product') {
    rows.push({
      label: 'شاخص رضایت',
      values: entries.map(({ entity }) => store.scoreFor(type, entity.id).score),
      render: (value, { entity }) => scoreBadge(type, entity),
      best: 'max',
    });
    rows.push({
      label: 'تعداد رأی',
      values: entries.map(({ entity }) => store.scoreFor(type, entity.id).total),
      render: (value) => toFa(value),
      best: 'max',
    });
    rows.push({
      label: 'قیمت',
      values: entries.map(({ entity }) => Number(entity.price) || 0),
      render: (value) => (value ? esc(fmtPrice(value)) : '—'),
      best: 'min',
    });
    rows.push({
      label: 'برند',
      values: entries.map(({ entity }) => entity.brand || '—'),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'دسته',
      values: entries.map(({ entity }) => categoryById(entity.category).label),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'واحد',
      values: entries.map(({ entity }) => entity.unit || '—'),
      render: (value) => esc(value),
    });
    rows.push({
      label: 'موجودی',
      values: entries.map(({ entity }) => Boolean(entity.isAvailable)),
      render: (value) => (value ? '<span class="t-good">موجود</span>' : '<span class="t-bad">ناموجود</span>'),
    });
    rows.push({
      label: 'نقد',
      values: entries.map(({ entity }) => store.commentsOf(type, entity.id).length),
      render: (value) => toFa(value),
    });
  }

  const head = `<thead><tr>
    <th style="min-width:120px">ویژگی</th>
    ${entries
      .map(
        ({ type: entryType, entity }) => `<th>
          <div class="compare-head">
            ${
              entryType === 'vendor'
                ? brandBadge(entity.nameFa, entity.brandHue)
                : entryType === 'product'
                  ? `<span class="product-thumb" style="--p-hue:${entity.name.length * 17}">${icon(categoryById(entity.category).icon, 26)}</span>`
                  : `<span class="brand-badge" style="--bb-hue:190">${icon('building', 22)}</span>`
            }
            <a class="compare-head__name" href="${attr(store.entityHref(entryType, entity))}" data-link>${esc(
              store.entityName(entryType, entity),
            )}</a>
            <span class="compare-head__meta">${esc(store.entitySubtitle(entryType, entity))}</span>
            <button class="icon-btn" type="button" data-action="toggle-compare" data-type="${entryType}" data-id="${entity.id}" aria-label="حذف از مقایسه">
              ${icon('close', 14)}
            </button>
          </div>
        </th>`,
      )
      .join('')}
  </tr></thead>`;

  const body = rows
    .map((row) => {
      const numeric = row.best && row.values.every((value) => typeof value === 'number');
      let bestIndex = -1;
      if (numeric) {
        const target = row.best === 'max' ? Math.max(...row.values) : Math.min(...row.values);
        bestIndex = row.values.findIndex((value) => value === target && value !== 0);
      }
      return `<tr>
        <th scope="row">${esc(row.label)}</th>
        ${row.values
          .map(
            (value, index) =>
              `<td class="${index === bestIndex ? 'col-win' : ''}">${row.render(value, entries[index], index)}</td>`,
          )
          .join('')}
      </tr>`;
    })
    .join('');

  return `<div class="compare-wrap" style="margin-bottom:var(--sp-8)">
    <table class="compare-table">${head}<tbody>${body}</tbody></table>
  </div>`;
}

/* --------------------------------------------------------------------------
   کارت برنده
   -------------------------------------------------------------------------- */
function winnerCard(entries) {
  const scored = entries
    .map((entry) => ({ ...entry, score: store.scoreFor(entry.type, entry.entity.id) }))
    .filter((entry) => entry.score.total >= 1)
    .sort((a, b) => b.score.score - a.score.score);
  if (!scored.length) return '';

  const best = scored[0];
  return `<div class="card card--pad card--glass" style="margin-bottom:var(--sp-8);border-color:var(--good-line)">
    <div class="row" style="gap:var(--sp-5);flex-wrap:wrap">
      <span class="brand-badge" style="--bb-hue:152;width:48px;height:48px">${icon('crown', 24)}</span>
      <div style="flex:1;min-width:200px">
        <div class="page-head__eyebrow">انتخاب بازاربان</div>
        <h2 style="font-size:var(--fs-lg)">${esc(store.entityName(best.type, best.entity))} با شاخص ${toFa(
          best.score.score > 0 ? `+${best.score.score}` : best.score.score,
        )}</h2>
        <p class="hint mt-2">بر اساس ${toFa(best.score.total)} رأی ثبت‌شده. این یک پیشنهاد الگوریتمی است، نه توصیهٔ قطعی.</p>
      </div>
      <a class="btn btn--primary btn--sm" href="${attr(store.entityHref(best.type, best.entity))}" data-link>
        دیدن پرونده ${icon('arrow-left', 14)}
      </a>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   صفحه
   -------------------------------------------------------------------------- */
export const compareView = {
  title: 'مقایسه',
  render(ctx) {
    readIds(ctx);
    const entries = store.compareEntities();
    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.type)) groups.set(entry.type, []);
      groups.get(entry.type).push(entry);
    }

    const suggestions = store
      .leaderboard('vendor', { limit: 4, minTotal: 1 })
      .filter(({ entity }) => !store.inCompare('vendor', entity.id));

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'مقایسه' }])}
        ${pageHead({
          eyebrow: 'کنار هم',
          title: 'میز مقایسه',
          sub: `تا ${toFa(CONFIG.COMPARE_MAX)} مورد را کنار هم بگذار و تفاوت‌ها را یک‌جا ببین. مقایسه فقط بین هم‌نوع‌ها معنی دارد.`,
          actions: `
            ${
              entries.length
                ? `<button class="btn btn--outline btn--sm" type="button" data-copy-compare>${icon('link', 15)} کپی لینک مقایسه</button>
                   <button class="btn btn--ghost btn--sm" type="button" data-action="clear-compare">${icon('trash', 15)} پاک‌کردن</button>`
                : ''
            }`,
        })}

        ${
          !entries.length
            ? `<div class="card card--pad">
                ${emptyState({
                  iconName: 'columns',
                  title: 'میز مقایسه خالی است',
                  text: 'از هر صفحه، آیکون مقایسه را بزن تا این‌جا اضافه شود. پیشنهاد می‌کنیم با فروشنده‌های پرنقد شروع کنی.',
                  actions: `<a class="btn btn--primary btn--sm" href="#/vendors" data-link>${icon('store', 14)} انتخاب از فروشنده‌ها</a>`,
                })}
                ${
                  suggestions.length
                    ? `<div class="divider-text">پیشنهاد سریع</div>
                       <div class="grid grid--2" style="gap:var(--sp-3)">
                        ${suggestions
                          .map(
                            ({ entity }) => `<div class="related-mini">
                              ${brandBadge(entity.nameFa, entity.brandHue, 'sm')}
                              <span class="related-mini__main">
                                <span class="related-mini__title">${esc(entity.nameFa)}</span>
                                <span class="related-mini__sub">${esc(CONFIG.KIND_MAP[entity.kind])}</span>
                              </span>
                              <button class="btn btn--outline btn--xs" type="button" data-action="toggle-compare" data-type="vendor" data-id="${entity.id}">
                                ${icon('plus', 12)} افزودن
                              </button>
                            </div>`,
                          )
                          .join('')}
                       </div>`
                    : ''
                }
              </div>`
            : `
            ${winnerCard(entries)}
            ${[...groups.entries()]
              .map(
                ([type, list]) => `<section>
                  <div class="row row--between mb-4">
                    <h2 style="font-size:var(--fs-lg)">${icon(CONFIG.ENTITY_MAP[type].icon, 16)} مقایسهٔ ${esc(
                      CONFIG.ENTITY_MAP[type].plural,
                    )}</h2>
                    <a class="link" href="#/${type === 'vendor' ? 'vendors' : `${type}s`}" data-link style="font-size:var(--fs-xs)">
                      افزودن مورد بیشتر ${icon('arrow-left', 13)}
                    </a>
                  </div>
                  ${tableFor(type, list)}
                </section>`,
              )
              .join('')}

            ${
              groups.has('vendor') && groups.get('vendor').length >= 2
                ? `<section class="card card--pad">
                    <h2 style="font-size:var(--fs-md);margin-bottom:var(--sp-4)">${icon('target', 16)} نمای راداری فروشنده‌ها</h2>
                    ${radarChart({
                      axes: [
                        { label: 'رضایت' },
                        { label: 'تعداد رأی' },
                        { label: 'شعبه' },
                        { label: 'تنوع محصول' },
                        { label: 'تأیید' },
                      ],
                      series: groups.get('vendor').map(({ entity }, index) => {
                        const score = store.scoreFor('vendor', entity.id);
                        const shops = store.shopsOfVendor(entity.id).length;
                        const products = store.productsOfVendor(entity.id).length;
                        return {
                          color: ['#34e0a1', '#a78bfa', '#38d6ec', '#ffc857'][index % 4],
                          values: [
                            Math.max(0, (score.score + 100) / 2),
                            Math.min(100, score.total * 8),
                            Math.min(100, shops * 22),
                            Math.min(100, products * 18),
                            entity.isVerified ? 100 : 30,
                          ],
                        };
                      }),
                      size: 300,
                    })}
                    <div class="compare-legend">
                      ${groups
                        .get('vendor')
                        .map(
                          ({ entity }, index) =>
                            `<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${
                              ['#34e0a1', '#a78bfa', '#38d6ec', '#ffc857'][index % 4]
                            }"></i> ${esc(entity.nameFa)}</span>`,
                        )
                        .join('')}
                    </div>
                  </section>`
                : ''
            }

            <p class="hint mt-8">
              ${icon('info', 12)} شاخص رضایت از تفاضل درصد «خوب» و «افتضاح» ساخته می‌شود و بین ۱۰۰- تا ۱۰۰+ است.
              ردیف سبز یعنی بهترین مقدار آن ستون.
            </p>`
        }
      </div>
    </div>`;
  },

  mount(ctx, root) {
    setupReveal(root);

    root.querySelector('[data-copy-compare]')?.addEventListener('click', async () => {
      const entries = store.compareEntities();
      if (!entries.length) return;
      const url = `${window.location.origin}${window.location.pathname}${compareHref(entries)}`;
      const ok = await copyText(url);
      toast(ok ? 'لینک مقایسه کپی شد.' : 'کپی نشد؛ آدرس را از نوار مرورگر بردار.', {
        type: ok ? 'good' : 'meh',
      });
    });

    // اگر بعد از حذف، مقایسه خالی شد، صفحه بازآرایی شود
    const onDataChange = () => {
      if (!store.compareEntities().length) {
        window.setTimeout(() => {
          const container = root.querySelector('.container');
          if (container) {
            container.querySelector('.card--pad')?.scrollIntoView({ block: 'nearest' });
          }
        }, 50);
      }
    };
    root.addEventListener('click', onDataChange);
  },
};
