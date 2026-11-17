/* ==========================================================================
   domain.js — مدل دامنه: امتیازها، آمار، تجمیع‌ها و تحلیل‌ها
   ========================================================================== */

import {
  groupBy,
  sumBy,
  sortBy,
  pct,
  round,
  todayISO,
  parseISODate,
} from './utils.js';
import { jalaliFromISO, jalaliMonthKey, JALALI_MONTHS, formatJalali } from './jalali.js';

/* --------------------------------- امتیاز -------------------------------- */

export const RATINGS = {
  good: {
    key: 'good',
    label: 'خوب',
    short: 'خوب',
    score: 3,
    tone: 'good',
    emoji: '🙂',
    color: '#35e0a1',
    description: 'از این ترکیب راضی بودم',
    advice: 'می‌شود دوباره خرید',
  },
  not_good: {
    key: 'not_good',
    label: 'نه‌خوب',
    short: 'نه‌خوب',
    score: 2,
    tone: 'meh',
    emoji: '😐',
    color: '#ffc24b',
    description: 'قابل قبول بود ولی نه عالی',
    advice: 'فقط با احتیاط',
  },
  shit: {
    key: 'shit',
    label: 'افتضاح',
    short: 'افتضاح',
    score: 1,
    tone: 'bad',
    emoji: '🤢',
    color: '#ff5d7a',
    description: 'پشیمان شدم',
    advice: 'از این نخر',
  },
};

export const RATING_KEYS = ['good', 'not_good', 'shit'];
export const RATING_LIST = RATING_KEYS.map((key) => RATINGS[key]);

export function ratingInfo(key) {
  return RATINGS[key] || null;
}

export function ratingLabel(key) {
  return RATINGS[key]?.label || 'بدون امتیاز';
}

export function ratingScore(key) {
  return RATINGS[key]?.score || 0;
}

export function reviewTotal(review) {
  const price = Number(review?.price) || 0;
  const qty = Number(review?.quantity) || 1;
  return Math.round(price * qty);
}

/* ------------------------------- ایندکس‌ها ------------------------------- */

export function buildIndex(data) {
  const reviews = data?.reviews || [];
  const products = data?.products || [];
  const shops = data?.shops || [];
  const vendors = data?.vendors || [];
  const comments = data?.comments || [];

  const reviewGroups = {
    product: groupBy(reviews, 'product_id'),
    shop: groupBy(reviews, 'shop_id'),
    vendor: groupBy(reviews, 'vendor_id'),
  };

  return {
    products: new Map(products.map((p) => [p.id, p])),
    shops: new Map(shops.map((s) => [s.id, s])),
    vendors: new Map(vendors.map((v) => [v.id, v])),
    productsByName: new Map(products.map((p) => [p.name, p])),
    reviews,
    reviewGroups,
    commentsByTarget: groupBy(comments, (c) => `${c.target_type}:${c.target_id}`),
    lists: new Map((data?.lists || []).map((l) => [l.id, l])),
  };
}

export function hydrateReview(review, index) {
  if (!review) return null;
  const product = index.products.get(review.product_id) || null;
  const shop = index.shops.get(review.shop_id) || null;
  const vendor = index.vendors.get(review.vendor_id) || null;
  return {
    ...review,
    product,
    shop,
    vendor,
    ratingMeta: ratingInfo(review.rating),
    total: reviewTotal(review),
    productName: product?.name || 'محصول حذف‌شده',
    shopName: shop?.name || 'فروشگاه حذف‌شده',
    vendorName: vendor?.name || 'پلتفرم حذف‌شده',
  };
}

export function comboKey({ product_id, shop_id, vendor_id }) {
  return `${product_id}::${shop_id}::${vendor_id}`;
}

export function findCombo(reviews, combo, excludeId = null) {
  const key = comboKey(combo);
  return (
    (reviews || []).find(
      (review) => review.id !== excludeId && comboKey(review) === key,
    ) || null
  );
}

export function relatedReviews(type, id, data) {
  const reviews = data?.reviews || [];
  if (type === 'review') return reviews.filter((r) => r.id === id);
  if (type === 'product') return reviews.filter((r) => r.product_id === id);
  if (type === 'shop') return reviews.filter((r) => r.shop_id === id);
  if (type === 'vendor') return reviews.filter((r) => r.vendor_id === id);
  return [];
}

/* --------------------------------- آمار ---------------------------------- */

export function computeStats(reviews = []) {
  let good = 0;
  let notGood = 0;
  let shit = 0;
  let spend = 0;
  let lastPurchasedAt = null;
  let firstPurchasedAt = null;

  for (const review of reviews) {
    if (review.rating === 'good') good += 1;
    else if (review.rating === 'not_good') notGood += 1;
    else if (review.rating === 'shit') shit += 1;

    spend += reviewTotal(review);

    if (review.purchased_at) {
      if (!lastPurchasedAt || review.purchased_at > lastPurchasedAt) lastPurchasedAt = review.purchased_at;
      if (!firstPurchasedAt || review.purchased_at < firstPurchasedAt) firstPurchasedAt = review.purchased_at;
    }
  }

  const count = reviews.length;
  const avgScore = count ? (good * 3 + notGood * 2 + shit * 1) / count : 0;
  const health = count ? Math.round((good * 100 + notGood * 45) / count) : 0;

  return {
    count,
    good,
    notGood,
    shit,
    avgScore: round(avgScore, 2),
    health,
    spend,
    lastPurchasedAt,
    firstPurchasedAt,
    buyAgainShare: count ? pct(good, count) : 0,
    badShare: count ? pct(shit, count) : 0,
  };
}

/** آمار همه محصولات/فروشگاه‌ها/پلتفرم‌ها */
export function entityStats(data) {
  const reviews = data?.reviews || [];
  const groups = {
    product: groupBy(reviews, 'product_id'),
    shop: groupBy(reviews, 'shop_id'),
    vendor: groupBy(reviews, 'vendor_id'),
  };

  const build = (map) => {
    const out = new Map();
    for (const [id, items] of map) out.set(id, computeStats(items));
    return out;
  };

  return {
    products: build(groups.product),
    shops: build(groups.shop),
    vendors: build(groups.vendor),
  };
}

export function statsForEntity(type, id, data) {
  const reviews = relatedReviews(type, id, data);
  return computeStats(reviews);
}

export function entityEmptyStats() {
  return computeStats([]);
}

/* ------------------------------- موجودیت‌ها ------------------------------ */

export const ENTITY_TYPES = {
  product: { label: 'محصول', plural: 'محصولات', icon: 'package', route: '/products' },
  shop: { label: 'فروشگاه', plural: 'فروشگاه‌ها', icon: 'store', route: '/shops' },
  vendor: { label: 'پلتفرم', plural: 'پلتفرم‌ها', icon: 'globe', route: '/vendors' },
  review: { label: 'تجربه', plural: 'تجربه‌ها', icon: 'star', route: '/' },
};

export function entityTypeLabel(type) {
  return ENTITY_TYPES[type]?.label || type;
}

export function entityRoute(type) {
  return ENTITY_TYPES[type]?.route || '/';
}

export function entityMeta(type, entity) {
  if (!entity) return '';
  if (type === 'product') {
    return [entity.category, entity.brand, entity.unit].filter(Boolean).join(' · ');
  }
  if (type === 'shop') {
    return [entity.category, entity.city].filter(Boolean).join(' · ');
  }
  if (type === 'vendor') {
    return entity.website ? entity.website.replace(/^https?:\/\//, '') : entity.note || 'پلتفرم خرید';
  }
  return '';
}

export function entityEmoji(type, entity) {
  if (!entity) return type === 'shop' ? '🏪' : type === 'product' ? '📦' : '🛒';
  return entity.emoji || (type === 'shop' ? '🏪' : type === 'product' ? '📦' : '🛒');
}

export function commentCount(index, type, id) {
  return index.commentsByTarget.get(`${type}:${id}`)?.length || 0;
}

export function commentThread(index, type, id) {
  const all = index.commentsByTarget.get(`${type}:${id}`) || [];
  const roots = all.filter((c) => !c.parent_id);
  return roots
    .map((root) => ({
      ...root,
      replies: sortBy(all.filter((c) => c.parent_id === root.id), 'created_at', 'asc'),
    }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/* -------------------------------- دسته‌ها -------------------------------- */

export function allCategories(data) {
  const set = new Set();
  for (const product of data?.products || []) {
    const value = String(product.category || '').trim();
    if (value) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
}

export function shopCategories(data) {
  const set = new Set();
  for (const shop of data?.shops || []) {
    const value = String(shop.category || '').trim();
    if (value) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
}

export function allTags(data) {
  const map = new Map();
  for (const review of data?.reviews || []) {
    for (const tag of review.tags || []) {
      const clean = String(tag || '').trim();
      if (!clean) continue;
      map.set(clean, (map.get(clean) || 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fa'));
}

/* ------------------------------- سری زمانی ------------------------------- */

export function lastJalaliMonths(count = 12) {
  const now = jalaliFromISO(todayISO());
  const months = [];
  let jy = now.jy;
  let jm = now.jm;
  for (let i = 0; i < count; i += 1) {
    months.push({ jy, jm, key: `${jy}-${String(jm).padStart(2, '0')}`, label: JALALI_MONTHS[jm - 1], short: JALALI_MONTHS[jm - 1].slice(0, 2) });
    jm -= 1;
    if (jm === 0) {
      jm = 12;
      jy -= 1;
    }
  }
  return months.reverse();
}

export function monthlySeries(reviews, count = 12) {
  const months = lastJalaliMonths(count);
  const map = new Map(months.map((m) => [m.key, { ...m, count: 0, spend: 0, good: 0, shit: 0 }]));

  for (const review of reviews || []) {
    if (!review.purchased_at) continue;
    const key = jalaliMonthKey(review.purchased_at);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.spend += reviewTotal(review);
    if (review.rating === 'good') bucket.good += 1;
    if (review.rating === 'shit') bucket.shit += 1;
  }

  return months.map((m) => map.get(m.key));
}

/* -------------------------------- تحلیل‌ها -------------------------------- */

export function buildInsights(data) {
  const index = buildIndex(data);
  const reviews = (data.reviews || []).map((r) => hydrateReview(r, index));
  const totals = computeStats(reviews);
  const stats = entityStats(data);

  const ratingRows = RATING_LIST.map((rating) => ({
    key: rating.key,
    label: rating.label,
    value: reviews.filter((r) => r.rating === rating.key).length,
    color: rating.color,
  }));

  const vendorRanking = (data.vendors || [])
    .map((vendor) => ({
      vendor,
      stats: stats.vendors.get(vendor.id) || entityEmptyStats(),
    }))
    .filter((row) => row.stats.count > 0)
    .sort((a, b) => b.stats.health - a.stats.health || b.stats.count - a.stats.count);

  const productRanking = (data.products || [])
    .map((product) => ({ product, stats: stats.products.get(product.id) || entityEmptyStats() }))
    .filter((row) => row.stats.count > 0)
    .sort((a, b) => b.stats.count - a.stats.count || b.stats.avgScore - a.stats.avgScore);

  const shopRanking = (data.shops || [])
    .map((shop) => ({ shop, stats: stats.shops.get(shop.id) || entityEmptyStats() }))
    .filter((row) => row.stats.count > 0)
    .sort((a, b) => a.stats.health - b.stats.health || b.stats.count - a.stats.count);

  const monthly = monthlySeries(reviews, 12);
  const tags = allTags(data);

  const categoryMap = new Map();
  for (const review of reviews) {
    const category = review.product?.category?.trim() || 'بدون دسته';
    const bucket = categoryMap.get(category) || { label: category, count: 0, good: 0, shit: 0, spend: 0 };
    bucket.count += 1;
    bucket.spend += review.total;
    if (review.rating === 'good') bucket.good += 1;
    if (review.rating === 'shit') bucket.shit += 1;
    categoryMap.set(category, bucket);
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);

  const repeats = Array.from(groupBy(reviews, 'product_id').entries())
    .map(([, items]) => ({
      product: items[0].product,
      stats: computeStats(items),
      shops: new Set(items.map((r) => r.shop_id)).size,
      vendors: new Set(items.map((r) => r.vendor_id)).size,
    }))
    .filter((row) => row.stats.count > 1)
    .sort((a, b) => b.stats.count - a.stats.count);

  const bestVendor = vendorRanking[0] || null;
  const worstShop = shopRanking[0] || null;
  const worstVendor = [...vendorRanking].sort((a, b) => a.stats.health - b.stats.health)[0] || null;
  const mostExpensive = [...reviews].sort((a, b) => b.total - a.total)[0] || null;
  const topRepeat = repeats[0] || null;

  const bullets = [];
  if (totals.count === 0) {
    bullets.push({ tone: 'muted', text: 'هنوز تجربه‌ای ثبت نشده. با ثبت اولین خرید، تحلیل‌ها فعال می‌شوند.' });
  } else {
    bullets.push({
      tone: 'good',
      text: `در ${totals.count} تجربه، ${pct(totals.good, totals.count)}٪ خریدها «خوب» بودند و مجموع هزینه ثبت‌شده ${sumBy(reviews, 'total') ? Math.round(sumBy(reviews, 'total')).toLocaleString('fa-IR') + ' تومان' : 'صفر'} است.`,
    });
    if (totals.shit) {
      bullets.push({
        tone: 'warn',
        text: `${totals.shit} ترکیب «افتضاح» دارید؛ ${worstShop ? `فروشگاه «${worstShop.shop.name}» با سلامت ${worstShop.stats.health}٪ بدترین وضعیت را دارد.` : 'بهتر است لیست نخر را مرور کنید.'}`,
      });
    }
    if (bestVendor) {
      bullets.push({
        tone: 'good',
        text: `پلتفرم «${bestVendor.vendor.name}» با ${bestVendor.stats.count} تجربه و سلامت ${bestVendor.stats.health}٪ بهترین عملکرد را دارد؛ برای خرید بعدی اولویت بده.`,
      });
    }
    if (topRepeat) {
      bullets.push({
        tone: 'meh',
        text: `«${topRepeat.product?.name || 'یک محصول'}» را ${topRepeat.stats.count} بار از ${topRepeat.shops} فروشگاه مختلف خریده‌ای؛ مقایسه امتیازها می‌تواند به انتخاب بهتر کمک کند.`,
      });
    }
    if (mostExpensive) {
      bullets.push({
        tone: 'muted',
        text: `گران‌ترین خرید ثبت‌شده «${mostExpensive.productName}» از «${mostExpensive.shopName}» به مبلغ ${Math.round(mostExpensive.total).toLocaleString('fa-IR')} تومان بوده است.`,
      });
    }
  }

  return {
    index,
    reviews,
    totals,
    stats,
    ratingRows,
    vendorRanking,
    productRanking,
    shopRanking,
    monthly,
    tags,
    categories,
    repeats,
    bestVendor,
    worstShop,
    worstVendor,
    mostExpensive,
    bullets,
    topShops: [...shopRanking].sort((a, b) => b.stats.health - a.stats.health),
  };
}

/** خلاصه یک خطی برای فروشگاه/محصول (برای اشتراک‌گذاری یا کپی) */
export function summaryLine(type, entity, stats) {
  if (!entity || !stats) return '';
  const avg = stats.avgScore ? stats.avgScore.toFixed(1) : '—';
  return `${entityTypeLabel(type)} «${entity.name}» · ${stats.count} تجربه · میانگین ${avg} از ۳ · ${ratingLabel(stats.health >= 70 ? 'good' : stats.health >= 40 ? 'not_good' : 'shit')}`;
}

export function hasAnyData(data) {
  return Boolean(
    data &&
      ((data.reviews && data.reviews.length) ||
        (data.products && data.products.length) ||
        (data.shops && data.shops.length) ||
        (data.vendors && data.vendors.length)),
  );
}

export function monthLabelOf(key) {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return '';
  return `${JALALI_MONTHS[m - 1]} ${y}`;
}

export function purchaseLabel(iso) {
  return formatJalali(iso, 'long');
}

export function reviewDateRank(review) {
  const d = parseISODate(review?.purchased_at);
  return d ? d.getTime() : 0;
}

export function sortedByDateDesc(reviews) {
  return sortBy(reviews, (r) => `${r.purchased_at || ''}#${r.created_at || ''}`, 'desc');
}
