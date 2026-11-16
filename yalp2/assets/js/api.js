/* ============================================================
   API — all Supabase access lives here
   All operations are RLS-scoped to the current user
   ============================================================ */
import { sb, Tables } from './supabase.js';
import { store } from './state.js';
import { CONFIG } from './config.js';
import { normalizeFa } from './utils.js';

const t = CONFIG.tables;

/* ---------- generic helpers ---------- */

function friendlyError(err, fallback = 'خطایی رخ داد') {
  if (!err) return fallback;
  const msg = String(err.message || err.error_description || err.error || '');
  if (/duplicate key/i.test(msg)) return 'مورد تکراری است';
  if (/violates foreign key/i.test(msg)) return 'مورد وابسته یافت نشد';
  if (/JWT expired/i.test(msg)) return 'نشست منقضی شده؛ دوباره وارد شوید';
  if (/Invalid login credentials/i.test(msg)) return 'ایمیل یا رمز عبور اشتباه است';
  if (/User already registered/i.test(msg)) return 'این ایمیل قبلاً ثبت شده است';
  if (/Email not confirmed/i.test(msg)) return 'ایمیل تأیید نشده است';
  if (/Password should be at least/i.test(msg)) return 'رمز عبور کوتاه است';
  if (/rate limit/i.test(msg)) return 'تعداد تلاش زیاد؛ کمی بعد امتحان کنید';
  return msg || fallback;
}

function wrap(promise, fallback) {
  return promise.then(({ data, error }) => {
    if (error) throw new Error(friendlyError(error, fallback));
    return data;
  });
}

/* ---------- PLATFORMS ---------- */

export async function listPlatforms() {
  return wrap(
    sb.from(t.platforms).select('*').order('created_at', { ascending: true }),
    'خطا در دریافت پلتفرم‌ها'
  );
}

export async function createPlatform({ name, color, icon, note }) {
  const payload = {
    name: String(name || '').trim(),
    color: color || '#6366f1',
    icon: icon || '',
    note: note || '',
  };
  if (!payload.name) throw new Error('نام پلتفرم الزامی است');
  return wrap(
    sb.from(t.platforms).insert(payload).select().single(),
    'خطا در ساخت پلتفرم'
  );
}

export async function updatePlatform(id, patch) {
  return wrap(
    sb.from(t.platforms).update(patch).eq('id', id).select().single(),
    'خطا در ویرایش پلتفرم'
  );
}

export async function deletePlatform(id) {
  return wrap(
    sb.from(t.platforms).delete().eq('id', id),
    'خطا در حذف پلتفرم'
  );
}

/* ---------- SHOPS ---------- */

export async function listShops() {
  return wrap(
    sb.from(t.shops).select('*').order('name', { ascending: true }),
    'خطا در دریافت فروشگاه‌ها'
  );
}

export async function createShop({ name, category, note }) {
  const payload = {
    name: String(name || '').trim(),
    category: (category || '').trim(),
    note: note || '',
  };
  if (!payload.name) throw new Error('نام فروشگاه الزامی است');
  return wrap(
    sb.from(t.shops).insert(payload).select().single(),
    'خطا در ساخت فروشگاه'
  );
}

export async function updateShop(id, patch) {
  return wrap(
    sb.from(t.shops).update(patch).eq('id', id).select().single(),
    'خطا در ویرایش فروشگاه'
  );
}

export async function deleteShop(id) {
  return wrap(
    sb.from(t.shops).delete().eq('id', id),
    'خطا در حذف فروشگاه'
  );
}

/* ---------- PRODUCTS ---------- */

export async function listProducts() {
  return wrap(
    sb.from(t.products).select('*').order('name', { ascending: true }),
    'خطا در دریافت محصولات'
  );
}

export async function createProduct({ name, category, unit, note }) {
  const payload = {
    name: String(name || '').trim(),
    category: (category || '').trim(),
    unit: (unit || '').trim(),
    note: note || '',
  };
  if (!payload.name) throw new Error('نام محصول الزامی است');
  return wrap(
    sb.from(t.products).insert(payload).select().single(),
    'خطا در ساخت محصول'
  );
}

export async function updateProduct(id, patch) {
  return wrap(
    sb.from(t.products).update(patch).eq('id', id).select().single(),
    'خطا در ویرایش محصول'
  );
}

export async function deleteProduct(id) {
  return wrap(
    sb.from(t.products).delete().eq('id', id),
    'خطا در حذف محصول'
  );
}

/* ---------- PURCHASES ---------- */

const PURCHASE_SELECT = `
  *,
  shop:sm_shops(id,name,category),
  product:sm_products(id,name,category,unit),
  platform:sm_platforms(id,name,color,icon)
`;

export async function listPurchases() {
  return wrap(
    sb.from(t.purchases)
      .select(PURCHASE_SELECT)
      .order('purchased_at', { ascending: false })
      .order('created_at', { ascending: false }),
    'خطا در دریافت خریدها'
  );
}

export async function createPurchase(input) {
  const payload = {
    shop_id: input.shop_id,
    product_id: input.product_id,
    platform_id: input.platform_id || null,
    rating: input.rating,
    price: input.price === '' || input.price == null ? null : Number(input.price),
    quantity: input.quantity === '' || input.quantity == null ? 1 : Number(input.quantity),
    purchased_at: input.purchased_at || new Date().toISOString().slice(0, 10),
    note: input.note || '',
  };
  if (!payload.shop_id) throw new Error('انتخاب فروشگاه الزامی است');
  if (!payload.product_id) throw new Error('انتخاب محصول الزامی است');
  if (!['good', 'bad', 'shit'].includes(payload.rating)) throw new Error('امتیاز نامعتبر است');
  return wrap(
    sb.from(t.purchases).insert(payload).select(PURCHASE_SELECT).single(),
    'خطا در ثبت خرید'
  );
}

export async function updatePurchase(id, patch) {
  return wrap(
    sb.from(t.purchases).update(patch).eq('id', id).select(PURCHASE_SELECT).single(),
    'خطا در ویرایش خرید'
  );
}

export async function deletePurchase(id) {
  return wrap(
    sb.from(t.purchases).delete().eq('id', id),
    'خطا در حذف خرید'
  );
}

/* ---------- COMMENTS ---------- */

export async function listComments() {
  return wrap(
    sb.from(t.comments).select('*').order('created_at', { ascending: false }),
    'خطا در دریافت یادداشت‌ها'
  );
}

export async function createComment({ target_type, target_id, content }) {
  if (!['shop', 'product', 'platform', 'purchase'].includes(target_type)) {
    throw new Error('نوع هدف نامعتبر است');
  }
  const payload = {
    target_type,
    target_id,
    content: String(content || '').trim(),
  };
  if (!payload.content) throw new Error('متن یادداشت خالی است');
  return wrap(
    sb.from(t.comments).insert(payload).select().single(),
    'خطا در ثبت یادداشت'
  );
}

export async function deleteComment(id) {
  return wrap(
    sb.from(t.comments).delete().eq('id', id),
    'خطا در حذف یادداشت'
  );
}

/* ---------- SEED ---------- */

async function seedPlatformsIfEmpty(existing) {
  if (existing.length > 0) return existing;
  const seeds = CONFIG.seedPlatforms.map((p) => ({
    name: p.name,
    color: p.color,
    icon: p.icon,
    note: '',
  }));
  const data = await wrap(
    sb.from(t.platforms).insert(seeds).select(),
    'خطا در مقدار‌گذاری اولیه'
  );
  return data || [];
}

/* ---------- AGGREGATE LOAD ---------- */

export async function loadAllData() {
  const [platforms0, shops, products, purchases, comments] = await Promise.all([
    listPlatforms(),
    listShops(),
    listProducts(),
    listPurchases(),
    listComments(),
  ]);
  const platforms = await seedPlatformsIfEmpty(platforms0);

  store.platforms.set(platforms);
  store.shops.set(shops);
  store.products.set(products);
  store.purchases.set(purchases);
  store.comments.set(comments);

  return { platforms, shops, products, purchases, comments };
}

/** After a purchase create/update, refresh just that slice */
export async function refreshPurchases() {
  const purchases = await listPurchases();
  store.purchases.set(purchases);
  return purchases;
}

/* ---------- AUTH ---------- */

export async function signInWithPassword(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyError(error, 'ورود ناموفق بود'));
  return data;
}

export async function signUpWithPassword(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(friendlyError(error, 'ثبت‌نام ناموفق بود'));
  return data;
}

export async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw new Error(friendlyError(error, 'خروج ناموفق بود'));
}

/* ---------- HELPERS FOR FILTERING (client-side) ---------- */

/** Build search index text for a purchase row */
export function purchaseSearchText(p) {
  return [
    p.shop?.name || '',
    p.product?.name || '',
    p.platform?.name || '',
    p.note || '',
    p.shop?.category || '',
    p.product?.category || '',
  ].join(' ');
}

/** Compute stats from purchases */
export function purchaseStats(purchases) {
  let good = 0, bad = 0, shit = 0, totalSpent = 0, shops = new Set(), products = new Set();
  for (const p of purchases) {
    if (p.rating === 'good') good++;
    else if (p.rating === 'bad') bad++;
    else if (p.rating === 'shit') shit++;
    if (p.price != null) totalSpent += Number(p.price) * (Number(p.quantity) || 1);
    if (p.shop_id) shops.add(p.shop_id);
    if (p.product_id) products.add(p.product_id);
  }
  return { good, bad, shit, total: purchases.length, totalSpent, shops: shops.size, products: products.size };
}

/** Normalized search across all tokens */
export function matchesQuery(p, tokens) {
  if (!tokens.length) return true;
  const hay = normalizeFa(purchaseSearchText(p));
  return tokens.every((tk) => hay.includes(tk));
}
