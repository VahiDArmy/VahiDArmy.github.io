/**
 * بازاربان — پیکربندی مرکزی
 * ---------------------------------------------------------------------------
 * تمام ثابت‌های دامنه، برچسب‌های فارسی، نام جدول‌های پیشوند‌دار (`smr_`) و
 * تنظیمات اتصال به Supabase در همین فایل زندگی می‌کنند.
 *
 * توجه: کلید زیر «publishable» است و برای استفاده در مرورگر طراحی شده؛
 * امنیت واقعی با RLS و سیاست‌های جدول‌ها تأمین می‌شود. هیچ کلید secret
 * یا service_role نباید در این پروژه قرار بگیرد.
 */

export const CONFIG = Object.freeze({
  APP_NAME: 'بازاربان',
  APP_NAME_EN: 'BazaarBan',
  TAGLINE: 'حافظهٔ جمعی خرید آنلاین',
  VERSION: '1.0.0',
  STORE_VERSION: 5,

  SUPABASE_URL: 'https://ummhohozmpwltbgeczsf.supabase.co',
  SUPABASE_KEY: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',

  PREFIX: 'smr_',
  TABLES: Object.freeze({
    vendors: 'smr_vendors',
    shops: 'smr_shops',
    products: 'smr_products',
    comments: 'smr_comments',
    ratings: 'smr_ratings',
    votes: 'smr_comment_votes',
    lists: 'smr_lists',
    listItems: 'smr_list_items',
    reports: 'smr_reports',
    activity: 'smr_activity',
    profiles: 'smr_profiles',
  }),

  /** کلیدهای ذخیره‌سازی محلی */
  LS: Object.freeze({
    theme: 'bb:theme',
    density: 'bb:density',
    demoState: 'bb:demo:state',
    demoAuth: 'bb:demo:auth',
    compare: 'bb:compare',
    recent: 'bb:recent',
    filters: 'bb:filters',
    onboarded: 'bb:onboarded',
    palette: 'bb:palette',
  }),

  /** مسیرهای اصلی برنامه (رابطهٔ مستقیم با router.js) */
  ROUTES: Object.freeze({
    home: '/',
    vendors: '/vendors',
    vendor: '/vendor/:slug',
    shops: '/shops',
    shop: '/shop/:id',
    products: '/products',
    product: '/product/:id',
    reviews: '/reviews',
    compare: '/compare',
    me: '/me',
    newEntry: '/new',
    login: '/login',
    search: '/search',
    guide: '/guide',
    about: '/about',
  }),

  PAGE_SIZE: 12,
  PAGE_SIZE_SMALL: 6,
  COMPARE_MAX: 4,
  COMMENT_MAX: 1200,
  COMMENT_MIN: 6,

  /** سه سطح امتیاز — قلب مدل داده */
  LEVELS: Object.freeze([
    Object.freeze({
      id: 'good',
      label: 'خوب',
      short: 'خوب',
      emoji: '🙂',
      icon: 'smile',
      score: 1,
      stars: 5,
      color: 'var(--good)',
      className: 'good',
      hint: 'رضایت واقعی؛ سفارش سالم، به‌موقع و مطابق انتظار.',
      explanation: 'اگر دوباره بدون تردید از همین‌جا خرید می‌کنی.',
    }),
    Object.freeze({
      id: 'meh',
      label: 'نه‌خوب',
      short: 'نه‌خوب',
      emoji: '😐',
      icon: 'meh',
      score: 0,
      stars: 3,
      color: 'var(--meh)',
      className: 'meh',
      hint: 'قابل تحمل ولی بی‌دردسر نیست؛ حواست باشد.',
      explanation: 'اگر خرید می‌کنی، اما با احتیاط و چک‌کردن جزئیات.',
    }),
    Object.freeze({
      id: 'bad',
      label: 'افتضاح',
      short: 'افتضاح',
      emoji: '🙁',
      icon: 'frown',
      score: -1,
      stars: 1,
      color: 'var(--bad)',
      className: 'bad',
      hint: 'پشیمانی؛ از این‌جا دیگر خرید نکن.',
      explanation: 'اگر تجربه‌ات آن‌قدر بد بود که به دیگران هشدار می‌دهی.',
    }),
  ]),

  LEVEL_MAP: Object.freeze({ good: 1, meh: 0, bad: -1 }),

  /** انواع موجودیت */
  ENTITY_TYPES: Object.freeze([
    Object.freeze({
      id: 'vendor',
      label: 'فروشنده',
      plural: 'فروشنده‌ها',
      icon: 'store',
      table: 'vendors',
      param: 'slug',
      basePath: '/vendor/',
      hint: 'پلتفرم یا برندی که از آن سفارش می‌دهی.',
    }),
    Object.freeze({
      id: 'shop',
      label: 'فروشگاه',
      plural: 'فروشگاه‌ها',
      icon: 'building',
      table: 'shops',
      param: 'id',
      basePath: '/shop/',
      hint: 'شعبه یا فروشگاه فیزیکی مشخص با آدرس و ساعات کاری.',
    }),
    Object.freeze({
      id: 'product',
      label: 'محصول',
      plural: 'محصولات',
      icon: 'package',
      table: 'products',
      param: 'id',
      basePath: '/product/',
      hint: 'کالای مشخص؛ برند، دسته و واحد فروش.',
    }),
  ]),

  ENTITY_MAP: Object.freeze({
    vendor: { label: 'فروشنده', plural: 'فروشنده‌ها', icon: 'store', basePath: '/vendor/', param: 'slug' },
    shop: { label: 'فروشگاه', plural: 'فروشگاه‌ها', icon: 'building', basePath: '/shop/', param: 'id' },
    product: { label: 'محصول', plural: 'محصولات', icon: 'package', basePath: '/product/', param: 'id' },
  }),

  /** نوع فروشنده */
  KINDS: Object.freeze([
    Object.freeze({ id: 'platform', label: 'پلتفرم و سوپراپ', icon: 'layers', hint: 'سرویس بزرگ با چند سرویس زیرمجموعه' }),
    Object.freeze({ id: 'marketplace', label: 'مارکت‌پلیس', icon: 'store', hint: 'چند فروشنده زیر یک سقف' }),
    Object.freeze({ id: 'chain', label: 'فروشگاه زنجیره‌ای', icon: 'building', hint: 'شعبه‌های متعدد با برند واحد' }),
    Object.freeze({ id: 'local', label: 'فروشگاه محلی', icon: 'map-pin', hint: 'فروشگاه مستقل و محلی' }),
    Object.freeze({ id: 'online', label: 'فروشگاه اینترنتی', icon: 'globe', hint: 'فقط آنلاین، بدون شعبهٔ حضوری' }),
  ]),

  KIND_MAP: Object.freeze({
    platform: 'پلتفرم و سوپراپ',
    marketplace: 'مارکت‌پلیس',
    chain: 'فروشگاه زنجیره‌ای',
    local: 'فروشگاه محلی',
    online: 'فروشگاه اینترنتی',
  }),

  /** دسته‌بندی محصولات */
  CATEGORIES: Object.freeze([
    Object.freeze({ id: 'produce', label: 'میوه و سبزی', icon: 'apple', color: 'var(--cat-produce)' }),
    Object.freeze({ id: 'dairy', label: 'لبنیات', icon: 'milk', color: 'var(--cat-dairy)' }),
    Object.freeze({ id: 'bakery', label: 'نان و شیرینی', icon: 'bread', color: 'var(--cat-bakery)' }),
    Object.freeze({ id: 'protein', label: 'گوشت، مرغ و پروتئین', icon: 'protein', color: 'var(--cat-protein)' }),
    Object.freeze({ id: 'pantry', label: 'خواروبار و حبوبات', icon: 'pantry', color: 'var(--cat-pantry)' }),
    Object.freeze({ id: 'drinks', label: 'نوشیدنی', icon: 'drink', color: 'var(--cat-drinks)' }),
    Object.freeze({ id: 'snacks', label: 'تنقلات و شکلات', icon: 'snack', color: 'var(--cat-snacks)' }),
    Object.freeze({ id: 'household', label: 'خانه و نظافت', icon: 'spray', color: 'var(--cat-household)' }),
    Object.freeze({ id: 'personal', label: 'بهداشت شخصی', icon: 'personal', color: 'var(--cat-personal)' }),
    Object.freeze({ id: 'frozen', label: 'منجمد و بستنی', icon: 'snowflake', color: 'var(--cat-frozen)' }),
    Object.freeze({ id: 'other', label: 'سایر', icon: 'package', color: 'var(--cat-other)' }),
  ]),

  CATEGORY_MAP: Object.freeze({
    produce: 'میوه و سبزی',
    dairy: 'لبنیات',
    bakery: 'نان و شیرینی',
    protein: 'گوشت، مرغ و پروتئین',
    pantry: 'خواروبار و حبوبات',
    drinks: 'نوشیدنی',
    snacks: 'تنقلات و شکلات',
    household: 'خانه و نظافت',
    personal: 'بهداشت شخصی',
    frozen: 'منجمد و بستنی',
    other: 'سایر',
  }),

  CITIES: Object.freeze([
    'تهران',
    'کرج',
    'مشهد',
    'اصفهان',
    'شیراز',
    'تبریز',
    'اهواز',
    'قم',
    'رشت',
    'یزد',
    'کرمان',
    'ارومیه',
    'بندرعباس',
    'همدان',
  ]),

  /** گزینه‌های مرتب‌سازی */
  SORTS: Object.freeze({
    vendor: Object.freeze([
      Object.freeze({ id: 'score_desc', label: 'بهترین امتیاز' }),
      Object.freeze({ id: 'score_asc', label: 'بدترین امتیاز' }),
      Object.freeze({ id: 'reviews_desc', label: 'پرنقدترین' }),
      Object.freeze({ id: 'newest', label: 'تازه‌ترین' }),
      Object.freeze({ id: 'name_asc', label: 'الفبا' }),
    ]),
    shop: Object.freeze([
      Object.freeze({ id: 'score_desc', label: 'بهترین امتیاز' }),
      Object.freeze({ id: 'reviews_desc', label: 'پرنقدترین' }),
      Object.freeze({ id: 'newest', label: 'تازه‌ترین' }),
      Object.freeze({ id: 'name_asc', label: 'الفبا' }),
      Object.freeze({ id: 'city', label: 'شهر' }),
    ]),
    product: Object.freeze([
      Object.freeze({ id: 'score_desc', label: 'بهترین امتیاز' }),
      Object.freeze({ id: 'score_asc', label: 'بدترین امتیاز' }),
      Object.freeze({ id: 'price_asc', label: 'ارزان‌ترین' }),
      Object.freeze({ id: 'price_desc', label: 'گران‌ترین' }),
      Object.freeze({ id: 'newest', label: 'تازه‌ترین' }),
      Object.freeze({ id: 'name_asc', label: 'الفبا' }),
    ]),
  }),

  /** برچسب‌های پیشنهادی نقد */
  COMMENT_TAGS: Object.freeze([
    'تحویل سریع',
    'بسته‌بندی سالم',
    'کیفیت بالا',
    'ارزان و به‌صرفه',
    'همان تصویر',
    'دیر رسید',
    'بسته‌بندی خراب',
    'سفارش ناقص',
    'تاریخ انقضا',
    'کیفیت پایین',
    'پشتیبانی بد',
    'گران‌تر از بازار',
    'موجودی اشتباه',
    'بدون فاکتور',
  ]),

  REPORT_REASONS: Object.freeze([
    Object.freeze({ id: 'spam', label: 'اسپم یا تبلیغ' }),
    Object.freeze({ id: 'abuse', label: 'توهین و بی‌احترامی' }),
    Object.freeze({ id: 'fake', label: 'تجربهٔ جعلی یا نامرتبط' }),
    Object.freeze({ id: 'personal', label: 'اطلاعات شخصی' }),
    Object.freeze({ id: 'other', label: 'دلیل دیگر' }),
  ]),

  /** آستانه‌های قضاوت */
  THRESHOLDS: Object.freeze({
    good: 30,
    bad: -20,
    minRatingsForVerdict: 1,
    mixedSpread: 25,
  }),

  /** متن‌های راهنما */
  COPY: Object.freeze({
    levelQuestion: 'تجربه‌ات چطور بود؟',
    levelHelp: 'یک انتخاب کافی است؛ بدون ستاره، بدون عدد.',
    loginNeeded: 'برای ثبت امتیاز و نظر باید وارد شوی.',
    demoNotice: 'حالت محلی: داده‌ها فقط در همین مرورگر ذخیره می‌شوند.',
  }),
});

/* دسترسی کوتاه و خوانا */
export const LEVELS = CONFIG.LEVELS;
export const LEVEL_MAP = CONFIG.LEVEL_MAP;
export const CATEGORIES = CONFIG.CATEGORIES;
export const CITIES = CONFIG.CITIES;
export const KINDS = CONFIG.KINDS;

export const levelById = (id) => LEVELS.find((l) => l.id === id) || null;

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const kindById = (id) => KINDS.find((k) => k.id === id) || null;

export const entityMeta = (type) => CONFIG.ENTITY_MAP[type] || null;

export const entityHref = (type, entity) => {
  const meta = CONFIG.ENTITY_MAP[type];
  if (!meta || !entity) return '#/';
  const key = meta.param === 'slug' ? entity.slug : entity.id;
  return `#${meta.basePath}${key}`;
};

export const supabaseConfigured = () =>
  Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && CONFIG.SUPABASE_URL.startsWith('https://'));
