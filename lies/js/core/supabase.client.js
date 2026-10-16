/* ============================================================
   js/core/supabase.client.js
   Single Supabase client instance + session helpers.
   Updated: newer supabase-js (supports sb_publishable_ keys) +
            verbose error logging for debugging.
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_AUTH_OPTIONS,
  isSupabaseConfigured,
} from '../config/supabase.config.js';
import { EVENTS } from '../config/constants.js';
import { bus } from './event-bus.js';

/**
 * @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient
 * @typedef {import('@supabase/supabase-js').Session} Session
 * @typedef {import('@supabase/supabase-js').User} User
 */

/** @type {SupabaseClient|null} */
let _client = null;

/**
 * Get (or lazily create) the singleton client.
 * @returns {SupabaseClient}
 */
export function getSupabase() {
  if (_client) return _client;

  if (!isSupabaseConfigured()) {
    const msg =
      '[Supabase] تنظیمات اتصال کامل نیست. لطفاً مقادیر ' +
      'SUPABASE_URL و SUPABASE_ANON_KEY را در js/config/supabase.config.js وارد کنید.';
    console.error(msg);
    throw new Error(msg);
  }

  try {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_OPTIONS);
  } catch (err) {
    console.error('[Supabase] createClient failed', err);
    throw err;
  }

  // Diagnostic: log which project we're connected to (URL only, no secrets)
  try {
    const ref = SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];
    console.info(
      `%c[Supabase] متصل به پروژه: ${ref}`,
      'color:#7c5cff;font-weight:bold'
    );
    console.info(
      `%c[Supabase] نوع کلید: ${SUPABASE_ANON_KEY.startsWith('sb_publishable_') ? 'publishable (جدید)' : 'JWT anon (قدیمی)'}`,
      'color:#7c5cff'
    );
  } catch { /* silent */ }

  // Wire auth state → EventBus
  _client.auth.onAuthStateChange((event, session) => {
    switch (event) {
      case 'SIGNED_IN':
        bus.emit(EVENTS.AUTH_SIGNED_IN, session);
        break;
      case 'SIGNED_OUT':
        bus.emit(EVENTS.AUTH_SIGNED_OUT);
        break;
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
      case 'INITIAL_SESSION':
      default:
        break;
    }
  });

  return _client;
}

/**
 * Ensure the client exists, throwing a friendly error otherwise.
 * @returns {SupabaseClient}
 */
export function requireSupabase() {
  return getSupabase();
}

/**
 * Get the current session or null.
 * @returns {Promise<Session|null>}
 */
export async function getSession() {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    return data?.session ?? null;
  } catch (err) {
    console.warn('[Supabase] getSession failed', err);
    return null;
  }
}

/**
 * Get the current user or null.
 * @returns {Promise<User|null>}
 */
export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Get the current access token (JWT) or null.
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

/**
 * Register a listener for auth changes (raw Supabase event).
 * @param {(event:string, session:Session|null) => void} handler
 * @returns {{ unsubscribe: () => void }}
 */
export function onAuthChange(handler) {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    try { handler(event, session); }
    catch (err) { console.error('[Supabase] auth listener error', err); }
  });
  return data?.subscription ?? { unsubscribe: () => {} };
}

/**
 * Convenience: are we authenticated?
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  return !!(await getSession());
}

/**
 * Tear down local session (does NOT hit the server).
 */
export async function clearLocalSession() {
  try {
    await getSupabase().auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn('[Supabase] clearLocalSession', err);
  }
}

/**
 * Diagnostic helper — dump connection info to console.
 * Call this from the browser console: `__app.debugSupabase()`
 * @returns {Promise<object>}
 */
export async function debugSupabase() {
  const client = getSupabase();
  const { data: session } = await client.auth.getSession();
  const info = {
    url: SUPABASE_URL,
    keyType: SUPABASE_ANON_KEY.startsWith('sb_publishable_') ? 'publishable' : 'jwt',
    keyPrefix: SUPABASE_ANON_KEY.slice(0, 20) + '…',
    hasSession: !!session?.session,
    userEmail: session?.session?.user?.email || null,
    expiresAt: session?.session?.expires_at || null,
  };
  console.table(info);
  return info;
}