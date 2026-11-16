/**
 * بازاربان — جست‌وجوی سراسری
 * ---------------------------------------------------------------------------
 * جست‌وجو در فروشنده‌ها، فروشگاه‌ها، محصولات و متن نقدها — با وزن‌دهی به نام،
 * برند، محله و دسته. نتایج در چهار بخش جدا نشان داده می‌شوند.
 */

import { icon } from '../icons.js';
import { CONFIG } from '../config.js';
import { esc, attr, toFa, debounce, truncate, relTime } from '../utils.js';
import * as store from '../store.js';
import {
  entityCard,
  emptyState,
  breadcrumbs,
  avatar,
  setupReveal,
  levelChip,
  toast,
} from '../ui.js';
import { modeBanner } from './home.js';

function section(title, iconName, count, body, moreHref = null) {
  return `<section class="search-section">
    <div class="search-section__head">
      <h2 class="search-section__title">${icon(iconName, 17)} ${esc(title)}</h2>
      <span class="search-section__count">${toFa(count)}</span>
      ${moreHref ? `<a class="link push" href="${attr(moreHref)}" data-link style="font-size:var(--fs-2xs)">همه ${icon('arrow-left', 12)}</a>` : ''}
    </div>
    ${body}
  </section>`;
}

function commentResult(comment) {
  const entity = store.getEntity(comment.entityType, comment.entityId);
  if (!entity) return '';
  return `<a class="latest-item" href="${attr(store.entityHref(comment.entityType, entity))}" data-link>
    ${avatar({ name: store.displayNameOf(comment), hue: store.avatarHueOf(comment), size: 'sm' })}
    <span class="latest-item__body">
      <span class="latest-item__text">${esc(truncate(comment.body, 160))}</span>
      <span class="latest-item__meta">
        ${comment.level ? levelChip(comment.level) : ''}
        <span>${esc(store.entityName(comment.entityType, entity))}</span>
        <span class="divider-dot"></span>
        <span>${esc(relTime(comment.createdAt))}</span>
      </span>
    </span>
  </a>`;
}

function searchBody(query) {
  if (!query) {
    const stats = store.globalStats();
    const top = store.leaderboard('vendor', { limit: 4, minTotal: 2 });
    return `<div class="search-hero">
      <h1 class="search-hero__title">چه چیزی را می‌خواهی بررسی کنی؟</h1>
      <p class="t-mute" style="font-size:var(--fs-sm);line-height:1.9;max-width:62ch">
        نام فروشنده، نام شعبه، برند یا محصول را بنویس. بازاربان در ${toFa(stats.vendors)} فروشنده،
        ${toFa(stats.shops)} شعبه، ${toFa(stats.products)} محصول و ${toFa(stats.comments)} نقد جست‌وجو می‌کند.
      </p>
      <div class="chips-row mt-6">
        ${['اسنپ‌فود', 'شیر', 'شعبهٔ ونک', 'میوه', 'دیجی‌کالا', 'ماست'].map(
          (word) =>
            `<button class="chip chip--button" type="button" data-search-suggest="${attr(word)}">${esc(word)}</button>`,
        ).join('')}
      </div>
      ${
        top.length
          ? `<div class="mt-12">
              <div class="row row--between mb-4">
                <h2 style="font-size:var(--fs-lg)">${icon('crown', 16)} پیشنهاد شروع</h2>
                <a class="link" href="#/vendors" data-link style="font-size:var(--fs-xs)">همه ${icon('arrow-left', 12)}</a>
              </div>
              <div class="grid grid--2">${top.map(({ entity }) => entityCard('vendor', entity)).join('')}</div>
            </div>`
          : ''
      }
    </div>`;
  }

  const results = store.searchAll(query, { limit: 6 });
  const total =
    results.vendors.length + results.shops.length + results.products.length + results.comments.length;

  if (!total) {
    return emptyState({
      iconName: 'search',
      title: `چیزی برای «${query}» پیدا نشد`,
      text: 'املای عبارت را بررسی کن، کلمهٔ کوتاه‌تری امتحان کن، یا اگر مورد تازه‌ای است خودت ثبتش کن.',
      actions: `
        <a class="btn btn--outline btn--sm" href="#/vendors" data-link>فهرست فروشنده‌ها</a>
        <a class="btn btn--primary btn--sm" href="#/new" data-link>${icon('plus', 14)} ثبت مورد جدید</a>`,
    });
  }

  return `
    <div class="search-summary">
      ${icon('search', 14)}
      <span>${toFa(total)} نتیجه برای <b class="t-strong">«${esc(query)}»</b></span>
      <span class="divider-dot"></span>
      <span>${toFa(results.vendors.length)} فروشنده · ${toFa(results.shops.length)} شعبه · ${toFa(
        results.products.length,
      )} محصول · ${toFa(results.comments.length)} نقد</span>
    </div>

    ${
      results.vendors.length
        ? section(
            'فروشنده‌ها',
            'store',
            results.vendors.length,
            `<div class="grid grid--2">${results.vendors.map((row) => entityCard('vendor', row.entity)).join('')}</div>`,
            `#/vendors?q=${encodeURIComponent(query)}`,
          )
        : ''
    }
    ${
      results.shops.length
        ? section(
            'فروشگاه‌ها و شعبه‌ها',
            'building',
            results.shops.length,
            `<div class="grid grid--2">${results.shops.map((row) => entityCard('shop', row.entity)).join('')}</div>`,
            `#/shops?q=${encodeURIComponent(query)}`,
          )
        : ''
    }
    ${
      results.products.length
        ? section(
            'محصولات',
            'package',
            results.products.length,
            `<div class="grid grid--2">${results.products.map((row) => entityCard('product', row.entity)).join('')}</div>`,
            `#/products?q=${encodeURIComponent(query)}`,
          )
        : ''
    }
    ${
      results.comments.length
        ? section(
            'در متن نقدها',
            'message',
            results.comments.length,
            `<div class="latest-strip">${results.comments.map((row) => commentResult(row.entity)).join('')}</div>`,
            `#/reviews?q=${encodeURIComponent(query)}`,
          )
        : ''
    }
  `;
}

export const searchView = {
  title: 'جست‌وجو',
  render(ctx) {
    const query = String(ctx.query.q || '').trim();
    const stats = store.globalStats();
    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'جست‌وجو' }])}
        <form class="search-form" data-search-form role="search" style="margin-bottom:var(--sp-8)">
          <span style="padding-inline-start:var(--sp-4);color:var(--text-faint)">${icon('search', 20)}</span>
          <input class="input" type="search" name="q" value="${attr(query)}" placeholder="فروشنده، شعبه، محصول یا متن نقد…"
            aria-label="عبارت جست‌وجو" data-search-input autofocus />
          <button class="btn btn--primary" type="submit">${icon('search', 15)} جست‌وجو</button>
        </form>
        <div data-search-results>${searchBody(query)}</div>
        <div class="grid grid--4 mt-16" style="gap:var(--sp-3)">
          ${[
            { icon: 'store', label: 'فروشنده', value: stats.vendors, href: '#/vendors' },
            { icon: 'building', label: 'شعبه', value: stats.shops, href: '#/shops' },
            { icon: 'package', label: 'محصول', value: stats.products, href: '#/products' },
            { icon: 'message', label: 'نقد', value: stats.comments, href: '#/reviews' },
          ]
            .map(
              (item) => `<a class="tile" href="${item.href}" data-link>
                <span class="tile__head">${icon(item.icon, 13)} ${esc(item.label)}</span>
                <span class="tile__value" data-count-to="${item.value}">${toFa(item.value)}</span>
              </a>`,
            )
            .join('')}
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    setupReveal(root);
    const form = root.querySelector('[data-search-form]');
    const input = root.querySelector('[data-search-input]');
    const results = root.querySelector('[data-search-results]');

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = String(new FormData(form).get('q') || '').trim();
      window.history.replaceState(null, '', `#/search${value ? `?q=${encodeURIComponent(value)}` : ''}`);
      results.innerHTML = searchBody(value);
      setupReveal(results);
      if (input) input.focus();
    });

    root.querySelectorAll('[data-search-suggest]').forEach((button) => {
      button.addEventListener('click', () => {
        const word = button.dataset.searchSuggest;
        input.value = word;
        window.history.replaceState(null, '', `#/search?q=${encodeURIComponent(word)}`);
        results.innerHTML = searchBody(word);
        setupReveal(results);
      });
    });

    // جست‌وجوی زنده با تأخیر، فقط وقتی تایپ می‌شود
    const live = debounce((value) => {
      if (!value) return;
      results.innerHTML = searchBody(value);
      setupReveal(results);
    }, 320);
    input?.addEventListener('input', (event) => live(event.target.value.trim()));
  },
};
