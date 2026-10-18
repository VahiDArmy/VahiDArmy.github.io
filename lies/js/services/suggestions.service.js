/* ============================================================
   js/services/suggestions.service.js
   COMPLETE FILE - NO TRUNCATION.
   Handles anon submission and authenticated fetching.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { TABLES } from '../config/constants.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';

const T_SUGGESTIONS = TABLES.SUGGESTIONS;

function normalize(row) {
  if (!row) return null;
  return {
    id: row.id,
    targetUserId: row.target_user_id,
    suggestedText: row.suggested_text,
    suggesterName: row.suggester_name,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Submit a suggestion (Called by Anon users).
 * Uses the RPC function to bypass RLS safely.
 */
export async function submitAnon(token, text, name = '') {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('submit_suggestion', {
    p_token: token,
    p_text: text,
    p_name: name,
  });
  if (error) throw error;
  return data;
}

/**
 * Fetch pending suggestions (Called by Auth user).
 */
export async function getPending() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(T_SUGGESTIONS)
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(normalize);
}

/**
 * Mark a suggestion as accepted (Usually after converting it to a Lie).
 */
export async function acceptSuggestion(id) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(T_SUGGESTIONS)
    .update({ status: 'accepted' })
    .eq('id', id);
  
  if (error) throw error;
  bus.emit(EVENTS.SUGGESTION_ACCEPTED, { id });
}

/**
 * Mark a suggestion as rejected.
 */
export async function rejectSuggestion(id) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(T_SUGGESTIONS)
    .update({ status: 'rejected' })
    .eq('id', id);
  
  if (error) throw error;
  bus.emit(EVENTS.SUGGESTION_REJECTED, { id });
}

/**
 * Delete a suggestion permanently.
 */
export async function deleteSuggestion(id) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from(T_SUGGESTIONS)
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

/**
 * Get current share token for the user.
 */
export async function getShareToken() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from(TABLES.PROFILES)
    .select('share_token')
    .eq('user_id', user.id)
    .single();
    
  if (error) throw error;
  return data.share_token;
}

/**
 * Regenerate share token (Invalidates old links).
 */
export async function regenerateShareToken() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  
  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from(TABLES.PROFILES)
    .update({ share_token: newToken })
    .eq('user_id', user.id);
    
  if (error) throw error;
  return newToken;
}