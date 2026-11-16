/* ============================================================
   Seed demo data — a few shops/products/purchases for testing
   ============================================================ */
import { createShop, createProduct, createPurchase, listShops, listProducts } from '../api.js';
import { store } from '../state.js';

const DEMO_SHOPS = [
  { name: 'ساندویچی علی', category: 'فست‌فود' },
  { name: 'کافه رستوران باغ', category: 'رستوران' },
  { name: 'پروتئین مارکت', category: 'گوشت و پروتئین' },
  { name: 'میوه‌سرای بهار', category: 'میوه و سبزیجات' },
  { name: 'نانوایی سنگک سنتی', category: 'نان' },
  { name: 'سوپرمارکت رفاه', category: 'سوپرمارکت' },
  { name: 'فست‌فود آتش', category: 'فست‌فود' },
];

const DEMO_PRODUCTS = [
  { name: 'ساندویچ مرغ', category: 'غذا', unit: 'عدد' },
  { name: 'پیتزا پپرونی', category: 'غذا', unit: 'عدد' },
  { name: 'کباب کوبیده', category: 'غذا', unit: 'پرس' },
  { name: 'سیب‌زمینی', category: 'سبزیجات', unit: 'کیلو' },
  { name: 'گوجه‌فرنگی', category: 'سبزیجات', unit: 'کیلو' },
  { name: 'نان سنگک', category: 'نان', unit: 'عدد' },
  { name: 'شیر پرچرب', category: 'لبنیات', unit: 'لیتر' },
  { name: 'تخم‌مرغ', category: 'پروتئین', unit: 'شانه' },
  { name: 'برنج ایرانی', category: 'غذایی', unit: 'کیلو' },
  { name: 'روغن زیتون', category: 'غذایی', unit: 'لیتر' },
];

const PLATFORM_NAMES = ['اسنپ‌فود', 'دیجی‌کالا', 'اکالا', 'باسلام'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function weightedRating() {
  const r = Math.random();
  if (r < 0.5) return 'good';
  if (r < 0.8) return 'bad';
  return 'shit';
}
function randomDateWithinMonths(months) {
  const now = Date.now();
  const then = now - months * 30 * 24 * 3600 * 1000;
  const t = then + Math.random() * (now - then);
  return new Date(t).toISOString().slice(0, 10);
}

async function ensureShops() {
  const existing = await listShops();
  const byName = new Map(existing.map((s) => [s.name, s]));
  const result = [];
  for (const def of DEMO_SHOPS) {
    if (byName.has(def.name)) {
      result.push(byName.get(def.name));
    } else {
      const created = await createShop(def);
      result.push(created);
    }
  }
  return result;
}

async function ensureProducts() {
  const existing = await listProducts();
  const byName = new Map(existing.map((p) => [p.name, p]));
  const result = [];
  for (const def of DEMO_PRODUCTS) {
    if (byName.has(def.name)) {
      result.push(byName.get(def.name));
    } else {
      const created = await createProduct(def);
      result.push(created);
    }
  }
  return result;
}

export async function seedDemoData({ purchaseCount = 25 } = {}) {
  const shops = await ensureShops();
  const products = await ensureProducts();
  const platforms = store.platforms.get();

  store.shops.set([...shops]);
  store.products.set([...products]);

  const platformPool = platforms.filter((p) => PLATFORM_NAMES.includes(p.name));
  const usablePlatforms = platformPool.length ? platformPool : platforms;

  const purchases = [];
  for (let i = 0; i < purchaseCount; i++) {
    const shop = pick(shops);
    const product = pick(products);
    const platform = Math.random() < 0.85 && usablePlatforms.length ? pick(usablePlatforms) : null;
    const rating = weightedRating();
    const price = randInt(3, 30) * 10000;
    const quantity = Math.random() < 0.8 ? 1 : randInt(2, 4);
    const purchased_at = randomDateWithinMonths(6);
    purchases.push({
      shop_id: shop.id,
      product_id: product.id,
      platform_id: platform?.id ?? null,
      rating,
      price,
      quantity,
      purchased_at,
      note: '',
    });
  }

  const created = [];
  for (const p of purchases) {
    const row = await createPurchase(p);
    created.push(row);
  }

  return { shops: shops.length, products: products.length, purchases: created.length };
}
