/* ==========================================================================
   supabase.js — کلاینت واحد Supabase
   ========================================================================== */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'q56.auth.token',
  },
  global: {
    headers: {
      'x-application-name': 'quran-v56-pink',
    },
  },
});

/* پوشش امنیتی: اگر شبکه قطع باشد، خطای واضح می‌دهیم */
export async function safeAuth() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { session: null, error };
    return { session: data?.session || null, error: null };
  } catch (e) {
    return { session: null, error: e };
  }
}