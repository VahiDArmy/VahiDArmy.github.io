/**
 * dashboard.js — صفحه اصلی و صفحات اختصاصی هر یک از موضوعات
 * - renderDashboard: خلاصه روزانه + وعده‌های غذایی + کارت همه موضوعات
 * - renderSubjectPage: نمایش متمرکز یک موضوع (انسولین/قند/فشار/...)
 */

import { $, el, clear, delegate } from '../utils/dom.js';
import { toast } from '../components/toast.js';
import { openModal, openConfirm } from '../components/modal.js';
import { createAutocomplete } from '../components/autocomplete.js';
import { formatNumber, formatTime, toFaDigits } from '../utils/format.js';
import { todayISO, weekdayName, formatJalali } from '../utils/date.js';
import {
  MEALS, INSULIN_TYPES, INJECTION_SITES, GLUCOSE_CONTEXTS,
  BP_POSITIONS, EXERCISE_TYPES, EXERCISE_INTENSITY, OTHER_TAGS,
  GLUCOSE_RANGE, BP_RANGE,
} from '../config/constants.js';
import * as db from '../services/db.service.js';
import { dailyAll } from '../services/stats.service.js';
import { computeNutrients } from '../services/foods.service.js';
import { bus, EVENTS } from '../utils/events.js';

/* =========================================================================
   ابزارها
   ========================================================================= */

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function optLabel(list, key) {
  return list.find((x) => x.key === key)?.title || key || '—';
}
function sumBy(rows, key) {
  return (rows || []).reduce((s, r) => s + (Number(r?.[key]) || 0), 0);
}
function computeDurationMin(sleepTime, wakeTime) {
  if (!sleepTime || !wakeTime) return 0;
  const [sh, sm] = sleepTime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let diff = (wh * 60 + wm) - (sh * 60 + sm);
  if (diff < 0) diff += 1440;
  return diff;
}

/* =========================================================================
   تعریف طرح هر موضوع (Schema-Driven)
   ========================================================================= */

export const SUBJECTS = {
  insulin: {
    key: 'insulin',
    title: 'انسولین',
    icon: '💉',
    tone: 'violet',
    table: 'insulin',
    singular: 'تزریق',
    fields: [
      { key: 'insulin_type', label: 'نوع انسولین', type: 'select', options: INSULIN_TYPES, required: true, default: 'rapid' },
      { key: 'units', label: 'واحد', type: 'number', required: true, min: 0.5, max: 200, step: 0.5, unit: 'واحد' },
      { key: 'entry_time', label: 'ساعت', type: 'time', required: true, default: nowTime },
      { key: 'injection_site', label: 'محل تزریق', type: 'select', options: INJECTION_SITES },
      { key: 'brand', label: 'برند', type: 'text', placeholder: 'مثلاً نوورپید' },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2 },
    ],
    summarize(rows) {
      return { count: rows.length, secondary: `${formatNumber(sumBy(rows, 'units'), { decimals: 1 })} واحد` };
    },
    renderItem(row) {
      return {
        icon: '💉',
        title: optLabel(INSULIN_TYPES, row.insulin_type) + (row.brand ? ` · ${row.brand}` : ''),
        meta: [formatTime(row.entry_time), row.injection_site ? optLabel(INJECTION_SITES, row.injection_site) : null].filter(Boolean),
        value: `${formatNumber(row.units, { decimals: 1 })}`,
        unit: 'واحد',
      };
    },
  },

  glucose: {
    key: 'glucose',
    title: 'قند خون',
    icon: '🩸',
    tone: 'amber',
    table: 'glucose',
    singular: 'اندازه‌گیری',
    fields: [
      { key: 'value_mgdl', label: 'مقدار (mg/dL)', type: 'number', required: true, min: 20, max: 800, step: 1 },
      { key: 'entry_time', label: 'ساعت', type: 'time', required: true, default: nowTime },
      { key: 'context', label: 'زمینه', type: 'select', options: GLUCOSE_CONTEXTS, default: 'random' },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2 },
    ],
    summarize(rows) {
      const vals = rows.map((r) => Number(r.value_mgdl)).filter(Number.isFinite);
      return { count: rows.length, secondary: vals.length ? `میانگین ${formatNumber(vals.reduce((a, b) => a + b, 0) / vals.length)}` : '—' };
    },
    renderItem(row) {
      const v = Number(row.value_mgdl);
      const tone = v < GLUCOSE_RANGE.low ? 'danger' : v > GLUCOSE_RANGE.high ? 'warning' : 'success';
      return {
        icon: '🩸',
        title: `${formatNumber(v)} mg/dL`,
        meta: [formatTime(row.entry_time), optLabel(GLUCOSE_CONTEXTS, row.context)].filter(Boolean),
        value: optLabel(GLUCOSE_CONTEXTS, row.context),
        tone,
      };
    },
  },

  bloodPressure: {
    key: 'bloodPressure',
    title: 'فشار خون',
    icon: '❤️',
    tone: 'red',
    table: 'blood_pressure',
    singular: 'اندازه‌گیری',
    fields: [
      { key: 'systolic', label: 'سیستولیک', type: 'number', required: true, min: 40, max: 300 },
      { key: 'diastolic', label: 'دیاستولیک', type: 'number', required: true, min: 20, max: 200 },
      { key: 'pulse', label: 'ضربان', type: 'number', min: 20, max: 250 },
      { key: 'entry_time', label: 'ساعت', type: 'time', required: true, default: nowTime },
      { key: 'position', label: 'وضعیت', type: 'select', options: BP_POSITIONS, default: 'sitting' },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2 },
    ],
    summarize(rows) {
      const sys = rows.map((r) => Number(r.systolic)).filter(Number.isFinite);
      const dia = rows.map((r) => Number(r.diastolic)).filter(Number.isFinite);
      if (!sys.length) return { count: 0, secondary: '—' };
      const avgS = Math.round(sys.reduce((a, b) => a + b, 0) / sys.length);
      const avgD = Math.round(dia.reduce((a, b) => a + b, 0) / dia.length);
      return { count: rows.length, secondary: `میانگین ${toFaDigits(avgS)}/${toFaDigits(avgD)}` };
    },
    renderItem(row) {
      const sys = Number(row.systolic);
      const tone = sys >= BP_RANGE.high1Sys ? 'danger' : sys >= BP_RANGE.elevatedSys ? 'warning' : 'success';
      return {
        icon: '❤️',
        title: `${formatNumber(row.systolic)}/${formatNumber(row.diastolic)} mmHg`,
        meta: [formatTime(row.entry_time), row.pulse ? `ضربان ${formatNumber(row.pulse)}` : null].filter(Boolean),
        value: row.pulse ? `${formatNumber(row.pulse)}` : '',
        unit: row.pulse ? 'bpm' : '',
        tone,
      };
    },
  },

  weight: {
    key: 'weight',
    title: 'وزن',
    icon: '⚖️',
    tone: 'teal',
    table: 'weight',
    singular: 'ثبت وزن',
    fields: [
      { key: 'weight_kg', label: 'وزن (کیلوگرم)', type: 'number', required: true, min: 10, max: 400, step: 0.1 },
      { key: 'entry_time', label: 'ساعت', type: 'time', required: true, default: '07:00' },
      { key: 'body_fat_pct', label: 'درصد چربی', type: 'number', min: 0, max: 70, step: 0.1 },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2 },
    ],
    summarize(rows) {
      const last = rows[rows.length - 1];
      return { count: rows.length, secondary: last ? `${formatNumber(last.weight_kg, { decimals: 1 })} کیلوگرم` : '—' };
    },
    renderItem(row) {
      return {
        icon: '⚖️',
        title: `${formatNumber(row.weight_kg, { decimals: 1 })} کیلوگرم`,
        meta: [formatTime(row.entry_time), row.body_fat_pct ? `چربی ${formatNumber(row.body_fat_pct, { decimals: 1 })}٪` : null].filter(Boolean),
        value: row.body_fat_pct ? `${formatNumber(row.body_fat_pct, { decimals: 1 })}%` : '',
        unit: '',
      };
    },
  },

  sleep: {
    key: 'sleep',
    title: 'خواب',
    icon: '🌙',
    tone: 'green',
    table: 'sleep',
    singular: 'ثبت خواب',
    fields: [
      { key: 'sleep_time', label: 'ساعت خواب', type: 'time', required: true, default: '23:00' },
      { key: 'wake_time', label: 'ساعت بیداری', type: 'time', required: true, default: '07:00' },
      { key: 'quality', label: 'کیفیت (۱ تا ۵)', type: 'number', min: 1, max: 5, step: 1, default: 4 },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2 },
    ],
    beforeSave(values) {
      values.duration_minutes = computeDurationMin(values.sleep_time, values.wake_time);
      return values;
    },
    summarize(rows) {
      const total = sumBy(rows, 'duration_minutes');
      return { count: rows.length, secondary: total ? `${formatNumber(Math.round(total / 60 * 10) / 10, { decimals: 1 })} ساعت` : '—' };
    },
    renderItem(row) {
      const dur = Number(row.duration_minutes || 0);
      const h = Math.floor(dur / 60), m = dur % 60;
      return {
        icon: '🌙',
        title: `${formatTime(row.sleep_time)} → ${formatTime(row.wake_time)}`,
        meta: [`${formatNumber(h)}س ${formatNumber(m)}د`, row.quality ? `${'★'.repeat(row.quality)}` : null].filter(Boolean),
        value: `${formatNumber(h)}:${toFaDigits(String(m).padStart(2, '0'))}`,
        unit: 'ساعت',
      };
    },
  },

  exercise: {
    key: 'exercise',
    title: 'ورزش',
    icon: '🏃',
    tone: 'green',
    table: 'exercise',
    singular: 'فعالیت',
    fields: [
      { key: 'activity_type', label: 'نوع', type: 'select', options: EXERCISE_TYPES, required: true, default: 'walking' },
      { key: 'distance_km', label: 'مسافت (کیلومتر)', type: 'number', min: 0, max: 200, step: 0.1 },
      { key: 'duration_minutes', label: 'مدت (دقیقه)', type: 'number', min: 0, max: 600, step: 1, required: true },
      { key: 'intensity', label: 'شدت', type: 'select', options: EXERCISE_INTENSITY, default: 'moderate' },
      { key: 'calories_burned', label: 'کالری سوزانده', type: 'number', min: 0, max: 3000 },
      { key: 'entry_time', label: 'ساعت', type: 'time', required: true, default: nowTime },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2 },
    ],
    summarize(rows) {
      const km = sumBy(rows, 'distance_km');
      const min = sumBy(rows, 'duration_minutes');
      return { count: rows.length, secondary: `${formatNumber(min)} دقیقه${km ? ` · ${formatNumber(km, { decimals: 1 })} کیلومتر` : ''}` };
    },
    renderItem(row) {
      const type = EXERCISE_TYPES.find((t) => t.key === row.activity_type);
      return {
        icon: type?.icon || '🏃',
        title: type?.title || row.activity_type,
        meta: [formatTime(row.entry_time), row.distance_km ? `${formatNumber(row.distance_km, { decimals: 2 })} کیلومتر` : null, optLabel(EXERCISE_INTENSITY, row.intensity)].filter(Boolean),
        value: `${formatNumber(row.duration_minutes)}`,
        unit: 'دقیقه',
      };
    },
  },

  otherNotes: {
    key: 'otherNotes',
    title: 'موارد دیگر',
    icon: '📝',
    tone: 'pink',
    table: 'other_notes',
    singular: 'یادداشت',
    fields: [
      { key: 'title', label: 'عنوان', type: 'text', required: true, maxLength: 80 },
      { key: 'description', label: 'توضیحات', type: 'textarea', rows: 3 },
      { key: 'severity', label: 'شدت (۱ تا ۵)', type: 'number', min: 1, max: 5, step: 1 },
      { key: 'entry_time', label: 'ساعت', type: 'time', required: true, default: nowTime },
      { key: 'tags', label: 'برچسب', type: 'tags', options: OTHER_TAGS },
    ],
    summarize(rows) {
      return { count: rows.length, secondary: rows.length ? `${toFaDigits(rows.length)} مورد ثبت‌شده` : '—' };
    },
    renderItem(row) {
      return {
        icon: '📝',
        title: row.title,
        meta: [formatTime(row.entry_time), ...(row.tags || [])].filter(Boolean),
        value: '',
        unit: '',
      };
    },
  },
};

/* =========================================================================
   Entry: Dashboard
   ========================================================================= */

export async function renderDashboard(container, ctx) {
  clear(container);
  renderSkeleton(container, 'daily');

  let day;
  try {
    day = await dailyAll(ctx.date);
  } catch (e) {
    console.error(e);
    clear(container);
    container.appendChild(buildErrorState(() => renderDashboard(container, ctx)));
    return;
  }

  clear(container);
  container.appendChild(buildDailySummary(day, ctx));
  container.appendChild(buildMealsSection(day, ctx));
  container.appendChild(buildSubjectsGrid(day, ctx));
}

/* =========================================================================
   خلاصه روزانه
   ========================================================================= */

function buildDailySummary(day, ctx) {
  const s = day.summary;
  const card = el('div', { class: 'daily-summary' });

  const header = el('div', { class: 'daily-summary__header' });
  header.appendChild(el('div', {}, [
    el('div', { class: 'daily-summary__title' }, [
      el('span', { class: 'daily-summary__title-icon' }, ['📊']),
      'خلاصه روز',
    ]),
    el('div', { class: 'daily-summary__subtitle' }, [
      day.summary.mealsCount ? `${toFaDigits(day.summary.mealsCount)} آیتم غذایی ثبت‌شده` : 'هنوز غذایی ثبت نشده',
    ]),
  ]));
  header.appendChild(el('div', { class: 'daily-summary__date' }, [
    `${weekdayName(ctx.date)} · ${formatJalali(ctx.date)}`,
  ]));
  card.appendChild(header);

  // KPIs
  const stats = el('div', { class: 'daily-summary__stats' });
  stats.appendChild(statTile('🔥', 'کالری', formatNumber(s.totalKcal), 'kcal', 'amber'));
  stats.appendChild(statTile('💉', 'انسولین', formatNumber(s.insulinTotal, { decimals: 1 }), 'واحد', 'violet'));
  stats.appendChild(statTile('🩸', 'قند', s.glucoseAvg != null ? formatNumber(s.glucoseAvg) : '—', s.glucoseCount ? `${toFaDigits(s.glucoseCount)} نوبت` : '', 'red'));
  stats.appendChild(statTile('❤️', 'فشار', s.bpAvgSys ? `${toFaDigits(Math.round(s.bpAvgSys))}/${toFaDigits(Math.round(s.bpAvgDia))}` : '—', s.bpCount ? 'mmHg' : '', 'pink'));
  stats.appendChild(statTile('⚖️', 'وزن', s.lastWeight != null ? formatNumber(s.lastWeight, { decimals: 1 }) : '—', 'kg', 'cyan'));
  stats.appendChild(statTile('🌙', 'خواب', s.sleepMin ? `${formatNumber(Math.floor(s.sleepMin / 60))}:${toFaDigits(String(s.sleepMin % 60).padStart(2, '0'))}` : '—', 'ساعت', 'green'));
  stats.appendChild(statTile('🏃', 'ورزش', s.exerciseKm ? formatNumber(s.exerciseKm, { decimals: 1 }) : formatNumber(s.exerciseMin), s.exerciseKm ? 'کیلومتر' : 'دقیقه', 'teal'));
  card.appendChild(stats);

  // Macros
  const macros = el('div', { class: 'daily-summary__macros' });
  macros.appendChild(macroRing('پروتئین', s.totalProtein, 100, '#a855f7'));
  macros.appendChild(macroRing('کربوهیدرات', s.totalCarbs, 250, '#22d3ee'));
  macros.appendChild(macroRing('چربی', s.totalFat, 65, '#f59e0b'));
  macros.appendChild(macroRing('فیبر', s.totalFiber, 25, '#10b981'));
  card.appendChild(macros);

  return card;
}

function statTile(icon, label, value, unit, tone) {
  const t = el('div', { class: 'stat-card stat-card--compact', 'data-tone': tone });
  const top = el('div', { class: 'stat-card__top' });
  top.appendChild(el('div', { class: 'stat-card__label' }, [label]));
  top.appendChild(el('div', { class: 'stat-card__icon' }, [icon]));
  t.appendChild(top);
  const v = el('div', { class: 'stat-card__value' });
  v.appendChild(document.createTextNode(value));
  if (unit) v.appendChild(el('span', { class: 'stat-card__unit' }, [unit]));
  t.appendChild(v);
  return t;
}

function macroRing(label, value, target, color) {
  const pct = Math.min(100, Math.round((value / target) * 100)) || 0;
  const wrap = el('div', { class: 'macro-ring', style: { '--pct': pct, '--ring-color': color } });

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  const track = document.createElementNS(svgNS, 'circle');
  track.setAttribute('cx', '18');
  track.setAttribute('cy', '18');
  track.setAttribute('r', '15.9155');
  track.setAttribute('class', 'macro-ring__track');
  track.setAttribute('stroke-width', '3');
  svg.appendChild(track);
  const bar = document.createElementNS(svgNS, 'circle');
  bar.setAttribute('cx', '18');
  bar.setAttribute('cy', '18');
  bar.setAttribute('r', '15.9155');
  bar.setAttribute('class', 'macro-ring__bar');
  bar.setAttribute('stroke-width', '3');
  svg.appendChild(bar);
  wrap.appendChild(svg);

  const content = el('div', { class: 'macro-ring__content' });
  content.appendChild(el('div', { class: 'macro-ring__value' }, [formatNumber(value, { decimals: 0 })]));
  content.appendChild(el('div', { class: 'macro-ring__label' }, [`${label} / ${toFaDigits(target)}`]));
  wrap.appendChild(content);

  return wrap;
}

/* =========================================================================
   بخش وعده‌های غذایی
   ========================================================================= */

function buildMealsSection(day, ctx) {
  const section = el('section', { class: 'section' });
  section.appendChild(el('div', { class: 'section__header' }, [
    el('h2', { class: 'section-title' }, ['🍽 وعده‌های غذایی']),
  ]));

  const wrap = el('div', { class: 'meals' });

  for (const meal of MEALS) {
    const mealRecords = day.meals.filter((m) => m.meal_type === meal.key);
    const totalKcal = sumBy(mealRecords, 'calories');
    wrap.appendChild(buildMealCard(meal, mealRecords, totalKcal, ctx));
  }
  section.appendChild(wrap);
  return section;
}

function buildMealCard(meal, records, totalKcal, ctx) {
  const card = el('div', { class: 'meal-card' });

  const header = el('div', { class: 'meal-card__header' });
  header.appendChild(el('div', { class: 'meal-card__title' }, [
    el('span', { class: 'meal-card__icon' }, [meal.icon]),
    meal.title,
    el('span', { class: 'badge', style: { marginInlineStart: '6px' } }, [toFaDigits(records.length)]),
  ]));
  header.appendChild(el('div', { class: 'meal-card__kcal' }, [
    el('span', { class: 'meal-card__kcal-value' }, [formatNumber(totalKcal)]),
    el('span', { class: 'meal-card__kcal-unit' }, ['کیلوکالری']),
  ]));
  card.appendChild(header);

  const body = el('div', { class: 'meal-card__body' });

  if (!records.length) {
    body.appendChild(el('div', { class: 'meal-card__empty' }, ['هنوز آیتمی برای این وعده ثبت نشده']));
  } else {
    for (const r of records) {
      body.appendChild(buildFoodItem(r, ctx));
    }
  }

  const addBtn = el('button', { class: 'meal-card__add', type: 'button' }, [`+ افزودن به ${meal.title}`]);
  addBtn.addEventListener('click', () => openFoodModal(meal.key, ctx));
  card.appendChild(body);
  card.appendChild(addBtn);

  return card;
}

function buildFoodItem(r, ctx) {
  const item = el('div', { class: 'record-item', 'data-id': r.id, 'data-table': 'meals' });
  item.appendChild(el('div', { class: 'record-item__icon' }, ['🍽']));

  const main = el('div', { class: 'record-item__main' });
  main.appendChild(el('div', { class: 'record-item__title' }, [r.food_name]));
  const meta = el('div', { class: 'record-item__meta' });
  meta.appendChild(el('span', {}, [formatTime(r.entry_time)]));
  if (r.quantity !== 1) meta.appendChild(el('span', {}, [`${formatNumber(r.quantity, { decimals: 1 })} × ${r.unit || 'واحد'}`]));
  if (r.protein) meta.appendChild(el('span', {}, [`پ ${formatNumber(r.protein, { decimals: 1 })}`]));
  if (r.carbs) meta.appendChild(el('span', {}, [`ک ${formatNumber(r.carbs, { decimals: 1 })}`]));
  if (r.fat) meta.appendChild(el('span', {}, [`چ ${formatNumber(r.fat, { decimals: 1 })}`]));
  main.appendChild(meta);
  item.appendChild(main);

  item.appendChild(el('div', { class: 'record-item__value' }, [
    formatNumber(r.calories),
    el('small', {}, [' kcal']),
  ]));

  const actions = el('div', { class: 'record-item__actions' });
  const editBtn = el('button', { class: 'record-item__action', type: 'button', title: 'ویرایش' }, ['✎']);
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); openFoodModal(r.meal_type, ctx, r); });
  const delBtn = el('button', { class: 'record-item__action record-item__action--danger', type: 'button', title: 'حذف' }, ['🗑']);
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await openConfirm({ title: 'حذف آیتم غذایی', text: `«${r.food_name}» حذف شود؟`, type: 'danger', confirmText: 'حذف' });
    if (!ok) return;
    await db.remove('meals', r.id);
    toast.success('حذف شد');
    ctx.refresh();
  });
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  item.appendChild(actions);

  return item;
}

/* =========================================================================
   شبکه موضوعات دیگر
   ========================================================================= */

function buildSubjectsGrid(day, ctx) {
  const section = el('section', { class: 'section' });
  section.appendChild(el('div', { class: 'section__header' }, [
    el('h2', { class: 'section-title' }, ['📋 سایر موضوعات']),
  ]));

  const grid = el('div', { class: 'subject-grid' });

  for (const key of Object.keys(SUBJECTS)) {
    const subj = SUBJECTS[key];
    const rows = day[key === 'otherNotes' ? 'otherNotes' : key] || [];
    const summary = subj.summarize(rows);

    const card = el('div', { class: 'subject-card', 'data-tone': subj.tone, 'data-subject': key });
    const top = el('div', { class: 'subject-card__top' });
    top.appendChild(el('div', { class: 'subject-card__icon' }, [subj.icon]));
    top.appendChild(el('span', { class: 'subject-card__arrow' }, ['‹']));
    card.appendChild(top);
    card.appendChild(el('div', { class: 'subject-card__title' }, [subj.title]));
    card.appendChild(el('div', { class: 'subject-card__meta' }, [
      summary.count ? `${toFaDigits(summary.count)} ${subj.singular}` : 'بدون داده',
    ]));
    card.appendChild(el('div', { class: 'subject-card__value' }, [
      summary.secondary || '—',
    ]));

    card.addEventListener('click', () => ctx.navigate(subjRoute(key)));
    grid.appendChild(card);
  }

  section.appendChild(grid);
  return section;
}

/* =========================================================================
   صفحات موضوع متمرکز
   ========================================================================= */

export async function renderSubjectPage(subjectKey, container, ctx) {
  const subj = SUBJECTS[subjectKey];
  if (!subj) return;

  clear(container);
  renderSkeleton(container, 'subject');

  let rows = [];
  try {
    rows = await db.listByDate(subj.table, ctx.date);
  } catch (e) {
    console.error(e);
    toast.error('خطا', 'بارگذاری داده‌ها ناموفق بود.');
  }

  clear(container);

  const summary = subj.summarize(rows);

  const page = el('div', { class: 'dashboard' });

  // Header
  const head = el('div', { class: 'daily-summary' });
  head.appendChild(el('div', { class: 'daily-summary__header' }, [
    el('div', {}, [
      el('div', { class: 'daily-summary__title' }, [
        el('span', { class: 'daily-summary__title-icon' }, [subj.icon]),
        subj.title,
      ]),
      el('div', { class: 'daily-summary__subtitle' }, [
        summary.count ? `${toFaDigits(summary.count)} مورد در این روز` : 'بدون داده در این روز',
      ]),
    ]),
    el('div', { class: 'daily-summary__date' }, [`${weekdayName(ctx.date)} · ${formatJalali(ctx.date)}`]),
  ]));

  const actionRow = el('div', { class: 'flex gap-3', style: { marginTop: '12px' } });
  const addBtn = el('button', { class: 'btn btn--primary', type: 'button' }, [`+ افزودن ${subj.singular}`]);
  addBtn.addEventListener('click', () => openSubjectModal(subj.key, ctx));
  actionRow.appendChild(addBtn);
  head.appendChild(actionRow);
  page.appendChild(head);

  // List
  const list = el('div', { class: 'card' });
  list.appendChild(el('div', { class: 'card__header' }, [
    el('div', { class: 'card__title' }, [
      el('span', { class: 'card__title-icon' }, ['📋']),
      `رکوردهای ${subj.title}`,
    ]),
  ]));

  const listBody = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
  if (!rows.length) {
    listBody.appendChild(buildEmptyState(subj.icon, `هنوز ${subj.singular}ی ثبت نشده`, `برای ثبت اولین مورد، روی «افزودن» بزنید.`));
  } else {
    for (const r of rows) listBody.appendChild(buildSubjectItem(subj, r, ctx));
  }
  list.appendChild(listBody);
  page.appendChild(list);

  container.appendChild(page);
}

function buildSubjectItem(subj, row, ctx) {
  const renderInfo = subj.renderItem(row);
  const item = el('div', { class: 'record-item', 'data-id': row.id, 'data-table': subj.table });
  item.appendChild(el('div', { class: 'record-item__icon' }, [renderInfo.icon || subj.icon]));

  const main = el('div', { class: 'record-item__main' });
  main.appendChild(el('div', { class: 'record-item__title' }, [renderInfo.title || '—']));
  if (renderInfo.meta?.length) {
    const meta = el('div', { class: 'record-item__meta' });
    renderInfo.meta.forEach((m) => meta.appendChild(el('span', {}, [m])));
    main.appendChild(meta);
  }
  item.appendChild(main);

  if (renderInfo.value) {
    const v = el('div', { class: 'record-item__value' }, [renderInfo.value]);
    if (renderInfo.unit) v.appendChild(el('small', {}, [` ${renderInfo.unit}`]));
    item.appendChild(v);
  } else {
    item.appendChild(el('div'));
  }

  const actions = el('div', { class: 'record-item__actions' });
  const editBtn = el('button', { class: 'record-item__action', type: 'button', title: 'ویرایش' }, ['✎']);
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); openSubjectModal(subj.key, ctx, row); });
  const delBtn = el('button', { class: 'record-item__action record-item__action--danger', type: 'button', title: 'حذف' }, ['🗑']);
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await openConfirm({ title: `حذف ${subj.singular}`, text: 'آیا مطمئن هستید؟', type: 'danger', confirmText: 'حذف' });
    if (!ok) return;
    await db.remove(subj.table, row.id);
    toast.success('حذف شد');
    ctx.refresh();
  });
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  item.appendChild(actions);

  return item;
}

/* =========================================================================
   مودال: ثبت/ویرایش آیتم غذایی
   ========================================================================= */

export function openFoodModal(mealType, ctx, existing = null) {
  const meal = MEALS.find((m) => m.key === mealType) || MEALS[0];

  const form = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });

  // 1. Autocomplete
  const foodField = el('div', { class: 'field' });
  foodField.appendChild(el('label', { class: 'field__label' }, ['نام غذا ', el('span', { class: 'req' }, ['*'])]));
  const acWrap = el('div', { class: 'autocomplete' });
  const acInput = el('input', { class: 'field__input', type: 'text', value: existing?.food_name || '' });
  acWrap.appendChild(acInput);
  foodField.appendChild(acWrap);
  form.appendChild(foodField);

  let selectedFood = existing ? {
    name: existing.food_name,
    nameEn: existing.food_name_en,
    calories: existing.calories,
    protein: existing.protein,
    carbs: existing.carbs,
    fat: existing.fat,
    fiber: existing.fiber,
    sugar: existing.sugar,
    _existing: true,
  } : null;

  // 2. Quantity + unit
  const qtyRow = el('div', { class: 'form-row' });
  const qtyField = el('div', { class: 'field' });
  qtyField.appendChild(el('label', { class: 'field__label' }, ['مقدار']));
  const qtyInput = el('input', { class: 'field__input', type: 'number', value: existing?.quantity ?? 1, step: '0.5', min: '0' });
  qtyField.appendChild(qtyInput);
  qtyRow.appendChild(qtyField);

  const unitField = el('div', { class: 'field' });
  unitField.appendChild(el('label', { class: 'field__label' }, ['واحد']));
  const unitSelect = el('select', { class: 'field__select' });
  ['واحد', 'گرم', 'میلی‌لیتر', 'قاشق', 'پیمانه', 'کف دست'].forEach((u) => {
    const o = el('option', { value: u === 'واحد' ? 'serving' : u }, [u]);
    if ((existing?.unit || 'serving') === o.value) o.selected = true;
    unitSelect.appendChild(o);
  });
  unitField.appendChild(unitSelect);
  qtyRow.appendChild(unitField);
  form.appendChild(qtyRow);

  // 3. Nutrition preview
  const previewBox = el('div', { class: 'fieldset' });
  previewBox.appendChild(el('div', { class: 'fieldset__legend' }, ['ارزش غذایی (تقریبی)']));
  const previewGrid = el('div', { class: 'info-list' });
  previewBox.appendChild(previewGrid);
  form.appendChild(previewBox);

  // 4. Time
  const timeField = el('div', { class: 'field' });
  timeField.appendChild(el('label', { class: 'field__label' }, ['ساعت']));
  const timeInput = el('input', { class: 'field__input', type: 'time', value: existing?.entry_time || nowTime() });
  timeField.appendChild(timeInput);
  form.appendChild(timeField);

  // 5. Notes
  const notesField = el('div', { class: 'field' });
  notesField.appendChild(el('label', { class: 'field__label' }, ['یادداشت']));
  const notesInput = el('textarea', { class: 'field__textarea', rows: 2, placeholder: 'اختیاری' });
  notesInput.value = existing?.notes || '';
  notesField.appendChild(notesInput);
  form.appendChild(notesField);

  // Autocomplete
  const ac = createAutocomplete({
    input: acInput,
    onSelect: (food) => {
      selectedFood = food;
      updatePreview();
      qtyInput.focus();
    },
  });

  function computeCurrent() {
    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    if (selectedFood._existing) {
      // حالت ویرایش
      return {
        calories: selectedFood.calories,
        protein: selectedFood.protein,
        carbs: selectedFood.carbs,
        fat: selectedFood.fat,
        fiber: selectedFood.fiber,
        sugar: selectedFood.sugar,
      };
    }
    return computeNutrients(selectedFood, Number(qtyInput.value) || 0);
  }

  function updatePreview() {
    const c = computeCurrent();
    clear(previewGrid);
    const items = [
      ['کالری', formatNumber(c.calories), 'کیلوکالری'],
      ['پروتئین', formatNumber(c.protein, { decimals: 1 }), 'گرم'],
      ['کربوهیدرات', formatNumber(c.carbs, { decimals: 1 }), 'گرم'],
      ['چربی', formatNumber(c.fat, { decimals: 1 }), 'گرم'],
      ['فیبر', formatNumber(c.fiber, { decimals: 1 }), 'گرم'],
    ];
    for (const [label, value, unit] of items) {
      const it = el('div', { class: 'info-item' });
      it.appendChild(el('span', { class: 'info-item__label' }, [label]));
      it.appendChild(el('span', { class: 'info-item__value' }, [`${value} ${unit}`]));
      previewGrid.appendChild(it);
    }
  }

  qtyInput.addEventListener('input', updatePreview);
  updatePreview();

  openModal({
    title: existing ? `ویرایش آیتم در ${meal.title}` : `افزودن به ${meal.title}`,
    subtitle: `${weekdayName(ctx.date)} · ${formatJalali(ctx.date)}`,
    icon: meal.icon,
    size: 'md',
    body: form,
    footer: (close) => {
      const wrap = el('div', { class: 'flex gap-2', style: { width: '100%', justifyContent: 'flex-end' } });
      const cancel = el('button', { class: 'btn btn--ghost', type: 'button' }, ['انصراف']);
      cancel.addEventListener('click', close);

      const save = el('button', { class: 'btn btn--primary', type: 'button' }, [existing ? 'ذخیره تغییرات' : 'افزودن']);
      save.addEventListener('click', async () => {
        const qty = Number(qtyInput.value) || 0;
        const name = acInput.value.trim();
        if (!name) { toast.warning('نام غذا را وارد کنید'); return; }
        if (qty <= 0) { toast.warning('مقدار باید بزرگتر از صفر باشد'); return; }

        let values;
        if (selectedFood?._existing) {
          values = {
            quantity: qty,
            unit: unitSelect.value,
            entry_time: timeInput.value,
            notes: notesInput.value.trim() || null,
          };
        } else {
          const c = computeCurrent();
          values = {
            food_name: selectedFood?.name || name,
            food_name_en: selectedFood?.nameEn || null,
            quantity: qty,
            unit: unitSelect.value,
            calories: c.calories,
            protein: c.protein,
            carbs: c.carbs,
            fat: c.fat,
            fiber: c.fiber,
            sugar: c.sugar,
            entry_time: timeInput.value,
            notes: notesInput.value.trim() || null,
          };
        }

        try {
          save.classList.add('is-loading');
          if (existing) {
            await db.update('meals', existing.id, values);
            toast.success('ذخیره شد');
          } else {
            await db.insert('meals', { ...values, meal_type: meal.key, entry_date: ctx.date });
            toast.success('ثبت شد', `${values.food_name} به ${meal.title} افزوده شد.`);
          }
          close();
          ctx.refresh();
        } catch (e) {
          console.error(e);
          toast.error('خطا', e.message || 'ذخیره نشد.');
          save.classList.remove('is-loading');
        }
      });
      wrap.appendChild(cancel);
      wrap.appendChild(save);
      return wrap;
    },
  });

  requestAnimationFrame(() => ac.focus());
}

/* =========================================================================
   مودال: ثبت/ویرایش موضوع
   ========================================================================= */

export function openSubjectModal(subjectKey, ctx, existing = null) {
  const subj = SUBJECTS[subjectKey];
  if (!subj) return;

  const form = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
  const inputs = {};

  for (const f of subj.fields) {
    const wrapper = el('div', { class: 'field' });
    wrapper.appendChild(el('label', { class: 'field__label' }, [
      f.label,
      f.required ? el('span', { class: 'req' }, [' *']) : null,
    ].filter(Boolean)));

    let input;
    if (f.type === 'select') {
      input = el('select', { class: 'field__select', name: f.key });
      input.appendChild(el('option', { value: '' }, ['— انتخاب —']));
      for (const o of f.options || []) {
        const opt = el('option', { value: o.key }, [`${o.icon || ''} ${o.title}`.trim()]);
        if (existing?.[f.key] === o.key || (!existing && f.default === o.key)) opt.selected = true;
        input.appendChild(opt);
      }
    } else if (f.type === 'textarea') {
      input = el('textarea', { class: 'field__textarea', name: f.key, rows: f.rows || 3, placeholder: f.placeholder || '' });
      input.value = existing?.[f.key] || '';
    } else if (f.type === 'tags') {
      input = el('div', { class: 'chips' });
      const currentTags = existing?.[f.key] || [];
      for (const tag of f.options || []) {
        const chip = el('button', {
          class: `chip ${currentTags.includes(tag) ? 'is-active' : ''}`,
          type: 'button',
        }, [tag]);
        chip.addEventListener('click', () => {
          chip.classList.toggle('is-active');
        });
        input.appendChild(chip);
      }
    } else {
      input = el('input', {
        class: 'field__input',
        type: f.type,
        name: f.key,
        placeholder: f.placeholder || '',
        min: f.min,
        max: f.max,
        step: f.step,
        maxlength: f.maxLength,
      });
      const def = typeof f.default === 'function' ? f.default() : f.default;
      input.value = existing?.[f.key] ?? def ?? '';
    }

    wrapper.appendChild(input);
    const err = el('span', { class: 'field__error' });
    wrapper.appendChild(err);
    form.appendChild(wrapper);
    inputs[f.key] = input;
  }

  openModal({
    title: existing ? `ویرایش ${subj.singular}` : `افزودن ${subj.singular}`,
    subtitle: `${weekdayName(ctx.date)} · ${formatJalali(ctx.date)}`,
    icon: subj.icon,
    size: 'md',
    body: form,
    footer: (close) => {
      const wrap = el('div', { class: 'flex gap-2', style: { width: '100%', justifyContent: 'flex-end' } });
      const cancel = el('button', { class: 'btn btn--ghost', type: 'button' }, ['انصراف']);
      cancel.addEventListener('click', close);

      const save = el('button', { class: 'btn btn--primary', type: 'button' }, [existing ? 'ذخیره' : 'افزودن']);
      save.addEventListener('click', async () => {
        const values = {};
        for (const f of subj.fields) {
          const inp = inputs[f.key];
          if (f.type === 'tags') {
            values[f.key] = Array.from(inp.querySelectorAll('.chip.is-active')).map((c) => c.textContent.trim());
          } else {
            const v = inp.value;
            if (f.type === 'number') {
              values[f.key] = v === '' ? null : Number(v);
            } else {
              values[f.key] = v === '' ? null : v;
            }
          }
        }
        // اعتبارسنجی
        for (const f of subj.fields) {
          if (f.required && (values[f.key] == null || values[f.key] === '')) {
            toast.warning(`${f.label} الزامی است`);
            return;
          }
        }
        const finalValues = subj.beforeSave ? subj.beforeSave(values) : values;

        try {
          save.classList.add('is-loading');
          if (existing) {
            await db.update(subj.table, existing.id, finalValues);
            toast.success('ذخیره شد');
          } else {
            await db.insert(subj.table, { ...finalValues, entry_date: ctx.date });
            toast.success('ثبت شد', `${subj.singular} جدید اضافه شد.`);
          }
          close();
          ctx.refresh();
        } catch (e) {
          console.error(e);
          toast.error('خطا', e.message || 'ذخیره نشد.');
          save.classList.remove('is-loading');
        }
      });
      wrap.appendChild(cancel);
      wrap.appendChild(save);
      return wrap;
    },
  });
}

/* =========================================================================
   Skeleton / Error helpers
   ========================================================================= */

export function renderSkeleton(container, kind) {
  const wrap = el('div', { class: 'skeleton-page' });
  wrap.appendChild(el('div', { class: 'skeleton skeleton--title' }));
  for (let i = 0; i < (kind === 'daily' ? 3 : 5); i++) {
    const row = el('div', { class: 'skeleton-row' });
    row.appendChild(el('div', { class: 'skeleton skeleton--thumb' }));
    const body = el('div', { class: 'skeleton-row__body' });
    body.appendChild(el('div', { class: 'skeleton skeleton--text', style: { width: '60%' } }));
    body.appendChild(el('div', { class: 'skeleton skeleton--text', style: { width: '40%' } }));
    row.appendChild(body);
    wrap.appendChild(row);
  }
  container.appendChild(wrap);
}

function buildErrorState(retry) {
  const wrap = el('div', { class: 'empty-state' });
  wrap.appendChild(el('div', { class: 'empty-state__icon' }, ['⚠️']));
  wrap.appendChild(el('div', { class: 'empty-state__title' }, ['بارگذاری ناموفق']));
  wrap.appendChild(el('div', { class: 'empty-state__text' }, ['اتصال اینترنت یا تنظیمات Supabase را بررسی کنید.']));
  const retryBtn = el('button', { class: 'btn btn--primary btn--sm', type: 'button' }, ['تلاش دوباره']);
  retryBtn.addEventListener('click', retry);
  wrap.appendChild(retryBtn);
  return wrap;
}

function buildEmptyState(icon, title, text) {
  const wrap = el('div', { class: 'empty-state' });
  wrap.appendChild(el('div', { class: 'empty-state__icon' }, [icon]));
  wrap.appendChild(el('div', { class: 'empty-state__title' }, [title]));
  if (text) wrap.appendChild(el('div', { class: 'empty-state__text' }, [text]));
  return wrap;
}

/* ---------- route helper ---------- */

export function subjRoute(key) {
  return {
    insulin: 'insulin',
    glucose: 'glucose',
    bloodPressure: 'blood-pressure',
    weight: 'weight',
    sleep: 'sleep',
    exercise: 'exercise',
    otherNotes: 'other',
  }[key] || 'dashboard';
}

export function routeToSubjectKey(page) {
  return {
    insulin: 'insulin',
    glucose: 'glucose',
    'blood-pressure': 'bloodPressure',
    weight: 'weight',
    sleep: 'sleep',
    exercise: 'exercise',
    other: 'otherNotes',
  }[page] || null;
}