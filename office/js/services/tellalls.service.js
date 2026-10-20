/**
 * Tell-alls service — "بگایی‌های داده شده"
 * Manages subjects (tellalls) and their text box entries.
 */

import { supabase, requireSession } from './supabase.client.js';
import { TABLES } from '../config/supabase.config.js';
import { friendlyError } from '../utils/format.js';
import { DEFAULT_PAGE_SIZE } from '../config/constants.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const tellallsService = {
  async list({ search = '', limit = DEFAULT_PAGE_SIZE, offset = 0 } = {}) {
    let q = supabase
      .from(TABLES.TELLALLS)
      .select('id, title, description, entries_count, created_by, created_at', { count: 'exact' });
    
    if (search) q = q.ilike('title', `%${search}%`);
    
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    
    const { data, error, count } = await q;
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLES.TELLALLS)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async create(payload) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.TELLALLS)
      .insert({ ...payload, created_by: session.user.id })
      .select()
      .single();
    guard(error);
    return data;
  },

  async update(id, patch) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.TELLALLS)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async remove(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.TELLALLS).delete().eq('id', id);
    guard(error);
    return true;
  },

  /* ---- Entries ---- */

  async listEntries(tellallId) {
    const { data, error } = await supabase
      .from(TABLES.TELLALL_ENTRIES)
      .select(`
        id, title, content, author_id, created_at,
        profiles:author_id (display_name, avatar_url)
      `)
      .eq('tellall_id', tellallId)
      .order('created_at', { ascending: true });
    guard(error);
    return data || [];
  },

  async addEntry(tellallId, { title, content }) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.TELLALL_ENTRIES)
      .insert({
        tellall_id: tellallId,
        title: title || null,
        content,
        author_id: session.user.id,
      })
      .select(`
        id, title, content, author_id, created_at,
        profiles:author_id (display_name, avatar_url)
      `)
      .single();
    guard(error);
    return data;
  },

  async updateEntry(id, { title, content }) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.TELLALL_ENTRIES)
      .update({ title: title || null, content })
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async removeEntry(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.TELLALL_ENTRIES).delete().eq('id', id);
    guard(error);
    return true;
  },
};

export default tellallsService;