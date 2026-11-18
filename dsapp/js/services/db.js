import { supabase } from '../lib/supabase.js';

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// ---- Projects -------------------------------------------------------------
export async function listProjects() {
  const { data, error } = await supabase
    .from('ds_projects')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject({ name, description = '', fsMode = 'virtual', metadata = {} }) {
  const user_id = await uid();
  const { data, error } = await supabase
    .from('ds_projects')
    .insert({ user_id, name, description, fs_mode: fsMode, metadata })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProject(id) {
  const { data, error } = await supabase.from('ds_projects').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updateProject(id, patch) {
  const { data, error } = await supabase.from('ds_projects').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProject(id) {
  const { error } = await supabase.from('ds_projects').delete().eq('id', id);
  if (error) throw error;
}

// ---- Memory ---------------------------------------------------------------
export async function listMemory(projectId, limit = 200) {
  const { data, error } = await supabase
    .from('ds_project_memory')
    .select('*')
    .eq('project_id', projectId)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function addMemory(projectId, { kind = 'note', content, importance = 1 }) {
  const user_id = await uid();
  const { data, error } = await supabase
    .from('ds_project_memory')
    .insert({ project_id: projectId, user_id, kind, content, importance })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemory(id) {
  const { error } = await supabase.from('ds_project_memory').delete().eq('id', id);
  if (error) throw error;
}

// ---- Roadmap --------------------------------------------------------------
export async function listRoadmap(projectId) {
  const { data, error } = await supabase
    .from('ds_roadmap_items')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertRoadmapItem(projectId, item) {
  const user_id = await uid();
  const payload = {
    project_id: projectId,
    user_id,
    phase: item.phase || 'General',
    title: item.title,
    description: item.description || '',
    status: item.status || 'pending',
    order_index: item.order_index ?? 0,
    dependencies: item.dependencies || [],
  };
  if (item.id) payload.id = item.id;
  const { data, error } = await supabase
    .from('ds_roadmap_items')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRoadmapItem(id) {
  const { error } = await supabase.from('ds_roadmap_items').delete().eq('id', id);
  if (error) throw error;
}

// ---- Tasks ----------------------------------------------------------------
export async function createTask(projectId, { title, description = '', model }) {
  const user_id = await uid();
  const { data, error } = await supabase
    .from('ds_tasks')
    .insert({ project_id: projectId, user_id, title, description, model, status: 'running' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from('ds_tasks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function listTasks(projectId, limit = 50) {
  const { data, error } = await supabase
    .from('ds_tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function findInterruptedTasks(projectId) {
  const { data, error } = await supabase
    .from('ds_tasks')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'running');
  if (error) throw error;
  return data ?? [];
}

// ---- Operations -----------------------------------------------------------
export async function logOperation(projectId, { taskId, toolName, args, result, status = 'success' }) {
  const user_id = await uid();
  const { data, error } = await supabase
    .from('ds_tool_operations')
    .insert({
      project_id: projectId,
      user_id,
      task_id: taskId,
      tool_name: toolName,
      arguments: args ?? {},
      result: result ?? {},
      status,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listOperations(projectId, limit = 100) {
  const { data, error } = await supabase
    .from('ds_tool_operations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ---- Messages -------------------------------------------------------------
export async function listMessages(projectId, limit = 200) {
  const { data, error } = await supabase
    .from('ds_messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function addMessage(projectId, { role, content, toolCalls = null }) {
  const user_id = await uid();
  const { data, error } = await supabase
    .from('ds_messages')
    .insert({ project_id: projectId, user_id, role, content, tool_calls: toolCalls })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- App state ------------------------------------------------------------
export async function getAppState(projectId) {
  const { data, error } = await supabase
    .from('ds_app_state')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setAppState(projectId, patch) {
  const user_id = await uid();
  const existing = await getAppState(projectId);
  if (existing) {
    const { data, error } = await supabase
      .from('ds_app_state')
      .update({ ...patch, user_id })
      .eq('project_id', projectId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('ds_app_state')
    .insert({ project_id: projectId, user_id, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Checkpoints ----------------------------------------------------------
export async function createCheckpointRow(projectId, { id, label, fileCount }) {
  const user_id = await uid();
  const payload = { project_id: projectId, user_id, label, file_count: fileCount ?? 0 };
  if (id) payload.id = id;
  const { data, error } = await supabase
    .from('ds_checkpoints')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCheckpointRows(projectId) {
  const { data, error } = await supabase
    .from('ds_checkpoints')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteCheckpointRow(id) {
  const { error } = await supabase.from('ds_checkpoints').delete().eq('id', id);
  if (error) throw error;
}
