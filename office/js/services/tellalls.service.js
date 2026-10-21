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
      .select('id, title, description, created_at, created_by, person_id, people:person_id(full_name)')
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

  /** Create a new tellall and its first entry */
  async create(payload) {
    const session = await requireSession();
    
    // 1. Insert into tellalls
    const { data: tellallData, error: tellallError } = await supabase
      .from('tellalls')
      .insert({ 
        title: payload.title,
        description: payload.description,
        person_id: payload.person_id,
        related_people: payload.related_people || [],
        created_by: session.user.id 
      })
      .select()
      .single();
    
    guard(tellallError);

    // 2. Insert first entry into tellall_entries if content is provided
    if (payload.first_entry_content) {
      const { error: entryError } = await supabase
        .from('tellall_entries')
        .insert({
          tellall_id: tellallData.id,
          person_id: payload.person_id,
          content: payload.first_entry_content,
          author_id: session.user.id
        });
      
      guard(entryError);
    }
    
    return tellallData;
  }
};

export default tellallsService;