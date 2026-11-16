/**
 * بازاربان — قطعه‌های صفحهٔ موجودیت
 * ---------------------------------------------------------------------------
 * سربرگ موجودیت، ویجت امتیاز سه‌سطحی، فرم نقد و فهرست نقدها. این قطعه‌ها بین
 * صفحهٔ فروشنده، فروشگاه و محصول مشترک‌اند تا تجربه یکدست بماند.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS, CATEGORIES, categoryById } from '../config.js';
import {
  esc,
  attr,
  toFa,
  fmtInt,
  fmtPrice,
  relTime,
  formatJalali,
  truncate,
  hueFrom,
  externalLink,
  normalizeUrl,
  isValidUrl,
} from '../utils.js';
import * as store from '../store.js';
import {
  avatar,
  brandBadge,
  scoreBadge,
  ringFor,
  distributionRows,
  commentCard,
  emptyState,
  levelChip,
  levelPicker,
  toast,
  scoreLegend,
} from '../ui.js';
import { stackedLevelBar, donutChart, columnChart } from '../charts.js';

/* --------------------------------------------------------------------------
   داده‌های نمایشی سربرگ
   -------------------------------------------------------------------------- */
function heroStats(type, entity) {
  const score = store.scoreFor(type, entity.id);
  const commentCount = store.commentsOf(type, entity.id).length;

  if (type === 'vendor') {
    return [
      { label: 'شعبه', value: toFa(store.shopsOfVendor(entity.id).length), icon: 'building' },
      { label: 'محصول', value: toFa(store.productsOfVendor(entity.id).length), icon: 'package' },
      { label: 'نقد', value: toFa(commentCount), icon: 'message' },
      { label: 'امتیاز', value: toFa(score.total), icon: 'star' },
    ];
  }
  if (type === 'shop') {
    return [
      { label: 'محصول', value: toFa(store.productsOfShop(entity.id).length), icon: 'package' },
      { label: 'نقد', value: toFa(commentCount), icon: 'message' },
      { label: 'امتیاز', value: toFa(score.total), icon: 'star' },
      {
        label: 'خدمات',
        value: [entity.pickup ? 'حضوری' : '', entity.delivery ? 'ارسال' : ''].filter(Boolean).join(' + ') || '—',
        icon: 'truck',
      },
    ];
  }
  return [
    { label: 'نقد', value: toFa(commentCount), icon: 'message' },
    { label: 'امتیاز', value: toFa(score.total), icon: 'star' },
    { label: 'قیمت', value: entity.price ? fmtPrice(entity.price) : '—', icon: 'wallet' },
    { label: 'واحد', value: entity.unit || '—', icon: 'tag' },
  ];
}

function heroMeta(type, entity) {
  if (type === 'vendor') {
    return `
      <span class="badge badge--outline">${esc(CONFIG.KIND_MAP[entity.kind] || 'فروشنده')}</span>
      ${entity.city ? `<span class="badge badge--outline">${icon('map-pin', 11)} ${esc(entity.city)}</span>` : ''}
      ${entity.website ? `<a class="badge badge--outline" href="${attr(normalizeUrl(entity.website))}" target="_blank" rel="noopener noreferrer nofollow">${icon('globe', 11)} وب‌سایت</a>` : ''}
      ${entity.isVerified ? `<span class="badge badge--brand">${icon('verified', 11)} تأییدشده</span>` : ''}
      <span class="badge badge--outline">${icon('calendar', 11)} ثبت ${esc(formatJalali(entity.createdAt, { withYear: true }))}</span>`;
  }
  if (type === 'shop') {
    const vendor = store.getVendor(entity.vendorId);
    return `
      ${vendor ? `<a class="badge badge--brand" href="${attr(store.entityHref('vendor', vendor))}" data-link>${icon('store', 11)} ${esc(vendor.nameFa)}</a>` : ''}
      ${entity.city ? `<span class="badge badge--outline">${icon('map-pin', 11)} ${esc(entity.city)}${entity.district ? ` · ${esc(entity.district)}` : ''}</span>` : ''}
      ${entity.hours ? `<span class="badge badge--outline">${icon('clock', 11)} ${esc(entity.hours)}</span>` : ''}
      ${entity.pickup ? `<span class="badge badge--good">${icon('bag', 11)} تحویل حضوری</span>` : ''}
      ${entity.delivery ? `<span class="badge badge--cyan">${icon('truck', 11)} ارسال</span>` : ''}`;
  }
  const category = categoryById(entity.category);
  const vendor = store.getVendor(entity.vendorId);
  const shop = entity.shopId ? store.getShop(entity.shopId) : null;
  return `
    <span class="badge badge--outline">${icon(category.icon, 11)} ${esc(category.label)}</span>
    ${vendor ? `<a class="badge badge--brand" href="${attr(store.entityHref('vendor', vendor))}" data-link>${icon('store', 11)} ${esc(vendor.nameFa)}</a>` : ''}
    ${shop ? `<a class="badge badge--outline" href="${attr(store.entityHref('shop', shop))}" data-link>${icon('building', 11)} ${esc(shop.name)}</a>` : ''}
    ${entity.barcode ? `<span class="badge badge--outline">${icon('barcode', 11)} ${esc(entity.barcode)}</span>` : ''}`;
}

function heroDescription(type, entity) {
  if (type === 'vendor') return entity.description || entity.tagline || '';
  if (type === 'shop') {
    return [entity.address, entity.district, entity.city].filter(Boolean).join('، ');
  }
  const category = categoryById(entity.category);
  return `${entity.brand ? `برند ${entity.brand} · ` : ''}${category.label}${entity.unit ? ` · ${entity.unit}` : ''}${
    entity.price ? ` · حدود ${fmtPrice(entity.price)}` : ''
  }`;
}

/* --------------------------------------------------------------------------
   سربرگ
   -------------------------------------------------------------------------- */
export function entityHero(type, entity) {
  const score = store.scoreFor(type, entity.id);
  const hrefNew = `#/new?type=${type}&id=${entity.id}`;
  const hue = type === 'vendor' ? entity.brandHue : type === 'product' ? hueFrom(entity.name, 360) : 190;
  const category = type === 'product' ? categoryById(entity.category) : null;

  const badge =
    type === 'vendor'
      ? brandBadge(entity.nameFa, hue, 'xl')
      : type === 'product'
        ? `<span class="product-thumb product-thumb--lg" style="--p-hue:${hue}">${icon(category.icon, 50)}</span>`
        : `<span class="brand-badge brand-badge--xl" style="--bb-hue:${hue}">${icon('building', 42)}</span>`;

  const tags = (entity.tags || []).slice(0, 6);

  return `<header class="entity-hero" style="--entity-cover:hsl(${hue} 60% 50% / .18);--entity-accent:hsl(${hue} 65% 60%)">
    <div class="entity-hero__cover"></div>
    <div class="entity-hero__body">
      <div class="entity-hero__top">
        <span class="entity-hero__avatar">${badge}</span>
        <div class="entity-hero__identity">
          <h1 class="entity-hero__title">
            ${esc(store.entityName(type, entity))}
            ${entity.isVerified ? `<span class="badge badge--brand">${icon('verified', 12)}</span>` : ''}
          </h1>
          <div class="entity-hero__meta">${heroMeta(type, entity)}</div>
        </div>
        <div class="entity-hero__actions">
          <span data-hero-score>${score.total ? scoreBadge(type, entity, { size: 'lg', withCount: true }) : ''}</span>
          <a class="btn btn--primary btn--sm" href="${attr(hrefNew)}" data-link data-compose>
            ${icon('plus', 15)} ثبت تجربه
          </a>
          <button class="btn btn--outline btn--sm" type="button" data-action="save-entity" data-type="${type}" data-id="${entity.id}">
            ${icon(store.inShoppingList(type, entity.id) ? 'check' : 'bookmark', 15)}
            ${store.inShoppingList(type, entity.id) ? 'در خرید بعدی' : 'خرید بعدی'}
          </button>
          <button class="btn btn--ghost btn--sm" type="button" data-action="toggle-compare" data-type="${type}" data-id="${entity.id}">
            ${icon(store.inCompare(type, entity.id) ? 'check' : 'columns', 15)} مقایسه
          </button>
          <button class="icon-btn" type="button" data-action="share-entity" data-type="${type}" data-id="${entity.id}" aria-label="اشتراک" title="اشتراک">
            ${icon('share', 17)}
          </button>
        </div>
      </div>

      <p class="entity-hero__desc">${esc(heroDescription(type, entity))}</p>
      ${
        tags.length || (type === 'product' && entity.isAvailable === false)
          ? `<div class="entity-hero__tags">
              ${entity.isAvailable === false ? `<span class="badge badge--meh">${icon('alert-circle', 11)} ناموجود</span>` : ''}
              ${tags.map((tag) => `<span class="chip chip--soft">#${esc(tag)}</span>`).join('')}
            </div>`
          : ''
      }

      <div class="entity-hero__stats">
        ${heroStats(type, entity)
          .map(
            (stat) => `<div class="mini-stat">
              <span class="mini-stat__value">${stat.value}</span>
              <span class="mini-stat__label">${icon(stat.icon, 10)} ${esc(stat.label)}</span>
            </div>`,
          )
          .join('')}
      </div>
    </div>
  </header>`;
}

/* --------------------------------------------------------------------------
   ویجت امتیاز
   -------------------------------------------------------------------------- */
export function rateWidget(type, entity) {
  const score = store.scoreFor(type, entity.id);
  const mine = store.myRating(type, entity.id);
  const user = store.currentUser();

  return `<aside class="rate-widget" data-rate-widget>
    <div class="rate-widget__head">
      <div>
        <div class="rate-widget__title">${esc(CONFIG.COPY.levelQuestion)}</div>
        <div class="rate-widget__sub">${toFa(score.total)} رأی ثبت‌شده · بدون ستاره، فقط سه سطح</div>
      </div>
      ${score.total ? scoreBadge(type, entity, { size: 'lg' }) : ''}
    </div>

    <div class="rate-widget__score">
      ${ringFor(type, entity, 78)}
      ${distributionRows(score)}
    </div>

    <div class="level-picker" role="group" aria-label="ثبت امتیاز">
      ${LEVELS.map(
        (level) => `<button class="level-btn level-btn--${level.className}" type="button"
          data-action="rate-entity" data-type="${type}" data-id="${entity.id}" data-level="${level.id}"
          aria-pressed="${mine?.value === level.id}" data-selected="${mine?.value === level.id}"
          title="${esc(level.hint)}">
          <span class="level-btn__icon">${icon(level.icon, 18)}</span>
          <span>${esc(level.label)}</span>
        </button>`,
      ).join('')}
    </div>

    ${
      mine
        ? `<div class="rate-widget__state rate-widget__state--${mine.value}">
            ${icon('check-circle', 14)}
            <span>امتیاز تو ثبت شد: <b>${esc(store.scoreLabel(mine.value))}</b>
            — ${esc(relTime(mine.updatedAt || mine.createdAt))}. می‌توانی هر وقت عوضش کنی.</span>
          </div>`
        : `<div class="rate-widget__state">
            ${icon('info', 14)}
            <span>${user ? 'یک انتخاب کافی است؛ می‌توانی بلافاصله یک جمله هم اضافه کنی.' : 'برای ثبت امتیاز باید وارد شوی؛ ثبت نقد مهمان هم ممکن است.'}</span>
          </div>`
    }

    <div class="rate-widget__foot">
      <span>${icon('shield', 12)} امتیازها عمومی و قابل تغییرند</span>
      <a class="link" href="#/guide#levels" data-link style="font-size:var(--fs-2xs)">قواعد امتیاز</a>
    </div>
  </aside>`;
}

/* --------------------------------------------------------------------------
   فرم نقد
   -------------------------------------------------------------------------- */
export function commentComposer(type, entity) {
  const tags = CONFIG.COMMENT_TAGS.slice(0, 12);
  return `<form class="review-form card card--pad" data-comment-form data-type="${type}" data-id="${entity.id}">
    <div class="row row--between" style="align-items:flex-start">
      <div>
        <h3 style="font-size:var(--fs-md)">${icon('message-plus', 16)} نقد خودت را بنویس</h3>
        <p class="hint mt-2">کوتاه و دقیق بنویس؛ چیزی که برای خودت مهم بود، برای بقیه هم مهم است.</p>
      </div>
      <span class="badge badge--outline">${icon('shield', 11)} بدون تبلیغ</span>
    </div>

    <div class="field" style="position:relative">
      <label class="label" for="comment-body-${attr(entity.id)}">متن نقد</label>
      <textarea class="textarea" id="comment-body-${attr(entity.id)}" name="body" rows="4"
        maxlength="${CONFIG.COMMENT_MAX}" placeholder="مثلاً: سفارش ساعت ۸ ثبت شد و ۴۰ دقیقه بعد رسید؛ بسته‌بندی سالم بود…"
        data-comment-body></textarea>
      <span class="input-counter" data-comment-counter>۰ / ${toFa(CONFIG.COMMENT_MAX)}</span>
    </div>

    <div class="review-form__level">
      <div class="review-form__level-label">
        <span>سطح تجربه (اختیاری)</span>
        <span class="t-faint" style="font-size:var(--fs-2xs)">اگر انتخاب کنی، در امتیازها هم حساب می‌شود</span>
      </div>
      <div class="level-picker">
        ${LEVELS.map(
          (level) => `<button class="level-btn level-btn--${level.className}" type="button"
            data-comment-level="${level.id}" data-selected="false" aria-pressed="false">
            <span class="level-btn__icon">${icon(level.icon, 16)}</span>
            <span>${esc(level.label)}</span>
          </button>`,
        ).join('')}
      </div>
      <input type="hidden" name="level" value="" data-comment-level-input />
    </div>

    <div class="field">
      <span class="label">برچسب‌ها <span class="label__hint">تا ۵ مورد</span></span>
      <div class="tag-picker" data-comment-tags>
        ${tags
          .map(
            (tag) =>
              `<button class="tag-chip" type="button" data-tag="${attr(tag)}" aria-pressed="false">#${esc(tag)}</button>`,
          )
          .join('')}
      </div>
    </div>

    <div class="row row--between" style="gap:var(--sp-4);flex-wrap:wrap">
      <span class="hint" style="max-width:44ch">
        ${icon('info', 12)} نقد باید دربارهٔ همین ${esc(CONFIG.ENTITY_MAP[type].label)} باشد.
        از توهین و اطلاعات شخصی پرهیز کن.
      </span>
      <button class="btn btn--primary" type="submit">${icon('send', 15)} ثبت نقد</button>
    </div>
  </form>`;
}

/* --------------------------------------------------------------------------
   فعال‌سازی فرم نقد
   -------------------------------------------------------------------------- */
export function mountComposer(root, { onCreated } = {}) {
  const form = root.querySelector('[data-comment-form]');
  if (!form) return;
  const body = form.querySelector('[data-comment-body]');
  const counter = form.querySelector('[data-comment-counter]');
  const levelInput = form.querySelector('[data-comment-level-input]');
  const levelButtons = Array.from(form.querySelectorAll('[data-comment-level]'));
  const tagButtons = Array.from(form.querySelectorAll('[data-tag]'));
  const submit = form.querySelector('button[type="submit"]');
  const selectedTags = new Set();

  const updateCounter = () => {
    const length = body.value.length;
    counter.textContent = `${toFa(length)} / ${toFa(CONFIG.COMMENT_MAX)}`;
    counter.style.color = length > CONFIG.COMMENT_MAX * 0.92 ? 'var(--bad)' : '';
  };
  body.addEventListener('input', updateCounter);
  updateCounter();

  levelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const level = button.dataset.commentLevel;
      const already = levelInput.value === level;
      levelButtons.forEach((node) => {
        const active = !already && node.dataset.commentLevel === level;
        node.dataset.selected = String(active);
        node.setAttribute('aria-pressed', String(active));
      });
      levelInput.value = already ? '' : level;
    });
  });

  tagButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tag = button.dataset.tag;
      if (selectedTags.has(tag)) {
        selectedTags.delete(tag);
        button.setAttribute('aria-pressed', 'false');
      } else {
        if (selectedTags.size >= 5) {
          toast('حداکثر ۵ برچسب می‌توانی انتخاب کنی.', { type: 'meh' });
          return;
        }
        selectedTags.add(tag);
        button.setAttribute('aria-pressed', 'true');
      }
    });
  });

  let submitting = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!store.currentUser() && store.getState().mode === 'live') {
      document.dispatchEvent(new CustomEvent('bb:require-auth', { detail: { reason: 'comment' } }));
      return;
    }

    const text = body.value.trim();
    if (text.length < CONFIG.COMMENT_MIN) {
      toast(`نقد باید حداقل ${toFa(CONFIG.COMMENT_MIN)} کاراکتر باشد.`, { type: 'meh' });
      body.focus();
      return;
    }

    submitting = true;
    const original = submit.innerHTML;
    submit.innerHTML = `<span class="btn__spinner"></span> در حال ثبت…`;
    submit.disabled = true;

    try {
      const created = await store.addComment({
        type: form.dataset.type,
        id: form.dataset.id,
        body: text,
        level: levelInput.value || null,
        tags: [...selectedTags],
      });
      body.value = '';
      selectedTags.clear();
      tagButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
      levelButtons.forEach((node) => {
        node.dataset.selected = 'false';
        node.setAttribute('aria-pressed', 'false');
      });
      levelInput.value = '';
      updateCounter();
      toast('نقد ثبت شد. ممنون که تجربه‌ات را نوشتی.', { type: 'good', title: 'ثبت شد' });
      onCreated?.(created);
    } catch (error) {
      const message = String(error?.message || '');
      if (/وارد شو|auth/i.test(message)) {
        document.dispatchEvent(new CustomEvent('bb:require-auth', { detail: { reason: 'comment' } }));
      } else {
        toast(message || 'ثبت نقد ناموفق بود.', { type: 'bad' });
      }
    } finally {
      submitting = false;
      submit.disabled = false;
      submit.innerHTML = original;
    }
  });
}

/* --------------------------------------------------------------------------
   فهرست نقدها
   -------------------------------------------------------------------------- */
export function commentsList(type, entity, { level = 'all', sort = 'new', limit = 40 } = {}) {
  let list = store.commentsOf(type, entity.id);
  if (level !== 'all') list = list.filter((comment) => comment.level === level);
  if (sort === 'old') list = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  else if (sort === 'helpful') list = [...list].sort((a, b) => store.voteCount(b.id) - store.voteCount(a.id));
  else list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const sliced = list.slice(0, limit);

  if (!sliced.length) {
    return emptyState({
      iconName: 'message',
      title: level === 'all' ? 'هنوز نقدی برای این مورد نیست' : 'نقدی با این سطح نیست',
      text:
        level === 'all'
          ? 'اولین نفری باش که تجربه‌اش را می‌نویسد. یک جمله کوتاه هم کافی است.'
          : 'سطح دیگری را انتخاب کن یا اولین نقد این سطح را بنویس.',
    });
  }

  return `<div class="comments">${sliced
    .map((comment) => commentCard(comment, { entity, entityType: type }))
    .join('')}</div>
    ${
      list.length > limit
        ? `<p class="hint mt-6">${toFa(list.length - limit)} نقد دیگر هست؛ فیلترها را تغییر بده.</p>`
        : ''
    }`;
}

/* --------------------------------------------------------------------------
   تب‌ها
   -------------------------------------------------------------------------- */
export function tabsBar({ tabs, active }) {
  return `<div class="tabs" role="tablist">
    ${tabs
      .map(
        (tab) => `<button class="tab" type="button" role="tab" data-detail-tab="${tab.id}"
          aria-selected="${tab.id === active}" id="tab-${tab.id}" aria-controls="panel-${tab.id}">
          ${icon(tab.icon, 15)} ${esc(tab.label)}
          ${tab.count !== undefined ? `<span class="tab__count">${toFa(tab.count)}</span>` : ''}
        </button>`,
      )
      .join('')}
  </div>`;
}

/* --------------------------------------------------------------------------
   پنل آمار
   -------------------------------------------------------------------------- */
export function statsPanel(type, entity) {
  const score = store.scoreFor(type, entity.id);
  const comments = store.commentsOf(type, entity.id);
  const ratings = store.ratingsOf(type, entity.id);

  const buckets = new Map();
  for (const rating of ratings) {
    const key = String(rating.createdAt).slice(0, 7);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const months = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-8)
    .map(([key, value]) => {
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return {
        label: date.toLocaleDateString('fa-IR', { month: 'short' }),
        value,
        color: 'var(--brand-500)',
      };
    });

  const fromComments = comments.filter((c) => c.level);
  const commentDist = {
    good: fromComments.filter((c) => c.level === 'good').length,
    meh: fromComments.filter((c) => c.level === 'meh').length,
    bad: fromComments.filter((c) => c.level === 'bad').length,
  };

  return `<div class="grid grid--2" style="align-items:start">
    <div class="card card--pad">
      <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-5)">${icon('chart-pie', 15)} توزیع امتیازها</h3>
      <div class="row" style="gap:var(--sp-6);align-items:center">
        ${donutChart({
          segments: [
            { value: score.good, color: 'var(--good)', label: 'خوب' },
            { value: score.meh, color: 'var(--meh)', label: 'نه‌خوب' },
            { value: score.bad, color: 'var(--bad)', label: 'افتضاح' },
          ],
          size: 132,
          centerLabel: toFa(score.total),
          centerCaption: 'رأی',
        })}
        <div style="flex:1;min-width:140px">
          ${distributionRows(score)}
          <div class="row row--between mt-6" style="font-size:var(--fs-2xs)">
            <span class="t-faint">شاخص رضایت</span>
            <strong style="color:${store.scoreColor(score.verdict)}">${toFa(score.score > 0 ? `+${score.score}` : score.score)}</strong>
          </div>
          <div class="row row--between" style="font-size:var(--fs-2xs)">
            <span class="t-faint">میانگین سه‌سطحی</span>
            <strong>${toFa(score.total ? score.stars.toFixed(1) : '—')} از ۵</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="card card--pad">
      <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-5)">${icon('chart-bar', 15)} روند امتیازها</h3>
      ${
        months.length
          ? columnChart({ data: months, height: 100 })
          : `<p class="t-faint" style="font-size:var(--fs-xs)">برای نمایش روند، حداقل یک رأی لازم است.</p>`
      }
      <div class="history-chart__legend mt-6">
        <span><i style="background:var(--brand-500)"></i> تعداد رأی در ماه</span>
      </div>
    </div>

    <div class="card card--pad">
      <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-5)">${icon('message', 15)} کیفیت نقدها</h3>
      <div class="sentiment-summary">
        <div class="sentiment-summary__row">
          <span class="dot dot--good"></span> نقدهای خوب
          <b>${toFa(commentDist.good)}</b>
        </div>
        <div class="sentiment-summary__row">
          <span class="dot dot--meh"></span> نقدهای نه‌خوب
          <b>${toFa(commentDist.meh)}</b>
        </div>
        <div class="sentiment-summary__row">
          <span class="dot dot--bad"></span> نقدهای افتضاح
          <b>${toFa(commentDist.bad)}</b>
        </div>
        <div class="sentiment-summary__row" style="border-top:1px solid var(--line);padding-top:var(--sp-3)">
          <span>${icon('thumbs-up', 12)} مجموع رأی مفید</span>
          <b>${toFa(comments.reduce((acc, c) => acc + store.voteCount(c.id), 0))}</b>
        </div>
      </div>
    </div>

    <div class="card card--pad">
      <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-5)">${icon('info', 15)} جمع‌بندی</h3>
      <p class="hint" style="font-size:var(--fs-xs);line-height:1.95">
        ${esc(store.scoreLabel(score.verdict))} — بر اساس ${toFa(score.total)} رأی.
        ${
          score.total === 0
            ? 'هنوز داده‌ای برای قضاوت نیست؛ اولین تجربه را ثبت کن.'
            : score.verdict === 'good'
              ? 'اکثریت خریداران این مورد را «خوب» ارزیابی کرده‌اند.'
              : score.verdict === 'bad'
                ? 'بیشتر تجربه‌ها منفی بوده؛ با احتیاط تصمیم بگیر.'
                : 'نظرها یکدست نیست؛ جزئیات نقدها را بخوان و خودت قضاوت کن.'
        }
      </p>
      <div class="chips-row mt-4">${scoreLegend()}</div>
      <button class="btn btn--outline btn--sm mt-6" type="button" data-action="report-entity" data-type="${type}" data-id="${entity.id}">
        ${icon('flag', 14)} گزارش مشکل در این صفحه
      </button>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   فروشگاه‌های فروشنده / محصولات
   -------------------------------------------------------------------------- */
export function shopsGrid(vendor) {
  const shops = store
    .shopsOfVendor(vendor.id)
    .sort((a, b) => store.scoreFor('shop', b.id).score - store.scoreFor('shop', a.id).score);

  if (!shops.length) {
    return emptyState({
      iconName: 'building',
      title: 'برای این فروشنده شعبه‌ای ثبت نشده',
      text: 'شعبهٔ مورد نظرت را اضافه کن تا تجربه‌های همان شعبه جدا بررسی شوند.',
      actions: `<a class="btn btn--primary btn--sm" href="#/new?type=shop&vendor=${attr(vendor.id)}" data-link>${icon('plus', 14)} افزودن شعبه</a>`,
    });
  }

  return `<div class="grid grid--2">
    ${shops
      .map((shop) => {
        const score = store.scoreFor('shop', shop.id);
        return `<article class="shop-card">
          <span class="shop-card__icon">${icon('building', 20)}</span>
          <div class="shop-card__main">
            <a class="shop-card__title" href="${attr(store.entityHref('shop', shop))}" data-link>${esc(shop.name)}</a>
            <div class="shop-card__meta">
              ${icon('map-pin', 11)} ${esc(shop.district || shop.city || '')}
              <span class="divider-dot"></span>
              ${icon('clock', 11)} ${esc(shop.hours || '—')}
            </div>
            <div class="shop-card__tags">
              ${shop.pickup ? `<span class="chip chip--soft">${icon('bag', 11)} حضوری</span>` : ''}
              ${shop.delivery ? `<span class="chip chip--soft">${icon('truck', 11)} ارسال</span>` : ''}
              <span class="chip chip--soft">${icon('message', 11)} ${toFa(store.commentsOf('shop', shop.id).length)}</span>
            </div>
          </div>
          <div class="shop-card__side">
            ${scoreBadge('shop', shop)}
            <a class="link" href="${attr(store.entityHref('shop', shop))}" data-link style="font-size:var(--fs-2xs)">جزئیات ${icon('arrow-left', 12)}</a>
          </div>
        </article>`;
      })
      .join('')}
  </div>`;
}

/* --------------------------------------------------------------------------
   راهنمای خرید / مسیر
   -------------------------------------------------------------------------- */
export function buyRoute(type, entity) {
  if (type !== 'product') return '';
  const vendor = store.getVendor(entity.vendorId);
  const shop = entity.shopId ? store.getShop(entity.shopId) : null;
  return `<div class="card card--pad">
    <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-4)">${icon('compass', 15)} این محصول را از کجا بخرم؟</h3>
    <div class="stack stack--sm">
      ${
        vendor
          ? `<a class="related-mini" href="${attr(store.entityHref('vendor', vendor))}" data-link>
              ${brandBadge(vendor.nameFa, vendor.brandHue, 'sm')}
              <span class="related-mini__main">
                <span class="related-mini__title">${esc(vendor.nameFa)}</span>
                <span class="related-mini__sub">فروشندهٔ اصلی</span>
              </span>
              ${scoreBadge('vendor', vendor)}
            </a>`
          : ''
      }
      ${
        shop
          ? `<a class="related-mini" href="${attr(store.entityHref('shop', shop))}" data-link>
              <span class="brand-badge brand-badge--sm" style="--bb-hue:190">${icon('building', 17)}</span>
              <span class="related-mini__main">
                <span class="related-mini__title">${esc(shop.name)}</span>
                <span class="related-mini__sub">${esc(shop.district || shop.city || '')}</span>
              </span>
              ${scoreBadge('shop', shop)}
            </a>`
          : `<p class="hint">این محصول به شعبهٔ خاصی وصل نیست؛ در همهٔ شعبه‌های فروشنده قابل سفارش فرض می‌شود.</p>`
      }
    </div>
    <button class="btn btn--outline btn--sm btn--block mt-6" type="button" data-action="save-entity" data-type="${type}" data-id="${entity.id}">
      ${icon('bookmark', 14)} افزودن به «خرید بعدی»
    </button>
  </div>`;
}

/* --------------------------------------------------------------------------
   بازخوانی ویجت امتیاز پس از ثبت
   -------------------------------------------------------------------------- */
export function refreshRateWidget(root, type, entity) {
  const widget = root.querySelector('[data-rate-widget]');
  if (widget) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = rateWidget(type, entity);
    widget.replaceWith(wrapper.firstElementChild);
  }
  const heroScore = root.querySelector('[data-hero-score]');
  if (heroScore) {
    const score = store.scoreFor(type, entity.id);
    heroScore.innerHTML = score.total ? scoreBadge(type, entity, { size: 'lg', withCount: true }) : '';
  }
}
