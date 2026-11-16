/* ============================================================
   Import / Export — JSON snapshot of all user data
   ============================================================ */
import { sb, Tables } from '../supabase.js';
import { store } from '../state.js';
import { CONFIG } from '../config.js';

const VERSION = 1;

function stripMeta(rec) {
  const { user_id, created_at, updated_at, ...rest } = rec;
  return rest;
}

function stripJoins(p) {
  const { shop, product, platform, user_id, created_at, updated_at, ...rest } = p;
  return rest;
}

export function buildSnapshot() {
  return {
    version: VERSION,
    exported_at: new Date().toISOString(),
    app: CONFIG.appName,
    platforms: store.platforms.get().map(stripMeta),
    shops: store.shops.get().map(stripMeta),
    products: store.products.get().map(stripMeta),
    purchases: store.purchases.get().map(stripJoins),
    comments: store.comments.get().map(stripMeta),
  };
}

export function downloadSnapshot() {
  const data = buildSnapshot();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `supermarket-yar-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return data;
}

function validate(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('فایل معتبر نیست');
  }
  const keys = ['platforms', 'shops', 'products', 'purchases'];
  const has = keys.some((k) => Array.isArray(snapshot[k]));
  if (!has) throw new Error('ساختار فایل معتبر نیست');
  if (snapshot.version && snapshot.version > VERSION) {
    throw new Error('نسخهٔ فایل از این نسخهٔ سایت جدیدتر است');
  }
  return {
    platforms: Array.isArray(snapshot.platforms) ? snapshot.platforms : [],
    shops: Array.isArray(snapshot.shops) ? snapshot.shops : [],
    products: Array.isArray(snapshot.products) ? snapshot.products : [],
    purchases: Array.isArray(snapshot.purchases) ? snapshot.purchases : [],
    comments: Array.isArray(snapshot.comments) ? snapshot.comments : [],
  };
}

/**
 * Import snapshot — REPLACES all existing data.
 * Warning: comments are imported without remapping (may be orphaned).
 */
export async function importSnapshot(snapshot) {
  const data = validate(snapshot);
  const user = store.user.get();
  if (!user?.id) throw new Error('کاربر یافت نشد');

  // 1) wipe existing data (order matters for FK: purchases → comments → products → shops → platforms)
  await sb.from(Tables.purchases).delete().eq('user_id', user.id);
  await sb.from(Tables.comments).delete().eq('user_id', user.id);
  await sb.from(Tables.products).delete().eq('user_id', user.id);
  await sb.from(Tables.shops).delete().eq('user_id', user.id);
  await sb.from(Tables.platforms).delete().eq('user_id', user.id);

  const platformMap = new Map();
  const shopMap = new Map();
  const productMap = new Map();
  const createdPlatforms = [];
  const createdShops = [];
  const createdProducts = [];

  // 2) platforms
  for (const p of data.platforms) {
    const row = {
      name: String(p.name || '').trim(),
      color: /^#[0-9a-fA-F]{6}$/.test(p.color || '') ? p.color : '#6366f1',
      icon: String(p.icon || '').slice(0, 40),
      note: String(p.note || '').slice(0, 500),
    };
    if (!row.name) continue;
    const { data: ins, error } = await sb.from(Tables.platforms).insert(row).select().single();
    if (error) throw new Error(`پلتفرم «${row.name}»: ${error.message}`);
    platformMap.set(p.id, ins.id);
    createdPlatforms.push(ins);
  }

  // 3) shops
  for (const s of data.shops) {
    const row = {
      name: String(s.name || '').trim().slice(0, 100),
      category: String(s.category || '').slice(0, 60),
      note: String(s.note || '').slice(0, 1000),
    };
    if (!row.name) continue;
    const { data: ins, error } = await sb.from(Tables.shops).insert(row).select().single();
    if (error) throw new Error(`فروشگاه «${row.name}»: ${error.message}`);
    shopMap.set(s.id, ins.id);
    createdShops.push(ins);
  }

  // 4) products
  for (const p of data.products) {
    const row = {
      name: String(p.name || '').trim().slice(0, 120),
      category: String(p.category || '').slice(0, 60),
      unit: String(p.unit || '').slice(0, 30),
      note: String(p.note || '').slice(0, 1000),
    };
    if (!row.name) continue;
    const { data: ins, error } = await sb.from(Tables.products).insert(row).select().single();
    if (error) throw new Error(`محصول «${row.name}»: ${error.message}`);
    productMap.set(p.id, ins.id);
    createdProducts.push(ins);
  }

  // 5) purchases with remapped FKs
  const purchaseRows = [];
  for (const p of data.purchases) {
    const shop_id = shopMap.get(p.shop_id);
    const product_id = productMap.get(p.product_id);
    const platform_id = p.platform_id ? platformMap.get(p.platform_id) || null : null;
    if (!shop_id || !product_id) continue;
    purchaseRows.push({
      shop_id,
      product_id,
      platform_id,
      rating: ['good', 'bad', 'shit'].includes(p.rating) ? p.rating : 'good',
      price: p.price == null ? null : Number(p.price),
      quantity: p.quantity == null ? 1 : Number(p.quantity),
      purchased_at: p.purchased_at || new Date().toISOString().slice(0, 10),
      note: String(p.note || '').slice(0, 2000),
    });
  }
  if (purchaseRows.length) {
    // chunk to avoid very large single insert
    const chunkSize = 100;
    for (let i = 0; i < purchaseRows.length; i += chunkSize) {
      const chunk = purchaseRows.slice(i, i + chunkSize);
      const { error } = await sb.from(Tables.purchases).insert(chunk);
      if (error) throw new Error('خریدها: ' + error.message);
    }
  }

  return {
    platforms: createdPlatforms.length,
    shops: createdShops.length,
    products: createdProducts.length,
    purchases: purchaseRows.length,
  };
}

export async function readJsonFile(file) {
  if (!file) throw new Error('فایلی انتخاب نشد');
  if (file.size > 8 * 1024 * 1024) throw new Error('فایل بیش از حد بزرگ است (سقف ۸ مگابایت)');
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('محتوای فایل JSON معتبر نیست');
  }
}
