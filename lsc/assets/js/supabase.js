/* ============================================================
   THEORIES STUDIO — Supabase client
   ============================================================ */
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let _client = null;

export const getSupabase = () => {
  if (_client) return _client;
  if (typeof window === 'undefined') return null;
  const lib = window.supabase;
  if (!lib || typeof lib.createClient !== 'function') {
    console.warn('[theories] Supabase SDK not found on window. Ensure the CDN script loaded.');
    return null;
  }
  _client = lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'theories-auth-v3',
      flowType: 'pkce'
    },
    global: {
      headers: { 'x-application-name': 'theories-studio' }
    }
  });
  return _client;
};

export const sb = () => getSupabase();

export const requireSb = () => {
  const c = getSupabase();
  if (!c) throw new Error('Supabase client unavailable');
  return c;
};
