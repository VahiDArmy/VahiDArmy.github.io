/* =========================================================
   لایه‌ی دیتابیس با Supabase (جایگزین sql.js)
   همه متدها async هستند
   ========================================================= */
window.DB = (function () {
  let supabase = null;
  let ready = false;
  let currentUser = null;

  function getClient() {
    if (!supabase) {
      if (!window.supabase) {
        throw new Error('Supabase JS library not loaded');
      }
      supabase = window.supabase.createClient(
        CONFIG.SUPABASE.URL,
        CONFIG.SUPABASE.ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );
    }
    return supabase;
  }

  async function init() {
    const client = getClient();
    const { data: { session } } = await client.auth.getSession();
    currentUser = session ? session.user : null;
    ready = true;
    return currentUser;
  }

  function isReady() { return ready; }
  function getUser() { return currentUser; }

  async function signIn(email, password) {
    const client = getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return data;
  }

  async function signUp(email, password) {
    const client = getClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const client = getClient();
    await client.auth.signOut();
    currentUser = null;
  }

  async function getSession() {
    const client = getClient();
    const { data: { session } } = await client.auth.getSession();
    currentUser = session ? session.user : null;
    return session;
  }

  // ---------- Titles ----------
  async function getAllTitles() {
    const client = getClient();
    const { data, error } = await client
      .from('cinema_titles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTitleFromDb);
  }

  async function getTitle(id) {
    const client = getClient();
    const { data, error } = await client
      .from('cinema_titles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data ? mapTitleFromDb(data) : null;
  }

  async function addTitle(titleData) {
    const client = getClient();
    const row = mapTitleToDb(titleData);
    const { data, error } = await client
      .from('cinema_titles')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    await logActivity('create', 'title', data.id, data.title);
    return mapTitleFromDb(data);
  }

  async function updateTitle(id, patch, log = true) {
    const client = getClient();
    const row = mapTitleToDb(patch);
    row.updated_at = new Date().toISOString();
    const { data, error } = await client
      .from('cinema_titles')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    if (log) await logActivity('update', 'title', id, data.title);
    return mapTitleFromDb(data);
  }

  async function deleteTitle(id) {
    const client = getClient();
    const t = await getTitle(id);
    const { error } = await client.from('cinema_titles').delete().eq('id', id);
    if (error) throw error;
    if (t) await logActivity('delete', 'title', id, t.title);
    return true;
  }

  // ---------- Activity ----------
  async function logActivity(action, entity, entityId, detail) {
    const client = getClient();
    await client.from('cinema_activity').insert({
      action,
      entity,
      entity_id: entityId,
      detail: detail || null
    });
  }

  async function getRecentActivity(limit = 20) {
    const client = getClient();
    const { data, error } = await client
      .from('cinema_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // ---------- Meta ----------
  async function getMeta(key) {
    const client = getClient();
    const { data, error } = await client
      .from('cinema_meta')
      .select('v')
      .eq('k', key)
      .maybeSingle();
    if (error) throw error;
    return data ? data.v : null;
  }

  async function setMeta(key, value) {
    const client = getClient();
    const { error } = await client
      .from('cinema_meta')
      .upsert({ k: key, v: String(value) });
    if (error) throw error;
  }

  // ---------- Conversations ----------
  async function saveConversation(conv) {
    const client = getClient();
    const row = {
      title_id: conv.title_id || null,
      title_context: conv.title_context || '',
      prompt: conv.prompt,
      response: conv.response || '',
      ai_model: conv.ai_model || '',
      tags: conv.tags || ''
    };
    if (conv.id) {
      row.updated_at = new Date().toISOString();
      const { data, error } = await client
        .from('cinema_conversations')
        .update(row)
        .eq('id', conv.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await client
        .from('cinema_conversations')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  async function getAllConversations() {
    const client = getClient();
    const { data, error } = await client
      .from('cinema_conversations')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function deleteConversation(id) {
    const client = getClient();
    const { error } = await client.from('cinema_conversations').delete().eq('id', id);
    if (error) throw error;
  }

  // ---------- AI Models (shared) ----------
  async function getAiModels() {
    const client = getClient();
    const { data, error } = await client
      .from('cinema_ai_models')
      .select('*')
      .order('recommended', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function upsertAiModel(model) {
    const client = getClient();
    const { error } = await client.from('cinema_ai_models').upsert({
      id: model.id,
      label: model.label,
      vendor: model.vendor || '',
      size: model.size || '',
      context: model.context || '',
      speed: model.speed || '',
      note: model.note || '',
      tags: Array.isArray(model.tags) ? model.tags.join(',') : (model.tags || ''),
      recommended: !!model.recommended,
      best_for: model.best_for || '',
      is_free: model.is_free !== false,
      source: model.source || 'seed',
      fetched_at: model.fetched_at || null,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async function deleteAiModel(id) {
    const client = getClient();
    await client.from('cinema_ai_models').delete().eq('id', id);
    await client.from('cinema_ai_models_deleted').upsert({ id, deleted_at: new Date().toISOString() });
  }

  async function getDeletedAiModelIds() {
    const client = getClient();
    const { data, error } = await client.from('cinema_ai_models_deleted').select('id');
    if (error) throw error;
    return (data || []).map(r => r.id);
  }

  async function countDeletedAiModels() {
    const ids = await getDeletedAiModelIds();
    return ids.length;
  }

  async function clearDeletedAiModelIds() {
    const client = getClient();
    await client.from('cinema_ai_models_deleted').delete().neq('id', '');
  }

  async function unmarkAiModelDeleted(id) {
    const client = getClient();
    await client.from('cinema_ai_models_deleted').delete().eq('id', id);
  }

  // ---------- Helpers ----------
  function mapTitleFromDb(row) {
    return {
      id: row.id,
      legacy_id: row.legacy_id,
      title: row.title,
      category: row.category,
      type: row.type || 'series',
      genre: row.genre || '',
      year: row.year,
      rating: row.rating || 0,
      favorite: !!row.favorite,
      notes: row.notes || '',
      watched_date: row.watched_date,
      summary: row.summary || '',
      original_title: row.original_title || '',
      seasons: row.seasons,
      episodes: row.episodes,
      episodes_per_season: row.episodes_per_season,
      country: row.country || '',
      language: row.language || '',
      status: row.status || '',
      reason: row.reason || '',
      story_analysis: row.story_analysis || '',
      ai_standardized_at: row.ai_standardized_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function mapTitleToDb(obj) {
    const out = {};
    if (obj.title !== undefined) out.title = obj.title;
    if (obj.category !== undefined) out.category = obj.category;
    if (obj.type !== undefined) out.type = obj.type;
    if (obj.genre !== undefined) out.genre = obj.genre;
    if (obj.year !== undefined) out.year = obj.year;
    if (obj.rating !== undefined) out.rating = obj.rating;
    if (obj.favorite !== undefined) out.favorite = !!obj.favorite;
    if (obj.notes !== undefined) out.notes = obj.notes;
    if (obj.watched_date !== undefined) out.watched_date = obj.watched_date;
    if (obj.summary !== undefined) out.summary = obj.summary;
    if (obj.original_title !== undefined) out.original_title = obj.original_title;
    if (obj.seasons !== undefined) out.seasons = obj.seasons;
    if (obj.episodes !== undefined) out.episodes = obj.episodes;
    if (obj.episodes_per_season !== undefined) out.episodes_per_season = obj.episodes_per_season;
    if (obj.country !== undefined) out.country = obj.country;
    if (obj.language !== undefined) out.language = obj.language;
    if (obj.status !== undefined) out.status = obj.status;
    if (obj.reason !== undefined) out.reason = obj.reason;
    if (obj.story_analysis !== undefined) out.story_analysis = obj.story_analysis;
    if (obj.ai_standardized_at !== undefined) out.ai_standardized_at = obj.ai_standardized_at;
    if (obj.legacy_id !== undefined) out.legacy_id = obj.legacy_id;
    return out;
  }

  // Bulk insert for migration
  async function bulkInsertTitles(titles) {
    const client = getClient();
    const rows = titles.map(t => {
      const r = mapTitleToDb(t);
      r.legacy_id = t.id; // original SQLite id
      r.created_at = t.created_at || new Date().toISOString();
      r.updated_at = t.updated_at || r.created_at;
      return r;
    });
    // Insert in chunks of 50
    const chunkSize = 50;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await client.from('cinema_titles').insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }
    return inserted;
  }

  return {
    init,
    isReady,
    getUser,
    signIn,
    signUp,
    signOut,
    getSession,
    getAllTitles,
    getTitle,
    addTitle,
    updateTitle,
    deleteTitle,
    logActivity,
    getRecentActivity,
    getMeta,
    setMeta,
    saveConversation,
    getAllConversations,
    deleteConversation,
    getAiModels,
    upsertAiModel,
    deleteAiModel,
    getDeletedAiModelIds,
    countDeletedAiModels,
    clearDeletedAiModelIds,
    unmarkAiModelDeleted,
    bulkInsertTitles,
    getClient
  };
})();
