/* =========================================================
   پیکربندی برنامه
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '1.1.0',

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

  /* ---- ذخیره‌سازی محلی ---- */
  STORAGE: {
    TOKEN: 'cinema_gh_token',
    SETTINGS: 'cinema_settings',
    LOCAL_DB: 'cinema_local_db',
    THEME: 'cinema_theme',
    VIEW: 'cinema_view',
    LAST_CATEGORY: 'cinema_last_category'
  },

  /* ---- پیش‌فرض‌ها ---- */
  DEFAULTS: {
    THEME: 'dark',
    VIEW: 'grid',
    CATEGORY: 'all'
  },

  /* ---- انواع محتوا ---- */
  TYPES: {
    series: 'سریال',
    movie: 'فیلم',
    anime: 'انیمیشن',
    documentary: 'مستند'
  },

  /* ---- دسته‌بندی‌ها (اصلاح‌شده) ---- */
  CATEGORIES: {
    all:  { label: 'همه',       emoji: '📚', color: '#8b5cff' },
    love: { label: 'عاشقشم',    emoji: '❤️', color: '#ff3b6b' },
    good: { label: 'خوب',       emoji: '👍', color: '#4dabf7' },
    hate: { label: 'دری وری',   emoji: '👎', color: '#ff9f43' }
  },

  /* ---- ژانرهای پیشنهادی ---- */
  GENRES: [
    'کمدی', 'درام', 'جنایی', 'تریلر', 'علمی-تخیلی', 'فانتزی',
    'انیمیشن', 'مستند', 'عاشقانه', 'ترسناک', 'معمایی', 'ماجراجویی',
    'بیوگرافی', 'تاریخی', 'خانوادگی', 'موزیکال', 'ورزشی', 'جنگی'
  ],

  LIMITS: {
    TITLE_MAX: 200,
    NOTES_MAX: 2000,
    GENRE_MAX: 60
  },

  SHORTCUTS: {
    SEARCH: 'k',
    NEW: 'n',
    CLOSE: 'Escape',
    STATS: 's',
    SYNC: 'r'
  },

  DEBOUNCE: {
    SEARCH: 220,
    SAVE: 800
  },

  TOAST: {
    DURATION: 3800,
    MAX: 4
  }
};

window.CONFIG.DEBUG = false;