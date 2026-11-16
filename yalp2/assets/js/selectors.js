/* ============================================================
   Selectors — pure functions over store data
   ============================================================ */
import { normalizeFa, tokenize } from './utils.js';
import { purchaseSearchText } from './api.js';

export function computeFilteredPurchases(purchases, filters) {
  const tokens = tokenize(filters.query || '');
  const ratings = filters.ratings;
  const platformIds = filters.platformIds;
  const shopIds = filters.shopIds;
  const productIds = filters.productIds;

  const result = purchases.filter((p) => {
    if (ratings && ratings.size && !ratings.has(p.rating)) return false;
    if (platformIds && platformIds.size && (!p.platform_id || !platformIds.has(p.platform_id))) return false;
    if (shopIds && shopIds.size && !shopIds.has(p.shop_id)) return false;
    if (productIds && productIds.size && !productIds.has(p.product_id)) return false;
    if (tokens.length) {
      const hay = normalizeFa(purchaseSearchText(p));
      for (const tk of tokens) {
        if (!hay.includes(tk)) return false;
      }
    }
    return true;
  });

  sortPurchases(result, filters.sort || 'recent');
  return result;
}

const RATING_RANK = { good: 3, bad: 2, shit: 1 };

function timeOf(p) {
  return new Date(p.purchased_at || p.created_at || 0).getTime() || 0;
}
function priceOf(p) {
  return Number(p.price) || 0;
}

export function sortPurchases(arr, sort) {
  switch (sort) {
    case 'recent':
      arr.sort((a, b) => timeOf(b) - timeOf(a)); break;
    case 'oldest':
      arr.sort((a, b) => timeOf(a) - timeOf(b)); break;
    case 'rating-desc':
      arr.sort((a, b) => (RATING_RANK[b.rating] || 0) - (RATING_RANK[a.rating] || 0) || timeOf(b) - timeOf(a)); break;
    case 'rating-asc':
      arr.sort((a, b) => (RATING_RANK[a.rating] || 0) - (RATING_RANK[b.rating] || 0) || timeOf(b) - timeOf(a)); break;
    case 'price-desc':
      arr.sort((a, b) => priceOf(b) - priceOf(a)); break;
    case 'price-asc':
      arr.sort((a, b) => priceOf(a) - priceOf(b)); break;
    case 'shop':
      arr.sort((a, b) => (a.shop?.name || '').localeCompare(b.shop?.name || '', 'fa')); break;
    case 'product':
      arr.sort((a, b) => (a.product?.name || '').localeCompare(b.product?.name || '', 'fa')); break;
    default:
      arr.sort((a, b) => timeOf(b) - timeOf(a));
  }
  return arr;
}

export function hasActiveFilters(filters) {
  if (filters.query) return true;
  if (filters.ratings.size) return true;
  if (filters.platformIds.size) return true;
  if (filters.shopIds.size) return true;
  if (filters.productIds.size) return true;
  return false;
}

export function buildShopStats(purchases, shopId) {
  const items = purchases.filter((p) => p.shop_id === shopId);
  const total = items.length;
  const good = items.filter((p) => p.rating === 'good').length;
  const bad = items.filter((p) => p.rating === 'bad').length;
  const shit = items.filter((p) => p.rating === 'shit').length;
  let spent = 0;
  for (const p of items) {
    if (p.price != null) spent += Number(p.price) * (Number(p.quantity) || 1);
  }
  const lastAt = items.reduce((acc, p) => {
    const t = timeOf(p);
    return t > acc ? t : acc;
  }, 0);
  const platforms = new Set(items.map((p) => p.platform_id).filter(Boolean));
  const products = new Set(items.map((p) => p.product_id));
  return { total, good, bad, shit, spent, lastAt, platforms: platforms.size, products: products.size, items };
}

export function buildProductStats(purchases, productId) {
  const items = purchases.filter((p) => p.product_id === productId);
  const total = items.length;
  const good = items.filter((p) => p.rating === 'good').length;
  const bad = items.filter((p) => p.rating === 'bad').length;
  const shit = items.filter((p) => p.rating === 'shit').length;
  let spent = 0;
  for (const p of items) {
    if (p.price != null) spent += Number(p.price) * (Number(p.quantity) || 1);
  }
  const lastAt = items.reduce((acc, p) => {
    const t = timeOf(p);
    return t > acc ? t : acc;
  }, 0);
  const shops = new Set(items.map((p) => p.shop_id));
  const platforms = new Set(items.map((p) => p.platform_id).filter(Boolean));
  return { total, good, bad, shit, spent, lastAt, shops: shops.size, platforms: platforms.size, items };
}
