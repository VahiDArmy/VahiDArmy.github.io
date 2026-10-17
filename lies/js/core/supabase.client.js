/* ============================================================
   js/core/supabase.client.js
   Single Supabase client instance + session helpers.
   FIXED: Deferred the onAuthStateChange emits via setTimeout
          to prevent the known Supabase v2 deadlock (LockManager).
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

/** @type {any} */
let _client = null;

export function getSupabase() {
  if (_client) return _client;

  if (!isSupabaseConfigured()) {
    const msg = '[Supabase] تنظیمات اتصال کامل نیست.';
    console.error(msg);
    throw new Error(msg);
  }

  try {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_OPTIONS);
  } catch (err) {
    console.error('[Supabase] createClient failed', err);
    throw err;
  }

  try {
    const ref = SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0];
    console.info(`%c[Supabase] متصل به پروژه: ${ref}`, 'color:#7c5cff;font-weight:bold');
  } catch { /* silent */ }

  // ── DEADLOCK FIX ─────────────────────────────────────────
  // In Supabase JS v2, calling any auth/db method synchronously
  // inside onAuthStateChange causes a deadlock because the
  // client's LockManager is held. We defer the emit via setTimeout.
  _client.auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      try {
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
      } catch (err) {
        console.warn('[Supabase] auth event handler failed', err);
      }
    }, 0);
  });

  return _client;
}

export function requireSupabase() {
  return getSupabase();
}

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

export async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getAccessToken() {
  const session = await getSession();
  return session?.access_token ?? null;
}

export function onAuthChange(handler) {
  const { data } = getSupabase().auth.onAuthStateChange((event, session) => {
    setTimeout(() => {
      try { handler(event, session); }
      catch (err) { console.error('[Supabase] auth listener error', err); }
    }, 0);
  });
  return data?.subscription ?? { unsubscribe: () => {} };
}

export async function isAuthenticated() {
  return !!(await getSession());
}

export async function clearLocalSession() {
  try {
    await getSupabase().auth.signOut({ scope: 'local' });
  } catch (err) {
    console.warn('[Supabase] clearLocalSession', err);
  }
}

export async function debugSupabase() {
  const client = getSupabase();
  const { data: session } = await client.auth.getSession();
  const info = {
    url: SUPABASE_URL,
    hasSession: !!session?.session,
    userEmail: session?.session?.user?.email || null,
  };
  console.table(info);
  return info;
}