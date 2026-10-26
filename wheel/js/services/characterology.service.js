/**
 * Characterology (Personality) Service
 * Handles scenarios and their answers.
 */

import { supabase, requireSession } from './supabase.client.js';
import { friendlyError } from '../utils/format.js';

function guard(error) {
  if (error) throw Object.assign(new Error(friendlyError(error)), { cause: error });
}

export const characterologyService = {
  /* ================= SCENARIOS ================= */

  async listScenarios({ search = '', limit = 20, offset = 0 } = {}) {
    let q = supabase.from('scenarios').select('*, author:author_id(display_name, avatar_url), answers:scenario_answers(count)', { count: 'exact' });
    if (search) q = q.ilike('title', `%${search}%`);
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    
    const { data, error, count } = await q;
    guard(error);
    return { items: data || [], total: count || 0 };
  },

  async getScenarioById(id) {
    const { data, error } = await supabase
      .from('scenarios')
      .select('*, author:author_id(display_name, avatar_url), answers:scenario_answers(count)')
      .eq('id', id)
      .maybeSingle();
    guard(error);
    return data;
  },

  async createScenario(payload) {
    const session = await requireSession();
    const { data, error } = await supabase.from('scenarios').insert({ ...payload, author_id: session.user.id }).select().single();
    guard(error);
    return data;
  },

  async updateScenario(id, patch) {
    await requireSession();
    const { data, error } = await supabase.from('scenarios').update(patch).eq('id', id).select().single();
    guard(error);
    return data;
  },

  async removeScenario(id) {
    await requireSession();
    const { error } = await supabase.from('scenarios').delete().eq('id', id);
    guard(error);
    return true;
  },

  /* ================= ANSWERS ================= */

  async listAnswers(scenarioId) {
    const { data, error } = await supabase
      .from('scenario_answers')
      .select('*, author:author_id(display_name, avatar_url), person:person_id(id, full_name, avatar_url, job_title)')
      .eq('scenario_id', scenarioId)
      .order('created_at', { ascending: false });
    guard(error);
    return data || [];
  },

  async addAnswer(scenarioId, personId, content) {
    const session = await requireSession();
    const { data, error } = await supabase
      .from('scenario_answers')
      .insert({ scenario_id: scenarioId, person_id: personId, content, author_id: session.user.id })
      .select()
      .single();
    guard(error);
    return data;
  },

  async updateAnswer(id, content) {
    await requireSession();
    const { data, error } = await supabase.from('scenario_answers').update({ content }).eq('id', id).select().single();
    guard(error);
    return data;
  },

  async removeAnswer(id) {
    await requireSession();
    const { error } = await supabase.from('scenario_answers').delete().eq('id', id);
    guard(error);
    return true;
  }
};

export default characterologyService;