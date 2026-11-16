/**
 * بازاربان — بینش بازار
 * ---------------------------------------------------------------------------
 * یک نگاه تحلیلی به داده‌های عمومی: توزیع سه‌سطحی، بهترین و بدترین دسته‌ها،
 * شهرها، ریسک‌ها، تازگی نقدها و فعال‌ترین خریداران.
 *
 * هیچ داده‌ای این‌جا «پیش‌بینی» نمی‌شود؛ همهٔ اعداد از همان امتیازها و نقدهای
 * صفحه‌های دیگر می‌آیند و با تغییر آن‌ها به‌روز می‌شوند.
 */

import { icon } from '../icons.js';
import { CONFIG, CATEGORIES, LEVELS } from '../config.js';
import {
  esc,
  toFa,
  fmtInt,
  fmtPercent,
  fmtPrice,
  truncate,
  formatJalaliShort,
  hueFrom,
  clamp,
} from '../utils.js';
import * as store from '../store.js';
import {
  breadcrumbs,
  pageHead,
  setupReveal,
  scoreBadge,
  entityTypeBadge,
  avatar,
  emptyState,
  levelChip,
} from '../ui.js';
import { donutChart, barChart, columnChart, ringChart, stackedLevelBar } from '../charts.js';
import { modeBanner } from './home.js';

/* --------------------------------------------------------------------------
   محاسبه‌های مشترک
   -------------------------------------------------------------------------- */
function rowsOf(type, list) {
  return list.map((entity) => ({ type, entity, score: store.scoreFor(type, entity.id) }));
}

function weighted(rows) {
  const total = rows.reduce((acc, row) => acc + row.score.total, 0);
  const good = rows.reduce((acc, row) => acc + row.score.good, 0);
  const meh = rows.reduce((acc, row) => acc + row.score.meh, 0);
  const bad = rows.reduce((acc, row) => acc + row.score.bad, 0);
  return {
    total,
    good,
    meh,
    bad,
    score: total ? Math.round(((good - bad) / total) * 100) : 0,
    goodRate: total ? Math.round((good / total) * 100) : 0,
    covered: rows.filter((row) => row.score.total > 0).length,
  };
}

const categoryLabel = (id) =>
  CATEGORIES.find((category) => category.id === id)?.label || CONFIG.CATEGORY_MAP[id] || 'سایر';

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function lastDays(days = 14) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ date: d, key: dayKey(d), count: 0 });
  }
  return out;
}

function contributorRows(limit = 6) {
  const map = new Map();
  const touch = (key, name, hue, kind) => {
    if (!map.has(key)) map.set(key, { key, name, hue, comments: 0, ratings: 0, votes: 0, last: 0 });
    return map.get(key);
  };

  for (const comment of store.getState().comments) {
    if (comment.status === 'hidden') continue;
    const key = comment.userId || `guest:${comment.guestName || 'مهمان'}`;
    const row = touch(
      key,
      store.displayNameOf(comment),
      store.avatarHueOf(comment),
      'comment',
    );
    row.comments += 1;
    row.last = Math.max(row.last, new Date(comment.createdAt).getTime() || 0);
  }

  for (const rating of store.getState().ratings) {
    const key = rating.userId || 'guest:ناشناس';
    if (!key) continue;
    const profile = store.profileOf(rating.userId);
    const row = touch(key, profile?.displayName || 'کاربر بازاربان', profile?.avatarHue ?? hueFrom(key), 'rating');
    row.ratings += 1;
    row.last = Math.max(row.last, new Date(rating.createdAt).getTime() || 0);
  }

  for (const vote of store.getState().votes) {
    const key = vote.userId;
    if (!key) continue;
    const profile = store.profileOf(key);
    const row = touch(key, profile?.displayName || 'کاربر بازاربان', profile?.avatarHue ?? hueFrom(key), 'vote');
    row.votes += 1;
  }

  return [...map.values()]
    .map((row) => ({ ...row, points: row.comments * 3 + row.ratings * 2 + row.votes }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

function freshness(days = 14) {
  const buckets = lastDays(days);
  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const comment of store.getState().comments) {
    if (comment.status === 'hidden') continue;
    const bucket = index.get(dayKey(comment.createdAt));
    if (bucket) bucket.count += 1;
  }
  for (const rating of store.getState().ratings) {
    const bucket = index.get(dayKey(rating.createdAt));
    if (bucket) bucket.count += 0.5;
  }
  return buckets;
}

/* --------------------------------------------------------------------------
   قطعه‌های صفحه
   -------------------------------------------------------------------------- */
function statCard(iconName, label, value, hint, tone = '') {
  return `<article class="insight-stat ${tone ? `insight-stat--${tone}` : ''}">
    <span class="insight-stat__icon">${icon(iconName, 18)}</span>
    <div>
      <div class="insight-stat__value">${value}</div>
      <div class="insight-stat__label">${esc(label)}</div>
      ${hint ? `<div class="insight-stat__hint">${hint}</div>` : ''}
    </div>
  </article>`;
}

function entityRow({ type, entity, score }, { rank = null, showType = true, showScore = true } = {}) {
  if (!entity) return '';
  return `<a class="insight-row" href="${store.entityHref(type, entity)}" data-link>
    ${rank !== null ? `<span class="insight-row__rank">${toFa(rank)}</span>` : ''}
    <span class="insight-row__brand" style="--bb-hue:${entity.brandHue ?? hueFrom(store.entityName(type, entity))}">
      ${icon(type === 'vendor' ? 'store' : type === 'shop' ? 'building' : 'package', 15)}
    </span>
    <span class="insight-row__main">
      <span class="insight-row__title">${esc(store.entityName(type, entity))}</span>
      <span class="insight-row__sub">
        ${showType ? `${entityTypeBadge(type)}` : ''}
        ${esc(store.entitySubtitle(type, entity))}
        ${score.total ? `<span class="divider-dot"></span>${toFa(score.total)} رأی` : '<span class="divider-dot"></span>بدون رأی'}
      </span>
    </span>
    ${showScore ? scoreBadge(type, entity) : ''}
    ${icon('chevron-left', 14)}
  </a>`;
}

function sectionHead(title, sub = '', action = '') {
  return `<div class="insight-head">
    <div>
      <h2 class="insight-head__title">${title}</h2>
      ${sub ? `<p class="insight-head__sub">${sub}</p>` : ''}
    </div>
    ${action}
  </div>`;
}

/* --------------------------------------------------------------------------
   نما
   -------------------------------------------------------------------------- */
export const insightsView = {
  title: 'بینش بازار',

  render() {
    const state = store.getState();
    const stats = store.globalStats();
    const vendors = rowsOf('vendor', store.allVendors());
    const shops = rowsOf('shop', store.allShops());
    const products = rowsOf('product', store.allProducts());
    const allRows = [...vendors, ...shops, ...products];

    const overallTotal = stats.ratings;
    const overallScore = overallTotal ? Math.round(((stats.good - stats.bad) / overallTotal) * 100) : 0;
    const coverage = allRows.length
      ? Math.round((allRows.filter((row) => row.score.total > 0).length / allRows.length) * 100)
      : 0;

    const vendorMix = weighted(vendors);
    const shopMix = weighted(shops);
    const productMix = weighted(products);

    // بهترین/بدترین با حداقل رأی معنادار
    const ranked = allRows.filter((row) => row.score.total >= 2);
    const best = [...ranked].sort((a, b) => b.score.score - a.score.score).slice(0, 6);
    const worst = [...ranked].sort((a, b) => a.score.score - b.score.score).slice(0, 6);
    const risky = allRows
      .filter((row) => row.score.total >= 3 && row.score.score <= CONFIG.THRESHOLDS.bad)
      .sort((a, b) => a.score.score - b.score.score)
      .slice(0, 5);

    // دسته‌ها
    const categories = CATEGORIES.map((category) => {
      const rows = products.filter((row) => row.entity.category === category.id);
      const mix = weighted(rows);
      const withVotes = rows.filter((row) => row.score.total >= 1);
      const top = [...withVotes].sort((a, b) => b.score.score - a.score.score)[0] || null;
      return { ...category, count: rows.length, mix, top };
    })
      .filter((category) => category.count > 0)
      .sort((a, b) => b.mix.score - a.mix.score);

    // شهرها (شعبه‌ها)
    const cityMap = new Map();
    for (const row of shops) {
      const city = row.entity.city || 'نامشخص';
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city).push(row);
    }
    const cities = [...cityMap.entries()]
      .map(([city, rows]) => ({
        city,
        count: rows.length,
        mix: weighted(rows),
        top: [...rows].sort((a, b) => b.score.score - a.score.score)[0] || null,
      }))
      .sort((a, b) => b.mix.count - a.mix.count || b.mix.score - a.mix.score)
      .slice(0, 10);

    // بهترین خریدها (محصولات با قیمت و حداقل ۲ رأی)
    const priced = products
      .filter((row) => row.entity.price > 0 && row.score.total >= 2)
      .sort((a, b) => b.score.score - a.score.score)
      .slice(0, 5);

    const contributors = contributorRows(6);
    const days = freshness(14);
    const maxDay = Math.max(1, ...days.map((day) => day.count));

    const levelSegments = [
      { label: 'خوب', value: stats.good, color: 'var(--good)' },
      { label: 'نه‌خوب', value: stats.meh, color: 'var(--meh)' },
      { label: 'افتضاح', value: stats.bad, color: 'var(--bad)' },
    ];

    return `<div class="page insight-page">
      ${modeBanner(state)}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'بینش بازار' }])}

        ${pageHead({
          eyebrow: 'تحلیل جمعی',
          title: 'بینش بازار',
          sub: '',
          actions: `<a class="btn btn--outline btn--sm" href="#/vendors" data-link>${icon('store', 15)} فهرست فروشنده‌ها</a>
                    <a class="btn btn--ghost btn--sm" href="#/guide#score" data-link>${icon('help', 15)} شاخص چطور حساب می‌شود؟</a>`,
        })}

        <section class="insight-hero">
          <div class="insight-hero__score">
            ${ringChart({
              value: overallScore,
              size: 132,
              stroke: 10,
              color: overallScore > 20 ? 'var(--good)' : overallScore < -20 ? 'var(--bad)' : 'var(--meh)',
              label: `${overallScore > 0 ? '+' : ''}${toFa(overallScore)}`,
              caption: 'شاخص کل',
            })}
            <div class="chips-row">
              <span class="chip chip--good">${toFa(stats.good)} خوب</span>
              <span class="chip chip--meh">${toFa(stats.meh)} نه‌خوب</span>
              <span class="chip chip--bad">${toFa(stats.bad)} افتضاح</span>
            </div>
          </div>
          <div class="insight-hero__chart">
            ${donutChart({
              segments: levelSegments,
              size: 156,
              thickness: 18,
              centerLabel: fmtPercent(stats.goodRate),
              centerCaption: 'رضایت',
            })}
            <div class="insight-legend">
              ${levelSegments
                .map(
                  (segment) => `<span class="insight-legend__item">
                    <span class="dot" style="background:${segment.color}"></span>
                    ${esc(segment.label)}
                    <b>${toFa(segment.value)}</b>
                  </span>`,
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="insight-stats">
          ${statCard('store', 'فروشنده', toFa(stats.vendors), `${toFa(vendors.filter((r) => r.score.total).length)} مورد امتیاز دارد`, 'brand')}
          ${statCard('building', 'شعبه', toFa(stats.shops), `${toFa(shops.filter((r) => r.score.total).length)} مورد امتیاز دارد`)}
          ${statCard('package', 'محصول', toFa(stats.products), `${toFa(products.filter((r) => r.score.total).length)} مورد امتیاز دارد`)}
          ${statCard('message', 'نقد', toFa(stats.comments), `${toFa(stats.weekComments)} نقد در ۷ روز اخیر`)}
          ${statCard('users', 'خریدار', toFa(stats.contributors), `${toFa(stats.cities)} شهر`)}
          ${statCard('target', 'پوشش امتیاز', fmtPercent(coverage), 'سهم موجودیت‌های دارای رأی', coverage >= 60 ? 'good' : 'meh')}
        </section>

        <section class="insight-grid insight-grid--3">
          ${[
            { label: 'فروشنده‌ها', mix: vendorMix, icon: 'store' },
            { label: 'شعبه‌ها', mix: shopMix, icon: 'building' },
            { label: 'محصولات', mix: productMix, icon: 'package' },
          ]
            .map(
              (block) => `<article class="card card--pad insight-mix">
                <div class="insight-mix__head">
                  <span class="step__icon">${icon(block.icon, 16)}</span>
                  <div style="flex:1">
                    <div class="insight-mix__title">${block.label}</div>
                    <div class="hint" style="font-size:10px">${toFa(block.mix.total)} رأی · ${toFa(block.mix.covered)} مورد پوشش</div>
                  </div>
                  <span class="mono" style="font-size:var(--fs-sm);color:${block.mix.score > 20 ? 'var(--good)' : block.mix.score < -20 ? 'var(--bad)' : 'var(--meh)'}">
                    ${block.mix.score > 0 ? '+' : ''}${toFa(block.mix.score)}
                  </span>
                </div>
                <div class="mt-4">${stackedLevelBar({ good: block.mix.good, meh: block.mix.meh, bad: block.mix.bad, height: 9 })}</div>
                <div class="insight-mix__foot">
                  <span>${fmtPercent(block.mix.goodRate)} خوب</span>
                  <span>${toFa(block.mix.total ? Math.round((block.mix.bad / block.mix.total) * 100) : 0)}٪ افتضاح</span>
                </div>
              </article>`,
            )
            .join('')}
        </section>

        <section class="insight-grid insight-grid--2">
          <div class="card card--pad">
            ${sectionHead('بهترین تجربه‌ها')}
            <div class="insight-list">
              ${best.length ? best.map((row, index) => entityRow(row, { rank: index + 1 })).join('') : emptyState({ iconName: 'star', title: 'هنوز رأی کافی نیست', text: 'با ثبت تجربه‌ها، این فهرست شکل می‌گیرد.' })}
            </div>
          </div>
          <div class="card card--pad">
            ${sectionHead('هشدارها')}
            <div class="insight-list">
              ${worst.length ? worst.map((row, index) => entityRow(row, { rank: index + 1 })).join('') : emptyState({ iconName: 'shield', title: 'هشدار فعالی نیست', text: 'وقتی تجربه‌های منفی ثبت شوند، این‌جا دیده می‌شوند.' })}
            </div>
          </div>
        </section>

        <section class="insight-grid insight-grid--2">
          <div class="card card--pad">
            ${sectionHead('دسته‌بندی‌ها')}
            <div class="table-wrap">
              <table class="table insight-table">
                <thead><tr><th>دسته</th><th>محصول</th><th>رأی</th><th>شاخص</th></tr></thead>
                <tbody>
                  ${categories
                    .map(
                      (category) => `<tr>
                        <td>
                          <div style="font-weight:600">${esc(category.label)}</div>
                          ${category.top ? `<a class="t-faint" style="font-size:10px" href="${store.entityHref('product', category.top.entity)}" data-link>${esc(store.entityName('product', category.top.entity))}</a>` : '<span class="t-faint" style="font-size:10px">بدون رأی</span>'}
                        </td>
                        <td>${toFa(category.count)}</td>
                        <td>${toFa(category.mix.total)}</td>
                        <td><span class="mono" style="color:${category.mix.score > 20 ? 'var(--good)' : category.mix.score < -20 ? 'var(--bad)' : 'var(--meh)'}">
                          ${category.mix.score > 0 ? '+' : ''}${toFa(category.mix.score)}
                        </span></td>
                      </tr>`,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card card--pad">
            ${sectionHead('شهرها')}
            <div class="insight-list insight-list--compact">
              ${cities
                .map(
                  (city) => `<div class="insight-row insight-row--static">
                    <span class="insight-row__brand" style="--bb-hue:${hueFrom(city.city)}">${icon('map-pin', 15)}</span>
                    <span class="insight-row__main">
                      <span class="insight-row__title">${esc(city.city)}</span>
                      <span class="insight-row__sub">${toFa(city.count)} شعبه · ${toFa(city.mix.total)} رأی</span>
                    </span>
                    <span class="insight-city__bar">
                      <span style="width:${clamp(Math.round((city.mix.score + 100) / 2), 2, 100)}%;background:${city.mix.score > 20 ? 'var(--good)' : city.mix.score < -20 ? 'var(--bad)' : 'var(--meh)'}"></span>
                    </span>
                    <span class="mono" style="font-size:11px;min-width:34px;text-align:end">${city.mix.score > 0 ? '+' : ''}${toFa(city.mix.score)}</span>
                  </div>`,
                )
                .join('')}
            </div>
          </div>
        </section>

        <section class="insight-grid insight-grid--3">
          <div class="card card--pad insight-span-2">
            ${sectionHead('بهترین خریدها')}
            <div class="insight-list">
              ${
                priced.length
                  ? priced
                      .map(
                        (row) => `<a class="insight-row" href="${store.entityHref('product', row.entity)}" data-link>
                          <span class="insight-row__brand" style="--bb-hue:${row.entity.brandHue ?? 190}">${icon('package', 15)}</span>
                          <span class="insight-row__main">
                            <span class="insight-row__title">${esc(row.entity.name)}</span>
                            <span class="insight-row__sub">${esc(store.entitySubtitle('product', row.entity))} · ${toFa(row.score.total)} رأی</span>
                          </span>
                          <span class="mono" style="font-size:11px;color:var(--text-mute)">${esc(fmtPrice(row.entity.price))}</span>
                          ${scoreBadge('product', row.entity)}
                          ${icon('chevron-left', 14)}
                        </a>`,
                      )
                      .join('')
                  : emptyState({ iconName: 'tag', title: 'قیمتی ثبت نشده', text: 'برای دیدن این بخش، محصولاتی با قیمت و امتیاز بساز.' })
              }
            </div>
          </div>

          <div class="card card--pad">
            ${sectionHead('ریسک‌ها')}
            <div class="insight-list insight-list--compact">
              ${
                risky.length
                  ? risky
                      .map(
                        (row) => `<a class="insight-row" href="${store.entityHref(row.type, row.entity)}" data-link>
                          <span class="insight-row__brand" style="--bb-hue:${row.entity.brandHue ?? 10};color:var(--bad)">${icon('alert-triangle', 15)}</span>
                          <span class="insight-row__main">
                            <span class="insight-row__title">${esc(store.entityName(row.type, row.entity))}</span>
                            <span class="insight-row__sub">${toFa(row.score.bad)} رأی افتضاح از ${toFa(row.score.total)}</span>
                          </span>
                          <span class="mono" style="font-size:11px;color:var(--bad)">${toFa(row.score.score)}</span>
                        </a>`,
                      )
                      .join('')
                  : emptyState({ iconName: 'shield', title: 'خطری شناسایی نشد', text: 'آستانهٔ هشدار: سه رأی منفی یا بیشتر.' })
              }
            </div>
          </div>
        </section>

        <section class="insight-grid insight-grid--2">
          <div class="card card--pad">
            ${sectionHead('تازگی نقدها')}
            ${columnChart({
              data: days.map((day) => ({
                label: new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(day.date),
                value: day.count,
                title: `${formatJalaliShort(day.date)} — ${Math.round(day.count)} فعالیت`,
              })),
              height: 130,
            })}
            <div class="insight-mix__foot">
              <span>${toFa(days.reduce((acc, day) => acc + day.count, 0))} فعالیت در دو هفته</span>
              <span class="dot dot--good"></span>
            </div>
          </div>

          <div class="card card--pad">
            ${sectionHead('فعال‌ترین خریداران')}
            <div class="insight-list insight-list--compact">
              ${
                contributors.length
                  ? contributors
                      .map(
                        (person, index) => `<div class="insight-row insight-row--static">
                          <span class="insight-row__rank">${toFa(index + 1)}</span>
                          ${avatar({ name: person.name, hue: person.hue, size: 'sm' })}
                          <span class="insight-row__main">
                            <span class="insight-row__title">${esc(person.name)}</span>
                            <span class="insight-row__sub">${toFa(person.comments)} نقد · ${toFa(person.ratings)} امتیاز · ${toFa(person.votes)} رأی مفید</span>
                          </span>
                          <span class="badge badge--soft">${toFa(person.points)} امتیاز</span>
                        </div>`,
                      )
                      .join('')
                  : emptyState({ iconName: 'users', title: 'هنوز کسی نیست', text: 'اولین نقد را تو بنویس.' })
              }
            </div>
          </div>
        </section>

      </div>
    </div>`;
  },

  mount() {
    setupReveal();
  },
};
