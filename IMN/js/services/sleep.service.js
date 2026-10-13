/**
 * Sleep service.
 *
 * Table: sleep_logs (one row per day)
 *   id, user_id, log_date, sleep_time, wake_time,
 *   quality (1..5), notes, created_at, updated_at
 *
 * Duration is computed at read time (handles crossing midnight).
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";
import { minutesBetween } from "../utils/date.js";

const TABLE = "sleep_logs";

function emitChange(action, payload) {
  bus.emit("sleep:changed", { action, ...payload });
  bus.emit("data:changed", { domain: "sleep" });
}

function withDerived(row) {
  if (!row) return null;
  const minutes = minutesBetween(row.sleep_time, row.wake_time);
  return { ...row, durationMinutes: minutes, durationHours: Number((minutes / 60).toFixed(2)) };
}

export const sleep = {
  async getByDate(dateISO) {
    const rows = await db.select(TABLE, (q) => q.eq("log_date", dateISO).limit(1));
    return withDerived(rows[0] || null);
  },

  async listByRange(startISO, endISO) {
    const rows = await db.select(TABLE, (q) =>
      q.gte("log_date", startISO).lte("log_date", endISO).order("log_date")
    );
    return rows.map(withDerived);
  },

  async save(dateISO, { sleep_time, wake_time, quality, notes }) {
    const row = await db.upsert(
      TABLE,
      {
        log_date: dateISO,
        sleep_time: sleep_time ?? null,
        wake_time: wake_time ?? null,
        quality: quality ?? null,
        notes: notes ?? null,
      },
      "user_id,log_date"
    );
    emitChange("save", { row: withDerived(row), date: dateISO });
    return withDerived(row);
  },

  async remove(dateISO) {
    const existing = await this.getByDate(dateISO);
    if (!existing) return true;
    await db.remove(TABLE, existing.id);
    emitChange("remove", { date: dateISO });
    return true;
  },

  /** Averages + best/worst over a range (used by reports). */
  async stats(startISO, endISO) {
    const rows = await this.listByRange(startISO, endISO);
    const withData = rows.filter((r) => r.durationMinutes > 0);
    if (!withData.length) {
      return { avgHours: 0, avgMinutes: 0, best: null, worst: null, count: 0, totalMinutes: 0 };
    }
    const totalMinutes = withData.reduce((s, r) => s + r.durationMinutes, 0);
    const avgMinutes = Math.round(totalMinutes / withData.length);
    const sorted = [...withData].sort((a, b) => b.durationMinutes - a.durationMinutes);
    return {
      avgHours: Number((avgMinutes / 60).toFixed(2)),
      avgMinutes,
      best: sorted[0],
      worst: sorted[sorted.length - 1],
      count: withData.length,
      totalMinutes,
      avgQuality: Number(
        (withData.filter((r) => r.quality).reduce((s, r) => s + r.quality, 0) /
          (withData.filter((r) => r.quality).length || 1)).toFixed(2)
      ),
    };
  },
};