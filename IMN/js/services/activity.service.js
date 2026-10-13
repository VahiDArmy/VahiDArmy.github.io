/**
 * Activity service — steps, km walked/run, exercise logs.
 *
 * Day-by-day aggregation uses `addDays` (local-time safe) and never
 * `toISOString()`, so it behaves identically in every timezone.
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";
import { addDays } from "../utils/date.js";

const TABLE = "activity_logs";

function emitChange(action, payload) {
  bus.emit("activity:changed", { action, ...payload });
  bus.emit("data:changed", { domain: "activity" });
}

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

export const activity = {
  async listByDate(dateISO) {
    return db.select(TABLE, (q) =>
      q.eq("log_date", dateISO).order("log_time", { ascending: false })
    );
  },

  async listByRange(startISO, endISO) {
    return db.select(TABLE, (q) =>
      q.gte("log_date", startISO).lte("log_date", endISO).order("log_date")
    );
  },

  async add(payload) {
    const row = await db.insert(TABLE, {
      log_date: payload.log_date,
      log_time: payload.log_time || null,
      type: payload.type,
      distance_km: payload.distance_km ?? null,
      duration_min: payload.duration_min ?? null,
      steps: payload.steps ?? null,
      calories_burned: payload.calories_burned ?? null,
      notes: payload.notes ?? null,
    });
    emitChange("add", { row });
    return row;
  },

  async update(id, patch) {
    const row = await db.update(TABLE, id, patch);
    emitChange("update", { row });
    return row;
  },

  async remove(id) {
    await db.remove(TABLE, id);
    emitChange("remove", { id });
    return true;
  },

  async dailyTotals(startISO, endISO) {
    const rows = await this.listByRange(startISO, endISO);
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.log_date)) {
        map.set(r.log_date, {
          date: r.log_date, steps: 0, km: 0, minutes: 0, kcal: 0, entries: 0,
        });
      }
      const t = map.get(r.log_date);
      t.steps += Number(r.steps) || 0;
      t.km += Number(r.distance_km) || 0;
      t.minutes += Number(r.duration_min) || 0;
      t.kcal += Number(r.calories_burned) || 0;
      t.entries += 1;
    }
    return expandRange(startISO, endISO).map((date) => {
      const t = map.get(date) || { date, steps: 0, km: 0, minutes: 0, kcal: 0, entries: 0 };
      ["steps", "km", "minutes", "kcal"].forEach((k) => {
        t[k] = Number(t[k].toFixed(2));
      });
      return t;
    });
  },

  estimateCaloriesBurned(type, minutes, km = 0, weightKg = 75) {
    const MET = {
      walk: 3.5, run: 9.8, bike: 7.5, swim: 8.0,
      gym: 5.0, yoga: 3.0, other: 4.0,
    };
    const met = MET[type] ?? 4.0;
    const hours = (Number(minutes) || 0) / 60;
    return Math.round(met * hours * 1.05 * weightKg);
  },
};