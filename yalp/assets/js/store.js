/**
 * بازاربان — فروشگاه داده (Store)
 * ---------------------------------------------------------------------------
 * یک منبع حقیقتِ واحد برای همهٔ صفحه‌ها:
 *   • بارگذاری از Supabase وقتی جدول‌ها آماده‌اند
 *   • بازگشت خودکار به دادهٔ نمایشی محلی وقتی جدول‌ها یا شبکه در دسترس نیستند
 *   • محاسبهٔ امتیازها، جست‌وجوی وزن‌دار، فیلترها، مقایسه و فعالیت‌ها
 *   • عملیات نوشتن (امتیاز، نقد، رأی، ساخت موجودیت، لیست خرید)
 *
 * همهٔ صفحه‌ها فقط با این ماژول حرف می‌زنند تا رفتار برنامه یکدست بماند.
 */

import { CONFIG } from './config.js';
import {
  storage,
  normalizeFa,
  matchScore,
  weightedScore,
  uid,
  clamp,
  hueFrom,
  debounce,
  uniqBy,
  sortBy,
} from './utils.js';
import { buildSeed } from './seed.js';
import {
  getSupabase,
  probeBackend,
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
  signOutRemote,
  friendlyError,
  rowToVendor,
  rowToShop,
  rowToProduct,
  rowToComment,
  rowToRating,
  rowToVote,
  rowToList,
  rowToListItem,
  rowToActivity,
  rowToProfile,
  vendorToRow,
  shopToRow,
  productToRow,
  commentToRow,
  profileToRow,
} from './supabase-client.js';

const T = CONFIG.TABLES;
const ENTITY_KEYS = ['vendor', 'shop', 'product'];
const SCORE_MIN = -100;
const SCORE_MAX = 100;

/* --------------------------------------------------------------------------
   وضعیت
   -------------------------------------------------------------------------- */
const state = {
  mode: 'loading', // loading | live | demo
  modeDetail: '',
  ready: false,
  bootError: null,

  user: null,
  profile: null,

  vendors: [],
  shops: [],
  products: [],
  comments: [],
  ratings: [],
  votes: [],
  lists: [],
  listItems: [],
  reports: [],
  activity: [],
  profiles: [],

  /** Map<"type:id", scoreObject> */
  scores: new Map(),

  compare: [],
  recent: [],
  lastSyncAt: null,
  pendingWrites: 0,
};

const listeners = new Set();
let emitScheduled = false;

function emit() {
  if (emitScheduled) return;
  emitScheduled = true;
  queueMicrotask(() => {
    emitScheduled = false;
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('[bb/store] شنونده خطا داد:', error);
      }
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* --------------------------------------------------------------------------
   امتیازها
   -------------------------------------------------------------------------- */
export function verdictOf(score, total) {
  if (!total) return 'none';
  if (score >= CONFIG.THRESHOLDS.good) return 'good';
  if (score <= CONFIG.THRESHOLDS.bad) return 'bad';
  return 'meh';
}

export const VERDICT_LABELS = Object.freeze({
  good: 'عمدتاً خوب',
  meh: 'نه‌خوب',
  bad: 'عمدتاً افتضاح',
  mixed: 'دوقطبی',
  none: 'بدون امتیاز',
});

const SCORE_COLORS = Object.freeze({
  good: 'var(--good)',
  meh: 'var(--meh)',
  bad: 'var(--bad)',
  mixed: 'var(--violet)',
  none: 'var(--text-faint)',
});

export const scoreColor = (verdict) => SCORE_COLORS[verdict] || SCORE_COLORS.none;

export const scoreLabel = (verdict) => VERDICT_LABELS[verdict] || VERDICT_LABELS.none;

function emptyScore() {
  return {
    total: 0,
    good: 0,
    meh: 0,
    bad: 0,
    score: 0,
    stars: 0,
    verdict: 'none',
    lastAt: null,
    dominant: null,
  };
}

function computeScores() {
  const map = new Map();
  const touch = (type, id) => {
    const key = `${type}:${id}`;
    if (!map.has(key)) map.set(key, emptyScore());
    return map.get(key);
  };

  for (const vendor of state.vendors) touch('vendor', vendor.id);
  for (const shop of state.shops) touch('shop', shop.id);
  for (const product of state.products) touch('product', product.id);

  for (const rating of state.ratings) {
    if (!ENTITY_KEYS.includes(rating.entityType)) continue;
    const entry = touch(rating.entityType, rating.entityId);
    if (rating.value === 'good') entry.good += 1;
    else if (rating.value === 'meh') entry.meh += 1;
    else if (rating.value === 'bad') entry.bad += 1;
    entry.total += 1;
    if (!entry.lastAt || new Date(rating.createdAt) > new Date(entry.lastAt)) {
      entry.lastAt = rating.createdAt;
    }
  }

  for (const entry of map.values()) {
    const total = entry.total;
    entry.score = total
      ? clamp(Math.round(((entry.good - entry.bad) / total) * 100), SCORE_MIN, SCORE_MAX)
      : 0;
    entry.stars = total ? (entry.good * 5 + entry.meh * 3 + entry.bad * 1) / total : 0;
    entry.verdict = verdictOf(entry.score, total);
    // دوقطبی: هم خوب زیاد، هم بد زیاد
    if (total >= 6 && entry.good >= 2 && entry.bad >= 2) {
      const spread = Math.abs(entry.good - entry.bad) / total;
      if (entry.verdict !== 'good' && entry.verdict !== 'bad' && spread < 0.3) {
        entry.verdict = 'mixed';
      }
    }
    entry.dominant =
      entry.good >= entry.meh && entry.good >= entry.bad
        ? 'good'
        : entry.bad >= entry.good && entry.bad >= entry.meh
          ? 'bad'
          : 'meh';
  }

  state.scores = map;
}

/** امتیاز یک موجودیت */
export function scoreFor(type, id) {
  return state.scores.get(`${type}:${id}`) || emptyScore();
}

export function percentOf(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/* --------------------------------------------------------------------------
   دسترسی به موجودیت‌ها
   -------------------------------------------------------------------------- */
export const allVendors = () => state.vendors;
export const allShops = () => state.shops;
export const allProducts = () => state.products;

export function getVendor(key) {
  if (!key) return null;
  return state.vendors.find((v) => v.slug === key) || state.vendors.find((v) => v.id === key) || null;
}

export const getShop = (id) => state.shops.find((s) => s.id === id) || null;
export const getProduct = (id) => state.products.find((p) => p.id === id) || null;

export function getEntity(type, key) {
  if (type === 'vendor') return getVendor(key);
  if (type === 'shop') return getShop(key);
  if (type === 'product') return getProduct(key);
  return null;
}

export const shopsOfVendor = (vendorId) =>
  state.shops.filter((shop) => shop.vendorId === vendorId);

export const productsOfVendor = (vendorId) =>
  state.products.filter((product) => product.vendorId === vendorId);

export const productsOfShop = (shopId) => state.products.filter((p) => p.shopId === shopId);

export const vendorOfShop = (shop) => (shop ? getVendor(shop.vendorId) : null);

export function entityName(type, entity) {
  if (!entity) return '';
  if (type === 'vendor') return entity.nameFa || entity.name;
  return entity.name;
}

export function entitySubtitle(type, entity) {
  if (!entity) return '';
  if (type === 'vendor') return CONFIG.KIND_MAP[entity.kind] || 'فروشنده';
  if (type === 'shop') {
    const vendor = getVendor(entity.vendorId);
    return `${vendor?.nameFa || 'فروشگاه'} · ${entity.city || ''}`;
  }
  if (type === 'product') {
    const vendor = getVendor(entity.vendorId);
    return `${vendor?.nameFa || ''} · ${CONFIG.CATEGORY_MAP[entity.category] || 'سایر'}`;
  }
  return '';
}

export function entityHref(type, entity) {
  if (!entity) return '#/';
  if (type === 'vendor') return `#/vendor/${encodeURIComponent(entity.slug)}`;
  return `#/${type}/${entity.id}`;
}

/** آدرس از نوع و شناسهٔ خام (برای لینک‌های ذخیره‌شده) */
export function hrefForId(type, id) {
  if (type === 'vendor') {
    const vendor = getVendor(id);
    return vendor ? `#/vendor/${encodeURIComponent(vendor.slug)}` : '#/vendors';
  }
  return `#/${type}/${id}`;
}

export function entityKey(type, entity) {
  return `${type}:${entity?.id || ''}`;
}

export const commentsOf = (type, id) =>
  state.comments
    .filter((c) => c.entityType === type && c.entityId === id && c.status !== 'hidden')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const ratingsOf = (type, id) =>
  state.ratings.filter((r) => r.entityType === type && r.entityId === id);

export const votesOf = (commentId) => state.votes.filter((v) => v.commentId === commentId);

export const voteCount = (commentId) =>
  state.votes.filter((v) => v.commentId === commentId && v.value !== -1).length;

export function hasVoted(commentId) {
  if (!state.user) return false;
  return state.votes.some((v) => v.commentId === commentId && v.userId === state.user.id);
}

export function myRating(type, id) {
  if (!state.user) return null;
  return (
    state.ratings.find(
      (r) => r.entityType === type && r.entityId === id && r.userId === state.user.id,
    ) || null
  );
}

export const myRatings = () =>
  state.user ? state.ratings.filter((r) => r.userId === state.user.id) : [];

export const myComments = () =>
  state.user ? state.comments.filter((c) => c.userId === state.user.id) : [];

export const profileOf = (userId) =>
  state.profiles.find((p) => p.userId === userId) || null;

export function displayNameOf(comment) {
  if (!comment) return 'کاربر بازاربان';
  if (comment.userId) {
    const profile = profileOf(comment.userId);
    if (profile?.displayName) return profile.displayName;
    if (comment.userId === state.user?.id) return state.user.displayName || 'شما';
    if (comment.guestName && comment.guestName !== 'مهمان') return comment.guestName;
    return 'کاربر بازاربان';
  }
  return comment.guestName || 'مهمان';
}

export function avatarHueOf(comment) {
  if (comment?.userId) {
    const profile = profileOf(comment.userId);
    if (profile) return profile.avatarHue;
    return hueFrom(comment.userId);
  }
  return comment?.avatarHue ?? hueFrom(comment?.guestName || 'مهمان');
}

/* --------------------------------------------------------------------------
   آمار کلی
   -------------------------------------------------------------------------- */
export const totalRatings = () => state.ratings.length;
export const totalComments = () => state.comments.length;

export function globalStats() {
  const ratings = state.ratings;
  const good = ratings.filter((r) => r.value === 'good').length;
  const meh = ratings.filter((r) => r.value === 'meh').length;
  const bad = ratings.filter((r) => r.value === 'bad').length;
  const cities = new Set([...state.shops.map((s) => s.city), ...state.vendors.map((v) => v.city)]);
  const week = Date.now() - 7 * 86400000;
  return {
    vendors: state.vendors.length,
    shops: state.shops.length,
    products: state.products.length,
    comments: state.comments.length,
    ratings: ratings.length,
    good,
    meh,
    bad,
    cities: cities.size,
    goodRate: ratings.length ? Math.round((good / ratings.length) * 100) : 0,
    badRate: ratings.length ? Math.round((bad / ratings.length) * 100) : 0,
    weekComments: state.comments.filter((c) => new Date(c.createdAt).getTime() >= week).length,
    contributors: new Set([
      ...state.comments.map((c) => c.userId || c.guestName),
      ...state.ratings.map((r) => r.userId),
    ]).size,
  };
}

export function ratingDistribution(items = state.ratings) {
  const total = items.length || 1;
  const good = items.filter((r) => r.value === 'good').length;
  const meh = items.filter((r) => r.value === 'meh').length;
  const bad = items.filter((r) => r.value === 'bad').length;
  return {
    total: items.length,
    good,
    meh,
    bad,
    goodPct: Math.round((good / total) * 100),
    mehPct: Math.round((meh / total) * 100),
    badPct: Math.round((bad / total) * 100),
  };
}

/* --------------------------------------------------------------------------
   مرتب‌سازی و فیلتر
   -------------------------------------------------------------------------- */
function reviewCount(type, id) {
  return commentsOf(type, id).length;
}

function sortEntities(list, sort, type) {
  const rows = [...list];
  const byScore = (a, b) => {
    const sa = scoreFor(type, a.id);
    const sb = scoreFor(type, b.id);
    // موجودیت‌های بدون رأی همیشه ته لیست
    if (!sa.total && sb.total) return 1;
    if (!sb.total && sa.total) return -1;
    if (sb.score !== sa.score) return sb.score - sa.score;
    return sb.total - sa.total;
  };

  switch (sort) {
    case 'score_asc':
      return rows.sort((a, b) => {
        const sa = scoreFor(type, a.id);
        const sb = scoreFor(type, b.id);
        if (!sa.total && sb.total) return 1;
        if (!sb.total && sa.total) return -1;
        if (sa.score !== sb.score) return sa.score - sb.score;
        return sb.total - sa.total;
      });
    case 'reviews_desc':
      return rows.sort((a, b) => {
        const diff = reviewCount(type, b.id) - reviewCount(type, a.id);
        if (diff !== 0) return diff;
        return scoreFor(type, b.id).total - scoreFor(type, a.id).total;
      });
    case 'newest':
      return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case 'name_asc':
      return sortBy(rows, (x) => entityName(type, x), 'asc');
    case 'city':
      return sortBy(rows, (x) => x.city || '', 'asc');
    case 'price_asc':
      return rows.sort((a, b) => {
        const pa = Number(a.price) || Number.MAX_SAFE_INTEGER;
        const pb = Number(b.price) || Number.MAX_SAFE_INTEGER;
        return pa - pb;
      });
    case 'price_desc':
      return rows.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    case 'score_desc':
    default:
      return rows.sort(byScore);
  }
}

export function filterVendors(list, filters = {}) {
  const {
    q = '',
    kinds = [],
    cities = [],
    verdicts = [],
    verifiedOnly = false,
    minReviews = 0,
    hasApp = null,
  } = filters;
  const query = normalizeFa(q);

  return list.filter((vendor) => {
    if (kinds.length && !kinds.includes(vendor.kind)) return false;
    if (cities.length && !cities.includes(vendor.city)) return false;
    if (verifiedOnly && !vendor.isVerified) return false;
    if (hasApp === true && !vendor.website) return false;
    const score = scoreFor('vendor', vendor.id);
    if (verdicts.length && !verdicts.includes(score.verdict)) return false;
    if (minReviews && score.total < minReviews) return false;
    if (!query) return true;
    return (
      weightedScore(
        [
          [vendor.nameFa, 1.4],
          [vendor.name, 1.3],
          [vendor.slug, 1],
          [vendor.tagline, 0.7],
          [vendor.description, 0.35],
          [vendor.city, 0.5],
          [CONFIG.KIND_MAP[vendor.kind], 0.4],
        ],
        query,
      ) > 0
    );
  });
}

export function filterShops(list, filters = {}) {
  const {
    q = '',
    vendorId = null,
    cities = [],
    verdicts = [],
    pickupOnly = false,
    deliveryOnly = false,
  } = filters;
  const query = normalizeFa(q);

  return list.filter((shop) => {
    if (vendorId && shop.vendorId !== vendorId) return false;
    if (cities.length && !cities.includes(shop.city)) return false;
    if (pickupOnly && !shop.pickup) return false;
    if (deliveryOnly && !shop.delivery) return false;
    const score = scoreFor('shop', shop.id);
    if (verdicts.length && !verdicts.includes(score.verdict)) return false;
    if (!query) return true;
    const vendor = getVendor(shop.vendorId);
    return (
      weightedScore(
        [
          [shop.name, 1.5],
          [shop.city, 0.6],
          [shop.district, 0.7],
          [shop.address, 0.35],
          [vendor?.nameFa, 0.8],
        ],
        query,
      ) > 0
    );
  });
}

export function filterProducts(list, filters = {}) {
  const {
    q = '',
    vendorId = null,
    shopId = null,
    categories = [],
    cities = [],
    verdicts = [],
    priceMin = null,
    priceMax = null,
    availableOnly = false,
  } = filters;
  const query = normalizeFa(q);

  return list.filter((product) => {
    if (vendorId && product.vendorId !== vendorId) return false;
    if (shopId && product.shopId !== shopId) return false;
    if (categories.length && !categories.includes(product.category)) return false;
    if (availableOnly && !product.isAvailable) return false;
    if (priceMin !== null && Number(product.price || 0) < priceMin) return false;
    if (priceMax !== null && Number(product.price || 0) > priceMax) return false;
    const score = scoreFor('product', product.id);
    if (verdicts.length && !verdicts.includes(score.verdict)) return false;
    if (cities.length) {
      const vendor = getVendor(product.vendorId);
      if (!cities.includes(vendor?.city)) return false;
    }
    if (!query) return true;
    const vendor = getVendor(product.vendorId);
    return (
      weightedScore(
        [
          [product.name, 1.5],
          [product.brand, 1.1],
          [product.unit, 0.5],
          [CONFIG.CATEGORY_MAP[product.category], 0.5],
          [product.tags?.join(' '), 0.6],
          [vendor?.nameFa, 0.4],
        ],
        query,
      ) > 0
    );
  });
}

/** جست‌وجوی سراسری با امتیاز تطبیق */
export function searchAll(query, { limit = 8 } = {}) {
  const q = normalizeFa(query);
  if (!q) return { vendors: [], shops: [], products: [], comments: [] };

  const vendors = state.vendors
    .map((vendor) => ({
      entity: vendor,
      type: 'vendor',
      score:
        weightedScore(
          [
            [vendor.nameFa, 1.6],
            [vendor.name, 1.4],
            [vendor.tagline, 0.8],
            [vendor.description, 0.3],
            [vendor.city, 0.4],
          ],
          q,
        ) + Math.max(0, scoreFor('vendor', vendor.id).score) * 0.06,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const shops = state.shops
    .map((shop) => {
      const vendor = getVendor(shop.vendorId);
      return {
        entity: shop,
        type: 'shop',
        score:
          weightedScore(
            [
              [shop.name, 1.6],
              [shop.district, 0.8],
              [shop.city, 0.6],
              [shop.address, 0.3],
              [vendor?.nameFa, 0.7],
            ],
            q,
          ) + Math.max(0, scoreFor('shop', shop.id).score) * 0.05,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const products = state.products
    .map((product) => ({
      entity: product,
      type: 'product',
      score:
        weightedScore(
          [
            [product.name, 1.7],
            [product.brand, 1.2],
            [CONFIG.CATEGORY_MAP[product.category], 0.5],
            [product.tags?.join(' '), 0.5],
          ],
          q,
        ) + Math.max(0, scoreFor('product', product.id).score) * 0.04,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const comments = state.comments
    .map((comment) => ({
      entity: comment,
      type: 'comment',
      score: matchScore(comment.body, q) + matchScore(comment.guestName, q) * 0.3,
    }))
    .filter((x) => x.score > 20)
    .sort((a, b) => b.score - a.score || new Date(b.entity.createdAt) - new Date(a.entity.createdAt))
    .slice(0, limit);

  return { vendors, shops, products, comments };
}

/* --------------------------------------------------------------------------
   رتبه‌بندی
   -------------------------------------------------------------------------- */
export function leaderboard(type, { direction = 'desc', limit = 5, minTotal = 3 } = {}) {
  const source =
    type === 'vendor' ? state.vendors : type === 'shop' ? state.shops : state.products;
  return source
    .map((entity) => ({ entity, score: scoreFor(type, entity.id) }))
    .filter((row) => row.score.total >= minTotal)
    .sort((a, b) => (direction === 'desc' ? b.score.score - a.score.score : a.score.score - b.score.score))
    .slice(0, limit);
}

export function recentComments(limit = 8, filters = {}) {
  let list = state.comments.filter((c) => c.status !== 'hidden');
  if (filters.level) list = list.filter((c) => c.level === filters.level);
  if (filters.entityType) list = list.filter((c) => c.entityType === filters.entityType);
  return list
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export function cityFacets(type = 'vendor') {
  const source = type === 'vendor' ? state.vendors : type === 'shop' ? state.shops : state.products.map((p) => ({ city: getVendor(p.vendorId)?.city }));
  const counts = new Map();
  for (const item of source) {
    const city = item?.city || 'نامشخص';
    counts.set(city, (counts.get(city) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([city, count]) => ({ city, count }));
}

export function categoryFacets() {
  const counts = new Map();
  for (const product of state.products) {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
  }
  return CONFIG.CATEGORIES.map((category) => ({
    ...category,
    count: counts.get(category.id) || 0,
  })).filter((c) => c.count > 0);
}

export function kindFacets() {
  const counts = new Map();
  for (const vendor of state.vendors) {
    counts.set(vendor.kind, (counts.get(vendor.kind) || 0) + 1);
  }
  return CONFIG.KINDS.map((kind) => ({ ...kind, count: counts.get(kind.id) || 0 }));
}

export function levelFacets(type = 'vendor') {
  const source = type === 'vendor' ? state.vendors : type === 'shop' ? state.shops : state.products;
  const counts = { good: 0, meh: 0, bad: 0, none: 0, mixed: 0 };
  for (const entity of source) {
    const score = scoreFor(type, entity.id);
    counts[score.verdict] = (counts[score.verdict] || 0) + 1;
  }
  return counts;
}

/** نقدهای مرتبط برای صفحهٔ موجودیت */
export function relatedEntities(type, entity, limit = 4) {
  if (!entity) return [];
  if (type === 'vendor') {
    return sortBy(
      state.vendors.filter((v) => v.id !== entity.id && v.kind === entity.kind),
      (v) => scoreFor('vendor', v.id).score,
      'desc',
    ).slice(0, limit);
  }
  if (type === 'product') {
    return sortBy(
      state.products.filter((p) => p.id !== entity.id && p.category === entity.category),
      (p) => scoreFor('product', p.id).score,
      'desc',
    ).slice(0, limit);
  }
  return sortBy(
    state.shops.filter((s) => s.id !== entity.id && s.city === entity.city),
    (s) => scoreFor('shop', s.id).score,
    'desc',
  ).slice(0, limit);
}

/* --------------------------------------------------------------------------
   مقایسه و بازدیدهای اخیر
   -------------------------------------------------------------------------- */
export function loadCompare() {
  const saved = storage.get(CONFIG.LS.compare, []);
  state.compare = Array.isArray(saved)
    ? saved
        .filter((entry) => entry && ENTITY_KEYS.includes(entry.type) && entry.id)
        .slice(0, CONFIG.COMPARE_MAX)
    : [];
}

function persistCompare() {
  storage.set(CONFIG.LS.compare, state.compare);
}

export function toggleCompare(type, id) {
  const exists = state.compare.find((entry) => entry.type === type && entry.id === id);
  if (exists) {
    state.compare = state.compare.filter((entry) => !(entry.type === type && entry.id === id));
    persistCompare();
    emit();
    return { added: false, full: false };
  }
  if (state.compare.length >= CONFIG.COMPARE_MAX) {
    return { added: false, full: true };
  }
  state.compare = [...state.compare, { type, id }];
  persistCompare();
  emit();
  return { added: true, full: false };
}

export function clearCompare() {
  state.compare = [];
  persistCompare();
  emit();
}

export const inCompare = (type, id) =>
  state.compare.some((entry) => entry.type === type && entry.id === id);

export const compareEntities = () =>
  state.compare
    .map((entry) => ({ type: entry.type, entity: getEntity(entry.type, entry.id) }))
    .filter((entry) => entry.entity);

export function loadRecent() {
  const saved = storage.get(CONFIG.LS.recent, []);
  state.recent = Array.isArray(saved) ? saved.filter(Boolean).slice(0, 8) : [];
}

export function markViewed(type, entity) {
  if (!entity) return;
  const entry = { type, id: entity.id, at: Date.now() };
  state.recent = [entry, ...state.recent.filter((x) => !(x.type === type && x.id === entity.id))].slice(0, 8);
  storage.set(CONFIG.LS.recent, state.recent);
}

export function recentEntities() {
  return state.recent
    .map((entry) => ({ type: entry.type, entity: getEntity(entry.type, entry.id) }))
    .filter((entry) => entry.entity);
}

/* --------------------------------------------------------------------------
   لیست‌های خرید
   -------------------------------------------------------------------------- */
export const myLists = () =>
  state.user ? state.lists.filter((list) => list.userId === state.user.id) : [];

export function itemsOfList(listId) {
  return state.listItems
    .filter((item) => item.listId === listId)
    .map((item) => ({ ...item, entity: getEntity(item.entityType, item.entityId) }))
    .filter((item) => item.entity);
}

export const listsContaining = (type, id) => {
  if (!state.user) return [];
  const listIds = state.listItems
    .filter((item) => item.entityType === type && item.entityId === id)
    .map((item) => item.listId);
  return state.lists.filter((list) => list.userId === state.user.id && listIds.includes(list.id));
};

/** آیا این موجودیت در «خرید بعدی» هست؟ */
export function inShoppingList(type, id) {
  if (!state.user) return false;
  const listIds = new Set(state.lists.filter((l) => l.userId === state.user.id).map((l) => l.id));
  return state.listItems.some(
    (item) => item.entityType === type && item.entityId === id && listIds.has(item.listId),
  );
}

/* --------------------------------------------------------------------------
   نوشتن روی سرور یا حالت محلی
   -------------------------------------------------------------------------- */
let persistTimer = null;
const persistDemo = debounce(() => {
  if (state.mode !== 'demo') return;
  storage.set(CONFIG.LS.demoState, {
    version: CONFIG.STORE_VERSION,
    savedAt: new Date().toISOString(),
    vendors: state.vendors,
    shops: state.shops,
    products: state.products,
    comments: state.comments,
    ratings: state.ratings,
    votes: state.votes,
    lists: state.lists,
    listItems: state.listItems,
    profiles: state.profiles,
    reports: state.reports,
    activity: state.activity,
  });
}, 350);

function touch() {
  computeScores();
  if (state.mode === 'demo') persistDemo();
  emit();
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return uid('bb');
}

function requireUser() {
  if (!state.user) {
    const error = new Error('برای این کار باید وارد شوی.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  return state.user;
}

async function logActivity(action, entityType, entityId, detail = '') {
  if (!state.user) return;
  const entry = {
    id: newId(),
    userId: state.user.id,
    action,
    entityType,
    entityId,
    detail,
    createdAt: new Date().toISOString(),
  };
  state.activity = [entry, ...state.activity].slice(0, 200);
  if (state.mode === 'live') {
    try {
      const supabase = await getSupabase();
      await supabase.from(T.activity).insert({
        action,
        entity_type: entityType,
        entity_id: entityId,
        detail: String(detail).slice(0, 300),
      });
    } catch {
      // فعالیت‌ها اختیاری‌اند؛ خطای آن‌ها نباید تجربهٔ کاربر را بشکند
    }
  }
}

/* ------------------------------- امتیاز ------------------------------- */
export async function rate(type, id, value) {
  const user = requireUser();
  if (!['good', 'meh', 'bad'].includes(value)) throw new Error('سطح امتیاز نامعتبر است.');

  const existing = state.ratings.find(
    (r) => r.entityType === type && r.entityId === id && r.userId === user.id,
  );

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(T.ratings)
      .upsert(
        {
          entity_type: type,
          entity_id: id,
          user_id: user.id,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entity_type,entity_id,user_id' },
      )
      .select('*')
      .single();
    if (error) throw new Error(friendlyError(error, 'ثبت امتیاز ناموفق بود.'));
    const mapped = rowToRating(data);
    state.ratings = existing
      ? state.ratings.map((r) => (r.id === existing.id ? mapped : r))
      : [...state.ratings, mapped];
  } else {
    const now = new Date().toISOString();
    if (existing) {
      state.ratings = state.ratings.map((r) =>
        r.id === existing.id ? { ...r, value, updatedAt: now } : r,
      );
    } else {
      state.ratings = [
        ...state.ratings,
        {
          id: newId(),
          entityType: type,
          entityId: id,
          userId: user.id,
          value,
          createdAt: now,
          updatedAt: now,
          source: 'demo',
        },
      ];
    }
  }

  await logActivity('rate', type, id, value);
  touch();
  return value;
}

/* -------------------------------- نقد -------------------------------- */
export async function addComment({ type, id, body, level = null, tags = [] }) {
  const user = state.user;
  const text = String(body || '').trim();
  if (text.length < CONFIG.COMMENT_MIN) {
    throw new Error(`متن نقد باید حداقل ${CONFIG.COMMENT_MIN} کاراکتر باشد.`);
  }
  if (text.length > CONFIG.COMMENT_MAX) {
    throw new Error(`متن نقد نباید بیش از ${CONFIG.COMMENT_MAX} کاراکتر باشد.`);
  }
  const cleanTags = (Array.isArray(tags) ? tags : []).filter((tag) => CONFIG.COMMENT_TAGS.includes(tag)).slice(0, 5);

  let created;
  if (state.mode === 'live') {
    if (!user) throw new Error('برای ثبت نقد باید وارد شوی.');
    const supabase = await getSupabase();
    const profile = state.profile;
    const { data, error } = await supabase
      .from(T.comments)
      .insert({
        ...commentToRow({ entityType: type, entityId: id, body: text, level, tags: cleanTags }),
        guest_name: profile?.displayName || state.user.displayName || 'کاربر بازاربان',
      })
      .select('*')
      .single();
    if (error) throw new Error(friendlyError(error, 'ثبت نقد ناموفق بود.'));
    created = rowToComment(data);
  } else {
    created = {
      id: newId(),
      entityType: type,
      entityId: id,
      userId: user?.id || null,
      guestName: user?.displayName || 'مهمان بازاربان',
      avatarHue: user?.avatarHue ?? hueFrom('مهمان'),
      body: text,
      level,
      tags: cleanTags,
      status: 'published',
      createdAt: new Date().toISOString(),
      source: 'demo',
    };
  }

  state.comments = [created, ...state.comments];
  if (user) await logActivity('comment', type, id, level || '');
  touch();
  return created;
}

export async function deleteComment(commentId) {
  const user = requireUser();
  const comment = state.comments.find((c) => c.id === commentId);
  if (!comment) return;
  if (comment.userId !== user.id) throw new Error('فقط نویسندهٔ نقد می‌تواند آن را حذف کند.');

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { error } = await supabase.from(T.comments).delete().eq('id', commentId).eq('user_id', user.id);
    if (error) throw new Error(friendlyError(error, 'حذف نقد ناموفق بود.'));
  }
  state.comments = state.comments.filter((c) => c.id !== commentId);
  state.votes = state.votes.filter((v) => v.commentId !== commentId);
  touch();
}

export async function toggleVote(commentId) {
  const user = requireUser();
  const existing = state.votes.find((v) => v.commentId === commentId && v.userId === user.id);

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    if (existing) {
      const { error } = await supabase
        .from(T.votes)
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id);
      if (error) throw new Error(friendlyError(error, 'برداشتن رأی ناموفق بود.'));
      state.votes = state.votes.filter((v) => !(v.commentId === commentId && v.userId === user.id));
    } else {
      const { data, error } = await supabase
        .from(T.votes)
        .insert({ comment_id: commentId, user_id: user.id, value: 1 })
        .select('*')
        .single();
      if (error) throw new Error(friendlyError(error, 'ثبت رأی ناموفق بود.'));
      state.votes = [...state.votes, rowToVote(data)];
    }
  } else if (existing) {
    state.votes = state.votes.filter((v) => !(v.commentId === commentId && v.userId === user.id));
  } else {
    state.votes = [
      ...state.votes,
      { id: newId(), commentId, userId: user.id, value: 1, createdAt: new Date().toISOString() },
    ];
  }

  touch();
  return !existing;
}

export async function reportContent({ type, id, reason, details = '' }) {
  const user = state.user;
  const entry = {
    id: newId(),
    entityType: type,
    entityId: id,
    userId: user?.id || null,
    reason,
    details: String(details).slice(0, 500),
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { error } = await supabase.from(T.reports).insert({
      entity_type: type,
      entity_id: id,
      user_id: user?.id || null,
      reason,
      details: entry.details,
    });
    if (error) throw new Error(friendlyError(error, 'ثبت گزارش ناموفق بود.'));
  }

  state.reports = [entry, ...state.reports];
  touch();
  return entry;
}

/* ------------------------------ ساخت موجودیت ------------------------------ */
export async function createEntity(type, payload) {
  const user = requireUser();
  if (!ENTITY_KEYS.includes(type)) throw new Error('نوع موجودیت نامعتبر است.');

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    let row;
    let table;
    if (type === 'vendor') {
      table = T.vendors;
      row = vendorToRow(payload);
    } else if (type === 'shop') {
      table = T.shops;
      row = shopToRow(payload);
    } else {
      table = T.products;
      row = productToRow(payload);
    }
    const { data, error } = await supabase.from(table).insert(row).select('*').single();
    if (error) throw new Error(friendlyError(error, 'ثبت مورد جدید ناموفق بود.'));

    let entity;
    if (type === 'vendor') entity = rowToVendor(data);
    else if (type === 'shop') entity = rowToShop(data);
    else entity = rowToProduct(data);

    if (type === 'vendor') state.vendors = [...state.vendors, entity];
    if (type === 'shop') state.shops = [...state.shops, entity];
    if (type === 'product') state.products = [...state.products, entity];

    await logActivity('create', type, entity.id, entityName(type, entity));
    touch();
    return entity;
  }

  /* حالت محلی */
  const now = new Date().toISOString();
  let entity;
  if (type === 'vendor') {
    entity = {
      id: newId(),
      slug: payload.slug,
      name: payload.name,
      nameFa: payload.nameFa || payload.name,
      kind: payload.kind || 'local',
      tagline: payload.tagline || '',
      description: payload.description || '',
      website: payload.website || '',
      city: payload.city || '',
      supportPhone: payload.supportPhone || '',
      brandHue: payload.brandHue ?? hueFrom(payload.name, 360),
      isVerified: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      source: 'demo',
    };
    state.vendors = [...state.vendors, entity];
  } else if (type === 'shop') {
    entity = {
      id: newId(),
      vendorId: payload.vendorId,
      name: payload.name,
      city: payload.city || '',
      district: payload.district || '',
      address: payload.address || '',
      phone: payload.phone || '',
      pickup: payload.pickup !== false,
      delivery: payload.delivery !== false,
      hours: payload.hours || '',
      lat: null,
      lng: null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      source: 'demo',
    };
    state.shops = [...state.shops, entity];
  } else {
    entity = {
      id: newId(),
      vendorId: payload.vendorId,
      shopId: payload.shopId || null,
      name: payload.name,
      brand: payload.brand || '',
      category: payload.category || 'other',
      unit: payload.unit || 'عدد',
      price: payload.price ?? null,
      barcode: payload.barcode || '',
      tags: payload.tags || [],
      isAvailable: payload.isAvailable !== false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      source: 'demo',
    };
    state.products = [...state.products, entity];
  }

  await logActivity('create', type, entity.id, entityName(type, entity));
  touch();
  return entity;
}

/* ------------------------------- لیست خرید ------------------------------- */
export async function createList({ name, emoji = '🛒', isPublic = false }) {
  const user = requireUser();
  const entry = {
    id: newId(),
    userId: user.id,
    name: String(name || 'لیست من').slice(0, 60),
    emoji,
    isPublic,
    createdAt: new Date().toISOString(),
  };
  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(T.lists)
      .insert({ name: entry.name, emoji: entry.emoji, is_public: entry.isPublic })
      .select('*')
      .single();
    if (error) throw new Error(friendlyError(error, 'ساخت لیست ناموفق بود.'));
    const mapped = rowToList(data);
    state.lists = [...state.lists, mapped];
    return mapped;
  }
  state.lists = [...state.lists, entry];
  touch();
  return entry;
}

export async function ensureDefaultList() {
  const user = requireUser();
  const existing = myLists().find((list) => list.name === 'خرید بعدی');
  if (existing) return existing;
  return createList({ name: 'خرید بعدی', emoji: '🛒' });
}

export async function addToList(listId, type, id, note = '') {
  const user = requireUser();
  const list = myLists().find((l) => l.id === listId);
  if (!list) throw new Error('لیست پیدا نشد.');
  const duplicate = state.listItems.find(
    (item) => item.listId === listId && item.entityType === type && item.entityId === id,
  );
  if (duplicate) return duplicate;

  const entry = {
    id: newId(),
    listId,
    entityType: type,
    entityId: id,
    note: String(note).slice(0, 200),
    createdAt: new Date().toISOString(),
  };

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(T.listItems)
      .insert({
        list_id: listId,
        entity_type: type,
        entity_id: id,
        note: entry.note,
      })
      .select('*')
      .single();
    if (error) throw new Error(friendlyError(error, 'افزودن به لیست ناموفق بود.'));
    state.listItems = [...state.listItems, rowToListItem(data)];
  } else {
    state.listItems = [...state.listItems, entry];
  }

  await logActivity('list_add', type, id, list.name);
  touch();
  return entry;
}

export async function removeFromList(listId, itemId) {
  const user = requireUser();
  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { error } = await supabase.from(T.listItems).delete().eq('id', itemId).eq('list_id', listId);
    if (error) throw new Error(friendlyError(error, 'حذف از لیست ناموفق بود.'));
  }
  state.listItems = state.listItems.filter((item) => item.id !== itemId);
  touch();
}

export async function toggleShoppingList(type, id) {
  const user = requireUser();
  const list = await ensureDefaultList();
  const existing = state.listItems.find(
    (item) => item.listId === list.id && item.entityType === type && item.entityId === id,
  );
  if (existing) {
    await removeFromList(list.id, existing.id);
    return false;
  }
  await addToList(list.id, type, id);
  return true;
}

/* ------------------------------- پروفایل ------------------------------- */
export async function updateProfile(partial) {
  const user = requireUser();
  const base = state.profile || {
    userId: user.id,
    displayName: user.displayName,
    city: '',
    bio: '',
    avatarHue: user.avatarHue ?? 152,
  };
  const merged = {
    ...base,
    ...partial,
    displayName: String(partial.displayName ?? base.displayName).slice(0, 40),
    city: String(partial.city ?? base.city).slice(0, 40),
    bio: String(partial.bio ?? base.bio).slice(0, 280),
  };

  if (state.mode === 'live') {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from(T.profiles)
      .upsert(profileToRow({ ...merged, userId: user.id }), { onConflict: 'user_id' });
    if (error) throw new Error(friendlyError(error, 'ذخیرهٔ نمایه ناموفق بود.'));
  }

  state.profile = merged;
  state.profiles = [
    merged,
    ...state.profiles.filter((profile) => profile.userId !== merged.userId),
  ];
  state.user = { ...state.user, displayName: merged.displayName, avatarHue: merged.avatarHue };
  touch();
  return merged;
}

/* --------------------------------------------------------------------------
   احراز هویت
   -------------------------------------------------------------------------- */
function demoAuthStore() {
  return storage.get(CONFIG.LS.demoAuth, []);
}

function setDemoAuthStore(list) {
  storage.set(CONFIG.LS.demoAuth, list);
}

function demoUserFromRecord(record) {
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    avatarHue: record.avatarHue,
    isDemo: true,
    createdAt: record.createdAt,
  };
}

export function userInitialsSuggestion() {
  if (!state.user) return '؟';
  return state.user.displayName || state.user.email || '؟';
}

async function ensureLiveProfile(user) {
  try {
    const supabase = await getSupabase();
    const meta = user.user_metadata || {};
    const desiredName = String(meta.display_name || meta.full_name || user.email?.split('@')[0] || 'کاربر بازاربان').slice(0, 40);
    const { data: existing } = await supabase
      .from(T.profiles)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      state.profile = rowToProfile(existing);
      state.profiles = [state.profile, ...state.profiles.filter((p) => p.userId !== user.id)];
      return state.profile;
    }

    const payload = profileToRow({
      userId: user.id,
      displayName: desiredName,
      city: meta.city || '',
      bio: '',
      avatarHue: hueFrom(user.id),
    });
    const { data, error } = await supabase
      .from(T.profiles)
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();
    if (!error && data) {
      state.profile = rowToProfile(data);
      state.profiles = [state.profile, ...state.profiles.filter((p) => p.userId !== user.id)];
    } else {
      state.profile = {
        userId: user.id,
        displayName: desiredName,
        city: meta.city || '',
        bio: '',
        avatarHue: hueFrom(user.id),
      };
    }
  } catch (error) {
    console.warn('[bb] نمایهٔ کاربری ساخته نشد:', error);
    state.profile = {
      userId: user.id,
      displayName: user.email?.split('@')[0] || 'کاربر بازاربان',
      city: '',
      bio: '',
      avatarHue: hueFrom(user.id),
    };
  }
  emit();
  return state.profile;
}

async function loadUserScopedData(userId) {
  if (state.mode !== 'live') return;
  try {
    const supabase = await getSupabase();
    const [votes, lists, listItems, activity] = await Promise.all([
      supabase.from(T.votes).select('*').eq('user_id', userId),
      supabase.from(T.lists).select('*').eq('user_id', userId),
      supabase.from(T.listItems).select('*'),
      supabase.from(T.activity).select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
    ]);
    if (!votes.error && votes.data) state.votes = votes.data.map(rowToVote);
    if (!lists.error && lists.data) state.lists = lists.data.map(rowToList);
    if (!listItems.error && listItems.data) state.listItems = listItems.data.map(rowToListItem);
    if (!activity.error && activity.data) state.activity = activity.data.map(rowToActivity);
  } catch (error) {
    console.warn('[bb] داده‌های کاربر بارگذاری نشد:', error);
  }
}

export async function signIn({ email, password }) {
  if (state.mode === 'demo') {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) throw new Error('ایمیل معتبر وارد کن.');
    if (String(password || '').length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
    const store = demoAuthStore();
    let record = store.find((entry) => entry.email === normalized);
    if (!record) {
      record = {
        id: `demo-${hueFrom(normalized)}-${Math.random().toString(36).slice(2, 7)}`,
        email: normalized,
        displayName: normalized.split('@')[0],
        avatarHue: hueFrom(normalized),
        createdAt: new Date().toISOString(),
      };
      setDemoAuthStore([...store, record]);
    }
    const user = demoUserFromRecord(record);
    state.user = user;
    state.profile =
      state.profiles.find((profile) => profile.userId === user.id) || {
        userId: user.id,
        displayName: user.displayName,
        city: '',
        bio: '',
        avatarHue: user.avatarHue,
      };
    if (!state.profiles.some((profile) => profile.userId === user.id)) {
      state.profiles = [state.profile, ...state.profiles];
    }
    touch();
    return user;
  }

  try {
    const data = await signInWithPassword(String(email || '').trim(), password);
    const user = data.user || data.session?.user;
    if (!user) throw new Error('ورود انجام نشد.');
    state.user = {
      id: user.id,
      email: user.email,
      displayName: state.profile?.displayName || user.email?.split('@')[0],
      avatarHue: hueFrom(user.id),
      isDemo: false,
    };
    await ensureLiveProfile(user);
    await loadUserScopedData(user.id);
    touch();
    return state.user;
  } catch (error) {
    throw new Error(friendlyError(error, 'ورود ناموفق بود.'));
  }
}

export async function signUp({ email, password, displayName, city }) {
  if (state.mode === 'demo') {
    const user = await signIn({ email, password });
    if (displayName) await updateProfile({ displayName, city: city || '' });
    return user;
  }
  try {
    const data = await signUpWithPassword(String(email || '').trim(), password, { displayName, city });
    if (data.user && !data.session) {
      return { pendingConfirmation: true, email: data.user.email };
    }
    const user = data.user || data.session?.user;
    if (!user) throw new Error('ثبت‌نام انجام نشد.');
    state.user = {
      id: user.id,
      email: user.email,
      displayName: displayName || user.email?.split('@')[0],
      avatarHue: hueFrom(user.id),
      isDemo: false,
    };
    await ensureLiveProfile(user);
    await loadUserScopedData(user.id);
    touch();
    return state.user;
  } catch (error) {
    throw new Error(friendlyError(error, 'ثبت‌نام ناموفق بود.'));
  }
}

export async function magicLink(email) {
  if (state.mode === 'demo') throw new Error('در حالت نمایشی، ورود با لینک ایمیل فعال نیست. از رمز استفاده کن.');
  try {
    await signInWithMagicLink(String(email || '').trim());
    return true;
  } catch (error) {
    throw new Error(friendlyError(error, 'ارسال لینک ورود ناموفق بود.'));
  }
}

export async function signOut() {
  if (state.mode === 'live') {
    try {
      await signOutRemote();
    } catch (error) {
      console.warn('[bb] خروج ناموفق:', error);
    }
  }
  state.user = null;
  state.profile = null;
  state.votes = [];
  state.lists = [];
  state.listItems = [];
  state.activity = [];
  emit();
}

/* --------------------------------------------------------------------------
   راه‌اندازی
   -------------------------------------------------------------------------- */
async function fetchAllLive() {
  const supabase = await getSupabase();
  const queries = await Promise.all([
    supabase.from(T.vendors).select('*').order('created_at', { ascending: true }).limit(3000),
    supabase.from(T.shops).select('*').order('created_at', { ascending: true }).limit(3000),
    supabase.from(T.products).select('*').order('created_at', { ascending: true }).limit(5000),
    supabase.from(T.comments).select('*').order('created_at', { ascending: false }).limit(5000),
    supabase.from(T.ratings).select('*').limit(8000),
    supabase.from(T.profiles).select('*').limit(3000),
  ]);

  const [vendors, shops, products, comments, ratings, profiles] = queries;
  const firstError = queries.find((result) => result.error);
  if (firstError) throw firstError.error;

  state.vendors = (vendors.data || []).map(rowToVendor);
  state.shops = (shops.data || []).map(rowToShop);
  state.products = (products.data || []).map(rowToProduct);
  state.comments = (comments.data || []).map(rowToComment);
  state.ratings = (ratings.data || []).map(rowToRating);
  state.profiles = (profiles.data || []).map(rowToProfile);

  // آرایه‌های خصوصی، سپس نشست
  state.votes = [];
  state.lists = [];
  state.listItems = [];
  state.activity = [];

  const session = await getSession();
  if (session?.user) {
    const user = session.user;
    state.user = {
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || user.email?.split('@')[0],
      avatarHue: hueFrom(user.id),
      isDemo: false,
    };
    await ensureLiveProfile(user);
    await loadUserScopedData(user.id);
  }

  await onAuthStateChange(async (event, nextSession) => {
    if (event === 'SIGNED_OUT') {
      state.user = null;
      state.profile = null;
      state.votes = [];
      state.lists = [];
      state.listItems = [];
      state.activity = [];
      emit();
      return;
    }
    if (nextSession?.user) {
      const user = nextSession.user;
      state.user = {
        id: user.id,
        email: user.email,
        displayName: state.profile?.displayName || user.user_metadata?.display_name || user.email?.split('@')[0],
        avatarHue: hueFrom(user.id),
        isDemo: false,
      };
      await ensureLiveProfile(user);
      await loadUserScopedData(user.id);
      emit();
    }
  });
}

function hydrateDemo() {
  const cached = storage.get(CONFIG.LS.demoState, null);
  const seed = buildSeed();

  if (cached && cached.version === CONFIG.STORE_VERSION && Array.isArray(cached.vendors)) {
    state.vendors = cached.vendors;
    state.shops = cached.shops || [];
    state.products = cached.products || [];
    state.comments = cached.comments || [];
    state.ratings = cached.ratings || [];
    state.votes = cached.votes || [];
    state.lists = cached.lists || [];
    state.listItems = cached.listItems || [];
    state.profiles = cached.profiles || seed.profiles;
    state.reports = cached.reports || [];
    state.activity = cached.activity || [];
  } else {
    state.vendors = seed.vendors;
    state.shops = seed.shops;
    state.products = seed.products;
    state.comments = seed.comments;
    state.ratings = seed.ratings;
    state.votes = seed.votes;
    state.lists = seed.lists;
    state.listItems = seed.listItems;
    state.profiles = seed.profiles;
    state.reports = seed.reports;
    state.activity = seed.activity;
    persistDemo.flush();
  }

  // نشست نمایشی قبلی
  const session = storage.get('bb:demo:session', null);
  if (session && session.email) {
    const record = demoAuthStore().find((entry) => entry.email === session.email);
    if (record) {
      state.user = demoUserFromRecord(record);
      state.profile =
        state.profiles.find((profile) => profile.userId === state.user.id) || {
          userId: state.user.id,
          displayName: state.user.displayName,
          city: '',
          bio: '',
          avatarHue: state.user.avatarHue,
        };
    }
  }
}

/** راه‌اندازی: تلاش برای اتصال واقعی، سپس بازگشت به حالت نمایشی */
export async function initStore() {
  loadCompare();
  loadRecent();
  state.mode = 'loading';
  state.ready = false;
  emit();

  const probe = await probeBackend();
  if (probe.ok) {
    try {
      await fetchAllLive();
      state.mode = 'live';
      state.modeDetail = 'متصل به Supabase';
    } catch (error) {
      console.warn('[bb] بارگذاری داده از Supabase ناموفق بود؛ حالت نمایشی فعال شد.', error);
      state.mode = 'demo';
      state.modeDetail = friendlyError(error, 'داده‌های Supabase در دسترس نبود.');
      hydrateDemo();
    }
  } else {
    state.mode = 'demo';
    state.modeDetail =
      probe.reason === 'schema'
        ? 'جدول‌های smr_ هنوز در Supabase ساخته نشده‌اند.'
        : 'ارتباط با Supabase برقرار نشد.';
    hydrateDemo();
  }

  state.ready = true;
  state.lastSyncAt = new Date().toISOString();
  computeScores();
  emit();
  return state;
}

/** ذخیرهٔ نشست نمایشی */
export function persistDemoSession() {
  if (state.mode === 'demo' && state.user) {
    storage.set('bb:demo:session', { email: state.user.email });
  } else {
    storage.remove('bb:demo:session');
  }
}

/** پاک‌کردن دادهٔ نمایشی و ساخت دوباره */
export function resetDemoData() {
  storage.remove(CONFIG.LS.demoState);
  storage.remove('bb:demo:session');
  state.user = null;
  state.profile = null;
  hydrateDemo();
  state.mode = 'demo';
  state.ready = true;
  computeScores();
  emit();
}

/** خروجی گرفتن از داده‌ها برای پشتیبان‌گیری */
export function exportSnapshot() {
  return {
    app: CONFIG.APP_NAME,
    version: CONFIG.VERSION,
    exportedAt: new Date().toISOString(),
    mode: state.mode,
    stats: globalStats(),
    vendors: state.vendors,
    shops: state.shops,
    products: state.products,
    comments: state.comments.filter((c) => c.status !== 'hidden'),
    ratings: state.ratings,
  };
}

/* --------------------------------------------------------------------------
   نام‌گذاری پیوندها
   -------------------------------------------------------------------------- */
export const getState = () => state;
export const isAuthed = () => Boolean(state.user);
export const isDemo = () => state.mode === 'demo';
export const currentUser = () => state.user;
export const uniqCommentsByEntity = (list) =>
  uniqBy(list, (comment) => `${comment.entityType}:${comment.entityId}`);
