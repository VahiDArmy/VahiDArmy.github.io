/* ============================================================
   js/config/supabase.config.js
   ⚠️  Values are pre-filled from the user's Supabase project.
   The publishable (anon) key is safe to expose ONLY because
   every table has RLS enabled and no anonymous role has any policy.
   ============================================================ */

/**
 * Supabase project URL.
 * @type {string}
 */
export const SUPABASE_URL = 'https://wqzmkqymrikvcnptguwd.supabase.co';

/**
 * Supabase publishable (anon) key.
 * New format: "sb_publishable_..." — replaced the legacy JWT anon key.
 * It is safe to ship in client code because RLS blocks all anonymous reads/writes.
 * @type {string}
 */
export const SUPABASE_ANON_KEY = 'sb_publishable_w72iOV2HJJMhGvV7eMXVdw_8soShGO9';

/**
 * Auth-related tuning.
 */
export const SUPABASE_AUTH_OPTIONS = Object.freeze({
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE flow — never leaves magic-link/OTP tokens in URL fragments.
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
    // Realtime is disabled — we refresh manually.
    params: { eventsPerSecond: 0 },
  },
});

/**
 * Guard: fail loudly at boot if the developer forgot to fill the config.
 *
 * Accepts BOTH key formats:
 *   - legacy JWT anon keys  (long base64url string, usually > 200 chars)
 *   - new publishable keys  (start with "sb_publishable_")
 *
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  if (typeof SUPABASE_URL !== 'string' || typeof SUPABASE_ANON_KEY !== 'string') {
    return false;
  }

  // URL must be a real https URL and not the placeholder
  if (!SUPABASE_URL.startsWith('https://')) return false;
  if (SUPABASE_URL.includes('YOUR-PROJECT-REF')) return false;
  if (SUPABASE_URL.includes('YOUR-PROJECT')) return false;

  const key = SUPABASE_ANON_KEY.trim();

  // Placeholder guard
  if (key.includes('YOUR-PUBLIC-ANON-KEY')) return false;
  if (key.length < 20) return false;

  // Accept new publishable format
  if (key.startsWith('sb_publishable_')) return true;

  // Accept legacy JWT anon key format (has 2 dots: header.payload.signature)
  if (key.split('.').length === 3 && key.length > 100) return true;

  // Otherwise reject
  return false;
}