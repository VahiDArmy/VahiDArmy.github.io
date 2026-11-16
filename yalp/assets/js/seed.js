/**
 * بازاربان — دادهٔ نمایشی
 * ---------------------------------------------------------------------------
 * این فایل یک بازار نمونهٔ کامل می‌سازد تا پیش از اجرای فایل SQL، برنامه
 * قابل استفاده و قابل بررسی باشد. تمام نقدها، امتیازها و شعبه‌ها ساختگی‌اند
 * و صرفاً برای نمایش رابط ساخته شده‌اند.
 *
 * تولید کاملاً قطعی است (PRNG با دانهٔ ثابت) تا هر بار شکل یکسانی داشته باشد
 * و امتیازها بین بازدیدها تغییر نکنند.
 */

import { CONFIG } from './config.js';

/* --------------------------------------------------------------------------
   ابزار تولید قطعی
   -------------------------------------------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rnd, list) => list[Math.floor(rnd() * list.length)];
const between = (rnd, min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const some = (rnd, list, count) => {
  const copy = [...list];
  const out = [];
  for (let i = 0; i < count && copy.length; i += 1) {
    out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  }
  return out;
};

let idCounter = 0;
const demoId = () => {
  idCounter += 1;
  const tail = String(idCounter).padStart(12, '0');
  return `0d3e0a00-0000-4000-8000-${tail}`;
};

/* --------------------------------------------------------------------------
   شهرها و محله‌ها
   -------------------------------------------------------------------------- */
const NEIGHBORHOODS = {
  تهران: ['ونک', 'پونک', 'سعادت‌آباد', 'نیاوران', 'تجریش', 'شهرک غرب', 'گیشا', 'یوسف‌آباد', 'قیطریه', 'ستارخان'],
  کرج: ['عظیمیه', 'گوهردشت', 'مهرشهر', 'فرهنگ‌شهر'],
  مشهد: ['احمدآباد', 'وکیل‌آباد', 'قاسم‌آباد', 'بلوار سجاد'],
  اصفهان: ['سپاهان‌شهر', 'مرداویج', 'خانه اصفهان', 'چهارباغ'],
  شیراز: ['معالی‌آباد', 'قصردشت', 'صدرا', 'بلوار زند'],
  تبریز: ['ولیعصر', 'ائل‌گلی', 'باغمیشه'],
  اهواز: ['کیانپارس', 'زیتون', 'امانیه'],
  قم: ['صفائیه', 'پردیسان', 'شهرک قدس'],
  رشت: ['گلسار', 'منظریه', 'پیرسرا'],
};

const pickNeighborhood = (rnd, city) => {
  const list = NEIGHBORHOODS[city] || ['مرکز شهر'];
  return pick(rnd, list);
};

/* --------------------------------------------------------------------------
   فروشنده‌ها — با bias برای تولید امتیاز نمایشی
   -------------------------------------------------------------------------- */
const VENDOR_BLUEPRINT = [
  {
    slug: 'snappfood',
    name: 'اسنپ‌فود',
    nameFa: 'اسنپ‌فود',
    kind: 'platform',
    tagline: 'سوپراپ سفارش غذا و خرید روزانه',
    description:
      'یکی از بزرگ‌ترین پلتفرم‌های سفارش آنلاین در ایران؛ از رستوران و کافه تا سوپرمارکت و خرید روزانه. در بازاربان تجربهٔ خرید سوپرمارکتی این پلتفرم را جدا از بخش رستوران بررسی می‌کنیم.',
    website: 'https://snappfood.ir',
    city: 'تهران',
    brandHue: 42,
    isVerified: true,
    bias: 0.55,
    shops: 4,
    products: 5,
  },
  {
    slug: 'snapp-market',
    name: 'اسنپ‌مارکت',
    nameFa: 'اسنپ مارکت',
    kind: 'platform',
    tagline: 'خرید آنلاین سوپرمارکت با تحویل سریع',
    description:
      'فروشگاه آنلاین اسنپ برای خرید کالاهای سوپرمارکتی، با تمرکز بر تحویل سریع در شهرهای بزرگ و امکان انتخاب از فروشگاه‌های همکار.',
    website: 'https://snapp.market',
    city: 'تهران',
    brandHue: 129,
    isVerified: true,
    bias: 0.6,
    shops: 4,
    products: 5,
  },
  {
    slug: 'digikala',
    name: 'دیجی‌کالا',
    nameFa: 'دیجی‌کالا',
    kind: 'marketplace',
    tagline: 'بزرگ‌ترین مارکت‌پلیس آنلاین ایران',
    description:
      'مارکت‌پلیس گسترده با فروشندگان متعدد. برای کالاهای سوپرمارکتی، تجربه به فروشندهٔ طرف قرارداد و انبار مربوط است و بهتر است پیش از خرید، فروشنده را ببینید.',
    website: 'https://digikala.com',
    city: 'تهران',
    brandHue: 348,
    isVerified: true,
    bias: 0.62,
    shops: 3,
    products: 4,
  },
  {
    slug: 'digikala-jet',
    name: 'دیجی‌کالا جت',
    nameFa: 'دیجی‌کالا جت',
    kind: 'platform',
    tagline: 'تحویل سریع کالاهای روزمره',
    description:
      'سرویس تحویل سریع دیجی‌کالا برای کالاهای سوپرمارکتی و روزمره. تمرکز اصلی آن روی زمان رسیدن سفارش و موجودی انبارهای محلی است.',
    website: 'https://jet.digikala.com',
    city: 'تهران',
    brandHue: 344,
    isVerified: true,
    bias: 0.58,
    shops: 3,
    products: 4,
  },
  {
    slug: 'ofoq-koroush',
    name: 'افق کوروش',
    nameFa: 'افق کوروش',
    kind: 'chain',
    tagline: 'زنجیرهٔ سوپرمارکت با شعبه‌های فراوان',
    description:
      'زنجیرهٔ شناخته‌شدهٔ سوپرمارکت در ایران با تعداد زیاد شعبه. امکان خرید حضوری و در برخی شهرها سفارش تلفنی و آنلاین.',
    website: 'https://ofoghkoroush.com',
    city: 'تهران',
    brandHue: 205,
    isVerified: true,
    bias: 0.7,
    shops: 5,
    products: 4,
  },
  {
    slug: 'hyperstar',
    name: 'هایپراستار',
    nameFa: 'هایپراستار',
    kind: 'chain',
    tagline: 'هایپرمارکت با تنوع بالا',
    description:
      'هایپرمارکت‌های بزرگ با تنوع بالای کالا، بخش تازه و وارداتی. برای خرید عمده و اقلام خاص گزینهٔ رایجی است.',
    website: 'https://hyperstar.ir',
    city: 'تهران',
    brandHue: 15,
    isVerified: true,
    bias: 0.66,
    shops: 4,
    products: 3,
  },
  {
    slug: 'shahrvand',
    name: 'شهروند',
    nameFa: 'شهروند',
    kind: 'chain',
    tagline: 'فروشگاه زنجیره‌ای شهروند',
    description:
      'فروشگاه زنجیره‌ای قدیمی تهران با شعبه‌های متعدد. کیفیت شعبه‌ها بسته به محله تفاوت محسوسی دارد؛ در بازاربان شعبه‌ها جدا بررسی می‌شوند.',
    website: 'https://shahrvand.ir',
    city: 'تهران',
    brandHue: 197,
    isVerified: true,
    bias: 0.63,
    shops: 4,
    products: 3,
  },
  {
    slug: 'refah',
    name: 'رفاه',
    nameFa: 'رفاه',
    kind: 'chain',
    tagline: 'فروشگاه زنجیره‌ای رفاه',
    description:
      'فروشگاه زنجیره‌ای رفاه با شعبه‌های متعدد در تهران و چند شهر دیگر. قیمت‌گذاری رقابتی و تنوع متوسط.',
    website: 'https://refah.ir',
    city: 'تهران',
    brandHue: 158,
    isVerified: true,
    bias: 0.6,
    shops: 4,
    products: 3,
  },
  {
    slug: 'badkubeh',
    name: 'بادکوبه',
    nameFa: 'بادکوبه',
    kind: 'online',
    tagline: 'خرید آنلاین میوه و مواد غذایی',
    description:
      'فروشگاه اینترنتی با تمرکز بر میوه، سبزیجات و مواد غذایی تازه؛ بسته‌بندی و انتخاب محصول در آن نقش پررنگی دارد.',
    website: 'https://badkubeh.com',
    city: 'تهران',
    brandHue: 96,
    isVerified: false,
    bias: 0.52,
    shops: 2,
    products: 4,
  },
  {
    slug: 'janbo',
    name: 'جانبو',
    nameFa: 'جانبو',
    kind: 'chain',
    tagline: 'سوپرمارکت محله‌ای زنجیره‌ای',
    description:
      'زنجیرهٔ سوپرمارکت‌های کوچک‌تر با پوشش محله‌ای. برای خرید سریع روزمره مناسب است.',
    website: 'https://janbo.ir',
    city: 'تهران',
    brandHue: 320,
    isVerified: false,
    bias: 0.57,
    shops: 3,
    products: 3,
  },
  {
    slug: 'mahalle-ma',
    name: 'سوپرمارکت محلهٔ ما',
    nameFa: 'سوپرمارکت محله‌ی ما',
    kind: 'local',
    tagline: 'خرید محلی، تحویل همان روز',
    description:
      'فروشگاه محلی با سفارش تلفنی و واتساپی. قیمت‌ها نزدیک بازار است و تحویل معمولاً همان روز انجام می‌شود.',
    website: '',
    city: 'کرج',
    brandHue: 262,
    isVerified: false,
    bias: 0.48,
    shops: 3,
    products: 3,
  },
  {
    slug: 'bahar-produce',
    name: 'میوه‌سرای بهار',
    nameFa: 'میوه‌سرای بهار',
    kind: 'local',
    tagline: 'میوه و سبزی تازهٔ روز',
    description:
      'میوه‌سرای محلی با امکان سفارش تلفنی و انتخاب سبد میوه. مناسب کسانی که کیفیت میوه برایشان اولویت است.',
    website: '',
    city: 'اصفهان',
    brandHue: 84,
    isVerified: false,
    bias: 0.72,
    shops: 2,
    products: 3,
  },
  {
    slug: 'shahr-market',
    name: 'فروشگاه شهر',
    nameFa: 'فروشگاه شهر',
    kind: 'local',
    tagline: 'فروشگاه محلی با ارسال رایگان',
    description:
      'فروشگاه مستقل محلی با تنوع محدود اما قیمت رقابتی و ارسال رایگان برای خرید بالای مبلغ مشخص.',
    website: '',
    city: 'مشهد',
    brandHue: 30,
    isVerified: false,
    bias: 0.42,
    shops: 2,
    products: 2,
  },
  {
    slug: 'tehran-kala',
    name: 'تهران‌کالا',
    nameFa: 'تهران‌کالا',
    kind: 'online',
    tagline: 'فروشگاه اینترنتی کالاهای روزمره',
    description:
      'فروشگاه اینترنتی کوچک با تمرکز بر کالاهای روزمره و شوینده. ارسال در محدودهٔ تهران انجام می‌شود.',
    website: '',
    city: 'تهران',
    brandHue: 240,
    isVerified: false,
    bias: 0.38,
    shops: 2,
    products: 2,
  },
];

/* --------------------------------------------------------------------------
   قالب محصولات
   -------------------------------------------------------------------------- */
const PRODUCT_BLUEPRINT = [
  { name: 'شیر پرچرب ۱ لیتری', brand: 'میهن', category: 'dairy', unit: 'بطری ۱ لیتری', price: 42000 },
  { name: 'ماست یونانی کم‌چرب', brand: 'کاله', category: 'dairy', unit: 'دبه ۹۰۰ گرمی', price: 78000 },
  { name: 'پنیر سفید ایرانی', brand: 'صبحانه', category: 'dairy', unit: 'بسته ۴۰۰ گرمی', price: 96000 },
  { name: 'کره حیوانی', brand: 'دامداران', category: 'dairy', unit: 'بسته ۱۰۰ گرمی', price: 38000 },
  { name: 'نان بربری تازه', brand: 'نانوایی محله', category: 'bakery', unit: 'یک عدد', price: 25000 },
  { name: 'نان سنگک کنجدی', brand: 'نانوایی سنگکی', category: 'bakery', unit: 'یک عدد', price: 32000 },
  { name: 'کیک صبحانه', brand: 'شیرین‌عسل', category: 'bakery', unit: 'بسته ۶ عددی', price: 45000 },
  { name: 'سیب قرمز', brand: 'محصول ایران', category: 'produce', unit: 'کیلوگرم', price: 68000 },
  { name: 'موز', brand: 'وارداتی', category: 'produce', unit: 'کیلوگرم', price: 92000 },
  { name: 'خیار گلخانه‌ای', brand: 'محصول ایران', category: 'produce', unit: 'کیلوگرم', price: 54000 },
  { name: 'گوجه‌فرنگی', brand: 'محصول ایران', category: 'produce', unit: 'کیلوگرم', price: 39000 },
  { name: 'سبزی خوردن پاک‌شده', brand: 'سبزی روز', category: 'produce', unit: 'بسته ۴۰۰ گرمی', price: 28000 },
  { name: 'تخم‌مرغ بسته‌بندی', brand: 'تلاونگ', category: 'protein', unit: 'شانه ۲۰ عددی', price: 145000 },
  { name: 'سینه مرغ تازه', brand: 'مرغ روز', category: 'protein', unit: 'کیلوگرم', price: 198000 },
  { name: 'گوشت چرخ‌کرده مخلوط', brand: 'قصابی', category: 'protein', unit: 'کیلوگرم', price: 420000 },
  { name: 'ماهی قزل‌آلا', brand: 'پرورشی', category: 'protein', unit: 'کیلوگرم', price: 380000 },
  { name: 'برنج ایرانی هاشمی', brand: 'گوهر', category: 'pantry', unit: 'کیسه ۵ کیلویی', price: 720000 },
  { name: 'روغن مایع آفتابگردان', brand: 'غزال', category: 'pantry', unit: 'بطری ۱٫۸ لیتری', price: 165000 },
  { name: 'رب گوجه‌فرنگی', brand: 'روژین', category: 'pantry', unit: 'قوطی ۸۰۰ گرمی', price: 98000 },
  { name: 'ماکارونی رشته‌ای', brand: 'زر ماکارون', category: 'pantry', unit: 'بسته ۷۰۰ گرمی', price: 42000 },
  { name: 'عدس درشت', brand: 'حبوبات ایران', category: 'pantry', unit: 'بسته ۹۰۰ گرمی', price: 89000 },
  { name: 'شکر سفید', brand: 'قند ایران', category: 'pantry', unit: 'بسته ۲ کیلویی', price: 118000 },
  { name: 'چای سیاه کیسه‌ای', brand: 'گلستان', category: 'drinks', unit: 'بسته ۱۰۰ عددی', price: 210000 },
  { name: 'قهوه فوری', brand: 'نسکافه', category: 'drinks', unit: 'شیشه ۱۰۰ گرمی', price: 285000 },
  { name: 'آب معدنی', brand: 'دماوند', category: 'drinks', unit: 'بسته ۶ بطری', price: 72000 },
  { name: 'نوشابه خانواده', brand: 'کوکاکولا', category: 'drinks', unit: 'بطری ۱٫۵ لیتری', price: 48000 },
  { name: 'آب‌میوه طبیعی', brand: 'سن‌ایچ', category: 'drinks', unit: 'پاکت ۱ لیتری', price: 56000 },
  { name: 'شکلات تخته‌ای', brand: 'کفش‌دوز', category: 'snacks', unit: 'بسته ۸۰ گرمی', price: 65000 },
  { name: 'چیپس سرکه‌ای', brand: 'چی‌توز', category: 'snacks', unit: 'پاکت ۹۰ گرمی', price: 50000 },
  { name: 'پسته شور', brand: 'آجیل روز', category: 'snacks', unit: 'بسته ۲۵۰ گرمی', price: 290000 },
  { name: 'بیسکویت ساقه‌دار', brand: 'شیرین‌عسل', category: 'snacks', unit: 'بسته ۳ عددی', price: 32000 },
  { name: 'دستمال کاغذی', brand: 'کلینکس', category: 'household', unit: 'بسته ۲ عددی', price: 78000 },
  { name: 'مایع ظرفشویی', brand: 'فریکا', category: 'household', unit: 'بطری ۱ لیتری', price: 95000 },
  { name: 'شوینده سطوح', brand: 'سافتلن', category: 'household', unit: 'اسپری ۵۰۰ میلی‌لیتری', price: 112000 },
  { name: 'کیسه زباله بزرگ', brand: 'پاکسان', category: 'household', unit: 'بسته ۳۰ عددی', price: 42000 },
  { name: 'خمیردندان', brand: 'کرست', category: 'personal', unit: 'تیوب ۱۰۰ میلی‌لیتری', price: 88000 },
  { name: 'شامپو تقویت‌کننده', brand: 'هربال', category: 'personal', unit: 'بطری ۴۰۰ میلی‌لیتری', price: 185000 },
  { name: 'صابون بانوان', brand: 'کامان', category: 'personal', unit: 'بسته ۳ عددی', price: 64000 },
  { name: 'بستنی سنتی', brand: 'بستنی شاد', category: 'frozen', unit: 'بسته ۵۰۰ گرمی', price: 135000 },
  { name: 'پیتزا منجمد', brand: 'دلوسا', category: 'frozen', unit: 'بسته ۲ عددی', price: 198000 },
  { name: 'سبزیجات مخلوط منجمد', brand: 'چین چین', category: 'frozen', unit: 'بسته ۴۰۰ گرمی', price: 72000 },
  { name: 'نان تست', brand: 'نان آوران', category: 'bakery', unit: 'بسته ۴۵۰ گرمی', price: 58000 },
  { name: 'عسل طبیعی', brand: 'کوهسار', category: 'pantry', unit: 'شیشه ۵۰۰ گرمی', price: 350000 },
  { name: 'زیتون پرورده', brand: 'گیلانه', category: 'pantry', unit: 'بسته ۴۰۰ گرمی', price: 128000 },
  { name: 'پنیر پیتزا', brand: 'کاله', category: 'dairy', unit: 'بسته ۴۰۰ گرمی', price: 172000 },
  { name: 'کشمش پلویی', brand: 'ملایر', category: 'pantry', unit: 'بسته ۵۰۰ گرمی', price: 165000 },
  { name: 'دستمال مرطوب', brand: 'بی‌بی', category: 'personal', unit: 'بسته ۷۲ عددی', price: 96000 },
  { name: 'صابون مایع', brand: 'گل‌رنگ', category: 'personal', unit: 'پمپ ۵۰۰ میلی‌لیتری', price: 84000 },
];

/* --------------------------------------------------------------------------
   نویسندگان نمونه
   -------------------------------------------------------------------------- */
const AUTHORS = [
  { name: 'نگار احمدی', hue: 152 },
  { name: 'سعید مرادی', hue: 268 },
  { name: 'مریم رضایی', hue: 20 },
  { name: 'امیرحسین کریمی', hue: 194 },
  { name: 'الهام موسوی', hue: 330 },
  { name: 'محمد تهرانی', hue: 48 },
  { name: 'پریسا شریفی', hue: 110 },
  { name: 'رضا اکبری', hue: 282 },
  { name: 'سارا نوری', hue: 8 },
  { name: 'کیوان رستمی', hue: 176 },
  { name: 'هستی صادقی', hue: 310 },
  { name: 'بهنام فرهادی', hue: 88 },
];

/* --------------------------------------------------------------------------
   قالب‌های نقد
   -------------------------------------------------------------------------- */
const COMMENT_TEMPLATES = {
  vendor: {
    good: [
      'سه سفارش پشت‌سرهم دادم و هر سه بار سر وقت رسید. بسته‌بندی هم مرتب بود و هیچ‌وقت آیتم کم نیامد.',
      'پشتیبانی واقعاً پاسخ می‌دهد. یک قلم را اشتباه فرستاده بودند، همان روز مبلغ را برگرداندند.',
      'برای خرید هفتگی خانه از همین‌جا استفاده می‌کنم. قیمت‌ها منصفانه است و موجودی معمولاً درست است.',
      'همان چیزی که در تصویر بود رسید. تاریخ انقضا همهٔ اقلام تازه بود و میوه‌ها سالم.',
      'تحویل سریع و مأمور مؤدب. فاکتور دقیق بود و پیگیری سفارش هم آسان.',
      'تنوع محصولات خوب است و برای اقلامی که در محله پیدا نمی‌کنم گزینهٔ اولم شده.',
    ],
    meh: [
      'کیفیت خوب است ولی قیمت‌ها نسبت به بازار کمی بالاتر است؛ برای خرید عمده صرفه ندارد.',
      'سفارش رسید اما یک ساعت دیرتر از زمان اعلام‌شده. پشتیبانی عذرخواهی کرد ولی تجربه خوبی نبود.',
      'بسته‌بندی متوسط بود؛ چند قلم فشار دیده بود. با این حال چیزی خراب نشده بود.',
      'بیشتر کالاها خوب بودند، اما موجودی برخی اقلام با سایت نمی‌خواند و جایگزین فرستادند.',
      'برای خرید سریع خوب است، ولی برای میوه و سبزی به نظرم جای کار دارد.',
      'قیمت ارسال نسبت به مبلغ سفارش زیاد است. فقط برای خرید بزرگ به‌صرفه است.',
    ],
    bad: [
      'دو ساعت بعد از زمان اعلام‌شده رسید و هیچ پیامی هم نفرستادند. وقتی تماس گرفتم گفتند سفارش گم شده بود.',
      'تاریخ انقضای دو قلم گذشته بود. عکس فرستادم و بعد از سه روز فقط گفتند «بررسی می‌کنیم».',
      'سفارش ناقص رسید و مبلغ کم‌شده برنگشت. تجربهٔ بدی بود و دیگر سفارش نمی‌دهم.',
      'میوه‌ها لهیده و کپک‌زده بودند. عکس فرستادم، جواب ندادند. پول هم برنگشت.',
      'رنگ و بستهٔ محصولی که فرستادند با چیزی که سفارش دادم فرق داشت؛ گفتند «همین است».',
    ],
  },
  shop: {
    good: [
      'این شعبه همیشه مرتب و تمیز است؛ قفسه‌ها پر و تاریخ‌ها به‌روز. برای خرید محله گزینهٔ اولم است.',
      'کارکنان خوش‌برخورد و صندوق‌ها سریع. اقلام تازه بخش میوه واقعاً تازه است.',
      'سفارش تلفنی دادم و کمتر از یک ساعت آمادهٔ تحویل بود. همه‌چیز دقیق بود.',
      'پارکینگ و دسترسی راحت، تنوع خوب. برای خرید هفتگی این شعبه را ترجیح می‌دهم.',
      'موجودی با سایت یکی بود و هیچ آیتمی جایگزین نشد. بسته‌بندی میوه هم خوب بود.',
    ],
    meh: [
      'شعبه خوب است ولی در ساعت شلوغی صف صندوق طولانی می‌شود.',
      'تنوع خوب اما قیمت‌ها با شعبهٔ دیگر همین برند فرق دارد؛ حواستان باشد.',
      'بخش میوه متوسط است؛ بعضی روزها کیفیت پایین می‌آید.',
      'سفارش آنلاین را با تأخیر آماده کردند و مجبور شدم دو بار تماس بگیرم.',
    ],
    bad: [
      'تاریخ انقضای چند قلم در قفسه گذشته بود. به مسئول شعبه گفتم و بی‌تفاوت رد شد.',
      'سفارش آنلاین را آماده نکرده بودند و گفتند «سیستم ندید». یک ساعت الکی رفت.',
      'بخش پروتئین بوی نامطبوعی داشت و بسته‌بندی‌ها باز بود. برای خرید گوشت به این شعبه اعتماد ندارم.',
    ],
  },
  product: {
    good: [
      'کیفیتش همان انتظار بود؛ تاریخ تازه و بستهٔ سالم. باز هم می‌خرم.',
      'طعم و بافت خوب، اندازهٔ بسته هم منطقی. نسبت به قیمت ارزش خرید دارد.',
      'همان برند و همان بسته‌ای بود که سفارش دادم؛ بدون تغییر یا جایگزینی.',
      'برای مصرف روزانه عالی است. بسته‌بندی محکم بود و در ارسال آسیب ندید.',
      'چند بار خریدم و کیفیت ثابت مانده. نقطهٔ قوتش همین ثبات است.',
    ],
    meh: [
      'کیفیت متوسط است؛ انتظار بیشتری داشتم ولی بد هم نبود.',
      'طعم خوب است ولی حجم بسته نسبت به قیمت کم است.',
      'محصول سالم رسید ولی تاریخ انقضایش نزدیک بود؛ باید زودتر مصرف شود.',
      'با تصویر سایت کمی تفاوت داشت، هرچند همان برند بود.',
    ],
    bad: [
      'بستهٔ محصول باز و کمی از محتوا ریخته بود. قابل استفاده نبود.',
      'طعم و بوی نامطبوعی داشت؛ احتمالاً زنجیرهٔ سرد رعایت نشده بود.',
      'تاریخ انقضا گذشته بود. این برای یک محصول لبنی غیرقابل قبول است.',
      'محصول کاملاً با تصویر و توضیحات سایت فرق داشت. مرجوع کردم.',
    ],
  },
};

const TAG_POOL = {
  good: ['تحویل سریع', 'بسته‌بندی سالم', 'کیفیت بالا', 'ارزان و به‌صرفه', 'همان تصویر'],
  meh: ['دیر رسید', 'گران‌تر از بازار', 'بسته‌بندی خراب', 'موجودی اشتباه'],
  bad: ['سفارش ناقص', 'تاریخ انقضا', 'کیفیت پایین', 'پشتیبانی بد', 'بسته‌بندی خراب'],
};

/* --------------------------------------------------------------------------
   تولید فروشگاه‌ها و محصولات
   -------------------------------------------------------------------------- */
const STREETS = ['خیابان اصلی', 'بلوار شهید', 'کوچه بهار', 'خیابان ولیعصر', 'میدان محله', 'بلوار امام'];
const HOURS = ['۹:۰۰ تا ۲۳:۰۰', '۸:۰۰ تا ۲۲:۰۰', '۱۰:۰۰ تا ۲۴:۰۰', '۷:۳۰ تا ۲۱:۳۰', '۲۴ ساعته'];

function buildShops(rnd, vendor) {
  const shops = [];
  const city = vendor.city || 'تهران';
  const count = vendor.shops || 2;
  for (let i = 0; i < count; i += 1) {
    const hood = pickNeighborhood(rnd, city);
    shops.push({
      id: demoId(),
      vendorId: null,
      vendorSlug: vendor.slug,
      name: `${vendor.nameFa} — شعبهٔ ${hood}`,
      city,
      district: hood,
      address: `${pick(rnd, STREETS)}، نبش ${hood}، پلاک ${between(rnd, 2, 180)}`,
      phone: `۰۲۱-${between(rnd, 20000000, 89999999)}`,
      pickup: rnd() > 0.15,
      delivery: rnd() > 0.2,
      hours: pick(rnd, HOURS),
      lat: null,
      lng: null,
      bias: Math.min(0.95, Math.max(0.08, vendor.bias + (rnd() - 0.5) * 0.28)),
      createdAt: new Date(Date.now() - between(rnd, 30, 900) * 86400000).toISOString(),
    });
  }
  return shops;
}

function buildProducts(rnd, vendor, shops) {
  const chosen = some(rnd, PRODUCT_BLUEPRINT, Math.min(vendor.products || 3, PRODUCT_BLUEPRINT.length));
  return chosen.map((base) => {
    const shop = shops.length && rnd() > 0.35 ? pick(rnd, shops) : null;
    const priceJitter = 1 + (rnd() - 0.45) * 0.24;
    return {
      id: demoId(),
      vendorId: null,
      vendorSlug: vendor.slug,
      shopId: shop ? shop.id : null,
      name: base.name,
      brand: base.brand,
      category: base.category,
      unit: base.unit,
      price: Math.round((base.price * priceJitter) / 1000) * 1000,
      barcode: `626${between(rnd, 1000000, 9999999)}${between(rnd, 100, 999)}`,
      tags: some(rnd, ['پرفروش', 'تازه', 'پیشنهاد ویژه', 'ارسال سریع', 'محلی', 'وارداتی'], between(rnd, 0, 2)),
      isAvailable: rnd() > 0.08,
      bias: Math.min(0.95, Math.max(0.06, vendor.bias + (rnd() - 0.5) * 0.34)),
      createdAt: new Date(Date.now() - between(rnd, 5, 400) * 86400000).toISOString(),
    };
  });
}

/**
 * ساخت کل دادهٔ نمایشی.
 * @returns {{vendors:Array, shops:Array, products:Array, ratings:Array, comments:Array, votes:Array, profiles:Array}}
 */
export function buildSeed() {
  idCounter = 0;
  const rnd = mulberry32(20261116);
  const now = Date.now();
  const daysAgo = (days, hours = 0) => new Date(now - days * 86400000 - hours * 3600000).toISOString();

  const vendors = [];
  const shops = [];
  const products = [];
  const ratings = [];
  const comments = [];

  for (const blueprint of VENDOR_BLUEPRINT) {
    const vendorId = demoId();
    const vendor = {
      id: vendorId,
      slug: blueprint.slug,
      name: blueprint.name,
      nameFa: blueprint.nameFa,
      kind: blueprint.kind,
      tagline: blueprint.tagline,
      description: blueprint.description,
      website: blueprint.website,
      city: blueprint.city,
      supportPhone: '',
      brandHue: blueprint.brandHue,
      isVerified: blueprint.isVerified,
      createdAt: daysAgo(between(rnd, 120, 1100)),
      updatedAt: daysAgo(between(rnd, 1, 60)),
      bias: blueprint.bias,
      source: 'demo',
    };
    vendors.push(vendor);

    const vendorShops = buildShops(rnd, blueprint).map((shop) => ({ ...shop, vendorId }));
    shops.push(...vendorShops);

    const vendorProducts = buildProducts(rnd, blueprint, vendorShops).map((product) => ({
      ...product,
      vendorId,
    }));
    products.push(...vendorProducts);

    /* ------------------------------------------------ امتیازها */
    const vendorRatingCount = between(rnd, 9, 26);
    for (let i = 0; i < vendorRatingCount; i += 1) {
      const roll = rnd();
      const bias = blueprint.bias;
      let value = 'meh';
      if (roll < bias - 0.12) value = 'good';
      else if (roll > Math.min(0.93, bias + 0.2)) value = 'bad';
      const author = pick(rnd, AUTHORS);
      ratings.push({
        id: demoId(),
        entityType: 'vendor',
        entityId: vendorId,
        userId: `demo-user-${author.name}`,
        userName: author.name,
        value,
        createdAt: daysAgo(between(rnd, 0, 200), between(rnd, 0, 23)),
        source: 'demo',
      });
    }

    /* ------------------------------------------------ فروشگاه‌ها */
    for (const shop of vendorShops) {
      const shopRatings = between(rnd, 3, 10);
      for (let i = 0; i < shopRatings; i += 1) {
        const roll = rnd();
        let value = 'meh';
        if (roll < shop.bias - 0.1) value = 'good';
        else if (roll > Math.min(0.94, shop.bias + 0.22)) value = 'bad';
        const author = pick(rnd, AUTHORS);
        ratings.push({
          id: demoId(),
          entityType: 'shop',
          entityId: shop.id,
          userId: `demo-user-${author.name}`,
          userName: author.name,
          value,
          createdAt: daysAgo(between(rnd, 0, 150), between(rnd, 0, 23)),
          source: 'demo',
        });
      }
    }

    /* ------------------------------------------------ محصولات */
    for (const product of vendorProducts) {
      const productRatings = between(rnd, 2, 8);
      for (let i = 0; i < productRatings; i += 1) {
        const roll = rnd();
        let value = 'meh';
        if (roll < product.bias - 0.08) value = 'good';
        else if (roll > Math.min(0.95, product.bias + 0.24)) value = 'bad';
        const author = pick(rnd, AUTHORS);
        ratings.push({
          id: demoId(),
          entityType: 'product',
          entityId: product.id,
          userId: `demo-user-${author.name}`,
          userName: author.name,
          value,
          createdAt: daysAgo(between(rnd, 0, 120), between(rnd, 0, 23)),
          source: 'demo',
        });
      }
    }
  }

  /* -------------------------------------------------- نقدها */
  const entityIndex = [
    ...vendors.map((v) => ({ type: 'vendor', entity: v })),
    ...shops.map((s) => ({ type: 'shop', entity: s })),
    ...products.map((p) => ({ type: 'product', entity: p })),
  ];

  // برای هر موجودیت ۰ تا ۳ نقد، با تمرکز روی موجودیت‌های پرامتیاز
  for (const { type, entity } of entityIndex) {
    const count = between(rnd, 0, type === 'vendor' ? 5 : 3);
    for (let i = 0; i < count; i += 1) {
      const roll = rnd();
      let level = 'meh';
      if (roll < (entity.bias || 0.5) - 0.08) level = 'good';
      else if (roll > 0.76) level = 'bad';
      const author = pick(rnd, AUTHORS);
      const template = pick(rnd, COMMENT_TEMPLATES[type][level]);
      const extra =
        rnd() > 0.65
          ? ` ${pick(rnd, [
              'دفعهٔ بعد حتماً عکس سفارش را نگه می‌دارم.',
              'به دو نفر دیگر هم تجربه‌ام را گفتم.',
              'امیدوارم دفعهٔ بعد بهتر شود.',
              'جای دیگر هم همین مشکل را داشتم.',
              'این را نوشتم که یادم بماند.',
            ])}`
          : '';
      comments.push({
        id: demoId(),
        entityType: type,
        entityId: entity.id,
        userId: null,
        guestName: author.name,
        avatarHue: author.hue,
        body: template + extra,
        level,
        tags: some(rnd, TAG_POOL[level], between(rnd, 0, 2)),
        status: 'published',
        createdAt: daysAgo(between(rnd, 0, 130), between(rnd, 0, 23)),
        source: 'demo',
      });
    }
  }

  comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const profiles = AUTHORS.map((author) => ({
    userId: `demo-user-${author.name}`,
    displayName: author.name,
    city: pick(rnd, CONFIG.CITIES),
    bio: '',
    avatarHue: author.hue,
    createdAt: daysAgo(between(rnd, 100, 800)),
  }));

  return {
    vendors,
    shops,
    products,
    ratings,
    comments,
    votes: [],
    profiles,
    lists: [],
    listItems: [],
    reports: [],
    activity: [],
  };
}

/** چند نقد نمایشی برای تیکر بالای صفحه */
export const TICKER_FALLBACKS = [
  'سه سطح ساده: خوب، نه‌خوب، افتضاح.',
  'قبل از خرید، شعبه را هم ببین؛ دو شعبه از یک برند یکسان نیستند.',
  'محصول را از فهرست انتخاب کن تا رکورد تکراری ساخته نشود.',
  'امتیاز بدون متن هم ثبت می‌شود؛ فقط یک کلیک.',
];
