/**
 * Profile service — display name, avatar, locale preferences.
 *
 * Table: profiles
 *   user_id uuid pk (references auth.users.id)
 *   display_name text
 *   avatar_url text
 *   height_cm numeric nullable
 *   birth_year int nullable
 *   gender text nullable (male|female|other)
 *   diabetes_type text nullable
 *   updated_at timestamptz
 */

import { db } from "./db.service.js";
import { bus } from "../core/event-bus.js";
import { store } from "../core/state.js";
import { supabase } from "../config/supabase.js";
import { normalize } from "../utils/errors.js";

const TABLE = "profiles";

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
    const merged = { ...current, ...patch };
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: uid,
          display_name: merged.display_name ?? null,
          avatar_url: merged.avatar_url ?? null,
          height_cm: merged.height_cm ?? null,
          birth_year: merged.birth_year ?? null,
          gender: merged.gender ?? null,
          diabetes_type: merged.diabetes_type ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();
    if (error) throw normalize(error);
    store.set("profile", data);
    bus.emit("profile:changed", data);
    return data;
  },

  /**
   * Upload avatar to the `avatars` Storage bucket.
   * Bucket must be configured with:
   *   - Private = true
   *   - Policy: authenticated users can read/write only their own folder
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

    // Signed URL (bucket is private)
    const { data: signed, error: signErr } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
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