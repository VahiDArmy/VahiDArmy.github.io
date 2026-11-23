/* data.js — Supabase data access for the 3D matrix tables */
import { sb, CFG, state, errMsg, toast, getPrefs, applyPrefs } from './core.js';

const q = (v) => v;

async function fetchAll(table, select = '*', { order, filters, max = 20000 } = {}) {
  const out = [];
  let from = 0;
  while (from < max) {
    let req = sb.from(table).select(select).range(from, from + CFG.pageSize - 1);
    if (order) req = req.order(order.col, { ascending: order.asc !== false });
    if (filters) for (const [k, v] of Object.entries(filters)) req = req.eq(k, v);
    const { data, error } = await req;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < CFG.pageSize) break;
    from += CFG.pageSize;
  }
  return out;
}

function indexData() {
  state.peopleMap = new Map(state.people.map((p) => [p.id, p]));
  state.traitMap = new Map(state.traits.map((t) => [t.id, t]));
  state.scoreKey = new Map();
  for (const s of state.scores) state.scoreKey.set(`${s.trait_id}|${s.ranker_person_id}|${s.target_person_id}`, s);
}

export async function loadAll({ quiet = false } = {}) {
  const t0 = performance.now();
  setSync('busy', 'در حال بارگذاری');
  const results = await Promise.allSettled([
    fetchAll('people', '*', { order: { col: 'full_name' } }),
    fetchAll('mtx_traits', '*', { order: { col: 'sort_order' } }),
    fetchAll('mtx_scores', 'id,trait_id,ranker_person_id,target_person_id,value,confidence,note,source,created_by,updated_at'),
    fetchAll('mtx_comments', '*', { order: { col: 'created_at', asc: false }, max: 3000 }),
    fetchAll('mtx_disputes', '*', { order: { col: 'created_at', asc: false }, max: 2000 }),
    fetchAll('mtx_sessions', '*', { order: { col: 'started_at', asc: false }, max: 200 }),
    fetchAll('mtx_views', '*', { max: 500 }),
    fetchAll('mtx_relations', '*', { max: 2000 }),
    state.user ? fetchAll('mtx_ai_runs', '*', { order: { col: 'created_at', asc: false }, max: 200 }) : Promise.resolve([]),
  ]);
  const keys = ['people', 'traits', 'scores', 'comments', 'disputes', 'sessions', 'views', 'relations', 'aiRuns'];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') state[keys[i]] = r.value;
    else { state[keys[i]] = state[keys[i]] || []; errors.push(`${keys[i]}: ${errMsg(r.reason)}`); }
  });
  indexData();
  state.lastSync = new Date();
  state.ready = true;
  if (errors.length) {
    setSync('err', 'خطای جزئی');
    if (!quiet) toast(errors[0], 'err', 4200);
  } else {
    setSync('ok', 'همگام');
  }
  void t0;
  return { errors };
}

export function setSync(kind, text) {
  const pill = document.getElementById('sync-pill');
  const label = document.getElementById('sync-text');
  if (!pill || !label) return;
  pill.classList.remove('is-busy', 'is-err', 'is-off');
  if (kind === 'busy') pill.classList.add('is-busy');
  if (kind === 'err') pill.classList.add('is-err');
  if (kind === 'off') pill.classList.add('is-off');
  label.textContent = text;
}

/* ---------- people ---------- */
export async function createPerson(payload) {
  const row = {
    full_name: payload.full_name?.trim(),
    job_title: payload.job_title || null,
    department: payload.department || null,
    bio: payload.bio || null,
    avatar_url: payload.avatar_url || null,
    phone: payload.phone || null,
    email: payload.email || null,
    tags: payload.tags || [],
    slug: payload.slug || null,
    metadata: payload.metadata || {},
    created_by: state.user?.id || null,
    manager_id: payload.manager_id || null,
  };
  if (payload.status) row.status = payload.status;
  const { data, error } = await sb.from('people').insert(row).select('*').single();
  if (error) throw error;
  state.people.push(data); state.people.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa'));
  indexData(); return data;
}
export async function updatePerson(id, patch) {
  const { data, error } = await sb.from('people').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  state.people = state.people.map((p) => (p.id === id ? data : p)); indexData(); return data;
}
export async function deletePerson(id) {
  // mtx_* foreign keys have no ON DELETE CASCADE: clear children first
  await sb.from('mtx_scores').delete().eq('ranker_person_id', id);
  await sb.from('mtx_scores').delete().eq('target_person_id', id);
  await sb.from('mtx_comments').delete().eq('ranker_person_id', id);
  await sb.from('mtx_comments').delete().eq('target_person_id', id);
  await sb.from('mtx_disputes').delete().eq('target_person_id', id);
  await sb.from('mtx_relations').delete().eq('person_id', id);
  await sb.from('mtx_relations').delete().eq('other_id', id);
  await sb.from('person_links').delete().eq('person_id', id);
  await sb.from('person_links').delete().eq('other_person_id', id);
  await sb.from('mtx_sessions').update({ ranker_person_id: null }).eq('ranker_person_id', id);
  await sb.from('people').update({ manager_id: null }).eq('manager_id', id);
  const { error } = await sb.from('people').delete().eq('id', id);
  if (error) throw error;
  state.people = state.people.filter((p) => p.id !== id);
  state.scores = state.scores.filter((s) => s.ranker_person_id !== id && s.target_person_id !== id);
  indexData();
}

/* ---------- traits ---------- */
export async function createTrait(payload) {
  const row = {
    key: payload.key || `t_${Math.random().toString(36).slice(2, 8)}`,
    name: payload.name?.trim(),
    description: payload.description || null,
    color: payload.color || '#5ef2d6',
    icon: payload.icon || 'spark',
    category: payload.category || 'general',
    min_value: payload.min_value ?? 0,
    max_value: payload.max_value ?? 10,
    polarity: payload.polarity ?? 1,
    weight: payload.weight ?? 1,
    is_core: !!payload.is_core,
    sort_order: payload.sort_order ?? state.traits.length,
    owner_id: state.user?.id || null,
    created_by: state.user?.id || null,
    metadata: payload.metadata || {},
  };
  const { data, error } = await sb.from('mtx_traits').insert(row).select('*').single();
  if (error) throw error;
  state.traits.push(data); state.traits.sort((a, b) => a.sort_order - b.sort_order); indexData(); return data;
}
export async function updateTrait(id, patch) {
  const { data, error } = await sb.from('mtx_traits').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  state.traits = state.traits.map((t) => (t.id === id ? data : t)); indexData(); return data;
}
export async function deleteTrait(id) {
  await sb.from('mtx_scores').delete().eq('trait_id', id);
  await sb.from('mtx_comments').delete().eq('trait_id', id);
  await sb.from('mtx_disputes').delete().eq('trait_id', id);
  const { error } = await sb.from('mtx_traits').delete().eq('id', id);
  if (error) throw error;
  state.traits = state.traits.filter((t) => t.id !== id);
  state.scores = state.scores.filter((s) => s.trait_id !== id); indexData();
}

/* ---------- scores ---------- */
export function getScore(traitId, rankerId, targetId) {
  return state.scoreKey.get(`${traitId}|${rankerId}|${targetId}`) || null;
}

export async function setScore({ traitId, rankerId, targetId, value, confidence = 0.75, note = null, source = 'manual' }) {
  if (!state.user) throw new Error('برای ثبت امتیاز وارد شوید');
  const existing = getScore(traitId, rankerId, targetId);
  const clean = Number(Number(value).toFixed(2));
  if (existing) {
    const patch = { value: clean, confidence, note, updated_at: new Date().toISOString() };
    const { data, error } = await sb.from('mtx_scores').update(patch).eq('id', existing.id).select('*').single();
    if (error) throw error;
    Object.assign(existing, data);
    state.scoreKey.set(`${traitId}|${rankerId}|${targetId}`, existing);
    return existing;
  }
  const row = {
    trait_id: traitId, ranker_person_id: rankerId, target_person_id: targetId,
    value: clean, confidence, note, source, created_by: state.user.id,
  };
  const { data, error } = await sb.from('mtx_scores').insert(row).select('*').single();
  if (error) throw error;
  state.scores.push(data); state.scoreKey.set(`${traitId}|${rankerId}|${targetId}`, data);
  return data;
}

export async function deleteScore(traitId, rankerId, targetId) {
  const existing = getScore(traitId, rankerId, targetId);
  if (!existing) return;
  await sb.from('mtx_disputes').delete().eq('score_id', existing.id);
  const { error } = await sb.from('mtx_scores').delete().eq('id', existing.id);
  if (error) throw error;
  state.scores = state.scores.filter((s) => s.id !== existing.id);
  state.scoreKey.delete(`${traitId}|${rankerId}|${targetId}`);
}

export async function deleteScoreById(id) {
  await sb.from('mtx_disputes').delete().eq('score_id', id);
  const { error } = await sb.from('mtx_scores').delete().eq('id', id);
  if (error) throw error;
  state.scores = state.scores.filter((s) => s.id !== id); indexData();
}

/* ---------- comments / disputes ---------- */
export async function addComment({ traitId, rankerId, targetId, body }) {
  const row = { trait_id: traitId, ranker_person_id: rankerId, target_person_id: targetId, author_id: state.user?.id || null, body };
  const { data, error } = await sb.from('mtx_comments').insert(row).select('*').single();
  if (error) throw error;
  state.comments.unshift(data); return data;
}
export async function deleteComment(id) {
  const { error } = await sb.from('mtx_comments').delete().eq('id', id);
  if (error) throw error;
  state.comments = state.comments.filter((c) => c.id !== id);
}
export async function addDispute({ scoreId, traitId, targetId, reason }) {
  const row = { score_id: scoreId || null, trait_id: traitId, target_person_id: targetId, raised_by: state.user?.id || null, reason };
  const { data, error } = await sb.from('mtx_disputes').insert(row).select('*').single();
  if (error) throw error;
  state.disputes.unshift(data); return data;
}
export async function resolveDispute(id, status) {
  const { data, error } = await sb.from('mtx_disputes').update({ status, resolved_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  state.disputes = state.disputes.map((d) => (d.id === id ? data : d)); return data;
}

/* ---------- views / sessions / relations ---------- */
export async function saveView({ name, mode, config }) {
  const row = { owner_id: state.user?.id || null, name, mode, config };
  const { data, error } = await sb.from('mtx_views').insert(row).select('*').single();
  if (error) throw error;
  state.views.unshift(data); return data;
}
export async function deleteView(id) {
  const { error } = await sb.from('mtx_views').delete().eq('id', id);
  if (error) throw error;
  state.views = state.views.filter((v) => v.id !== id);
}
export async function startSession({ rankerId, kind = 'deck', spec = {} }) {
  const row = { owner_id: state.user?.id || null, ranker_person_id: rankerId || null, kind, spec, status: 'live', progress: {} };
  const { data, error } = await sb.from('mtx_sessions').insert(row).select('*').single();
  if (error) throw error;
  state.sessions.unshift(data); return data;
}
export async function updateSession(id, patch) {
  const { data, error } = await sb.from('mtx_sessions').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  state.sessions = state.sessions.map((s) => (s.id === id ? data : s)); return data;
}
export async function addRelation({ personId, otherId, kind = 'peer', weight = 1 }) {
  const row = { person_id: personId, other_id: otherId, kind, weight, created_by: state.user?.id || null };
  const { data, error } = await sb.from('mtx_relations').insert(row).select('*').single();
  if (error) throw error;
  state.relations.push(data); return data;
}
export async function deleteRelation(id) {
  const { error } = await sb.from('mtx_relations').delete().eq('id', id);
  if (error) throw error;
  state.relations = state.relations.filter((r) => r.id !== id);
}

/* ---------- ai runs / events / audit ---------- */
export async function logAiRun(run) {
  if (!state.user) return null;
  const row = {
    user_id: state.user.id, kind: run.kind || 'chat', model_slug: run.model || null,
    prompt: run.prompt?.slice(0, 8000) || null, response: run.response?.slice(0, 30000) || null,
    reasoning: run.reasoning?.slice(0, 30000) || null, status: run.status || 'ok',
    tokens_in: run.tokensIn || 0, tokens_out: run.tokensOut || 0, latency_ms: run.latency || null,
    error: run.error || null, context: run.context || {},
  };
  const { data, error } = await sb.from('mtx_ai_runs').insert(row).select('*').single();
  if (error) { console.warn('ai run log failed', error.message); return null; }
  state.aiRuns.unshift(data); if (state.aiRuns.length > 200) state.aiRuns.pop();
  return data;
}
export async function logEvent(kind, label, payload = {}) {
  if (!state.user) return;
  try { await sb.from('mtx_events').insert({ user_id: state.user.id, kind, label, payload }); } catch (e) { console.warn(e.message); }
}
export async function fetchAudit(limit = 120) {
  const { data, error } = await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error; return data || [];
}
export async function fetchEvents(limit = 120) {
  const { data, error } = await sb.from('mtx_events').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error; return data || [];
}

/* ---------- model catalogue ---------- */
export async function fetchModelsTable() {
  const { data, error } = await sb.from('openrouter_models').select('*').eq('is_active', true).order('sort_order').limit(1000);
  if (error) return [];
  return data || [];
}
export async function cacheModels(models) {
  if (!state.user || !models?.length) return;
  try {
    const rows = models.map((m) => ({
      id: m.id, canonical_slug: m.canonical_slug || m.id, name: m.name, provider: m.provider || (m.id || '').split('/')[0],
      description: m.description || null, context_length: m.context_length || null,
      pricing: m.pricing || {}, architecture: m.architecture || {}, supported_parameters: m.supported_parameters || [],
      is_free: true, is_active: true, raw: {},
    }));
    await sb.from('openrouter_models').upsert(rows, { onConflict: 'id' });
  } catch (e) { console.warn('cache models failed', e.message); }
}

/* ---------- user preferences ---------- */
export async function loadUserPrefs() {
  if (!state.user) return;
  try {
    const { data, error } = await sb.from('mtx_prefs').select('prefs').eq('user_id', state.user.id).maybeSingle();
    if (error) return;
    if (data?.prefs && typeof data.prefs === 'object') {
      state.prefs = { ...getPrefs(), ...data.prefs };
      applyPrefs(state.prefs);
    }
  } catch { /* keep local prefs */ }
}

/* ---------- realtime ---------- */
let channel = null;
export function subscribeRealtime(onChange) {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('mx3-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mtx_scores' }, (payload) => onChange?.('mtx_scores', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mtx_comments' }, (payload) => onChange?.('mtx_comments', payload))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mtx_disputes' }, (payload) => onChange?.('mtx_disputes', payload))
    .subscribe();
  return channel;
}
export function unsubscribeRealtime() { if (channel) { sb.removeChannel(channel); channel = null; } }

export { fetchAll, q };
