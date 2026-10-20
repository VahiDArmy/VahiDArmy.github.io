/**
 * Rankings service — ordered lists of people with a numeric score
 * and optional criteria. Each ranking owns a list of entries.
 */

import { supabase, requireSession } from './supabase.client.js';
import { TABLES } from '../config/supabase.config.js';
import { friendlyError } from '../utils/format.js';
import { DEFAULT_PAGE_SIZE } from '../config/constants.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const rankingsService = {
  async list({ search = '', limit = DEFAULT_PAGE_SIZE, offset = 0 } = {}) {
    let q = supabase
      .from(TABLES.RANKINGS)
      .select('id, title, slug, description, criteria, entries_count, created_by, created_at', { count: 'exact' });
    if (search) q = q.ilike('title', `%${search}%`);
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLES.RANKINGS)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async getEntries(rankingId) {
    const { data, error } = await supabase
      .from(TABLES.RANKING_ENTRIES)
      .select('id, ranking_id, person_id, score, notes, people:person_id(id, full_name, avatar_url, job_title)')
      .eq('ranking_id', rankingId)
      .order('score', { ascending: false });
    guard(error);
    return data || [];
  },

  async create(payload) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.RANKINGS)
      .insert({ ...payload, created_by: session.user.id })
      .select()
      .single();
    guard(error);
    return data;
  },

  async update(id, patch) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.RANKINGS)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async remove(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.RANKINGS).delete().eq('id', id);
    guard(error);
    return true;
  },

  async upsertEntry(rankingId, payload) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.RANKING_ENTRIES)
      .upsert({ ranking_id: rankingId, ...payload }, { onConflict: 'ranking_id,person_id' })
      .select()
      .single();
    guard(error);
    return data;
  },

  async removeEntry(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.RANKING_ENTRIES).delete().eq('id', id);
    guard(error);
    return true;
  },
};

export default rankingsService;