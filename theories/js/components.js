import { icon } from "./icons.js";
import { THEORY_STATUSES, OBJECT_KINDS } from "./config.js";
import {
  escapeHtml,
  safeImageUrl,
  getInitials,
  colorFromString,
  relativeFa,
  formatNumber,
  readingTime,
  compactNumber,
  normalizeTags,
} from "./utils.js";
import { formatShamsi, formatShamsiDateTime } from "./date.js";

export function avatar(profile = {}, size = "") {
  const name = profile.full_name || profile.username || "کاربر";
  const src = safeImageUrl(profile.avatar_url);
  const sizeClass = size ? `avatar--${size}` : "";
  if (src) {
    return `<span class="avatar ${sizeClass}"><img src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy"></span>`;
  }
  return `<span class="avatar ${sizeClass}" style="background:${colorFromString(name)}">${escapeHtml(getInitials(name))}</span>`;
}

export function badge(status) {
  const meta = THEORY_STATUSES[status] || THEORY_STATUSES.draft;
  return `<span class="badge ${meta.className}">${meta.label}</span>`;
}

export function theoryCard(theory, options = {}) {
  const {
    variant = "",
    showMenu = true,
    showAuthor = true,
    showExcerpt = true,
  } = options;

  const slug = theory.slug || theory.id;
  const url = `#/theory/${encodeURIComponent(slug)}`;
  const cover = safeImageUrl(theory.cover_image_url);
  const author = theory.author || {};
  const authorName = author.full_name || author.username || "نویسنده";
  const date = relativeFa(theory.published_at || theory.created_at);
  const minutes = readingTime(theory.content);
  const tags = normalizeTags(theory.tags || []).slice(0, 3);
  const status = theory.status || "published";

  const menu = showMenu
    ? `
      <div class="dropdown theory-card__menu">
        <button class="icon-btn icon-btn--sm" type="button" data-dropdown-toggle aria-expanded="false" aria-label="گزینه‌های نظریه">${icon("more-horizontal", 16)}</button>
        <div class="dropdown__menu dropdown__menu--end">
          <a class="dropdown__item" href="${url}">${icon("book-open", 15)} باز کردن نظریه</a>
          <button class="dropdown__item" type="button" data-copy="${escapeHtml(location.origin + location.pathname + url)}">${icon("link", 15)} کپی پیوند</button>
          <a class="dropdown__item" href="#/explore?tag=${encodeURIComponent(tags[0] || "")}">${icon("compass", 15)} کاوش موضوعی</a>
        </div>
      </div>
    `
    : "";

  return `
    <article class="theory-card ${variant === "compact" ? "theory-card--compact" : ""}">
      <a class="theory-card__cover" href="${url}" aria-label="${escapeHtml(theory.title)}">
        ${cover
          ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(theory.title)}" loading="lazy">`
          : `<span class="theory-card__cover-placeholder">${icon("image", 30)}</span>`}
        <span class="theory-card__top-badges">
          ${status !== "published" ? badge(status) : ""}
          <span class="chip chip--accent">${icon("clock", 12)} ${formatNumber(minutes)} دقیقه</span>
        </span>
      </a>
      ${menu}
      <div class="theory-card__body">
        <div class="theory-card__kicker">
          <span>${escapeHtml(formatShamsi(theory.published_at || theory.created_at, "month"))}</span>
          <span class="dot"></span>
          <span>${formatNumber(theory.views || 0)} بازدید</span>
        </div>
        <h3 class="theory-card__title"><a href="${url}">${escapeHtml(theory.title)}</a></h3>
        ${showExcerpt && theory.excerpt ? `<p class="theory-card__excerpt">${escapeHtml(theory.excerpt)}</p>` : ""}
        ${tags.length ? `<div class="theory-card__tags">${tags.map((tag) => `<a class="chip" href="#/explore?tag=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`).join("")}</div>` : ""}
        <div class="theory-card__footer">
          ${showAuthor
            ? `<a class="theory-card__author" href="#/profile/${encodeURIComponent(author.username || "")}">
                ${avatar(author, "xs")}
                <span class="theory-card__author-name">${escapeHtml(authorName)}</span>
              </a>`
            : `<span class="inline-empty">${icon("feather", 12)} نظریه</span>`}
          <div class="theory-card__meta">
            <span>${icon("calendar", 11)} ${escapeHtml(date)}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

export function objectKindLabel(kind) {
  return OBJECT_KINDS.find((item) => item.value === kind)?.label || "مفهوم";
}

export function objectCard(object, options = {}) {
  const { editable = false } = options;
  const image = safeImageUrl(object.image_url);
  const actions = editable
    ? `
      <div class="object-card__actions">
        <button class="object-card__action" type="button" data-object-edit="${escapeHtml(object.id)}" aria-label="ویرایش">${icon("edit", 13)}</button>
        <button class="object-card__action" type="button" data-object-delete="${escapeHtml(object.id)}" aria-label="حذف">${icon("trash", 13)}</button>
      </div>
    `
    : "";
  return `
    <article class="object-card">
      <div class="object-card__media">
        ${image
          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(object.title)}" loading="lazy">`
          : `<span class="object-card__placeholder">${icon("shapes", 30)}</span>`}
        <span class="object-card__badge chip">${escapeHtml(objectKindLabel(object.kind))}</span>
        ${actions}
      </div>
      <div class="object-card__body">
        <h4 class="object-card__title">${escapeHtml(object.title)}</h4>
        ${object.description ? `<p class="object-card__desc">${escapeHtml(object.description)}</p>` : ""}
      </div>
    </article>
  `;
}

export function objectRow(object, options = {}) {
  const { editable = false } = options;
  return `
    <div class="object-row">
      <span class="object-row__thumb">
        ${safeImageUrl(object.image_url)
          ? `<img src="${escapeHtml(object.image_url)}" alt="${escapeHtml(object.title)}" loading="lazy">`
          : icon("shapes", 18)}
      </span>
      <div class="object-row__copy">
        <div class="object-row__title">${escapeHtml(object.title)}</div>
        <div class="object-row__meta">${escapeHtml(objectKindLabel(object.kind))}${object.description ? ` • ${escapeHtml(object.description.slice(0, 60))}` : ""}</div>
      </div>
      ${editable
        ? `<div class="object-row__actions">
            <button class="icon-btn icon-btn--sm" type="button" data-object-edit="${escapeHtml(object.id)}" aria-label="ویرایش">${icon("edit", 14)}</button>
            <button class="icon-btn icon-btn--sm" type="button" data-object-delete="${escapeHtml(object.id)}" aria-label="حذف">${icon("trash", 14)}</button>
          </div>`
        : ""}
    </div>
  `;
}

export function emptyState({
  iconName = "feather",
  title = "هنوز چیزی اینجا نیست",
  text = "",
  actions = "",
  compact = false,
} = {}) {
  return `
    <div class="empty ${compact ? "empty--compact" : ""}">
      <div class="empty__icon">${icon(iconName, 28)}</div>
      <h3 class="empty__title">${escapeHtml(title)}</h3>
      ${text ? `<p class="empty__text">${escapeHtml(text)}</p>` : ""}
      ${actions ? `<div class="empty__actions">${actions}</div>` : ""}
    </div>
  `;
}

export function normalizeLinePicture(data) {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!value || !Array.isArray(value.lines)) return { lines: [], version: 1 };
  const lines = value.lines
    .filter((line) => line && Array.isArray(line.points) && line.points.length > 0)
    .map((line) => ({
      color: /^#[0-9a-f]{3,8}$/i.test(line.color) ? line.color : "#8b5cf6",
      width: Number(line.width) || 4,
      points: line.points
        .filter((point) => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
        .map((point) => ({
          x: Math.max(0, Math.min(1000, Number(point.x))),
          y: Math.max(0, Math.min(600, Number(point.y))),
        })),
    }))
    .filter((line) => line.points.length > 0);
  return { lines, version: 1 };
}

function pathFromPoints(points) {
  if (!points.length) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const midX = (prev.x + current.x) / 2;
    const midY = (prev.y + current.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function linePictureSvg(data, { className = "", height = "" } = {}) {
  const normalized = normalizeLinePicture(data);
  if (!normalized.lines.length) return "";
  const paths = normalized.lines
    .map(
      (line, index) =>
        `<path d="${pathFromPoints(line.points)}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" filter="url(#line-glow-${index})"/>`
    )
    .join("");
  const filters = normalized.lines
    .map(
      (line, index) => `
        <filter id="line-glow-${index}" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      `
    )
    .join("");
  return `
    <svg class="${className}" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" role="img" aria-label="خط تصویری نظریه" ${height ? `style="height:${height}"` : ""}>
      <defs>${filters}</defs>
      ${paths}
    </svg>
  `;
}

export function renderTagList(tags = [], { limit = 8, hrefBase = "#/explore?tag=" } = {}) {
  const list = normalizeTags(tags).slice(0, limit);
  if (!list.length) return `<span class="missing-value">${icon("tag", 11)} برچسبی ثبت نشده است</span>`;
  return `<div class="tag-list">${list
    .map((tag) => `<a class="chip" href="${hrefBase}${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`)
    .join("")}</div>`;
}

export function sectionHeading({ title, subtitle = "", link = "", linkText = "مشاهدهٔ همه" } = {}) {
  return `
    <div class="section-heading">
      <div class="section-heading__copy">
        <h2 class="section-heading__title">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="section-heading__sub">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${link ? `<a class="section-heading__link" href="${link}">${escapeHtml(linkText)} ${icon("arrow-left", 15)}</a>` : ""}
    </div>
  `;
}

export function pageHead({ eyebrow = "", title, subtitle = "", actions = "" } = {}) {
  return `
    <div class="page-head">
      <div class="page-head__copy">
        ${eyebrow ? `<span class="eyebrow">${escapeHtml(eyebrow)}</span>` : ""}
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-head__actions">${actions}</div>` : ""}
    </div>
  `;
}

export function skeletonCards(count = 6) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-card__media"></div>
        <div class="skeleton skeleton-card__line skeleton-card__line--short"></div>
        <div class="skeleton skeleton-card__line"></div>
      </div>
    `
    )
    .join("");
}

export function missingValue(label = "ثبت نشده") {
  return `<span class="missing-value">${icon("minus", 10)} ${escapeHtml(label)}</span>`;
}

export function statCard({ iconName = "activity", label, value, tone = "", trend = "" }) {
  return `
    <article class="stat-card ${tone ? `stat-card--${tone}` : ""}">
      <div class="stat-card__top">
        <span class="stat-card__icon">${icon(iconName, 17)}</span>
        ${trend ? `<span class="stat-card__trend">${icon("trending", 11)} ${escapeHtml(trend)}</span>` : ""}
      </div>
      <div class="stat-card__value">${escapeHtml(String(value))}</div>
      <div class="stat-card__label">${escapeHtml(label)}</div>
    </article>
  `;
}

export function authorBox(profile, { compact = false } = {}) {
  if (!profile) return "";
  return `
    <div class="author-box">
      ${avatar(profile, compact ? "sm" : "lg")}
      <div class="author-box__copy">
        <div class="author-box__name">${escapeHtml(profile.full_name || profile.username || "نویسنده")}</div>
        <div class="author-box__bio">${escapeHtml(profile.bio || "این نویسنده هنوز دربارهٔ خودش چیزی ننوشته است.")}</div>
      </div>
      ${profile.username ? `<a class="btn btn--outline btn--sm" href="#/profile/${encodeURIComponent(profile.username)}">پروفایل</a>` : ""}
    </div>
  `;
}

export function theoryMeta(theory) {
  const minutes = readingTime(theory.content);
  return `
    <div class="stat-inline">
      <span>${icon("calendar", 12)} ${escapeHtml(formatShamsi(theory.published_at || theory.created_at))}</span>
      <span>${icon("clock", 12)} ${formatNumber(minutes)} دقیقه مطالعه</span>
      <span>${icon("eye", 12)} ${compactNumber(theory.views || 0)} بازدید</span>
    </div>
  `;
}

export function formatDateTime(value) {
  return formatShamsiDateTime(value);
}

export function platformStat(value) {
  return compactNumber(value);
}
