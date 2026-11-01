/* =========================================================
   پیکربندی برنامه
   =========================================================
   AI: دو منبع مدل در یک استخر واحد (جدول cinema_ai_models)
     • google      → Gemini مستقیم (فقط یک مدل، سکرت سرور: GEM_MALI)
     • openrouter  → مدل‌های رایگان OpenRouter (سکرت سرور: OPENROUTER_API_KEY)
   مدل‌های OpenRouter با دکمهٔ «همگام‌سازی» در صفحهٔ اصلی از خود OpenRouter
   خوانده می‌شوند؛ دیگر فهرست دستی در کد نیست.
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '4.0.0',

  PAGES: { HUB: 'index.html', MOVIES: 'movies.html' },

  SUPABASE: {
    URL: 'https://ummhohozmpwltbgeczsf.supabase.co',
    ANON_KEY: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',
    EDGE_FUNCTION: 'movies-quran'
  },

  AI: {
    /* تنها مدل Google. شناسه‌اش کلید یکتای ردیف در دیتابیس است. */
    GOOGLE_MODELS: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', vendor: 'Google', context: '1M' }
    ],
    DEFAULT_MODEL: 'gemini-3.8-flash',
    OPENROUTER_MODELS_URL: 'https://openrouter.ai/api/v1/models',
    /* حداقل کانتکست برای ورود به استخر (توکن) */
    MIN_CONTEXT: 8000,
    /* مدل‌هایی که برای تولید متن مناسب نیستند */
    EXCLUDE_ID: /safety|guard|moderat|embed|rerank|whisper|tts|image/i,
    /* بعد از این تعداد خطای پشت‌سرهم، تلاش خودکار می‌ایستد و منتظر کاربر می‌ماند */
    AUTO_RETRY: 5,
    BATCH_SIZE: 5,
    SEASON_CHUNK: 3
  },

  STARS: {
    0: { value: 0, label: 'بدون امتیاز', description: 'هنوز نمره نداده‌ام', color: '#5a5a72', emoji: '○', glow: null },
    1: { value: 1, label: 'خشمگین', description: 'افتضاح بود و از تماشایش عصبانی هستم', color: '#ff4d5e', emoji: '⭐', glow: 'rgba(255, 77, 94, 0.7)' },
    2: { value: 2, label: 'پشیمان', description: 'افتضاح بود و اگر به گذشته برگردم هرگز تماشا نخواهم کرد', color: '#ff9f43', emoji: '⭐⭐', glow: 'rgba(255, 159, 67, 0.7)' },
    3: { value: 3, label: 'خوب', description: 'خوب بود', color: '#9a9ab0', emoji: '⭐⭐⭐', glow: 'rgba(154, 154, 176, 0.5)' },
    4: { value: 4, label: 'راضی', description: 'خوب بود و خوشحالم که تماشا کردم', color: '#3ddc97', emoji: '⭐⭐⭐⭐', glow: 'rgba(61, 220, 151, 0.7)' },
    5: { value: 5, label: 'عالی', description: 'عالی بود به قدری که بیش از یک بار خواهم دید', color: '#ffd700', emoji: '⭐⭐⭐⭐⭐', glow: 'rgba(255, 215, 0, 0.8)' }
  },

  TASTE_PROFILE: {
    manifesto: 'داستان باید جهان خودش را بسازد، به قوانین خودش وفادار بماند، نتیجه را به دست بیاورد و به شعور مخاطب برای استنتاج آن اعتماد کند.',
    loves: [
      'انسجام روایی — جهان داستان به قواعد خودش وفادار می‌ماند',
      'علّیت طبیعی — هر اتفاق از رویدادهای قبلی بیرون می‌آید',
      'نتیجه به‌دست‌آمده — نه طلبیده‌شده',
      'اعتماد به هوش بیننده — نشان دادن، نه توضیح دادن',
      'شخصیت‌هایی که حتی وقتی اشتباه می‌کنند از خودشان بیرون می‌آیند',
      'پایان‌بندی معنادار — پاسخ به پرسش‌های اصلی',
      'لایه‌مندی — تماشای دوباره چیزهای تازه نشان می‌دهد',
      'جهان‌سازی منسجم — فانتزی یا رئال'
    ],
    hates: [
      'داستانی که همه‌چیز فدای ادامه‌یافتن می‌شود',
      'نقض قوانین خودِ داستان برای کش دادن',
      'احمق فرض کردن بیننده — توضیح مستقیم چیزی که باید نشان داده شود',
      'نخ‌های روایی رهاشده یا پاسخ‌های ساختگی',
      'تصمیم‌های بی‌دلیل شخصیت‌ها فقط برای حرکت پیرنگ',
      'فصل‌های پرکننده و فلش‌بک‌های بی‌هدف',
      'شخصیت‌هایی که شخصیتشان بر اساس نیاز لحظه عوض می‌شود',
      'نتایجی که از راه احساسی طلب می‌شوند',
      'دیکته کردن احساس از طرف نویسنده'
    ]
  },

  STORAGE: { THEME: 'cinema_theme', VIEW: 'cinema_view', STAR_FILTER: 'cinema_last_star_filter', AI_MODEL: 'cinema_ai_model' },
  DEFAULTS: { THEME: 'dark', VIEW: 'grid', STAR_FILTER: 'all' },

  TYPES: { series: 'سریال', movie: 'فیلم', anime: 'انیمیشن', documentary: 'مستند' },

  LIMITS: { TITLE_MAX: 200, NOTES_MAX: 2000, GENRE_MAX: 60, REASON_MAX: 800 },
  DEBOUNCE: { SEARCH: 220 },
  TOAST: { DURATION: 3800, MAX: 4 },
  UNDO: { DELETE_TIMEOUT: 5000 }
};
