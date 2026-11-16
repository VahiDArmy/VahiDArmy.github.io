/**
 * بازاربان — داشبورد من
 * ---------------------------------------------------------------------------
 * همهٔ چیزهایی که این کاربر ثبت کرده: امتیازها، نقدها، لیست‌های خرید، فعالیت و
 * تنظیمات نمایه. در حالت نمایشی، حساب محلی است و در همین مرورگر می‌ماند.
 */

import { icon } from '../icons.js';
import { CONFIG, LEVELS, CITIES } from '../config.js';
import {
  esc,
  attr,
  toFa,
  fmtInt,
  fmtPercent,
  relTime,
  formatJalali,
  formatJalaliShort,
  storage,
  hueFrom,
  downloadJson,
  sortBy,
  clamp,
} from '../utils.js';
import * as store from '../store.js';
import {
  avatar as avatarHtml,
  emptyState,
  breadcrumbs,
  pageHead,
  levelChip,
  scoreBadge,
  brandBadge,
  toast,
  confirmDialog,
  openModal,
  setupReveal,
} from '../ui.js';
import { donutChart, columnChart, stackedLevelBar } from '../charts.js';
import { modeBanner } from './home.js';

const TABS = [
  { id: 'overview', label: 'نمای کلی', icon: 'home' },
  { id: 'ratings', label: 'امتیازهای من', icon: 'star' },
  { id: 'comments', label: 'نقدهای من', icon: 'message' },
  { id: 'lists', label: 'خرید بعدی', icon: 'bookmark' },
  { id: 'activity', label: 'فعالیت', icon: 'activity' },
  { id: 'settings', label: 'تنظیمات', icon: 'settings' },
];

/* --------------------------------------------------------------------------
   حالت مهمان
   -------------------------------------------------------------------------- */
function guestState() {
  return `<div class="container page">
    ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'داشبورد من' }])}
    ${pageHead({
      eyebrow: 'حساب من',
      title: 'داشبورد من',
      sub: 'اینجا امتیازها، نقدها و لیست خرید بعدی‌ات جمع می‌شود.',
    })}
    <div class="auth-page" style="grid-template-columns:minmax(0,1fr) minmax(0,0.9fr)">
      <div class="card card--pad">
        ${emptyState({
          iconName: 'lock',
          title: 'هنوز وارد نشده‌ای',
          text:
            'برای دیدن داشبورد و ذخیرهٔ تجربه‌ها وارد شو. در حالت نمایشی می‌توانی با هر ایمیل و رمز ۶ کاراکتری وارد شوی.',
          actions: `
            <a class="btn btn--primary btn--sm" href="#/login" data-link>${icon('user', 14)} ورود / ثبت‌نام</a>
            <a class="btn btn--outline btn--sm" href="#/vendors" data-link>گشتن در بازار</a>`,
        })}
      </div>
      <div class="card card--pad card--glass">
        <h3 style="font-size:var(--fs-md);margin-bottom:var(--sp-4)">بدون حساب هم می‌توانی:</h3>
        <div class="stack stack--sm">
          ${[
            { icon: 'search', text: 'همهٔ فروشنده‌ها و شعبه‌ها را ببینی و امتیازشان را بخوانی.' },
            { icon: 'message', text: 'در حالت نمایشی نقد بنویسی (فقط در مرورگر خودت).' },
            { icon: 'columns', text: 'مقایسه بسازی؛ مقایسه در همین مرورگر می‌ماند.' },
            { icon: 'bookmark', text: 'لیست خرید بعدی را با یک حساب محلی بسازی.' },
          ]
            .map(
              (row) => `<div class="row" style="align-items:flex-start;gap:var(--sp-3)">
                <span class="callout__icon">${icon(row.icon, 14)}</span>
                <span class="hint" style="font-size:var(--fs-xs)">${row.text}</span>
              </div>`,
            )
            .join('')}
        </div>
      </div>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   نمای کلی
   -------------------------------------------------------------------------- */
function overviewPanel(user) {
  const ratings = store.myRatings();
  const comments = store.myComments();
  const lists = store.myLists();
  const votes = store.getState().votes.filter((vote) => vote.userId === user.id);
  const distribution = {
    good: ratings.filter((rating) => rating.value === 'good').length,
    meh: ratings.filter((rating) => rating.value === 'meh').length,
    bad: ratings.filter((rating) => rating.value === 'bad').length,
  };

  const recent = sortBy(ratings, (rating) => new Date(rating.createdAt), 'desc').slice(0, 5);

  return `
    <div class="dash-hero">
      <div class="dash-hero__top">
        ${avatarHtml({ name: store.getState().profile?.displayName || user.displayName || user.email, hue: store.getState().profile?.avatarHue ?? user.avatarHue, size: 'xl', ring: true })}
        <div class="dash-hero__identity">
          <h1 class="dash-hero__name">${esc(store.getState().profile?.displayName || user.displayName || 'کاربر بازاربان')}</h1>
          <div class="dash-hero__meta">
            ${icon('mail', 12)} ${esc(user.email || '—')}
            ${store.getState().profile?.city ? `<span class="divider-dot"></span>${icon('map-pin', 12)} ${esc(store.getState().profile.city)}` : ''}
            <span class="divider-dot"></span>
            ${user.isDemo ? '<span class="badge badge--meh">حساب نمایشی</span>' : '<span class="badge badge--good">حساب Supabase</span>'}
          </div>
        </div>
        <button class="btn btn--outline btn--sm" type="button" data-dash-tab="settings">${icon('edit', 14)} ویرایش نمایه</button>
      </div>

      <div class="dash-hero__stats">
        ${[
          { label: 'امتیاز', value: ratings.length, icon: 'star' },
          { label: 'نقد', value: comments.length, icon: 'message' },
          { label: 'لیست خرید', value: lists.length, icon: 'bookmark' },
          { label: 'رأی مفید داده‌ام', value: votes.length, icon: 'thumbs-up' },
        ]
          .map(
            (stat) => `<div class="mini-stat">
              <span class="mini-stat__value">${toFa(stat.value)}</span>
              <span class="mini-stat__label">${icon(stat.icon, 10)} ${esc(stat.label)}</span>
            </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="grid grid--2" style="align-items:start">
      <div class="card card--pad">
        <div class="row row--between mb-4">
          <h2 style="font-size:var(--fs-md)">${icon('chart-pie', 15)} سلیقهٔ امتیازدهی تو</h2>
          <button class="link" type="button" data-dash-tab="ratings" style="font-size:var(--fs-2xs)">همه ${icon('arrow-left', 12)}</button>
        </div>
        ${
          ratings.length
            ? `<div class="row" style="gap:var(--sp-5);align-items:center">
                ${donutChart({
                  segments: [
                    { value: distribution.good, color: 'var(--good)' },
                    { value: distribution.meh, color: 'var(--meh)' },
                    { value: distribution.bad, color: 'var(--bad)' },
                  ],
                  size: 118,
                  centerLabel: toFa(ratings.length),
                  centerCaption: 'رأی',
                })}
                <div style="flex:1">
                  ${LEVELS.map(
                    (level) => `<div class="row row--between" style="font-size:var(--fs-xs);margin-bottom:var(--sp-2)">
                      <span><span class="dot dot--${level.className}"></span> ${esc(level.label)}</span>
                      <strong>${toFa(distribution[level.id])}</strong>
                    </div>`,
                  ).join('')}
                  <p class="hint mt-4">${ratings.length >= 5 ? 'سلیقه‌ات شکل گرفته؛ سعی کن در هر سه سطح منصف بمانی.' : 'هرچه بیشتر امتیاز بدهی، این نمودار معنادارتر می‌شود.'}</p>
                </div>
              </div>`
            : `<p class="hint">هنوز امتیازی ثبت نکرده‌ای. از صفحهٔ هر فروشنده، شعبه یا محصول شروع کن.</p>`
        }
      </div>

      <div class="card card--pad">
        <div class="row row--between mb-4">
          <h2 style="font-size:var(--fs-md)">${icon('clock', 15)} آخرین امتیازها</h2>
        </div>
        ${
          recent.length
            ? `<div class="stack stack--sm">${recent
                .map((rating) => {
                  const entity = store.getEntity(rating.entityType, rating.entityId);
                  if (!entity) return '';
                  return `<a class="my-rating-row" href="${attr(store.entityHref(rating.entityType, entity))}" data-link>
                    ${levelChip(rating.value)}
                    <span class="my-rating-row__main">
                      <span class="my-rating-row__title">${esc(store.entityName(rating.entityType, entity))}</span>
                      <span class="my-rating-row__meta">${esc(CONFIG.ENTITY_MAP[rating.entityType].label)} · ${esc(relTime(rating.createdAt))}</span>
                    </span>
                    ${icon('chevron-left', 15)}
                  </a>`;
                })
                .join('')}</div>`
            : `<p class="hint">هنوز چیزی ثبت نکرده‌ای.</p>`
        }
      </div>

      <div class="card card--pad">
        <h2 style="font-size:var(--fs-md);margin-bottom:var(--sp-4)">${icon('bookmark', 15)} خرید بعدی</h2>
        ${
          lists.length
            ? `<div class="stack stack--sm">${lists
                .map((list) => {
                  const items = store.itemsOfList(list.id);
                  return `<a class="related-mini" href="#/me?tab=lists" data-link>
                    <span class="list-card__emoji" style="width:32px;height:32px;font-size:16px">${esc(list.emoji)}</span>
                    <span class="related-mini__main">
                      <span class="related-mini__title">${esc(list.name)}</span>
                      <span class="related-mini__sub">${toFa(items.length)} مورد</span>
                    </span>
                    ${icon('chevron-left', 15)}
                  </a>`;
                })
                .join('')}</div>`
            : `<p class="hint">لیستی نساخته‌ای. با دکمهٔ «خرید بعدی» در هر صفحه، اولین لیست خودکار ساخته می‌شود.</p>`
        }
      </div>

      <div class="card card--pad">
        <h2 style="font-size:var(--fs-md);margin-bottom:var(--sp-4)">${icon('zap', 15)} میان‌برهای من</h2>
        <div class="grid grid--2" style="gap:var(--sp-3)">
          <a class="tile" href="#/new" data-link><span class="tile__head">${icon('plus', 13)} ثبت تجربه</span><span class="tile__value" style="font-size:var(--fs-sm)">افزودن</span></a>
          <a class="tile" href="#/compare" data-link><span class="tile__head">${icon('columns', 13)} مقایسه</span><span class="tile__value" style="font-size:var(--fs-sm)">${toFa(store.getState().compare.length)} مورد</span></a>
          <a class="tile" href="#/vendors?sort=score_asc" data-link><span class="tile__head">${icon('alert-triangle', 13)} هشدارها</span><span class="tile__value" style="font-size:var(--fs-sm)">بدترین‌ها</span></a>
          <a class="tile" href="#/reviews" data-link><span class="tile__head">${icon('message', 13)} نقدها</span><span class="tile__value" style="font-size:var(--fs-sm)">جریان</span></a>
        </div>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   امتیازهای من
   -------------------------------------------------------------------------- */
function ratingsPanel() {
  const ratings = sortBy(store.myRatings(), (rating) => new Date(rating.createdAt), 'desc');
  if (!ratings.length) {
    return emptyState({
      iconName: 'star',
      title: 'هنوز امتیازی ثبت نکرده‌ای',
      text: 'سه سطح ساده: خوب، نه‌خوب، افتضاح. از هر صفحه‌ای می‌توانی امتیاز بدهی و بعداً عوضش کنی.',
      actions: `<a class="btn btn--primary btn--sm" href="#/vendors" data-link>شروع از فروشنده‌ها</a>`,
    });
  }

  return `<div class="dash-section">
    <div class="dash-section__head">
      <h2 class="dash-section__title">${icon('star', 17)} ${toFa(ratings.length)} امتیاز ثبت‌شده</h2>
      <span class="badge badge--outline">قابل تغییر در هر لحظه</span>
    </div>
    <div class="stack stack--sm">
      ${ratings
        .map((rating) => {
          const entity = store.getEntity(rating.entityType, rating.entityId);
          if (!entity) return '';
          const score = store.scoreFor(rating.entityType, entity.id);
          return `<div class="my-rating-row">
            ${levelChip(rating.value)}
            <span class="my-rating-row__main">
              <a class="my-rating-row__title" href="${attr(store.entityHref(rating.entityType, entity))}" data-link>${esc(
                store.entityName(rating.entityType, entity),
              )}</a>
              <span class="my-rating-row__meta">${esc(CONFIG.ENTITY_MAP[rating.entityType].label)} · ${esc(
                relTime(rating.createdAt),
              )} · کل ${toFa(score.total)} رأی</span>
            </span>
            <div class="cluster cluster--sm">
              ${LEVELS.map(
                (level) => `<button class="btn btn--${level.className} btn--xs" type="button"
                  data-action="quick-rate" data-type="${rating.entityType}" data-id="${rating.entityId}" data-level="${level.id}"
                  aria-pressed="${rating.value === level.id}" style="${rating.value === level.id ? '' : 'opacity:.55'}">
                  ${icon(level.icon, 12)}
                </button>`,
              ).join('')}
            </div>
          </div>`;
        })
        .join('')}
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   نقدهای من
   -------------------------------------------------------------------------- */
function commentsPanel() {
  const comments = sortBy(store.myComments(), (comment) => new Date(comment.createdAt), 'desc');
  if (!comments.length) {
    return emptyState({
      iconName: 'message',
      title: 'هنوز نقدی ننوشته‌ای',
      text: 'یک جمله کافی است: چه سفارش دادی، چه شد و دفعهٔ بعد چه می‌کنی. همین به بقیه کمک می‌کند.',
      actions: `<a class="btn btn--primary btn--sm" href="#/new" data-link>${icon('plus', 14)} نوشتن اولین نقد</a>`,
    });
  }
  return `<div class="dash-section">
    <div class="dash-section__head">
      <h2 class="dash-section__title">${icon('message', 17)} ${toFa(comments.length)} نقد</h2>
    </div>
    <div class="stack stack--sm">
      ${comments
        .map((comment) => {
          const entity = store.getEntity(comment.entityType, comment.entityId);
          if (!entity) return '';
          return `<article class="card card--pad">
            <div class="row row--between" style="align-items:flex-start;flex-wrap:wrap">
              <div class="cluster cluster--sm">
                ${levelChip(comment.level)}
                <a class="link" href="${attr(store.entityHref(comment.entityType, entity))}" data-link style="font-size:var(--fs-xs)">
                  ${esc(store.entityName(comment.entityType, entity))} ${icon('arrow-left', 12)}
                </a>
                <span class="t-faint" style="font-size:var(--fs-2xs)">${esc(relTime(comment.createdAt))}</span>
              </div>
              <button class="icon-btn icon-btn--danger" type="button" data-delete-comment="${comment.id}" aria-label="حذف نقد">
                ${icon('trash', 15)}
              </button>
            </div>
            <p style="font-size:var(--fs-sm);line-height:1.9;color:var(--text-soft);margin-top:var(--sp-3)">${esc(comment.body)}</p>
            ${
              comment.tags?.length
                ? `<div class="chips-row mt-4">${comment.tags
                    .map((tag) => `<span class="comment__tag">#${esc(tag)}</span>`)
                    .join('')}</div>`
                : ''
            }
            <div class="row mt-4" style="font-size:var(--fs-2xs);color:var(--text-faint)">
              ${icon('thumbs-up', 12)} ${toFa(store.voteCount(comment.id))} نفر مفید دیدند
            </div>
          </article>`;
        })
        .join('')}
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   لیست‌های خرید
   -------------------------------------------------------------------------- */
function listsPanel() {
  const lists = store.myLists();
  return `<div class="dash-section">
    <div class="dash-section__head">
      <h2 class="dash-section__title">${icon('bookmark', 17)} لیست‌های خرید</h2>
      <button class="btn btn--outline btn--sm" type="button" data-new-list>${icon('plus', 14)} لیست جدید</button>
    </div>

    ${
      lists.length
        ? `<div class="grid grid--2">${lists
            .map((list) => {
              const items = store.itemsOfList(list.id);
              return `<div class="list-card">
                <div class="list-card__head">
                  <span class="list-card__emoji">${esc(list.emoji)}</span>
                  <div style="flex:1;min-width:0">
                    <div class="list-card__title">${esc(list.name)}</div>
                    <div class="list-card__count">${toFa(items.length)} مورد</div>
                  </div>
                  <span class="badge badge--outline">${list.isPublic ? 'عمومی' : 'خصوصی'}</span>
                </div>
                ${
                  items.length
                    ? `<div class="list-card__items">${items
                        .map((item) => {
                          const entity = item.entity;
                          return `<div class="list-item-row">
                            <span class="list-item-row__dot"></span>
                            <a href="${attr(store.entityHref(item.entityType, entity))}" data-link style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(
                              store.entityName(item.entityType, entity),
                            )}</a>
                            <span class="t-faint" style="font-size:10px">${esc(CONFIG.ENTITY_MAP[item.entityType].label)}</span>
                            <button class="icon-btn" type="button" data-remove-list-item="${item.id}" data-list-id="${list.id}" aria-label="حذف">
                              ${icon('close', 13)}
                            </button>
                          </div>`;
                        })
                        .join('')}</div>`
                    : `<p class="hint">خالی است. از صفحهٔ محصولات، دکمهٔ «خرید بعدی» را بزن.</p>`
                }
              </div>`;
            })
            .join('')}</div>`
        : `<div class="card card--pad">${emptyState({
            iconName: 'bookmark',
            title: 'لیستی نداری',
            text: 'لیست «خرید بعدی» خودکار ساخته می‌شود؛ کافی است در هر صفحه دکمهٔ خرید بعدی را بزنی.',
            actions: `<a class="btn btn--primary btn--sm" href="#/products" data-link>دیدن محصولات</a>`,
          })}</div>`
    }
  </div>`;
}

/* --------------------------------------------------------------------------
   فعالیت
   -------------------------------------------------------------------------- */
const ACTION_LABELS = {
  rate: 'امتیاز دادی',
  comment: 'نقد نوشتی',
  create: 'مورد جدید ثبت کردی',
  list_add: 'به لیست اضافه کردی',
  vote: 'نظر مفیدی را تأیید کردی',
};

function activityPanel() {
  const activity = sortBy(store.getState().activity, (entry) => new Date(entry.createdAt), 'desc').slice(0, 60);
  if (!activity.length) {
    return emptyState({
      iconName: 'activity',
      title: 'فعالیتی ثبت نشده',
      text: 'هر امتیاز، نقد یا افزودن به لیست این‌جا ثبت می‌شود تا تاریخچهٔ خریدت را ببینی.',
    });
  }
  return `<div class="dash-section">
    <div class="dash-section__head">
      <h2 class="dash-section__title">${icon('activity', 17)} تاریخچهٔ فعالیت</h2>
      <span class="badge badge--outline">${toFa(activity.length)} رویداد</span>
    </div>
    <div class="card card--pad">
      <div class="timeline">
        ${activity
          .map((entry) => {
            const entity = store.getEntity(entry.entityType, entry.entityId);
            return `<div class="timeline__item">
              <span class="timeline__dot"></span>
              <div>
                <strong>${esc(ACTION_LABELS[entry.action] || entry.action)}</strong>
                ${entity ? ` — <a class="link" href="${attr(store.entityHref(entry.entityType, entity))}" data-link>${esc(store.entityName(entry.entityType, entity))}</a>` : ''}
                <span class="timeline__time">${esc(formatJalali(entry.createdAt, { withYear: true }))} · ${esc(relTime(entry.createdAt))}</span>
              </div>
            </div>`;
          })
          .join('')}
      </div>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   تنظیمات
   -------------------------------------------------------------------------- */
function settingsPanel(user) {
  const profile = store.getState().profile || {
    displayName: user.displayName || '',
    city: '',
    bio: '',
    avatarHue: user.avatarHue ?? 152,
  };
  const theme = document.documentElement.dataset.theme || 'dark';
  const density = document.documentElement.dataset.density || 'cozy';

  return `<div class="dash-section">
    <div class="dash-section__head">
      <h2 class="dash-section__title">${icon('settings', 17)} تنظیمات حساب</h2>
    </div>

    <form class="card card--pad" data-profile-form>
      <div class="row" style="gap:var(--sp-5);align-items:center;flex-wrap:wrap;margin-bottom:var(--sp-6)">
        ${avatarHtml({ name: profile.displayName || 'کاربر', hue: profile.avatarHue, size: 'lg' })}
        <div style="flex:1;min-width:200px">
          <div class="label">رنگ آواتار</div>
          <input class="range" type="range" min="0" max="359" value="${Number(profile.avatarHue) || 152}" data-hue-range />
        </div>
        <span class="badge badge--outline">${user.email}</span>
      </div>

      <div class="form-grid">
        <div class="field">
          <label class="label" for="profile-name">نام نمایشی</label>
          <input class="input" id="profile-name" name="displayName" maxlength="40" value="${attr(profile.displayName)}" placeholder="مثلاً نگار" />
        </div>
        <div class="field">
          <label class="label" for="profile-city">شهر</label>
          <select class="select" id="profile-city" name="city">
            <option value="">انتخاب کن</option>
            ${CITIES.map((city) => `<option value="${attr(city)}" ${profile.city === city ? 'selected' : ''}>${esc(city)}</option>`).join('')}
          </select>
        </div>
        <div class="field span-2">
          <label class="label" for="profile-bio">دربارهٔ من <span class="label__hint">اختیاری</span></label>
          <textarea class="textarea" id="profile-bio" name="bio" maxlength="280" rows="3" placeholder="مثلاً: خرید هفتگی خانه، عاشق میوهٔ تازه.">${esc(profile.bio || '')}</textarea>
        </div>
      </div>

      <div class="row row--between mt-6" style="flex-wrap:wrap;gap:var(--sp-3)">
        <span class="hint">${icon('shield', 12)} نام نمایشی روی نقدهای عمومی دیده می‌شود.</span>
        <button class="btn btn--primary btn--sm" type="submit">${icon('check', 14)} ذخیرهٔ نمایه</button>
      </div>
    </form>

    <div class="grid grid--2" style="align-items:start">
      <div class="card card--pad">
        <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-4)">${icon('sun', 15)} ظاهر</h3>
        <div class="row row--between mb-4">
          <span style="font-size:var(--fs-xs)">تم</span>
          <div class="segmented">
            <button class="segmented__btn" type="button" data-set-theme="dark" aria-pressed="${theme === 'dark'}">${icon('moon', 13)} تاریک</button>
            <button class="segmented__btn" type="button" data-set-theme="light" aria-pressed="${theme === 'light'}">${icon('sun', 13)} روشن</button>
          </div>
        </div>
        <div class="row row--between">
          <span style="font-size:var(--fs-xs)">تراکم</span>
          <div class="segmented">
            <button class="segmented__btn" type="button" data-set-density="cozy" aria-pressed="${density === 'cozy'}">معمولی</button>
            <button class="segmented__btn" type="button" data-set-density="compact" aria-pressed="${density === 'compact'}">فشرده</button>
          </div>
        </div>
      </div>

      <div class="card card--pad">
        <h3 style="font-size:var(--fs-sm);margin-bottom:var(--sp-4)">${icon('database', 15)} داده‌ها</h3>
        <p class="hint" style="margin-bottom:var(--sp-4)">
          ${user.isDemo ? 'در حالت نمایشی داده‌ها در localStorage همین مرورگر ذخیره می‌شوند.' : 'داده‌های این حساب در Supabase شما ذخیره می‌شود.'}
        </p>
        <div class="stack stack--sm">
          <button class="btn btn--outline btn--sm btn--block" type="button" data-export-data>${icon('download', 14)} خروجی JSON از داده‌ها</button>
          ${
            store.getState().mode === 'demo'
              ? `<button class="btn btn--ghost btn--sm btn--block" type="button" data-reset-demo style="color:var(--bad)">${icon('refresh', 14)} بازنشانی دادهٔ نمایشی</button>`
              : ''
          }
          <button class="btn btn--ghost btn--sm btn--block" type="button" data-sign-out style="color:var(--bad)">${icon('logout', 14)} خروج از حساب</button>
        </div>
      </div>
    </div>

    <div class="callout callout--meh">
      <span class="callout__icon">${icon('info', 14)}</span>
      <div>
        <div class="callout__title">دربارهٔ داده‌ها</div>
        بازاربان هیچ سفارشی ثبت نمی‌کند و به حساب فروشنده‌ها وصل نیست. نقدها نظر خریداران است و می‌تواند با تجربهٔ تو متفاوت باشد.
      </div>
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   صفحه
   -------------------------------------------------------------------------- */
export const dashboardView = {
  title: 'داشبورد من',
  render(ctx) {
    const user = store.currentUser();
    if (!user) {
      return `<div data-guest>${guestState()}</div>`;
    }

    const activeTab = TABS.some((tab) => tab.id === ctx.query.tab) ? ctx.query.tab : 'overview';
    const panels = {
      overview: () => overviewPanel(user),
      ratings: ratingsPanel,
      comments: commentsPanel,
      lists: listsPanel,
      activity: activityPanel,
      settings: () => settingsPanel(user),
    };

    return `<div class="page">
      ${modeBanner()}
      <div class="container">
        ${breadcrumbs([{ label: 'خانه', href: '#/' }, { label: 'داشبورد من' }])}
        <div class="dash-layout">
          <nav class="dash-nav" aria-label="بخش‌های داشبورد">
            ${TABS.map((tab) => {
              const counts = {
                ratings: store.myRatings().length,
                comments: store.myComments().length,
                lists: store.myLists().length,
                activity: store.getState().activity.length,
              };
              return `<button class="dash-nav__item" type="button" data-dash-tab="${tab.id}" data-active="${tab.id === activeTab}">
                ${icon(tab.icon, 15)} <span>${esc(tab.label)}</span>
                ${counts[tab.id] !== undefined ? `<span class="dash-nav__count">${toFa(counts[tab.id])}</span>` : ''}
              </button>`;
            }).join('')}
          </nav>
          <div data-dash-panel>${panels[activeTab]()}</div>
        </div>
      </div>
    </div>`;
  },

  mount(ctx, root) {
    setupReveal(root);
    let activeTab = TABS.some((tab) => tab.id === ctx.query.tab) ? ctx.query.tab : 'overview';
    const panel = () => root.querySelector('[data-dash-panel]');
    const user = store.currentUser();

    const renderPanel = () => {
      const userNow = store.currentUser();
      if (!userNow) {
        window.location.hash = '#/me';
        return;
      }
      const panelEl = panel();
      const panels = {
        overview: () => overviewPanel(userNow),
        ratings: ratingsPanel,
        comments: commentsPanel,
        lists: listsPanel,
        activity: activityPanel,
        settings: () => settingsPanel(userNow),
      };
      panelEl.innerHTML = panels[activeTab]();
      const url = new URL(window.location.href);
      const base = url.hash.split('?')[0];
      window.history.replaceState(null, '', `${base}${activeTab === 'overview' ? '' : `?tab=${activeTab}`}`);
      root.querySelectorAll('[data-dash-tab]').forEach((button) => {
        button.dataset.active = String(button.dataset.dashTab === activeTab);
      });
      setupReveal(panelEl);
    };

    root.addEventListener('click', async (event) => {
      const tabButton = event.target.closest('[data-dash-tab]');
      if (tabButton) {
        activeTab = tabButton.dataset.dashTab;
        renderPanel();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const deleteButton = event.target.closest('[data-delete-comment]');
      if (deleteButton) {
        const ok = await confirmDialog({
          title: 'نقد حذف شود؟',
          text: 'این نقد برای همیشه پاک می‌شود. امکان بازگردانی نیست.',
          confirmLabel: 'حذف کن',
          tone: 'danger',
        });
        if (!ok) return;
        try {
          await store.deleteComment(deleteButton.dataset.deleteComment);
          toast('نقد حذف شد.', { type: 'good' });
          renderPanel();
        } catch (error) {
          toast(error.message || 'حذف ناموفق بود.', { type: 'bad' });
        }
        return;
      }

      const removeItem = event.target.closest('[data-remove-list-item]');
      if (removeItem) {
        try {
          await store.removeFromList(removeItem.dataset.listId, removeItem.dataset.removeListItem);
          toast('از لیست حذف شد.', { type: 'info' });
          renderPanel();
        } catch (error) {
          toast(error.message, { type: 'bad' });
        }
        return;
      }

      if (event.target.closest('[data-new-list]')) {
        openModal({
          title: 'لیست خرید جدید',
          body: `<div class="field">
            <label class="label" for="new-list-name">نام لیست</label>
            <input class="input" id="new-list-name" name="name" placeholder="مثلاً خرید آخر هفته" value="خرید بعدی" />
          </div>
          <div class="field mt-4">
            <span class="label">نماد</span>
            <div class="chips-row" data-emoji-picker>
              ${['🛒', '🥬', '🍎', '🧺', '🏠', '🎁', '📦'].map(
                (emoji, index) =>
                  `<button class="chip chip--button" type="button" data-emoji="${emoji}" aria-pressed="${index === 0}">${emoji}</button>`,
              ).join('')}
            </div>
          </div>`,
          footer: `<button class="btn btn--ghost" type="button" data-cancel>انصراف</button>
                   <button class="btn btn--primary" type="button" data-create>ساختن</button>`,
          onMount: (modal, close) => {
            let emoji = '🛒';
            modal.querySelectorAll('[data-emoji]').forEach((button) => {
              button.addEventListener('click', () => {
                emoji = button.dataset.emoji;
                modal.querySelectorAll('[data-emoji]').forEach((node) => {
                  node.setAttribute('aria-pressed', String(node === button));
                });
              });
            });
            modal.querySelector('[data-cancel]')?.addEventListener('click', close);
            modal.querySelector('[data-create]')?.addEventListener('click', async () => {
              const name = modal.querySelector('#new-list-name').value.trim();
              if (!name) {
                toast('برای لیست یک نام بنویس.', { type: 'meh' });
                return;
              }
              try {
                await store.createList({ name, emoji });
                close();
                toast('لیست ساخته شد.', { type: 'good' });
                renderPanel();
              } catch (error) {
                toast(error.message, { type: 'bad' });
              }
            });
          },
        });
        return;
      }

      if (event.target.closest('[data-export-data]')) {
        downloadJson(store.exportSnapshot(), `bazaarban-${new Date().toISOString().slice(0, 10)}.json`);
        toast('فایل خروجی آماده شد.', { type: 'good' });
        return;
      }

      if (event.target.closest('[data-reset-demo]')) {
        const ok = await confirmDialog({
          title: 'دادهٔ نمایشی بازنشانی شود؟',
          text: 'همهٔ نقدها و امتیازهای محلی پاک می‌شوند و دادهٔ نمونه دوباره ساخته می‌شود.',
          confirmLabel: 'بازنشانی',
          tone: 'danger',
        });
        if (!ok) return;
        store.resetDemoData();
        toast('دادهٔ نمایشی بازنشانی شد.', { type: 'good' });
        window.location.hash = '#/';
        return;
      }

      if (event.target.closest('[data-sign-out]')) {
        const ok = await confirmDialog({
          title: 'از حساب خارج می‌شوی؟',
          text: 'نقدها و امتیازهای ثبت‌شده باقی می‌مانند.',
          confirmLabel: 'خروج',
          tone: 'danger',
        });
        if (!ok) return;
        await store.signOut();
        store.persistDemoSession();
        toast('خارج شدی.', { type: 'info' });
        window.location.hash = '#/';
        return;
      }

      const themeButton = event.target.closest('[data-set-theme]');
      if (themeButton) {
        document.dispatchEvent(
          new CustomEvent('bb:set-theme', { detail: { theme: themeButton.dataset.setTheme } }),
        );
        root.querySelectorAll('[data-set-theme]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button === themeButton));
        });
      }

      const densityButton = event.target.closest('[data-set-density]');
      if (densityButton) {
        document.dispatchEvent(
          new CustomEvent('bb:set-density', { detail: { density: densityButton.dataset.setDensity } }),
        );
        root.querySelectorAll('[data-set-density]').forEach((button) => {
          button.setAttribute('aria-pressed', String(button === densityButton));
        });
      }
    });

    root.addEventListener('submit', async (event) => {
      if (!event.target.matches('[data-profile-form]')) return;
      event.preventDefault();
      const form = event.target;
      const data = new FormData(form);
      const hue = Number(form.querySelector('[data-hue-range]')?.value || 152);
      try {
        await store.updateProfile({
          displayName: String(data.get('displayName') || '').trim(),
          city: String(data.get('city') || ''),
          bio: String(data.get('bio') || '').trim(),
          avatarHue: hue,
        });
        toast('نمایه ذخیره شد.', { type: 'good' });
        renderPanel();
      } catch (error) {
        toast(error.message || 'ذخیره ناموفق بود.', { type: 'bad' });
      }
    });
  },
};
