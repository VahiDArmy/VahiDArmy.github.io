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
    // 1. Fetch the tellall and its entries (Without risky joins)
    const { data: tellall, error } = await supabase
      .from('tellalls')
      .select(`
        *,
        person:person_id(id, full_name, job_title, avatar_url),
        entries:tellall_entries(*)
      `)
      .eq('id', id)
      .maybeSingle();
    
    guard(error);
    if (!tellall) return null;

    // 2. Safely fetch the profiles for the author and all entry authors
    const authorIds = new Set([tellall.created_by]);
    (tellall.entries || []).forEach(e => authorIds.add(e.author_id));

    const idsToFetch = Array.from(authorIds).filter(Boolean);
    let profiles = [];
    
    if (idsToFetch.length > 0) {
      const { data: profilesData, error: profError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', idsToFetch);
      
      if (!profError && profilesData) {
        profiles = profilesData;
      }
    }

    // Map profiles to their IDs for easy lookup
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.id] = p; });

    // 3. Attach the author data to the objects
    tellall.author = profileMap[tellall.created_by] || { display_name: 'کاربر', avatar_url: null };
    
    tellall.entries = (tellall.entries || []).map(entry => ({
      ...entry,
      author: profileMap[entry.author_id] || { display_name: 'کاربر', avatar_url: null }
    }));

    return tellall;
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
    
    // Insert the entry
    const { data, error } = await supabase
      .from('tellall_entries')
      .insert({
        tellall_id: tellallId,
        person_id: personId,
        content,
        author_id: session.user.id
      })
      .select()
      .single();
    guard(error);

    // Fetch the author profile for immediate UI update
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', session.user.id)
      .single();

    return {
      ...data,
      author: profile || { display_name: 'کاربر', avatar_url: null }
    };
  }
};

export default tellallsService;