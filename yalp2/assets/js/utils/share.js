/* ============================================================
   Share snapshot builder + helpers
   ============================================================ */
import { store } from '../state.js';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
export function generateSlug(n = 10) {
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

/** Build a denormalized, portable snapshot for a shop */
export function buildShopSnapshot(shopId, purchases) {
  const shop = store.shops.get().find((s) => s.id === shopId);
  if (!shop) throw new Error('فروشگاه یافت نشد');
  const items = purchases.filter((p) => p.shop_id === shopId);
  if (!items.length) throw new Error('این فروشگاه هنوز خریدی ندارد');

  const good = items.filter((p) => p.rating === 'good').length;
  const bad = items.filter((p) => p.rating === 'bad').length;
  const shit = items.filter((p) => p.rating === 'shit').length;

  let spent = 0;
  for (const p of items) {
    if (p.price != null) spent += Number(p.price) * (Number(p.quantity) || 1);
  }

  const recent = [...items]
    .sort((a, b) =>
      new Date(b.purchased_at || b.created_at).getTime() -
      new Date(a.purchased_at || a.created_at).getTime()
    )
    .slice(0, 10)
    .map((p) => ({
      product_name: p.product?.name || '',
      platform_name: p.platform?.name || '',
      platform_color: p.platform?.color || null,
      rating: p.rating,
      price: p.price,
      quantity: p.quantity,
      date: p.purchased_at || p.created_at,
    }));

  const prodMap = new Map();
  for (const p of items) {
    const name = p.product?.name || '';
    const cur = prodMap.get(name) || { name, count: 0, good: 0, shit: 0 };
    cur.count++;
    if (p.rating === 'good') cur.good++;
    if (p.rating === 'shit') cur.shit++;
    prodMap.set(name, cur);
  }
  const products = [...prodMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    type: 'shop',
    shop: {
      name: shop.name,
      category: shop.category || '',
      note: shop.note || '',
    },
    stats: { total: items.length, good, bad, shit, spent },
    recent,
    products,
    generated_at: new Date().toISOString(),
  };
}

/** Build a denormalized snapshot for a product */
export function buildProductSnapshot(productId, purchases) {
  const product = store.products.get().find((p) => p.id === productId);
  if (!product) throw new Error('محصول یافت نشد');
  const items = purchases.filter((p) => p.product_id === productId);
  if (!items.length) throw new Error('این محصول هنوز خریدی ندارد');

  const good = items.filter((p) => p.rating === 'good').length;
  const bad = items.filter((p) => p.rating === 'bad').length;
  const shit = items.filter((p) => p.rating === 'shit').length;

  let spent = 0;
  for (const p of items) {
    if (p.price != null) spent += Number(p.price) * (Number(p.quantity) || 1);
  }

  const shopMap = new Map();
  for (const p of items) {
    const key = p.shop_id;
    if (!shopMap.has(key)) {
      shopMap.set(key, {
        name: p.shop?.name || '',
        category: p.shop?.category || '',
        good: 0, bad: 0, shit: 0, count: 0,
        prices: [],
      });
    }
    const acc = shopMap.get(key);
    acc[p.rating] = (acc[p.rating] || 0) + 1;
    acc.count++;
    if (p.price != null) acc.prices.push(Number(p.price));
  }
  const shops = [...shopMap.values()]
    .map((x) => ({
      name: x.name,
      category: x.category,
      good: x.good,
      bad: x.bad,
      shit: x.shit,
      count: x.count,
      avg_price: x.prices.length ? Math.round(x.prices.reduce((a, b) => a + b, 0) / x.prices.length) : null,
    }))
    .sort((a, b) => (b.good - b.shit) - (a.good - a.shit) || b.count - a.count);

  return {
    type: 'product',
    product: {
      name: product.name,
      category: product.category || '',
      unit: product.unit || '',
      note: product.note || '',
    },
    stats: { total: items.length, good, bad, shit, spent },
    shops,
    generated_at: new Date().toISOString(),
  };
}

/** Build public URL for a slug (supports subfolders like /yalp2/) */
export function shareUrl(slug) {
  let base = window.location.origin + window.location.pathname;
  base = base.replace(/\/+$/, ''); // remove trailing slashes
  // Remove any hash or query
  base = base.split('?')[0].split('#')[0];
  // If pathname ends in .html, strip it
  base = base.replace(/\/[^\/]+\.html$/, '');
  return `${base}/?share=${slug}`;
}

/** Read slug from current URL if this is a share page */
export function readShareSlugFromUrl() {
  try {
    const u = new URL(window.location.href);
    const fromQuery = u.searchParams.get('share');
    if (fromQuery) return fromQuery;
    const m = u.pathname.match(/^\/s\/([a-z0-9]+)$/i);
    if (m) return m[1];
  } catch {}
  return null;
}
