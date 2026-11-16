/**
 * بازاربان — صفحهٔ خانه
 * ---------------------------------------------------------------------------
 * قهرمان جست‌وجو، سه سطح امتیاز، سکوی افتخار، فهرست هشدار، جریان نقدها،
 * دسته‌بندی‌ها و گردش کار. صفحهٔ خانه باید در یک نگاه بگوید «بازاربان چیست».
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS, CATEGORIES } from '../config.js';
import {
  esc,
  attr,
  toFa,
  fmtInt,
  fmtPercent,
  relTime,
  truncate,
  formatJalali,
  formatJalaliShort,
  hueFrom,
  $,
  $$,
} from '../utils.js';
import * as store from '../store.js';
import {
  avatar,
  brandBadge,
  scoreBadge,
  entityCard,
  commentCard,
  sectionHead,
  emptyState,
  ringFor,
  levelChip,
  scoreLegend,
  setupReveal,
  animateCounters,
  toast,
} from '../ui.js';
import { stackedLevelBar, sparkline, columnChart } from '../charts.js';
import { activityBuckets } from './partials.js';

/* --------------------------------------------------------------------------
   کارت قهرمان
   -------------------------------------------------------------------------- */
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
      <div class="verdict-card__body">
        <div class="verdict-card__detail">
          <p class="t-mute" style="font-size:var(--fs-xs);line-height:1.9">با ثبت اولین امتیاز، این کارت زنده می‌شود.</p>
        </div>
      </div>
    </div>`;
  }
  const { entity, score } = top;
  const review = store.commentsOf('vendor', entity.id).find((c) => c.level === 'good') ||
    store.commentsOf('vendor', entity.id)[0];
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
    ${
      review
        ? `<div class="verdict-card__quote">${esc(truncate(review.body, 120))}
            <div class="verdict-card__foot" style="padding-top:var(--sp-3);margin-top:var(--sp-3)">
              <span>${esc(store.displayNameOf(review))}</span>
              <span>${esc(relTime(review.createdAt))}</span>
            </div>
          </div>`
        : ''
    }
    <div class="verdict-card__foot">
      <span>${icon('message', 12)} ${toFa(store.commentsOf('vendor', entity.id).length)} نقد</span>
      <a class="link" href="${attr(store.entityHref('vendor', entity))}" data-link style="font-size:var(--fs-2xs)">پروندهٔ کامل ${icon('arrow-left', 13)}</a>
    </div>
  </div>`;
}

function heroSection() {
  const stats = store.globalStats();
  const suggestions = ['شیر', 'اسنپ‌فود', 'شعبهٔ ونک', 'میوه', 'ماست'];

  return `<section class="hero">
    <div class="container hero__inner">
      <div class="hero__content">
        <span class="hero__eyebrow">
          <span class="dot dot--live"></span>
          حافظهٔ جمعی خرید آنلاین · ${toFa(stats.vendors)} فروشنده
        </span>
        <h1 class="hero__title">
          قبل از خرید،<br />
          <span class="gradient-text">بازار</span> را ببین.
        </h1>
        <p class="hero__lead">
          فروشنده، شعبه و محصول را ببین؛ تجربه‌ات را در
          <strong>سه سطح ساده</strong> ثبت کن و یادت بماند کجا بخر و کجا نه.
          نه ستاره، نه عدد پیچیده — فقط «خوب»، «نه‌خوب» و «افتضاح».
        </p>

        <form class="hero-search" data-hero-search role="search">
          <span class="hero-search__icon">${icon('search', 20)}</span>
          <input class="hero-search__input" type="search" name="q" placeholder="دنبال فروشنده، شعبه یا محصول بگرد…"
            aria-label="جست‌وجو" autocomplete="off" />
          <button class="btn btn--primary" type="submit">
            ${icon('search', 16)} <span>بگرد</span>
          </button>
        </form>

        <div class="hero__quick">
          <span>پرجست‌وجو:</span>
          ${suggestions
            .map(
              (word) =>
                `<button class="chip chip--soft chip--button" type="button" data-hero-suggest="${attr(word)}">${esc(word)}</button>`,
            )
            .join('')}
        </div>

        <div class="hero__proof">
          <div class="hero__proof-item">
            <span class="avatar-stack">
              ${[
                ['نگار', 152],
                ['سعید', 268],
                ['مریم', 20],
                ['امیر', 194],
              ]
                .map(([name, hue]) => avatar({ name, hue, size: 'sm' }))
                .join('')}
            </span>
            <span class="hero__proof-text">
              <span class="hero__proof-num">${toFa(stats.contributors)}</span>
              <span class="hero__proof-label">خریدار در حال ثبت تجربه</span>
            </span>
          </div>
          <span class="hero__proof-sep"></span>
          <div class="hero__proof-item">
            <span class="hero__proof-text">
              <span class="hero__proof-num" data-count-to="${stats.ratings}">${toFa(stats.ratings)}</span>
              <span class="hero__proof-label">امتیاز ثبت‌شده</span>
            </span>
          </div>
          <span class="hero__proof-sep"></span>
          <div class="hero__proof-item">
            <span class="hero__proof-text">
              <span class="hero__proof-num" data-count-to="${stats.comments}">${toFa(stats.comments)}</span>
              <span class="hero__proof-label">نقد کوتاه</span>
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
        <div class="hero-sticker hero-sticker--good">${icon('check-circle', 14)} پیش از خرید بررسی کن</div>
        <div class="hero-sticker hero-sticker--bad">${icon('alert-triangle', 14)} پشیمانی ممنوع</div>
        ${heroVerdictCard()}
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   سه سطح
   -------------------------------------------------------------------------- */
function levelsSection() {
  return `<section class="section section--tight">
    <div class="container">
      ${sectionHead({
        eyebrow: 'مدل امتیاز',
        title: 'سه سطح، بدون پیچیدگی',
        sub: 'به‌جای ستاره‌های مبهم، فقط بگو تجربه‌ات کدام یکی بود. همان چیزی که به دوستت می‌گویی.',
        actions: `<a class="btn btn--outline btn--sm" href="#/guide" data-link>${icon('help', 15)} قواعد امتیازدهی</a>`,
      })}
      <div class="level-legend">
        ${LEVELS.map(
          (level) => `<article class="level-card level-card--${level.className} reveal">
            <span class="level-card__icon">${icon(level.icon, 24)}</span>
            <h3 class="level-card__title">${esc(level.label)}</h3>
            <p class="level-card__text">${esc(level.hint)}</p>
            <span class="level-card__weight">${icon('info', 12)} ${esc(level.explanation)}</span>
          </article>`,
        ).join('')}
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   رتبه‌بندی
   -------------------------------------------------------------------------- */
function leaderboardSection() {
  const top = store.leaderboard('vendor', { direction: 'desc', limit: 3, minTotal: 3 });
  const worst = store.leaderboard('vendor', { direction: 'asc', limit: 5, minTotal: 2 });
  const stats = store.globalStats();

  const podium = top.length
    ? `<div class="podium">
        ${top
          .map(
            ({ entity, score }, index) => `<a class="podium__item podium__item--${index + 1} reveal reveal--delay-${index + 1}"
              href="${attr(store.entityHref('vendor', entity))}" data-link>
              <span class="podium__rank">${toFa(index + 1)}</span>
              ${brandBadge(entity.nameFa, entity.brandHue, index === 0 ? 'lg' : '')}
              <span class="podium__name">${esc(entity.nameFa)}</span>
              <span class="podium__meta">${toFa(score.total)} رأی · ${esc(entity.city || 'ایران')}</span>
              <span class="podium__score">${toFa(score.score > 0 ? `+${score.score}` : score.score)}</span>
              ${stackedLevelBar({ good: score.good, meh: score.meh, bad: score.bad })}
              <span class="badge badge--${score.verdict === 'good' ? 'good' : score.verdict === 'bad' ? 'bad' : 'meh'}">${esc(
                store.scoreLabel(score.verdict),
              )}</span>
            </a>`,
          )
          .join('')}
      </div>`
    : emptyState({
        iconName: 'award',
        title: 'سکوی افتخار هنوز خالی است',
        text: 'با ثبت اولین امتیازها، بهترین فروشنده‌ها همین‌جا بالا می‌آیند.',
        actions: `<a class="btn btn--primary btn--sm" href="#/vendors" data-link>دیدن فروشنده‌ها</a>`,
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
                <span class="rank-row__sub">${toFa(score.total)} رأی · ${esc(CONFIG.KIND_MAP[entity.kind])}</span>
              </span>
              <span class="rank-row__metric t-bad">${toFa(score.score)}</span>
            </a>`,
          )
          .join('')}
      </div>`
    : `<p class="t-mute" style="font-size:var(--fs-sm)">هنوز فروشنده‌ای با امتیاز منفی نداریم.</p>`;

  return `<section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'رتبه‌بندی زنده',
        title: 'این‌ها را از حفظ باش',
        sub: `بر اساس ${toFa(stats.ratings)} رأی واقعیِ ثبت‌شده. شاخص رضایت = درصد «خوب» منهای «افتضاح».`,
        actions: `<a class="btn btn--outline btn--sm" href="#/vendors?sort=score_desc" data-link>همهٔ فروشنده‌ها ${icon('arrow-left', 14)}</a>`,
      })}
      <div class="grid grid--2" style="align-items:start;gap:var(--sp-8)">
        <div>
          <div class="row row--between mb-6">
            <h3 style="font-size:var(--fs-md)">${icon('crown', 16)} بهترین‌ها</h3>
            <span class="badge badge--good">${toFa(stats.goodRate)}٪ رضایت کل</span>
          </div>
          ${podium}
        </div>
        <div class="card card--pad card--glass">
          <div class="row row--between mb-6">
            <h3 style="font-size:var(--fs-md)">${icon('alert-triangle', 16)} با احتیاط خرید کن</h3>
            <a class="link" href="#/vendors?sort=score_asc" data-link style="font-size:var(--fs-2xs)">همه ${icon('arrow-left', 12)}</a>
          </div>
          <p class="t-mute" style="font-size:var(--fs-xs);line-height:1.8;margin-bottom:var(--sp-5)">
            این‌ها فروشندگانی هستند که شاخص رضایتشان پایین است. شاید تجربهٔ تو بهتر باشد؛ ولی با چشم باز خرید کن.
          </p>
          ${worstList}
          <div class="callout callout--meh" style="margin-top:var(--sp-6)">
            <span class="callout__icon">${icon('info', 14)}</span>
            <div>یک تجربهٔ بد دلیل بر بدی همیشگی نیست؛ امتیازها میانگین همهٔ خریداران است.</div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   آخرین نقدها
   -------------------------------------------------------------------------- */
function latestReviewsSection() {
  const comments = store.recentComments(6);
  if (!comments.length) return '';

  return `<section class="section section--tight">
    <div class="container">
      ${sectionHead({
        eyebrow: 'جریان زنده',
        title: 'آخرین چیزهایی که خریداران گفتند',
        sub: 'بدون فیلتر، بدون ویرایش. هر نقد به یک موجودیت مشخص وصل است.',
        actions: `<a class="btn btn--outline btn--sm" href="#/reviews" data-link>همهٔ نقدها ${icon('arrow-left', 14)}</a>`,
      })}
      <div class="latest-strip">
        ${comments
          .map((comment) => {
            const entity = store.getEntity(comment.entityType, comment.entityId);
            if (!entity) return '';
            return `<a class="latest-item" href="${attr(
              `${store.entityHref(comment.entityType, entity)}#comment-${comment.id}`,
            )}" data-link>
              ${avatar({ name: store.displayNameOf(comment), hue: store.avatarHueOf(comment), size: 'sm' })}
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

/* --------------------------------------------------------------------------
   دسته‌بندی‌ها
   -------------------------------------------------------------------------- */
function categoriesSection() {
  const facets = store.categoryFacets();
  if (!facets.length) return '';
  return `<section class="section section--tight">
    <div class="container">
      ${sectionHead({
        eyebrow: 'قفسه‌ها',
        title: 'از کدام قفسه شروع می‌کنی؟',
        sub: 'محصولات را بر اساس دسته ببین و امتیاز همان قلم را بخوان.',
        actions: `<a class="btn btn--ghost btn--sm" href="#/products" data-link>همهٔ محصولات ${icon('arrow-left', 14)}</a>`,
      })}
      <div class="category-grid">
        ${facets
          .map(
            (category) => `<a class="category-tile reveal" href="#/products?categories=${category.id}" data-link style="--cat:${category.color}">
              <span class="category-tile__icon">${icon(category.icon, 18)}</span>
              <span class="category-tile__name">${esc(category.label)}</span>
              <span class="category-tile__count">${toFa(category.count)} محصول</span>
            </a>`,
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   گردش کار
   -------------------------------------------------------------------------- */
function stepsSection() {
  const steps = [
    { icon: 'search', title: 'بگرد و پیدا کن', text: 'فروشنده، شعبه یا محصول را جست‌وجو کن. اگر نبود، خودت اضافه کن — با انتخاب از فهرست، رکورد تکراری نمی‌سازی.' },
    { icon: 'star', title: 'سه‌سطحی امتیاز بده', text: 'خوب، نه‌خوب یا افتضاح. یک کلیک؛ لازم نیست عدد یا ستاره انتخاب کنی.' },
    { icon: 'message', title: 'یک جمله بنویس', text: 'بگو چه شد: سفارش ناقص، تحویل دیر، بستهٔ سالم. همین یک جمله به نفر بعدی کمک می‌کند.' },
    { icon: 'bookmark', title: 'برای بعد ذخیره کن', text: 'به «خرید بعدی» اضافه کن و شعبه‌های خوب شهرت را همیشه دم دست داشته باش.' },
  ];
  return `<section class="section">
    <div class="container">
      ${sectionHead({
        eyebrow: 'چطور کار می‌کند',
        title: 'چهار قدم تا خرید بی‌پشیمانی',
        sub: 'بازاربان جای سفارش دادن نیست؛ جای یادداشت کردن تجربه است. سریع، بی‌تعارف، برای خودت و بقیه.',
        center: true,
      })}
      <div class="steps">
        ${steps
          .map(
            (step) => `<article class="step reveal">
              <span class="step__icon">${icon(step.icon, 19)}</span>
              <h3 class="step__title">${esc(step.title)}</h3>
              <p class="step__text">${esc(step.text)}</p>
            </article>`,
          )
          .join('')}
      </div>
      <div class="cta-band" style="margin-top:var(--sp-12)">
        <div class="cta-band__main">
          <h2 class="cta-band__title">یک تجربه داری که ارزش نوشتن دارد؟</h2>
          <p class="cta-band__text">
            همان چیزی که به دوستت می‌گویی را این‌جا بنویس. یک جمله کافی است تا کسی دیگر پولش را هدر ندهد.
          </p>
        </div>
        <div class="cta-band__actions">
          <a class="btn btn--primary btn--lg" href="#/new" data-link>${icon('plus', 17)} ثبت تجربه</a>
          <a class="btn btn--outline btn--lg" href="#/guide" data-link>${icon('help', 17)} قواعد بازی</a>
        </div>
      </div>
    </div>
  </section>`;
}

/* --------------------------------------------------------------------------
   صفحه
   -------------------------------------------------------------------------- */
export const homeView = {
  title: 'خانه',
  render(ctx) {
    const state = store.getState();
    return `<div class="page page--flush">
      ${modeBanner(state)}
      ${heroSection()}
      ${levelsSection()}
      ${leaderboardSection()}
      ${latestReviewsSection()}
      ${categoriesSection()}
      ${stepsSection()}
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
      const value = new FormData(heroForm).get('q');
      go(value);
    });
    root.querySelectorAll('[data-hero-suggest]').forEach((button) => {
      button.addEventListener('click', () => go(button.dataset.heroSuggest));
    });
  },
};

/* --------------------------------------------------------------------------
   نوار حالت (نمایشی/واقعی)
   -------------------------------------------------------------------------- */
export function modeBanner(state = store.getState()) {
  if (state.mode === 'demo') {
    return `<div class="container" style="padding-top:var(--sp-4)">
      <div class="banner banner--demo">
        <span class="banner__icon">${icon('database', 15)}</span>
        <div>
          <strong>حالت نمایشی</strong> — داده‌ها فقط در همین مرورگر ذخیره می‌شوند و برای نمایش رابط ساخته شده‌اند.
          ${state.modeDetail ? `<span class="t-faint">${esc(state.modeDetail)}</span>` : ''}
        </div>
        <div class="banner__actions">
          <a class="btn btn--outline btn--xs" href="#/guide#data" data-link>راه‌اندازی</a>
        </div>
      </div>
    </div>`;
  }
  if (state.mode === 'live') {
    return '';
  }
  return '';
}
