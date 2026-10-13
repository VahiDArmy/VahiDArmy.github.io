/**
 * Health service — insulin, blood glucose, blood pressure, weight.
 *
 * BP classification uses the HIGHER category of the two readings,
 * matching AHA 2017 guidelines.
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";

function emitChange(kind, action, payload) {
  bus.emit("health:changed", { kind, action, ...payload });
  bus.emit("data:changed", { domain: "health", kind });
}

function makeKindService(table, kind) {
  return {
    async listByDate(dateISO) {
      return db.select(table, (q) =>
        q.eq("log_date", dateISO).order("log_time", { ascending: false })
      );
    },
    async listByRange(startISO, endISO) {
      return db.select(table, (q) =>
        q.gte("log_date", startISO).lte("log_date", endISO).order("log_date")
      );
    },
    async latest() {
      const rows = await db.select(table, (q) =>
        q.order("log_date", { ascending: false }).order("log_time", { ascending: false }).limit(1)
      );
      return rows[0] || null;
    },
    async add(payload) {
      const row = await db.insert(table, payload);
      emitChange(kind, "add", { row });
      return row;
    },
    async update(id, patch) {
      const row = await db.update(table, id, patch);
      emitChange(kind, "update", { row });
      return row;
    },
    async remove(id) {
      await db.remove(table, id);
      emitChange(kind, "remove", { id });
      return true;
    },
  };
}

export const insulin = {
  ...makeKindService("insulin_logs", "insulin"),
  async dailyTotals(startISO, endISO) {
    const rows = await this.listByRange(startISO, endISO);
    const byDate = new Map();
    for (const r of rows) {
      byDate.set(r.log_date, (byDate.get(r.log_date) || 0) + (Number(r.units) || 0));
    }
    return [...byDate.entries()]
      .map(([date, units]) => ({ date, units: Number(units.toFixed(1)) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};

export const glucose = {
  ...makeKindService("glucose_logs", "glucose"),
  classify(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return { level: "unknown", label: "—", tone: "flat" };
    if (v < 70) return { level: "low", label: "پایین", tone: "danger" };
    if (v < 100) return { level: "normal", label: "نرمال", tone: "success" };
    if (v < 126) return { level: "elevated", label: "مرزی", tone: "warning" };
    if (v < 200) return { level: "high", label: "بالا", tone: "danger" };
    return { level: "veryHigh", label: "بسیار بالا", tone: "danger" };
  },
  async dailyAverages(startISO, endISO) {
    const rows = await this.listByRange(startISO, endISO);
    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.log_date)) byDate.set(r.log_date, { sum: 0, n: 0 });
      const b = byDate.get(r.log_date);
      b.sum += Number(r.value) || 0;
      b.n += 1;
    }
    return [...byDate.entries()]
      .map(([date, b]) => ({ date, avg: Number((b.sum / b.n).toFixed(1)), count: b.n }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};

export const bp = {
  ...makeKindService("bp_logs", "bp"),
  /**
   * AHA 2017 classification. Uses the HIGHER category of the two numbers.
   * High categories are checked first so e.g. 145/75 is classified as
   * Stage 2 (systolic), not elevated.
   */
  classify(systolic, diastolic) {
    const s = Number(systolic);
    const d = Number(diastolic);
    if (!Number.isFinite(s) || !Number.isFinite(d)) {
      return { level: "unknown", label: "—", tone: "flat" };
    }
    if (s > 180 || d > 120) return { level: "crisis",   label: "بحرانی",               tone: "danger"  };
    if (s >= 140 || d >= 90) return { level: "stage2",   label: "فشار بالا (مرحله ۲)", tone: "danger"  };
    if (s >= 130 || d >= 80) return { level: "stage1",   label: "فشار بالا (مرحله ۱)", tone: "warning" };
    if (s >= 120)            return { level: "elevated", label: "کمی بالا",             tone: "warning" };
    if (s < 90 || d < 60)    return { level: "low",      label: "پایین",                tone: "warning" };
    return { level: "normal", label: "نرمال", tone: "success" };
  },
};

export const weight = {
  ...makeKindService("weight_logs", "weight"),
  async trend(startISO, endISO) {
    const rows = await this.listByRange(startISO, endISO);
    if (rows.length < 2) {
      return { change: 0, start: rows[0]?.weight ?? null, end: rows[0]?.weight ?? null };
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    return {
      change: Number((last.weight - first.weight).toFixed(2)),
      start: first.weight,
      end: last.weight,
      startDate: first.log_date,
      endDate: last.log_date,
    };
  },
};

export async function healthSnapshot(dateISO) {
  const [ins, glu, b, w] = await Promise.all([
    insulin.listByDate(dateISO),
    glucose.listByDate(dateISO),
    bp.listByDate(dateISO),
    weight.listByDate(dateISO),
  ]);
  return {
    insulin: ins,
    glucose: glu,
    bp: b,
    weight: w,
    totals: {
      insulinUnits: Number(ins.reduce((s, r) => s + (Number(r.units) || 0), 0).toFixed(1)),
      glucoseAvg: glu.length
        ? Number((glu.reduce((s, r) => s + (Number(r.value) || 0), 0) / glu.length).toFixed(1))
        : null,
      latestBP: b[0] || null,
      latestWeight: w[0] || null,
    },
  };
}