/* ============================================================
   THEORIES STUDIO — Reusable UI component builders
   ============================================================ */
import { el, escapeHtml, formatNumber, excerptFromHtml, truncate } from './utils.js';
import { APP, CATEGORY_MAP } from './config.js';
import { formatJalali, relativeJalali } from './shamsi.js';

/* ---------------- Image / placeholder ---------------- */
export const imageOrPlaceholder = (src, alt, { aspect, small = false } = {}) => {
  const wrap = document.createElement('div');
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => {
      wrap.replaceChildren(placeholder(alt));
    };
    wrap.appendChild(img);
  } else {
    wrap.appendChild(placeholder(alt));
  }
  if (aspect) wrap.style.aspectRatio = aspect;
  return wrap;
};

export const placeholder = (label = 'بدون تصویر') => {
  const d = document.createElement('div');
  d.className = 'img-placeholder';
  d.innerHTML = `<i class="ri-image-add-line"></i><span>${escapeHtml(label)}</span>`;
  return d;
};

/* ---------------- Category chip ---------------- */
export const categoryChip = (id) => {
  const cat = CATEGORY_MAP[id] || { label: id || 'دیگر', icon: 'ri-more-line' };
  const c = document.createElement('span');
  c.className = 'badge';
  c.innerHTML = `<i class="${cat.icon}"></i>${escapeHtml(cat.label)}`;
  return c;
};

/* ---------------- Theory card ---------------- */
export const theoryCard = (theory, { onOpen } = {}) => {
  const a = document.createElement('a');
  a.className = 'theory-card';
  a.href = `#/theories/${theory.id}`;
  a.dataset.link = '';
  a.setAttribute('aria-label', theory.title);

  const media = document.createElement('div');
  media.className = 'theory-card__media';
  if (theory.cover_image) {
    const img = document.createElement('img');
    img.src = theory.cover_image;
    img.alt = theory.title;
    img.loading = 'lazy';
    img.onerror = () => { media.replaceChildren(placeholder('بدون تصویر')); };
    media.appendChild(img);
  } else {
    media.appendChild(placeholder('بدون تصویر — افزودن؟'));
  }

  const badges = document.createElement('div');
  badges.className = 'theory-card__media-badges';
  badges.appendChild(categoryChip(theory.category));
  if (theory.status === 'draft') {
    const d = document.createElement('span');
    d.className = 'badge badge--warning badge--dot';
    d.textContent = 'پیش‌نویس';
    badges.appendChild(d);
  }
  if (theory.favorite) {
    const f = document.createElement('span');
    f.className = 'badge badge--love';
    f.innerHTML = '<i class="ri-heart-3-fill"></i>';
    badges.appendChild(f);
  }
  media.appendChild(badges);

  const body = document.createElement('div');
  body.className = 'theory-card__body';
  const title = document.createElement('div');
  title.className = 'theory-card__title';
  title.textContent = theory.title;
  const excerpt = document.createElement('div');
  excerpt.className = 'theory-card__excerpt';
  excerpt.textContent = theory.summary || excerptFromHtml(theory.content, 180) || 'هنوز توضیحی اضافه نشده است.';
  body.append(title, excerpt);

  const footer = document.createElement('div');
  footer.className = 'theory-card__footer';
  const meta = document.createElement('div');
  meta.className = 'theory-card__meta';
  meta.innerHTML = `
    <span><i class="ri-eye-line"></i>${formatNumber(theory.view_count || 0)}</span>
    <span><i class="ri-calendar-line"></i>${formatJalali(theory.created_at, { long: false })}</span>
  `;
  footer.appendChild(meta);
  body.appendChild(footer);
  a.append(media, body);

  if (onOpen) {
    a.addEventListener('click', (e) => {
      // allow default anchor navigation (router intercepts data-link)
    });
  }
  return a;
};

/* ---------------- Theory feature (big card) ---------------- */
export const theoryFeature = (theory) => {
  const a = document.createElement('a');
  a.href = `#/theories/${theory.id}`;
  a.dataset.link = '';
  a.className = 'theory-feature';
  const media = document.createElement('div');
  media.className = 'theory-feature__media';
  if (theory.cover_image) {
    const img = document.createElement('img');
    img.src = theory.cover_image;
    img.alt = theory.title;
    img.onerror = () => media.appendChild(placeholder('بدون تصویر'));
    media.appendChild(img);
  } else {
    media.appendChild(placeholder('برای این نظریه تصویری بارگذاری نشده'));
  }
  const body = document.createElement('div');
  body.className = 'theory-feature__body';
  body.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${categoryChip(theory.category).outerHTML}</div>
    <h3 style="font-size:var(--fs-4xl);line-height:1.25;">${escapeHtml(theory.title)}</h3>
    <p style="color:var(--ink-mute);font-size:var(--fs-md);line-height:1.85;">${escapeHtml(theory.summary || excerptFromHtml(theory.content, 240))}</p>
    <div style="display:flex;gap:16px;color:var(--ink-faint);font-size:var(--fs-xs);margin-top:auto;padding-top:12px;">
      <span><i class="ri-calendar-line"></i> ${formatJalali(theory.created_at)}</span>
      <span><i class="ri-eye-line"></i> ${formatNumber(theory.view_count || 0)}</span>
      <span><i class="ri-price-tag-3-line"></i> ${(theory.tags || []).length} برچسب</span>
    </div>
  `;
  a.append(media, body);
  return a;
};

/* ---------------- Object tile ---------------- */
export const objectTile = (obj, { onClick } = {}) => {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'object-tile';
  const thumb = document.createElement('div');
  thumb.className = 'object-tile__thumb';
  if (obj.image_url) {
    const img = document.createElement('img');
    img.src = obj.image_url;
    img.alt = obj.title;
    img.loading = 'lazy';
    img.onerror = () => thumb.replaceChildren(placeholder('بدون تصویر'));
    thumb.appendChild(img);
  } else {
    thumb.appendChild(placeholder('بدون تصویر'));
  }
  const typeMeta = APP.objectTypes.find(t => t.id === obj.object_type);
  if (typeMeta) {
    const b = document.createElement('span');
    b.className = 'object-tile__badge badge';
    b.innerHTML = `<i class="${typeMeta.icon}"></i>`;
    thumb.appendChild(b);
  }
  const body = document.createElement('div');
  body.className = 'object-tile__body';
  const t = document.createElement('div');
  t.className = 'object-tile__title';
  t.textContent = obj.title;
  const m = document.createElement('div');
  m.className = 'object-tile__meta';
  m.textContent = typeMeta?.label || 'شیء';
  body.append(t, m);
  tile.append(thumb, body);
  if (onClick) tile.addEventListener('click', () => onClick(obj));
  return tile;
};

/* ---------------- Gallery item ---------------- */
export const galleryItem = (img, { onClick } = {}) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'gallery-item';
  if (img.image_url) {
    const i = document.createElement('img');
    i.src = img.image_url;
    i.alt = img.caption || '';
    i.loading = 'lazy';
    b.appendChild(i);
  } else {
    b.appendChild(placeholder());
  }
  const ov = document.createElement('div');
  ov.className = 'gallery-item__overlay';
  ov.innerHTML = `
    <div class="gallery-item__title">${escapeHtml(img.caption || 'بدون عنوان')}</div>
    <div class="gallery-item__sub">${escapeHtml(img.theory?.title || '')}</div>
  `;
  b.appendChild(ov);
  if (onClick) b.addEventListener('click', () => onClick(img));
  return b;
};

/* ---------------- Stat card ---------------- */
export const statCard = ({ label, value, icon = 'ri-bar-chart-box-line', trend }) => {
  const c = document.createElement('div');
  c.className = 'stat-card';
  c.innerHTML = `
    <div class="stat-card__icon"><i class="${icon}"></i></div>
    <div class="stat-card__value">${escapeHtml(value)}</div>
    <div class="stat-card__label">${escapeHtml(label)}</div>
    ${trend ? `<div class="stat-card__trend ${trend.dir || 'up'}"><i class="ri-arrow-${trend.dir === 'down' ? 'down' : 'up'}-line"></i>${escapeHtml(trend.label)}</div>` : ''}
  `;
  return c;
};

/* ---------------- Empty & skeleton ---------------- */
export { emptyState, skeletonCards } from './ui.js';

/* ---------------- Shamsi chip ---------------- */
export const shamsiChip = (date) => {
  const s = document.createElement('span');
  s.className = 'badge';
  s.innerHTML = `<i class="ri-calendar-2-line"></i>${escapeHtml(formatJalali(date))}`;
  return s;
};

export const relativeChip = (date) => {
  const s = document.createElement('span');
  s.className = 'badge badge--outline';
  s.textContent = relativeJalali(date);
  return s;
};

/* ---------------- Section ---------------- */
export const section = ({ title, icon, link, actions, children, className = '' }) => {
  const wrap = document.createElement('section');
  wrap.className = `section ${className}`.trim();
  const head = document.createElement('div');
  head.className = 'section__head';
  const titleEl = document.createElement('h2');
  titleEl.className = 'section__title';
  titleEl.innerHTML = `${icon ? `<i class="${icon}"></i>` : ''}${escapeHtml(title || '')}`;
  head.appendChild(titleEl);
  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '8px';
  right.style.alignItems = 'center';
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.dataset.link = '';
    a.className = 'section__link';
    a.innerHTML = `${escapeHtml(link.label)} <i class="ri-arrow-left-line"></i>`;
    right.appendChild(a);
  }
  (actions || []).forEach(a => right.appendChild(a));
  head.appendChild(right);
  wrap.appendChild(head);
  const content = document.createElement('div');
  if (typeof children === 'string') content.innerHTML = children;
  else if (children instanceof Node) content.appendChild(children);
  else if (Array.isArray(children)) children.forEach(c => content.appendChild(c));
  wrap.appendChild(content);
  return wrap;
};

/* ---------------- Pill toggle ---------------- */
export const pillToggle = (options, value, onChange) => {
  const wrap = document.createElement('div');
  wrap.className = 'segmented';
  options.forEach(opt => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'segmented__item' + (opt.id === value ? ' is-active' : '');
    b.textContent = opt.label;
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.segmented__item').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      onChange?.(opt.id);
    });
    wrap.appendChild(b);
  });
  return wrap;
};

/* ---------------- Pagination ---------------- */
export const pagination = ({ page, perPage, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const wrap = document.createElement('div');
  wrap.className = 'pagination';
  const makeBtn = (label, target, opts = {}) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'page-btn' + (opts.active ? ' is-active' : '') + (opts.nav ? ' page-btn--nav' : '');
    b.innerHTML = label;
    if (opts.disabled) b.disabled = true;
    b.addEventListener('click', () => { if (!opts.disabled && target !== page) onPage(target); });
    return b;
  };
  wrap.appendChild(makeBtn('<i class="ri-arrow-right-s-line"></i>قبلی', page - 1, { disabled: page <= 1, nav: true }));
  const range = 2;
  const start = Math.max(1, page - range);
  const end = Math.min(pages, page + range);
  if (start > 1) {
    wrap.appendChild(makeBtn('۱', 1, { active: page === 1 }));
    if (start > 2) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.style.color = 'var(--ink-faint)';
      wrap.appendChild(dots);
    }
  }
  for (let p = start; p <= end; p++) {
    wrap.appendChild(makeBtn(String(p).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]), p, { active: p === page }));
  }
  if (end < pages) {
    if (end < pages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '…';
      dots.style.color = 'var(--ink-faint)';
      wrap.appendChild(dots);
    }
    wrap.appendChild(makeBtn(String(pages).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]), pages, { active: page === pages }));
  }
  wrap.appendChild(makeBtn('بعدی<i class="ri-arrow-left-s-line"></i>', page + 1, { disabled: page >= pages, nav: true }));
  return wrap;
};

/* ---------------- Badge / tag helpers ---------------- */
export const tagPill = (tag, { removable = false, onRemove } = {}) => {
  const t = document.createElement('span');
  t.className = 'tag' + (removable ? ' tag--removable' : '');
  t.innerHTML = `<i class="ri-price-tag-3-line"></i>${escapeHtml(tag)}`;
  if (removable) {
    const x = document.createElement('span');
    x.className = 'tag__remove';
    x.innerHTML = '<i class="ri-close-line"></i>';
    x.addEventListener('click', () => onRemove?.(tag));
    t.appendChild(x);
  }
  return t;
};
