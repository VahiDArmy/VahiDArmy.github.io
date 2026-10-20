/**
 * Profiles service — per-user profile rows (mirrors auth.users).
 */

import { supabase } from './supabase.client.js';
import { friendlyError } from '../utils/format.js';
import { TABLES } from '../config/supabase.config.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const profilesService = {
  async getById(id) {
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async update(id, patch) {
    const { data, error } = await supabase
      .from(TABLES.PROFILES)
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    guard(error);
    return data;
  },

  async list({ search = '', limit = 50, offset = 0 } = {}) {
    let query = supabase
      .from(TABLES.PROFILES)
      .select('*', { count: 'exact' })
      .order('display_name', { ascending: true })
      .range(offset, offset + limit - 1);
    if (search) query = query.ilike('display_name', `%${search}%`);
    const { data, error, count } = await query;
    guard(error);
    return { items: data || [], total: count || 0 };
  },
};

export default profilesService;