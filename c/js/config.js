// =============================================================
// تنظیمات Supabase
// این دو مقدار را از Supabase Dashboard → Project Settings → API بردارید.
// SUPABASE_ANON_KEY کلید عمومی (anon/public) است — قرار گرفتنش در کد
// کلاینت مشکلی ندارد، امنیت واقعی را RLS در دیتابیس تأمین می‌کند.
// =============================================================
const CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',
};
