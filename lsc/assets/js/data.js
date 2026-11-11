/* ============================================================
   THEORIES STUDIO — Data access layer
   ============================================================ */
import { sb } from './supabase.js';
import { state } from './state.js';
import { APP } from './config.js';

const client = () => {
  const c = sb();
  if (!c) throw new Error('Supabase client unavailable');
  return c;
};

/* ---------------- Theories ---------------- */
export const listTheories = async ({
  page = 1, perPage = APP.pagination.theoriesPerPage, category, q, mine = false, status, favorite, tag, sort = 'created_desc'
} = {}) => {
  const c = client();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let query = c.from('theories').select('*', { count: 'exact' });
  if (mine) {
    if (!state.user) return { items: [], count: 0 };
    query = query.eq('user_id', state.user.id);
  }
  if (category && category !== 'all') query = query.eq('category', category);
  if (status && status !== 'all') query = query.eq('status', status);
  if (favorite === true) query = query.eq('favorite', true);
  if (tag) query = query.contains('tags', [tag]);
  if (q) query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,content.ilike.%${q}%`);
  switch (sort) {
    case 'created_asc': query = query.order('created_at', { ascending: true }); break;
    case 'updated_desc': query = query.order('updated_at', { ascending: false }); break;
    case 'title_asc': query = query.order('title', { ascending: true }); break;
    case 'title_desc': query = query.order('title', { ascending: false }); break;
    case 'view_desc': query = query.order('view_count', { ascending: false }); break;
    default: query = query.order('created_at', { ascending: false });
  }
  query = query.range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { items: data || [], count: count || 0 };
};

export const getTheory = async (id) => {
  const c = client();
  const { data, error } = await c.from('theories').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

export const getTheoryBySlug = async (slug) => {
  const c = client();
  const { data, error } = await c.from('theories').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
};

export const createTheory = async (payload) => {
  const c = client();
  if (!state.user) throw new Error('برای ساخت نظریه باید وارد شوید');
  const insert = { ...payload, user_id: state.user.id };
  const { data, error } = await c.from('theories').insert(insert).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const updateTheory = async (id, patch) => {
  const c = client();
  const { data, error } = await c.from('theories').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteTheory = async (id) => {
  const c = client();
  const { error } = await c.from('theories').delete().eq('id', id);
  if (error) throw error;
};

export const incrementView = async (id) => {
  try {
    const c = client();
    await c.rpc('increment_theory_view', { p_theory_id: id });
  } catch (e) { /* silent */ }
};

/* ---------------- Objects ---------------- */
export const listObjects = async ({ theoryId, page = 1, perPage = APP.pagination.objectsPerPage } = {}) => {
  const c = client();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let q = c.from('theory_objects').select('*, theory:theories(id,title,slug,cover_image)', { count: 'exact' });
  if (theoryId) q = q.eq('theory_id', theoryId);
  q = q.order('sort_order', { ascending: true }).order('created_at', { ascending: true }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data || [], count: count || 0 };
};

export const getObject = async (id) => {
  const c = client();
  const { data, error } = await c.from('theory_objects').select('*, theory:theories(id,title,slug,cover_image)').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

export const createObject = async (payload) => {
  const c = client();
  if (!state.user) throw new Error('ابتدا وارد شوید');
  const { data, error } = await c.from('theory_objects').insert({ ...payload, user_id: state.user.id }).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const updateObject = async (id, patch) => {
  const c = client();
  const { data, error } = await c.from('theory_objects').update(patch).eq('id', id).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteObject = async (id) => {
  const c = client();
  const { error } = await c.from('theory_objects').delete().eq('id', id);
  if (error) throw error;
};

/* ---------------- Images ---------------- */
export const listImages = async ({ theoryId, page = 1, perPage = APP.pagination.galleryPerPage } = {}) => {
  const c = client();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let q = c.from('theory_images').select('*, theory:theories(id,title,slug)', { count: 'exact' });
  if (theoryId) q = q.eq('theory_id', theoryId);
  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data || [], count: count || 0 };
};

export const createImage = async (payload) => {
  const c = client();
  const { data, error } = await c.from('theory_images').insert({ ...payload, user_id: state.user.id }).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteImage = async (id) => {
  const c = client();
  const { error } = await c.from('theory_images').delete().eq('id', id);
  if (error) throw error;
};

/* ---------------- Links ---------------- */
export const listLinks = async ({ theoryId } = {}) => {
  const c = client();
  let q = c.from('theory_links').select('*, source:theories!theory_links_source_theory_id_fkey(id,title,slug,cover_image), target:theories!theory_links_target_theory_id_fkey(id,title,slug,cover_image)');
  if (theoryId) q = q.or(`source_theory_id.eq.${theoryId},target_theory_id.eq.${theoryId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const createLink = async (payload) => {
  const c = client();
  const { data, error } = await c.from('theory_links').insert({ ...payload, user_id: state.user.id }).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteLink = async (id) => {
  const c = client();
  const { error } = await c.from('theory_links').delete().eq('id', id);
  if (error) throw error;
};

/* ---------------- Events / timeline ---------------- */
export const listEvents = async ({ page = 1, perPage = APP.pagination.timelinePerPage, theoryId } = {}) => {
  const c = client();
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let q = c.from('theory_events').select('*, theory:theories(id,title,slug,cover_image)', { count: 'exact' });
  if (theoryId) q = q.eq('theory_id', theoryId);
  q = q.order('created_at', { ascending: false }).range(from, to);
  const { data, error, count } = await q;
  if (error) throw error;
  return { items: data || [], count: count || 0 };
};

export const createEvent = async (payload) => {
  const c = client();
  const { data, error } = await c.from('theory_events').insert({ ...payload, user_id: state.user.id }).select().maybeSingle();
  if (error) throw error;
  return data;
};

/* ---------------- Bookmarks ---------------- */
export const listBookmarks = async () => {
  const c = client();
  if (!state.user) return [];
  const { data, error } = await c
    .from('theory_bookmarks')
    .select('*, theory:theories(*)')
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const isBookmarked = async (theoryId) => {
  const c = client();
  if (!state.user) return false;
  const { data, error } = await c.from('theory_bookmarks').select('id').eq('theory_id', theoryId).eq('user_id', state.user.id).maybeSingle();
  if (error) return false;
  return !!data;
};

export const toggleBookmark = async (theoryId) => {
  const c = client();
  if (!state.user) throw new Error('ابتدا وارد شوید');
  const existing = await isBookmarked(theoryId);
  if (existing) {
    const { error } = await c.from('theory_bookmarks').delete().eq('theory_id', theoryId).eq('user_id', state.user.id);
    if (error) throw error;
    return false;
  } else {
    const { error } = await c.from('theory_bookmarks').insert({ theory_id: theoryId, user_id: state.user.id });
    if (error) throw error;
    return true;
  }
};

/* ---------------- Comments ---------------- */
export const listComments = async (theoryId) => {
  const c = client();
  const { data, error } = await c.from('theory_comments').select('*').eq('theory_id', theoryId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createComment = async (payload) => {
  const c = client();
  const { data, error } = await c.from('theory_comments').insert({ ...payload, user_id: state.user.id }).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteComment = async (id) => {
  const c = client();
  const { error } = await c.from('theory_comments').delete().eq('id', id);
  if (error) throw error;
};

/* ---------------- Storage ---------------- */
export const uploadImage = async (file, prefix = 'img') => {
  const c = client();
  if (!state.user) throw new Error('ابتدا وارد شوید');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${state.user.id}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await c.storage.from(APP.storage.bucket).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg'
  });
  if (error) throw error;
  const { data } = c.storage.from(APP.storage.bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
};

export const removeStorageFile = async (path) => {
  const c = client();
  if (!path) return;
  await c.storage.from(APP.storage.bucket).remove([path]).catch(() => {});
};

/* ---------------- Stats ---------------- */
export const loadCounts = async () => {
  const c = client();
  try {
    const [theories, objects, images, events, bookmarks] = await Promise.all([
      c.from('theories').select('id', { count: 'exact', head: true }),
      c.from('theory_objects').select('id', { count: 'exact', head: true }),
      c.from('theory_images').select('id', { count: 'exact', head: true }),
      c.from('theory_events').select('id', { count: 'exact', head: true }),
      state.user ? c.from('theory_bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', state.user.id) : Promise.resolve({ count: 0 })
    ]);
    return {
      theoriesCount: theories.count || 0,
      objectsCount: objects.count || 0,
      galleryCount: images.count || 0,
      timelineCount: events.count || 0,
      bookmarksCount: bookmarks.count || 0
    };
  } catch (e) {
    console.warn(e);
    return {};
  }
};

/* ---------------- Global search ---------------- */
export const globalSearch = async (q, limit = 8) => {
  if (!q) return { theories: [], objects: [] };
  const c = client();
  const term = q.replace(/[%,]/g, '');
  const [t, o] = await Promise.all([
    c.from('theories').select('id,title,slug,summary,cover_image,category,created_at').or(`title.ilike.%${term}%,summary.ilike.%${term}%`).limit(limit),
    c.from('theory_objects').select('id,title,image_url,theory_id,theory:theories(title,slug)').ilike('title', `%${term}%`).limit(limit)
  ]);
  return { theories: t.data || [], objects: o.data || [] };
};
