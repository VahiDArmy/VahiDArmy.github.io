/* ============================================================
   js/config/supabase.config.js
   ⚠️  Replace the placeholders with your real project values.
   The ANON key is safe to expose ONLY because every table has
   RLS enabled and no anonymous role has any policy.
   ============================================================ */

/**
 * Supabase project URL.
 * @type {string}
 */
export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';

/**
 * Supabase public anon key.
 * @type {string}
 */
export const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';

/**
 * Auth-related tuning.
 */
export const SUPABASE_AUTH_OPTIONS = Object.freeze({
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // We never want magic-link/OTP leaks in URL fragments logged anywhere.
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'az:auth:session',
  },
  global: {
    headers: {
      'x-application-name': 'ayeneh-daroun',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    // Realtime is disabled by default — we poll/refresh manually.
    params: { eventsPerSecond: 0 },
  },
});

/**
 * Guard: fail loudly at boot if the developer forgot to fill the config.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.length > 40 &&
    !SUPABASE_ANON_KEY.includes('YOUR-PUBLIC-ANON-KEY')
  );
}