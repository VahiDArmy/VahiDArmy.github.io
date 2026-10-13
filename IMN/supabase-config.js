/**
 * Supabase connection config.
 *
 * This file is loaded as a plain <script> BEFORE js/app.js in index.html,
 * which is why it uses a global instead of ES module exports.
 *
 * SECURITY
 * --------
 * - `anonKey` here is the *publishable* key — it is safe to commit and ship
 *   to the browser. It grants no access beyond what Row Level Security (RLS)
 *   policies allow.
 * - Never add the `service_role` key to this file.
 * - Every table in `supabase-schema.sql` has RLS enabled with
 *   `auth.uid() = user_id` policies, so anonymous requests are rejected and
 *   users can only see their own rows.
 */
window.SUPABASE_CONFIG = {
  url: "https://zzwctmqfxxnsxkumddvi.supabase.co",
  anonKey: "sb_publishable_qzd7iXR5WYwIL-q1a9Gcfg_ZjYTlttz"
};