/* =========================================================
   پیکربندی برنامه
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '1.2.0',

  /* ---- ذخیره‌سازی گیت‌هاب ---- */
  GITHUB: {
    API_BASE: 'https://api.github.com',
    DEFAULT_OWNER: 'vahidarmy',
    DEFAULT_REPO: 'vahidarmy.github.io',
    DEFAULT_BRANCH: 'master',
    DEFAULT_PATH: 'movies/data/cinema.sqlite',
    DB_FILENAME: 'cinema.sqlite',
    COMMIT_PREFIX: '🎬 cinema: '
  },

  /* ---- OpenRouter AI ---- */
  AI: {
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    MODEL: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    STORAGE_KEY: 'cinema_openrouter_key',
    BATCH_SIZE: 5
  },

  /* ---- پروفایل سلیقه ----
     این متن به AI داده می‌شود تا تحلیل داستانی دقیق بدهد. */
  TASTE_PROFILE: {
    loves: [
      'داستان منسجم با قوانین مشخص و پایبندی کامل به همان قوانین در طول روایت',
      'شبکه‌ی منطقی علت و معلولی؛ هر اتفاق نتیجه‌ی چیزی است که قبلاً کاشته شده',
      'احترام به هوش بیننده — نویسنده پاسخ‌ها را در متن کاشته، نه در توضیح مستقیم',
      'شخصیت‌هایی با انگیزه‌های باورپذیر و تکامل منطقی',
      'پایان‌بندی معنادار که به نخ‌های اصلی پاسخ می‌دهد',
      'بازبینی‌پذیری: تماشای دوباره باعث کشف لایه‌های جدید می‌شود'
    ],
    hates: [
      'داستان آبکی که همه‌چیز فدای ادامه یافتن سریال می‌شود',
      'شکستن قوانین خودِ داستان فقط برای کش دادن',
      'فرض کردن بیننده به‌عنوان احمق — سوراخ‌های داستانی آشکار که با دیالوگ توضیح داده می‌شوند',
      'نخ‌های روایی که رها می‌شوند یا با پاسخ‌های ساختگی بسته می‌شوند',
      'پرش‌های غیرمنطقی و تصمیم‌های بی‌دلیل شخصیت‌ها فقط برای پیشبرد پیرنگ',
      'فصل‌های پرکننده، رویا/بازگشت به گذشته‌ی بی‌هدف، و retcon کردن',
      'شخصیت‌هایی که شخصیتشان بر اساس نیاز لحظه تغییر می‌کند (Character inconsistency)'
    ],
    instructions: `برای هر عنوان، داستان را با این معیارها بسنج:
- آیا نویسنده به قوانینی که خودش در جهان داستان ساخته پایبند مانده؟
- چند جا بیننده را احمق فرض کرده؟ (مثال مشخص بیاور)
- چند شبکه‌ی منطقی قوی وجود دارد که نتیجه‌ی کاشته‌های قبلی است؟ (مثال مشخص بیاور)
- آیا پایان/فصل‌های پایانی به نخ‌های اصلی پاسخ داده؟
- شخصیت‌ها انگیزه‌ی ثابت دارند یا بر اساس نیاز لحظه تغییر می‌کنند؟`
  },

  STORAGE: {
    TOKEN: 'cinema_gh_token',
    SETTINGS: 'cinema_settings',
    LOCAL_DB: 'cinema_local_db',
    THEME: 'cinema_theme',
    VIEW: 'cinema_view',
    LAST_CATEGORY: 'cinema_last_category'
  },

  DEFAULTS: { THEME: 'dark', VIEW: 'grid', CATEGORY: 'all' },

  TYPES: {
    series: 'سریال',
    movie: 'فیلم',
    anime: 'انیمیشن',
    documentary: 'مستند'
  },

  CATEGORIES: {
    all:  { label: 'همه',       emoji: '📚', color: '#8b5cff' },
    love: { label: 'عاشقشم',    emoji: '❤️', color: '#ff3b6b' },
    good: { label: 'خوب',       emoji: '👍', color: '#4dabf7' },
    hate: { label: 'دری وری',   emoji: '👎', color: '#ff9f43' }
  },

  GENRES: [
    'کمدی', 'درام', 'جنایی', 'تریلر', 'علمی-تخیلی', 'فانتزی',
    'انیمیشن', 'مستند', 'عاشقانه', 'ترسناک', 'معمایی', 'ماجراجویی',
    'بیوگرافی', 'تاریخی', 'خانوادگی', 'موزیکال', 'ورزشی', 'جنگی'
  ],

  LIMITS: { TITLE_MAX: 200, NOTES_MAX: 2000, GENRE_MAX: 60, REASON_MAX: 800 },

  SHORTCUTS: { SEARCH: 'k', NEW: 'n', CLOSE: 'Escape', STATS: 's', SYNC: 'r' },

  DEBOUNCE: { SEARCH: 220, SAVE: 800 },

  TOAST: { DURATION: 3800, MAX: 4 }
};

window.CONFIG.DEBUG = false;