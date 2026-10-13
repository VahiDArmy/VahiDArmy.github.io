/**
 * Reports service — aggregates data across all domains for daily, weekly
 * and monthly views.
 *
 * ERROR POLICY
 * ------------
 * This service does NOT swallow errors. If a query fails, the caller
 * receives a thrown AppError and can show a real error state. The old
 * `.catch(() => null)` pattern silently converted failures into "no data",
 * which hid real problems from users.
 */

import { foodLog } from "./food-log.service.js";
import { insulin, glucose, bp, weight } from "./health.service.js";
import { sleep } from "./sleep.service.js";
import { activity } from "./activity.service.js";
import {
  addDays, rangeDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, todayISO, diffDays,
} from "../utils/date.js";
import { store } from "../core/state.js";

function avg(arr, key) {
  const vals = arr.map((x) => Number(x[key])).filter(Number.isFinite);
  if (!vals.length) return 0;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
}

function sum(arr, key) {
  return Number(arr.reduce((s, x) => s + (Number(x[key]) || 0), 0).toFixed(2));
}

function median(arr, key) {
  const vals = arr.map((x) => Number(x[key])).filter(Number.isFinite).sort((a, b) => a - b);
  if (!vals.length) return 0;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2
    ? vals[mid]
    : Number(((vals[mid - 1] + vals[mid]) / 2).toFixed(2));
}

function percent(value, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((Number(value) / Number(goal)) * 100));
}

function min(rows, key) {
  const vals = rows.map((r) => Number(r[key])).filter(Number.isFinite);
  return vals.length ? Math.min(...vals) : 0;
}

function max(rows, key) {
  const vals = rows.map((r) => Number(r[key])).filter(Number.isFinite);
  return vals.length ? Math.max(...vals) : 0;
}

function delta(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  const diff = Number((c - p).toFixed(2));
  const pct = p === 0 ? (c === 0 ? 0 : 100) : Number(((diff / p) * 100).toFixed(1));
  return { current: c, previous: p, diff, pct, direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat" };
}

function qualityLabel(q) {
  const map = { 1: "بسیار بد", 2: "بد", 3: "متوسط", 4: "خوب", 5: "بسیار خوب" };
  return map[q] || "—";
}

/* ---------- Daily report ----------------------------------------------- */
export async function dailyReport(dateISO) {
  const [foodResult, insulinRows, glucoseRows, bpRows, weightRows, sleepRow, activityRows] =
    await Promise.all([
      foodLog.listByDate(dateISO),
      insulin.listByDate(dateISO),
      glucose.listByDate(dateISO),
      bp.listByDate(dateISO),
      weight.listByDate(dateISO),
      sleep.getByDate(dateISO),
      activity.listByDate(dateISO),
    ]);

  const foods = foodResult.rows || [];
  const foodTotals = {
    calories: sum(foods, "calories"),
    protein: sum(foods, "protein"),
    carbs: sum(foods, "carbs"),
    fat: sum(foods, "fat"),
    fiber: sum(foods, "fiber"),
    sugar: sum(foods, "sugar"),
    entries: foods.length,
  };

  const perMeal = {};
  for (const [meal, rows] of Object.entries(foodResult.grouped || {})) {
    perMeal[meal] = {
      calories: sum(rows, "calories"),
      protein: sum(rows, "protein"),
      carbs: sum(rows, "carbs"),
      fat: sum(rows, "fat"),
      count: rows.length,
    };
  }

  const activityTotals = {
    steps: sum(activityRows, "steps"),
    km: sum(activityRows, "distance_km"),
    minutes: sum(activityRows, "duration_min"),
    kcalBurned: sum(activityRows, "calories_burned"),
    entries: activityRows.length,
  };

  const goals = store.get("goals") || {};
  const progress = {
    calories: percent(foodTotals.calories, goals.calories),
    protein: percent(foodTotals.protein, goals.protein),
    carbs: percent(foodTotals.carbs, goals.carbs),
    fat: percent(foodTotals.fat, goals.fat),
    fiber: percent(foodTotals.fiber, goals.fiber),
    steps: percent(activityTotals.steps, goals.steps),
  };

  return {
    date: dateISO,
    food: { totals: foodTotals, perMeal, entries: foods },
    insulin: { entries: insulinRows, totalUnits: sum(insulinRows, "units"), count: insulinRows.length },
    glucose: {
      entries: glucoseRows,
      avg: avg(glucoseRows, "value"),
      min: min(glucoseRows, "value"),
      max: max(glucoseRows, "value"),
      count: glucoseRows.length,
    },
    bp: { entries: bpRows, latest: bpRows[0] || null },
    weight: { entries: weightRows, latest: weightRows[0] || null },
    sleep: sleepRow ? { ...sleepRow, qualityLabel: qualityLabel(sleepRow.quality) } : null,
    activity: { entries: activityRows, totals: activityTotals },
    goals,
    progress,
  };
}

/* ---------- Range reports ---------------------------------------------- */
export async function weeklyReport(anchorISO, { weekStartsOn = 6 } = {}) {
  const start = startOfWeek(anchorISO, weekStartsOn);
  const end = endOfWeek(anchorISO, weekStartsOn);
  return rangeReport(start, end, "weekly");
}

export async function monthlyReport(anchorISO) {
  const start = startOfMonth(anchorISO);
  const end = endOfMonth(anchorISO);
  return rangeReport(start, end, "monthly");
}

export async function customReport(startISO, endISO) {
  return rangeReport(startISO, endISO, "custom");
}

async function rangeReport(startISO, endISO, kind) {
  const [foodDaily, insulinRows, glucoseRows, bpRows, weightRows, sleepRows, activityDaily] =
    await Promise.all([
      foodLog.totalsByRange(startISO, endISO),
      insulin.listByRange(startISO, endISO),
      glucose.listByRange(startISO, endISO),
      bp.listByRange(startISO, endISO),
      weight.listByRange(startISO, endISO),
      sleep.listByRange(startISO, endISO),
      activity.dailyTotals(startISO, endISO),
    ]);

  const days = rangeDays(startISO, endISO);
  const activeDays = foodDaily.filter((d) => d.entries > 0).length;

  const foodTotals = {
    calories: sum(foodDaily, "calories"),
    protein: sum(foodDaily, "protein"),
    carbs: sum(foodDaily, "carbs"),
    fat: sum(foodDaily, "fat"),
    fiber: sum(foodDaily, "fiber"),
    sugar: sum(foodDaily, "sugar"),
    entries: sum(foodDaily, "entries"),
  };

  const activityTotals = {
    steps: sum(activityDaily, "steps"),
    km: sum(activityDaily, "km"),
    minutes: sum(activityDaily, "minutes"),
    kcalBurned: sum(activityDaily, "kcal"),
  };

  const insulinTotal = sum(insulinRows, "units");
  const glucoseAvg = avg(glucoseRows, "value");

  const sleepStats = sleepRows.length
    ? {
        avgHours: avg(sleepRows, "durationHours"),
        totalHours: sum(sleepRows, "durationHours"),
        avgQuality: avg(sleepRows.filter((r) => r.quality), "quality"),
        best: [...sleepRows].sort((a, b) => b.durationHours - a.durationHours)[0],
        worst: [...sleepRows].sort((a, b) => a.durationHours - b.durationHours)[0],
      }
    : null;

  const weightChange =
    weightRows.length >= 2
      ? Number((Number(weightRows[weightRows.length - 1].weight) - Number(weightRows[0].weight)).toFixed(2))
      : 0;

  const averages = activeDays > 0
    ? {
        calories: Number((foodTotals.calories / activeDays).toFixed(0)),
        protein: Number((foodTotals.protein / activeDays).toFixed(1)),
        carbs: Number((foodTotals.carbs / activeDays).toFixed(1)),
        fat: Number((foodTotals.fat / activeDays).toFixed(1)),
        steps: Number((activityTotals.steps / Math.max(1, days.length)).toFixed(0)),
        km: Number((activityTotals.km / Math.max(1, days.length)).toFixed(2)),
      }
    : null;

  return {
    kind,
    start: startISO,
    end: endISO,
    days,
    dayCount: days.length,
    activeDays,
    food: {
      daily: foodDaily,
      totals: foodTotals,
      averages,
      best: [...foodDaily].sort((a, b) => b.calories - a.calories)[0],
      worst: [...foodDaily].sort((a, b) => a.calories - b.calories)[0],
    },
    insulin: { entries: insulinRows, total: insulinTotal, avgPerDay: Number((insulinTotal / Math.max(1, days.length)).toFixed(2)) },
    glucose: {
      entries: glucoseRows,
      avg: glucoseAvg,
      min: min(glucoseRows, "value"),
      max: max(glucoseRows, "value"),
      median: median(glucoseRows, "value"),
    },
    bp: {
      entries: bpRows,
      latest: bpRows[0] || null,
      systolicAvg: avg(bpRows, "systolic"),
      diastolicAvg: avg(bpRows, "diastolic"),
      systolicMin: min(bpRows, "systolic"),
      systolicMax: max(bpRows, "systolic"),
    },
    weight: {
      entries: weightRows,
      change: weightChange,
      start: weightRows[0]?.weight ?? null,
      end: weightRows[weightRows.length - 1]?.weight ?? null,
      min: min(weightRows, "weight"),
      max: max(weightRows, "weight"),
    },
    sleep: sleepStats,
    activity: { daily: activityDaily, totals: activityTotals },
  };
}

/* ---------- Comparison ------------------------------------------------- */
export async function comparisonReport(anchorISO, kind) {
  let currentStart, currentEnd, prevStart, prevEnd;

  if (kind === "weekly") {
    currentStart = startOfWeek(anchorISO);
    currentEnd = endOfWeek(anchorISO);
    prevStart = addDays(currentStart, -7);
    prevEnd = addDays(currentEnd, -7);
  } else if (kind === "monthly") {
    currentStart = startOfMonth(anchorISO);
    currentEnd = endOfMonth(anchorISO);
    const prevAnchor = addDays(currentStart, -1);
    prevStart = startOfMonth(prevAnchor);
    prevEnd = endOfMonth(prevAnchor);
  } else {
    const span = Math.max(1, diffDays(anchorISO, startOfWeek(anchorISO)) + 7);
    currentStart = anchorISO;
    currentEnd = addDays(anchorISO, span - 1);
    prevEnd = addDays(currentStart, -1);
    prevStart = addDays(prevEnd, -(span - 1));
  }

  const [current, previous] = await Promise.all([
    rangeReport(currentStart, currentEnd, kind),
    rangeReport(prevStart, prevEnd, kind),
  ]);

  const deltas = {
    calories: delta(current.food.totals.calories, previous.food.totals.calories),
    steps: delta(current.activity.totals.steps, previous.activity.totals.steps),
    km: delta(current.activity.totals.km, previous.activity.totals.km),
    weight: delta(current.weight.end, previous.weight.end),
    sleepHours: delta(current.sleep?.avgHours ?? 0, previous.sleep?.avgHours ?? 0),
    glucose: delta(current.glucose.avg, previous.glucose.avg),
  };

  return { current, previous, deltas };
}

/* ---------- Heatmap ---------------------------------------------------- */
export async function heatmapData(startISO, endISO, metric = "calories") {
  const [daily, act] = await Promise.all([
    foodLog.totalsByRange(startISO, endISO),
    activity.dailyTotals(startISO, endISO),
  ]);
  const actByDate = new Map(act.map((d) => [d.date, d]));

  const combined = daily.map((d) => {
    const a = actByDate.get(d.date);
    const value = metric === "steps"
      ? (a?.steps ?? 0)
      : metric === "km"
      ? (a?.km ?? 0)
      : d.calories;
    return { date: d.date, calories: d.calories, steps: a?.steps ?? 0, km: a?.km ?? 0, value };
  });

  const values = combined.map((c) => c.value).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => values[Math.floor((values.length - 1) * p)] || 0;
  const thresholds = [q(0.25), q(0.5), q(0.75), q(0.9)];

  return combined.map((c) => {
    let level = 0;
    if (c.value > 0) {
      level = 1;
      if (c.value >= thresholds[0]) level = 2;
      if (c.value >= thresholds[1]) level = 3;
      if (c.value >= thresholds[2]) level = 4;
    }
    return { ...c, level };
  });
}

export const reports = { dailyReport, weeklyReport, monthlyReport, customReport, comparisonReport, heatmapData };
export { todayISO };