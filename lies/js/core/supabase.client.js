/* ============================================================
   js/core/supabase.client.js
   FIXED: Removed the dangerous `lock: (...) => fn()` bypass.
          Handled the deadlock properly via setTimeout in session.js.
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_OPTIONS, isSupabaseConfigured } from '../config/supabase.config.js';
import { EVENTS } from '../config/constants.js';
import { bus } from './event-bus.js';

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  if (!isSupabaseConfigured()) throw new Error('Supabase config missing');
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_AUTH_OPTIONS);
  
  _client.auth.onAuthStateChange((event, session) => {
    // Deferring avoids the Supabase v2 deadlock
    setTimeout(() => {
      if (event === 'SIGNED_IN') bus.emit(EVENTS.AUTH_SIGNED_IN, session);
      if (event === 'SIGNED_OUT') bus.emit(EVENTS.AUTH_SIGNED_OUT);
    }, 0);
  });

  return _client;
}

export async function getSession() {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) throw error;
    return data?.session ?? null;
  } catch { return null; }
}

export async function getUser() { return (await getSession())?.user ?? null; }
export async function isAuthenticated() { return !!(await getSession()); }