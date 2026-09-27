/* =========================================================
   پیکربندی برنامه
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '1.0.0',

  /* ---- ذخیره‌سازی گیت‌هاب ---- */
  GITHUB: {
    API_BASE: 'https://api.github.com',

    /* ---- پیش‌فرض‌های ریپوی شما ---- */
    /* سایت روی vahidarmy.github.io/movies/ سرو می‌شود
       پس: repo = vahidarmy.github.io  و  path = movies/data/cinema.sqlite */
    DEFAULT_OWNER: 'vahidarmy',
    DEFAULT_REPO: 'vahidarmy.github.io',
    DEFAULT_BRANCH: 'master',
    DEFAULT_PATH: 'movies/data/cinema.sqlite',

    DB_FILENAME: 'cinema.sqlite',
    COMMIT_PREFIX: '🎬 cinema: ',

    /* ---- بازه‌ی polling برای بررسی تغییرات روی مخزن (ms) ---- */
    POLL_INTERVAL: 60000,

    /* ---- حداکثر حجم فایل دیتابیس برای push (بایت) ----
       GitHub Contents API برای فایل‌های بزرگ‌تر از 1MB محدودیت داره */
    MAX_SIZE_WARN: 900 * 1024
  },

  /* ---- ذخیره‌سازی محلی ---- */
  STORAGE: {
    TOKEN: 'cinema_gh_token',
    SETTINGS: 'cinema_settings',
    LOCAL_DB: 'cinema_local_db',
    THEME: 'cinema_theme',
    VIEW: 'cinema_view',
    LAST_CATEGORY: 'cinema_last_category',
    LAST_SYNC: 'cinema_last_sync',
    LAST_SHA: 'cinema_last_sha'
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

  /* ---- دسته‌بندی‌ها ---- */
  CATEGORIES: {
    all:  { label: 'همه',          emoji: '📚', color: '#7c5cff' },
    love: { label: 'عاشقانه',      emoji: '❤️', color: '#ff3b6b' },
    good: { label: 'خوب',          emoji: '👍', color: '#4dabf7' },
    hate: { label: 'نفرت‌انگیز',   emoji: '👎', color: '#ff9f43' }
  },

  /* ---- ژانرهای پیشنهادی ---- */
  GENRES: [
    'کمدی', 'درام', 'جنایی', 'تریلر', 'علمی-تخیلی', 'فانتزی',
    'انیمیشن', 'مستند', 'عاشقانه', 'ترسناک', 'معمایی', 'ماجراجویی',
    'بیوگرافی', 'تاریخی', 'خانوادگی', 'موزیکال', 'ورزشی', 'جنگی'
  ],

  /* ---- محدودیت‌ها ---- */
  LIMITS: {
    TITLE_MAX: 200,
    NOTES_MAX: 2000,
    GENRE_MAX: 60
  },

  /* ---- کلیدهای میان‌بر ---- */
  SHORTCUTS: {
    SEARCH: 'k',
    NEW: 'n',
    CLOSE: 'Escape',
    STATS: 's',
    SYNC: 'r'
  },

  /* ---- دیبانس ---- */
  DEBOUNCE: {
    SEARCH: 220,
    SAVE: 800
  },

  /* ---- نوتیفیکیشن ---- */
  TOAST: {
    DURATION: 3800,
    MAX: 4
  }
};

/* حالت توسعه */
window.CONFIG.DEBUG = false;