/**
 * stats.service.js — تجمیع و محاسبه آمار روزانه / هفتگی / ماهانه
 */

import { listByDate, listRange, TABLES } from './db.service.js';
import { enumerateDays, startOfWeek, endOfWeek, startOfJalaliMonth, endOfJalaliMonth, isoToJalali } from '../utils/date.js';

/* =========================================================================
   روزانه
   ========================================================================= */

export async function dailyAll(isoDate) {
  const [meals, insulin, glucose, bp, weight, sleep, exercise, notes] = await Promise.all([
    listByDate(TABLES.meals, isoDate),
    listByDate(TABLES.insulin, isoDate),
    listByDate(TABLES.glucose, isoDate),
    listByDate(TABLES.bloodPressure, isoDate),
    listByDate(TABLES.weight, isoDate),
    listByDate(TABLES.sleep, isoDate),
    listByDate(TABLES.exercise, isoDate),
    listByDate(TABLES.otherNotes, isoDate),
  ]);

  return {
    date: isoDate,
    meals, insulin, glucose, bloodPressure: bp,
    weight, sleep, exercise, otherNotes: notes,
    summary: summarizeDay({ meals, insulin, glucose, bloodPressure: bp, weight, sleep, exercise, otherNotes: notes }),
  };
}

/* =========================================================================
   خلاصه‌سازی روز
   ========================================================================= */

export function summarizeDay(day) {
  const totalKcal   = sum(day.meals, 'calories');
  const totalProtein= sum(day.meals, 'protein');
  const totalCarbs  = sum(day.meals, 'carbs');
  const totalFat    = sum(day.meals, 'fat');
  const totalFiber  = sum(day.meals, 'fiber');
  const totalSugar  = sum(day.meals, 'sugar');

  const insulinTotal = sum(day.insulin, 'units');

  const glucoseValues = (day.glucose || []).map((g) => Number(g.value_mgdl)).filter((n) => Number.isFinite(n));
  const glucoseAvg = avg(glucoseValues);
  const glucoseMin = glucoseValues.length ? Math.min(...glucoseValues) : null;
  const glucoseMax = glucoseValues.length ? Math.max(...glucoseValues) : null;

  const sysValues = (day.bloodPressure || []).map((b) => Number(b.systolic)).filter(Number.isFinite);
  const diaValues = (day.bloodPressure || []).map((b) => Number(b.diastolic)).filter(Number.isFinite);
  const pulseValues = (day.bloodPressure || []).map((b) => Number(b.pulse)).filter(Number.isFinite);

  const lastWeight = day.weight?.length ? Number(day.weight[day.weight.length - 1].weight_kg) : null;

  const sleepMin = (day.sleep || []).reduce((s, x) => s + (Number(x.duration_minutes) || 0), 0);
  const sleepQualities = (day.sleep || []).map((x) => Number(x.quality)).filter(Number.isFinite);
  const sleepQuality = sleepQualities.length ? avg(sleepQualities) : null;

  const exerciseMin = (day.exercise || []).reduce((s, x) => s + (Number(x.duration_minutes) || 0), 0);
  const exerciseKm  = (day.exercise || []).reduce((s, x) => s + (Number(x.distance_km) || 0), 0);
  const exerciseKcal= (day.exercise || []).reduce((s, x) => s + (Number(x.calories_burned) || 0), 0);

  return {
    totalKcal, totalProtein, totalCarbs, totalFat, totalFiber, totalSugar,
    mealsCount: day.meals?.length || 0,
    insulinTotal,
    insulinCount: day.insulin?.length || 0,
    glucoseAvg, glucoseMin, glucoseMax,
    glucoseCount: glucoseValues.length,
    bpAvgSys: avg(sysValues),
    bpAvgDia: avg(diaValues),
    pulseAvg: avg(pulseValues),
    bpCount: sysValues.length,
    lastWeight,
    sleepMin, sleepQuality,
    sleepCount: day.sleep?.length || 0,
    exerciseMin, exerciseKm, exerciseKcal,
    exerciseCount: day.exercise?.length || 0,
    notesCount: day.otherNotes?.length || 0,
  };
}

/* =========================================================================
   محدوده (هفتگی / ماهانه / بازه دلخواه)
   ========================================================================= */

export async function rangeSummary(fromIso, toIso) {
  const [meals, insulin, glucose, bp, weight, sleep, exercise, notes] = await Promise.all([
    listRange(TABLES.meals, fromIso, toIso),
    listRange(TABLES.insulin, fromIso, toIso),
    listRange(TABLES.glucose, fromIso, toIso),
    listRange(TABLES.bloodPressure, fromIso, toIso),
    listRange(TABLES.weight, fromIso, toIso),
    listRange(TABLES.sleep, fromIso, toIso),
    listRange(TABLES.exercise, fromIso, toIso),
    listRange(TABLES.otherNotes, fromIso, toIso),
  ]);

  const byDate = groupByDate({ meals, insulin, glucose, bp, weight, sleep, exercise, notes });

  // سری روزانه
  const days = enumerateDays(fromIso, toIso);
  const dailySeries = days.map((iso) => {
    const day = byDate[iso] || emptyDay();
    return { date: iso, ...summarizeDay(day) };
  });

  // تجمیع
  const totals = dailySeries.reduce((acc, d) => {
    acc.kcal      += d.totalKcal;
    acc.protein   += d.totalProtein;
    acc.carbs     += d.totalCarbs;
    acc.fat       += d.totalFat;
    acc.fiber     += d.totalFiber;
    acc.sugar     += d.totalSugar;
    acc.insulin   += d.insulinTotal;
    acc.exerciseMin += d.exerciseMin;
    acc.exerciseKm  += d.exerciseKm;
    acc.sleepMin    += d.sleepMin;
    return acc;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, insulin: 0, exerciseMin: 0, exerciseKm: 0, sleepMin: 0 });

  const daysCount = dailySeries.filter((d) => d.mealsCount > 0 || d.insulinCount > 0
    || d.glucoseCount > 0 || d.bpCount > 0 || d.sleepCount > 0 || d.exerciseCount > 0).length;

  const avgPerDay = daysCount ? {
    kcal: totals.kcal / daysCount,
    protein: totals.protein / daysCount,
    carbs: totals.carbs / daysCount,
    fat: totals.fat / daysCount,
    insulin: totals.insulin / daysCount,
    exerciseMin: totals.exerciseMin / daysCount,
    sleepMin: totals.sleepMin / daysCount,
  } : null;

  return {
    from: fromIso,
    to: toIso,
    days,
    dailySeries,
    totals,
    avgPerDay,
    daysCount,
    raw: { meals, insulin, glucose, bp, weight, sleep, exercise, notes },
  };
}

/* =========================================================================
   سرویس‌های آماده برای بازه‌های هفتگی و ماهانه
   ========================================================================= */

export async function weeklySummary(anyIso, weekStartsSaturday = true) {
  const from = startOfWeek(anyIso, weekStartsSaturday);
  const to = endOfWeek(anyIso, weekStartsSaturday);
  return { ...(await rangeSummary(from, to)), period: 'weekly', anchor: anyIso };
}

export async function monthlySummary(anyIso) {
  const from = startOfJalaliMonth(anyIso);
  const to = endOfJalaliMonth(anyIso);
  return { ...(await rangeSummary(from, to)), period: 'monthly', anchor: anyIso };
}

/* =========================================================================
   آمار تطبیقی برای KPI ها
   ========================================================================= */

export function computeDeltas(current, previous) {
  return {
    kcal: delta(current.totalKcal, previous.totalKcal),
    protein: delta(current.totalProtein, previous.totalProtein),
    weight: delta(current.lastWeight, previous.lastWeight),
    glucoseAvg: delta(current.glucoseAvg, previous.glucoseAvg),
    exerciseMin: delta(current.exerciseMin, previous.exerciseMin),
    sleepMin: delta(current.sleepMin, previous.sleepMin),
  };
}

/* =========================================================================
   ابزارهای داخلی
   ========================================================================= */

function groupByDate({ meals, insulin, glucose, bp, weight, sleep, exercise, notes }) {
  const out = {};
  const ensure = (d) => (out[d] = out[d] || emptyDay());
  for (const r of meals)      ensure(r.entry_date).meals.push(r);
  for (const r of insulin)    ensure(r.entry_date).insulin.push(r);
  for (const r of glucose)    ensure(r.entry_date).glucose.push(r);
  for (const r of bp)         ensure(r.entry_date).bloodPressure.push(r);
  for (const r of weight)     ensure(r.entry_date).weight.push(r);
  for (const r of sleep)      ensure(r.entry_date).sleep.push(r);
  for (const r of exercise)   ensure(r.entry_date).exercise.push(r);
  for (const r of notes)      ensure(r.entry_date).otherNotes.push(r);
  return out;
}

function emptyDay() {
  return { meals: [], insulin: [], glucose: [], bloodPressure: [],
           weight: [], sleep: [], exercise: [], otherNotes: [] };
}

function sum(list, key) {
  return (list || []).reduce((s, x) => s + (Number(x?.[key]) || 0), 0);
}

function avg(list) {
  if (!list?.length) return null;
  return list.reduce((s, x) => s + x, 0) / list.length;
}

function delta(cur, prev) {
  if (cur == null || prev == null) return null;
  return cur - prev;
}