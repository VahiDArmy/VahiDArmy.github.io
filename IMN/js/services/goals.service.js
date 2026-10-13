/**
 * Goals service — daily targets for calories, macros, steps, sleep, etc.
 *
 * Table: user_goals (one row per user)
 *   user_id pk, calories int, protein int, carbs int, fat int,
 *   fiber int, water int (glasses), steps int, sleep_hours numeric,
 *   updated_at timestamptz
 *
 * Goals are also mirrored into local state so the UI doesn't need to
 * round-trip on every render.
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";
import { store } from "../core/state.js";
import { DEFAULT_GOALS } from "../config/constants.js";

const TABLE = "user_goals";

function normalizeRow(row) {
  if (!row) return { ...DEFAULT_GOALS };
  return {
    calories: row.calories ?? DEFAULT_GOALS.calories,
    protein: row.protein ?? DEFAULT_GOALS.protein,
    carbs: row.carbs ?? DEFAULT_GOALS.carbs,
    fat: row.fat ?? DEFAULT_GOALS.fat,
    fiber: row.fiber ?? DEFAULT_GOALS.fiber,
    water: row.water ?? DEFAULT_GOALS.water,
    steps: row.steps ?? DEFAULT_GOALS.steps,
    sleepHours: Number(row.sleep_hours ?? DEFAULT_GOALS.sleepHours),
  };
}

export const goals = {
  async load() {
    const rows = await db.select(TABLE, (q) => q.limit(1));
    const row = rows[0] || null;
    const goals = normalizeRow(row);
    store.setGoals(goals);
    return goals;
  },

  async save(patch) {
    const merged = { ...store.get("goals"), ...patch };
    // Supabase upsert on user_id (pk)
    const { supabase } = await import("../config/supabase.js");
    const uid = store.get("user")?.id;
    if (!uid) throw new Error("AUTH_REQUIRED");
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: uid,
          calories: merged.calories,
          protein: merged.protein,
          carbs: merged.carbs,
          fat: merged.fat,
          fiber: merged.fiber,
          water: merged.water,
          steps: merged.steps,
          sleep_hours: merged.sleepHours,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) throw error;
    store.setGoals(merged);
    bus.emit("goals:changed", merged);
    return merged;
  },
};