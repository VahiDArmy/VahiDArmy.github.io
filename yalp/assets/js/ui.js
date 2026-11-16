/**
 * بازاربان — اجزای رابط کاربری
 * ---------------------------------------------------------------------------
 * سازنده‌های رشته‌ای برای کارت‌ها، نشان‌ها، فرم‌ها و لایه‌های شناور، به‌همراه
 * رفتارهای تعاملی (توست، مودال، کشو، کمبوباکس، ریویل).
 */

import { icon } from './icons.js';
import { CONFIG, LEVELS, CATEGORIES, KINDS, levelById, categoryById } from './config.js';
import {
  esc,
  attr,
  toFa,
  fmtInt,
  fmtPercent,
  relTime,
  initials,
  hueFrom,
  formatJalali,
  formatJalaliShort,
  clamp,
  lockScroll,
  copyText,
  truncate,
  matchScore,
  normalizeFa,
  $,
  $$,
} from './utils.js';
import * as store from './store.js';
import { ringChart, donutChart, barChart, sparkline, stackedLevelBar, miniDistribution } from './charts.js';

/* --------------------------------------------------------------------------
   پایه‌ها
   -------------------------------------------------------------------------- */
export const levelMeta = (id) => levelById(id) || null;

export const levelIcon = (id, size = 15) => {
  const meta = levelMeta(id);
  return icon(meta ? meta.icon : 'star-off', size);
};

export const verdictClass = (verdict) => `score-badge--${verdict || 'none'}`;

export function avatar({ name = '؟', hue = 152, size = '', ring = false, className = '' } = {}) {
  return `<span class="avatar ${size ? `avatar--${size}` : ''} ${ring ? 'avatar--ring' : ''} ${className}" style="--av-hue:${Number(hue) || 152}" aria-hidden="true">${esc(
    initials(name),
  )}</span>`;
}

export function brandBadge(name, hue = 152, size = '') {
  return `<span class="brand-badge ${size ? `brand-badge--${size}` : ''}" style="--bb-hue:${Number(
    hue,
  ) || 152}" aria-hidden="true">${esc(initials(name))}</span>`;
}

export function entityTypeBadge(type) {
  const meta = CONFIG.ENTITY_MAP[type];
  if (!meta) return '';
  return `<span class="badge badge--outline">${icon(meta.icon, 12)} ${esc(meta.label)}</span>`;
}

export function levelChip(level, { withText = true, size = '' } = {}) {
  if (!level) return '';
  const meta = levelMeta(level);
  if (!meta) return '';
  return `<span class="badge badge--${meta.className} ${size === 'lg' ? 'badge--lg' : ''}">${levelIcon(
    level,
    12,
  )}${withText ? ` ${esc(meta.label)}` : ''}</span>`;
}

export function verdictBadge(verdict, { score = null, size = '' } = {}) {
  const label = store.scoreLabel(verdict);
  const cls =
    verdict === 'mixed' ? 'score-badge--mixed' : verdict === 'none' ? 'score-badge--none' : `score-badge--${verdict}`;
  const iconName =
    verdict === 'good' ? 'trending-up' : verdict === 'bad' ? 'trending-down' : verdict === 'none' ? 'star-off' : 'sort';
  return `<span class="score-badge ${cls} ${size === 'lg' ? 'score-badge--lg' : ''}">
    ${icon(iconName, 12)}
    ${score !== null ? `<span class="score-badge__num">${toFa(score > 0 ? `+${score}` : score)}</span>` : ''}
    ${esc(label)}
  </span>`;
}

/** نشان امتیاز یک موجودیت */
export function scoreBadge(type, entity, { size = '', withCount = false } = {}) {
  if (!entity) return '';
  const score = store.scoreFor(type, entity.id);
  if (!score.total) {
    return `<span class="score-badge score-badge--none ${size === 'lg' ? 'score-badge--lg' : ''}">${icon(
      'star-off',
      12,
    )} بدون امتیاز</span>`;
  }
  const cls =
    score.verdict === 'mixed'
      ? 'score-badge--mixed'
      : score.verdict === 'none'
        ? 'score-badge--none'
        : `score-badge--${score.verdict}`;
  const iconName =
    score.verdict === 'good' ? 'trending-up' : score.verdict === 'bad' ? 'trending-down' : 'sort';
  return `<span class="score-badge ${cls} ${size === 'lg' ? 'score-badge--lg' : ''}" title="شاخص رضایت: ${fmtPercent(
    score.score,
    { signed: true },
  )} از ${toFa(score.total)} رأی">
    ${icon(iconName, 12)}
    <span class="score-badge__num">${toFa(score.score > 0 ? `+${score.score}` : score.score)}</span>
    <span>${esc(store.scoreLabel(score.verdict))}</span>
    ${withCount ? `<span class="t-faint">· ${toFa(score.total)} رأی</span>` : ''}
  </span>`;
}

export function ringFor(type, entity, size = 96) {
  const score = store.scoreFor(type, entity.id);
  const verdict = score.total ? score.verdict : 'none';
  return ringChart({
    value: score.total ? score.score : 0,
    size,
    color: store.scoreColor(verdict),
    label: score.total ? toFa(score.score > 0 ? `+${score.score}` : score.score) : '—',
    caption: score.total ? 'شاخص' : 'بدون رأی',
  });
}

export function distributionRows(score) {
  const rows = [
    { id: 'good', label: 'خوب', value: score.good, cls: 'good' },
    { id: 'meh', label: 'نه‌خوب', value: score.meh, cls: 'meh' },
    { id: 'bad', label: 'افتضاح', value: score.bad, cls: 'bad' },
  ];
  const total = score.total || 1;
  return `
    <div class="dist">
      ${rows
        .map(
          (row) => `
        <div class="dist__row">
          <span class="dist__label"><span class="dot dot--${row.cls}"></span>${esc(row.label)}</span>
          <span class="dist__track"><span class="dist__fill dist__fill--${row.cls}" style="--w:${(
            (row.value / total) *
            100
          ).toFixed(1)}%"></span></span>
          <span class="dist__num">${toFa(row.value)}</span>
        </div>`,
        )
        .join('')}
    </div>`;
}

export function scoreLegend() {
  return `<div class="chips-row">
    ${LEVELS.map(
      (level) =>
        `<span class="chip chip--${level.className}">${levelIcon(level.id, 13)} ${esc(level.label)}</span>`,
    ).join('')}
  </div>`;
}

/* --------------------------------------------------------------------------
   کارت موجودیت
   -------------------------------------------------------------------------- */
function entityMedia(type, entity) {
  if (type === 'vendor') {
    return `<div class="entity-card__media" style="--entity-color:hsl(${entity.brandHue} 70% 60%);--entity-tint:hsl(${entity.brandHue} 70% 55% / .12)">
      ${brandBadge(entity.nameFa || entity.name, entity.brandHue, 'lg')}
      <div class="cluster cluster--sm" style="justify-content:flex-end">
        ${entity.isVerified ? `<span class="badge badge--brand">${icon('verified', 11)} تأییدشده</span>` : ''}
        <span class="badge badge--outline">${esc(CONFIG.KIND_MAP[entity.kind] || 'فروشنده')}</span>
      </div>
    </div>`;
  }
  if (type === 'shop') {
    const vendor = store.getVendor(entity.vendorId);
    return `<div class="entity-card__media" style="--entity-color:var(--cyan);--entity-tint:var(--cyan-tint)">
      <span class="shop-card__icon" style="width:52px;height:52px;border-radius:16px">${icon('building', 24)}</span>
      <div class="cluster cluster--sm" style="justify-content:flex-end">
        <span class="badge badge--outline">${icon('map-pin', 11)} ${esc(entity.city || '—')}</span>
        ${entity.pickup ? `<span class="badge badge--brand">${icon('bag', 11)} تحویل حضوری</span>` : ''}
      </div>
      ${vendor ? `<span class="sr-only">${esc(vendor.nameFa)}</span>` : ''}
    </div>`;
  }
  const category = categoryById(entity.category);
  return `<div class="entity-card__media" style="--entity-color:${category.color};--entity-tint:color-mix(in srgb, ${category.color} 12%, transparent)">
    <span class="product-thumb" style="--p-hue:${hueFrom(entity.name, 360)}">${icon(category.icon, 30)}</span>
    <div class="cluster cluster--sm" style="justify-content:flex-end">
      <span class="badge badge--outline">${esc(category.label)}</span>
      ${entity.price ? `<span class="badge badge--brand">${esc(store.getVendor(entity.vendorId)?.nameFa || '')}</span>` : ''}
    </div>
  </div>`;
}

export function entityCard(type, entity, { actions = true, compact = false } = {}) {
  if (!entity) return '';
  const href = store.entityHref(type, entity);
  const score = store.scoreFor(type, entity.id);
  const comments = store.commentsOf(type, entity.id).length;
  const title = store.entityName(type, entity);
  const subtitle = store.entitySubtitle(type, entity);

  const metaLine =
    type === 'vendor'
      ? `<span>${icon('map-pin', 11)} ${esc(entity.city || 'ایران')}</span>
         <span class="divider-dot"></span>
         <span>${toFa(store.shopsOfVendor(entity.id).length)} شعبه</span>
         <span class="divider-dot"></span>
         <span>${toFa(store.productsOfVendor(entity.id).length)} محصول</span>`
      : type === 'shop'
        ? `<span>${icon('map-pin', 11)} ${esc(entity.district || entity.city || '—')}</span>
           <span class="divider-dot"></span>
           <span>${icon('clock', 11)} ${esc(entity.hours || 'ساعات نامشخص')}</span>`
        : `<span>${esc(entity.brand || 'بدون برند')}</span>
           <span class="divider-dot"></span>
           <span>${esc(entity.unit || '')}</span>
           ${entity.price ? `<span class="divider-dot"></span><span>${esc(fmtPriceInline(entity.price))}</span>` : ''}`;

  const actionsHtml = actions
    ? `<div class="entity-card__actions">
        ${compareToggleButton(type, entity.id, { small: true })}
        ${
          type === 'product'
            ? `<button class="icon-btn" type="button" data-action="save-entity" data-type="${type}" data-id="${entity.id}" aria-label="افزودن به خرید بعدی" title="خرید بعدی">${icon(
                'bookmark',
                15,
              )}</button>`
            : ''
        }
      </div>`
    : '';

  return `
  <article class="entity-card ${compact ? 'entity-card--compact' : ''}">
    ${entityMedia(type, entity)}
    ${actionsHtml}
    <div class="entity-card__body">
      <div class="entity-card__top">
        <h3 class="entity-card__title">
          <a class="entity-card__link" href="${attr(href)}" data-link>${esc(title)}</a>
        </h3>
        ${score.total ? scoreBadge(type, entity) : ''}
      </div>
      <p class="entity-card__sub">${metaLine}</p>
      ${
        type === 'vendor' && entity.tagline
          ? `<p class="entity-card__desc">${esc(entity.tagline)}</p>`
          : ''
      }
      <div class="entity-card__scores">
        ${stackedLevelBar({ good: score.good, meh: score.meh, bad: score.bad })}
        <span class="t-faint" style="font-size:10px;white-space:nowrap">${toFa(score.total)} رأی</span>
      </div>
    </div>
    <div class="entity-card__foot">
      <div class="entity-card__stats">
        <span class="entity-card__stat">${icon('message', 12)} ${toFa(comments)} نقد</span>
        <span class="entity-card__stat">${icon('star', 12)} ${fmtPercent(
          score.total ? Math.round((score.good / score.total) * 100) : 0,
        )} رضایت</span>
      </div>
      <span class="link link--arrow" style="font-size:11px">مشاهده</span>
    </div>
  </article>`;
}

function fmtPriceInline(price) {
  return `${Number(price).toLocaleString('fa-IR')} ت`;
}

export const vendorCard = (vendor, opts) => entityCard('vendor', vendor, opts);
export const shopCard = (shop, opts) => entityCard('shop', shop, opts);
export const productCard = (product, opts) => entityCard('product', product, opts);

/* --------------------------------------------------------------------------
   دکمه‌های موجودیت
   -------------------------------------------------------------------------- */
export function compareToggleButton(type, id, { small = false, label = false } = {}) {
  const active = store.inCompare(type, id);
  return `<button class="icon-btn ${active ? 'icon-btn--active' : ''} ${small ? '' : 'icon-btn--lg'}"
    type="button"
    data-action="toggle-compare"
    data-type="${attr(type)}"
    data-id="${attr(id)}"
    aria-pressed="${active}"
    aria-label="${active ? 'حذف از مقایسه' : 'افزودن به مقایسه'}"
    title="${active ? 'حذف از مقایسه' : 'افزودن به مقایسه'}"
    style="${active ? 'color:var(--brand-400);background:var(--brand-tint);border-color:var(--brand-tint-strong)' : ''}">
    ${icon(active ? 'check' : 'columns', small ? 14 : 17)}${label ? `<span style="margin-inline-start:6px">مقایسه</span>` : ''}
  </button>`;
}

export function saveEntityButton(type, id, { label = false } = {}) {
  const saved = store.inShoppingList(type, id);
  return `<button class="btn ${saved ? 'btn--good' : 'btn--outline'} btn--sm"
    type="button"
    data-action="save-entity"
    data-type="${attr(type)}"
    data-id="${attr(id)}"
    aria-pressed="${saved}">
    ${icon(saved ? 'check' : 'bookmark', 15)} ${label ? (saved ? 'در خرید بعدی' : 'خرید بعدی') : ''}
  </button>`;
}

/* --------------------------------------------------------------------------
   سربرگ صفحه، مسیر، بخش
   -------------------------------------------------------------------------- */
export function breadcrumbs(items = []) {
  const parts = items.map((item, index) => {
    if (item.href && index < items.length - 1) {
      return `<a href="${attr(item.href)}" data-link>${esc(item.label)}</a>`;
    }
    return `<span class="${index === items.length - 1 ? 'breadcrumbs__current' : ''}">${esc(item.label)}</span>`;
  });
  return `<nav class="breadcrumbs" aria-label="مسیر صفحه">${parts.join(
    `<span class="breadcrumbs__sep" aria-hidden="true">›</span>`,
  )}</nav>`;
}

export function pageHead({ eyebrow = '', title, sub = '', actions = '' } = {}) {
  return `<header class="page-head">
    <div class="page-head__main">
      ${eyebrow ? `<span class="page-head__eyebrow">${icon('sparkles', 12)} ${esc(eyebrow)}</span>` : ''}
      <h1 class="page-head__title">${title}</h1>
      ${sub ? `<p class="page-head__sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="page-head__actions">${actions}</div>` : ''}
  </header>`;
}

export function sectionHead({ eyebrow = '', title, sub = '', actions = '', center = false } = {}) {
  return `<div class="section__head ${center ? 'section__head--center' : ''}">
    <div>
      ${eyebrow ? `<span class="section__eyebrow">${esc(eyebrow)}</span>` : ''}
      <h2 class="section__title">${title}</h2>
      ${sub ? `<p class="section__sub">${sub}</p>` : ''}
    </div>
    ${actions ? `<div class="section__actions">${actions}</div>` : ''}
  </div>`;
}

/* --------------------------------------------------------------------------
   خالی و اسکلت
   -------------------------------------------------------------------------- */
export function emptyState({ iconName = 'search', title = 'چیزی پیدا نشد', text = '', actions = '' } = {}) {
  return `<div class="empty">
    <div class="empty__icon">${icon(iconName, 26)}</div>
    <p class="empty__title">${esc(title)}</p>
    ${text ? `<p class="empty__text">${text}</p>` : ''}
    ${actions ? `<div class="empty__actions">${actions}</div>` : ''}
  </div>`;
}

export function skeletonCards(count = 6) {
  return `<div class="grid grid--auto">${Array.from({ length: count })
    .map(
      () => `<div class="card-skeleton">
        <div class="card-skeleton__head">
          <div class="sk sk--circle"></div>
          <div style="flex:1"><div class="sk sk--text" style="width:55%"></div><div class="sk sk--text sk--text-sm" style="margin-top:6px"></div></div>
        </div>
        <div class="card-skeleton__lines">
          <div class="sk sk--text"></div>
          <div class="sk sk--text" style="width:80%"></div>
          <div class="sk sk--pill"></div>
        </div>
      </div>`,
    )
    .join('')}</div>`;
}

export function pager(page, pageCount, { info = '' } = {}) {
  if (pageCount <= 1) {
    return info ? `<div class="pagination"><span class="pagination__info">${info}</span></div>` : '';
  }
  const pages = [];
  const push = (n) => pages.push(n);
  push(1);
  if (page > 3) push('gap-start');
  for (let n = Math.max(2, page - 1); n <= Math.min(pageCount - 1, page + 1); n += 1) push(n);
  if (page < pageCount - 2) push('gap-end');
  if (pageCount > 1) push(pageCount);

  const buttons = pages
    .map((entry) => {
      if (typeof entry === 'string') return `<span class="pagination__gap">…</span>`;
      return `<button class="pagination__btn" type="button" data-action="goto-page" data-page="${entry}" ${
        entry === page ? 'aria-current="page"' : ''
      }>${toFa(entry)}</button>`;
    })
    .join('');

  return `<nav class="pagination" aria-label="صفحه‌بندی">
    <button class="pagination__btn" type="button" data-action="goto-page" data-page="${page - 1}" ${
      page <= 1 ? 'disabled' : ''
    } aria-label="صفحهٔ قبل">${icon('chevron-right', 15)}</button>
    ${buttons}
    <button class="pagination__btn" type="button" data-action="goto-page" data-page="${page + 1}" ${
      page >= pageCount ? 'disabled' : ''
    } aria-label="صفحهٔ بعد">${icon('chevron-left', 15)}</button>
    ${info ? `<span class="pagination__info">${info}</span>` : ''}
  </nav>`;
}

/* --------------------------------------------------------------------------
   توست
   -------------------------------------------------------------------------- */
const TOAST_ICONS = {
  info: 'info',
  good: 'check-circle',
  meh: 'alert-circle',
  bad: 'x-circle',
  brand: 'sparkles',
};

export function toast(message, { title = '', type = 'info', duration = 4200, action = null } = {}) {
  const root = $('#toast-root');
  if (!root) return () => {};
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.innerHTML = `
    <span class="toast__icon">${icon(TOAST_ICONS[type] || 'info', 15)}</span>
    <div class="toast__body">
      ${title ? `<div class="toast__title">${esc(title)}</div>` : ''}
      <div>${esc(message)}</div>
      ${
        action
          ? `<button class="toast__action" type="button" data-toast-action>${esc(action.label)}</button>`
          : ''
      }
    </div>
    <button class="toast__close" type="button" aria-label="بستن">${icon('close', 14)}</button>`;

  while (root.children.length >= 4) root.firstElementChild?.remove();
  root.append(node);

  let timer = null;
  const remove = () => {
    if (!node.isConnected) return;
    window.clearTimeout(timer);
    node.classList.add('toast--out');
    window.setTimeout(() => node.remove(), 180);
  };
  timer = window.setTimeout(remove, duration);
  node.querySelector('.toast__close')?.addEventListener('click', remove);
  if (action) {
    node.querySelector('[data-toast-action]')?.addEventListener('click', () => {
      try {
        action.onClick?.();
      } finally {
        remove();
      }
    });
  }
  node.addEventListener('mouseenter', () => window.clearTimeout(timer));
  node.addEventListener('mouseleave', () => {
    timer = window.setTimeout(remove, 1800);
  });
  return remove;
}

/* --------------------------------------------------------------------------
   trap focus
   -------------------------------------------------------------------------- */
function trapFocus(container) {
  const handler = (event) => {
    if (event.key !== 'Tab') return;
    const focusables = $$(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      container,
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}

let lastFocused = null;

/* --------------------------------------------------------------------------
   مودال
   -------------------------------------------------------------------------- */
export function openModal({
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  size = '',
  dismissible = true,
  className = '',
  onMount = null,
  onClose = null,
  showClose = true,
} = {}) {
  const root = $('#modal-root');
  if (!root) return { close: () => {} };
  closeAllOverlays({ except: 'modal' });
  lastFocused = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title || 'پنجره');
  modal.innerHTML = `
    <div class="modal__panel ${size === 'wide' ? 'modal__panel--wide' : size === 'narrow' ? 'modal__panel--narrow' : ''} ${className}">
      <div class="modal__head">
        <div>
          <h2 class="modal__title">${esc(title)}</h2>
          ${subtitle ? `<p class="modal__sub">${subtitle}</p>` : ''}
        </div>
      </div>
      ${showClose ? `<button class="icon-btn modal__close" type="button" data-close-modal aria-label="بستن">${icon('close', 18)}</button>` : ''}
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ''}
    </div>`;

  root.append(backdrop, modal);
  root.setAttribute('aria-hidden', 'false');
  lockScroll(true);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    lockScroll(false);
    backdrop.remove();
    modal.remove();
    if (!root.children.length) root.setAttribute('aria-hidden', 'true');
    onClose?.();
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  const onKey = (event) => {
    if (event.key === 'Escape' && dismissible) {
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey);

  if (dismissible) backdrop.addEventListener('click', close);
  modal.querySelector('[data-close-modal]')?.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  const panel = modal.querySelector('.modal__panel');
  const untrap = trapFocus(panel);
  const originalClose = close;
  const wrappedClose = () => {
    untrap();
    originalClose();
  };
  if (onMount) onMount(panel, wrappedClose);

  window.requestAnimationFrame(() => {
    const focusable = panel.querySelector('input, textarea, select, button:not([data-close-modal])');
    if (focusable) focusable.focus({ preventScroll: true });
  });

  return { close: wrappedClose, el: panel };
}

export function confirmDialog({
  title = 'مطمئنی؟',
  text = '',
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  tone = 'primary',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      handle.close();
    };
    const handle = openModal({
      title,
      size: 'narrow',
      body: `<p class="t-soft" style="font-size:var(--fs-sm);line-height:1.9">${text}</p>`,
      footer: `
        <button class="btn btn--ghost" type="button" data-cancel>${esc(cancelLabel)}</button>
        <button class="btn btn--${tone}" type="button" data-confirm>${esc(confirmLabel)}</button>`,
      onMount: (panel) => {
        panel.querySelector('[data-confirm]')?.addEventListener('click', () => finish(true));
        panel.querySelector('[data-cancel]')?.addEventListener('click', () => finish(false));
      },
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
    });
  });
}

/* --------------------------------------------------------------------------
   کشو
   -------------------------------------------------------------------------- */
export function openDrawer({ title = '', body = '', footer = '', side = 'start', onMount = null } = {}) {
  const root = $('#drawer-root');
  if (!root) return { close: () => {} };
  closeAllOverlays({ except: 'drawer' });
  lastFocused = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';
  const drawer = document.createElement('div');
  drawer.className = `drawer ${side === 'end' ? 'drawer--end' : ''}`;
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.innerHTML = `
    <div class="drawer__panel">
      <div class="drawer__head">
        <strong style="font-size:var(--fs-md)">${esc(title)}</strong>
        <button class="icon-btn" type="button" data-close-drawer aria-label="بستن">${icon('close', 18)}</button>
      </div>
      <div class="drawer__body">${body}</div>
      ${footer ? `<div class="drawer__foot">${footer}</div>` : ''}
    </div>`;

  root.append(backdrop, drawer);
  root.setAttribute('aria-hidden', 'false');
  lockScroll(true);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    lockScroll(false);
    backdrop.remove();
    drawer.remove();
    if (!root.children.length) root.setAttribute('aria-hidden', 'true');
    if (lastFocused?.focus) lastFocused.focus();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', close);
  drawer.querySelector('[data-close-drawer]')?.addEventListener('click', close);

  const panel = drawer.querySelector('.drawer__panel');
  trapFocus(panel);
  onMount?.(panel, close);
  return { close, el: panel };
}

export function closeAllOverlays({ except = null } = {}) {
  if (except !== 'modal') {
    const modalRoot = $('#modal-root');
    if (modalRoot) {
      modalRoot.innerHTML = '';
      modalRoot.setAttribute('aria-hidden', 'true');
    }
  }
  if (except !== 'drawer') {
    const drawerRoot = $('#drawer-root');
    if (drawerRoot) {
      drawerRoot.innerHTML = '';
      drawerRoot.setAttribute('aria-hidden', 'true');
    }
  }
  if (except !== 'palette') {
    const palette = $('#palette-root');
    if (palette) {
      palette.innerHTML = '';
      palette.setAttribute('aria-hidden', 'true');
    }
  }
  if (!document.querySelector('.modal, .drawer, .palette')) {
    lockScroll(false);
    document.body.dataset.scrollLocked = 'false';
  }
}

/* --------------------------------------------------------------------------
   منوی کوچک
   -------------------------------------------------------------------------- */
export function openMenu(anchor, items = []) {
  const existing = document.querySelector('.menu--floating');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'menu menu--floating';
  menu.innerHTML = items
    .map((item, index) => {
      if (item.type === 'sep') return `<div class="menu__sep"></div>`;
      return `<button class="menu__item ${item.danger ? 'menu__item--danger' : ''}" type="button" data-menu-index="${index}">
        ${item.icon ? icon(item.icon, 15) : ''}<span>${esc(item.label)}</span>
      </button>`;
    })
    .join('');
  document.body.append(menu);

  const rect = anchor.getBoundingClientRect();
  const width = 210;
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 8,
  );
  menu.style.width = `${width}px`;
  menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${left}px`;

  const close = () => {
    menu.remove();
    document.removeEventListener('click', outside, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', close, true);
  };
  const outside = (event) => {
    if (!menu.contains(event.target) && event.target !== anchor) close();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };
  document.addEventListener('click', outside, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('scroll', close, true);

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-menu-index]');
    if (!button) return;
    const item = items[Number(button.dataset.menuIndex)];
    close();
    item?.onClick?.();
  });

  return close;
}

/* --------------------------------------------------------------------------
   کمبوباکس
   -------------------------------------------------------------------------- */
/**
 * جعبهٔ جست‌وجوی موجودیت‌ها؛ انتخاب از فهرست یا ساخت مورد جدید.
 * @param {HTMLElement} container
 * @param {{name:string,items:Array,placeholder:string,allowCreate:boolean,onSelect:Function,onCreate:Function,onInput:Function,value:string}} config
 */
export function createCombobox(container, config) {
  if (!container) return { get value() {}, setItems() {}, destroy() {} };
  const {
    name = 'combo',
    items = [],
    placeholder = 'جست‌وجو…',
    allowCreate = false,
    createLabel = 'ساخت مورد جدید',
    onSelect = null,
    onCreate = null,
    onInput = null,
    emptyText = 'موردی پیدا نشد',
    value = '',
  } = config;

  let currentItems = [...items];
  let selected = value ? currentItems.find((item) => item.id === value) || null : null;
  let activeIndex = -1;
  let filtered = currentItems.slice(0, 40);

  container.classList.add('combo');
  container.innerHTML = `
    <div class="combo__control">
      <input class="input" type="text" name="${attr(name)}_search" autocomplete="off"
        placeholder="${attr(placeholder)}"
        role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="${attr(name)}-list" />
      <input type="hidden" name="${attr(name)}" value="${attr(selected?.id || '')}" />
      <span class="input-group__icon" style="inset-inline-start:auto;inset-inline-end:12px;pointer-events:none">
        ${icon('chevron-down', 15)}
      </span>
    </div>
    <div class="combo__list" id="${attr(name)}-list" role="listbox" hidden></div>`;

  const input = container.querySelector('input[type="text"]');
  const hidden = container.querySelector('input[type="hidden"]');
  const list = container.querySelector('.combo__list');

  if (selected) input.value = selected.label;

  const renderList = () => {
    const query = input.value.trim();
    const q = normalizeFa(query);
    filtered = (
      q
        ? currentItems
            .map((item) => ({ item, score: matchScore(`${item.label} ${item.sub || ''}`, q) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((x) => x.item)
        : currentItems
    ).slice(0, 40);

    const rows = filtered
      .map(
        (item, index) => `
        <button type="button" class="combo__opt" role="option" data-index="${index}"
          aria-selected="${selected?.id === item.id}" data-active="${index === activeIndex}">
          ${item.hue !== undefined ? brandBadge(item.label, item.hue, 'sm') : `<span class="palette__icon">${icon(item.icon || 'package', 14)}</span>`}
          <span class="combo__opt-main">
            <span class="combo__opt-title">${esc(item.label)}</span>
            ${item.sub ? `<span class="combo__opt-sub">${esc(item.sub)}</span>` : ''}
          </span>
          ${selected?.id === item.id ? icon('check', 14) : ''}
        </button>`,
      )
      .join('');

    list.innerHTML = `
      ${rows || `<div class="combo__empty">${esc(q ? emptyText : 'هنوز موردی ثبت نشده')}</div>`}
      ${
        allowCreate
          ? `<div class="combo__create">
              <button class="btn btn--ghost btn--sm btn--block" type="button" data-create>
                ${icon('plus', 14)} ${esc(createLabel)}
              </button>
            </div>`
          : ''
      }`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const closeList = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    activeIndex = -1;
  };

  const choose = (item) => {
    selected = item;
    hidden.value = item.id;
    input.value = item.label;
    closeList();
    onSelect?.(item);
  };

  input.addEventListener('focus', renderList);
  input.addEventListener('input', () => {
    selected = null;
    hidden.value = '';
    activeIndex = 0;
    renderList();
    onInput?.(input.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (list.hidden) renderList();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      list.querySelectorAll('.combo__opt').forEach((node, index) => {
        node.dataset.active = String(index === activeIndex);
      });
      list.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      list.querySelectorAll('.combo__opt').forEach((node, index) => {
        node.dataset.active = String(index === activeIndex);
      });
    } else if (event.key === 'Enter') {
      if (!list.hidden && filtered[activeIndex]) {
        event.preventDefault();
        choose(filtered[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      closeList();
    }
  });

  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const option = event.target.closest('.combo__opt');
    if (option) {
      choose(filtered[Number(option.dataset.index)]);
      return;
    }
    if (event.target.closest('[data-create]')) {
      const query = input.value.trim();
      closeList();
      onCreate?.(query);
    }
  });

  const outside = (event) => {
    if (!container.contains(event.target)) closeList();
  };
  document.addEventListener('click', outside);
  input.addEventListener('blur', () => {
    // اگر کاربر چیزی انتخاب نکرده، متن تایپ‌شده پاک نشود ولی مقدار مخفی خالی بماند
    window.setTimeout(() => {
      if (!container.contains(document.activeElement) && !selected) {
        closeList();
      }
    }, 120);
  });

  return {
    get value() {
      return hidden.value;
    },
    get text() {
      return input.value;
    },
    setValue(id) {
      const item = currentItems.find((entry) => entry.id === id);
      if (item) choose(item);
    },
    setItems(next) {
      currentItems = [...next];
      filtered = currentItems.slice(0, 40);
    },
    destroy() {
      document.removeEventListener('click', outside);
    },
  };
}

/* --------------------------------------------------------------------------
   ریویل و شمارنده‌ها
   -------------------------------------------------------------------------- */
let revealObserver = null;

export function setupReveal(root = document) {
  const nodes = $$('.reveal:not(.is-visible)', root);
  if (!nodes.length) return;
  if (typeof IntersectionObserver === 'undefined') {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
  }
  nodes.forEach((node) => revealObserver.observe(node));
}

export function animateCounters(root = document) {
  const counters = $$('[data-count-to]', root);
  if (!counters.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counters.forEach((node) => {
      node.textContent = toFa(fmtInt(Number(node.dataset.countTo) || 0));
    });
    return;
  }
  counters.forEach((node) => {
    const target = Number(node.dataset.countTo) || 0;
    const duration = Number(node.dataset.countDuration) || 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      node.textContent = toFa(fmtInt(Math.round(target * eased)));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* --------------------------------------------------------------------------
   اجزای اطلاعاتی
   -------------------------------------------------------------------------- */
export function statTile({ iconName = 'activity', label, value, delta = null, spark = null, suffix = '' }) {
  return `<div class="stat">
    <span class="stat__label">${icon(iconName, 12)} ${esc(label)}</span>
    <span class="stat__value">${value}${suffix ? `<small>${esc(suffix)}</small>` : ''}</span>
    ${delta !== null ? `<span class="tile__delta ${delta < 0 ? 'tile__delta--down' : ''}">${delta > 0 ? '▲' : '▼'} ${fmtPercent(
      Math.abs(delta),
    )}</span>` : ''}
    ${spark ? `<span class="stat__spark">${spark}</span>` : ''}
  </div>`;
}

export function kvRow(key, value, { iconName = null } = {}) {
  return `<div class="kv">
    <span class="kv__k">${iconName ? icon(iconName, 13) : ''} ${esc(key)}</span>
    <span class="kv__v">${value}</span>
  </div>`;
}

export function timeAgo(date) {
  return `<time datetime="${attr(date)}" title="${attr(formatJalali(date, { withYear: true }))}">${esc(
    relTime(date),
  )}</time>`;
}

export function levelPicker(selected = null, { name = 'level' } = {}) {
  return `<div class="level-picker" role="radiogroup" aria-label="سطح تجربه">
    ${LEVELS.map(
      (level) => `
      <button class="level-btn level-btn--${level.className}" type="button"
        role="radio" aria-checked="${selected === level.id}" data-level="${level.id}" data-selected="${selected === level.id}">
        <span class="level-btn__icon">${icon(level.icon, 17)}</span>
        <span>${esc(level.label)}</span>
        <span class="level-btn__hint">${esc(level.hint.split('؛')[0])}</span>
      </button>`,
    ).join('')}
  </div>`;
}

export function commentCard(comment, { entity = null, entityType = null, showEntity = false, actions = true } = {}) {
  const name = store.displayNameOf(comment);
  const hue = store.avatarHueOf(comment);
  const votes = store.voteCount(comment.id);
  const voted = store.hasVoted(comment.id);
  const isMine = store.currentUser()?.id && comment.userId === store.currentUser().id;
  const href = entity && entityType ? store.entityHref(entityType, entity) : '';

  return `<article class="comment" id="comment-${attr(comment.id)}">
    ${avatar({ name, hue, size: 'md' })}
    <div class="comment__main">
      <div class="comment__head">
        <span class="comment__author">${esc(name)}</span>
        ${comment.level ? levelChip(comment.level) : ''}
        ${isMine ? `<span class="badge badge--brand">نقد تو</span>` : ''}
        <span class="comment__meta">
          ${timeAgo(comment.createdAt)}
          ${showEntity && entity ? `<span class="divider-dot"></span><a href="${attr(href)}" data-link class="link--muted" style="font-size:var(--fs-2xs)">${esc(
            store.entityName(entityType, entity),
          )}</a>` : ''}
        </span>
      </div>
      <p class="comment__body">${esc(truncate(comment.body, 900))}</p>
      ${
        comment.tags?.length
          ? `<div class="comment__tags">${comment.tags
              .map((tag) => `<span class="comment__tag">#${esc(tag)}</span>`)
              .join('')}</div>`
          : ''
      }
      ${
        actions
          ? `<div class="comment__actions">
              <button class="comment__action" type="button" data-action="vote-comment" data-id="${attr(comment.id)}" data-voted="${voted}" aria-pressed="${voted}" aria-label="مفید بود">
                ${icon('thumbs-up', 13)} ${votes ? toFa(votes) : 'مفید بود'}
              </button>
              <button class="comment__action" type="button" data-action="reply-comment" data-id="${attr(comment.id)}" data-name="${attr(name)}">
                ${icon('reply', 13)} پاسخ
              </button>
              <button class="comment__action" type="button" data-action="report-comment" data-id="${attr(comment.id)}">
                ${icon('flag', 13)} گزارش
              </button>
              ${
                isMine
                  ? `<button class="comment__action" type="button" data-action="delete-comment" data-id="${attr(comment.id)}" style="color:var(--bad)">
                      ${icon('trash', 13)} حذف
                    </button>`
                  : ''
              }
            </div>`
          : ''
      }
    </div>
  </article>`;
}

export function commentSummary(score) {
  if (!score.total) {
    return `<div class="callout">
      <span class="callout__icon">${icon('message-plus', 14)}</span>
      <div>هنوز کسی این‌جا تجربه‌اش را ثبت نکرده. اولین نفر باش؛ یک کلیک و یک جمله کافی است.</div>
    </div>`;
  }
  const best = score.good >= score.bad ? 'good' : 'bad';
  return `<div class="callout callout--${best === 'good' ? 'good' : 'bad'}">
    <span class="callout__icon">${icon(best === 'good' ? 'smile' : 'frown', 14)}</span>
    <div>
      <div class="callout__title">${
        score.verdict === 'good'
          ? 'بیشتر خریداران راضی بودند'
          : score.verdict === 'bad'
            ? 'اکثریت تجربهٔ بد داشتند'
            : score.verdict === 'mixed'
              ? 'نظرها دو قطبی است'
              : 'نظرها هنوز روشن نیست'
      }</div>
      از ${toFa(score.total)} رأی، ${toFa(score.good)} نفر «خوب» و ${toFa(score.bad)} نفر «افتضاح» زده‌اند.
    </div>
  </div>`;
}

/* --------------------------------------------------------------------------
   نوار فیلترهای فعال
   -------------------------------------------------------------------------- */
export function activeFiltersRow(filters = {}, labels = {}) {
  const chips = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '' || value === false) continue;
    if (Array.isArray(value) && !value.length) continue;
    const label = labels[key] || key;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      chips.push(
        `<button class="chip chip--active" type="button" data-action="clear-filter" data-key="${attr(
          key,
        )}" data-value="${attr(item)}">${esc(label)}: ${esc(item)} <span class="chip__x">×</span></button>`,
      );
    }
  }
  if (!chips.length) return '';
  return `<div class="chips-row" style="margin-bottom:var(--sp-4)">${chips.join('')}
    <button class="chip" type="button" data-action="clear-all-filters">پاک‌کردن همه ${icon('close', 12)}</button>
  </div>`;
}

/* --------------------------------------------------------------------------
   درون‌ریزی سریع امتیاز
   -------------------------------------------------------------------------- */
export function quickRateStrip(type, entity, { compact = false } = {}) {
  const mine = store.myRating(type, entity.id);
  return `<div class="cluster ${compact ? 'cluster--sm' : ''}" data-quick-rate="${attr(type)}:${attr(entity.id)}">
    <span class="t-faint" style="font-size:var(--fs-2xs)">${mine ? 'امتیاز تو:' : 'تجربه‌ات؟'}</span>
    ${LEVELS.map(
      (level) => `<button class="btn btn--${level.className} btn--xs" type="button"
        data-action="quick-rate" data-type="${attr(type)}" data-id="${attr(entity.id)}" data-level="${level.id}"
        aria-pressed="${mine?.value === level.id}">
        ${icon(level.icon, 13)} ${esc(level.label)}
      </button>`,
    ).join('')}
  </div>`;
}

/* --------------------------------------------------------------------------
   تیکر
   -------------------------------------------------------------------------- */
export function fillTicker(items = []) {
  const track = document.getElementById('ticker-track');
  if (!track) return;
  if (!items.length) {
    track.innerHTML = `<span class="ticker__item">به بازاربان خوش آمدی؛ قبل از خرید، بازار را ببین.</span>`;
    return;
  }
  const html = items
    .map(
      (item) => `<span class="ticker__item">${item.href ? '<span class="dot dot--brand"></span>' : ''}
        ${item.href ? `<a href="${attr(item.href)}" data-link><b>${esc(item.title)}</b></a>` : `<b>${esc(item.title)}</b>`}
        ${item.text ? esc(item.text) : ''}</span>`,
    )
    .join('');
  // برای حرکت پیوسته، محتوا تکرار می‌شود
  track.innerHTML = html + html;
}
