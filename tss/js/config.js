// =============================================================
// تنظیمات Supabase
// این دو مقدار را از Supabase Dashboard → Project Settings → API بردارید.
// SUPABASE_ANON_KEY کلید عمومی (anon/public) است — قرار گرفتنش در کد
// کلاینت مشکلی ندارد، امنیت واقعی را RLS در دیتابیس تأمین می‌کند.
// =============================================================
const CONFIG = {
  SUPABASE_URL: 'https://ummhohozmpwltbgeczsf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',
  // >>> فهرست مدل‌های موجود — برای افزودن مدل جدید فقط یک خط اضافه کن <<<
  AI_FUNCTIONS: [
    { id: 'ai-review',     label: 'Groq' },
    { id: 'clever-worker', label: 'OpenRouter' },
    { id: 'hyper-handler', label: 'openrouter/free' },
    { id: 'super-action',  label: 'nvidia/nemotron' },
  ],

  AI_FUNCTION_DEFAULT: 'clever-worker',
};
