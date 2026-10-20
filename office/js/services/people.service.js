/**
 * People service — office staff (whether or not they joined the site).
 *
 * Row shape (see schema.sql):
 *   id, full_name, slug, job_title, department, status ('in_site'|'not_in_site'|'former'),
 *   bio, avatar_url, email, phone, hire_date, birth_date, manager_id, user_id,
 *   tags[], metadata jsonb, created_by, created_at, updated_at
 */

import { supabase, requireSession } from './supabase.client.js';
import { TABLES } from '../config/supabase.config.js';
import { friendlyError } from '../utils/format.js';
import { DEFAULT_PAGE_SIZE } from '../config/constants.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

const LIST_COLUMNS =
  'id, full_name, slug, job_title, department, status, avatar_url, email, hire_date, tags, created_at, updated_at';

export const peopleService = {
  async list({
    search = '',
    status = 'all',
    department = '',
    sort = 'full_name',
    direction = 'asc',
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  } = {}) {
    let q = supabase
      .from(TABLES.PEOPLE)
      .select(LIST_COLUMNS, { count: 'exact' });

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
    const { data, error } = await supabase
      .from(TABLES.PEOPLE)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async getBySlug(slug) {
    const { data, error } = await supabase
      .from(TABLES.PEOPLE)
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    guard(error);
    return data;
  },

  async create(payload) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.PEOPLE)
      .insert(payload)
      .select()
      .single();
    guard(error);
    return data;
  },

  async update(id, patch) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.PEOPLE)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
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
    const { data, error } = await supabase
      .from(TABLES.PEOPLE)
      .select('department')
      .not('department', 'is', null);
    guard(error);
    const set = new Set();
    for (const row of data || []) if (row.department) set.add(row.department);
    return Array.from(set).sort();
  },

  /** Related data for the person detail page. */
  async related(id) {
    const [theories, stories, projects, links] = await Promise.all([
      supabase
        .from(TABLES.THEORIES)
        .select('id, title, slug, status, created_at')
        .contains('related_people', [id])
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from(TABLES.STORIES)
        .select('id, title, slug, created_at')
        .eq('person_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from(TABLES.PROJECTS)
        .select('id, title, slug, status')
        .contains('member_ids', [id])
        .limit(10),
      supabase
        .from(TABLES.PERSON_LINKS)
        .select('id, kind, label, url, other_person_id')
        .eq('person_id', id),
    ]);
    return {
      theories: theories.data || [],
      stories: stories.data || [],
      projects: projects.data || [],
      links: links.data || [],
    };
  },
};

export default peopleService;