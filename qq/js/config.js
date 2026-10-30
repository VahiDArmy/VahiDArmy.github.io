// =============================================================
// تنظیمات Supabase و مدل‌های AI
// =============================================================
const CONFIG = {
  SUPABASE_URL: 'https://ummhohozmpwltbgeczsf.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',

  AI_FUNCTIONS: [
    { id: 'ai-review',     label: 'Groq-bullshit' },
    { id: 'clever-worker', label: 'mistral-small-latest' },
    { id: 'hyper-handler', label: 'openrouter/free' },
    { id: 'super-action',  label: 'nvidia/nemotron' },
  ],

  AI_FUNCTION_DEFAULT: 'clever-worker',
};
