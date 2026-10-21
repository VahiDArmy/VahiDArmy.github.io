/**
 * Tellalls (بگایی‌ها) Service
 */

import { supabase, requireSession } from './supabase.client.js';
import { friendlyError } from '../utils/format.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const tellallsService = {
  async getByPersonId(personId) {
    const { data, error } = await supabase
      .from('tellalls')
      .select('id, title, description, created_at, created_by, person_id, people:person_id(full_name)')
      .eq('person_id', personId)
      .order('created_at', { ascending: false });
    guard(error);
    return data || [];
  },

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

  async create(payload) {
    const session = await requireSession();
    
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
  },

  async addEntry(tellallId, content, personId) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from('tellall_entries')
      .insert({
        tellall_id: tellallId,
        person_id: personId,
        content,
        author_id: session.user.id
      })
      .select(`
        *,
        author:author_id(display_name, avatar_url)
      `)
      .single();
    guard(error);
    return data;
  }
};

export default tellallsService;