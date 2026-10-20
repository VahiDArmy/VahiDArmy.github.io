/**
 * Supabase client (single instance).
 *
 * The URL + anon key come from js/config/supabase.config.js.
 * The anon key is public by design; ALL tables must have Row Level
 * Security enabled on the Supabase project.
 *
 * Loaded from the official ESM CDN so no build step is needed.
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.config.js';

if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT')) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] URL is not configured. Set it in js/config/supabase.config.js');
}
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR-PUBLIC')) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] ANON KEY is not configured. Set it in js/config/supabase.config.js');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'office-auth',
  },
  global: {
    headers: {
      'x-client-info': 'the-office-web/0.1.0',
    },
  },
  db: { schema: 'public' },
});

/** Guard helper used by services to require an authenticated session. */
export async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  }
  return data.session;
}

/** True if a user is currently signed in. */
export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return !!data?.session;
}

export default supabase;