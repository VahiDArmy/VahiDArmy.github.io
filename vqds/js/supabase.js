/* ==========================================================================
   supabase.js — کلاینت واحد Supabase (با CDN جایگزین برای ایران)
   ========================================================================== */

// تغییر CDN از esm.sh به jsdelivr برای پایداری بیشتر در شبکه‌های داخلی
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
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