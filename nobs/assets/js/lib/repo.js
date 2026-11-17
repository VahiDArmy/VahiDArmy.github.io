/* ==========================================================================
   repo.js — لایه داده: حالت نمایشی (localStorage) یا Supabase
   تمام نوشتن‌ها از اینجا عبور می‌کنند تا UI ساده بماند.
   ========================================================================== */

import {
  AppError,
  TABLES,
  STORAGE,
  getClient,
  isConfigured,
  toAppError,
  isMissingTableError,
  isConflictError,
} from './backend.js';
import { getState, setState, patchData, resetState } from './store.js';
import { createDemoData, emptyData } from '../data/demo.js';
import { findCombo, RATING_KEYS, hydrateReview, buildIndex } from './domain.js';
import { normFa, todayISO, uid } from './utils.js';

const DEMO_USER_ID = '00000000-0000-4000-8000-d00000000001';

let bootstrapPromise = null;

/* ------------------------------- ابزار پایه ------------------------------- */

function sb() {
  return getClient();
}

function currentUser() {
  const user = getState().user;
  if (!user) throw new AppError('برای این کار باید وارد شوید.', 'AUTH');
  return user;
}

function requireDemo() {
  if (getState().mode !== 'demo') throw new AppError('این عملیات فقط در حالت نمایشی است.', 'MODE');
}

function nowISO() {
  return new Date().toISOString();
}

function ensureUuid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function trim(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => trim(tag, 30).replace(/^#/, ''))
        .filter(Boolean),
    ),
  ).slice(0, 12);
}

function assertName(name, label, max = 100) {
  const value = trim(name, max);
  if (!value) throw new AppError(`${label} را وارد کنید.`, 'VALIDATION', { field: 'name' });
  if (value.length < 2) throw new AppError(`${label} باید حداقل ۲ حرف باشد.`, 'VALIDATION', { field: 'name' });
  return value;
}

function assertNoDuplicate(list, name, excludeId, label) {
  const target = normFa(name);
  const duplicate = (list || []).find((row) => row.id !== excludeId && normFa(row.name) === target);
  if (duplicate) {
    throw new AppError(`${label} با همین نام از قبل وجود دارد.`, 'DUPLICATE_NAME', { existing: duplicate });
  }
}

/* ------------------------------ حالت نمایشی ------------------------------- */

function loadDemoData() {
  try {
    const raw = localStorage.getItem(STORAGE.demoData);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.reviews)) return parsed;
    }
  } catch {
    /* ignore corrupted storage */
  }
  const fresh = createDemoData(DEMO_USER_ID);
  saveDemoData(fresh);
  return fresh;
}

function saveDemoData(data) {
  try {
    localStorage.setItem(STORAGE.demoData, JSON.stringify(data));
  } catch {
    /* quota errors are non fatal */
  }
}

function demoMutate(mutator) {
  const data = { ...getState().data };
  const draft = {
    reviews: [...data.reviews],
    products: [...data.products],
    shops: [...data.shops],
    vendors: [...data.vendors],
    comments: [...data.comments],
    lists: [...data.lists],
    listItems: [...data.listItems],
    profile: data.profile,
  };
  const result = mutator(draft);
  saveDemoData(draft);
  patchData(draft);
  return result;
}

export function enterDemo({ reset = false } = {}) {
  if (reset) {
    const fresh = createDemoData(DEMO_USER_ID);
    saveDemoData(fresh);
    patchData(fresh);
  } else {
    patchData(loadDemoData());
  }
  localStorage.setItem(STORAGE.mode, 'demo');
  setState({
    phase: 'ready',
    mode: 'demo',
    user: { id: DEMO_USER_ID, email: 'demo@forooshgahyar.app', is_demo: true },
    tablesReady: true,
    error: null,
  });
  return { mode: 'demo' };
}

export function exitDemo() {
  localStorage.removeItem(STORAGE.mode);
  setState({ mode: 'supabase', user: null, phase: 'ready' });
  patchData(emptyData());
}

export function resetDemo() {
  requireDemo();
  return enterDemo({ reset: true });
}

/* ------------------------------- راه‌اندازی ------------------------------- */

export async function bootstrap() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    if (!isConfigured() || !globalThis.supabase) {
      return enterDemo();
    }

    let sessionRef = null;
    try {
      const { getSession } = await import('./auth.js');
      sessionRef = await getSession();
    } catch (error) {
      setState({ phase: 'ready', error: toAppError(error).message });
      return { mode: 'supabase', error: toAppError(error) };
    }

    if (!sessionRef?.user) {
      if (localStorage.getItem(STORAGE.mode) === 'demo') return enterDemo();
      setState({
        phase: 'ready',
        mode: 'supabase',
        user: null,
        tablesReady: true,
        data: emptyData(),
      });
      return { mode: 'supabase', needsAuth: true };
    }

    setState({ user: sessionRef.user, mode: 'supabase', phase: 'ready' });
    try {
      const result = await reload();
      return { mode: 'supabase', user: sessionRef.user, needsSetup: !result.tablesReady };
    } catch (error) {
      const appError = toAppError(error);
      return {
        mode: 'supabase',
        user: sessionRef.user,
        needsSetup: appError.code === 'SETUP_REQUIRED',
        error: appError,
      };
    }
  })();

  return bootstrapPromise;
}

export function refreshBootstrap() {
  bootstrapPromise = null;
  return bootstrap();
}

/* --------------------------------- خواندن -------------------------------- */

async function fetchRows(table, { order = 'created_at', ascending = false } = {}) {
  const { data, error } = await sb().from(table).select('*').order(order, { ascending });
  if (error) throw toAppError(error);
  return data || [];
}

export async function reload() {
  const user = currentUser();
  if (getState().mode === 'demo') {
    patchData(loadDemoData());
    return { tablesReady: true };
  }

  try {
    const [reviews, products, shops, vendors, comments, lists, listItems] = await Promise.all([
      fetchRows(TABLES.reviews, { order: 'purchased_at', ascending: false }),
      fetchRows(TABLES.products),
      fetchRows(TABLES.shops),
      fetchRows(TABLES.vendors, { order: 'sort_order', ascending: true }),
      fetchRows(TABLES.comments),
      fetchRows(TABLES.lists),
      fetchRows(TABLES.listItems),
    ]);

    let profile = null;
    const { data: profileRow, error: profileError } = await sb()
      .from(TABLES.profiles)
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError && !isMissingTableError(profileError)) throw toAppError(profileError);
    if (profileError && isMissingTableError(profileError)) throw toAppError(profileError);

    profile = profileRow;

    if (!profile) {
      try {
        const { data: created } = await sb()
          .from(TABLES.profiles)
          .upsert({ user_id: user.id, display_name: user.email?.split('@')[0] || '' }, { onConflict: 'user_id' })
          .select()
          .single();
        profile = created || null;
      } catch {
        profile = { user_id: user.id, display_name: user.email?.split('@')[0] || '', currency: 'IRT', avatar_hue: 158 };
      }
    }

    setState({ tablesReady: true, error: null, lastLoadedAt: Date.now(), profile });
    patchData({ reviews, products, shops, vendors, comments, lists, listItems, profile });
    return { tablesReady: true };
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === 'SETUP_REQUIRED') {
      setState({ tablesReady: false, error: appError.message });
      return { tablesReady: false };
    }
    setState({ error: appError.message });
    throw appError;
  }
}

/* ------------------------------- پروفایل -------------------------------- */

export async function saveProfile(patch) {
  const user = currentUser();
  const payload = {
    display_name: trim(patch.display_name, 60),
    city: trim(patch.city, 60),
    bio: trim(patch.bio, 280),
    avatar_hue: Number.isFinite(Number(patch.avatar_hue)) ? Number(patch.avatar_hue) : 158,
    currency: patch.currency === 'IRR' ? 'IRR' : 'IRT',
    density: patch.density === 'compact' ? 'compact' : 'cozy',
    onboarded: patch.onboarded ?? true,
  };

  if (getState().mode === 'demo') {
    const profile = { ...(getState().data.profile || {}), ...payload, user_id: user.id, updated_at: nowISO() };
    demoMutate((draft) => {
      draft.profile = profile;
      return profile;
    });
    setState({ profile });
    return profile;
  }

  const { data, error } = await sb()
    .from(TABLES.profiles)
    .upsert({ user_id: user.id, ...payload, updated_at: nowISO() }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw toAppError(error);

  setState({ profile: data });
  patchData({ profile: data });
  return data;
}

/* -------------------------------- پلتفرم -------------------------------- */

function vendorPayload(input, userId) {
  const payload = {
    name: assertName(input.name, 'نام پلتفرم', 60),
    color: /^#[0-9a-fA-F]{6}$/.test(input.color || '') ? input.color : '#35e0a1',
    emoji: trim(input.emoji, 8) || '🛒',
    website: trim(input.website, 200),
    note: trim(input.note, 500),
    is_active: input.is_active !== false,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 100,
  };
  return { ...payload, ...(userId ? { user_id: userId } : {}) };
}

export async function saveVendor(input) {
  const user = currentUser();
  const id = input.id || null;
  assertNoDuplicate(getState().data.vendors, input.name, id, 'پلتفرم');
  const payload = vendorPayload(input, id ? null : user.id);

  if (getState().mode === 'demo') {
    const record = { id: id || ensureUuid(), user_id: user.id, ...payload, created_at: nowISO(), updated_at: nowISO() };
    return demoMutate((draft) => {
      const index = draft.vendors.findIndex((row) => row.id === record.id);
      if (index >= 0) draft.vendors[index] = { ...draft.vendors[index], ...record };
      else draft.vendors.push(record);
      return record;
    });
  }

  const query = id
    ? sb().from(TABLES.vendors).update({ ...payload, updated_at: nowISO() }).eq('id', id)
    : sb().from(TABLES.vendors).insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    if (isConflictError(error)) throw new AppError('پلتفرمی با این نام وجود دارد.', 'DUPLICATE_NAME');
    throw toAppError(error);
  }
  patchData({
    vendors: id
      ? getState().data.vendors.map((row) => (row.id === id ? data : row))
      : [...getState().data.vendors, data],
  });
  return data;
}

export async function deleteVendor(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.vendors = draft.vendors.filter((row) => row.id !== id);
      const reviewIds = draft.reviews.filter((row) => row.vendor_id === id).map((row) => row.id);
      draft.reviews = draft.reviews.filter((row) => row.vendor_id !== id);
      draft.comments = draft.comments.filter(
        (row) => !(row.target_type === 'vendor' && row.target_id === id) && !(row.target_type === 'review' && reviewIds.includes(row.target_id)),
      );
      draft.listItems = draft.listItems.filter((row) => !(row.target_type === 'vendor' && row.target_id === id));
      return true;
    });
  }

  const { error } = await sb().from(TABLES.vendors).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  await reload();
  return true;
}

/* -------------------------------- فروشگاه -------------------------------- */

function shopPayload(input, userId) {
  return {
    name: assertName(input.name, 'نام فروشگاه', 100),
    category: trim(input.category, 60),
    city: trim(input.city, 60),
    address: trim(input.address, 200),
    emoji: trim(input.emoji, 8) || '🏪',
    note: trim(input.note, 1000),
    is_active: input.is_active !== false,
    ...(userId ? { user_id: userId } : {}),
  };
}

export async function saveShop(input) {
  const user = currentUser();
  const id = input.id || null;
  assertNoDuplicate(getState().data.shops, input.name, id, 'فروشگاه');
  const payload = shopPayload(input, id ? null : user.id);

  if (getState().mode === 'demo') {
    const record = { id: id || ensureUuid(), user_id: user.id, ...payload, created_at: nowISO(), updated_at: nowISO() };
    return demoMutate((draft) => {
      const index = draft.shops.findIndex((row) => row.id === record.id);
      if (index >= 0) draft.shops[index] = { ...draft.shops[index], ...record };
      else draft.shops.push(record);
      return record;
    });
  }

  const query = id
    ? sb().from(TABLES.shops).update({ ...payload, updated_at: nowISO() }).eq('id', id)
    : sb().from(TABLES.shops).insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    if (isConflictError(error)) throw new AppError('فروشگاهی با این نام وجود دارد.', 'DUPLICATE_NAME');
    throw toAppError(error);
  }
  patchData({
    shops: id ? getState().data.shops.map((row) => (row.id === id ? data : row)) : [...getState().data.shops, data],
  });
  return data;
}

export async function deleteShop(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.shops = draft.shops.filter((row) => row.id !== id);
      const reviewIds = draft.reviews.filter((row) => row.shop_id === id).map((row) => row.id);
      draft.reviews = draft.reviews.filter((row) => row.shop_id !== id);
      draft.comments = draft.comments.filter(
        (row) => !(row.target_type === 'shop' && row.target_id === id) && !(row.target_type === 'review' && reviewIds.includes(row.target_id)),
      );
      draft.listItems = draft.listItems.filter((row) => !(row.target_type === 'shop' && row.target_id === id));
      return true;
    });
  }
  const { error } = await sb().from(TABLES.shops).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  await reload();
  return true;
}

/* --------------------------------- محصول -------------------------------- */

function productPayload(input, userId) {
  return {
    name: assertName(input.name, 'نام محصول', 120),
    category: trim(input.category, 60),
    brand: trim(input.brand, 60),
    unit: trim(input.unit, 30),
    emoji: trim(input.emoji, 8) || '📦',
    note: trim(input.note, 1000),
    is_active: input.is_active !== false,
    ...(userId ? { user_id: userId } : {}),
  };
}

export async function saveProduct(input) {
  const user = currentUser();
  const id = input.id || null;
  assertNoDuplicate(getState().data.products, input.name, id, 'محصول');
  const payload = productPayload(input, id ? null : user.id);

  if (getState().mode === 'demo') {
    const record = { id: id || ensureUuid(), user_id: user.id, ...payload, created_at: nowISO(), updated_at: nowISO() };
    return demoMutate((draft) => {
      const index = draft.products.findIndex((row) => row.id === record.id);
      if (index >= 0) draft.products[index] = { ...draft.products[index], ...record };
      else draft.products.push(record);
      return record;
    });
  }

  const query = id
    ? sb().from(TABLES.products).update({ ...payload, updated_at: nowISO() }).eq('id', id)
    : sb().from(TABLES.products).insert(payload);
  const { data, error } = await query.select().single();
  if (error) {
    if (isConflictError(error)) throw new AppError('محصولی با این نام وجود دارد.', 'DUPLICATE_NAME');
    throw toAppError(error);
  }
  patchData({
    products: id
      ? getState().data.products.map((row) => (row.id === id ? data : row))
      : [...getState().data.products, data],
  });
  return data;
}

export async function deleteProduct(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.products = draft.products.filter((row) => row.id !== id);
      const reviewIds = draft.reviews.filter((row) => row.product_id === id).map((row) => row.id);
      draft.reviews = draft.reviews.filter((row) => row.product_id !== id);
      draft.comments = draft.comments.filter(
        (row) => !(row.target_type === 'product' && row.target_id === id) && !(row.target_type === 'review' && reviewIds.includes(row.target_id)),
      );
      draft.listItems = draft.listItems.filter((row) => !(row.target_type === 'product' && row.target_id === id));
      return true;
    });
  }
  const { error } = await sb().from(TABLES.products).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  await reload();
  return true;
}

/* --------------------------------- تجربه -------------------------------- */

function reviewPayload(input, userId) {
  if (!RATING_KEYS.includes(input.rating)) {
    throw new AppError('یکی از سه امتیاز را انتخاب کنید.', 'VALIDATION', { field: 'rating' });
  }
  if (!input.product_id) throw new AppError('محصول را انتخاب کنید.', 'VALIDATION', { field: 'product_id' });
  if (!input.shop_id) throw new AppError('فروشگاه را انتخاب کنید.', 'VALIDATION', { field: 'shop_id' });
  if (!input.vendor_id) throw new AppError('پلتفرم را انتخاب کنید.', 'VALIDATION', { field: 'vendor_id' });

  const price = input.price === '' || input.price === null || input.price === undefined ? null : Number(input.price);
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    throw new AppError('قیمت باید یک عدد مثبت باشد.', 'VALIDATION', { field: 'price' });
  }

  const quantity = input.quantity === '' || input.quantity === null || input.quantity === undefined ? 1 : Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('تعداد باید بزرگ‌تر از صفر باشد.', 'VALIDATION', { field: 'quantity' });
  }

  return {
    product_id: input.product_id,
    shop_id: input.shop_id,
    vendor_id: input.vendor_id,
    rating: input.rating,
    price,
    quantity,
    purchased_at: input.purchased_at || todayISO(),
    note: trim(input.note, 2000),
    tags: normalizeTags(input.tags),
    would_buy_again: typeof input.would_buy_again === 'boolean' ? input.would_buy_again : null,
    ...(userId ? { user_id: userId } : {}),
  };
}

export async function saveReview(input) {
  const user = currentUser();
  const payload = reviewPayload(input, input.id ? null : user.id);
  const existing = findCombo(getState().data.reviews, payload, input.id || null);

  if (existing) {
    throw new AppError(
      'برای همین ترکیب محصول، فروشگاه و پلتفرم قبلاً امتیاز ثبت شده است. می‌توانید همان را ویرایش کنید.',
      'COMBO_EXISTS',
      { review: existing },
    );
  }

  if (getState().mode === 'demo') {
    const record = {
      id: input.id || ensureUuid(),
      user_id: user.id,
      ...payload,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    return demoMutate((draft) => {
      const index = draft.reviews.findIndex((row) => row.id === record.id);
      if (index >= 0) draft.reviews[index] = { ...draft.reviews[index], ...record };
      else draft.reviews.unshift(record);
      return record;
    });
  }

  const query = input.id
    ? sb().from(TABLES.reviews).update({ ...payload, updated_at: nowISO() }).eq('id', input.id)
    : sb().from(TABLES.reviews).insert(payload);

  const { data, error } = await query.select().single();
  if (error) {
    if (isConflictError(error)) {
      const { data: clash } = await sb()
        .from(TABLES.reviews)
        .select('*')
        .eq('product_id', payload.product_id)
        .eq('shop_id', payload.shop_id)
        .eq('vendor_id', payload.vendor_id)
        .maybeSingle();
      throw new AppError(
        'برای همین ترکیب قبلاً امتیاز ثبت شده است. همان تجربه را ویرایش کنید.',
        'COMBO_EXISTS',
        { review: clash },
      );
    }
    throw toAppError(error);
  }

  patchData({
    reviews: input.id
      ? getState().data.reviews.map((row) => (row.id === input.id ? data : row))
      : [data, ...getState().data.reviews],
  });
  return data;
}

export async function deleteReview(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.reviews = draft.reviews.filter((row) => row.id !== id);
      draft.comments = draft.comments.filter(
        (row) => !(row.target_type === 'review' && row.target_id === id) && !(row.target_type === 'comment' && row.parent_id === id),
      );
      draft.listItems = draft.listItems.filter((row) => !(row.target_type === 'review' && row.target_id === id));
      return true;
    });
  }
  const { error } = await sb().from(TABLES.reviews).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  patchData({ reviews: getState().data.reviews.filter((row) => row.id !== id) });
  return true;
}

export async function bulkDeleteReviews(ids = []) {
  if (!ids.length) return 0;
  const user = currentUser();
  if (getState().mode === 'demo') {
    const set = new Set(ids);
    demoMutate((draft) => {
      draft.reviews = draft.reviews.filter((row) => !set.has(row.id));
      draft.comments = draft.comments.filter((row) => !(row.target_type === 'review' && set.has(row.target_id)));
      draft.listItems = draft.listItems.filter((row) => !(row.target_type === 'review' && set.has(row.target_id)));
      return ids.length;
    });
    return ids.length;
  }
  const { error } = await sb().from(TABLES.reviews).delete().in('id', ids).eq('user_id', user.id);
  if (error) throw toAppError(error);
  patchData({ reviews: getState().data.reviews.filter((row) => !ids.includes(row.id)) });
  return ids.length;
}

export function findReviewCombo(combo, excludeId = null) {
  return findCombo(getState().data.reviews, combo, excludeId);
}

/* --------------------------------- کامنت -------------------------------- */

export async function saveComment(input) {
  const user = currentUser();
  const content = trim(input.content, 2000);
  if (!content) throw new AppError('متن نظر خالی است.', 'VALIDATION', { field: 'content' });
  if (content.length > 2000) throw new AppError('نظر حداکثر ۲۰۰۰ حرف است.', 'VALIDATION', { field: 'content' });
  if (!['product', 'shop', 'vendor', 'review'].includes(input.target_type)) {
    throw new AppError('موجودیت نظر نامعتبر است.', 'VALIDATION');
  }

  const payload = {
    target_type: input.target_type,
    target_id: input.target_id,
    parent_id: input.parent_id || null,
    rating: RATING_KEYS.includes(input.rating) ? input.rating : null,
    content,
  };

  if (getState().mode === 'demo') {
    const record = { id: input.id || ensureUuid(), user_id: user.id, ...payload, created_at: nowISO(), updated_at: nowISO() };
    return demoMutate((draft) => {
      const index = draft.comments.findIndex((row) => row.id === record.id);
      if (index >= 0) draft.comments[index] = { ...draft.comments[index], ...record };
      else draft.comments.unshift(record);
      return record;
    });
  }

  const query = input.id
    ? sb().from(TABLES.comments).update({ ...payload, updated_at: nowISO() }).eq('id', input.id)
    : sb().from(TABLES.comments).insert({ ...payload, user_id: user.id });
  const { data, error } = await query.select().single();
  if (error) throw toAppError(error);

  patchData({
    comments: input.id
      ? getState().data.comments.map((row) => (row.id === input.id ? data : row))
      : [data, ...getState().data.comments],
  });
  return data;
}

export async function deleteComment(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.comments = draft.comments.filter((row) => row.id !== id && row.parent_id !== id);
      return true;
    });
  }
  const { error } = await sb().from(TABLES.comments).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  patchData({ comments: getState().data.comments.filter((row) => row.id !== id && row.parent_id !== id) });
  return true;
}

/* --------------------------------- لیست‌ها -------------------------------- */

export async function saveList(input) {
  const user = currentUser();
  const id = input.id || null;
  const name = assertName(input.name, 'نام لیست', 60);
  assertNoDuplicate(getState().data.lists, name, id, 'لیست');
  const payload = {
    name,
    emoji: trim(input.emoji, 8) || '📝',
    tone: ['buy', 'avoid', 'custom'].includes(input.tone) ? input.tone : 'custom',
    note: trim(input.note, 500),
  };

  if (getState().mode === 'demo') {
    const record = { id: id || ensureUuid(), user_id: user.id, ...payload, created_at: nowISO(), updated_at: nowISO() };
    return demoMutate((draft) => {
      const index = draft.lists.findIndex((row) => row.id === record.id);
      if (index >= 0) draft.lists[index] = { ...draft.lists[index], ...record };
      else draft.lists.push(record);
      return record;
    });
  }

  const query = id
    ? sb().from(TABLES.lists).update({ ...payload, updated_at: nowISO() }).eq('id', id)
    : sb().from(TABLES.lists).insert({ ...payload, user_id: user.id });
  const { data, error } = await query.select().single();
  if (error) {
    if (isConflictError(error)) throw new AppError('لیستی با این نام وجود دارد.', 'DUPLICATE_NAME');
    throw toAppError(error);
  }
  patchData({
    lists: id ? getState().data.lists.map((row) => (row.id === id ? data : row)) : [...getState().data.lists, data],
  });
  return data;
}

export async function deleteList(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.lists = draft.lists.filter((row) => row.id !== id);
      draft.listItems = draft.listItems.filter((row) => row.list_id !== id);
      return true;
    });
  }
  const { error } = await sb().from(TABLES.lists).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  patchData({
    lists: getState().data.lists.filter((row) => row.id !== id),
    listItems: getState().data.listItems.filter((row) => row.list_id !== id),
  });
  return true;
}

export async function addListItem({ list_id, target_type, target_id, note = '' }) {
  const user = currentUser();
  const exists = getState().data.listItems.find(
    (row) => row.list_id === list_id && row.target_type === target_type && row.target_id === target_id,
  );
  if (exists) throw new AppError('این آیتم از قبل در لیست هست.', 'DUPLICATE_ITEM', { item: exists });

  const payload = {
    list_id,
    target_type,
    target_id,
    note: trim(note, 300),
    done: false,
  };

  if (getState().mode === 'demo') {
    const record = { id: ensureUuid(), user_id: user.id, ...payload, created_at: nowISO(), updated_at: nowISO() };
    return demoMutate((draft) => {
      draft.listItems.push(record);
      return record;
    });
  }

  const { data, error } = await sb()
    .from(TABLES.listItems)
    .insert({ ...payload, user_id: user.id })
    .select()
    .single();
  if (error) {
    if (isConflictError(error)) throw new AppError('این آیتم از قبل در لیست هست.', 'DUPLICATE_ITEM');
    throw toAppError(error);
  }
  patchData({ listItems: [...getState().data.listItems, data] });
  return data;
}

export async function toggleListItem(id, done) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.listItems = draft.listItems.map((row) => (row.id === id ? { ...row, done, updated_at: nowISO() } : row));
      return true;
    });
  }
  const { error } = await sb().from(TABLES.listItems).update({ done, updated_at: nowISO() }).eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  patchData({ listItems: getState().data.listItems.map((row) => (row.id === id ? { ...row, done } : row)) });
  return true;
}

export async function deleteListItem(id) {
  const user = currentUser();
  if (getState().mode === 'demo') {
    return demoMutate((draft) => {
      draft.listItems = draft.listItems.filter((row) => row.id !== id);
      return true;
    });
  }
  const { error } = await sb().from(TABLES.listItems).delete().eq('id', id).eq('user_id', user.id);
  if (error) throw toAppError(error);
  patchData({ listItems: getState().data.listItems.filter((row) => row.id !== id) });
  return true;
}

/* ------------------------------ برون‌بری/درون‌ریزی ------------------------- */

export function exportAll() {
  const data = getState().data;
  return {
    app: 'forooshgahyar',
    version: 1,
    exported_at: nowISO(),
    mode: getState().mode,
    vendors: data.vendors,
    shops: data.shops,
    products: data.products,
    reviews: data.reviews,
    comments: data.comments,
    lists: data.lists,
    listItems: data.listItems,
    profile: data.profile,
  };
}

function remapCollection(rows, makeId) {
  const map = new Map();
  const out = (rows || [])
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const newId = makeId();
      if (row.id) map.set(row.id, newId);
      return { ...row, id: newId };
    });
  return { rows: out, map };
}

function sanitizeSnapshot(payload) {
  const vendors = remapCollection(payload.vendors, ensureUuid);
  const shops = remapCollection(payload.shops, ensureUuid);
  const products = remapCollection(payload.products, ensureUuid);
  const lists = remapCollection(payload.lists, ensureUuid);

  const reviews = (payload.reviews || []).map((row) => ({
    ...row,
    id: ensureUuid(),
    product_id: products.map.get(row.product_id) || row.product_id,
    shop_id: shops.map.get(row.shop_id) || row.shop_id,
    vendor_id: vendors.map.get(row.vendor_id) || row.vendor_id,
    tags: normalizeTags(row.tags),
    rating: RATING_KEYS.includes(row.rating) ? row.rating : 'not_good',
  }));

  const reviewMap = new Map((payload.reviews || []).map((row, index) => [row.id, reviews[index]?.id]));

  // دو گذر: اول شناسه‌های جدید کامنت‌ها، بعد نگاشت parent_id تا سلسله‌مراتب حفظ شود
  const commentIdMap = new Map();
  const commentsDraft = (payload.comments || []).map((row) => {
    const newId = ensureUuid();
    if (row.id) commentIdMap.set(row.id, newId);
    const targetMap =
      row.target_type === 'product'
        ? products.map
        : row.target_type === 'shop'
          ? shops.map
          : row.target_type === 'vendor'
            ? vendors.map
            : reviewMap;
    return {
      ...row,
      id: newId,
      target_id: targetMap.get(row.target_id) || row.target_id,
      rating: RATING_KEYS.includes(row.rating) ? row.rating : null,
    };
  });

  const comments = commentsDraft.map((row) => ({
    ...row,
    parent_id: row.parent_id ? commentIdMap.get(row.parent_id) || null : null,
  }));

  const listItems = (payload.listItems || []).map((row) => {
    const targetMap =
      row.target_type === 'product' ? products.map : row.target_type === 'shop' ? shops.map : row.target_type === 'vendor' ? vendors.map : reviewMap;
    return {
      ...row,
      id: ensureUuid(),
      list_id: lists.map.get(row.list_id) || row.list_id,
      target_id: targetMap.get(row.target_id) || row.target_id,
    };
  });

  return {
    vendors: vendors.rows,
    shops: shops.rows,
    products: products.rows,
    reviews,
    comments,
    lists: lists.rows,
    listItems,
  };
}

export async function importAll(payload) {
  if (!payload || typeof payload !== 'object') throw new AppError('فایل پشتیبان معتبر نیست.', 'VALIDATION');
  const snapshot = sanitizeSnapshot(payload);
  const user = currentUser();
  const stamp = nowISO();

  if (getState().mode === 'demo') {
    const next = {
      ...emptyData(getState().data.profile),
      ...snapshot,
      profile: getState().data.profile,
    };
    saveDemoData(next);
    patchData(next);
    return { imported: snapshot.reviews.length };
  }

  const clean = (rows) =>
    rows.map((row) => {
      const copy = { ...row, user_id: user.id };
      delete copy.created_at;
      delete copy.updated_at;
      return copy;
    });

  const insertAll = async (table, rows) => {
    if (!rows.length) return;
    const { error } = await sb().from(table).insert(clean(rows));
    if (error) throw toAppError(error);
  };

  await insertAll(TABLES.vendors, snapshot.vendors);
  await insertAll(TABLES.shops, snapshot.shops);
  await insertAll(TABLES.products, snapshot.products);
  await insertAll(TABLES.lists, snapshot.lists);
  await insertAll(TABLES.reviews, snapshot.reviews);
  await insertAll(TABLES.comments, snapshot.comments);
  await insertAll(TABLES.listItems, snapshot.listItems);

  await reload();
  return { imported: snapshot.reviews.length };
}

export async function importSampleIntoAccount() {
  const sample = createDemoData();
  return importAll(sample);
}

export async function wipeAllData() {
  const user = currentUser();
  if (getState().mode === 'demo') {
    const profile = getState().data.profile;
    const next = emptyData(profile);
    saveDemoData(next);
    patchData(next);
    return true;
  }

  const tables = [TABLES.listItems, TABLES.comments, TABLES.reviews, TABLES.lists, TABLES.products, TABLES.shops, TABLES.vendors];
  for (const table of tables) {
    const { error } = await sb().from(table).delete().eq('user_id', user.id);
    if (error) throw toAppError(error);
  }
  patchData(emptyData(getState().data.profile));
  return true;
}

export function clearStore() {
  resetState();
}

/* -------------------------- کمک‌های نمایشی برای UI ------------------------ */

export function entityName(type, id) {
  const data = getState().data;
  const list = type === 'product' ? data.products : type === 'shop' ? data.shops : type === 'vendor' ? data.vendors : data.reviews;
  const row = list.find((item) => item.id === id);
  if (!row) return 'نامشخص';
  if (type === 'review') {
    const index = buildIndex(data);
    return hydrateReview(row, index)?.productName || 'تجربه';
  }
  return row.name;
}

export function dataCounts() {
  const data = getState().data;
  return {
    reviews: data.reviews.length,
    products: data.products.length,
    shops: data.shops.length,
    vendors: data.vendors.length,
    comments: data.comments.length,
    lists: data.lists.length,
    listItems: data.listItems.length,
  };
}

export function markGuestProfile() {
  const user = getState().user;
  if (!user) return;
  patchData({ profile: { ...(getState().data.profile || {}), user_id: user.id } });
}

export const DEMO_USER = DEMO_USER_ID;

export { uid };
