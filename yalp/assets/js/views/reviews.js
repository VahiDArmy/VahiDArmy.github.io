/**
 * بازاربان — جریان نقدها
 * ---------------------------------------------------------------------------
 * همهٔ نقدها در یک جریان، با فیلتر نوع موجودیت، سطح تجربه، جست‌وجوی متن و
 * مرتب‌سازی بر اساس تازگی یا مفید بودن. ستون کنار، نبض کلی بازار را نشان می‌دهد.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS } from '../config.js';
import { esc, attr, toFa, debounce, fmtPercent, relTime, truncate } from '../utils.js';
import * as store from '../store.js';
import {
  avatar,
  commentCard,
  emptyState,
  pageHead,
  breadcrumbs,
  sectionHead,
  setupReveal,
  toast,
  scoreLegend,
} from '../ui.js';
import { donutChart, barChart } from '../charts.js';
import { modeBanner } from './home.js';

const TYPES = [
  { id: 'all', label: 'همه', icon: 'layers' },
  { id: 'vendor', label: 'فروشنده', icon: 'store' },
  { id: 'shop', label: 'فروشگاه', icon: 'building' },
  { id: 'product', label: 'محصول', icon: 'package' },
];

function sidebar() {
  const stats = store.globalStats();
  const tags = new Map();
  for (const comment of store.getState().comments) {
    for (const tag of comment.tags || []) tags.set(tag, (tags.get(tag) || 0) + 1);
  }
  const topTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const discussed = new Map();
  for (const comment of store.getState().comments) {
    const key = `${comment.entityType}:${comment.entityId}`;
    discussed.set(key, (discussed.get(key) || 0) + 1);
  }
  const hot = [...discussed.entries()]
    .map(([key, count]) => {
      const [type, id] = key.split(':');
      const entity = store.getEntity(type, id);
      return entity ? { type, entity, count } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return `<aside class="sticky-stack">
    <div class="card card--pad">
      <h3 class="panel__title">${icon('chart-pie', 14)} نبض بازار</h3>
      <div class="row" style="gap:var(--sp-5);align-items:center">
        ${donutChart({
          segments: [
            { value: stats.good, color: 'var(--good)' },
            { value: stats.meh, color: 'var(--meh)' },
            { value: stats.bad, color: 'var(--bad)' },
          ],
          size: 108,
          centerLabel: `${toFa(stats.goodRate)}٪`,
          centerCaption: 'رضایت',
        })}
        <div style="flex:1">
          <div class="sentiment-summary">
            <div class="sentiment-summary__row"><span class="dot dot--good"></span> خوب <b>${toFa(stats.good)}</b></div>
            <div class="sentiment-summary__row"><span class="dot dot--meh"></span> نه‌خوب <b>${toFa(stats.meh)}</b></div>
            <div class="sentiment-summary__row"><span class="dot dot--bad"></span> افتضاح <b>${toFa(stats.bad)}</b></div>
          </div>
        </div>
      </div>
      <div class="row row--between mt-4" style="font-size:var(--fs-2xs)">
        <span class="t-faint">مجموع رأی</span>
        <strong>${toFa(stats.ratings)}</strong>
      </div>
    </div>

    <div class="card card--pad">
      <h3 class="panel__title">${icon('tag', 14)} پرتکرارترین برچسب‌ها</h3>
      ${
        topTags.length
          ? `<div class="chips-row">${topTags
              .map(
                (tag) =>
                  `<button class="chip chip--soft chip--button" type="button" data-tag-jump="${attr(tag[0])}">#${esc(
                    tag[0],
                  )} <span class="t-faint">${toFa(tag[1])}</span></button>`,
              )
              .join('')}</div>`
          : `<p class="hint">هنوز برچسبی ثبت نشده.</p>`
      }
    </div>

    <div class="card card--pad">
      <h3 class="panel__title">${icon('flame', 14)} پرگفت‌وگوترین‌ها</h3>
      <div class="rank-list">
        ${
          hot.length
            ? hot
                .map(
                  (row, index) => `<a class="rank-row" href="${attr(store.entityHref(row.type, row.entity))}" data-link>
                    <span class="rank-row__idx">${toFa(index + 1)}</span>
                    <span class="rank-row__main">
                      <span class="rank-row__name">${esc(store.entityName(row.type, row.entity))}</span>
                      <span class="rank-row__sub">${esc(CONFIG.ENTITY_MAP[row.type].label)}</span>
                    </span>
                    <span class="rank-row__metric">${toFa(row.count)}</span>
                  </a>`,
                )
                .join('')
            : `<p class="hint">هنوز گفت‌وگویی شکل نگرفته.</p>`
        }
      </div>
    </div>

    <div class="callout callout--good">
      <span class="callout__icon">${icon('shield', 14)}</span>
      <div>
        <div class="callout__title">نقد خوب چه شکلی است؟</div>
        مشخص، بدون توهین و مربوط به همان موجودیت. یک جزئیات دقیق (زمان تحویل، وضع بسته‌بندی) از ده جملهٔ کلی ارزشمندتر است.
      </div>
    </div>
  </aside>`;
}

export const reviewsView = {
  title: 'نقدها',
  render(ctx) {
    const state = store.getState();
    const comments = state.comments.filter((c) => c.status !== 'hidden');
    const stats = store.globalStats();

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'نقدها' }])}
        ${pageHead({
          eyebrow: 'بدون فیلتر',
          title: 'جریان نقدها',
          sub: `هر نقد یک تجربهٔ واقعی است؛ ${toFa(comments.length)} یادداشت عمومی از ${toFa(
            stats.contributors,
          )} خریدار. می‌توانی بر اساس نوع و سطح فیلتر کنی.`,
          actions: `
            <a class="btn btn--outline btn--sm" href="#/compare" data-link>${icon('columns', 15)} مقایسه</a>
            <a class="btn btn--primary btn--sm" href="#/new" data-link>${icon('plus', 15)} ثبت تجربه</a>`,
        })}

        <div class="review-layout">
          <div>
            <div class="surface" style="padding:var(--sp-4);margin-bottom:var(--sp-4)">
              <div class="input-group">
                <span class="input-group__icon">${icon('search', 17)}</span>
                <input class="input" type="search" placeholder="در متن نقدها جست‌وجو کن…" data-review-search aria-label="جست‌وجو در نقدها" />
              </div>
              <div class="row row--between mt-4" style="flex-wrap:wrap;gap:var(--sp-3)">
                <div class="segmented">
                  ${TYPES.map(
                    (type) => `<button class="segmented__btn" type="button" data-review-type="${type.id}" aria-pressed="${
                      type.id === 'all'
                    }">${icon(type.icon, 13)} ${esc(type.label)}</button>`,
                  ).join('')}
                </div>
                <select class="select" style="min-height:32px;padding-block:4px;width:auto;font-size:var(--fs-xs)" data-review-sort>
                  <option value="new">تازه‌ترین</option>
                  <option value="helpful">مفیدترین</option>
                  <option value="level">بر اساس سطح</option>
                </select>
              </div>
              <div class="chips-row mt-4">
                <button class="chip chip--button" type="button" data-review-level="all" aria-pressed="true">همه سطوح</button>
                ${LEVELS.map(
                  (level) => `<button class="chip chip--button chip--${level.className}" type="button" data-review-level="${level.id}" aria-pressed="false">
                    ${icon(level.icon, 13)} ${esc(level.label)}
                  </button>`,
                ).join('')}
              </div>
            </div>

            <div class="row row--between mb-4">
              <span class="result-count" data-review-count><b>${toFa(comments.length)}</b> نقد</span>
              <span class="t-faint" style="font-size:var(--fs-2xs)" data-review-hint>مرتب‌شده بر اساس تازه‌ترین</span>
            </div>

            <div class="review-feed" data-review-feed>${feedHtml(comments, { limit: 12 })}</div>
            <div class="center mt-8">
              <button class="btn btn--outline" type="button" data-review-more>
                ${icon('chevrons-down', 15)} نمایش نقدهای بیشتر
              </button>
            </div>
          </div>
          ${sidebar()}
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    setupReveal(root);
    const state = store.getState();
    let all = state.comments.filter((c) => c.status !== 'hidden');
    let type = 'all';
    let level = 'all';
    let sort = 'new';
    let query = '';
    let limit = 12;

    const feed = root.querySelector('[data-review-feed]');
    const countNode = root.querySelector('[data-review-count]');
    const moreBtn = root.querySelector('[data-review-more]');

    const filtered = () => {
      let rows = [...all];
      if (type !== 'all') rows = rows.filter((c) => c.entityType === type);
      if (level !== 'all') rows = rows.filter((c) => c.level === level);
      if (query) {
        const q = query.trim();
        rows = rows.filter((c) => c.body.includes(q) || (c.guestName || '').includes(q));
      }
      if (sort === 'helpful') rows.sort((a, b) => store.voteCount(b.id) - store.voteCount(a.id));
      else if (sort === 'level') {
        const order = { bad: 0, meh: 1, good: 2 };
        rows.sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));
      } else rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return rows;
    };

    const paint = () => {
      const rows = filtered();
      feed.innerHTML = feedHtml(rows, { limit });
      countNode.innerHTML = `<b>${toFa(rows.length)}</b> نقد`;
      moreBtn.style.display = rows.length > limit ? '' : 'none';
      root.querySelector('[data-review-hint]').textContent =
        sort === 'helpful' ? 'مرتب‌شده بر اساس مفیدترین' : sort === 'level' ? 'مرتب‌شده بر اساس سطح تجربه' : 'مرتب‌شده بر اساس تازه‌ترین';
    };

    const debouncedSearch = debounce((value) => {
      query = value;
      limit = 12;
      paint();
    }, 240);
    root.querySelector('[data-review-search]')?.addEventListener('input', (event) => {
      debouncedSearch(event.target.value);
    });

    root.querySelectorAll('[data-review-type]').forEach((button) => {
      button.addEventListener('click', () => {
        type = button.dataset.reviewType;
        limit = 12;
        root.querySelectorAll('[data-review-type]').forEach((node) => {
          node.setAttribute('aria-pressed', String(node === button));
        });
        paint();
      });
    });

    root.querySelectorAll('[data-review-level]').forEach((button) => {
      button.addEventListener('click', () => {
        level = button.dataset.reviewLevel;
        limit = 12;
        root.querySelectorAll('[data-review-level]').forEach((node) => {
          node.setAttribute('aria-pressed', String(node === button));
        });
        paint();
      });
    });

    root.querySelector('[data-review-sort]')?.addEventListener('change', (event) => {
      sort = event.target.value;
      paint();
    });

    moreBtn?.addEventListener('click', () => {
      limit += 12;
      paint();
    });

    root.querySelectorAll('[data-tag-jump]').forEach((button) => {
      button.addEventListener('click', () => {
        const tag = button.dataset.tagJump;
        query = tag;
        const input = root.querySelector('[data-review-search]');
        if (input) input.value = tag;
        limit = 12;
        paint();
        feed.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  },
};

function feedHtml(rows, { limit = 12 } = {}) {
  if (!rows.length) {
    return `<div class="card card--pad">${emptyState({
      iconName: 'message',
      title: 'نقدی با این فیلترها نیست',
      text: 'فیلتر سطح یا نوع را تغییر بده، یا خودت اولین نقد این بخش را بنویس.',
      actions: `<a class="btn btn--primary btn--sm" href="#/new" data-link>${icon('plus', 14)} ثبت تجربه</a>`,
    })}</div>`;
  }

  return rows
    .slice(0, limit)
    .map((comment) => {
      const entity = store.getEntity(comment.entityType, comment.entityId);
      if (!entity) return '';
      const score = store.scoreFor(comment.entityType, entity.id);
      return `<article class="review-card">
        <div class="review-card__top">
          <a class="review-card__entity" href="${attr(store.entityHref(comment.entityType, entity))}" data-link>
            ${avatar({ name: store.displayNameOf(comment), hue: store.avatarHueOf(comment), size: 'md' })}
            <span style="min-width:0">
              <span class="review-card__entity-name">${esc(store.entityName(comment.entityType, entity))}</span>
              <span class="review-card__entity-type">${esc(CONFIG.ENTITY_MAP[comment.entityType].label)} · ${esc(
                store.entitySubtitle(comment.entityType, entity),
              )}</span>
            </span>
          </a>
          ${comment.level ? `<span class="comment__level comment__level--${comment.level}">${icon(
            comment.level === 'good' ? 'smile' : comment.level === 'meh' ? 'meh' : 'frown',
            13,
          )} ${esc(store.scoreLabel(comment.level))}</span>` : ''}
        </div>
        <p class="review-card__body">${esc(truncate(comment.body, 420))}</p>
        ${
          comment.tags?.length
            ? `<div class="chips-row mb-4">${comment.tags
                .map((tag) => `<span class="comment__tag">#${esc(tag)}</span>`)
                .join('')}</div>`
            : ''
        }
        <div class="review-card__foot">
          <span class="review-card__author">
            ${avatar({ name: store.displayNameOf(comment), hue: store.avatarHueOf(comment), size: 'sm' })}
            <span>${esc(store.displayNameOf(comment))}</span>
            <span class="divider-dot"></span>
            <span>${esc(relTime(comment.createdAt))}</span>
          </span>
          <span class="cluster cluster--sm">
            <a class="link" href="${attr(store.entityHref(comment.entityType, entity))}" data-link style="font-size:var(--fs-2xs)">
              ${esc(store.scoreLabel(score.verdict))} · ${toFa(score.total)} رأی ${icon('arrow-left', 12)}
            </a>
            <button class="comment__action" type="button" data-action="vote-comment" data-id="${attr(comment.id)}" data-voted="${store.hasVoted(
              comment.id,
            )}" aria-label="مفید بود">
              ${icon('thumbs-up', 13)} ${toFa(store.voteCount(comment.id))}
            </button>
          </span>
        </div>
      </article>`;
    })
    .join('');
}
