// Supabase data access. Every call is scoped by RLS server-side; we still send
// user_id on inserts so the policy check passes.
import { supabase } from './supabase.js';
import { TABLE, DEFAULT_SETTINGS } from './config.js';

function fail(error, context) {
  const err = new Error(`${context}: ${error.message || 'unknown error'}`);
  err.cause = error;
  err.code = error.code;
  err.details = error.details;
  err.hint = error.hint;
  throw err;
}

const isMissingTable = (error) =>
  error &&
  (error.code === '42P01' ||
    /does not exist/i.test(error.message || '') ||
    /schema cache/i.test(error.message || ''));

export async function checkSetup() {
  const { error } = await supabase.from(TABLE.profiles).select('id').limit(1);
  if (!error) return { ok: true };
  if (isMissingTable(error)) return { ok: false, error };
  // Permission denied / RLS errors mean the table exists.
  return { ok: true };
}

export async function ensureProfile(user) {
  const { data, error } = await supabase
    .from(TABLE.profiles)
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw Object.assign(new Error('missing-tables'), { missingTables: true });
    fail(error, 'Could not load your profile');
  }
  if (data) return data;

  const meta = user.user_metadata || {};
  const row = {
    id: user.id,
    email: user.email || null,
    display_name: meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Explorer'),
    settings: {},
  };
  const { data: created, error: createError } = await supabase
    .from(TABLE.profiles)
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (createError) fail(createError, 'Could not create your profile');
  return created;
}

export function mergeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return { ...DEFAULT_SETTINGS, ...src };
}

export async function saveProfile(userId, patch) {
  const { data, error } = await supabase
    .from(TABLE.profiles)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) fail(error, 'Could not save profile');
  return data;
}

export async function saveSettings(userId, settings) {
  return saveProfile(userId, { settings });
}

export async function saveKey(userId, key) {
  return saveProfile(userId, { openrouter_key: key });
}

/* ------------------------------ conversations ----------------------------- */

export async function listConversations(userId) {
  const { data, error } = await supabase
    .from(TABLE.conversations)
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('last_message_at', { ascending: false })
    .limit(600);
  if (error) fail(error, 'Could not load conversations');
  return data || [];
}

export async function getConversation(id) {
  const { data, error } = await supabase.from(TABLE.conversations).select('*').eq('id', id).maybeSingle();
  if (error) fail(error, 'Could not load conversation');
  return data;
}

export async function createConversation(userId, patch = {}) {
  const row = {
    user_id: userId,
    title: 'New chat',
    model_id: null,
    ...patch,
  };
  const { data, error } = await supabase.from(TABLE.conversations).insert(row).select().single();
  if (error) fail(error, 'Could not create conversation');
  return data;
}

export async function updateConversation(id, patch) {
  const { data, error } = await supabase
    .from(TABLE.conversations)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error, 'Could not update conversation');
  return data;
}

export async function touchConversation(id, at = new Date().toISOString()) {
  const { error } = await supabase.from(TABLE.conversations).update({ last_message_at: at }).eq('id', id);
  if (error) console.warn('touchConversation failed', error.message);
}

export async function deleteConversation(id) {
  const { error } = await supabase.from(TABLE.conversations).delete().eq('id', id);
  if (error) fail(error, 'Could not delete conversation');
}

/* -------------------------------- messages -------------------------------- */

export async function listMessages(conversationId) {
  const { data, error } = await supabase
    .from(TABLE.messages)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(2000);
  if (error) fail(error, 'Could not load messages');
  return data || [];
}

export async function insertMessage(row) {
  const { data, error } = await supabase.from(TABLE.messages).insert(row).select().single();
  if (error) fail(error, 'Could not save message');
  return data;
}

export async function patchMessage(id, patch) {
  const { data, error } = await supabase
    .from(TABLE.messages)
    .update(patch)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error, 'Could not update message');
  return data;
}

export async function deleteMessage(id) {
  const { error } = await supabase.from(TABLE.messages).delete().eq('id', id);
  if (error) fail(error, 'Could not delete message');
}

export async function deleteMessages(ids) {
  if (!ids.length) return;
  const { error } = await supabase.from(TABLE.messages).delete().in('id', ids);
  if (error) fail(error, 'Could not delete messages');
}

/* --------------------------------- models --------------------------------- */

export async function listModels(userId) {
  const { data, error } = await supabase
    .from(TABLE.models)
    .select('*')
    .eq('user_id', userId)
    .order('favorite', { ascending: false })
    .order('name', { ascending: true })
    .limit(2000);
  if (error) fail(error, 'Could not load models');
  return data || [];
}

export async function insertModelRows(rows) {
  if (!rows.length) return;
  const chunkSize = 120;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(TABLE.models).insert(chunk);
    if (error) fail(error, 'Could not import models');
  }
}

export async function updateModel(userId, modelId, patch) {
  const { data, error } = await supabase
    .from(TABLE.models)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('model_id', modelId)
    .select()
    .maybeSingle();
  if (error) fail(error, 'Could not update model');
  return data;
}

export async function updateModelRows(userId, rows) {
  if (!rows.length) return;
  const chunkSize = 20;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await Promise.all(
      rows.slice(i, i + chunkSize).map((row) =>
        supabase
          .from(TABLE.models)
          .update(row.patch)
          .eq('user_id', userId)
          .eq('model_id', row.model_id),
      ),
    );
  }
}

/* --------------------------------- prompts -------------------------------- */

export async function listPrompts(userId) {
  const { data, error } = await supabase
    .from(TABLE.prompts)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) fail(error, 'Could not load prompt library');
  return data || [];
}

export async function createPrompt(userId, title, body) {
  const { data, error } = await supabase
    .from(TABLE.prompts)
    .insert({ user_id: userId, title, body })
    .select()
    .single();
  if (error) fail(error, 'Could not save prompt');
  return data;
}

export async function deletePrompt(id) {
  const { error } = await supabase.from(TABLE.prompts).delete().eq('id', id);
  if (error) fail(error, 'Could not delete prompt');
}

/* ---------------------------------- stats --------------------------------- */

export async function loadUsage(userId) {
  const { data, error } = await supabase
    .from(TABLE.messages)
    .select('model, total_tokens, prompt_tokens, completion_tokens, created_at, role')
    .eq('user_id', userId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) fail(error, 'Could not load usage stats');
  return data || [];
}

export async function deleteAllConversations(userId) {
  const { error } = await supabase.from(TABLE.conversations).delete().eq('user_id', userId);
  if (error) fail(error, 'Could not delete conversations');
}
