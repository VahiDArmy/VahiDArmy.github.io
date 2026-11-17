/**
 * Project persistence via Supabase.
 * Actual source files live in the FS adapter; this store holds metadata,
 * memory, roadmap, and conversation checkpoints.
 */
import { getSupabase } from '../supabase-client.js';
import { getUser } from '../auth/auth.js';

export async function listProjects() {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('projects')
    .select('id, name, description, updated_at, status')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getProject(id) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject({ name, description = '' }) {
  const user = getUser();
  if (!user) throw new Error('Not signed in');
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('projects')
    .insert({
      user_id: user.id,
      name,
      description,
      memory: {},
      roadmap: { phases: [] },
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id, patch) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('projects')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('projects').delete().eq('id', id);
  if (error) throw error;
}

/** Append a chat / agent message to project history */
export async function appendMessage(projectId, message) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('project_messages')
    .insert({
      project_id: projectId,
      role: message.role,
      content: message.content,
      meta: message.meta || {},
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMessages(projectId, limit = 80) {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('project_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Checkpoint for interruption recovery */
export async function saveCheckpoint(projectId, checkpoint) {
  return updateProject(projectId, {
    checkpoint,
    updated_at: new Date().toISOString(),
  });
}

export async function clearCheckpoint(projectId) {
  return updateProject(projectId, { checkpoint: null });
}
