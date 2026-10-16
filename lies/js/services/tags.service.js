/* ============================================================
   js/services/tags.service.js
   CRUD + merge + attach/detach to lies
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { bus } from '../core/event-bus.js';
import { EVENTS, TABLES } from '../config/constants.js';
import { cleanText } from '../utils/sanitize.js';

const T_TAGS = TABLES.TAGS;
const T_LINKS = TABLES.LIE_TAGS;

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** @returns {Promise<any[]>} */
export async function list() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(T_TAGS)
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalize);
}

/** @param {string} id */
export async function getById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(T_TAGS).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return normalize(data);
}

/** @param {{name:string,color?:string}} input */
export async function create(input) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const payload = {
    user_id: user.id,
    name: cleanText(input.name, { maxLen: 40, multiline: false }),
    color: input.color || '#7c5cff',
  };

  const { data, error } = await supabase
    .from(T_TAGS)
    .upsert(payload, { onConflict: 'user_id,name', ignoreDuplicates: false })
    .select('*')
    .single();
  if (error) throw error;
  const tag = normalize(data);
  bus.emit(EVENTS.TAG_CREATED, tag);
  return tag;
}

/** @param {string} id @param {{name?:string,color?:string}} patch */
export async function update(id, patch) {
  const supabase = getSupabase();
  const payload = {};
  if (patch.name !== undefined) payload.name = cleanText(patch.name, { maxLen: 40, multiline: false });
  if (patch.color !== undefined) payload.color = String(patch.color);

  const { data, error } = await supabase.from(T_TAGS).update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  const tag = normalize(data);
  bus.emit(EVENTS.TAG_UPDATED, tag);
  return tag;
}

/** @param {string} id */
export async function remove(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_TAGS).delete().eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.TAG_DELETED, { id });
}

/**
 * Merge tag `fromId` into `toId`: re-link all lies, then delete `fromId`.
 * @param {string} fromId
 * @param {string} toId
 */
export async function merge(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const supabase = getSupabase();

  // Fetch all links of fromId
  const { data: links, error: lErr } = await supabase
    .from(T_LINKS)
    .select('lie_id')
    .eq('tag_id', fromId);
  if (lErr) throw lErr;

  if (links && links.length) {
    const rows = links.map((l) => ({ lie_id: l.lie_id, tag_id: toId }));
    const { error: insErr } = await supabase
      .from(T_LINKS)
      .upsert(rows, { onConflict: 'lie_id,tag_id', ignoreDuplicates: true });
    if (insErr) throw insErr;
  }

  // Remove source tag → its lie_tags cascade
  await remove(fromId);
}

/**
 * Attach tags to a lie (idempotent).
 * @param {string} lieId
 * @param {string[]} tagIds
 */
export async function attachToLie(lieId, tagIds = []) {
  if (!tagIds.length) return;
  const supabase = getSupabase();
  const rows = [...new Set(tagIds)].map((tag_id) => ({ lie_id: lieId, tag_id }));
  const { error } = await supabase
    .from(T_LINKS)
    .upsert(rows, { onConflict: 'lie_id,tag_id', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Replace all tags of a lie with `tagIds`.
 * @param {string} lieId
 * @param {string[]} tagIds
 */
export async function setForLie(lieId, tagIds = []) {
  const supabase = getSupabase();

  const { error: delErr } = await supabase.from(T_LINKS).delete().eq('lie_id', lieId);
  if (delErr) throw delErr;

  if (tagIds.length) await attachToLie(lieId, tagIds);
}

/**
 * Detach tags from a lie.
 * @param {string} lieId
 * @param {string[]} tagIds
 */
export async function detachFromLie(lieId, tagIds = []) {
  if (!tagIds.length) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from(T_LINKS)
    .delete()
    .eq('lie_id', lieId)
    .in('tag_id', tagIds);
  if (error) throw error;
}

/**
 * Get tag counts for active lies.
 * @returns {Promise<Array<{id:string,name:string,color:string,count:number}>>}
 */
export async function withCounts() {
  const supabase = getSupabase();
  const [tagsRes, linksRes] = await Promise.all([
    supabase.from(T_TAGS).select('*').order('name'),
    supabase.from(T_LINKS).select('tag_id, lie_id, lies!inner(status, user_id)').eq('lies.status', 'active'),
  ]);
  if (tagsRes.error) throw tagsRes.error;
  if (linksRes.error) throw linksRes.error;

  const counts = {};
  for (const row of linksRes.data || []) {
    counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
  }

  return (tagsRes.data || []).map((t) => ({
    ...normalize(t),
    count: counts[t.id] || 0,
  }));
}

/**
 * Fetch tags attached to a single lie.
 * @param {string} lieId
 */
export async function forLie(lieId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(T_LINKS)
    .select('tags(*)')
    .eq('lie_id', lieId);
  if (error) throw error;
  return (data || []).map((row) => normalize(row.tags)).filter(Boolean);
}

/**
 * Fetch a map of lieId → tag[] for many lies at once.
 * @param {string[]} lieIds
 * @returns {Promise<Record<string, any[]>>}
 */
export async function forLies(lieIds = []) {
  if (!lieIds.length) return {};
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(T_LINKS)
    .select('lie_id, tags(*)')
    .in('lie_id', lieIds);
  if (error) throw error;
  const out = {};
  for (const row of data || []) {
    const tag = normalize(row.tags);
    if (!tag) continue;
    (out[row.lie_id] ||= []).push(tag);
  }
  return out;
}

export default { list, getById, create, update, remove, merge, attachToLie, setForLie, detachFromLie, withCounts, forLie, forLies };