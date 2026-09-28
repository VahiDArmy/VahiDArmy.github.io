/* =========================================================
   پیکربندی برنامه
   ========================================================= */
window.CONFIG = {
  APP_NAME: 'سینما من',
  APP_VERSION: '1.6.0',

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
     AI — مدل‌های رایگان OpenRouter (IDهای معتبر)
     ========================================================= */
  AI: {
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    STORAGE_KEY: 'cinema_openrouter_key',
    MODEL_STORAGE_KEY: 'cinema_openrouter_model',

    /* پیش‌فرض: DeepSeek R1 — مدل استدلالی قوی برای تحلیل داستانی */
    DEFAULT_MODEL: 'deepseek/deepseek-r1:free',

    MODELS: [
      /* ---------- مدل‌های استدلالی (بهترین برای تحلیل داستانی) ---------- */
      {
        id: 'deepseek/deepseek-r1:free',
        label: 'DeepSeek R1',
        vendor: 'DeepSeek',
        size: '671B (37B active)',
        context: '64K',
        speed: '—',
        note: 'مدل استدلالی قوی — پیشنهاد اول برای تحلیل داستانی عمیق',
        tags: ['استدلالی', 'تحلیل عمیق'],
        recommended: true,
        bestFor: 'analysis'
      },
      {
        id: 'deepseek/deepseek-r1-distill-llama-70b:free',
        label: 'DeepSeek R1 Distill 70B',
        vendor: 'DeepSeek',
        size: '70B',
        context: '128K',
        speed: '—',
        note: 'نسخه‌ی سبک‌تر R1 — سریع‌تر از R1 اصلی',
        tags: ['استدلالی', 'سبک‌تر'],
        recommended: true,
        bestFor: 'analysis'
      },
      {
        id: 'qwen/qwq-32b:free',
        label: 'QwQ 32B',
        vendor: 'Qwen',
        size: '32B',
        context: '32K',
        speed: '—',
        note: 'مدل استدلالی سبک از Qwen',
        tags: ['استدلالی']
      },

      /* ---------- مدل‌های عمومی (خوب برای استانداردسازی) ---------- */
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        label: 'Llama 3.3 70B Instruct',
        vendor: 'Meta',
        size: '70B',
        context: '128K',
        speed: '—',
        note: 'مدل عمومی قدرتمند — عالی برای استانداردسازی دسته‌ای',
        tags: ['عمومی', 'متعادل'],
        recommended: true,
        bestFor: 'batch'
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct:free',
        label: 'Llama 3.1 8B Instruct',
        vendor: 'Meta',
        size: '8B',
        context: '128K',
        speed: '—',
        note: 'سبک و سریع — مناسب کارهای ساده',
        tags: ['سبک', 'سریع'],
        bestFor: 'batch'
      },
      {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        label: 'Llama 3.2 3B Instruct',
        vendor: 'Meta',
        size: '3B',
        context: '128K',
        speed: '—',
        note: 'سبک‌ترین Llama',
        tags: ['سبک']
      },

      /* ---------- Google ---------- */
      {
        id: 'google/gemini-2.0-flash-exp:free',
        label: 'Gemini 2.0 Flash Exp',
        vendor: 'Google',
        size: '—',
        context: '1M',
        speed: '—',
        note: 'کانتکست ۱M — سریع و باکیفیت',
        tags: ['کانتکست بزرگ', 'سریع'],
        recommended: true,
        bestFor: 'long'
      },
      {
        id: 'google/gemma-2-9b-it:free',
        label: 'Gemma 2 9B',
        vendor: 'Google',
        size: '9B',
        context: '8K',
        speed: '—',
        note: 'سبک از گوگل',
        tags: ['سبک']
      },

      /* ---------- Qwen ---------- */
      {
        id: 'qwen/qwen-2.5-72b-instruct:free',
        label: 'Qwen 2.5 72B Instruct',
        vendor: 'Qwen',
        size: '72B',
        context: '32K',
        speed: '—',
        note: 'چندزبانه با پشتیبانی خوب فارسی',
        tags: ['چندزبانه', 'قدرتمند']
      },
      {
        id: 'qwen/qwen-2.5-7b-instruct:free',
        label: 'Qwen 2.5 7B Instruct',
        vendor: 'Qwen',
        size: '7B',
        context: '32K',
        speed: '—',
        note: 'سبک از Qwen',
        tags: ['سبک', 'چندزبانه']
      },

      /* ---------- DeepSeek Chat ---------- */
      {
        id: 'deepseek/deepseek-chat:free',
        label: 'DeepSeek V3',
        vendor: 'DeepSeek',
        size: '671B',
        context: '64K',
        speed: '—',
        note: 'مدل عمومی قوی — جایگزین خوب برای R1',
        tags: ['عمومی', 'قدرتمند']
      },
      {
        id: 'deepseek/deepseek-chat-v3-0324:free',
        label: 'DeepSeek V3 0324',
        vendor: 'DeepSeek',
        size: '671B',
        context: '160K',
        speed: '—',
        note: 'نسخه‌ی جدیدتر V3',
        tags: ['عمومی', 'قدرتمند']
      },

      /* ---------- Mistral ---------- */
      {
        id: 'mistralai/mistral-nemo:free',
        label: 'Mistral Nemo',
        vendor: 'Mistral',
        size: '12B',
        context: '128K',
        speed: '—',
        note: 'متعادل و پایدار',
        tags: ['متعادل']
      },
      {
        id: 'mistralai/mistral-7b-instruct:free',
        label: 'Mistral 7B Instruct',
        vendor: 'Mistral',
        size: '7B',
        context: '32K',
        speed: '—',
        note: 'سبک و شناخته‌شده',
        tags: ['سبک']
      },

      /* ---------- NVIDIA ---------- */
      {
        id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
        label: 'Nemotron 70B',
        vendor: 'NVIDIA',
        size: '70B',
        context: '128K',
        speed: '—',
        note: 'بهینه‌شده توسط NVIDIA روی Llama 3.1',
        tags: ['تحلیل', 'متعادل']
      },

      /* ---------- Nous Research ---------- */
      {
        id: 'nousresearch/hermes-3-llama-3.1-405b:free',
        label: 'Hermes 3 405B',
        vendor: 'Nous Research',
        size: '405B',
        context: '128K',
        speed: '—',
        note: 'بزرگ‌ترین مدل رایگان — کیفیت بالا',
        tags: ['قدرتمند', 'بزرگ']
      },

      /* ---------- Microsoft ---------- */
      {
        id: 'microsoft/phi-3-medium-128k-instruct:free',
        label: 'Phi-3 Medium 128K',
        vendor: 'Microsoft',
        size: '14B',
        context: '128K',
        speed: '—',
        note: 'سبک با کانتکست بزرگ',
        tags: ['سبک', 'کانتکست بزرگ']
      },

      /* ---------- دیگران ---------- */
      {
        id: 'sao10k/l3.1-euryale-70b:free',
        label: 'Euryale 70B',
        vendor: 'Sao10K',
        size: '70B',
        context: '8K',
        speed: '—',
        note: 'بهینه برای روایت خلاقانه',
        tags: ['خلاقیت', 'روایت']
      },
      {
        id: 'undi95/toppy-m-7b:free',
        label: 'Toppy M 7B',
        vendor: 'Undi95',
        size: '7B',
        context: '4K',
        speed: '—',
        note: 'سبک — مناسب تست سریع',
        tags: ['سبک', 'سریع']
      },
      {
        id: 'huggingfaceh4/zephyr-7b-beta:free',
        label: 'Zephyr 7B Beta',
        vendor: 'HuggingFace',
        size: '7B',
        context: '32K',
        speed: '—',
        note: 'سبک و پایدار',
        tags: ['سبک']
      },
      {
        id: 'cognitivecomputations/dolphin3.0-mistral-24b:free',
        label: 'Dolphin 3.0 Mistral 24B',
        vendor: 'Cognitive Computations',
        size: '24B',
        context: '32K',
        speed: '—',
        note: 'متعادل و بدون سانسور',
        tags: ['متعادل']
      },
      {
        id: 'liquid/lfm-40b:free',
        label: 'LFM 40B',
        vendor: 'Liquid',
        size: '40B',
        context: '32K',
        speed: '—',
        note: 'مدل Liquid',
        tags: ['متعادل']
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