import { supabase } from "./supabase.js";
import { STORAGE_BUCKET } from "./config.js";
import { slugify, normalizeTags, readingTime, sanitizeHtml, fileExtension } from "./utils.js";

export const TABLES = {
  profiles: "profiles",
  theories: "theories",
  objects: "theory_objects",
  likes: "theory_likes",
  bookmarks: "theory_bookmarks",
};

const LOCAL_LIKES = "nazariyeh-local-likes";
const LOCAL_BOOKMARKS = "nazariyeh-local-bookmarks";

export class ApiError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "ApiError";
    this.cause = cause;
  }
}

function fail(message, cause) {
  if (cause) console.error(message, cause);
  throw new ApiError(message, cause);
}

export function getFriendlyError(error, fallback = "خطایی رخ داد. لطفاً دوباره تلاش کنید.") {
  if (!error) return fallback;
  if (error instanceof ApiError) return error.message;
  const message = String(error.message || "");
  if (/relation .* does not exist/i.test(message)) return "جدول مورد نظر در پایگاه داده یافت نشد. ساختار پایگاه داده را بررسی کنید.";
  if (/column .* does not exist/i.test(message)) return "یکی از ستون‌های پایگاه داده با نسخهٔ برنامه هم‌خوانی ندارد.";
  if (/row-level security/i.test(message)) return "دسترسی لازم برای این عملیات وجود ندارد.";
  if (/duplicate key/i.test(message)) return "این مورد از قبل ثبت شده است.";
  if (/JWT|session|token/i.test(message)) return "نشست شما منقضی شده است. دوباره وارد شوید.";
  if (/password/i.test(message)) return "رمز عبور معتبر نیست.";
  if (/email/i.test(message) && /invalid/i.test(message)) return "ایمیل واردشده معتبر نیست.";
  if (/bucket/i.test(message)) return "فضای ذخیره‌سازی تصاویر تنظیم نشده است.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.";
  return fallback;
}

export function getAuthErrorMessage(error) {
  const message = String(error?.message || "");
  if (/Invalid login credentials/i.test(message)) return "ایمیل یا رمز عبور نادرست است.";
  if (/Email not confirmed/i.test(message)) return "ایمیل شما هنوز تأیید نشده است.";
  if (/User already registered/i.test(message)) return "این ایمیل قبلاً ثبت‌نام کرده است.";
  if (/Password should be at least/i.test(message)) return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
  if (/rate limit/i.test(message)) return "تعداد تلاش‌ها زیاد بوده است. کمی بعد دوباره تلاش کنید.";
  if (/Invalid email/i.test(message)) return "ایمیل واردشده معتبر نیست.";
  return getFriendlyError(error, "عملیات احراز هویت انجام نشد.");
}

function fallbackProfile(user) {
  const meta = user?.user_metadata || {};
  return {
    id: user?.id || "",
    username: meta.username || user?.email?.split("@")[0] || "user",
    full_name: meta.full_name || meta.name || user?.email?.split("@")[0] || "کاربر نظریه",
    bio: meta.bio || "",
    avatar_url: meta.avatar_url || "",
    website: meta.website || "",
    created_at: user?.created_at || new Date().toISOString(),
  };
}

export async function getProfile(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("profile fetch failed", error.message);
    return null;
  }
  return data;
}

export async function ensureProfile(user) {
  if (!user) return null;
  const existing = await getProfile(user.id);
  if (existing) return existing;

  const meta = user.user_metadata || {};
  const baseUsername = (meta.username || user.email?.split("@")[0] || `user-${user.id.slice(0, 6)}`)
    .toString()
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 18) || `user-${user.id.slice(0, 6)}`;

  const payload = {
    id: user.id,
    username: `${baseUsername}${baseUsername.length < 4 ? user.id.slice(0, 4) : ""}`,
    full_name: meta.full_name || meta.name || baseUsername,
    bio: meta.bio || "",
    avatar_url: meta.avatar_url || "",
  };

  const { data, error } = await supabase
    .from(TABLES.profiles)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.warn("profile create failed", error.message);
    return fallbackProfile(user);
  }
  return data;
}

export async function updateProfile(id, payload) {
  const clean = {
    full_name: String(payload.full_name || "").trim().slice(0, 80),
    username: String(payload.username || "").trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24),
    bio: String(payload.bio || "").trim().slice(0, 400),
    website: String(payload.website || "").trim().slice(0, 160),
    avatar_url: String(payload.avatar_url || "").trim(),
    updated_at: new Date().toISOString(),
  };
  if (!clean.username) delete clean.username;
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail(getFriendlyError(error), error);
  return data;
}

export async function getProfilesByIds(ids = []) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select("*")
    .in("id", unique);
  if (error) {
    console.warn("profiles fetch failed", error.message);
    return new Map();
  }
  return new Map((data || []).map((profile) => [profile.id, profile]));
}

async function attachAuthors(theories = []) {
  const map = await getProfilesByIds(theories.map((theory) => theory.user_id));
  return theories.map((theory) => ({
    ...theory,
    author: map.get(theory.user_id) || null,
  }));
}

export async function listTheories(options = {}) {
  const {
    search = "",
    tag = "",
    sort = "newest",
    authorId = null,
    status,
    limit = 12,
    offset = 0,
  } = options;

  let query = supabase.from(TABLES.theories).select("*", { count: "exact" });

  if (authorId) query = query.eq("user_id", authorId);

  if (status === undefined) query = query.eq("status", "published");
  else if (status && status !== "all") query = query.eq("status", status);

  if (search) {
    const term = String(search).replace(/[%_]/g, "").trim();
    if (term) {
      query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,content.ilike.%${term}%`);
    }
  }

  if (tag) query = query.contains("tags", [tag]);

  const orderMap = {
    newest: ["created_at", false],
    oldest: ["created_at", true],
    popular: ["views", false],
    liked: ["likes_count", false],
    title: ["title", true],
  };
  const [column, ascending] = orderMap[sort] || orderMap.newest;
  query = query.order(column, { ascending, nullsFirst: false });

  if (limit) query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    if (sort === "popular" || sort === "liked") {
      let fallback = supabase.from(TABLES.theories).select("*", { count: "exact" });
      if (authorId) fallback = fallback.eq("user_id", authorId);
      if (status === undefined) fallback = fallback.eq("status", "published");
      else if (status && status !== "all") fallback = fallback.eq("status", status);
      if (search) fallback = fallback.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      if (tag) fallback = fallback.contains("tags", [tag]);
      fallback = fallback.order("created_at", { ascending: false });
      if (limit) fallback = fallback.range(offset, offset + limit - 1);
      const retry = await fallback;
      if (!retry.error) {
        return { items: await attachAuthors(retry.data || []), count: retry.count || 0 };
      }
    }
    fail(getFriendlyError(error, "دریافت نظریه‌ها انجام نشد."), error);
  }

  return { items: await attachAuthors(data || []), count: count || 0 };
}

export async function getTheoryBySlug(slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from(TABLES.theories)
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail(getFriendlyError(error, "دریافت نظریه انجام نشد."), error);
  if (!data) return null;
  const author = await getProfile(data.user_id);
  return { ...data, author: author || null };
}

export async function getTheoryById(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from(TABLES.theories)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(getFriendlyError(error, "دریافت نظریه انجام نشد."), error);
  if (!data) return null;
  const author = await getProfile(data.user_id);
  return { ...data, author: author || null };
}

function prepareTheoryPayload(payload, { isNew = false } = {}) {
  const content = sanitizeHtml(payload.content || "");
  const title = String(payload.title || "").trim();
  if (!title) throw new ApiError("عنوان نظریه را وارد کنید.");

  const status = ["published", "draft", "private"].includes(payload.status)
    ? payload.status
    : "draft";

  const clean = {
    title: title.slice(0, 160),
    slug: String(payload.slug || "").trim() || `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`,
    excerpt: String(payload.excerpt || "").trim().slice(0, 500),
    content,
    cover_image_url: String(payload.cover_image_url || "").trim(),
    line_picture: payload.line_picture || { lines: [] },
    tags: normalizeTags(payload.tags || []),
    status,
    updated_at: new Date().toISOString(),
  };

  if (isNew) clean.user_id = payload.user_id;
  if (status === "published") clean.published_at = payload.published_at || new Date().toISOString();
  return clean;
}

export async function createTheory(payload) {
  const clean = prepareTheoryPayload(payload, { isNew: true });
  if (!clean.user_id) throw new ApiError("برای ساخت نظریه باید وارد شوید.");
  clean.reading_minutes = readingTime(clean.content);

  const { data, error } = await supabase
    .from(TABLES.theories)
    .insert(clean)
    .select("*")
    .single();
  if (error) fail(getFriendlyError(error, "ساخت نظریه انجام نشد."), error);
  return data;
}

export async function updateTheory(id, payload) {
  if (!id) throw new ApiError("شناسهٔ نظریه مشخص نیست.");
  const clean = prepareTheoryPayload(payload, { isNew: false });
  clean.reading_minutes = readingTime(clean.content);

  const { data, error } = await supabase
    .from(TABLES.theories)
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail(getFriendlyError(error, "ذخیرهٔ نظریه انجام نشد."), error);
  return data;
}

export async function deleteTheory(id) {
  const { error } = await supabase.from(TABLES.theories).delete().eq("id", id);
  if (error) fail(getFriendlyError(error, "حذف نظریه انجام نشد."), error);
  return true;
}

export async function incrementTheoryViews(id) {
  if (!id) return;
  const rpc = await supabase.rpc("increment_theory_views", { theory_id: id });
  if (!rpc.error) return;
  const { data } = await supabase.from(TABLES.theories).select("views").eq("id", id).maybeSingle();
  if (data) {
    await supabase.from(TABLES.theories).update({ views: Number(data.views || 0) + 1 }).eq("id", id);
  }
}

export async function listObjects(theoryId) {
  if (!theoryId) return [];
  const { data, error } = await supabase
    .from(TABLES.objects)
    .select("*")
    .eq("theory_id", theoryId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("objects fetch failed", error.message);
    return [];
  }
  return data || [];
}

export async function createObject(payload) {
  if (!payload?.theory_id) throw new ApiError("ابتدا نظریه را ذخیره کنید.");
  const clean = {
    theory_id: payload.theory_id,
    user_id: payload.user_id || null,
    kind: payload.kind || "concept",
    title: String(payload.title || "").trim().slice(0, 120),
    description: String(payload.description || "").trim().slice(0, 600),
    image_url: String(payload.image_url || "").trim(),
    link_url: String(payload.link_url || "").trim(),
    position: Number(payload.position || 0),
    metadata: payload.metadata || {},
  };
  if (!clean.title) throw new ApiError("عنوان شیء را وارد کنید.");
  const { data, error } = await supabase
    .from(TABLES.objects)
    .insert(clean)
    .select("*")
    .single();
  if (error) fail(getFriendlyError(error, "ثبت شیء انجام نشد."), error);
  return data;
}

export async function updateObject(id, payload) {
  if (!id) throw new ApiError("شناسهٔ شیء مشخص نیست.");
  const clean = {
    kind: payload.kind || "concept",
    title: String(payload.title || "").trim().slice(0, 120),
    description: String(payload.description || "").trim().slice(0, 600),
    image_url: String(payload.image_url || "").trim(),
    link_url: String(payload.link_url || "").trim(),
    position: Number(payload.position || 0),
    metadata: payload.metadata || {},
  };
  if (!clean.title) throw new ApiError("عنوان شیء را وارد کنید.");
  const { data, error } = await supabase
    .from(TABLES.objects)
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail(getFriendlyError(error, "ویرایش شیء انجام نشد."), error);
  return data;
}

export async function deleteObject(id) {
  const { error } = await supabase.from(TABLES.objects).delete().eq("id", id);
  if (error) fail(getFriendlyError(error, "حذف شیء انجام نشد."), error);
  return true;
}

function readLocalSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function writeLocalSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export async function getLikeState(theoryId, userId) {
  if (!theoryId || !userId) return { liked: false };
  const { data, error } = await supabase
    .from(TABLES.likes)
    .select("theory_id")
    .eq("theory_id", theoryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { liked: readLocalSet(LOCAL_LIKES).has(theoryId) };
  return { liked: Boolean(data) };
}

export async function toggleLike(theoryId, userId) {
  if (!userId) throw new ApiError("برای پسندیدن وارد شوید.");
  const existing = await getLikeState(theoryId, userId);
  if (existing.liked) {
    const { error } = await supabase
      .from(TABLES.likes)
      .delete()
      .eq("theory_id", theoryId)
      .eq("user_id", userId);
    if (error) {
      const local = readLocalSet(LOCAL_LIKES);
      local.delete(theoryId);
      writeLocalSet(LOCAL_LIKES, local);
      return { liked: false };
    }
    return { liked: false };
  }
  const { error } = await supabase.from(TABLES.likes).insert({ theory_id: theoryId, user_id: userId });
  if (error) {
    const local = readLocalSet(LOCAL_LIKES);
    local.add(theoryId);
    writeLocalSet(LOCAL_LIKES, local);
    return { liked: true };
  }
  return { liked: true };
}

export async function getBookmarkState(theoryId, userId) {
  if (!theoryId || !userId) return { bookmarked: false };
  const { data, error } = await supabase
    .from(TABLES.bookmarks)
    .select("theory_id")
    .eq("theory_id", theoryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { bookmarked: readLocalSet(LOCAL_BOOKMARKS).has(theoryId) };
  return { bookmarked: Boolean(data) };
}

export async function toggleBookmark(theoryId, userId) {
  if (!userId) throw new ApiError("برای نشان‌کردن وارد شوید.");
  const existing = await getBookmarkState(theoryId, userId);
  if (existing.bookmarked) {
    const { error } = await supabase
      .from(TABLES.bookmarks)
      .delete()
      .eq("theory_id", theoryId)
      .eq("user_id", userId);
    if (error) {
      const local = readLocalSet(LOCAL_BOOKMARKS);
      local.delete(theoryId);
      writeLocalSet(LOCAL_BOOKMARKS, local);
      return { bookmarked: false };
    }
    return { bookmarked: false };
  }
  const { error } = await supabase.from(TABLES.bookmarks).insert({ theory_id: theoryId, user_id: userId });
  if (error) {
    const local = readLocalSet(LOCAL_BOOKMARKS);
    local.add(theoryId);
    writeLocalSet(LOCAL_BOOKMARKS, local);
    return { bookmarked: true };
  }
  return { bookmarked: true };
}

export async function getBookmarkedIds(userId) {
  if (!userId) return [...readLocalSet(LOCAL_BOOKMARKS)];
  const { data, error } = await supabase
    .from(TABLES.bookmarks)
    .select("theory_id")
    .eq("user_id", userId);
  if (error) return [...readLocalSet(LOCAL_BOOKMARKS)];
  return (data || []).map((row) => row.theory_id);
}

export async function getPlatformStats() {
  const [theories, objects, profiles] = await Promise.all([
    supabase.from(TABLES.theories).select("*", { count: "exact", head: true }).eq("status", "published"),
    supabase.from(TABLES.objects).select("*", { count: "exact", head: true }),
    supabase.from(TABLES.profiles).select("*", { count: "exact", head: true }),
  ]);
  return {
    theories: theories.count || 0,
    objects: objects.count || 0,
    authors: profiles.count || 0,
  };
}

export async function getPopularTags(limit = 18) {
  const { data, error } = await supabase
    .from(TABLES.theories)
    .select("tags")
    .eq("status", "published")
    .limit(400);
  if (error) return [];
  const counts = new Map();
  (data || []).forEach((row) => {
    (row.tags || []).forEach((tag) => {
      const clean = String(tag || "").trim();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

export async function getUserTheoryStats(userId) {
  if (!userId) return { total: 0, published: 0, drafts: 0, views: 0, objects: 0 };
  const { data, error } = await supabase
    .from(TABLES.theories)
    .select("*")
    .eq("user_id", userId);
  if (error) fail(getFriendlyError(error, "دریافت آمار انجام نشد."), error);
  const rows = data || [];
  const views = rows.reduce((sum, row) => sum + Number(row.views || 0), 0);
  const ids = rows.map((row) => row.id);
  let objects = 0;
  if (ids.length) {
    const { count } = await supabase
      .from(TABLES.objects)
      .select("*", { count: "exact", head: true })
      .in("theory_id", ids);
    objects = count || 0;
  }
  return {
    total: rows.length,
    published: rows.filter((row) => row.status === "published").length,
    drafts: rows.filter((row) => row.status === "draft").length,
    private: rows.filter((row) => row.status === "private").length,
    views,
    objects,
  };
}

export async function searchTheories(term, limit = 6) {
  if (!term || !String(term).trim()) return [];
  try {
    const { items } = await listTheories({ search: term, limit });
    return items;
  } catch {
    return [];
  }
}

export async function uploadImage(file, userId, folder = "covers") {
  if (!file) throw new ApiError("تصویری انتخاب نشده است.");
  if (!userId) throw new ApiError("برای بارگذاری تصویر باید وارد شوید.");
  if (!file.type?.startsWith("image/")) throw new ApiError("فقط فایل تصویری مجاز است.");
  if (file.size > 8 * 1024 * 1024) throw new ApiError("حجم تصویر نباید بیشتر از ۸ مگابایت باشد.");

  const ext = fileExtension(file.name);
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) fail(getFriendlyError(error, "بارگذاری تصویر انجام نشد."), error);
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail(getAuthErrorMessage(error), error);
  if (data.user) {
    const profile = await ensureProfile(data.user);
    return { ...data, profile };
  }
  return data;
}

export async function signUp({ email, password, fullName, username }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username,
      },
    },
  });
  if (error) fail(getAuthErrorMessage(error), error);
  if (data.user && data.session) {
    await ensureProfile(data.user);
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) fail(getAuthErrorMessage(error), error);
}

export async function sendPasswordReset(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || `${location.origin}${location.pathname}#/login?mode=reset`,
  });
  if (error) fail(getAuthErrorMessage(error), error);
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) fail(getAuthErrorMessage(error), error);
  return data;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error };
  return data;
}
