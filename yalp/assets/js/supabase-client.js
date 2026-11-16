/**
 * بازاربان — لایهٔ اتصال به Supabase
 * ---------------------------------------------------------------------------
 * کلاینت به‌صورت تنبل (lazy) و از طریق import map بارگذاری می‌شود تا اگر
 * شبکه در دسترس نبود، برنامه بتواند با دادهٔ نمایشی محلی کار کند.
 *
 * از `auth.persistSession` استفاده می‌کنیم؛ نشست در همان مرورگر می‌ماند.
 * هیچ کلید سطح‌بالا (service_role) در این فایل وجود ندارد و نباید اضافه شود.
 */

import { CONFIG, supabaseConfigured } from './config.js';

let client = null;
let loading = null;
let lastError = null;

/** دریافت کلاینت Supabase (تنها یک‌بار ساخته می‌شود) */
export async function getSupabase() {
  if (client) return client;
  if (!supabaseConfigured()) {
    throw new Error('آدرس یا کلید Supabase تنظیم نشده است.');
  }
  if (!loading) {
    loading = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
            storageKey: 'bb-auth-session',
          },
          global: {
            headers: { 'x-application-name': CONFIG.APP_NAME_EN },
          },
        });
        return client;
      })
      .catch((error) => {
        loading = null;
        lastError = error;
        throw error;
      });
  }
  return loading;
}

export function hasClient() {
  return Boolean(client);
}

export function getLastError() {
  return lastError;
}

/**
 * بررسی دسترسی به جدول‌های بازاربان. اگر جدول‌ها ساخته نشده باشند یا شبکه
 * در دسترس نباشد، برنامه به حالت نمایشی می‌رود (بدون خطای مرگبار).
 */
export async function probeBackend() {
  const started = performance.now();

  // اگر شبکه یا CDN پاسخ ندهد، برنامه نباید پشت اسکلت بارگذاری گیر کند.
  let timer = null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(
      () => resolve({ ok: false, reason: 'timeout', message: 'زمان اتصال به Supabase تمام شد.' }),
      7000,
    );
  });

  const probe = (async () => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase
        .from(CONFIG.TABLES.vendors)
        .select('id', { head: true, count: 'exact' })
        .limit(1);
      if (error) {
        return {
          ok: false,
          reason: 'schema',
          code: error.code || 'unknown',
          message: error.message || 'جدول‌های بازاربان در دسترس نیستند.',
        };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: 'network',
        message: error?.message || 'اتصال به Supabase برقرار نشد.',
      };
    }
  })();

  const result = await Promise.race([probe, timeout]);
  if (timer) clearTimeout(timer);
  return { ...result, ms: Math.round(performance.now() - started) };
}

/* --------------------------------------------------------------------------
   احراز هویت
   -------------------------------------------------------------------------- */
export async function getSession() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function getUser() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user || null;
}

/** ثبت شنوندهٔ تغییر وضعیت ورود. برمی‌گرداند: تابع لغو اشتراک */
export async function onAuthStateChange(callback) {
  const supabase = await getSupabase();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email, password) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, meta = {}) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: meta.displayName || email.split('@')[0],
        city: meta.city || '',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithMagicLink(email) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}${window.location.pathname}#/me`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutRemote() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateRemotePassword(password) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   خطاهای آشنا به فارسی
   -------------------------------------------------------------------------- */
const AUTH_ERRORS = [
  [/invalid login credentials/i, 'ایمیل یا رمز عبور درست نیست.'],
  [/email not confirmed/i, 'ایمیلت هنوز تأیید نشده؛ لینک تأیید را در صندوق ورودی بررسی کن.'],
  [/user already registered/i, 'با این ایمیل قبلاً حساب ساخته شده است. وارد شو.'],
  [/password should be at least/i, 'رمز عبور باید حداقل ۶ کاراکتر باشد.'],
  [/weak password/i, 'رمز عبور ضعیف است؛ ترکیب قوی‌تری انتخاب کن.'],
  [/rate limit|too many requests/i, 'درخواست‌های زیادی فرستاده شد؛ کمی بعد دوباره تلاش کن.'],
  [/invalid email/i, 'قالب ایمیل درست نیست.'],
  [/signup is disabled/i, 'ثبت‌نام در این پروژه غیرفعال است.'],
  [/email logins are disabled/i, 'ورود با ایمیل در این پروژه غیرفعال است.'],
  [/failed to fetch|networkerror|network request failed/i, 'ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کن.'],
  [/jwt expired/i, 'نشست منقضی شده است؛ دوباره وارد شو.'],
  [/relation .* does not exist|Could not find the table/i, 'جدول‌های بازاربان ساخته نشده‌اند؛ فایل SQL را در Supabase اجرا کن.'],
  [/row-level security|permission denied/i, 'دسترسی مجاز نیست؛ سیاست‌های RLS را بررسی کن.'],
  [/duplicate key value/i, 'این مورد قبلاً ثبت شده است.'],
];

export function friendlyError(error, fallback = 'مشکلی پیش آمد. دوباره تلاش کن.') {
  if (!error) return fallback;
  const message = String(error.message || error.error_description || error || '');
  for (const [pattern, replacement] of AUTH_ERRORS) {
    if (pattern.test(message)) return replacement;
  }
  if (error.code === '42501') return 'دسترسی مجاز نیست؛ سیاست‌های RLS را بررسی کن.';
  if (error.code === '23505') return 'این مورد قبلاً ثبت شده است.';
  if (error.code === '23514') return 'مقدار ورودی با محدودیت‌های جدول سازگار نیست.';
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'جدول‌های بازاربان در Supabase ساخته نشده‌اند.';
  }
  return message || fallback;
}

/* --------------------------------------------------------------------------
   نگاشت ردیف‌های دیتابیس به مدل برنامه
   -------------------------------------------------------------------------- */
export const rowToVendor = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  nameFa: row.name_fa || row.name,
  kind: row.kind || 'platform',
  tagline: row.tagline || '',
  description: row.description || '',
  website: row.website || '',
  city: row.city || '',
  supportPhone: row.support_phone || '',
  brandHue: row.brand_hue ?? 152,
  isVerified: Boolean(row.is_verified),
  createdBy: row.created_by || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: 'live',
});

export const vendorToRow = (vendor) => ({
  slug: vendor.slug,
  name: vendor.name,
  name_fa: vendor.nameFa,
  kind: vendor.kind,
  tagline: vendor.tagline || '',
  description: vendor.description || '',
  website: vendor.website || '',
  city: vendor.city || '',
  support_phone: vendor.supportPhone || '',
  brand_hue: vendor.brandHue ?? 152,
});

export const rowToShop = (row) => ({
  id: row.id,
  vendorId: row.vendor_id,
  name: row.name,
  city: row.city || '',
  district: row.district || '',
  address: row.address || '',
  phone: row.phone || '',
  pickup: row.pickup !== false,
  delivery: row.delivery !== false,
  hours: row.hours || '',
  lat: row.lat ?? null,
  lng: row.lng ?? null,
  createdBy: row.created_by || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: 'live',
});

export const shopToRow = (shop) => ({
  vendor_id: shop.vendorId,
  name: shop.name,
  city: shop.city || '',
  district: shop.district || '',
  address: shop.address || '',
  phone: shop.phone || '',
  pickup: shop.pickup !== false,
  delivery: shop.delivery !== false,
  hours: shop.hours || '',
  lat: shop.lat ?? null,
  lng: shop.lng ?? null,
});

export const rowToProduct = (row) => ({
  id: row.id,
  vendorId: row.vendor_id,
  shopId: row.shop_id || null,
  name: row.name,
  brand: row.brand || '',
  category: row.category || 'other',
  unit: row.unit || 'عدد',
  price: row.price ?? null,
  barcode: row.barcode || '',
  tags: Array.isArray(row.tags) ? row.tags : [],
  isAvailable: row.is_available !== false,
  createdBy: row.created_by || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: 'live',
});

export const productToRow = (product) => ({
  vendor_id: product.vendorId,
  shop_id: product.shopId || null,
  name: product.name,
  brand: product.brand || '',
  category: product.category || 'other',
  unit: product.unit || 'عدد',
  price: product.price ?? null,
  barcode: product.barcode || '',
  tags: product.tags || [],
  is_available: product.isAvailable !== false,
});

export const rowToComment = (row) => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  userId: row.user_id || null,
  guestName: row.guest_name || 'مهمان',
  body: row.body,
  level: row.level || null,
  tags: Array.isArray(row.tags) ? row.tags : [],
  status: row.status || 'published',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: 'live',
});

export const commentToRow = (comment) => ({
  entity_type: comment.entityType,
  entity_id: comment.entityId,
  guest_name: comment.guestName || 'کاربر بازاربان',
  body: comment.body,
  level: comment.level || null,
  tags: comment.tags || [],
});

export const rowToRating = (row) => ({
  id: row.id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  userId: row.user_id,
  value: row.value,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: 'live',
});

export const rowToVote = (row) => ({
  id: row.id,
  commentId: row.comment_id,
  userId: row.user_id,
  value: row.value ?? 1,
  createdAt: row.created_at,
});

export const rowToList = (row) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  emoji: row.emoji || '🛒',
  isPublic: Boolean(row.is_public),
  createdAt: row.created_at,
});

export const rowToListItem = (row) => ({
  id: row.id,
  listId: row.list_id,
  entityType: row.entity_type,
  entityId: row.entity_id,
  note: row.note || '',
  createdAt: row.created_at,
});

export const rowToActivity = (row) => ({
  id: row.id,
  userId: row.user_id,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  detail: row.detail || '',
  createdAt: row.created_at,
});

export const rowToProfile = (row) => ({
  userId: row.user_id,
  displayName: row.display_name || 'کاربر بازاربان',
  city: row.city || '',
  bio: row.bio || '',
  avatarHue: row.avatar_hue ?? 152,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const profileToRow = (profile) => ({
  user_id: profile.userId,
  display_name: profile.displayName,
  city: profile.city || '',
  bio: profile.bio || '',
  avatar_hue: profile.avatarHue ?? 152,
});
