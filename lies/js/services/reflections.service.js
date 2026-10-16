/* ============================================================
   js/services/reflections.service.js
   Reflections attached to a lie
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { bus } from '../core/event-bus.js';
import { EVENTS, TABLES } from '../config/constants.js';
import { cleanText } from '../utils/sanitize.js';

const TABLE = TABLES.REFLECTIONS;

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    lieId: row.lie_id,
    userId: row.user_id,
    body: row.body,
    mood: row.mood,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** @param {string} lieId */
export async function listForLie(lieId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('lie_id', lieId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

/**
 * @param {string} lieId
 * @param {{body:string, mood?:string}} input
 */
export async function create(lieId, input) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const payload = {
    lie_id: lieId,
    user_id: user.id,
    body: cleanText(input.body, { maxLen: 4000 }),
    mood: input.mood || null,
  };
  if (!payload.body) throw new Error('متن بازتاب الزامی است.');

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single();
  if (error) throw error;
  const refl = normalize(data);
  bus.emit(EVENTS.REFLECTION_CREATED, refl);
  return refl;
}

/** @param {string} id @param {{body?:string, mood?:string}} patch */
export async function update(id, patch) {
  const supabase = getSupabase();
  const payload = {};
  if (patch.body !== undefined) payload.body = cleanText(patch.body, { maxLen: 4000 });
  if (patch.mood !== undefined) payload.mood = patch.mood || null;

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  const refl = normalize(data);
  bus.emit(EVENTS.REFLECTION_CREATED, refl);
  return refl;
}

/** @param {string} id */
export async function remove(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.REFLECTION_DELETED, { id });
}

/**
 * Get reflection counts per lie for a set of ids.
 * @param {string[]} lieIds
 * @returns {Promise<Record<string, number>>}
 */
export async function countsForLies(lieIds = []) {
  if (!lieIds.length) return {};
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('lie_id')
    .in('lie_id', lieIds);
  if (error) throw error;
  const out = {};
  for (const r of data || []) out[r.lie_id] = (out[r.lie_id] || 0) + 1;
  return out;
}

export default { listForLie, create, update, remove, countsForLies };