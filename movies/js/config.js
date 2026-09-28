/* =========================================================
   پیکربندی برنامه
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '1.7.1',

  GITHUB: {
    API_BASE: 'https://api.github.com',
    DEFAULT_OWNER: 'vahidarmy',
    DEFAULT_REPO: 'vahidarmy.github.io',
    DEFAULT_BRANCH: 'master',
    DEFAULT_PATH: 'movies/data/cinema.sqlite',
    DB_FILENAME: 'cinema.sqlite',
    COMMIT_PREFIX: '🎬 cinema: '
  },

  /* =========================================================
     AI — مدل‌های رایگان OpenRouter (slugهای دقیق و تست‌شده)
     ========================================================= */
  AI: {
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    STORAGE_KEY: 'cinema_openrouter_key',
    MODEL_STORAGE_KEY: 'cinema_openrouter_model',

    DEFAULT_MODEL: 'nvidia/nemotron-3-ultra-550b-a55b:free',

    MODELS: [
      {
        id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
        label: 'Nemotron 3 Ultra',
        vendor: 'NVIDIA',
        size: '5.86T',
        context: '1M',
        speed: '44',
        note: 'قدرتمندترین — پیشنهاد اول برای تحلیل داستانی',
        tags: ['تحلیل عمیق', 'کانتکست بزرگ'],
        recommended: true,
        bestFor: 'analysis'
      },
      {
        id: 'inclusionai/ling-3.0-flash-fin:free',
        label: 'Ling 3.0 Flash Fin',
        vendor: 'inclusionAI',
        size: '1.23T',
        context: '262K',
        speed: '147',
        note: 'سریع و متعادل — عالی برای استانداردسازی دسته‌ای',
        tags: ['سریع', 'تحلیل'],
        recommended: true,
        bestFor: 'batch'
      },
      {
        id: 'poolside/laguna-s-2.1:free',
        label: 'Laguna S 2.1',
        vendor: 'Poolside',
        size: '1.15T',
        context: '262K',
        speed: '37',
        note: 'قدرتمند با تمرکز روی منطق',
        tags: ['منطق', 'تحلیل']
      },
      {
        id: 'dots-studio/dots-3-note-preview:free',
        label: 'Dots3 Note Preview',
        vendor: 'Dots Studio',
        size: '605B',
        context: '512K',
        speed: '58',
        note: 'کانتکست ۵۱۲K — مناسب توضیحات طولانی',
        tags: ['کانتکست بزرگ'],
        bestFor: 'long'
      },
      {
        id: 'nvidia/nemotron-3.5-lightning:free',
        label: 'Nemotron 3.5 Lightning',
        vendor: 'NVIDIA',
        size: '472B',
        context: '1M',
        speed: '35',
        note: 'کانتکست ۱M — سبک‌تر از Ultra',
        tags: ['کانتکست بزرگ'],
        bestFor: 'long'
      },
      {
        id: 'nvidia/nemotron-3-super-120b-a12b:free',
        label: 'Nemotron 3 Super',
        vendor: 'NVIDIA',
        size: '332B',
        context: '262K',
        speed: '71',
        note: 'متعادل بین کیفیت و سرعت',
        tags: ['تحلیل', 'متعادل']
      },
      {
        id: 'inclusionai/ling-3.0-flash-sante:free',
        label: 'Ling 3.0 Flash Sante',
        vendor: 'inclusionAI',
        size: '329B',
        context: '262K',
        speed: '147',
        note: 'سرعت بالا با تحلیل قابل قبول',
        tags: ['سریع', 'متعادل']
      },
      /* --- thinkingmachines/inkling و inkling-small حذف شدند
         چون فقط روی ابزارهای agentic (Cursor و ...) کار می‌کنند --- */
      {
        id: 'cohere/north-mini-code:free',
        label: 'North Mini Code',
        vendor: 'Cohere',
        size: '127B',
        context: '256K',
        speed: '72',
        note: 'بهینه برای کد و ساختار JSON',
        tags: ['کد', 'JSON']
      },
      {
        id: 'poolside/laguna-xs-2.1:free',
        label: 'Laguna XS 2.1',
        vendor: 'Poolside',
        size: '83.5B',
        context: '262K',
        speed: '53',
        note: 'سبک و پایدار',
        tags: ['سبک']
      },
      {
        id: 'qwen/qwen3.8-27b:free',
        label: 'Qwen3.8 27B',
        vendor: 'Qwen',
        size: '32.9B',
        context: '262K',
        speed: '35',
        note: 'چندزبانه با پشتیبانی خوب فارسی',
        tags: ['چندزبانه', 'سبک']
      },
      {
        id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        label: 'Nemotron 3 Nano Omni',
        vendor: 'NVIDIA',
        size: '26.2B',
        context: '256K',
        speed: '41',
        note: 'چندوجهی و سبک',
        tags: ['سبک']
      },
      {
        id: 'liquid/lfm-2.5-2.6b:free',
        label: 'LFM2.5 2.6B',
        vendor: 'LiquidAI',
        size: '18.7B',
        context: '66K',
        speed: '167',
        note: 'سریع‌ترین — مناسب تست سریع',
        tags: ['سریع‌ترین', 'سبک']
      },
      {
        id: 'nvidia/nemotron-3.5-content-safety:free',
        label: 'Nemotron 3.5 Content Safety',
        vendor: 'NVIDIA',
        size: '2.21B',
        context: '128K',
        speed: '60',
        note: 'بهینه برای بررسی محتوا',
        tags: ['اختصاصی']
      },
      {
        id: 'google/gemma-4-26b-a4b-it:free',
        label: 'Gemma 4 26B A4B',
        vendor: 'Google',
        size: '1.37B',
        context: '262K',
        speed: '34',
        note: 'MoE سبک از گوگل — ممکن است گاهی rate-limited شود',
        tags: ['سبک', 'MoE']
      },
      {
        id: 'google/gemma-4-31b-it:free',
        label: 'Gemma 4 31B',
        vendor: 'Google',
        size: '469M',
        context: '262K',
        speed: '13',
        note: 'سبک‌ترین Gemma',
        tags: ['سبک']
      }
    ],

    BATCH_SIZE: 5
  },

  /* =========================================================
     پروفایل سلیقه
     ========================================================= */
  TASTE_PROFILE: {
    manifesto: `داستانِ دوست‌داشتنی، حتی اگر کاملاً غیرواقعی باشد، در جهانِ خودش صادق و منسجم می‌ماند. اتفاقات باید از شخصیت‌ها، روابط، قواعدِ جهان و رویدادهای قبلی به‌طور طبیعی بیرون بیایند. با داستانی که برای رسیدن به یک نتیجه‌ی احساسی یا اخلاقی، شخصیت‌ها و روابط را خم می‌کند، مشکلات را ماست‌مالی می‌کند، یا اتفاقاتِ معجزه‌وار و تصادفی وارد می‌کند، ارتباط نمی‌گیرم.

برای من مهم نیست شخصیت‌ها خوب باشند یا بد، داستان شاد باشد یا تاریک، واقع‌گرا باشد یا کاملاً فانتزی. مهم این است که داستان نتیجه‌اش را «به دست آورده باشد».

دوست ندارم نویسنده به من القا کند چه کسی را دوست داشته باشم، برای کسی دلسوزی کنم، یا از چه چیزی متأثر شوم. ترجیح می‌دهم خودش موقعیت را بسازد و اجازه بدهد من نتیجه را بفهمم.

در یک جمله: من بیشتر از «واقع‌گرایی»، دنبال «صداقت و انسجامِ روایی» هستم و از «احساسات و نتایجِ تحمیلی یا بی‌پشتوانه» بیزارم.`,

    loves: [
      'انسجامِ روایی — جهانِ داستان به قواعدِ خودش وفادار می‌ماند، حتی وقتی آن قواعد غیرواقعی‌اند',
      'علّیتِ طبیعی — هر اتفاق از شخصیت‌ها، روابط، یا رویدادهای قبلی بیرون می‌آید',
      'داستان نتیجه‌اش را «به دست می‌آورد»، نه اینکه آن را طلب کند',
      'نویسنده به هوشِ بیننده احترام می‌گذارد — موقعیت می‌سازد، احساس را دیکته نمی‌کند',
      'شخصیت‌ها حتی وقتی اشتباه می‌کنند، از شخصیتِ خودشان بیرون می‌آیند',
      'پایان‌بندی معنادار — پاسخِ پرسش‌های اصلی، نه تسکینِ احساسیِ صرف',
      'لایه‌مندی — تماشای دوباره چیزهای تازه‌ای نشان می‌دهد',
      'جهان‌سازیِ منسجم — فانتزی یا رئال، قواعد جهان روشن و پایدار'
    ],

    hates: [
      'داستانِ آبکی که همه‌چیز فدای ادامه‌یافتنِ اثر می‌شود',
      'نقضِ قوانینِ خودِ داستان صرفاً برای کش دادن یا پیچاندن',
      'احمق فرض کردنِ بیننده — توضیحِ مستقیمِ چیزی که باید نشان داده شود',
      'نخ‌های رواییِ رهاشده یا پاسخ‌های ساختگی',
      'تصمیم‌های بی‌دلیلِ شخصیت‌ها فقط برای حرکتِ پیرنگ',
      'فصل‌های پرکننده، فلش‌بک‌های بی‌هدف، و retcon',
      'شخصیت‌هایی که شخصیتشان بر اساس نیازِ لحظه عوض می‌شود',
      'نتایجی که از راه احساسی طلب می‌شوند نه از راه روایی',
      'دیکته کردن احساس از طرف نویسنده'
    ],

    gossipy: {
      definition: `«خاله‌زنکی» کیفیتی از روایت است که در آن تنش و درام از راه‌های ساختگی و بی‌پشتوانه تولید می‌شود — نه از موقعیت، شخصیت، یا قواعدِ جهان.`,
      signals: [
        'سوءتفاهم‌هایی که با یک جمله حل می‌شدند اما فصل‌ها کشیده می‌شوند',
        'شخصیت احمق‌ترین تصمیمِ ممکن را می‌گیرد فقط برای حفظِ تنش',
        'رازهایی که صرفاً برای نگه‌داشتنِ درام پنهان می‌مانند',
        'پیچش‌های بی‌ریشه — از هوا می‌آیند بدون کاشتِ قبلی',
        'شدتِ احساسی بزرگ‌تر از وزنِ واقعیِ رویداد',
        'خروجِ شخصیت از خودش صرفاً برای پیشبردِ پیرنگ',
        'رنجِ طولانی برای دستکاریِ احساسِ بیننده بدون دلیلِ روایی',
        'پایان‌بندی‌هایی که فقط تسکینِ احساسی می‌دهند',
        'گفتگوهایی که فقط برای «گفتن» اطلاعات به بیننده‌اند'
      ],
      scale: `۰ = هیچ اثری؛ روایت کاملاً مبتنی بر علّیت و شخصیت
۳ = به‌ندرت به تنشِ ساختگی پناه می‌برد
۵ = تکیه‌ی محسوس بر سوءتفاهم/رازنگهداری
۷ = مکرراً از احساس برای پوشاندنِ ضعفِ روایی استفاده می‌کند
۱۰ = کاملاً خاله‌زنکی`,
      note: `برخی آثار بزرگ از عناصر خاله‌زنکی به‌عنوان ابزار آگاهانه استفاده می‌کنند. تفاوت در «آگاهانه و ماهرانه» بودن است.`
    },

    antiBias: `⚠️ بی‌طرفانه تحلیل کن، نه اینکه پیش‌فرض‌های کاربر را تأیید کنی.

۱. کارِ تو «چاپلوسی» نیست. اگر اثری ضعف دارد، نامش را ببر.
۲. اگر اثری معیارها را نقض می‌کند اما ارزشی خارج از آن معیارها دارد، صریح بگو.
۳. اگر شواهد کافی نداری، صریح بگو.
۴. اگر مطمئن نیستی، «نامطمئن» بنویس. حدس نزن.
۵. اگر تحلیلت با دسته‌بندی کاربر تناقض دارد، در فیلد disagreement صریح بگو.
۶. اول توصیف، بعد داوری.
۷. از کلمات اغراق‌آمیز بپرهیز.
۸. اگر اثری را نمی‌شناسی، null بگذار و confidence را پایین اعلام کن.`
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