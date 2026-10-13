/**
 * Profile service — display name, avatar, anthropometrics, preferences.
 *
 * Table: profiles
 *   user_id uuid pk (references auth.users.id)
 *   display_name text
 *   avatar_url text
 *   height_cm numeric nullable
 *   weight_kg numeric nullable          ← added (baseline weight for BMI/BMR)
 *   birth_year int nullable
 *   gender text nullable
 *   activity_level text nullable        ← added (for TDEE)
 *   diabetes_type text nullable
 *   updated_at timestamptz
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";
import { store } from "../core/state.js";
import { supabase } from "../config/supabase.js";
import { normalize } from "../utils/errors.js";

const TABLE = "profiles";

/** Whitelist of columns the client is allowed to write. */
const EDITABLE_FIELDS = new Set([
  "display_name",
  "avatar_url",
  "height_cm",
  "weight_kg",
  "birth_year",
  "gender",
  "activity_level",
  "diabetes_type",
]);

function pickEditable(patch) {
  const out = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (EDITABLE_FIELDS.has(k)) out[k] = v === "" ? null : v;
  }
  return out;
}

export const profile = {
  async load() {
    const rows = await db.select(TABLE, (q) => q.limit(1));
    const row = rows[0] || null;
    store.set("profile", row);
    return row;
  },

  async save(patch) {
    const uid = store.get("user")?.id;
    if (!uid) throw new Error("AUTH_REQUIRED");

    const current = store.get("profile") || {};
    const cleaned = pickEditable(patch);
    const merged = { ...current, ...cleaned };

    const payload = {
      user_id: uid,
      display_name: merged.display_name ?? null,
      avatar_url: merged.avatar_url ?? null,
      height_cm: merged.height_cm ?? null,
      weight_kg: merged.weight_kg ?? null,
      birth_year: merged.birth_year ?? null,
      gender: merged.gender ?? null,
      activity_level: merged.activity_level ?? null,
      diabetes_type: merged.diabetes_type ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw normalize(error);

    store.set("profile", data);
    bus.emit("profile:changed", data);
    return data;
  },

  /**
   * Sync `weight_kg` on the profile from a fresh weight log entry, so
   * BMI/BMR stay current without the user re-entering their weight in
   * settings. Silently no-ops if the profile has no weight field yet.
   */
  async syncWeightFromLog(weightKg) {
    const w = Number(weightKg);
    if (!w || w <= 0) return;
    const current = store.get("profile") || {};
    if (current.weight_kg === w) return;
    try {
      await this.save({ weight_kg: w });
    } catch (err) {
      // Non-fatal — the log itself was already saved.
      // eslint-disable-next-line no-console
      console.warn("[profile] syncWeightFromLog failed", err);
    }
  },

  /**
   * Upload avatar to the `avatars` Storage bucket.
   * Bucket must be:
   *   • private
   *   • policy: authenticated users can read/write only their own folder
   *     (folder name = auth.uid()).
   */
  async uploadAvatar(file) {
    const uid = store.get("user")?.id;
    if (!uid) throw new Error("AUTH_REQUIRED");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${uid}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (upErr) throw normalize(upErr);

    const { data: signed, error: signErr } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr) throw normalize(signErr);

    await this.save({ avatar_url: signed.signedUrl });
    return signed.signedUrl;
  },

  async getSignedAvatar(path) {
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60);
    if (error) throw normalize(error);
    return data.signedUrl;
  },
};