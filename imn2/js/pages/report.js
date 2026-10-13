/**
 * report.js — صفحه گزارش جامع (روزانه / هفتگی / ماهانه)
 * شامل: KPI، نمودار خطی، میله‌ای، دونات، تایم‌لاین، هیتمپ، تقویم ماهانه، مقایسه
 */

import { $, el, clear, svg, escapeHtml } from '../utils/dom.js';
import { toast } from '../components/toast.js';
import { formatNumber, toFaDigits, formatTime } from '../utils/format.js';
import {
  todayISO, weekdayName, formatJalali, addDays,
  startOfWeek, endOfWeek, startOfJalaliMonth, endOfJalaliMonth,
  isoToJalali, jalaliToISO, jalaliMonthMatrix, JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT, enumerateDays, isToday, diffDays,
} from '../utils/date.js';
import { weeklySummary, monthlySummary, rangeSummary, dailyAll } from '../services/stats.service.js';
import { MEALS, CHART_COLORS, REPORT_PERIODS } from '../config/constants.js';

/* =========================================================================
   Entry
   ========================================================================= */

export async function renderReport(container, ctx) {
  // وضعیت داخلی
  const state = {
    period: 'daily',
    anchor: ctx.date,
  };

  function rerender() {
    clear(container);
    container.appendChild(buildRangeBar(state, rerender, ctx));
    loadAndRender(container, state, ctx, rerender);
  }

  rerender();
}

/* =========================================================================
   Range bar
   ========================================================================= */

function buildRangeBar(state, onChange, ctx) {
  const bar = el('div', { class: 'report-range' });

  const tabs = el('div', { class: 'report-range__tabs' });
  for (const p of REPORT_PERIODS) {
    const t = el('button', {
      class: `btn btn--sm ${state.period === p.key ? 'btn--primary' : 'btn--outline'}`,
      type: 'button',
    }, [`${p.icon} ${p.title}`]);
    t.addEventListener('click', () => { state.period = p.key; onChange(); });
    tabs.appendChild(t);
  }
  bar.appendChild(tabs);

  const nav = el('div', { class: 'report-range__nav' });
  const prev = el('button', { class: 'btn btn--ghost btn--icon-only', type: 'button', 'aria-label': 'قبلی' }, ['‹']);
  prev.addEventListener('click', () => { state.anchor = shiftPeriod(state.anchor, state.period, -1); onChange(); });

  const label = el('div', { class: 'report-range__label' }, [periodLabel(state.anchor, state.period)]);

  const next = el('button', { class: 'btn btn--ghost btn--icon-only', type: 'button', 'aria-label': 'بعدی' }, ['›']);
  next.addEventListener('click', () => { state.anchor = shiftPeriod(state.anchor, state.period, 1); onChange(); });
  if (state.period !== 'daily' && !canGoForward(state.anchor, state.period)) next.disabled = true;

  nav.appendChild(prev);
  nav.appendChild(label);
  nav.appendChild(next);
  bar.appendChild(nav);

  const exportBar = el('div', { class: 'report-actions-bar' });
  const printBtn = el('button', { class: 'btn btn--outline btn--sm', type: 'button' }, ['🖨 چاپ']);
  printBtn.addEventListener('click', () => window.print());
  const csvBtn = el('button', { class: 'btn btn--outline btn--sm', type: 'button' }, ['⬇ خروجی CSV']);
  csvBtn.addEventListener('click', () => exportCsv(state, ctx));
  exportBar.appendChild(printBtn);
  exportBar.appendChild(csvBtn);
  bar.appendChild(exportBar);

  return bar;
}

function shiftPeriod(anchor, period, dir) {
  if (period === 'daily') return addDays(new Date(anchor), dir).toISOString().slice(0, 10);
  if (period === 'weekly') return addDays(new Date(anchor), dir * 7).toISOString().slice(0, 10);
  // monthly: جابجایی یک ماه
  const { jy, jm } = isoToJalali(anchor);
  let nm = jm + dir, ny = jy;
  if (nm > 12) { nm = 1; ny++; }
  if (nm < 1) { nm = 12; ny--; }
  return jalaliToISO(ny, nm, 1);
}

function canGoForward(anchor, period) {
  const today = todayISO();
  if (period === 'daily') return anchor < today;
  if (period === 'weekly') return endOfWeek(anchor) < today;
  return endOfJalaliMonth(anchor) < today;
}

function periodLabel(anchor, period) {
  if (period === 'daily') {
    return `${weekdayName(anchor)} · ${formatJalali(anchor)}`;
  }
  if (period === 'weekly') {
    const s = startOfWeek(anchor);
    const e = endOfWeek(anchor);
    return `${formatJalali(s, { short: true })} تا ${formatJalali(e, { short: true })}`;
  }
  const { jy, jm } = isoToJalali(anchor);
  return `${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`;
}

/* =========================================================================
   Load + render
   ========================================================================= */

async function loadAndRender(container, state, ctx, rerender) {
  const skel = el('div', { class: 'skeleton-page' });
  skel.appendChild(el('div', { class: 'skeleton skeleton--chart' }));
  skel.appendChild(el('div', { class: 'skeleton skeleton--chart' }));
  container.appendChild(skel);

  try {
    let data;
    if (state.period === 'daily') {
      const day = await dailyAll(state.anchor);
      data = { period: 'daily', day, anchor: state.anchor };
    } else if (state.period === 'weekly') {
      data = await weeklySummary(state.anchor);
    } else {
      data = await monthlySummary(state.anchor);
    }
    skel.remove();
    renderReportBody(container, data, state, ctx, rerender);
  } catch (e) {
    console.error(e);
    skel.remove();
    const err = el('div', { class: 'empty-state' });
    err.appendChild(el('div', { class: 'empty-state__icon' }, ['⚠️']));
    err.appendChild(el('div', { class: 'empty-state__title' }, ['بارگذاری گزارش ناموفق']));
    container.appendChild(err);
  }
}

function renderReportBody(container, data, state, ctx, rerender) {
  const page = el('div', { class: 'report-page' });

  if (state.period === 'daily') {
    renderDailyReport(page, data, ctx);
  } else {
    renderRangeReport(page, data, state, ctx);
  }
  container.appendChild(page);
}

/* =========================================================================
   گزارش روزانه
   ========================================================================= */

function renderDailyReport(page, { day }, ctx) {
  const s = day.summary;

  // KPIs
  const kpis = el('div', { class: 'report-kpis' });
  kpis.appendChild(kpi('🔥 کالری', formatNumber(s.totalKcal), 'کیلوکالری', 'amber'));
  kpis.appendChild(kpi('💉 انسولین', formatNumber(s.insulinTotal, { decimals: 1 }), 'واحد', 'violet'));
  kpis.appendChild(kpi('🩸 قند', s.glucoseAvg != null ? formatNumber(s.glucoseAvg) : '—', s.glucoseCount ? `${toFaDigits(s.glucoseCount)} بار` : '', 'red'));
  kpis.appendChild(kpi('❤️ فشار', s.bpAvgSys ? `${toFaDigits(Math.round(s.bpAvgSys))}/${toFaDigits(Math.round(s.bpAvgDia))}` : '—', s.bpCount ? 'mmHg' : '', 'pink'));
  kpis.appendChild(kpi('🌙 خواب', s.sleepMin ? `${formatNumber(Math.floor(s.sleepMin / 60))}:${toFaDigits(String(s.sleepMin % 60).padStart(2, '0'))}` : '—', 'ساعت', 'green'));
  kpis.appendChild(kpi('🏃 ورزش', s.exerciseKm ? formatNumber(s.exerciseKm, { decimals: 2 }) : formatNumber(s.exerciseMin), s.exerciseKm ? 'کیلومتر' : 'دقیقه', 'teal'));
  page.appendChild(kpis);

  // Grid
  const grid = el('div', { class: 'report-grid' });

  // Timeline (روزانه)
  const timelineCard = el('div', { class: 'report-block col-8' });
  timelineCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['⏱']),
      'تایم‌لاین روز',
    ]),
  ]));
  timelineCard.appendChild(buildTimeline(day));
  grid.appendChild(timelineCard);

  // Donut (meal distribution)
  const donutCard = el('div', { class: 'report-block col-4' });
  donutCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['🥧']),
      'توزیع کالری وعده‌ها',
    ]),
  ]));
  donutCard.appendChild(buildMealDistribution(day));
  grid.appendChild(donutCard);

  // Nutrient bars
  const barsCard = el('div', { class: 'report-block col-12' });
  barsCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['📊']),
      'درشت‌مغذی‌ها',
    ]),
  ]));
  barsCard.appendChild(buildNutrientBars(s));
  grid.appendChild(barsCard);

  page.appendChild(grid);
}

function buildTimeline(day) {
  const items = [];
  const push = (entry_time, kind, title, meta) => {
    if (!entry_time) return;
    items.push({ entry_time, kind, title, meta });
  };

  day.meals.forEach((m) => push(m.entry_time, 'food', `🍽 ${m.food_name}`, [`${formatNumber(m.calories)} kcal`, m.meal_type && mealTitle(m.meal_type)]));
  day.insulin.forEach((r) => push(r.entry_time, 'insulin', `💉 انسولین (${r.units} واحد)`, [r.brand, r.injection_site]));
  day.glucose.forEach((r) => push(r.entry_time, 'glucose', `🩸 قند خون: ${formatNumber(r.value_mgdl)} mg/dL`, [r.context]));
  day.bloodPressure.forEach((r) => push(r.entry_time, 'pressure', `❤️ فشار: ${r.systolic}/${r.diastolic}`, [r.pulse ? `ضربان ${r.pulse}` : null]));
  day.weight.forEach((r) => push(r.entry_time, 'weight', `⚖️ وزن: ${r.weight_kg} kg`, []));
  day.sleep.forEach((r) => push(r.wake_time, 'sleep', `🌙 بیداری از خواب`, [`خواب ${formatTime(r.sleep_time)}`]));
  day.exercise.forEach((r) => push(r.entry_time, 'exercise', `🏃 ${r.activity_type}`, [`${r.duration_minutes} دقیقه`, r.distance_km ? `${r.distance_km} km` : null]));

  items.sort((a, b) => String(a.entry_time).localeCompare(String(b.entry_time)));

  const wrap = el('div', { class: 'report-timeline' });
  if (!items.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__icon' }, ['📭']),
      el('div', { class: 'empty-state__title' }, ['داده‌ای برای نمایش نیست']),
    ]));
    return wrap;
  }

  for (const it of items) {
    const row = el('div', { class: 'timeline-item', 'data-kind': it.kind });
    row.appendChild(el('div', { class: 'timeline-item__time' }, [formatTime(it.entry_time)]));
    const body = el('div', { class: 'timeline-item__body' });
    body.appendChild(el('div', { class: 'timeline-item__title' }, [it.title]));
    if (it.meta?.filter(Boolean).length) {
      const meta = el('div', { class: 'timeline-item__meta' });
      it.meta.filter(Boolean).forEach((m) => meta.appendChild(el('span', {}, [m])));
      body.appendChild(meta);
    }
    row.appendChild(body);
    wrap.appendChild(row);
  }
  return wrap;
}

function buildMealDistribution(day) {
  const totals = MEALS.map((m) => ({
    label: m.title,
    color: MEALS.indexOf(m) % 2 === 0 ? '#22d3ee' : '#a855f7',
    value: day.meals.filter((x) => x.meal_type === m.key).reduce((s, x) => s + (Number(x.calories) || 0), 0),
  })).filter((x) => x.value > 0);

  if (!totals.length) {
    return el('div', { class: 'empty-state' }, [el('div', { class: 'empty-state__icon' }, ['🥧']), el('div', {}, ['داده‌ای نیست'])]);
  }
  return donutChart(totals);
}

function buildNutrientBars(s) {
  const wrap = el('div', { class: 'nutrient-bars' });
  const rows = [
    ['پروتئین', s.totalProtein, 100, '#a855f7'],
    ['کربوهیدرات', s.totalCarbs, 250, '#22d3ee'],
    ['چربی', s.totalFat, 65, '#f59e0b'],
    ['فیبر', s.totalFiber, 25, '#10b981'],
  ];
  for (const [label, value, target, color] of rows) {
    const row = el('div', { class: 'nutrient-row' });
    row.appendChild(el('div', { class: 'nutrient-row__label' }, [label]));
    const pct = Math.min(100, Math.round((value / target) * 100)) || 0;
    const bar = el('div', { class: 'progress progress--sm nutrient-row__bar' });
    const inner = el('div', { class: 'progress__bar', style: { width: `${pct}%`, background: color } });
    bar.appendChild(inner);
    row.appendChild(bar);
    row.appendChild(el('div', { class: 'nutrient-row__value' }, [`${formatNumber(value, { decimals: 1 })} / ${toFaDigits(target)}`]));
    wrap.appendChild(row);
  }
  return wrap;
}

/* =========================================================================
   گزارش بازه‌ای (هفتگی/ماهانه)
   ========================================================================= */

function renderRangeReport(page, data, state, ctx) {
  const { from, to, dailySeries, totals, avgPerDay, daysCount, period } = data;

  // KPI row
  const kpis = el('div', { class: 'report-kpis' });
  kpis.appendChild(kpi('🔥 مجموع کالری', formatNumber(totals.kcal), 'کیلوکالری', 'amber'));
  kpis.appendChild(kpi('📅 میانگین روزانه', avgPerDay ? formatNumber(avgPerDay.kcal) : '—', 'کیلوکالری', 'cyan'));
  kpis.appendChild(kpi('💉 مجموع انسولین', formatNumber(totals.insulin, { decimals: 1 }), 'واحد', 'violet'));
  kpis.appendChild(kpi('🏃 مجموع ورزش', formatNumber(Math.round(totals.exerciseMin)), 'دقیقه', 'green'));
  kpis.appendChild(kpi('🌙 میانگین خواب', avgPerDay ? formatNumber(Math.round(avgPerDay.sleepMin)) : '—', 'دقیقه', 'pink'));
  kpis.appendChild(kpi('📆 روزهای فعال', toFaDigits(daysCount), 'روز', 'teal'));
  page.appendChild(kpis);

  const grid = el('div', { class: 'report-grid' });

  // Line chart: کالری روزانه
  const lineCard = el('div', { class: 'report-block col-12' });
  lineCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['📈']),
      'کالری روزانه',
    ]),
  ]));
  lineCard.appendChild(buildKcalLineChart(dailySeries));
  grid.appendChild(lineCard);

  // Bar chart: پروتئین/کربو/چربی
  const barCard = el('div', { class: 'report-block col-8' });
  barCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['📊']),
      'درشت‌مغذی‌ها',
    ]),
  ]));
  barCard.appendChild(buildMacroBarChart(dailySeries));
  grid.appendChild(barCard);

  // Donut: توزیع وعده‌ها
  const donutCard = el('div', { class: 'report-block col-4' });
  donutCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['🥧']),
      'توزیع کالری',
    ]),
  ]));
  donutCard.appendChild(buildDistributionByMeal(data.raw.meals));
  grid.appendChild(donutCard);

  // Heatmap (هفتگی) یا تقویم (ماهانه)
  if (period === 'weekly') {
    const hmCard = el('div', { class: 'report-block col-12' });
    hmCard.appendChild(el('div', { class: 'report-block__header' }, [
      el('div', { class: 'report-block__title' }, [
        el('span', { class: 'report-block__icon' }, ['🗓']),
        'نمای هفته',
      ]),
    ]));
    hmCard.appendChild(buildWeeklyHeatmap(dailySeries));
    grid.appendChild(hmCard);
  } else {
    const calCard = el('div', { class: 'report-block col-12' });
    calCard.appendChild(el('div', { class: 'report-block__header' }, [
      el('div', { class: 'report-block__title' }, [
        el('span', { class: 'report-block__icon' }, ['🗓']),
        'تقویم ماه',
      ]),
    ]));
    calCard.appendChild(buildMonthlyCalendar(state.anchor, data));
    grid.appendChild(calCard);
  }

  // Comparison table
  const cmpCard = el('div', { class: 'report-block col-12' });
  cmpCard.appendChild(el('div', { class: 'report-block__header' }, [
    el('div', { class: 'report-block__title' }, [
      el('span', { class: 'report-block__icon' }, ['⚖️']),
      'خلاصه آماری',
    ]),
  ]));
  cmpCard.appendChild(buildComparison(data));
  grid.appendChild(cmpCard);

  page.appendChild(grid);
}

/* =========================================================================
   Charts
   ========================================================================= */

function buildKcalLineChart(series) {
  const values = series.map((d) => d.totalKcal || 0);
  const labels = series.map((d) => {
    const { jd } = isoToJalali(d.date);
    return toFaDigits(jd);
  });
  return lineChart({
    values,
    labels,
    color: '#22d3ee',
    height: 240,
    yLabel: 'kcal',
  });
}

function buildMacroBarChart(series) {
  const labels = series.map((d) => toFaDigits(isoToJalali(d.date).jd));
  const macros = [
    { name: 'پروتئین', color: '#a855f7', values: series.map((d) => d.totalProtein || 0) },
    { name: 'کربوهیدرات', color: '#22d3ee', values: series.map((d) => d.totalCarbs || 0) },
    { name: 'چربی', color: '#f59e0b', values: series.map((d) => d.totalFat || 0) },
  ];
  return stackedBarChart({ labels, series: macros, height: 240 });
}

function buildDistributionByMeal(meals) {
  const totals = MEALS.map((m, i) => ({
    label: m.title,
    color: CHART_COLORS[i],
    value: meals.filter((x) => x.meal_type === m.key).reduce((s, x) => s + (Number(x.calories) || 0), 0),
  })).filter((x) => x.value > 0);

  if (!totals.length) {
    return el('div', { class: 'empty-state' }, [el('div', { class: 'empty-state__icon' }, ['🥧']), el('div', {}, ['داده‌ای نیست'])]);
  }
  return donutChart(totals);
}

function buildWeeklyHeatmap(series) {
  const wrap = el('div', { class: 'weekly-heatmap' });
  const maxKcal = Math.max(1, ...series.map((d) => d.totalKcal));
  for (const d of series) {
    const col = el('div', { class: 'weekly-heatmap__day' });
    col.appendChild(el('div', { class: 'weekly-heatmap__label' }, [weekdayName(d.date).slice(0, 3)]));
    const level = d.totalKcal === 0 ? 0 : Math.ceil((d.totalKcal / maxKcal) * 4);
    const cell = el('div', {
      class: `weekly-heatmap__cell ${isToday(d.date) ? 'is-today' : ''}`,
      'data-level': level,
      title: `${formatJalali(d.date)} · ${formatNumber(d.totalKcal)} kcal`,
    }, [toFaDigits(isoToJalali(d.date).jd)]);
    col.appendChild(cell);
    wrap.appendChild(col);
  }
  return wrap;
}

function buildMonthlyCalendar(anchor, data) {
  const { jy, jm } = isoToJalali(anchor);
  const wrap = el('div');

  const weekdays = el('div', { class: 'monthly-weekdays' });
  JALALI_WEEKDAYS_SHORT.forEach((d) => weekdays.appendChild(el('span', {}, [d])));
  wrap.appendChild(weekdays);

  const grid = el('div', { class: 'monthly-grid' });
  const cells = jalaliMonthMatrix(jy, jm);
  const byDate = new Map(data.dailySeries.map((d) => [d.date, d]));

  for (const c of cells) {
    const day = byDate.get(c.iso);
    const cell = el('div', {
      class: `monthly-cell ${c.isOutside ? 'is-outside' : ''} ${isToday(c.iso) ? 'is-today' : ''}`,
      title: formatJalali(c.iso),
    });
    cell.appendChild(el('div', { class: 'monthly-cell__num' }, [toFaDigits(c.jd)]));
    const dots = el('div', { class: 'monthly-cell__dots' });
    if (day) {
      if (day.mealsCount > 0)   dots.appendChild(el('span', { class: 'monthly-cell__dot', 'data-k': 'food' }));
      if (day.insulinCount > 0) dots.appendChild(el('span', { class: 'monthly-cell__dot', 'data-k': 'insulin' }));
      if (day.glucoseCount > 0) dots.appendChild(el('span', { class: 'monthly-cell__dot', 'data-k': 'glucose' }));
      if (day.bpCount > 0)      dots.appendChild(el('span', { class: 'monthly-cell__dot', 'data-k': 'pressure' }));
      if (day.exerciseCount > 0)dots.appendChild(el('span', { class: 'monthly-cell__dot', 'data-k': 'exercise' }));
      if (day.sleepCount > 0)   dots.appendChild(el('span', { class: 'monthly-cell__dot', 'data-k': 'sleep' }));
    }
    cell.appendChild(dots);
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  return wrap;
}

function buildComparison(data) {
  const { totals, avgPerDay, daysCount, dailySeries } = data;
  const rows = [
    ['مجموع کالری', formatNumber(totals.kcal), 'کیلوکالری'],
    ['میانگین کالری روزانه', avgPerDay ? formatNumber(avgPerDay.kcal) : '—', 'کیلوکالری'],
    ['مجموع پروتئین', formatNumber(totals.protein, { decimals: 1 }), 'گرم'],
    ['مجموع کربوهیدرات', formatNumber(totals.carbs, { decimals: 1 }), 'گرم'],
    ['مجموع چربی', formatNumber(totals.fat, { decimals: 1 }), 'گرم'],
    ['مجموع فیبر', formatNumber(totals.fiber, { decimals: 1 }), 'گرم'],
    ['مجموع انسولین', formatNumber(totals.insulin, { decimals: 1 }), 'واحد'],
    ['مجموع ورزش', formatNumber(Math.round(totals.exerciseMin)), 'دقیقه'],
    ['مجموع مسافت', formatNumber(totals.exerciseKm, { decimals: 2 }), 'کیلومتر'],
    ['میانگین خواب', avgPerDay ? formatNumber(Math.round(avgPerDay.sleepMin)) : '—', 'دقیقه'],
    ['تعداد روزهای دارای داده', toFaDigits(daysCount), 'روز'],
  ];
  const list = el('div', { class: 'compare-list' });
  for (const [label, val, unit] of rows) {
    const row = el('div', { class: 'compare-row' });
    row.appendChild(el('div', { class: 'compare-row__label' }, [label]));
    row.appendChild(el('div', { class: 'compare-row__val' }, [val]));
    row.appendChild(el('div', { class: 'compare-row__avg' }, [unit]));
    list.appendChild(row);
  }
  return list;
}

/* =========================================================================
   SVG Generators
   ========================================================================= */

function lineChart({ values, labels, color = '#22d3ee', height = 220, yLabel = '' }) {
  const W = 640, H = height;
  const pad = { top: 20, right: 44, bottom: 30, left: 12 };
  const w = W - pad.left - pad.right;
  const h = H - pad.top - pad.bottom;
  const maxV = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;

  const points = values.map((v, i) => [pad.left + i * step, pad.top + h - (v / maxV) * h]);
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');

  const wrap = el('div', { class: 'chart__canvas' });
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', preserveAspectRatio: 'none', style: { height: `${height}px` } });

  // Grid lines
  const grid = svg('g', { class: 'chart__grid' });
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (h * i / 4);
    grid.appendChild(svg('line', { x1: pad.left, x2: W - pad.right, y1: y, y2: y }));
  }
  s.appendChild(grid);

  // Y-axis labels
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (h * i / 4);
    const val = Math.round(maxV * (1 - i / 4));
    s.appendChild(svg('text', { x: W - pad.right + 6, y: y + 4, fill: 'currentColor', style: { fill: 'var(--text-tertiary)', fontSize: '10px' } }, [toFaDigits(val)]));
  }

  // Area
  const areaPath = `${path} L${pad.left + (values.length - 1) * step},${pad.top + h} L${pad.left},${pad.top + h} Z`;
  s.appendChild(svg('path', {
    d: areaPath,
    fill: color,
    opacity: 0.15,
    class: 'chart__area',
  }));

  // Line
  s.appendChild(svg('path', {
    d: path,
    stroke: color,
    class: 'chart__line',
    'stroke-width': 2.5,
    fill: 'none',
  }));

  // Points + x labels
  points.forEach((p, i) => {
    s.appendChild(svg('circle', {
      cx: p[0], cy: p[1], r: 3, fill: color, stroke: '#fff',
      'stroke-width': 1.5, class: 'chart__point',
    }, [
      svg('title', {}, [`${labels[i]}: ${formatNumber(values[i])} ${yLabel}`]),
    ]));
    s.appendChild(svg('text', {
      x: p[0], y: H - 8,
      'text-anchor': 'middle',
      style: { fill: 'var(--text-tertiary)', fontSize: '10px' },
    }, [labels[i]]));
  });

  wrap.appendChild(s);
  return wrap;
}

function stackedBarChart({ labels, series, height = 220 }) {
  const W = 640, H = height;
  const pad = { top: 20, right: 40, bottom: 30, left: 12 };
  const w = W - pad.left - pad.right;
  const h = H - pad.top - pad.bottom;
  const n = labels.length;
  const barW = Math.max(4, (w / n) * 0.6);
  const gap = w / n;

  const totals = labels.map((_, i) => series.reduce((s, sr) => s + (sr.values[i] || 0), 0));
  const maxV = Math.max(1, ...totals);

  const wrap = el('div', { class: 'chart__canvas' });
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', preserveAspectRatio: 'none', style: { height: `${height}px` } });

  // Grid
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (h * i / 4);
    s.appendChild(svg('line', { x1: pad.left, x2: W - pad.right, y1: y, y2: y, style: { stroke: 'var(--border-subtle)', strokeDasharray: '3 5' } }));
    s.appendChild(svg('text', { x: W - pad.right + 6, y: y + 4, style: { fill: 'var(--text-tertiary)', fontSize: '10px' } }, [toFaDigits(Math.round(maxV * (1 - i / 4)))]));
  }

  labels.forEach((lbl, i) => {
    const x = pad.left + i * gap + (gap - barW) / 2;
    let yCursor = pad.top + h;
    series.forEach((sr) => {
      const val = sr.values[i] || 0;
      const barH = (val / maxV) * h;
      yCursor -= barH;
      s.appendChild(svg('rect', {
        x, y: yCursor, width: barW, height: barH,
        fill: sr.color, rx: 3, class: 'chart__bar-stack',
      }, [
        svg('title', {}, [`${lbl} — ${sr.name}: ${formatNumber(val, { decimals: 1 })} گرم`]),
      ]));
    });
    s.appendChild(svg('text', {
      x: x + barW / 2, y: H - 8, 'text-anchor': 'middle',
      style: { fill: 'var(--text-tertiary)', fontSize: '10px' },
    }, [lbl]));
  });

  wrap.appendChild(s);

  // Legend
  const legend = el('div', { class: 'chart__legend', style: { marginTop: '8px' } });
  for (const sr of series) {
    const item = el('div', { class: 'chart__legend-item' });
    item.appendChild(el('span', { class: 'chart__legend-dot', style: { background: sr.color } }));
    item.appendChild(document.createTextNode(sr.name));
    legend.appendChild(item);
  }
  const root = el('div', { class: 'chart' });
  root.appendChild(wrap);
  root.appendChild(legend);
  return root;
}

function donutChart(items) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const size = 200;
  const cx = size / 2, cy = size / 2;
  const r = 70;
  const stroke = 22;
  const circumference = 2 * Math.PI * r;

  const wrap = el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } });
  const s = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'chart__svg' });

  let offset = 0;
  for (const it of items) {
    const frac = it.value / total;
    const len = frac * circumference;
    const seg = svg('circle', {
      cx, cy, r,
      fill: 'none',
      stroke: it.color,
      'stroke-width': stroke,
      'stroke-dasharray': `${len} ${circumference - len}`,
      'stroke-dashoffset': -offset,
      transform: `rotate(-90 ${cx} ${cy})`,
      class: 'chart__donut-seg',
    }, [
      svg('title', {}, [`${it.label}: ${formatNumber(it.value)} kcal (${Math.round(frac * 100)}%)`]),
    ]);
    s.appendChild(seg);
    offset += len;
  }

  s.appendChild(svg('text', { x: cx, y: cy - 4, class: 'chart__donut-center', style: { textAnchor: 'middle' } }, [formatNumber(total)]));
  s.appendChild(svg('text', { x: cx, y: cy + 16, class: 'chart__donut-center-sub', style: { textAnchor: 'middle' } }, ['kcal']));

  wrap.appendChild(s);

  const legend = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', minWidth: '120px' } });
  for (const it of items) {
    const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' } });
    row.appendChild(el('span', { style: { width: '10px', height: '10px', borderRadius: '50%', background: it.color, flexShrink: '0' } }));
    row.appendChild(el('span', { style: { flex: '1', color: 'var(--text-secondary)' } }, [it.label]));
    row.appendChild(el('span', { style: { fontWeight: '600', color: 'var(--text-primary)' } }, [`${toFaDigits(Math.round((it.value / total) * 100))}٪`]));
    legend.appendChild(row);
  }
  wrap.appendChild(legend);

  return wrap;
}

/* =========================================================================
   Helper: KPI card
   ========================================================================= */

function kpi(label, value, unit, tone) {
  const card = el('div', { class: 'stat-card stat-card--compact', 'data-tone': tone });
  card.appendChild(el('div', { class: 'stat-card__label' }, [label]));
  const v = el('div', { class: 'stat-card__value' }, [value]);
  if (unit) v.appendChild(el('span', { class: 'stat-card__unit' }, [unit]));
  card.appendChild(v);
  return card;
}

function mealTitle(key) {
  return MEALS.find((m) => m.key === key)?.title || '';
}

/* =========================================================================
   CSV Export
   ========================================================================= */

function exportCsv(state, ctx) {
  let rows = [];
  let filename = '';

  if (state.period === 'daily') {
    filename = `report-${state.anchor}.csv`;
    rows.push(['تاریخ', formatJalali(state.anchor)]);
  } else {
    filename = `report-${state.period}-${state.anchor}.csv`;
    rows.push(['بازه', periodLabel(state.anchor, state.period)]);
  }
  rows.push([]);
  rows.push(['شاخص', 'مقدار']);

  // از داده‌های موجود در دام استفاده می‌کنیم
  const raw = ctx.__lastReportData;
  if (raw) {
    if (state.period === 'daily') {
      const s = raw.day.summary;
      rows.push(['کالری', s.totalKcal]);
      rows.push(['پروتئین', s.totalProtein]);
      rows.push(['کربوهیدرات', s.totalCarbs]);
      rows.push(['چربی', s.totalFat]);
      rows.push(['فیبر', s.totalFiber]);
      rows.push(['انسولین', s.insulinTotal]);
      rows.push(['میانگین قند', s.glucoseAvg ?? '']);
      rows.push(['ورزش (دقیقه)', s.exerciseMin]);
      rows.push(['خواب (دقیقه)', s.sleepMin]);
    } else {
      rows.push(['مجموع کالری', raw.totals.kcal]);
      rows.push(['میانگین کالری', raw.avgPerDay?.kcal ?? '']);
      rows.push(['مجموع انسولین', raw.totals.insulin]);
      rows.push(['مجموع ورزش (دقیقه)', raw.totals.exerciseMin]);
    }
  }

  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('خروجی CSV آماده شد');
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}