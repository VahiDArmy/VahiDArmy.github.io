/**
 * Food log service.
 *
 * Date arithmetic uses `addDays` from utils/date.js which operates in
 * LOCAL time. Never use `Date#toISOString()` here — in non-UTC timezones
 * it shifts the date by up to a day and can freeze `while` loops.
 */

import { db } from "./db.service.js";
import { foods } from "./foods.service.js";
import { bus } from "../core/event-bus.js";
import { addDays } from "../utils/date.js";
import { normalize } from "../utils/errors.js";
import { supabase } from "../config/supabase.js";

const TABLE = "food_logs";

function emitChange(action, payload) {
  bus.emit("food-log:changed", { action, ...payload });
  bus.emit("data:changed", { domain: "food" });
}

/** Expand a range into a dense array of ISO dates (local-time safe). */
function expandRange(startISO, endISO) {
  const days = [];
  let cur = startISO;
  let guard = 0;
  while (cur <= endISO && guard++ < 1900) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

export const foodLog = {
  async listByDate(dateISO) {
    const rows = await db.select(TABLE, (q) =>
      q.eq("log_date", dateISO).order("meal").order("created_at")
    );
    const grouped = {
      breakfast: [], snack1: [], lunch: [], snack2: [], dinner: [], snack3: [],
    };
    rows.forEach((r) => {
      (grouped[r.meal] ||= []).push(r);
    });
    return { rows, grouped };
  },

  async listByRange(startISO, endISO) {
    return db.select(TABLE, (q) =>
      q.gte("log_date", startISO).lte("log_date", endISO).order("log_date")
    );
  },

  async add({ date, meal, mealTime, food, grams = 100, notes = null }) {
    const m = foods.macrosFor(food, grams);
    const row = await db.insert(TABLE, {
      log_date: date,
      meal,
      meal_time: mealTime || null,
      food_name: food.Persian_Name,
      food_en: food.Name_En,
      grams,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      fiber: m.fiber,
      sugar: m.sugar,
      notes,
    });
    emitChange("add", { row, date, meal });
    return row;
  },

  async addMany({ date, meal, mealTime, items, notes = null }) {
    if (!items?.length) return [];
    const rows = items.map((it) => {
      const m = foods.macrosFor(it.food, it.grams);
      return {
        log_date: date,
        meal,
        meal_time: mealTime || null,
        food_name: it.food.Persian_Name,
        food_en: it.food.Name_En,
        grams: it.grams,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiber: m.fiber,
        sugar: m.sugar,
        notes,
      };
    });
    const inserted = await db.insertMany(TABLE, rows);
    emitChange("addMany", { rows: inserted, date, meal });
    return inserted;
  },

  async update(id, patch) {
    const clean = { ...patch };
    if ("grams" in clean && clean.food_macros) {
      const m = foods.macrosFor(clean.food_macros, clean.grams);
      Object.assign(clean, {
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
        fiber: m.fiber,
        sugar: m.sugar,
      });
      delete clean.food_macros;
    }
    const row = await db.update(TABLE, id, clean);
    emitChange("update", { row });
    return row;
  },

  async remove(id) {
    await db.remove(TABLE, id);
    emitChange("remove", { id });
    return true;
  },

  async clearMeal(date, meal) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("log_date", date)
      .eq("meal", meal);
    if (error) throw normalize(error);
    emitChange("clearMeal", { date, meal });
    return true;
  },

  async duplicateDay(fromISO, toISO) {
    const { rows } = await this.listByDate(fromISO);
    if (!rows.length) return [];
    const payload = rows.map(({ id, user_id, created_at, updated_at, ...rest }) => ({
      ...rest,
      log_date: toISO,
    }));
    const inserted = await db.insertMany(TABLE, payload);
    emitChange("duplicateDay", { from: fromISO, to: toISO, rows: inserted });
    return inserted;
  },

  /** Dense per-day totals (zero-filled) — used by dashboards/reports. */
  async totalsByRange(startISO, endISO) {
    const rows = await this.listByRange(startISO, endISO);
    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.log_date)) {
        byDate.set(r.log_date, {
          date: r.log_date,
          calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0,
          entries: 0,
        });
      }
      const t = byDate.get(r.log_date);
      t.calories += Number(r.calories) || 0;
      t.protein += Number(r.protein) || 0;
      t.carbs += Number(r.carbs) || 0;
      t.fat += Number(r.fat) || 0;
      t.fiber += Number(r.fiber) || 0;
      t.sugar += Number(r.sugar) || 0;
      t.entries += 1;
    }
    return expandRange(startISO, endISO).map((date) => {
      const t = byDate.get(date) || {
        date, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, entries: 0,
      };
      ["calories", "protein", "carbs", "fat", "fiber", "sugar"].forEach((k) => {
        t[k] = Number(t[k].toFixed(2));
      });
      return t;
    });
  },

  async frequentForMeal(meal, limit = 8) {
    const rows = await db.select(TABLE, (q) =>
      q.eq("meal", meal).order("created_at", { ascending: false }).limit(300)
    );
    const counts = new Map();
    for (const r of rows) {
      const key = r.food_name;
      if (!counts.has(key)) {
        counts.set(key, { name: r.food_name, en: r.food_en, count: 0, lastGrams: r.grams });
      }
      const c = counts.get(key);
      c.count += 1;
      if (c.lastGrams == null) c.lastGrams = r.grams;
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
  },
};