/**
 * supabase.js — کلاینت Supabase و مدیریت نشست
 *
 * مقادیر URL و ANON_KEY را در متغیرهای محیطی یا مستقیماً اینجا تنظیم کنید.
 * هرگز service_role key را در فرانت‌اند قرار ندهید.
 */

import { LS_KEYS } from './constants.js';

/* =========================================================================
   پیکربندی
   ------------------------------------------------------------------------
   این مقادیر را با اطلاعات پروژه Supabase خودتان جایگزین کنید.
   ========================================================================= */
const SUPABASE_URL  = window.SUPABASE_URL  || 'https://zzwctmqfxxnsxkumddvi.supabase.co';
const SUPABASE_ANON = window.SUPABASE_ANON || 'sb_publishable_qzd7iXR5WYwIL-q1a9Gcfg_ZjYTlttz';

/* ---------- ساخت کلاینت ---------- */
let _client = null;

export function getSupabase() {
  if (_client) return _client;
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('کتابخانه supabase-js بارگذاری نشده است.');
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'sh-auth-session',
    },
    global: {
      headers: { 'x-application-name': 'salamat-yar' },
    },
  });
  return _client;
}

/* ---------- بررسی وجود تنظیمات ---------- */
export function isConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR-PROJECT') &&
    typeof SUPABASE_ANON === 'string' &&
    SUPABASE_ANON.length > 40
  );
}

/* ---------- Session helpers ---------- */

export async function getSession() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  return data?.user ?? null;
}

export async function signInWithPassword(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  cacheUser(data.user);
  return data;
}

export async function signUpWithPassword(email, password, displayName) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  if (data.user) cacheUser(data.user);
  return data;
}

export async function signOut() {
  const sb = getSupabase();
  const { error } = await sb.auth.signOut({ scope: 'local' });
  if (error) throw error;
  clearCachedUser();
}

export async function resetPassword(email) {
  const sb = getSupabase();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

export function onAuthChange(cb) {
  const sb = getSupabase();
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) cacheUser(session.user);
    else if (event === 'SIGNED_OUT') clearCachedUser();
    cb(event, session);
  });
  return () => data.subscription?.unsubscribe?.();
}

/* ---------- User cache (برای نمایش سریع) ---------- */

function cacheUser(user) {
  try {
    const minimal = { id: user.id, email: user.email, meta: user.user_metadata || {} };
    localStorage.setItem(LS_KEYS.user, JSON.stringify(minimal));
  } catch {}
}
function clearCachedUser() {
  try { localStorage.removeItem(LS_KEYS.user); } catch {}
}
export function getCachedUser() {
  try {
    const raw = localStorage.getItem(LS_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ---------- مدیریت خطاهای احراز هویت ---------- */

export function mapAuthError(err) {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'ایمیل یا رمز عبور اشتباه است.';
  if (msg.includes('user already registered'))    return 'این ایمیل قبلاً ثبت شده است.';
  if (msg.includes('email not confirmed'))        return 'ایمیل شما تأیید نشده است. صندوق ورودی را بررسی کنید.';
  if (msg.includes('password should be at least'))return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (msg.includes('rate limit'))                 return 'تعداد تلاش‌ها زیاد بود. کمی بعد دوباره تلاش کنید.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'اتصال به سرور برقرار نشد.';
  return err?.message || 'خطای نامشخص رخ داد.';
}