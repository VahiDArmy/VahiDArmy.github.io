/**
 * بازاربان — صفحهٔ خانه
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS } from '../config.js';
import { esc, attr, toFa, relTime, truncate } from '../utils.js';
import * as store from '../store.js';
import {
  brandBadge,
  scoreBadge,
  sectionHead,
  emptyState,
  ringFor,
  levelChip,
  setupReveal,
  animateCounters,
} from '../ui.js';
import { stackedLevelBar } from '../charts.js';

function heroVerdictCard() {
  const top = store.leaderboard('vendor', { direction: 'desc', limit: 1, minTotal: 3 })[0];
  if (!top) {
    return `<div class="verdict-card">
      <div class="verdict-card__head">
        ${brandBadge('بازاربان', 152)}
        <div class="verdict-card__brand">
          <div class="verdict-card__name">هنوز داده‌ای نیست</div>
          <div class="verdict-card__meta">اولین تجربه را ثبت کن</div>
        </div>
      </div>
    </div>`;
  }
  const { entity, score } = top;
  return `<div class="verdict-card">
    <div class="verdict-card__head">
      ${brandBadge(entity.nameFa, entity.brandHue)}
      <div class="verdict-card__brand">
        <div class="verdict-card__name">${esc(entity.nameFa)}</div>
        <div class="verdict-card__meta">${esc(CONFIG.KIND_MAP[entity.kind])} · ${esc(entity.city || 'ایران')}</div>
      </div>
      ${scoreBadge('vendor', entity, { size: 'lg' })}
    </div>
    <div class="verdict-card__body">
      ${ringFor('vendor', entity, 84)}
      <div class="verdict-card__detail">
        ${LEVELS.map(
          (level) => `<div class="verdict-card__row">
            <span class="dot dot--${level.className}"></span>
            <span style="width:38px">${level.label}</span>
            <span class="levelbar"><span class="levelbar__seg levelbar__seg--${level.className}" style="width:${
              score.total ? (score[level.id] / score.total) * 100 : 0
            }%"></span></span>
            <span style="font-variant-numeric:tabular-nums">${toFa(score[level.id])}</span>
          </div>`,
        ).join('')}
      </div>
    </div>
    <div class="verdict-card__foot">
      <span>${toFa(score.total)} رأی</span>
      <a class="link" href="${attr(store.entityHref('vendor', entity))}" data-link style="font-size:var(--fs-2xs)">پرونده ${icon('arrow-left', 13)}</a>
    </div>
  </div>`;
}

function heroSection() {
  const stats = store.globalStats();

  return `<section class="hero">
    <div class="container hero__inner">
      <div class="hero__content">
        <span class="hero__eyebrow">
          <span class="dot dot--live"></span>
          ${toFa(stats.vendors)} فروشنده · ${toFa(stats.ratings)} رأی
        </span>
        <form class="hero-search" data-hero-search role="search">
          <span class="hero-search__icon">${icon('search', 20)}</span>
          <input class="hero-search__input" type="search" name="q" placeholder="فروشنده، شعبه یا محصول…"
            aria-label="جست‌وجو" autocomplete="off" />
          <button class="btn btn--primary" type="submit">
            ${icon('search', 16)} <span>بگرد</span>
          </button>
        </form>

        <div class="hero__quick">
          <span>پرجست‌وجو:</span>
          ${['شیر', 'میوه', 'ماست']
            .map(
              (word) =>
                `<button class="chip chip--soft chip--button" type="button" data-hero-suggest="${attr(word)}">${esc(word)}</button>`,
            )
            .join('')}
        </div>

        <div class="hero__proof">
          <div class="hero__proof-item">
            <span class="hero__proof-text">
              <span class="hero__proof-num">${toFa(stats.vendors)}</span>
              <span class="hero__proof-label">فروشنده</span>
            </span>
          </div>
          <span class="hero__proof-sep"></span>
          <div class="hero__proof-item">
            <span class="hero__proof-text">
              <span class="hero__proof-num" data-count-to="${stats.ratings}">${toFa(stats.ratings)}</span>
              <span class="hero__proof-label">امتیاز</span>
            </span>
          </div>
          <span class="hero__proof-sep"></span>
          <div class="hero__proof-item">
            <span class="hero__proof-text">
              <span class="hero__proof-num" data-count-to="${stats.comments}">${toFa(stats.comments)}</span>
              <span class="hero__proof-label">نقد</span>
            </span>
          </div>
        </div>
      </div>

      <div class="hero__visual">
        <div class="hero-orbit" aria-hidden="true">
          <span class="hero-orbit__node hero-orbit__node--1">${icon('store', 18)}</span>
          <span class="hero-orbit__node hero-orbit__node--2">${icon('building', 18)}</span>
          <span class="hero-orbit__node hero-orbit__node--3">${icon('package', 18)}</span>
          <span class="hero-orbit__node hero-orbit__node--4">${icon('message', 18)}</span>
        </div>
        ${heroVerdictCard()}
      </div>
    </div>
  </section>`;
}

function leaderboardSection() {
  const top = store.leaderboard('vendor', { direction: 'desc', limit: 3, minTotal: 3 });
  const worst = store.leaderboard('vendor', { direction: 'asc', limit: 5, minTotal: 2 });

  const podium = top.length
    ? `<div class="podium">
        ${top
          .map(
            ({ entity, score }, index) => `<a class="podium__item podium__item--${index + 1} reveal reveal--delay-${index + 1}"
              href="${attr(store.entityHref('vendor', entity))}" data-link>
              <span class="podium__rank">${toFa(index + 1)}</span>
              ${brandBadge(entity.nameFa, entity.brandHue, index === 0 ? 'lg' : '')}
              <span class="podium__name">${esc(entity.nameFa)}</span>
              <span class="podium__meta">${toFa(score.total)} رأی</span>
              <span class="podium__score">${toFa(score.score > 0 ? `+${score.score}` : score.score)}</span>
              ${stackedLevelBar({ good: score.good, meh: score.meh, bad: score.bad })}
            </a>`,
          )
          .join('')}
      </div>`
    : emptyState({
        iconName: 'award',
        title: 'فهرست خالی است',
        actions: `<a class="btn btn--primary btn--sm" href="#/new" data-link>ثبت تجربه</a>`,
      });

  const worstList = worst.length
    ? `<div class="rank-list">
        ${worst
          .map(
            ({ entity, score }, index) => `<a class="rank-row" href="${attr(store.entityHref('vendor', entity))}" data-link>
              <span class="rank-row__idx">${toFa(index + 1)}</span>
              ${brandBadge(entity.nameFa, entity.brandHue, 'sm')}
              <span class="rank-row__main">
                <span class="rank-row__name">${esc(entity.nameFa)}</span>
                <span class="rank-row__sub">${toFa(score.total)} رأی</span>
              </span>
              <span class="rank-row__metric t-bad">${toFa(score.score)}</span>
            </a>`,
          )
          .join('')}
      </div>`
    : `<p class="t-mute" style="font-size:var(--fs-sm)">موردی نیست.</p>`;

  return `<section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'رتبه‌بندی',
        title: 'بهترین‌ها و بدترین‌ها',
        actions: `<a class="btn btn--outline btn--sm" href="#/vendors?sort=score_desc" data-link>همه ${icon('arrow-left', 14)}</a>`,
      })}
      <div class="grid grid--2" style="align-items:start;gap:var(--sp-8)">
        <div>
          <h3 style="font-size:var(--fs-md);margin-bottom:var(--sp-4)">${icon('crown', 16)} بهترین‌ها</h3>
          ${podium}
        </div>
        <div class="card card--pad card--glass">
          <h3 style="font-size:var(--fs-md);margin-bottom:var(--sp-4)">${icon('alert-triangle', 16)} با احتیاط</h3>
          ${worstList}
        </div>
      </div>
    </div>
  </section>`;
}

function latestReviewsSection() {
  const comments = store.recentComments(6);
  if (!comments.length) return '';

  return `<section class="section section--tight">
    <div class="container">
      ${sectionHead({
        eyebrow: 'زنده',
        title: 'آخرین نقدها',
        actions: `<a class="btn btn--outline btn--sm" href="#/reviews" data-link>همه ${icon('arrow-left', 14)}</a>`,
      })}
      <div class="latest-strip">
        ${comments
          .map((comment) => {
            const entity = store.getEntity(comment.entityType, comment.entityId);
            if (!entity) return '';
            return `<a class="latest-item" href="${attr(
              `${store.entityHref(comment.entityType, entity)}#comment-${comment.id}`,
            )}" data-link>
              <span class="latest-item__body">
                <span class="latest-item__text">${esc(truncate(comment.body, 110))}</span>
                <span class="latest-item__meta">
                  ${levelChip(comment.level, { withText: true })}
                  <span class="truncate" style="max-width:120px">${esc(store.entityName(comment.entityType, entity))}</span>
                  <span class="divider-dot"></span>
                  <span>${esc(relTime(comment.createdAt))}</span>
                </span>
              </span>
            </a>`;
          })
          .join('')}
      </div>
    </div>
  </section>`;
}

function categoriesSection() {
  const facets = store.categoryFacets();
  if (!facets.length) return '';
  return `<section class="section section--tight">
    <div class="container">
      ${sectionHead({
        eyebrow: 'قفسه‌ها',
        title: 'دسته‌بندی‌ها',
        actions: `<a class="btn btn--ghost btn--sm" href="#/products" data-link>همه ${icon('arrow-left', 14)}</a>`,
      })}
      <div class="category-grid">
        ${facets
          .map(
            (category) => `<a class="category-tile reveal" href="#/products?categories=${category.id}" data-link style="--cat:${category.color}">
              <span class="category-tile__icon">${icon(category.icon, 18)}</span>
              <span class="category-tile__name">${esc(category.label)}</span>
              <span class="category-tile__count">${toFa(category.count)}</span>
            </a>`,
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

export const homeView = {
  title: 'خانه',
  render() {
    return `<div class="page page--flush">
      ${modeBanner()}
      ${heroSection()}
      ${leaderboardSection()}
      ${latestReviewsSection()}
      ${categoriesSection()}
    </div>`;
  },
  mount(ctx, root) {
    setupReveal(root);
    animateCounters(root);

    const heroForm = root.querySelector('[data-hero-search]');
    const go = (value) => {
      const q = String(value || '').trim();
      if (!q) {
        document.getElementById('search-trigger')?.click();
        return;
      }
      window.location.hash = `#/search?q=${encodeURIComponent(q)}`;
    };
    heroForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      go(new FormData(heroForm).get('q'));
    });
    root.querySelectorAll('[data-hero-suggest]').forEach((button) => {
      button.addEventListener('click', () => go(button.dataset.heroSuggest));
    });
  },
};

export function modeBanner(state = store.getState()) {
  if (state.mode === 'demo') {
    return `<div class="container" style="padding-top:var(--sp-4)">
      <div class="banner banner--demo">
        <span class="banner__icon">${icon('database', 15)}</span>
        <div>حالت محلی</div>
        <div class="banner__actions">
          <a class="btn btn--outline btn--xs" href="#/guide#data" data-link>اتصال</a>
        </div>
      </div>
    </div>`;
  }
  return '';
}
