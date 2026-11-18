/* ==========================================================================
   parts.js — قطعه‌های HTML مشترک بین نماها
   ========================================================================== */

import { icon } from '../lib/icons.js';
import { esc, faNum, fmtInt, fmtMoney, fmtQty, highlight, cls, initials, hashHue, pct } from '../lib/utils.js';
import { RATINGS, RATING_LIST, ratingInfo } from '../lib/domain.js';
import { formatJalali, purchaseAgo } from '../lib/jalali.js';

/* -------------------------------- امتیاز -------------------------------- */

export function ratingPill(rating, { size = '', withLabel = true } = {}) {
  const meta = ratingInfo(rating);
  if (!meta) return '<span class="badge badge--outline">بدون امتیاز</span>';
  return `<span class="rating rating--${meta.key} ${size === 'lg' ? 'rating--lg' : ''}">
    <i class="rating__dot"></i>${withLabel ? esc(meta.label) : ''}
  </span>`;
}

export function ratingDot(rating, label = '') {
  const meta = ratingInfo(rating);
  if (!meta) return '';
  return `<span class="u-row u-gap-1 u-xs" style="color:${meta.color}">
    <i class="vendor-dot" style="background:${meta.color}"></i>${esc(label || meta.label)}
  </span>`;
}

export function ratingSelector(current = '') {
  return `<div class="rating-picker" role="radiogroup" aria-label="امتیاز تجربه">
    ${RATING_LIST.map(
      (meta) => `<button type="button" role="radio" aria-checked="${current === meta.key}"
        class="rating-choice ${current === meta.key ? 'is-active' : ''}" data-rating="${meta.key}">
        <span class="rating-choice__emoji">${meta.emoji}</span>
        <span class="rating-choice__label">${esc(meta.label)}</span>
        <span class="rating-choice__hint">${esc(meta.advice)}</span>
      </button>`,
    ).join('')}
  </div>`;
}

/* -------------------------------- آواتار -------------------------------- */

export function avatar({ name = '', emoji = '', size = '', hue = null, round = false, color = '' } = {}) {
  const h = hue ?? hashHue(name || emoji || 'x');
  const style = color ? `--hue:${h};color:${color}` : `--hue:${h}`;
  return `<span class="avatar ${size ? `avatar--${size}` : ''} ${round ? 'avatar--round' : ''}" style="${style}" aria-hidden="true">
    ${emoji ? `<span class="avatar__emoji">${esc(emoji)}</span>` : esc(initials(name))}
  </span>`;
}

export function entityAvatar(type, entity, size = '') {
  const emoji = entity?.emoji || (type === 'shop' ? '🏪' : type === 'product' ? '📦' : '🛒');
  return avatar({
    name: entity?.name || '',
    emoji,
    size,
    hue: entity?.color ? null : hashHue(entity?.name || type),
    color: entity?.color || '',
  });
}

export function userAvatar(profile, size = '') {
  return avatar({ name: profile?.display_name || 'کاربر', size, hue: profile?.avatar_hue ?? 158, round: true });
}

/* --------------------------------- آماره -------------------------------- */

export function statCard({ label, value, unit = '', foot = '', iconName = 'chart', tone = '', spark = '' }) {
  return `<div class="stat ${tone ? `stat--${tone}` : ''}">
    <div class="stat__top">
      <span class="stat__label">${esc(label)}</span>
      <span class="stat__icon">${icon(iconName, 14)}</span>
    </div>
    <div class="stat__value">${value}${unit ? `<span class="stat__unit">${esc(unit)}</span>` : ''}</div>
    ${foot ? `<div class="stat__foot">${foot}</div>` : ''}
    ${spark ? `<div class="stat__spark">${spark}</div>` : ''}
  </div>`;
}

export function kpiCard({ label, value, unit = '', foot = '', iconName = 'chart' }) {
  return `<div class="kpi">
    <div class="kpi__label">${icon(iconName, 13)}${esc(label)}</div>
    <div class="kpi__value">${value}${unit ? `<small> ${esc(unit)}</small>` : ''}</div>
    ${foot ? `<div class="kpi__foot">${foot}</div>` : ''}
  </div>`;
}

export function meterHTML(stats, { height = 6 } = {}) {
  const total = stats?.count || 0;
  if (!total) return `<div class="meter" style="height:${height}px"></div>`;
  return `<div class="meter" style="height:${height}px" title="${esc(
    `${faNum(stats.good)} خوب · ${faNum(stats.notGood)} نه‌خوب · ${faNum(stats.shit)} افتضاح`,
  )}">
    ${stats.good ? `<i style="width:${pct(stats.good, total)}%;background:var(--good)"></i>` : ''}
    ${stats.notGood ? `<i style="width:${pct(stats.notGood, total)}%;background:var(--meh)"></i>` : ''}
    ${stats.shit ? `<i style="width:${pct(stats.shit, total)}%;background:var(--bad)"></i>` : ''}
  </div>`;
}

export function scoreColor(stats) {
  if (!stats?.count) return 'var(--txt-3)';
  if (stats.health >= 70) return 'var(--good)';
  if (stats.health >= 40) return 'var(--meh)';
  return 'var(--bad)';
}

export function scoreBadge(stats) {
  if (!stats?.count) return '<span class="badge badge--outline">بدون تجربه</span>';
  if (stats.health >= 70) return '<span class="badge badge--good">قابل اعتماد</span>';
  if (stats.health >= 40) return '<span class="badge badge--meh">با احتیاط</span>';
  return '<span class="badge badge--bad">پرهیز کنید</span>';
}

/* --------------------------------- کارت -------------------------------- */

export function entityCard({ type, entity, stats, index = 0, tags = [] }) {
  const meta = [entity.category, entity.brand, entity.unit, entity.city].filter(Boolean).join(' · ');
  const avg = stats?.count ? faNum(stats.avgScore.toFixed(1)) : '—';
  const color = scoreColor(stats);
  return `<article class="ecard" data-entity-type="${type}" data-entity-id="${esc(entity.id)}" style="--i:${index}" tabindex="0" role="button" aria-label="${esc(entity.name)}">
    <div class="ecard__actions">
      <button type="button" class="icon-btn icon-btn--bordered" data-entity-menu aria-label="گزینه‌های بیشتر">${icon('more', 16)}</button>
    </div>
    <div class="ecard__head">
      ${entityAvatar(type, entity, 'lg')}
      <div class="ecard__text">
        <h3 class="ecard__name u-clamp-1">${esc(entity.name)}</h3>
        <p class="ecard__meta u-clamp-1">${meta ? esc(meta) : 'بدون دسته‌بندی'}</p>
      </div>
    </div>
    <div class="ecard__score">
      <div class="ecard__nums">
        <span class="ecard__avg" style="color:${color}">${avg}</span>
        <small>از ${faNum(3)}</small>
      </div>
      <span class="ecard__count">${fmtInt(stats?.count || 0)} تجربه</span>
    </div>
    ${meterHTML(stats)}
    <div class="ecard__foot">
      <span>${stats?.lastPurchasedAt ? `آخرین خرید ${formatJalali(stats.lastPurchasedAt, 'long')}` : 'بدون خرید ثبت‌شده'}</span>
      ${stats?.spend ? `<span class="u-num">${fmtInt(stats.spend)} ت</span>` : ''}
    </div>
    ${tags.length ? `<div class="ecard__tags">${tags.slice(0, 3).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>` : ''}
  </article>`;
}

/* --------------------------------- جدول -------------------------------- */

export function reviewRowHTML(review, { selected = false, tokens = [] } = {}) {
  const meta = ratingInfo(review.rating);
  const productMeta = [review.product?.category, ...(review.tags || []).slice(0, 2).map((tag) => `#${tag}`)].filter(Boolean);
  return `<tr data-review-id="${esc(review.id)}" class="${selected ? 'is-selected' : ''}" tabindex="0">
    <td class="cell-check">
      <input type="checkbox" class="checkbox" data-row-check ${selected ? 'checked' : ''} aria-label="انتخاب ${esc(review.productName)}" />
    </td>
    <td class="cell-main" data-main>
      <div class="product-cell">
        ${avatar({ name: review.productName, emoji: review.product?.emoji || '📦', size: 'sm' })}
        <div class="product-cell__text">
          <span class="product-cell__name u-truncate">${highlight(review.productName, tokens)}</span>
          <span class="product-cell__meta">
            ${productMeta.length ? highlight(productMeta.join(' · '), tokens) : '—'}
          </span>
        </div>
      </div>
    </td>
    <td data-label="فروشگاه">
      <div class="shop-cell">
        <div>
          <div class="shop-cell__name">${highlight(review.shopName, tokens)}</div>
          <div class="shop-cell__meta">${esc(review.shop?.city || review.shop?.category || '')}</div>
        </div>
      </div>
    </td>
    <td data-label="پلتفرم">
      <span class="vendor-cell">
        <i class="vendor-dot" style="--vc:${esc(review.vendor?.color || '#35e0a1')}"></i>
        <span class="u-truncate">${highlight(review.vendorName, tokens)}</span>
      </span>
    </td>
    <td data-label="امتیاز">${ratingPill(review.rating)}</td>
    <td data-label="قیمت" class="cell-num">${review.price === null || review.price === undefined ? '<span class="u-faint">—</span>' : `${fmtInt(review.total)} <span class="u-faint u-xs">ت</span>`}</td>
    <td data-label="تاریخ" class="cell-num">
      <div>${formatJalali(review.purchased_at, 'short')}</div>
      <div class="u-faint" style="font-size:9.5px">${purchaseAgo(review.purchased_at)}</div>
    </td>
    <td class="cell-actions">
      <div class="row-actions">
        <button type="button" class="icon-btn" data-row-edit aria-label="ویرایش" title="ویرایش">${icon('edit', 15)}</button>
        <button type="button" class="icon-btn" data-row-menu aria-label="گزینه‌ها" title="گزینه‌ها">${icon('more-horizontal', 15)}</button>
      </div>
    </td>
  </tr>`;
}

export function reviewListHTML(review, { selected = false, tokens = [] } = {}) {
  const meta = ratingInfo(review.rating);
  const productMeta = [review.product?.category, ...(review.tags || []).slice(0, 2).map((tag) => `#${tag}`)].filter(Boolean);
  return `<div class="list-item ${selected ? 'is-selected' : ''}" data-review-id="${esc(review.id)}" tabindex="0" role="button" aria-label="${esc(review.productName)}">
    <div class="list-item__avatar">
      ${avatar({ name: review.productName, emoji: review.product?.emoji || '📦', size: 'sm' })}
      <span class="status-dot"></span>
    </div>
    <div class="list-item__details">
      <div class="list-item__product-name u-truncate">${highlight(review.productName, tokens)}</div>
      <div class="list-item__shop-vendor">
        <div>${highlight(review.shopName, tokens)}</div>
        <div class="u-faint">${esc(review.shop?.city || review.shop?.category || '')}</div>
      </div>
      <div class="list-item__rating">
        ${ratingPill(review.rating)}
        <span class="u-faint">${purchaseAgo(review.purchased_at)}</span>
      </div>
    </div>
    <div class="list-item__actions">
      <span class="list-item__rating-summary">${ratingPill(review.rating)}</span>
      <a href="#" class="list-item__action" data-row-edit aria-label="ویرایش" title="ویرایش">${icon('edit', 12)}</a>
      <a href="#" class="list-item__action" data-row-menu aria-label="گزینه‌ها" title="گزینه‌ها">${icon('more-horizontal', 12)}</a>
    </div>
  </div>`;
}

export function tableHeadHTML({ sort = 'newest', tokens = [] } = {}) {
  const sortIcon = (key) => {
    if (sort === key) return icon('arrow-up', 12);
    if (key === 'newest' && sort === 'oldest') return icon('arrow-down', 12);
    return icon('arrow-up-down', 12);
  };
  const th = (key, label, extra = '') =>
    `<th class="is-sortable ${sort === key ? 'is-sorted' : ''}" data-sort="${key}" scope="col" ${extra}>
      <span class="th-inner">${esc(label)}${sortIcon(key)}</span>
    </th>`;
  return `<thead><tr>
    <th class="cell-check"><input type="checkbox" class="checkbox" data-check-all aria-label="انتخاب همه" /></th>
    <th scope="col"><span class="th-inner">محصول</span></th>
    <th scope="col"><span class="th-inner">فروشگاه</span></th>
    <th scope="col"><span class="th-inner">پلتفرم</span></th>
    ${th('best', 'امتیاز')}
    ${th('price-desc', 'هزینه')}
    ${th('newest', 'تاریخ')}
    <th scope="col" class="cell-actions"><span class="u-sr-only">عملیات</span></th>
  </tr></thead>`;
}

/* --------------------------------- صفحه‌بندی ---------------------------- */

export function pagerHTML({ page = 1, pageSize = 20, total = 0 } = {}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  const numbers = [];
  const push = (n) => numbers.push(n);
  if (pages <= 7) {
    for (let i = 1; i <= pages; i += 1) push(i);
  } else {
    push(1);
    if (current > 3) push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(pages - 1, current + 1); i += 1) push(i);
    if (current < pages - 2) push('…');
    push(pages);
  }

  return `<div class="pager">
    <span class="pager__info">نمایش ${faNum(from)} تا ${faNum(to)} از ${faNum(total)} مورد</span>
    <div class="pager__btns">
      <button type="button" class="pager__btn" data-page="prev" ${current === 1 ? 'disabled' : ''} aria-label="صفحه قبل">${icon('chevron-right', 14)}</button>
      ${numbers
        .map((n) =>
          n === '…'
            ? '<span class="pager__btn" aria-hidden="true">…</span>'
            : `<button type="button" class="pager__btn ${n === current ? 'is-active' : ''}" data-page="${n}">${faNum(n)}</button>`,
        )
        .join('')}
      <button type="button" class="pager__btn" data-page="next" ${current === pages ? 'disabled' : ''} aria-label="صفحه بعد">${icon('chevron-left', 14)}</button>
    </div>
  </div>`;
}

/* --------------------------------- حالات -------------------------------- */

export function emptyState({ iconName = 'search', title = 'چیزی پیدا نشد', text = '', actions = '', small = false }) {
  return `<div class="empty ${small ? 'empty--sm' : ''}">
    <div class="empty__ico">${icon(iconName, 26)}</div>
    <h3 class="empty__title">${esc(title)}</h3>
    ${text ? `<p class="empty__text">${esc(text)}</p>` : ''}
    ${actions ? `<div class="empty__actions">${actions}</div>` : ''}
  </div>`;
}

export function skeletonRows(count = 6) {
  return `<div class="stack stack--sm" style="padding:16px">
    ${Array.from({ length: count })
      .map(
        () => `<div class="u-row u-gap-3" style="padding:8px 0">
          <div class="sk sk--circle" style="width:32px;height:32px"></div>
          <div class="u-grow stack stack--sm" style="gap:6px">
            <div class="sk" style="width:42%"></div>
            <div class="sk" style="width:24%;height:9px"></div>
          </div>
          <div class="sk" style="width:64px;height:22px;border-radius:99px"></div>
        </div>`,
      )
      .join('')}
  </div>`;
}

export function callout({ tone = 'info', title = '', text = '', actions = '' }) {
  const iconName = tone === 'danger' || tone === 'warn' ? 'alert' : tone === 'success' ? 'check-circle' : 'info';
  return `<div class="callout callout--${tone}">
    ${icon(iconName, 17)}
    <div class="u-grow">
      ${title ? `<div class="callout__title">${esc(title)}</div>` : ''}
      <div class="callout__text">${text}</div>
      ${actions ? `<div class="callout__actions">${actions}</div>` : ''}
    </div>
  </div>`;
}

export function sectionHead(title, subtitle = '', right = '', iconName = '') {
  return `<div class="u-between u-gap-3 u-wrap">
    <div>
      <div class="section-title">${iconName ? icon(iconName, 16) : ''}${esc(title)}</div>
      ${subtitle ? `<div class="section-sub">${esc(subtitle)}</div>` : ''}
    </div>
    ${right || ''}
  </div>`;
}

/* -------------------------------- کامنت‌ها ------------------------------- */

export function commentHTML(comment, { profileName = 'شما', replies = [], depth = 0 } = {}) {
  const hue = hashHue(comment.id || comment.content || 'c');
  return `<div class="cmt ${depth > 0 ? 'cmt--reply' : ''}" data-comment-id="${esc(comment.id)}">
    ${avatar({ name: profileName, size: 'sm', hue })}
    <div class="cmt__main">
      <div class="cmt__head">
        <span class="cmt__name">${esc(profileName)}</span>
        <span class="cmt__time">${formatJalali(String(comment.created_at).slice(0, 10), 'long')}</span>
        ${comment.rating ? ratingPill(comment.rating) : ''}
      </div>
      <div class="cmt__body">${esc(comment.content)}</div>
      <div class="cmt__actions">
        ${depth === 0 ? `<button type="button" class="cmt__action" data-comment-reply>${icon('reply', 12)} پاسخ</button>` : ''}
        <button type="button" class="cmt__action" data-comment-edit>${icon('edit', 12)} ویرایش</button>
        <button type="button" class="cmt__action" data-comment-delete>${icon('trash', 12)} حذف</button>
      </div>
      ${replies.length ? `<div class="cmt__replies">${replies.map((reply) => commentHTML(reply, { profileName, depth: 1 })).join('')}</div>` : ''}
    </div>
  </div>`;
}

export function commentComposer({ placeholder = 'یادداشتی بنویس…', rating = false } = {}) {
  return `<form class="comment-form stack stack--sm" data-comment-form>
    <textarea class="textarea textarea--sm" name="content" rows="2" placeholder="${esc(placeholder)}" maxlength="2000"></textarea>
    <div class="u-between u-gap-2">
      ${rating
        ? `<div class="segmented" data-rating-seg>
            <button type="button" class="segmented__btn is-good" data-comment-rating="good">خوب</button>
            <button type="button" class="segmented__btn is-meh" data-comment-rating="not_good">نه‌خوب</button>
            <button type="button" class="segmented__btn is-bad" data-comment-rating="shit">افتضاح</button>
          </div>`
        : '<span class="u-xs u-faint">حداکثر ۲۰۰۰ حرف</span>'}
      <button type="submit" class="btn btn--soft btn--sm">${icon('send', 14)} ثبت نظر</button>
    </div>
  </form>`;
}

/* -------------------------------- ریز کارت ------------------------------- */

export function reviewCardHTML(review, { tokens = [] } = {}) {
  const meta = ratingInfo(review.rating);
  return `<div class="review-card" data-review-id="${esc(review.id)}">
    <div class="review-card__top">
      ${avatar({ name: review.productName, emoji: review.product?.emoji || '📦', size: 'sm' })}
      <div class="review-card__title">
        <div class="review-card__name u-truncate">${highlight(review.productName, tokens)}</div>
        <div class="review-card__meta">${esc(review.shopName)} · ${esc(review.vendorName)}</div>
      </div>
      ${ratingPill(review.rating)}
    </div>
    ${review.note ? `<p class="review-card__note u-clamp-2">${esc(review.note)}</p>` : ''}
    <div class="review-card__foot">
      <span>${formatJalali(review.purchased_at, 'long')}</span>
      <span class="u-row u-gap-1">${review.price ? `${fmtInt(review.total)} ت` : 'بدون قیمت'}</span>
    </div>
  </div>`;
}

export function commentPreview(index, type, id, profileName = 'شما') {
  const thread = index.commentsByTarget.get(`${type}:${id}`) || [];
  if (!thread.length) return '';
  return `<div class="panel stack stack--sm">
    <div class="u-row u-gap-2 u-xs u-muted">${icon('message', 14)} ${faNum(thread.length)} یادداشت</div>
    ${thread
      .slice(0, 2)
      .map(
        (comment) => `<div class="u-row u-gap-2 u-start">
          ${avatar({ name: profileName, size: 'sm', hue: hashHue(comment.id) })}
          <div class="u-grow">
            <div class="cmt__body">${esc(comment.content)}</div>
            <div class="cmt__time">${formatJalali(String(comment.created_at).slice(0, 10), 'long')}</div>
          </div>
        </div>`,
      )
      .join('')}
  </div>`;
}

export function detailStat(value, label, color = '') {
  return `<div class="detail-hero__stat">
    <b style="${color ? `color:${color}` : ''}">${value}</b>
    <span>${esc(label)}</span>
  </div>`;
}

export function tagsHTML(tags = [], { link = false } = {}) {
  return tags
    .map((tag) => `<${link ? 'button type="button" class="tag tag--acc" data-tag' : 'span class="tag"'}>#${esc(tag)}</${link ? 'button' : 'span'}>`)
    .join('');
}
