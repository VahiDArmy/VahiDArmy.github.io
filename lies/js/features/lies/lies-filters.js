/* ============================================================
   js/features/lies/lies-filters.js
   Advanced filter panel (drawer on desktop side, sheet on mobile)
   ============================================================ */

import { el, clear } from '../../utils/dom.js';
import { LIE_TYPES, MOODS, SORT_OPTIONS } from '../../config/app.config.js';
import { chipSelector } from '../../ui/chips.js';
import { activeFilterCount } from './lies-storage.js';
import { toFaDigits } from '../../utils/format.js';

/**
 * @param {{
 *   filters: object,
 *   categories: any[],
 *   tags: any[],
 *   onApply: (patch:object)=>void,
 *   onReset: ()=>void,
 *   onClose: ()=>void,
 * }} opts
 * @returns {HTMLElement}
 */
export function liesFiltersPanel(opts) {
  const { filters, categories, tags, onApply, onReset, onClose } = opts;

  const panel = el('aside', { class: 'lies-filters', attrs: { role: 'complementary', 'aria-label': 'فیلترها' } });

  /* Header */
  const head = el('header', { class: 'lies-filters__head' });
  head.appendChild(el('h3', { class: 'lies-filters__title' }, { children: ['🎛 فیلترها'] }));
  const close = el('button', {
    class: 'icon-btn',
    attrs: { type: 'button', 'aria-label': 'بستن' },
    on: { click: onClose },
  }, { children: ['✕'] });
  head.appendChild(close);
  panel.appendChild(head);

  const body = el('div', { class: 'lies-filters__body' });

  /* Status */
  body.appendChild(section('وضعیت', segmented({
    items: [
      { id: 'active',   label: 'فعال',    icon: '●' },
      { id: 'archived', label: 'بایگانی', icon: '📦' },
      { id: 'trashed',  label: 'زباله',   icon: '🗑️' },
      { id: 'all',      label: 'همه',     icon: '✳️' },
    ],
    active: filters.status || 'active',
    onChange: (v) => onApply({ status: v }),
    size: 'sm',
    full: true,
  })));

  /* Type */
  const typeGrid = el('div', { class: 'lies-filters__type-grid' });
  const allTypeBtn = typePill('all', 'همه', '✳️', filters.type === 'all');
  allTypeBtn.addEventListener('click', () => onApply({ type: 'all' }));
  typeGrid.appendChild(allTypeBtn);
  for (const t of LIE_TYPES) {
    const btn = typePill(t.id, t.label, t.icon, filters.type === t.id, t.color);
    btn.addEventListener('click', () => onApply({ type: t.id }));
    typeGrid.appendChild(btn);
  }
  body.appendChild(section('نوع دروغ', typeGrid));

  /* Category */
  const catSelect = el('select', { class: 'select' });
  catSelect.appendChild(el('option', { attrs: { value: '' } }, { children: ['همه دسته‌ها'] }));
  for (const c of categories) {
    const opt = el('option', { attrs: { value: c.id } }, { children: [`${c.icon || '📁'} ${c.name}`] });
    if (filters.categoryId === c.id) opt.selected = true;
    catSelect.appendChild(opt);
  }
  catSelect.addEventListener('change', () => onApply({ categoryId: catSelect.value || null }));
  body.appendChild(section('دسته‌بندی', catSelect));

  /* Tags */
  const tagSel = chipSelector({
    items: tags.map((t) => ({ id: t.id, label: t.name, color: t.color })),
    selectedIds: filters.tagIds || [],
    placeholder: 'افزودن برچسب…',
    onChange: (ids) => onApply({ tagIds: ids }),
  });
  body.appendChild(section('برچسب‌ها', tagSel));

  /* Mood */
  const moodWrap = el('div', { class: 'lies-filters__moods' });
  const allMood = moodPill('all', 'همه', '✳️', filters.mood === 'all');
  allMood.addEventListener('click', () => onApply({ mood: 'all' }));
  moodWrap.appendChild(allMood);
  for (const m of MOODS) {
    const btn = moodPill(m.id, m.label, m.icon, filters.mood === m.id);
    btn.addEventListener('click', () => onApply({ mood: m.id }));
    moodWrap.appendChild(btn);
  }
  body.appendChild(section('حال و احساس', moodWrap));

  /* Intensity range */
  body.appendChild(section('شدت باور (۰–۱۰)', rangeRow(
    filters.intensityMin ?? 0,
    filters.intensityMax ?? 10,
    (lo, hi) => onApply({ intensityMin: lo, intensityMax: hi })
  )));

  /* Belief range */
  body.appendChild(section('میزان باور (۰–۱۰)', rangeRow(
    filters.beliefMin ?? 0,
    filters.beliefMax ?? 10,
    (lo, hi) => onApply({ beliefMin: lo, beliefMax: hi })
  )));

  /* Date range */
  const dateRow = el('div', { class: 'lies-filters__dates' });
  const fromInput = el('input', {
    class: 'input',
    attrs: { type: 'date' },
  });
  if (filters.dateFrom) fromInput.value = filters.dateFrom.slice(0, 10);
  fromInput.addEventListener('change', () => onApply({ dateFrom: fromInput.value ? new Date(fromInput.value).toISOString() : null }));

  const toInput = el('input', {
    class: 'input',
    attrs: { type: 'date' },
  });
  if (filters.dateTo) toInput.value = filters.dateTo.slice(0, 10);
  toInput.addEventListener('change', () => {
    const v = toInput.value;
    onApply({ dateTo: v ? new Date(v + 'T23:59:59').toISOString() : null });
  });

  dateRow.appendChild(el('div', { class: 'lies-filters__date-field' }, {
    children: [el('label', {}, { children: ['از'] }), fromInput],
  }));
  dateRow.appendChild(el('div', { class: 'lies-filters__date-field' }, {
    children: [el('label', {}, { children: ['تا'] }), toInput],
  }));
  body.appendChild(section('بازه زمانی', dateRow));

  /* Pinned only */
  const pinRow = el('label', { class: 'lies-filters__pin' });
  const pinCheckbox = el('input', { attrs: { type: 'checkbox' } });
  pinCheckbox.checked = !!filters.pinnedOnly;
  pinCheckbox.addEventListener('change', () => onApply({ pinnedOnly: pinCheckbox.checked }));
  pinRow.appendChild(pinCheckbox);
  pinRow.appendChild(el('span', { class: 'checkbox__box' }, { children: ['✓'] }));
  pinRow.appendChild(el('span', {}, { children: ['فقط سنجاق‌شده‌ها 📌'] }));
  body.appendChild(pinRow);

  panel.appendChild(body);

  /* Footer */
  const foot = el('footer', { class: 'lies-filters__foot' });
  const count = activeFilterCount();
  const resetBtn = el('button', {
    class: 'btn btn--ghost',
    attrs: { type: 'button' },
  }, { children: ['پاک کردن همه'] });
  resetBtn.disabled = count === 0;
  resetBtn.addEventListener('click', onReset);
  foot.appendChild(resetBtn);

  const applyBtn = el('button', {
    class: 'btn btn--primary',
    attrs: { type: 'button' },
    on: { click: onClose },
  }, { children: ['اعمال'] });
  foot.appendChild(applyBtn);
  panel.appendChild(foot);

  return panel;
}

/* ── Helpers ─────────────────────────────────────────────── */

function section(title, content) {
  const wrap = el('div', { class: 'lies-filters__section' });
  wrap.appendChild(el('div', { class: 'lies-filters__section-title' }, { children: [title] }));
  wrap.appendChild(content);
  return wrap;
}

function typePill(id, label, icon, active, color) {
  const btn = el('button', {
    class: ['type-pill', active ? 'is-active' : ''].filter(Boolean),
    attrs: { type: 'button' },
    style: color ? { '--type-color': color } : {},
  });
  btn.appendChild(el('span', { class: 'type-pill__icon' }, { children: [icon] }));
  btn.appendChild(el('span', { class: 'type-pill__label' }, { children: [label] }));
  return btn;
}

function moodPill(id, label, icon, active) {
  const btn = el('button', {
    class: ['mood-pill', active ? 'is-active' : ''].filter(Boolean),
    attrs: { type: 'button', title: label },
  });
  btn.appendChild(el('span', { class: 'mood-pill__icon' }, { children: [icon] }));
  btn.appendChild(el('span', { class: 'mood-pill__label' }, { children: [label] }));
  return btn;
}

function rangeRow(lo, hi, onChange) {
  const wrap = el('div', { class: 'range-row' });

  const numLo = el('span', { class: 'range-row__value' }, { children: [toFaDigits(lo)] });
  const numHi = el('span', { class: 'range-row__value' }, { children: [toFaDigits(hi)] });

  const sliderLo = el('input', {
    class: 'range',
    attrs: { type: 'range', min: '0', max: '10', step: '1', value: String(lo) },
  });
  const sliderHi = el('input', {
    class: 'range',
    attrs: { type: 'range', min: '0', max: '10', step: '1', value: String(hi) },
  });

  const emit = () => {
    let a = Number(sliderLo.value);
    let b = Number(sliderHi.value);
    if (a > b) [a, b] = [b, a];
    numLo.textContent = toFaDigits(a);
    numHi.textContent = toFaDigits(b);
    onChange(a, b);
  };

  sliderLo.addEventListener('input', () => { if (Number(sliderLo.value) > Number(sliderHi.value)) sliderHi.value = sliderLo.value; emit(); });
  sliderHi.addEventListener('input', () => { if (Number(sliderHi.value) < Number(sliderLo.value)) sliderLo.value = sliderHi.value; emit(); });

  wrap.appendChild(el('div', { class: 'range-row__head' }, { children: [numLo, el('span', { class: 'range-row__sep' }, { children: ['—'] }), numHi] }));
  wrap.appendChild(el('div', { class: 'range-row__sliders' }, { children: [sliderLo, sliderHi] }));

  return wrap;
}

/* Import segmented after the fact to avoid circular loops */
import { segmented } from '../../ui/segmented.js';