/**
 * Activity service — steps, km walked/run, general exercise logs.
 *
 * Table: activity_logs
 *   id, user_id, log_date, log_time,
 *   type (walk|run|bike|gym|swim|yoga|other),
 *   distance_km numeric nullable,
 *   duration_min int nullable,
 *   steps int nullable,
 *   calories_burned numeric nullable,
 *   notes text,
 *   created_at
 *
 * Daily steps/km/calories-burned are also summed via a helper that
 * reads ranges — no separate summary table needed.
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";

const TABLE = "activity_logs";

function emitChange(action, payload) {
  bus.emit("activity:changed", { action, ...payload });
  bus.emit("data:changed", { domain: "activity" });
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

  /** Sum per day for a range: steps, km, minutes, kcal burned. */
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
    const out = [];
    let cur = startISO;
    while (cur <= endISO) {
      const t = map.get(cur) || { date: cur, steps: 0, km: 0, minutes: 0, kcal: 0, entries: 0 };
      ["steps", "km", "minutes", "kcal"].forEach((k) => {
        t[k] = Number(t[k].toFixed(2));
      });
      out.push(t);
      const d = new Date(cur + "T00:00:00");
      d.setDate(d.getDate() + 1);
      cur = d.toISOString().slice(0, 10);
    }
    return out;
  },

  /** Simple kcal estimate for common types, given minutes + optional km. */
  estimateCaloriesBurned(type, minutes, km = 0, weightKg = 75) {
    // MET values (moderate effort)
    const MET = {
      walk: 3.5, run: 9.8, bike: 7.5, swim: 8.0,
      gym: 5.0, yoga: 3.0, other: 4.0,
    };
    const met = MET[type] ?? 4.0;
    const hours = (Number(minutes) || 0) / 60;
    const kcalPerKg = met * hours * 1.05;
    return Math.round(kcalPerKg * weightKg);
  },
};