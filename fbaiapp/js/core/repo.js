// ---------------------------------------------------------------------------
// Data access helpers for app entities. Thin, explicit, easy to swap out.
// ---------------------------------------------------------------------------

import { db, auth } from './db.js';
import { TABLES, DEFAULT_SETTINGS, LIMITS } from '../config.js';
import { uid, truncate } from './util.js';

function client() {
  if (!auth.isSignedIn) throw new Error('Sign in to continue.');
  return db;
}

async function run(promise) {
  try {
    return await promise;
  } catch (err) {
    if (err?.code === 'session_expired' || err?.status === 401) {
      throw new Error('Your session expired. Please sign in again.');
    }
    throw err;
  }
}

export const repo = {
  // ---- projects -----------------------------------------------------------

  async listProjects() {
    return run(client().from(TABLES.projects).select('*').order('updated_at', { ascending: false }));
  },

  async getProject(id) {
    return run(client().from(TABLES.projects).select('*').eq('id', id).maybeSingle());
  },

  async createProject({ name, description = '', stack = '' }) {
    const rows = await run(client().from(TABLES.projects).insert({
      name: name.trim().slice(0, 120) || 'Untitled project',
      description,
      stack,
      storage_mode: 'vault',
    }).select('*'));
    return rows[0];
  },

  async updateProject(id, patch) {
    const rows = await run(client().from(TABLES.projects).update(patch).eq('id', id).select('*'));
    return rows[0];
  },

  async deleteProject(id) {
    await run(client().from(TABLES.projects).delete().eq('id', id));
  },

  async touchProject(id, patch = {}) {
    try {
      await client().from(TABLES.projects).update({ last_opened_at: new Date().toISOString(), ...patch }).eq('id', id);
    } catch { /* non-critical */ }
  },

  // ---- messages -----------------------------------------------------------

  async listMessages(projectId, limit = 120) {
    const rows = await run(client().from(TABLES.messages).select('*')
      .eq('project_id', projectId).order('id', { ascending: false }).limit(limit));
    return rows.reverse();
  },

  async addMessage({ projectId, role, content, kind = 'chat', meta = {}, runId = null }) {
    const rows = await run(client().from(TABLES.messages).insert({
      project_id: projectId,
      role,
      kind,
      content,
      meta,
      run_id: runId,
    }).select('*'));
    return rows[0];
  },

  async deleteMessagesFrom(projectId, id) {
    await run(client().from(TABLES.messages).delete().eq('project_id', projectId).gte('id', id));
  },

  // ---- memory -------------------------------------------------------------

  async getMemory(projectId) {
    const rows = await run(client().from(TABLES.memory).select('*').eq('project_id', projectId));
    const map = {};
    for (const row of rows) map[row.section] = row;
    return map;
  },

  async setMemory(projectId, section, content, source = 'ai') {
    await run(client().from(TABLES.memory).upsert({
      project_id: projectId,
      section,
      content,
      source,
    }, { onConflict: 'project_id,section' }));
  },

  // ---- roadmap ------------------------------------------------------------

  async listTasks(projectId) {
    return run(client().from(TABLES.tasks).select('*')
      .eq('project_id', projectId).order('phase', { ascending: true }).order('sort_index', { ascending: true }));
  },

  async addTask(projectId, { title, detail = '', phase = 'General', status = 'todo', priority = 2, sortIndex }) {
    const rows = await run(client().from(TABLES.tasks).insert({
      project_id: projectId,
      title: truncate(title, 220),
      detail,
      phase,
      status,
      priority,
      sort_index: sortIndex ?? Date.now() % 100000,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    }).select('*'));
    return rows[0];
  },

  async updateTask(id, patch) {
    const payload = { ...patch };
    if (patch.status === 'done') payload.completed_at = new Date().toISOString();
    if (patch.status && patch.status !== 'done') payload.completed_at = null;
    const rows = await run(client().from(TABLES.tasks).update(payload).eq('id', id).select('*'));
    return rows[0];
  },

  async deleteTask(id) {
    await run(client().from(TABLES.tasks).delete().eq('id', id));
  },

  // ---- runs ---------------------------------------------------------------

  async createRun({ projectId, instruction, model }) {
    const id = uid();
    const rows = await run(client().from(TABLES.runs).insert({
      id,
      project_id: projectId,
      instruction,
      model,
      status: 'running',
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    }).select('*'));
    return rows[0];
  },

  async updateRun(id, patch) {
    try {
      await client().from(TABLES.runs).update(patch).eq('id', id);
    } catch (err) {
      console.warn('run update failed', err);
    }
  },

  async heartbeatRun(id, patch = {}) {
    try {
      await client().from(TABLES.runs).update({ heartbeat_at: new Date().toISOString(), ...patch }).eq('id', id);
    } catch { /* best effort */ }
  },

  async getRun(id) {
    return run(client().from(TABLES.runs).select('*').eq('id', id).maybeSingle());
  },

  async listRuns(projectId, limit = 25) {
    return run(client().from(TABLES.runs).select('*')
      .eq('project_id', projectId).order('started_at', { ascending: false }).limit(limit));
  },

  /** Runs left in `running` after a reload/crash are marked interrupted. */
  async reconcileRuns(projectId) {
    const rows = await run(client().from(TABLES.runs).select('*')
      .eq('project_id', projectId).eq('status', 'running').order('started_at', { ascending: false }));
    const now = Date.now();
    const stale = rows.filter((row) => now - new Date(row.heartbeat_at || row.started_at).getTime() > LIMITS.staleRunMs);
    for (const row of stale) {
      await this.updateRun(row.id, {
        status: 'interrupted',
        finished_at: new Date().toISOString(),
        summary: row.summary || 'Interrupted before it finished.',
      });
    }
    return stale;
  },

  async addStep({ runId, projectId, seq, type, name, ok = null, durationMs = 0, input = null, output = null }) {
    try {
      await client().from(TABLES.steps).insert({
        run_id: runId,
        project_id: projectId,
        seq,
        type,
        name,
        ok,
        duration_ms: Math.round(durationMs),
        input: input ? JSON.parse(JSON.stringify(input).slice(0, 20000)) : null,
        output: output ? JSON.parse(JSON.stringify(output).slice(0, 20000)) : null,
      });
    } catch (err) {
      console.warn('step log failed', err);
    }
  },

  async listSteps(runId) {
    return run(client().from(TABLES.steps).select('*').eq('run_id', runId).order('seq', { ascending: true }));
  },

  // ---- checkpoints --------------------------------------------------------

  async saveCheckpointMeta(meta) {
    try {
      await client().from(TABLES.checkpoints).upsert(meta, { onConflict: 'id' });
    } catch (err) {
      console.warn('checkpoint metadata failed', err);
    }
  },

  async markCheckpointRestored(id) {
    try {
      await client().from(TABLES.checkpoints).update({ restored_at: new Date().toISOString() }).eq('id', id);
    } catch { /* non-critical */ }
  },

  // ---- file index ---------------------------------------------------------

  async saveFileIndex(projectId, files) {
    if (!files.length) return;
    await run(client().from(TABLES.files).delete().eq('project_id', projectId));
    const rows = files.slice(0, LIMITS.maxFiles).map((file) => ({
      project_id: projectId,
      path: file.path,
      size: file.size || 0,
      hash: file.hash || '',
      lang: file.lang || '',
      summary: file.summary || '',
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 200) {
      await run(client().from(TABLES.files).upsert(rows.slice(i, i + 200), { onConflict: 'project_id,path' }));
    }
  },

  // ---- settings -----------------------------------------------------------

  async loadSettings() {
    const row = await run(client().from(TABLES.settings).select('*').maybeSingle());
    return { ...DEFAULT_SETTINGS, ...(row?.data || {}) };
  },

  async saveSettings(patch) {
    const current = await this.loadSettings();
    const data = { ...current, ...patch };
    await run(client().from(TABLES.settings).upsert({
      user_id: auth.user?.id,
      data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }));
    return data;
  },

  // ---- model preferences --------------------------------------------------

  async listPrefs() {
    const rows = await run(client().from(TABLES.prefs).select('*'));
    const map = {};
    for (const row of rows) map[row.model_id] = row;
    return map;
  },

  async setPref(modelId, enabled) {
    await run(client().from(TABLES.prefs).upsert({
      user_id: auth.user?.id,
      model_id: modelId,
      enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,model_id' }));
  },

  async listModels() {
    return run(client().from(TABLES.models).select('*').order('name', { ascending: true }));
  },
};
