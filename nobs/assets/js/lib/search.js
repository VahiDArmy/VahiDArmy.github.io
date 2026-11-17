/* ==========================================================================
   search.js — جست‌وجوی زنده فارسی: نرمال‌سازی، امتیازدهی، فیلتر و سورت
   پشتیبانی از نحو: "عبارت دقیق"  field:value  -حذف
   ========================================================================== */

import { normFa, fuzzyScore, parseNum, uniqueBy, sortBy } from './utils.js';
import { RATINGS, hydrateReview, reviewTotal } from './domain.js';

/** معادل‌سازی نام‌های لاتین با فارسی */
const SYNONYMS = {
  snappfood: 'اسنپ فود',
  snapp: 'اسنپ',
  digikala: 'دیجی کالا',
  dk: 'دیجی کالا',
  okala: 'اکالا',
  basalam: 'باسلام',
  jabama: 'جباما',
  hyperstar: 'هایپراستار',
  ofoqkala: 'افق کالا',
  fresh: 'تازه',
  supermarket: 'سوپرمارکت',
  hypermarket: 'هایپرمارکت',
  good: 'خوب',
  bad: 'افتضاح',
  shit: 'افتضاح',
  meh: 'نه خوب',
  notgood: 'نه خوب',
};

const SYNONYM_ENTRIES = Object.entries(SYNONYMS);

const FIELD_ALIASES = {
  product: 'product',
  محصول: 'product',
  shop: 'shop',
  فروشگاه: 'shop',
  vendor: 'vendor',
  platform: 'vendor',
  پلتفرم: 'vendor',
  فروشنده: 'vendor',
  tag: 'tag',
  تگ: 'tag',
  برچسب: 'tag',
  rating: 'rating',
  امتیاز: 'rating',
  note: 'note',
  یادداشت: 'note',
  cat: 'category',
  category: 'category',
  دسته: 'category',
  brand: 'brand',
  برند: 'brand',
};

const FIELD_WEIGHTS = {
  product: 6,
  brand: 2.4,
  shop: 4,
  vendor: 3.6,
  category: 2,
  tag: 3,
  note: 1.3,
};

const RATING_ALIASES = {
  good: 'good',
  خوب: 'good',
  عالی: 'good',
  not_good: 'not_good',
  notgood: 'not_good',
  'نه خوب': 'not_good',
  'نه‌خوب': 'not_good',
  متوسط: 'not_good',
  meh: 'not_good',
  shit: 'shit',
  افتضاح: 'shit',
  بد: 'shit',
  اشغال: 'shit',
};

/** توکنایز کردن با احترام به عبارت‌های داخل گیومه و منفی‌ها */
export function parseQuery(raw) {
  const text = String(raw || '').trim();
  const tokens = [];
  if (!text) return { tokens, raw: text, hasText: false };

  const re = /(-?)"([^"]+)"|(-?)(\S+)/g;
  let match = re.exec(text);
  while (match) {
    const negate = Boolean(match[1] || match[3]);
    const rawToken = (match[2] || match[4] || '').trim();
    if (rawToken) {
      let field = null;
      let value = rawToken;
      const colon = rawToken.indexOf(':');
      if (colon > 0) {
        const maybeField = normFa(rawToken.slice(0, colon));
        if (FIELD_ALIASES[maybeField]) {
          field = FIELD_ALIASES[maybeField];
          value = rawToken.slice(colon + 1);
        }
      }
      const normalized = normFa(value);
      if (field === 'rating') {
        const key = RATING_ALIASES[normalized] || null;
        if (key) tokens.push({ field: 'rating', value: key, normalized: key, negate });
      } else if (normalized) {
        tokens.push({ field, value, normalized, negate });
      }
    }
    match = re.exec(text);
  }

  return { tokens, raw: text, hasText: tokens.length > 0 };
}

export function highlightTokens(raw) {
  return parseQuery(raw)
    .tokens.filter((token) => !token.negate && token.field !== 'rating')
    .map((token) => token.normalized);
}

function textOf(entity, field) {
  if (!entity) return '';
  if (field === 'product') return entity.productName || entity.name || '';
  if (field === 'shop') return entity.shopName || entity.name || '';
  if (field === 'vendor') return entity.vendorName || entity.name || '';
  return '';
}

function fieldValues(review, field) {
  switch (field) {
    case 'product':
      return [review.productName, review.product?.brand, review.product?.category];
    case 'shop':
      return [review.shopName, review.shop?.city, review.shop?.category];
    case 'vendor':
      return [review.vendorName];
    case 'brand':
      return [review.product?.brand];
    case 'category':
      return [review.product?.category, review.shop?.category];
    case 'tag':
      return review.tags || [];
    case 'note':
      return [review.note];
    default:
      return [
        review.productName,
        review.product?.brand,
        review.product?.category,
        review.shopName,
        review.shop?.city,
        review.vendorName,
        review.note,
        ...(review.tags || []),
      ];
  }
}

function expandSynonyms(token) {
  const variants = [token];
  for (const [latin, persian] of SYNONYM_ENTRIES) {
    if (token.includes(latin) && !variants.includes(persian)) variants.push(persian);
    if (token.includes(normFa(persian)) && !variants.includes(latin)) variants.push(latin);
  }
  return variants;
}

function tokenScore(token, review) {
  const fields = token.field ? [token.field] : Object.keys(FIELD_WEIGHTS);
  let best = 0;
  const variants = expandSynonyms(token.normalized);

  for (const field of fields) {
    const values = fieldValues(review, field).filter(Boolean);
    const weight = FIELD_WEIGHTS[field] || 1.2;
    for (const value of values) {
      for (const variant of variants) {
        const score = fuzzyScore(variant, value);
        if (score > best) best = score;
        if (!token.field && field === 'note' && score > 0) best = Math.min(best, 0.85);
      }
    }
    if (best >= 0.999) break;
  }

  return best * (FIELD_WEIGHTS[fields[0]] || 3);
}

/** آیا رکورد با همه توکن‌ها منطبق است؟ */
export function matchesTokens(review, tokens) {
  if (!tokens.length) return true;
  for (const token of tokens) {
    if (token.field === 'rating') {
      const hit = review.rating === token.value;
      if (token.negate ? hit : !hit) return false;
      continue;
    }
    const score = tokenScore(token, review);
    const hit = score > 0;
    if (token.negate ? hit : !hit) return false;
  }
  return true;
}

export function scoreReview(review, tokens) {
  if (!tokens.length) return 1;
  let total = 0;
  for (const token of tokens) {
    if (token.field === 'rating' || token.negate) {
      total += 3;
      continue;
    }
    total += tokenScore(token, review);
  }
  return total;
}

const RATING_ORDER = { good: 3, not_good: 2, shit: 1 };

export const SORT_OPTIONS = [
  { key: 'newest', label: 'جدیدترین خرید' },
  { key: 'oldest', label: 'قدیمی‌ترین خرید' },
  { key: 'best', label: 'بهترین امتیاز' },
  { key: 'worst', label: 'بدترین امتیاز' },
  { key: 'price-desc', label: 'گران‌ترین' },
  { key: 'price-asc', label: 'ارزان‌ترین' },
  { key: 'product', label: 'نام محصول' },
  { key: 'shop', label: 'نام فروشگاه' },
];

export const EMPTY_FILTERS = {
  ratings: [],
  vendorIds: [],
  shopIds: [],
  productIds: [],
  category: '',
  tags: [],
  from: '',
  to: '',
  minPrice: null,
  maxPrice: null,
  hasNote: false,
  buyAgainOnly: false,
  noBad: false,
};

export function activeFilterCount(filters) {
  if (!filters) return 0;
  let count = 0;
  if (filters.ratings?.length) count += 1;
  if (filters.vendorIds?.length) count += 1;
  if (filters.shopIds?.length) count += 1;
  if (filters.productIds?.length) count += 1;
  if (filters.category) count += 1;
  if (filters.tags?.length) count += 1;
  if (filters.from || filters.to) count += 1;
  if (filters.minPrice !== null || filters.maxPrice !== null) count += 1;
  if (filters.hasNote) count += 1;
  if (filters.buyAgainOnly) count += 1;
  if (filters.noBad) count += 1;
  return count;
}

function passFilters(review, filters) {
  if (!filters) return true;
  if (filters.ratings?.length && !filters.ratings.includes(review.rating)) return false;
  if (filters.vendorIds?.length && !filters.vendorIds.includes(review.vendor_id)) return false;
  if (filters.shopIds?.length && !filters.shopIds.includes(review.shop_id)) return false;
  if (filters.productIds?.length && !filters.productIds.includes(review.product_id)) return false;
  if (filters.category && review.product?.category !== filters.category) return false;
  if (filters.tags?.length) {
    const tags = (review.tags || []).map(normFa);
    if (!filters.tags.every((tag) => tags.includes(normFa(tag)))) return false;
  }
  if (filters.from && (review.purchased_at || '') < filters.from) return false;
  if (filters.to && (review.purchased_at || '') > filters.to) return false;

  if (filters.minPrice !== null && filters.minPrice !== undefined && filters.minPrice !== '') {
    if (reviewTotal(review) < Number(filters.minPrice)) return false;
  }
  if (filters.maxPrice !== null && filters.maxPrice !== undefined && filters.maxPrice !== '') {
    if (reviewTotal(review) > Number(filters.maxPrice)) return false;
  }
  if (filters.hasNote && !String(review.note || '').trim()) return false;
  if (filters.buyAgainOnly && review.would_buy_again !== true) return false;
  if (filters.noBad && review.rating === 'shit') return false;
  return true;
}

function sortReviews(list, sort) {
  const arr = [...list];
  switch (sort) {
    case 'oldest':
      return sortBy(arr, (r) => `${r.purchased_at || ''}#${r.created_at || ''}`, 'asc');
    case 'best':
      return sortBy(arr, (r) => RATING_ORDER[r.rating] || 0, 'desc');
    case 'worst':
      return sortBy(arr, (r) => RATING_ORDER[r.rating] || 0, 'asc');
    case 'price-desc':
      return sortBy(arr, (r) => r.total || 0, 'desc');
    case 'price-asc':
      return sortBy(arr, (r) => r.total || 0, 'asc');
    case 'product':
      return sortBy(arr, (r) => r.productName || '', 'asc');
    case 'shop':
      return sortBy(arr, (r) => r.shopName || '', 'asc');
    case 'newest':
    default:
      return sortBy(arr, (r) => `${r.purchased_at || ''}#${r.created_at || ''}`, 'desc');
  }
}

/**
 * جست‌وجوی کامل روی تجربه‌ها
 * @returns {{items: Array, total: number, tokens: Array}}
 */
export function searchReviews({ query = '', filters = EMPTY_FILTERS, sort = 'newest' } = {}, data, index) {
  const parsed = parseQuery(query);
  const hydrated = (data?.reviews || []).map((review) => hydrateReview(review, index));
  const tokens = parsed.tokens;

  const filtered = hydrated.filter((review) => passFilters(review, filters) && matchesTokens(review, tokens));

  if (tokens.length && !sort) {
    const scored = filtered
      .map((review) => ({ review, score: scoreReview(review, tokens) }))
      .sort((a, b) => b.score - a.score || String(b.review.purchased_at).localeCompare(String(a.review.purchased_at)));
    return { items: scored.map((row) => row.review), total: scored.length, tokens };
  }

  const sortedItems = sortReviews(filtered, sort);
  return { items: sortedItems, total: sortedItems.length, tokens };
}

/** جست‌وجوی موجودیت‌ها (محصول/فروشگاه/پلتفرم) */
export function searchEntities({ items = [], query = '', keys = ['name', 'category', 'brand', 'city', 'note'] } = {}) {
  const parsed = parseQuery(query);
  const tokens = parsed.tokens.filter((token) => !token.negate);
  if (!tokens.length) return [...items];

  return items
    .map((item) => {
      let score = 0;
      for (const token of tokens) {
        let best = 0;
        for (const key of keys) {
          const value = item?.[key];
          if (!value) continue;
          const valueScore = fuzzyScore(token.normalized, value);
          if (valueScore > best) best = valueScore;
        }
        if (best === 0) return { item, score: 0 };
        score += best;
      }
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

/** پیشنهاد موجودیت‌های مشابه برای جلوگیری از تکرار (اسنپ / اسنپ‌فود) */
export function suggestSimilar(name, items, { threshold = 0.72, limit = 4, key = 'name' } = {}) {
  const target = normFa(name);
  if (!target) return [];
  return items
    .map((item) => {
      const value = normFa(item?.[key] || '');
      if (!value) return { item, score: 0 };
      let score = fuzzyScore(target, value);
      if (value === target) score = 1;
      else if (value.includes(target) || target.includes(value)) score = Math.max(score, 0.86);
      return { item, score };
    })
    .filter((row) => row.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** پیشنهاد تگ‌ها بر اساس متن فعلی */
export function suggestTags(text, tagPool, limit = 6) {
  const target = normFa(text);
  if (!target) return tagPool.slice(0, limit).map((t) => t.label);
  return tagPool
    .map((tag) => ({ tag, score: fuzzyScore(target, tag.label) }))
    .filter((row) => row.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.tag.label);
}

/** از رشته فیلتر CSV ساخته‌شده در URL، آرایه بساز */
export function parseIdList(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseListParam(value) {
  return uniqueBy(parseIdList(value), (v) => v);
}

export function ratingFilterFromParam(value) {
  const list = parseIdList(value).filter((key) => RATINGS[key]);
  return list;
}

export function maxPriceParam(value) {
  const num = parseNum(value);
  return Number.isFinite(num) ? num : null;
}
