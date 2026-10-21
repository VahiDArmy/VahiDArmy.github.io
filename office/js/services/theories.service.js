/**
 * Theories service — user-submitted theories about office people/events,
 * with voting and comments.
 */

import { supabase, requireSession } from './supabase.client.js';
import { TABLES } from '../config/supabase.config.js';
import { friendlyError } from '../utils/format.js';
import { DEFAULT_PAGE_SIZE } from '../config/constants.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

const LIST_COLUMNS =
  'id, title, slug, summary, status, related_people, tags, score, votes_count, comments_count, author_id, created_at, updated_at';

export const theoriesService = {
  async list({
    search = '',
    status = 'published',
    sort = 'created_at',
    direction = 'desc',
    tag = '',
    personId = '',
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  } = {}) {
    let q = supabase.from(TABLES.THEORIES).select(LIST_COLUMNS, { count: 'exact' });

    if (status && status !== 'all') q = q.eq('status', status);
    if (tag) q = q.contains('tags', [tag]);
    if (personId) q = q.contains('related_people', [personId]);
    if (search) q = q.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);

    q = q.order(sort, { ascending: direction !== 'desc' });
    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async getById(id) {
    const { data, error } = await supabase
      .from(TABLES.THEORIES)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async create(payload) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.THEORIES)
      .insert({ ...payload, author_id: session.user.id })
      .select()
      .single();
    guard(error);
    return data;
  },

  async update(id, patch) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.THEORIES)
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async remove(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.THEORIES).delete().eq('id', id);
    guard(error);
    return true;
  },

  async vote(theoryId, value) {
    const session = await requireSession();
    if (![1, -1, 0].includes(value)) throw new Error('invalid vote');

    if (value === 0) {
      const { error } = await supabase
        .from(TABLES.THEORY_VOTES)
        .delete()
        .eq('theory_id', theoryId)
        .eq('user_id', session.user.id);
      guard(error);
    } else {
      const { error } = await supabase
        .from(TABLES.THEORY_VOTES)
        .upsert(
          { theory_id: theoryId, user_id: session.user.id, value },
          { onConflict: 'theory_id,user_id' }
        );
      guard(error);
    }

    const { data: theory, error: readErr } = await supabase
      .from(TABLES.THEORIES)
      .select('id, score, votes_count')
      .eq('id', theoryId)
      .maybeSingle();
    guard(readErr);
    return theory;
  },

  async myVote(theoryId) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.THEORY_VOTES)
      .select('value')
      .eq('theory_id', theoryId)
      .eq('user_id', session.user.id)
      .maybeSingle();
    guard(error);
    return data?.value || 0;
  },

  async listComments(theoryId) {
    const { data, error } = await supabase
      .from(TABLES.THEORY_COMMENTS)
      .select('id, body, author_id, created_at, profiles:author_id(display_name, avatar_url)')
      .eq('theory_id', theoryId)
      .order('created_at', { ascending: true });
    guard(error);
    return data || [];
  },

  async addComment(theoryId, body) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from(TABLES.THEORY_COMMENTS)
      .insert({ theory_id: theoryId, body, author_id: session.user.id })
      .select()
      .single();
    guard(error);
    return data;
  },

  async updateComment(id, body) {
    await requireSession();
    const { data, error } = await supabase
      .from(TABLES.THEORY_COMMENTS)
      .update({ body })
      .eq('id', id)
      .select()
      .single();
    guard(error);
    return data;
  },

  async deleteComment(id) {
    await requireSession();
    const { error } = await supabase.from(TABLES.THEORY_COMMENTS).delete().eq('id', id);
    guard(error);
    return true;
  },
};

export default theoriesService;