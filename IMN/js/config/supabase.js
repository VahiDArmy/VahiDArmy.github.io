/**
 * Supabase client bootstrap.
 *
 * SECURITY NOTES
 * --------------
 * 1. Only the ANON key is used on the client. The anon key is safe to ship
 *    in the browser bundle ONLY IF every table is protected by Row Level
 *    Security (RLS) policies that require an authenticated user.
 * 2. Never put the service_role key here — it would defeat RLS entirely.
 * 3. Do NOT enable public signup without e-mail confirmation, otherwise
 *    anyone can create an anonymous account and read their (empty) data.
 * 4. All queries rely on `auth.uid() = user_id` policies; the client never
 *    sends `user_id` filters manually — RLS handles it.
 *
 * HOW TO CONFIGURE
 * ----------------
 * Because this project is served as a static site (GitHub Pages), the URL
 * and anon key must be visible in the bundle. Provide them via:
 *   a) a global `window.__SUPABASE__` object set from a small inline script, or
 *   b) a `supabase-config.js` file placed next to `index.html`, or
 *   c) hard-coding them here as a last resort (still safe thanks to RLS).
 * The loader below tries (a), then (b), then falls back to placeholders.
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const PLACEHOLDER_URL = "https://YOUR-PROJECT.supabase.co";
const PLACEHOLDER_KEY = "YOUR-ANON-KEY";

function resolveCredentials() {
  // (a) global injected config
  if (typeof window !== "undefined" && window.__SUPABASE__) {
    const g = window.__SUPABASE__;
    if (g.url && g.anonKey) return { url: g.url, anonKey: g.anonKey };
  }
  // (b) file-based config (loaded by index.html as a plain <script>)
  if (typeof window !== "undefined" && window.SUPABASE_CONFIG) {
    const c = window.SUPABASE_CONFIG;
    if (c.url && c.anonKey) return { url: c.url, anonKey: c.anonKey };
  }
  // (c) placeholder — app will warn and stay on the auth screen
  return { url: PLACEHOLDER_URL, anonKey: PLACEHOLDER_KEY };
}

const { url, anonKey } = resolveCredentials();

export const isConfigured =
  url !== PLACEHOLDER_URL && anonKey !== PLACEHOLDER_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "activity-tracker.auth",
    flowType: "pkce",
  },
  global: {
    headers: {
      "x-application-name": "activity-tracker",
    },
  },
});

/* Convenience accessors ------------------------------------------------ */

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("AUTH_REQUIRED");
    err.code = "AUTH_REQUIRED";
    throw err;
  }
  return user;
}