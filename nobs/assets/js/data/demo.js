/* ==========================================================================
   demo.js — داده نمونه برای حالت نمایشی (بدون نیاز به ورود)
   شناسه‌ها UUID معتبر هستند تا در صورت نیاز مستقیم در Supabase هم قابل درج باشند.
   ========================================================================== */

import { addDays, todayISO } from '../lib/utils.js';

const V = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const S = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const R = (n) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const C = (n) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const L = (n) => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const I = (n) => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const DEMO_USER = '00000000-0000-4000-8000-d00000000001';

function daysAgo(n) {
  return addDays(todayISO(), -n);
}

function stamp(iso, hour = 10) {
  return `${iso}T${String(hour).padStart(2, '0')}:30:00.000Z`;
}

const VENDOR_SEED = [
  { id: V(1), name: 'دیجی‌کالا', color: '#e11d48', emoji: '🛍️', website: 'https://digikala.com', note: 'ارسال انبار خودشان، تنوع بالا', sort_order: 10 },
  { id: V(2), name: 'اسنپ‌فود', color: '#ff5a00', emoji: '🛵', website: 'https://snappfood.ir', note: 'تحویل سریع غذا و سوپرمارکت', sort_order: 20 },
  { id: V(3), name: 'اکالا', color: '#22c55e', emoji: '🥬', website: 'https://okala.com', note: 'میوه و مواد غذایی تازه', sort_order: 30 },
  { id: V(4), name: 'باسلام', color: '#0ea5e9', emoji: '🤝', website: 'https://basalam.com', note: 'خرید مستقیم از تولیدکننده', sort_order: 40 },
  { id: V(5), name: 'هایپراستار', color: '#f59e0b', emoji: '🏬', website: 'https://hyperstar.ir', note: 'خرید حضوری و آنلاین', sort_order: 50 },
  { id: V(6), name: 'خرید حضوری', color: '#8b5cf6', emoji: '🚶', website: '', note: 'خرید مستقیم از مغازه', sort_order: 60 },
];

const SHOP_SEED = [
  { id: S(1), name: 'سوپرمارکت گلستان', category: 'سوپرمارکت', city: 'تهران', emoji: '🏪', address: 'خیابان گلستان، پلاک ۱۲', note: 'تنوع بالا، صف صندوق طولانی' },
  { id: S(2), name: 'هایپر مهرآباد', category: 'هایپرمارکت', city: 'تهران', emoji: '🏬', address: 'بلوار مهرآباد، مرکز خرید آفتاب', note: 'پارکینگ دارد' },
  { id: S(3), name: 'میوه و سبزیجات سبز', category: 'میوه و سبزیجات', city: 'کرج', emoji: '🍎', address: 'میدان سبز، غرفه ۴', note: 'میوه تازه هر صبح' },
  { id: S(4), name: 'لبنیات بهار', category: 'لبنیات', city: 'تهران', emoji: '🥛', address: 'بازار محلی، غرفه ۷', note: 'لبنیات سنتی' },
  { id: S(5), name: 'نانوایی سنگک ولیعصر', category: 'نانوایی', city: 'تهران', emoji: '🥖', address: 'خیابان ولیعصر، نبش کوچه ۹', note: 'شلوغ ولی تازه' },
  { id: S(6), name: 'فروشگاه ارگانیک رویش', category: 'ارگانیک', city: 'تهران', emoji: '🌱', address: 'سعادت‌آباد، بلوار دریا', note: 'قیمت بالا، کیفیت خوب' },
  { id: S(7), name: 'تنقلات آفتاب', category: 'تنقلات', city: 'تهران', emoji: '🍫', address: 'خیابان آزادی، پلاک ۲۲۰', note: 'تنوع شکلات و چیپس' },
  { id: S(8), name: 'بقالی محله', category: 'بقالی', city: 'تهران', emoji: '🛒', address: 'کوچه شهید احمدی، پلاک ۳', note: 'همیشه باز است' },
];

const PRODUCT_SEED = [
  { id: P(1), name: 'ماست پرچرب ۹۰۰ گرمی', category: 'لبنیات', brand: 'بهار', unit: '۹۰۰ گرم', emoji: '🥛', note: 'بسته‌بندی دبه‌ای' },
  { id: P(2), name: 'پنیر سفید ۴۰۰ گرمی', category: 'لبنیات', brand: 'بهار', unit: '۴۰۰ گرم', emoji: '🧀', note: '' },
  { id: P(3), name: 'نان سنگک تازه', category: 'نان', brand: '', unit: 'یک عدد', emoji: '🥖', note: 'بدون افزودنی' },
  { id: P(4), name: 'تخم‌مرغ ۲۰ عددی', category: 'پروتئین', brand: '', unit: '۲۰ عدد', emoji: '🥚', note: '' },
  { id: P(5), name: 'برنج ایرانی هاشمی ۵ کیلویی', category: 'غلات', brand: 'شالیکوبی شمال', unit: '۵ کیلو', emoji: '🍚', note: 'معطر' },
  { id: P(6), name: 'روغن زیتون فرابکر', category: 'خواربار', brand: 'زیتون طلایی', unit: '۵۰۰ میلی‌لیتر', emoji: '🫒', note: 'سرد فشرده' },
  { id: P(7), name: 'چای کیسه‌ای ۱۰۰ عددی', category: 'نوشیدنی', brand: 'چای شمال', unit: '۱۰۰ عدد', emoji: '🍵', note: '' },
  { id: P(8), name: 'شکلات تلخ ۸۵٪', category: 'تنقلات', brand: 'کاکائو تلخ', unit: '۱۰۰ گرم', emoji: '🍫', note: '' },
  { id: P(9), name: 'چیپس سیب‌زمینی نمکی', category: 'تنقلات', brand: 'اسنک‌لند', unit: '۹۰ گرم', emoji: '🍟', note: '' },
  { id: P(10), name: 'سیب قرمز ۱ کیلو', category: 'میوه', brand: '', unit: '۱ کیلو', emoji: '🍎', note: '' },
  { id: P(11), name: 'موز ۱ کیلو', category: 'میوه', brand: '', unit: '۱ کیلو', emoji: '🍌', note: '' },
  { id: P(12), name: 'خیار گلخانه‌ای', category: 'سبزیجات', brand: '', unit: '۱ کیلو', emoji: '🥒', note: '' },
  { id: P(13), name: 'آب معدنی ۱.۵ لیتری', category: 'نوشیدنی', brand: 'آب چشمه', unit: '۱.۵ لیتر', emoji: '💧', note: '' },
  { id: P(14), name: 'حلیم گندم آماده', category: 'غذای آماده', brand: '', unit: '۵۰۰ گرم', emoji: '🥣', note: '' },
  { id: P(15), name: 'سس مایونز', category: 'خواربار', brand: 'سس‌خانه', unit: '۴۵۰ گرم', emoji: '🥫', note: '' },
  { id: P(16), name: 'نخود سبز منجمد', category: 'منجمد', brand: 'سبز دشت', unit: '۴۰۰ گرم', emoji: '🫛', note: '' },
];

const REVIEW_SEED = [
  { n: 1, p: 1, s: 1, v: 1, rating: 'good', price: 42000, days: 5, tags: ['صبحانه', 'خرید هفتگی'], again: true, note: 'ماست سفت و خوشمزه، تاریخ انقضا هم خوب بود.' },
  { n: 2, p: 1, s: 4, v: 6, rating: 'good', price: 38000, days: 40, tags: ['لبنیات سنتی', 'تازه'], again: true, note: 'کیفیت سنتی واقعی، ولی فقط تا دو روز سالم می‌ماند.' },
  { n: 3, p: 1, s: 2, v: 5, rating: 'not_good', price: 45000, days: 75, tags: ['گران'], again: false, note: 'قیمت فروشگاه زنجیره‌ای بالاتر بود و طعم هم معمولی.' },
  { n: 4, p: 2, s: 1, v: 1, rating: 'good', price: 68000, days: 12, tags: ['صبحانه'], again: true, note: 'کاملاً بی‌نمک و تازه؛ برای صبحانه عالی.' },
  { n: 5, p: 2, s: 4, v: 4, rating: 'not_good', price: 72000, days: 55, tags: ['بسته‌بندی'], again: null, note: 'طعمش خوب بود اما آب پس داده بود.' },
  { n: 6, p: 3, s: 5, v: 6, rating: 'good', price: 15000, days: 3, tags: ['تازه', 'خرید هفتگی'], again: true, note: 'داغ و کنجدی، بهترین سنگک محله.' },
  { n: 7, p: 3, s: 1, v: 2, rating: 'shit', price: 22000, days: 20, tags: ['ارسال سریع', 'تاریخ انقضا'], again: false, note: 'نان خشک و سرد رسید؛ دو روز مانده بود.' },
  { n: 8, p: 4, s: 1, v: 1, rating: 'good', price: 115000, days: 8, tags: ['پروتئین'], again: true, note: 'هیچ شکسته‌ای نداشت و بسته‌بندی محکم بود.' },
  { n: 9, p: 4, s: 2, v: 3, rating: 'not_good', price: 125000, days: 33, tags: ['گران'], again: false, note: 'سه تا شکسته بود، قیمتش هم بالا.' },
  { n: 10, p: 5, s: 2, v: 1, rating: 'good', price: 720000, days: 60, tags: ['کیفیت'], again: true, note: 'برنج معطر و بدون سنگی؛ ارزش قیمتش را داشت.' },
  { n: 11, p: 5, s: 1, v: 3, rating: 'not_good', price: 690000, days: 95, tags: ['کیفیت'], again: false, note: 'پختش خوب شد ولی عطر کمتری داشت.' },
  { n: 12, p: 6, s: 6, v: 1, rating: 'good', price: 480000, days: 25, tags: ['ارگانیک', 'توصیه‌شده'], again: true, note: 'طعم زیتون واقعی، برای سالاد بی‌نظیر.' },
  { n: 13, p: 6, s: 2, v: 3, rating: 'shit', price: 540000, days: 80, tags: ['بسته‌بندی'], again: false, note: 'شیشه‌اش شکسته بود و روغن همه‌جا ریخته بود.' },
  { n: 14, p: 7, s: 8, v: 4, rating: 'good', price: 185000, days: 15, tags: ['خرید هفتگی'], again: true, note: 'چای خوش‌رنگ و بدون گرد.' },
  { n: 15, p: 7, s: 1, v: 2, rating: 'not_good', price: 195000, days: 48, tags: [], again: false, note: 'شبیه چای‌های ارزان بود، انتظار بیشتری داشتم.' },
  { n: 16, p: 8, s: 7, v: 1, rating: 'good', price: 95000, days: 7, tags: ['تنقلات'], again: true, note: 'تلخی دلچسب، بدون شکر افزوده.' },
  { n: 17, p: 8, s: 7, v: 3, rating: 'shit', price: 105000, days: 36, tags: ['تنقلات'], again: false, note: 'آب شده بود و طعم کهنگی می‌داد.' },
  { n: 18, p: 9, s: 7, v: 2, rating: 'shit', price: 28000, days: 10, tags: ['تنقلات', 'بسته‌بندی'], again: false, note: 'نصف بسته خالی و چیپس‌ها خرد شده بود.' },
  { n: 19, p: 9, s: 1, v: 4, rating: 'not_good', price: 32000, days: 44, tags: [], again: false, note: 'شورتر از حد معمول.' },
  { n: 20, p: 10, s: 3, v: 6, rating: 'good', price: 48000, days: 2, tags: ['تازه', 'میوه'], again: true, note: 'سیب‌ها سفت و شیرین بودند.' },
  { n: 21, p: 10, s: 3, v: 3, rating: 'good', price: 52000, days: 30, tags: ['میوه'], again: true, note: 'کیفیت پایدار، فقط ارسالش نیم ساعت دیر شد.' },
  { n: 22, p: 11, s: 3, v: 6, rating: 'not_good', price: 62000, days: 6, tags: ['میوه'], again: false, note: 'موزها نارس بودند و چند روز باید می‌ماند.' },
  { n: 23, p: 12, s: 3, v: 3, rating: 'good', price: 35000, days: 14, tags: ['سبزیجات'], again: true, note: 'خیارها تازه و بدون تلخی.' },
  { n: 24, p: 13, s: 8, v: 5, rating: 'good', price: 12000, days: 4, tags: ['خرید هفتگی'], again: true, note: '' },
  { n: 25, p: 13, s: 2, v: 3, rating: 'good', price: 14000, days: 28, tags: [], again: true, note: 'قیمت مناسب و تحویل سریع.' },
  { n: 26, p: 14, s: 5, v: 6, rating: 'shit', price: 78000, days: 9, tags: ['غذای آماده'], again: false, note: 'حلیم بی‌مزه و رقیق بود؛ پشیمان شدم.' },
  { n: 27, p: 15, s: 1, v: 2, rating: 'not_good', price: 89000, days: 18, tags: [], again: false, note: 'بسته‌اش چرب بود ولی طعمش قابل قبول.' },
  { n: 28, p: 16, s: 1, v: 3, rating: 'good', price: 54000, days: 50, tags: ['منجمد'], again: true, note: 'نخودها ریز و شیرین، برای خورش خوب.' },
  { n: 29, p: 2, s: 8, v: 4, rating: 'good', price: 74000, days: 90, tags: ['صبحانه'], again: null, note: 'بسته‌بندی سنتی و طعم خانگی.' },
  { n: 30, p: 3, s: 5, v: 2, rating: 'good', price: 18000, days: 100, tags: ['تازه'], again: true, note: 'همیشه تازه، فقط صف طولانی.' },
];

const COMMENT_SEED = [
  { n: 1, type: 'product', target: 1, content: 'برای صبحانه با نان سنگک ترکیب بی‌نظیری می‌شود.', hours: 30, rating: 'good' },
  { n: 2, type: 'shop', target: 1, content: 'تنوعش عالیه ولی صندوق‌دارها خیلی کندن.', hours: 52, rating: 'not_good' },
  { n: 3, type: 'review', target: 7, content: 'منم همین تجربه رو داشتم؛ نان خشک تحویل دادند.', hours: 300, rating: 'shit' },
  { n: 4, type: 'vendor', target: 2, content: 'هزینه ارسالش نسبت به بقیه بالاتر شده.', hours: 100, rating: null },
  { n: 5, type: 'shop', target: 5, content: 'سنگکش همیشه داغ و تازه‌ست، ارزش صف ایستادن رو داره.', hours: 70, rating: 'good' },
  { n: 6, type: 'product', target: 9, content: 'بسته‌بندی پلاستیکی‌اش پاره بود و چیپس‌ها خرد شده بودن.', hours: 20, rating: 'shit' },
  { n: 7, type: 'review', target: 13, content: 'برای منم شیشه شکسته رسید، ولی پشتیبانی جبران کرد.', hours: 400, rating: 'not_good' },
  { n: 8, type: 'product', target: 8, content: 'برای کسانی که شکر نمی‌خورن گزینه خوبیه.', hours: 12, rating: 'good' },
];

const COMMENT_REPLIES = [
  { n: 9, parent: 3, content: 'دقیقاً، شکایت هم ثبت کردم و مبلغ برگشت خورد.', hours: 280, rating: null },
  { n: 10, parent: 1, content: 'با کمی عسل هم امتحان کن، عالی می‌شه.', hours: 24, rating: 'good' },
];

const LIST_SEED = [
  { id: L(1), name: 'بخر دوباره', emoji: '🔁', tone: 'buy', note: 'چیزهایی که ارزش تکرار دارند' },
  { id: L(2), name: 'نخر', emoji: '🚫', tone: 'avoid', note: 'تجربه‌های بدی که تکرار نمی‌کنم' },
  { id: L(3), name: 'خرید هفته', emoji: '🛒', tone: 'custom', note: 'لیست خرید هفتگی خانه' },
];

const LIST_ITEM_SEED = [
  { n: 1, list: 1, type: 'product', target: 1, note: 'همیشه از سوپرمارکت گلستان' },
  { n: 2, list: 1, type: 'product', target: 4, note: '' },
  { n: 3, list: 1, type: 'shop', target: 5, note: 'نان سنگک ولیعصر' },
  { n: 4, list: 1, type: 'product', target: 13, note: '' },
  { n: 5, list: 2, type: 'product', target: 9, note: 'چیپس اسنک‌لند' },
  { n: 6, list: 2, type: 'shop', target: 2, note: 'بسته‌بندی خراب می‌رسد' },
  { n: 7, list: 3, type: 'product', target: 10, note: '۲ کیلو' },
  { n: 8, list: 3, type: 'product', target: 11, note: '' },
  { n: 9, list: 3, type: 'product', target: 12, note: '' },
  { n: 10, list: 3, type: 'product', target: 3, note: 'برای صبحانه' },
];

function baseFields(userId) {
  return { user_id: userId };
}

export function createDemoData(userId = DEMO_USER) {
  const now = new Date().toISOString();

  const vendors = VENDOR_SEED.map((vendor) => ({
    ...vendor,
    ...baseFields(userId),
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  const shops = SHOP_SEED.map((shop) => ({
    ...shop,
    ...baseFields(userId),
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  const products = PRODUCT_SEED.map((product) => ({
    ...product,
    ...baseFields(userId),
    is_active: true,
    created_at: now,
    updated_at: now,
  }));

  const reviews = REVIEW_SEED.map((row) => {
    const purchaseDate = daysAgo(row.days);
    return {
      id: R(row.n),
      ...baseFields(userId),
      product_id: P(row.p),
      shop_id: S(row.s),
      vendor_id: V(row.v),
      rating: row.rating,
      price: row.price,
      quantity: 1,
      purchased_at: purchaseDate,
      note: row.note || '',
      tags: row.tags || [],
      would_buy_again: row.again,
      created_at: stamp(purchaseDate, 12),
      updated_at: stamp(purchaseDate, 12),
    };
  });

  const hoursAgo = (hours) => new Date(Date.now() - hours * 3600 * 1000).toISOString();

  const comments = [
    ...COMMENT_SEED.map((row) => ({
      id: C(row.n),
      ...baseFields(userId),
      target_type: row.type,
      target_id:
        row.type === 'product' ? P(row.target) : row.type === 'shop' ? S(row.target) : row.type === 'vendor' ? V(row.target) : R(row.target),
      parent_id: null,
      rating: row.rating,
      content: row.content,
      created_at: hoursAgo(row.hours),
      updated_at: hoursAgo(row.hours),
    })),
    ...COMMENT_REPLIES.map((row) => ({
      id: C(row.n),
      ...baseFields(userId),
      target_type: 'comment',
      target_id: C(row.parent),
      parent_id: C(row.parent),
      rating: row.rating,
      content: row.content,
      created_at: hoursAgo(row.hours),
      updated_at: hoursAgo(row.hours),
    })),
  ].map((comment) => {
    if (comment.target_type !== 'comment') return comment;
    const parent = COMMENT_SEED.find((row) => row.n === Number(comment.target_id.slice(-12)));
    if (!parent) return { ...comment, target_type: 'review', target_id: R(1) };
    const resolved =
      parent.type === 'product' ? P(parent.target) : parent.type === 'shop' ? S(parent.target) : parent.type === 'vendor' ? V(parent.target) : R(parent.target);
    return { ...comment, target_type: parent.type, target_id: resolved };
  });

  const lists = LIST_SEED.map((list) => ({
    ...list,
    ...baseFields(userId),
    created_at: now,
    updated_at: now,
  }));

  const listItems = LIST_ITEM_SEED.map((item, index) => ({
    id: I(index + 1),
    ...baseFields(userId),
    list_id: L(item.list),
    target_type: item.type,
    target_id: item.type === 'product' ? P(item.target) : S(item.target),
    note: item.note || '',
    done: false,
    created_at: now,
    updated_at: now,
  }));

  const profile = {
    user_id: userId,
    display_name: 'کاربر مهمان',
    city: 'تهران',
    bio: 'در حال کشف بهترین فروشگاه‌ها 🛒',
    avatar_hue: 158,
    currency: 'IRT',
    density: 'cozy',
    onboarded: true,
    created_at: now,
    updated_at: now,
  };

  return { vendors, shops, products, reviews, comments, lists, listItems, profile };
}

export function emptyData(profile = null) {
  return {
    vendors: [],
    shops: [],
    products: [],
    reviews: [],
    comments: [],
    lists: [],
    listItems: [],
    profile,
  };
}

export const DEMO_META = {
  userId: DEMO_USER,
  email: 'demo@forooshgahyar.app',
};

export const DEMO_COUNTS = {
  vendors: VENDOR_SEED.length,
  shops: SHOP_SEED.length,
  products: PRODUCT_SEED.length,
  reviews: REVIEW_SEED.length,
  comments: COMMENT_SEED.length + COMMENT_REPLIES.length,
  lists: LIST_SEED.length,
  listItems: LIST_ITEM_SEED.length,
};
