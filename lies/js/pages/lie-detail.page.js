/* ============================================================
   js/pages/lie-detail.page.js
   Full view of a single lie + reflections
   FIXED: cleaner imports, no ambiguous names, category resolved
          from service (not from a global), no stray references.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import { LIE_TYPES, MOODS } from '../config/app.config.js';
import { getLie } from '../services/index.js';
import * as liesService from '../services/lies.service.js';
import * as categoriesService from '../services/categories.service.js';
import * as reflectionsService from '../services/reflections.service.js';
import { reflectionsPanel } from '../features/lie-detail/reflections.js';
import { toast } from '../ui/toast.js';
import { openLieEditor } from '../features/lies/lie-editor.js';
import { openTagPicker, openCategoryPicker } from '../features/lies/lies-context-menu.js';
import { badge, statusBadge } from '../ui/badges.js';
import { chip } from '../ui/chips.js';
import { progressRing } from '../ui/progress.js';
import { formatRelative, formatDate, formatTime, toFaDigits } from '../utils/format.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

const TYPES_BY_ID = Object.fromEntries(LIE_TYPES.map((t) => [t.id, t]));
const MOODS_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));

/**
 * @param {HTMLElement} container
 * @param {string} lieId
 */
export async function renderLieDetail(container, lieId) {
  clear(container);
  container.appendChild(el('div', { class: 'page-loader' }, {
    children: [el('span', { class: 'spinner spinner--lg' })],
  }));

  let lie = null;
  let reflections = [];
  let categories = [];
  try {
    const [lieRes, reflRes, cats] = await Promise.all([
      getLie(lieId),
      reflectionsService.listForLie(lieId).catch(() => []),
      categoriesService.list().catch(() => []),
    ]);
    lie = lieRes;
    reflections = reflRes;
    categories = cats;
  } catch (err) {
    console.error('[lie-detail] load failed', err);
    clear(container);
    container.appendChild(renderError(err));
    return;
  }

  if (!lie) {
    clear(container);
    container.appendChild(renderNotFound());
    return;
  }

  clear(container);

  const page = el('article', { class: 'page page--lie-detail' });
  page.appendChild(renderHeader(lie));
  page.appendChild(renderMain(lie, reflections));
  page.appendChild(renderSidebar(lie, reflections, categories));
  container.appendChild(page);

  bus.emit(EVENTS.ROUTE_CHANGED, { path: `/lie/${lieId}`, params: { id: lieId } });
}

/* ── Header ──────────────────────────────────────────────── */

function renderHeader(lie) {
  const header = el('header', { class: 'lie-detail__header' });

  const top = el('div', { class: 'lie-detail__top' });

  const type = TYPES_BY_ID[lie.type] || TYPES_BY_ID.other;
  const typePill = el('span', {
    class: 'lie-detail__type',
    style: { '--type-color': type.color },
  });
  typePill.appendChild(el('span', {}, { children: [type.icon] }));
  typePill.appendChild(el('span', {}, { children: [type.label] }));
  top.appendChild(typePill);

  if (lie.isPinned) top.appendChild(badge({ label: 'سنجاق‌شده', icon: '📌', variant: 'accent', pill: true }));
  top.appendChild(statusBadge(lie.status));

  const actions = el('div', { class: 'lie-detail__actions' });

  const editBtn = el('button', { class: 'btn btn--ghost btn--sm', attrs: { type: 'button' } }, {
    children: ['✎ ویرایش'],
  });
  editBtn.addEventListener('click', () => {
    openLieEditor(lie, { onSaved: () => location.reload() });
  });
  actions.appendChild(editBtn);

  const dupBtn = el('button', { class: 'btn btn--ghost btn--sm', attrs: { type: 'button' } }, {
    children: ['⎘ تکثیر'],
  });
  dupBtn.addEventListener('click', async () => {
    try {
      const created = await liesService.duplicate(lie.id);
      toast.success('تکثیر شد.');
      location.hash = `#/lie/${created.id}`;
    } catch (err) { toast.error(err.message); }
  });
  actions.appendChild(dupBtn);

  const pinBtn = el('button', {
    class: 'btn btn--ghost btn--sm',
    attrs: { type: 'button', title: lie.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن' },
  }, { children: ['📌'] });
  pinBtn.addEventListener('click', async () => {
    try {
      await liesService.togglePin(lie.id, !lie.isPinned);
      location.reload();
    } catch (err) { toast.error(err.message); }
  });
  actions.appendChild(pinBtn);

  top.appendChild(actions);
  header.appendChild(top);

  header.appendChild(el('h1', { class: 'lie-detail__title' }, { children: [lie.title] }));

  const meta = el('div', { class: 'lie-detail__meta' });
  meta.appendChild(el('span', { title: lie.createdAt }, {
    children: [`🗓 ${formatDate(lie.createdAt, { style: 'medium' })} · ${formatTime(lie.createdAt)}`],
  }));
  if (lie.updatedAt && lie.updatedAt !== lie.createdAt) {
    meta.appendChild(el('span', { children: [`· ویرایش ${formatRelative(lie.updatedAt)}`] }));
  }
  header.appendChild(meta);

  return header;
}

/* ── Main column ─────────────────────────────────────────── */

function renderMain(lie, reflections) {
  const main = el('div', { class: 'lie-detail__main' });

  // Body
  if (lie.body) {
    const bodyBlock = el('section', { class: 'lie-detail__block' });
    bodyBlock.appendChild(el('h3', { class: 'lie-detail__block-title' }, {
      children: [el('span', { class: 'lie-detail__block-icon' }, { children: ['📝'] }), 'متن دروغ'],
    }));
    bodyBlock.appendChild(el('div', { class: 'lie-detail__text' }, { children: [lie.body] }));
    main.appendChild(bodyBlock);
  }

  // Truth
  if (lie.truth) {
    const truthBlock = el('section', { class: 'lie-detail__truth-block' });
    truthBlock.appendChild(el('div', { class: 'lie-detail__truth-label' }, {
      children: [el('span', {}, { children: ['✦'] }), 'حقیقت مقابل'],
    }));
    truthBlock.appendChild(el('div', { class: 'lie-detail__truth-text' }, { children: [lie.truth] }));
    main.appendChild(truthBlock);
  }

  // Reflections
  main.appendChild(reflectionsPanel(lie.id, { reflections: [...reflections] }));

  return main;
}

/* ── Sidebar ─────────────────────────────────────────────── */

function renderSidebar(lie, reflections, categories) {
  const side = el('aside', { class: 'lie-detail__sidebar' });

  // Intensity & Belief rings
  const meters = el('div', { class: 'lie-detail__meters' });

  const intRing = el('div', { class: 'lie-detail__meter' });
  intRing.appendChild(progressRing({
    value: lie.intensity / 10,
    size: 96,
    thickness: 8,
    label: toFaDigits(lie.intensity),
    variant: 'warning',
  }));
  intRing.appendChild(el('div', { class: 'lie-detail__meter-label' }, { children: ['⚡ شدت احساس'] }));
  intRing.appendChild(el('div', { class: 'lie-detail__meter-desc' }, { children: ['چقدر در لحظه فشار می‌آورد'] }));
  meters.appendChild(intRing);

  const beliefRing = el('div', { class: 'lie-detail__meter' });
  beliefRing.appendChild(progressRing({
    value: lie.belief / 10,
    size: 96,
    thickness: 8,
    label: toFaDigits(lie.belief),
    variant: 'accent',
  }));
  beliefRing.appendChild(el('div', { class: 'lie-detail__meter-label' }, { children: ['◉ میزان باور'] }));
  beliefRing.appendChild(el('div', { class: 'lie-detail__meter-desc' }, { children: ['چقدر به آن باور داشتی'] }));
  meters.appendChild(beliefRing);

  side.appendChild(meters);

  // Meta info
  const metaCard = el('div', { class: 'lie-detail__meta-card' });
  metaCard.appendChild(el('h4', { class: 'lie-detail__meta-title' }, { children: ['اطلاعات'] }));

  const rows = [
    ['وضعیت', lie.status === 'active' ? 'فعال' : lie.status === 'archived' ? 'بایگانی' : 'زباله'],
    ['نوع', TYPES_BY_ID[lie.type]?.label || '—'],
    ['حال', MOODS_BY_ID[lie.mood] ? `${MOODS_BY_ID[lie.mood].icon} ${MOODS_BY_ID[lie.mood].label}` : '—'],
    ['تاریخ رخداد', lie.occurredAt ? formatDate(lie.occurredAt, { style: 'long' }) : '—'],
    ['ساخته‌شده', formatDate(lie.createdAt, { style: 'long' })],
    ['ویرایش', formatRelative(lie.updatedAt)],
  ];
  for (const [k, v] of rows) {
    const r = el('div', { class: 'lie-detail__meta-row' });
    r.appendChild(el('span', { class: 'lie-detail__meta-key' }, { children: [k] }));
    r.appendChild(el('span', { class: 'lie-detail__meta-value' }, { children: [v] }));
    metaCard.appendChild(r);
  }
  side.appendChild(metaCard);

  // Category
  const catCard = el('div', { class: 'lie-detail__meta-card' });
  catCard.appendChild(el('h4', { class: 'lie-detail__meta-title' }, { children: ['دسته‌بندی'] }));
  const catRow = el('div', { class: 'lie-detail__tags-row' });
  const cat = lie.categoryId ? categories.find((c) => c.id === lie.categoryId) : null;
  if (cat) {
    catRow.appendChild(chip({ label: cat.name, icon: cat.icon || '📁', color: cat.color, size: 'md' }));
  } else {
    catRow.appendChild(el('span', { class: 'text-dim' }, { children: ['— بدون دسته'] }));
  }
  const changeCatBtn = el('button', {
    class: 'btn btn--ghost btn--xs',
    attrs: { type: 'button' },
  }, { children: ['تغییر'] });
  changeCatBtn.addEventListener('click', () => openCategoryPicker(lie, () => location.reload()));
  catRow.appendChild(changeCatBtn);
  catCard.appendChild(catRow);
  side.appendChild(catCard);

  // Tags
  const tagsCard = el('div', { class: 'lie-detail__meta-card' });
  tagsCard.appendChild(el('h4', { class: 'lie-detail__meta-title' }, { children: ['برچسب‌ها'] }));
  const tagRow = el('div', { class: 'lie-detail__tags-row' });
  if (lie.tags?.length) {
    for (const t of lie.tags) tagRow.appendChild(chip({ label: t.name, color: t.color, size: 'sm' }));
  } else {
    tagRow.appendChild(el('span', { class: 'text-dim' }, { children: ['— بدون برچسب'] }));
  }
  const changeTagBtn = el('button', {
    class: 'btn btn--ghost btn--xs',
    attrs: { type: 'button' },
  }, { children: ['تغییر'] });
  changeTagBtn.addEventListener('click', () => openTagPicker(lie, () => location.reload()));
  tagRow.appendChild(changeTagBtn);
  tagsCard.appendChild(tagRow);
  side.appendChild(tagsCard);

  // Summary
  const actCard = el('div', { class: 'lie-detail__meta-card' });
  actCard.appendChild(el('h4', { class: 'lie-detail__meta-title' }, { children: ['خلاصه'] }));
  actCard.appendChild(el('p', { class: 'lie-detail__meta-summary' }, {
    children: [
      reflections.length
        ? `این دروغ ${toFaDigits(reflections.length)} بازتاب دارد. آخرین بازتاب ${formatRelative(reflections[0]?.createdAt || lie.updatedAt)}.`
        : 'هنوز بازتابی ثبت نشده. اولین بازتاب را می‌توانی همین حالا بنویسی.',
    ],
  }));
  side.appendChild(actCard);

  return side;
}

/* ── Error views ─────────────────────────────────────────── */

function renderNotFound() {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['🔍'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['پیدا نشد'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: ['این دروغ وجود ندارد یا به آن دسترسی ندارید.'] }));
  const btn = el('button', { class: 'btn btn--primary' }, { children: ['بازگشت به لیست'] });
  btn.addEventListener('click', () => { location.hash = '#/lies'; });
  box.appendChild(btn);
  return box;
}

function renderError(err) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [err?.message || 'خطای نامشخص'] }));
  const btn = el('button', { class: 'btn btn--primary' }, { children: ['بازگشت'] });
  btn.addEventListener('click', () => { location.hash = '#/lies'; });
  box.appendChild(btn);
  return box;
}

export default { renderLieDetail };