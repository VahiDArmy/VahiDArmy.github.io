/* ============================================================
   Supabase singleton — wraps UMD global into an ES module export
   ============================================================ */
import { CONFIG } from './config.js';

const globalSb = window.supabase;
if (!globalSb || typeof globalSb.createClient !== 'function') {
  throw new Error('Supabase UMD not loaded. Include the supabase-js script tag before main.js.');
}

export const sb = globalSb.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'smyar.auth',
  },
  global: {
    headers: { 'x-application-name': 'supermarket-yar' },
  },
});

/**
 * Small wrappers so components don't need to know table names.
 */
export const Tables = CONFIG.tables;

/** Helper: throw-on-error supabase call */
export async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

/** Convenience: get current session (may be null) */
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data?.session ?? null;
}

/** Convenience: current user (may be null) */
export async function getUser() {
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}
