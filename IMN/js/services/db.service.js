/**
 * Thin generic data-access layer over Supabase.
 *
 * Every table in this app is protected by RLS with the policy
 * `auth.uid() = user_id`. This module never filters by user_id manually —
 * it relies on RLS — but it does stamp `user_id` on inserts so the row
 * has an owner from the start. That value is validated server-side.
 */

import { supabase } from "../config/supabase.js";
import { store } from "../core/state.js";
import { run, appError, ERROR_CODES } from "../utils/errors.js";

function currentUserId() {
  const user = store.get("user");
  if (!user) throw appError(ERROR_CODES.AUTH_REQUIRED);
  return user.id;
}

export const db = {
  /**
   * SELECT * FROM table WHERE ...  (RLS scopes to current user)
   * Supports the exact Supabase chaining style:
   *   db.select("food_logs", (q) => q.eq("log_date", date).order("created_at"))
   */
  async select(table, refine) {
    let query = supabase.from(table).select("*");
    if (typeof refine === "function") query = refine(query);
    return run(query);
  },

  /** SELECT one row (id lookup). Throws NOT_FOUND if missing. */
  async getOne(table, id) {
    const data = await run(supabase.from(table).select("*").eq("id", id).maybeSingle());
    if (!data) throw appError(ERROR_CODES.NOT_FOUND);
    return data;
  },

  /** Insert a single row. Automatically stamps user_id. */
  async insert(table, payload) {
    const row = { ...payload, user_id: currentUserId() };
    const data = await run(supabase.from(table).insert(row).select().single());
    return data;
  },

  /** Bulk insert. Stamps user_id on every row. */
  async insertMany(table, rows) {
    if (!rows?.length) return [];
    const uid = currentUserId();
    const payload = rows.map((r) => ({ ...r, user_id: uid }));
    const data = await run(supabase.from(table).insert(payload).select());
    return data;
  },

  /** Update a single row by id. RLS guarantees ownership. */
  async update(table, id, patch) {
    const data = await run(
      supabase.from(table).update(patch).eq("id", id).select().single()
    );
    return data;
  },

  /** Delete a single row by id. */
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  /**
   * Upsert — used for "one row per (user, date)" style tables such as
   * daily_logs or goals. `onConflict` must match a unique constraint.
   */
  async upsert(table, payload, onConflict) {
    const row = { ...payload, user_id: currentUserId() };
    let query = supabase.from(table).upsert(row, { onConflict });
    const data = await run(query.select().single());
    return data;
  },

  /** Count rows matching a filter. */
  async count(table, refine) {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (typeof refine === "function") query = refine(query);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  },
};