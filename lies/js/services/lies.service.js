/* ============================================================
   js/services/lies.service.js
   FIXED: Ignored 'all' string for type and mood filters.
          Added support for pinnedOnly filter.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { bus } from '../core/event-bus.js';
import { EVENTS, TABLES } from '../config/constants.js';
import { cleanText } from '../utils/sanitize.js';
import { uuid } from '../utils/id.js';

const T_LIES = TABLES.LIES;
const T_LINKS = TABLES.LIE_TAGS;

function normalize(row, tagsMap = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    body: row.body || '',
    truth: row.truth || '',
    type: row.type,
    status: row.status,
    mood: row.mood,
    intensity: row.intensity,
    belief: row.belief,
    occurredAt: row.occurred_at,
    isPinned: !!row.is_pinned,
    archivedAt: row.archived_at,
    trashedAt: row.trashed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: tagsMap[row.id] || [],
  };
}

const SORT_MAP = {
  created_desc:  { column: 'created_at',  ascending: false },
  created_asc:   { column: 'created_at',  ascending: true  },
  updated_desc:  { column: 'updated_at',  ascending: false },
  occurred_desc: { column: 'occurred_at', ascending: false, nullsFirst: false },
  occurred_asc:  { column: 'occurred_at', ascending: true,  nullsFirst: false },
  intensity_desc:{ column: 'intensity',   ascending: false },
  intensity_asc: { column: 'intensity',   ascending: true  },
  belief_desc:   { column: 'belief',      ascending: false },
  belief_asc:    { column: 'belief',      ascending: true  },
  title_asc:     { column: 'title',       ascending: true  },
};

export async function list(opts = {}) {
  const {
    query = '',
    status = 'active',
    type,
    mood,
    categoryId,
    tagIds = [],
    intensityMin,
    intensityMax,
    beliefMin,
    beliefMax,
    dateFrom,
    dateTo,
    pinnedFirst = true,
    pinnedOnly = false,
    sort = 'created_desc',
    page = 1,
    pageSize = 24,
    withTags = true,
    withCount = true,
  } = opts;

  const supabase = getSupabase();

  // Restrict by tags
  let restrictIds = null;
  if (tagIds.length) {
    const { data: links, error: lErr } = await supabase
      .from(T_LINKS)
      .select('lie_id')
      .in('tag_id', tagIds);
    if (lErr) throw lErr;
    restrictIds = [...new Set((links || []).map((r) => r.lie_id))];
    if (!restrictIds.length) {
      return { items: [], total: 0, page, pageSize, hasMore: false };
    }
  }

  let q = supabase.from(T_LIES).select('*', { count: withCount ? 'exact' : undefined });

  // 🛡️ FIXED: Ignore 'all' strings from the UI
  if (status && status !== 'all') q = q.eq('status', status);
  if (type && type !== 'all') q = q.eq('type', type);
  if (mood && mood !== 'all') q = q.eq('mood', mood);
  if (categoryId) q = q.eq('category_id', categoryId);
  
  // 🛡️ FIXED: Added pinnedOnly
  if (pinnedOnly) q = q.eq('is_pinned', true);

  if (intensityMin !== undefined && intensityMin !== null) q = q.gte('intensity', intensityMin);
  if (intensityMax !== undefined && intensityMax !== null) q = q.lte('intensity', intensityMax);
  if (beliefMin !== undefined && beliefMin !== null) q = q.gte('belief', beliefMin);
  if (beliefMax !== undefined && beliefMax !== null) q = q.lte('belief', beliefMax);
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo) q = q.lte('created_at', dateTo);
  if (restrictIds) q = q.in('id', restrictIds);

  if (query && query.trim()) {
    const safe = query.trim().replace(/[%_]/g, '\\$&');
    const like = `%${safe}%`;
    q = q.or(`title.ilike.${like},body.ilike.${like},truth.ilike.${like}`);
  }

  const sortDef = SORT_MAP[sort] || SORT_MAP.created_desc;
  if (pinnedFirst && status === 'active') {
    q = q.order('is_pinned', { ascending: false });
  }
  q = q.order(sortDef.column, { ascending: sortDef.ascending, nullsFirst: !!sortDef.nullsFirst });

  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;
  q = q.range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  const rows = data || [];
  let tagsMap = {};
  if (withTags && rows.length) {
    const { data: tlinks, error: tErr } = await supabase
      .from(T_LINKS)
      .select('lie_id, tags(*)')
      .in('lie_id', rows.map((r) => r.id));
    if (!tErr) {
      for (const r of tlinks || []) {
        (tagsMap[r.lie_id] ||= []).push(r.tags);
      }
    }
  }

  const total = count ?? rows.length;
  return {
    items: rows.map((r) => normalize(r, tagsMap)),
    total,
    page,
    pageSize,
    hasMore: from + rows.length < total,
  };
}

export async function getById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(T_LIES).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: links } = await supabase.from(T_LINKS).select('tags(*)').eq('lie_id', id);
  const tagsMap = { [id]: (links || []).map((l) => l.tags).filter(Boolean) };
  return normalize(data, tagsMap);
}

function buildPayload(input) {
  const payload = {};
  if (input.title !== undefined) payload.title = cleanText(input.title, { maxLen: 200, multiline: false });
  if (input.body !== undefined)  payload.body  = cleanText(input.body,  { maxLen: 12000 });
  if (input.truth !== undefined) payload.truth = cleanText(input.truth, { maxLen: 2000 });
  if (input.type !== undefined)  payload.type  = String(input.type);
  if (input.mood !== undefined)  payload.mood  = input.mood ? String(input.mood) : null;
  if (input.intensity !== undefined) payload.intensity = Math.max(0, Math.min(10, Number(input.intensity) || 0));
  if (input.belief !== undefined)    payload.belief    = Math.max(0, Math.min(10, Number(input.belief) || 0));
  if (input.occurredAt !== undefined) payload.occurred_at = input.occurredAt || null;
  if (input.categoryId !== undefined) payload.category_id = input.categoryId || null;
  if (input.isPinned !== undefined)   payload.is_pinned = !!input.isPinned;
  return payload;
}

export async function create(input) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const payload = { user_id: user.id, ...buildPayload(input) };
  if (!payload.title) throw new Error('عنوان الزامی است.');

  const { data, error } = await supabase.from(T_LIES).insert(payload).select('*').single();
  if (error) throw error;

  if (Array.isArray(input.tagIds) && input.tagIds.length) {
    const rows = [...new Set(input.tagIds)].map((tag_id) => ({ lie_id: data.id, tag_id }));
    const { error: linkErr } = await supabase.from(T_LINKS).upsert(rows, { onConflict: 'lie_id,tag_id', ignoreDuplicates: true });
    if (linkErr) console.warn('[lies] tag link failed', linkErr);
  }

  const lie = await getById(data.id);
  bus.emit(EVENTS.LIE_CREATED, lie);
  bus.emit(EVENTS.LIES_REFRESHED);
  return lie;
}

export async function update(id, patch, opts = {}) {
  const supabase = getSupabase();
  const payload = buildPayload(patch);
  if (Object.keys(payload).length) {
    const { error } = await supabase.from(T_LIES).update(payload).eq('id', id);
    if (error) throw error;
  }

  if (Array.isArray(opts.tagIds)) {
    const { error: delErr } = await supabase.from(T_LINKS).delete().eq('lie_id', id);
    if (delErr) throw delErr;
    if (opts.tagIds.length) {
      const rows = [...new Set(opts.tagIds)].map((tag_id) => ({ lie_id: id, tag_id }));
      const { error: insErr } = await supabase.from(T_LINKS).upsert(rows, { onConflict: 'lie_id,tag_id', ignoreDuplicates: true });
      if (insErr) throw insErr;
    }
  }

  const lie = await getById(id);
  bus.emit(EVENTS.LIE_UPDATED, lie);
  bus.emit(EVENTS.LIES_REFRESHED);
  return lie;
}

export async function trash(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LIES).update({ status: 'trashed', trashed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.LIE_DELETED, { id });
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function restore(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LIES).update({ status: 'active', trashed_at: null, archived_at: null }).eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.LIE_RESTORED, { id });
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function archive(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LIES).update({ status: 'archived', archived_at: new Date().toISOString(), trashed_at: null }).eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.LIE_ARCHIVED, { id });
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function unarchive(id) { return restore(id); }

export async function hardDelete(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LIES).delete().eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function togglePin(id, pinned) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LIES).update({ is_pinned: !!pinned }).eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.LIE_UPDATED, { id, isPinned: !!pinned });
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function bulk(ids, action) {
  if (!ids?.length) return 0;
  const supabase = getSupabase();

  if (action === 'trash') {
    const { data, error } = await supabase.rpc('bulk_trash_lies', { ids });
    if (error) throw error;
    bus.emit(EVENTS.LIES_REFRESHED);
    return data ?? 0;
  }
  if (action === 'restore') {
    const { data, error } = await supabase.rpc('bulk_restore_lies', { ids });
    if (error) throw error;
    bus.emit(EVENTS.LIES_REFRESHED);
    return data ?? 0;
  }
  if (action === 'archive') {
    const { data, error } = await supabase.rpc('bulk_archive_lies', { ids });
    if (error) throw error;
    bus.emit(EVENTS.LIES_REFRESHED);
    return data ?? 0;
  }
  if (action === 'hardDelete') {
    const { error } = await supabase.from(T_LIES).delete().in('id', ids);
    if (error) throw error;
    bus.emit(EVENTS.LIES_REFRESHED);
    return ids.length;
  }
  return 0;
}

export async function bulkAddTags(lieIds, tagIds) {
  if (!lieIds?.length || !tagIds?.length) return;
  const supabase = getSupabase();
  const rows = [];
  for (const lie_id of lieIds) for (const tag_id of tagIds) rows.push({ lie_id, tag_id });
  const { error } = await supabase.from(T_LINKS).upsert(rows, { onConflict: 'lie_id,tag_id', ignoreDuplicates: true });
  if (error) throw error;
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function bulkRemoveTags(lieIds, tagIds) {
  if (!lieIds?.length || !tagIds?.length) return;
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LINKS).delete().in('lie_id', lieIds).in('tag_id', tagIds);
  if (error) throw error;
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function bulkSetCategory(lieIds, categoryId) {
  if (!lieIds?.length) return;
  const supabase = getSupabase();
  const { error } = await supabase.from(T_LIES).update({ category_id: categoryId || null }).in('id', lieIds);
  if (error) throw error;
  bus.emit(EVENTS.LIES_REFRESHED);
}

export async function search(query, limit = 8) {
  const q = String(query || '').trim();
  if (!q) return [];
  const supabase = getSupabase();
  const safe = q.replace(/[%_]/g, '\\$&');
  const like = `%${safe}%`;

  const { data, error } = await supabase
    .from(T_LIES)
    .select('id,title,body,type,status,intensity,created_at')
    .eq('status', 'active')
    .or(`title.ilike.${like},body.ilike.${like},truth.ilike.${like}`)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function duplicate(id) {
  const original = await getById(id);
  if (!original) throw new Error('not found');
  return create({
    title: `${original.title} (کپی)`,
    body: original.body,
    truth: original.truth,
    type: original.type,
    mood: original.mood,
    intensity: original.intensity,
    belief: original.belief,
    occurredAt: original.occurredAt,
    categoryId: original.categoryId,
    tagIds: original.tags.map((t) => t.id),
  });
}

export async function counts() {
  const supabase = getSupabase();
  const [a, b, c] = await Promise.all([
    supabase.from(T_LIES).select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from(T_LIES).select('id', { count: 'exact', head: true }).eq('status', 'archived'),
    supabase.from(T_LIES).select('id', { count: 'exact', head: true }).eq('status', 'trashed'),
  ]);
  return {
    active: a.count ?? 0,
    archived: b.count ?? 0,
    trashed: c.count ?? 0,
  };
}

export async function purgeTrash(olderThanDays = 30) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('purge_trash', { older_than_days: olderThanDays });
  if (error) throw error;
  bus.emit(EVENTS.LIES_REFRESHED);
  return data ?? 0;
}

export function localId() { return uuid(); }

export default {
  list, getById, create, update, trash, restore, archive, unarchive,
  hardDelete, togglePin, bulk, bulkAddTags, bulkRemoveTags, bulkSetCategory,
  search, duplicate, counts, purgeTrash,
};