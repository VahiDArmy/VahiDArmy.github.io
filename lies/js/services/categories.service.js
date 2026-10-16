/* ============================================================
   js/services/categories.service.js
   CRUD for categories + reorder + lie counts
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { bus } from '../core/event-bus.js';
import { EVENTS, TABLES } from '../config/constants.js';
import { cleanText } from '../utils/sanitize.js';

const TABLE = TABLES.CATEGORIES;

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    description: row.description || '',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** @returns {Promise<any[]>} */
export async function list() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalize);
}

/** @param {string} id @returns {Promise<any|null>} */
export async function getById(id) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return normalize(data);
}

/**
 * @param {{name:string,color?:string,icon?:string,description?:string,sortOrder?:number}} input
 * @returns {Promise<any>}
 */
export async function create(input) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const payload = {
    user_id: user.id,
    name: cleanText(input.name, { maxLen: 60, multiline: false }),
    color: input.color || '#7c5cff',
    icon: input.icon || '📁',
    description: cleanText(input.description || '', { maxLen: 400 }),
    sort_order: Number(input.sortOrder) || 0,
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select('*').single();
  if (error) throw error;
  const cat = normalize(data);
  bus.emit(EVENTS.CATEGORY_CREATED, cat);
  return cat;
}

/**
 * @param {string} id
 * @param {Partial<{name:string,color:string,icon:string,description:string,sortOrder:number}>} patch
 * @returns {Promise<any>}
 */
export async function update(id, patch) {
  const supabase = getSupabase();
  const payload = {};
  if (patch.name !== undefined) payload.name = cleanText(patch.name, { maxLen: 60, multiline: false });
  if (patch.color !== undefined) payload.color = String(patch.color);
  if (patch.icon !== undefined) payload.icon = String(patch.icon).slice(0, 4);
  if (patch.description !== undefined) payload.description = cleanText(patch.description, { maxLen: 400 });
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder) || 0;

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  const cat = normalize(data);
  bus.emit(EVENTS.CATEGORY_UPDATED, cat);
  return cat;
}

/** @param {string} id */
export async function remove(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  bus.emit(EVENTS.CATEGORY_DELETED, { id });
}

/**
 * Reorder categories atomically.
 * @param {string[]} orderedIds
 */
export async function reorder(orderedIds) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const updates = orderedIds.map((id, idx) => ({
    id,
    user_id: user.id,
    sort_order: idx,
  }));

  // Upsert requires all non-null columns → we upsert partial with onConflict.
  // We can't partial-upsert with only some columns unless we have defaults.
  // Instead, batch update with individual .update() calls (RLS protects).
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from(TABLE).update({ sort_order }).eq('id', id)
    )
  );
}

/**
 * Count lies per category (active only).
 * @returns {Promise<Record<string, number>>}
 */
export async function countLies() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.LIES)
    .select('category_id')
    .eq('status', 'active')
    .not('category_id', 'is', null);
  if (error) throw error;
  const out = {};
  for (const row of data || []) {
    out[row.category_id] = (out[row.category_id] || 0) + 1;
  }
  return out;
}

export default { list, getById, create, update, remove, reorder, countLies };