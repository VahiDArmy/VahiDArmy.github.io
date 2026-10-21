/**
 * Tellalls (بگایی‌ها) Service
 * Handles data fetching and mutations for the tellalls and tellall_entries tables.
 */

import { supabase, requireSession } from './supabase.client.js';
import { friendlyError } from '../utils/format.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const tellallsService = {
  /** Fetch tellalls related to a specific person */
  async getByPersonId(personId) {
    const { data, error } = await supabase
      .from('tellalls')
      .select('id, title, description, created_at, created_by, person_id')
      .eq('person_id', personId)
      .order('created_at', { ascending: false });
    
    guard(error);
    return data || [];
  },

  /** Fetch a single tellall by ID with its entries */
  async getById(id) {
    const { data, error } = await supabase
      .from('tellalls')
      .select(`
        *,
        author:created_by(display_name, avatar_url),
        person:person_id(id, full_name, job_title, avatar_url),
        entries:tellall_entries(*, author:author_id(display_name, avatar_url))
      `)
      .eq('id', id)
      .maybeSingle();
    
    guard(error);
    return data;
  },

  /** Create a new tellall */
  async create(payload) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from('tellalls')
      .insert({ ...payload, created_by: session.user.id })
      .select()
      .single();
    
    guard(error);
    return data;
  }
};

export default tellallsService;