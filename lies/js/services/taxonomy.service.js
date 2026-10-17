/* ============================================================
   js/services/taxonomy.service.js
   Manages Lie Types and Moods dynamically from the database.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { TABLES } from '../config/constants.js';
import { cleanText } from '../utils/sanitize.js';
import { bus } from '../core/event-bus.js';

const T_TYPES = 'lie_types';
const T_MOODS = 'moods';

// ── Lie Types ─────────────────────────────────────────────

function normalizeType(row) {
  if (!row) return null;
  return {
    id: row.id, // In DB it's UUID, in UI we might need string
    userId: row.user_id,
    label: row.name,
    description: row.description || '',
    example: row.example || '',
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

export async function listTypes() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(T_TYPES).select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeType);
}

export async function createType(input) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const payload = {
    user_id: user.id,
    name: cleanText(input.name, { maxLen: 60, multiline: false }),
    description: cleanText(input.description || '', { maxLen: 300 }),
    example: cleanText(input.example || '', { maxLen: 300 }),
    icon: input.icon || '✳️',
    color: input.color || '#7c5cff',
    sort_order: Number(input.sortOrder) || 0,
  };

  const { data, error } = await supabase.from(T_TYPES).insert(payload).select('*').single();
  if (error) throw error;
  
  bus.emit('taxonomy:updated');
  return normalizeType(data);
}

export async function updateType(id, patch) {
  const supabase = getSupabase();
  const payload = {};
  if (patch.name !== undefined) payload.name = cleanText(patch.name, { maxLen: 60, multiline: false });
  if (patch.description !== undefined) payload.description = cleanText(patch.description, { maxLen: 300 });
  if (patch.example !== undefined) payload.example = cleanText(patch.example, { maxLen: 300 });
  if (patch.icon !== undefined) payload.icon = String(patch.icon).slice(0, 4);
  if (patch.color !== undefined) payload.color = String(patch.color);
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder) || 0;

  const { data, error } = await supabase.from(T_TYPES).update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  
  bus.emit('taxonomy:updated');
  return normalizeType(data);
}

export async function deleteType(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_TYPES).delete().eq('id', id);
  if (error) throw error;
  bus.emit('taxonomy:updated');
}

// ── Moods ─────────────────────────────────────────────────

function normalizeMood(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.name,
    description: row.description || '',
    icon: row.icon,
    sortOrder: row.sort_order,
  };
}

export async function listMoods() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(T_MOODS).select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeMood);
}

export async function createMood(input) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const payload = {
    user_id: user.id,
    name: cleanText(input.name, { maxLen: 60, multiline: false }),
    description: cleanText(input.description || '', { maxLen: 300 }),
    icon: input.icon || '😐',
    sort_order: Number(input.sortOrder) || 0,
  };

  const { data, error } = await supabase.from(T_MOODS).insert(payload).select('*').single();
  if (error) throw error;
  
  bus.emit('taxonomy:updated');
  return normalizeMood(data);
}

export async function updateMood(id, patch) {
  const supabase = getSupabase();
  const payload = {};
  if (patch.name !== undefined) payload.name = cleanText(patch.name, { maxLen: 60, multiline: false });
  if (patch.description !== undefined) payload.description = cleanText(patch.description, { maxLen: 300 });
  if (patch.icon !== undefined) payload.icon = String(patch.icon).slice(0, 4);
  if (patch.sortOrder !== undefined) payload.sort_order = Number(patch.sortOrder) || 0;

  const { data, error } = await supabase.from(T_MOODS).update(payload).eq('id', id).select('*').single();
  if (error) throw error;
  
  bus.emit('taxonomy:updated');
  return normalizeMood(data);
}

export async function deleteMood(id) {
  const supabase = getSupabase();
  const { error } = await supabase.from(T_MOODS).delete().eq('id', id);
  if (error) throw error;
  bus.emit('taxonomy:updated');
}

export default {
  listTypes, createType, updateType, deleteType,
  listMoods, createMood, updateMood, deleteMood
};