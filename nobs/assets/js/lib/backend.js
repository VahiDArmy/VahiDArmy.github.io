/* ==========================================================================
   backend.js — پیکربندی Supabase، کلاینت، نام جدول‌ها و نوع خطاها
   پیشوند جدول‌ها: smrv_ (اختصاصی این اپ)
   ========================================================================== */

export const CONFIG = {
  url: 'https://ummhohozmpwltbgeczsf.supabase.co',
  key: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',
  sqlEditorUrl: 'https://supabase.com/dashboard/project/ummhohozmpwltbgeczsf/sql/new',
  schemaFile: 'supabase/schema.sql',
};

export const TABLES = {
  profiles: 'smrv_profiles',
  vendors: 'smrv_vendors',
  shops: 'smrv_shops',
  products: 'smrv_products',
  reviews: 'smrv_reviews',
  comments: 'smrv_comments',
  lists: 'smrv_lists',
  listItems: 'smrv_list_items',
  activity: 'smrv_activity',
};

export const STORAGE = {
  demoData: 'smrv:demo:v1',
  mode: 'smrv:mode',
  lastQuery: 'smrv:lastQuery',
  paletteHistory: 'smrv:paletteHistory',
};

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN', payload = null, cause = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.payload = payload;
    this.cause = cause;
  }
}

let client = null;

export function isConfigured() {
  return Boolean(CONFIG.url && CONFIG.key && !CONFIG.url.includes('YOUR-PROJECT'));
}

export function getClient() {
  if (client) return client;
  if (!isConfigured()) {
    throw new AppError('اطلاعات اتصال Supabase تنظیم نشده است.', 'NOT_CONFIGURED');
  }
  const sdk = globalThis.supabase;
  if (!sdk?.createClient) {
    throw new AppError('کتابخانه Supabase بارگذاری نشد.', 'SDK_MISSING');
  }
  client = sdk.createClient(CONFIG.url, CONFIG.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'smrv:auth',
    },
    global: {
      headers: { 'x-application-name': 'forooshgahy ar' },
    },
  });
  return client;
}

export function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    /relation .* does not exist/i.test(message) ||
    /Could not find the table/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export function isConflictError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return code === '23505' || /duplicate key|unique constraint/i.test(message);
}

export function isAuthError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '');
  return (
    code === 'PGRST301' ||
    code === '401' ||
    /JWT|token|not authenticated|permission denied|row-level security/i.test(message)
  );
}

export function toAppError(error) {
  if (error instanceof AppError) return error;
  if (!error) return new AppError('خطای نامشخص رخ داد.', 'UNKNOWN');
  const message = String(error.message || error.error_description || error);
  if (isMissingTableError(error)) {
    return new AppError(
      'جدول‌های این اپ در دیتابیس ساخته نشده‌اند. اسکریپت راه‌اندازی را اجرا کنید.',
      'SETUP_REQUIRED',
      null,
      error,
    );
  }
  if (isConflictError(error)) {
    return new AppError('این رکورد از قبل وجود دارد.', 'CONFLICT', null, error);
  }
  if (isAuthError(error)) {
    return new AppError('دسترسی شما منقضی شده است. دوباره وارد شوید.', 'AUTH', null, error);
  }
  return new AppError(message || 'مشکلی پیش آمد.', 'UNKNOWN', null, error);
}

/** فراخوانی امن کوئری Supabase با تبدیل خطا */
export async function run(query, fallbackMessage = 'عملیات با خطا مواجه شد.') {
  const { data, error } = await query;
  if (error) {
    const appError = toAppError(error);
    if (appError.code === 'UNKNOWN') appError.message = fallbackMessage;
    throw appError;
  }
  return data;
}
