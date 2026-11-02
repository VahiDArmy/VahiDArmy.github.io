/**
 * People service
 */

import { supabase, requireSession } from './supabase.client.js';
import { TABLES } from '../config/supabase.config.js';
import { friendlyError } from '../utils/format.js';
import { DEFAULT_PAGE_SIZE } from '../config/constants.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

// FIX: Added user_id to the list of fetched columns
const LIST_COLUMNS = 'id, full_name, slug, job_title, department, status, avatar_url, email, hire_date, tags, user_id, created_at, updated_at';

export const peopleService = {
  async list({ search = '', status = 'all', department = '', sort = 'full_name', direction = 'asc', limit = DEFAULT_PAGE_SIZE, offset = 0 } = {}) {
    let q = supabase.from(TABLES.PEOPLE).select(LIST_COLUMNS, { count: 'exact' });
    if (status && status !== 'all') q = q.eq('status', status);
    if (department) q = q.eq('department', department);
    if (search) q = q.or(`full_name.ilike.%${search}%,job_title.ilike.%${search}%,email.ilike.%${search}%`);
    q = q.order(sort, { ascending: direction !== 'desc' });
    q = q.range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async getById(id) {
    const { data, error } = await supabase.from(TABLES.PEOPLE).select('*').eq('id', id).maybeSingle();
    guard(error);
    return data;
  },

  async getByUserId(userId) {
    const { data, error } = await supabase.from(TABLES.PEOPLE).select('*').eq('user_id', userId).maybeSingle();
    guard(error);
    return data;
  },

  async create(payload) {
    const session = await requireSession();
    const { data, error } = await supabase.from(TABLES.PEOPLE).insert({ ...payload, created_by: session.user.id }).select().single();
    guard(error);
    return data;
  },

  async update(id, patch) {
    await requireSession();
    const { data, error } = await supabase.from(TABLES.PEOPLE).update(patch).eq('id', id).select().single();
    guard(error);
    return data;
  },

  async remove(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.PEOPLE).delete().eq('id', id);
    guard(error);
    return true;
  },

  async departments() {
    const { data, error } = await supabase.from(TABLES.PEOPLE).select('department').not('department', 'is', null);
    guard(error);
    const set = new Set();
    for (const row of data || []) if (row.department) set.add(row.department);
    return Array.from(set).sort();
  },

  async related(id) {
    const [theories, stories, projects, links] = await Promise.all([
      supabase.from(TABLES.THEORIES).select('id, title, slug, status, created_at').contains('related_people', [id]).order('created_at', { ascending: false }).limit(10),
      supabase.from(TABLES.STORIES).select('id, title, slug, created_at').eq('person_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from(TABLES.PROJECTS).select('id, title, slug, status').contains('member_ids', [id]).limit(10),
      supabase.from(TABLES.PERSON_LINKS).select('id, kind, label, url, other_person_id').eq('person_id', id),
    ]);
    return {
      theories: theories.data || [],
      stories: stories.data || [],
      projects: projects.data || [],
      links: links.data || [],
    };
  },

  async getUnlinked(search = '') {
    let q = supabase.from(TABLES.PEOPLE).select('id, full_name, job_title, avatar_url, email, department').is('user_id', null);
    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await q.order('full_name').limit(20);
    guard(error);
    return data || [];
  },

  /**
   * Claim an existing unlinked person for the current user.
   * Uses DB function claim_person which correctly merges any
   * previously linked people row into the claimed one (no data loss).
   */
  async linkAccount(personId) {
    await requireSession();
    const { data, error } = await supabase.rpc('claim_person', { person_id: personId });
    guard(error);
    return data;
  },

  /**
   * Admin merge: move all data from source → target, delete source.
   */
  async mergePeople(sourceId, targetId) {
    await requireSession();
    const { error } = await supabase.rpc('merge_people', {
      source_id: sourceId,
      target_id: targetId,
    });
    guard(error);
    return true;
  },

  /**
   * After login/signup: if a people row has the same email and no user_id, claim it.
   */
  async tryAutoLinkByEmail() {
    try {
      await requireSession();
      const { data, error } = await supabase.rpc('try_auto_link_by_email');
      if (error) {
        console.warn('[people] tryAutoLinkByEmail', error);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('[people] tryAutoLinkByEmail', e);
      return null;
    }
  },
};

export default peopleService;