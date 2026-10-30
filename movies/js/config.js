/* =========================================================
   پیکربندی برنامه
   =========================================================
   دو ارائه‌دهندهٔ AI در یک استخر واحد (`cinema_ai_models`):
     provider = 'google'      → Gemini مستقیم، سکرت سرور: GEM_MALI
     provider = 'openrouter'  → OpenRouter، سکرت سرور: OPENROUTER_API_KEY
   شناسهٔ یکتاساز هر مدل، `id` است — هرگز دو ردیف برای
   یک مدل ساخته نمی‌شود. مدل غیرفعال می‌شود، حذف نمی‌شود.
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '3.1.0-online',

  GITHUB: {
    API_BASE: 'https://api.github.com',
    DEFAULT_OWNER: 'vahidarmy',
    DEFAULT_REPO: 'vahidarmy.github.io',
    DEFAULT_BRANCH: 'master',
    DEFAULT_PATH: 'movies/data/cinema.sqlite',
    DB_FILENAME: 'cinema.sqlite',
    COMMIT_PREFIX: '🎬 cinema: '
  },

  AI: {
    /* AI حالا از طریق Edge Function اجرا می‌شود، نه مستقیم از مرورگر.
       دو سکرت روی سرور: GEM_MALI (Google) و OPENROUTER_API_KEY (OpenRouter). */
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    STORAGE_KEY: 'cinema_openrouter_key',
    MODEL_STORAGE_KEY: 'cinema_openrouter_model',
    DEFAULT_MODEL: 'gemini-3.8-flash',

    /* ==== استخر اولیه — فقط مدل‌های شناخته‌شده ====
       هر مدل شناسهٔ یکتای OpenRouter/Google دارد. دو Ling «-fin» و
       «-sante» عمداً جدا نگه داشته شده‌اند چون شاید نسخه‌های متفاوت
       باشند؛ اگر یکی از این دو تکراری بود، در roulette آزمون می‌شود و
       در صورت ناموفق، غیرفعال می‌ماند (حذف نمی‌شود). */
    MODELS: [
      /* ---- Google مستقیم ---- */
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', vendor: 'Google', provider: 'google', size: '—', context: '1M', speed: '—', note: 'مستقیم از Google — پیش‌فرض فعلی', tags: ['Google', 'مستقیم'], recommended: true, bestFor: 'analysis' },

      /* ---- OpenRouter (رایگان) ---- */
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', label: 'Nemotron 3 Ultra', vendor: 'NVIDIA', provider: 'openrouter', size: '5.86T', context: '1M', speed: '44', note: 'قدرتمندترین — پیشنهاد اول برای تحلیل داستانی', tags: ['تحلیل عمیق', 'کانتکست بزرگ'], recommended: true, bestFor: 'analysis' },
      { id: 'inclusionai/ling-3.0-flash-fin:free', label: 'Ling 3.0 Flash Fin', vendor: 'inclusionAI', provider: 'openrouter', size: '1.23T', context: '262K', speed: '147', note: 'سریع و متعادل — عالی برای استانداردسازی دسته‌ای', tags: ['سریع', 'تحلیل'], recommended: true, bestFor: 'batch' },
      { id: 'poolside/laguna-s-2.1:free', label: 'Laguna S 2.1', vendor: 'Poolside', provider: 'openrouter', size: '1.15T', context: '262K', speed: '37', note: 'قدرتمند با تمرکز روی منطق', tags: ['منطق', 'تحلیل'] },
      { id: 'dots-studio/dots-3-note-preview:free', label: 'Dots3 Note Preview', vendor: 'Dots Studio', provider: 'openrouter', size: '605B', context: '512K', speed: '58', note: 'کانتکست ۵۱۲K — مناسب توضیحات طولانی', tags: ['کانتکست بزرگ'], bestFor: 'long' },
      { id: 'nvidia/nemotron-3.5-lightning:free', label: 'Nemotron 3.5 Lightning', vendor: 'NVIDIA', provider: 'openrouter', size: '472B', context: '1M', speed: '35', note: 'کانتکست ۱M — سبک‌تر از Ultra', tags: ['کانتکست بزرگ'], bestFor: 'long' },
      { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super', vendor: 'NVIDIA', provider: 'openrouter', size: '332B', context: '262K', speed: '71', note: 'متعادل بین کیفیت و سرعت', tags: ['تحلیل', 'متعادل'] },
      { id: 'inclusionai/ling-3.0-flash-sante:free', label: 'Ling 3.0 Flash Sante', vendor: 'inclusionAI', provider: 'openrouter', size: '329B', context: '262K', speed: '147', note: 'سرعت بالا با تحلیل قابل قبول', tags: ['سریع', 'متعادل'] },
      { id: 'cohere/north-mini-code:free', label: 'North Mini Code', vendor: 'Cohere', provider: 'openrouter', size: '127B', context: '256K', speed: '72', note: 'بهینه برای کد و ساختار JSON', tags: ['کد', 'JSON'] },
      { id: 'poolside/laguna-xs-2.1:free', label: 'Laguna XS 2.1', vendor: 'Poolside', provider: 'openrouter', size: '83.5B', context: '262K', speed: '53', note: 'سبک و پایدار', tags: ['سبک'] },
      { id: 'qwen/qwen3.8-27b:free', label: 'Qwen3.8 27B', vendor: 'Qwen', provider: 'openrouter', size: '32.9B', context: '262K', speed: '35', note: 'چندزبانه با پشتیبانی خوب فارسی', tags: ['چندزبانه', 'سبک'] },
      { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron 3 Nano Omni', vendor: 'NVIDIA', provider: 'openrouter', size: '26.2B', context: '256K', speed: '41', note: 'چندوجهی و سبک', tags: ['سبک'] },
      { id: 'liquid/lfm-2.5-2.6b:free', label: 'LFM2.5 2.6B', vendor: 'LiquidAI', provider: 'openrouter', size: '18.7B', context: '66K', speed: '167', note: 'سریع‌ترین — مناسب تست سریع', tags: ['سریع‌ترین', 'سبک'] },
      { id: 'nvidia/nemotron-3.5-content-safety:free', label: 'Nemotron 3.5 Content Safety', vendor: 'NVIDIA', provider: 'openrouter', size: '2.21B', context: '128K', speed: '60', note: 'بهینه برای بررسی محتوا', tags: ['اختصاصی'] },
      { id: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B A4B', vendor: 'Google', provider: 'openrouter', size: '1.37B', context: '262K', speed: '34', note: 'MoE سبک از گوگل (از طریق OpenRouter)', tags: ['سبک', 'MoE'] },
      { id: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B', vendor: 'Google', provider: 'openrouter', size: '469M', context: '262K', speed: '13', note: 'سبک‌ترین Gemma (از طریق OpenRouter)', tags: ['سبک'] }
    ],
    BATCH_SIZE: 5
  },

  /* =========================================================
     Supabase — Edge Function با دو provider
     ========================================================= */
  SUPABASE: {
    URL: 'https://ummhohozmpwltbgeczsf.supabase.co',
    ANON_KEY: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',
    EDGE_FUNCTION: 'movies-quran'
  },

  /* =========================================================
     سیستم ستاره — معیار اصلی برنامه
     ========================================================= */
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
    ],
    gossipy: {
      definition: 'خاله‌زنکی: کیفیتی از روایت که تنش از راه‌های ساختگی و بی‌پشتوانه تولید می‌شود — نه از موقعیت، شخصیت یا قواعد جهان.',
      signals: [
        'سوءتفاهم‌هایی که با یک جمله حل می‌شدند',
        'شخصیت احمق‌ترین تصمیم را می‌گیرد فقط برای حفظ تنش',
        'رازهایی که صرفاً برای نگه‌داشتن درام پنهان می‌مانند',
        'پیچش‌های بی‌ریشه — از هوا می‌آیند',
        'شدت احساسی بزرگ‌تر از وزن واقعی رویداد',
        'خروج شخصیت از خودش صرفاً برای پیشبرد پیرنگ'
      ],
      scale: '۰ = هیچ — ۵ = محسوس — ۱۰ = کاملاً خاله‌زنکی',
      note: 'استفاده‌ی آگاهانه و ماهرانه از این عناصر، عیب نیست.'
    },
    antiBias: [
      'کار تو چاپلوسی نیست. اگر اثری ضعف دارد، نامش را ببر.',
      'اگر شواهد کافی نداری، صریح بگو.',
      'اول توصیف بی‌طرف، بعد داوری.',
      'از کلمات اغراق‌آمیز بپرهیز.'
    ]
  },

  STORAGE: {
    TOKEN: 'cinema_gh_token',
    SETTINGS: 'cinema_settings',
    LOCAL_DB: 'cinema_local_db',
    THEME: 'cinema_theme',
    VIEW: 'cinema_view',
    LAST_STAR_FILTER: 'cinema_last_star_filter'
  },

  DEFAULTS: { THEME: 'dark', VIEW: 'grid', STAR_FILTER: 'all' },

  TYPES: {
    series: 'سریال',
    movie: 'فیلم',
    anime: 'انیمیشن',
    documentary: 'مستند'
  },

  GENRES: [
    'کمدی', 'درام', 'جنایی', 'تریلر', 'علمی-تخیلی', 'فانتزی',
    'انیمیشن', 'مستند', 'عاشقانه', 'ترسناک', 'معمایی', 'ماجراجویی',
    'بیوگرافی', 'تاریخی', 'خانوادگی', 'موزیکال', 'ورزشی', 'جنگی'
  ],

  LIMITS: { TITLE_MAX: 200, NOTES_MAX: 2000, GENRE_MAX: 60, REASON_MAX: 800 },

  SHORTCUTS: { SEARCH: 'k', NEW: 'n', CLOSE: 'Escape', STATS: 's', SYNC: 'r' },

  DEBOUNCE: { SEARCH: 220, SAVE: 800 },

  TOAST: { DURATION: 3800, MAX: 4 },

  UNDO: { DELETE_TIMEOUT: 5000 }
};

window.CONFIG.DEBUG = false;