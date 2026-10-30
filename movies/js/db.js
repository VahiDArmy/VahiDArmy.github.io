/* =========================================================
   لایه‌ی دیتابیس — نسخه آنلاین Supabase
   API همگام (sync) برای سازگاری کامل با کد اصلی
   داده‌ها در حافظه نگه‌داری می‌شوند و به Supabase همگام می‌شوند
   ========================================================= */
window.DB = (function () {
  let supabase = null;
  let ready = false;
  let currentUser = null;

  // In-memory stores (sync API)
  let titles = [];
  let titlesById = {};
  let conversations = [];
  let activity = [];
  let meta = {};
  let aiModels = [];
  let deletedAiModelIds = new Set();

  function getClient() {
    if (!supabase) {
      if (typeof window.supabase === 'undefined') {
        throw new Error('کتابخانه Supabase بارگذاری نشده');
      }
      supabase = window.supabase.createClient(
        (CONFIG.SUPABASE && CONFIG.SUPABASE.URL) || 'https://ummhohozmpwltbgeczsf.supabase.co',
        (CONFIG.SUPABASE && CONFIG.SUPABASE.ANON_KEY) || 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',
        { auth: { persistSession: true, autoRefreshToken: true } }
      );
    }
    return supabase;
  }

  async function initAuth() {
    const client = getClient();
    const { data: { session } } = await client.auth.getSession();
    currentUser = session ? session.user : null;
    return currentUser;
  }

  function getUser() { return currentUser; }

  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return data;
  }

  async function signUp(email, password) {
    const { data, error } = await getClient().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await getClient().auth.signOut();
    currentUser = null;
    titles = []; titlesById = {}; conversations = []; activity = []; meta = {};
  }

  function fromDbTitle(row) {
    return {
      id: row.id,
      legacy_id: row.legacy_id,
      title: row.title,
      category: row.category || '',
      type: row.type || 'series',
      genre: row.genre || '',
      year: row.year,
      rating: Number(row.rating) || 0,
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

  function toDbTitle(obj) {
    const out = {};
    const keys = ['title','category','type','genre','year','rating','favorite','notes',
      'watched_date','summary','original_title','seasons','episodes','episodes_per_season',
      'country','language','status','reason','story_analysis','ai_standardized_at','legacy_id'];
    keys.forEach(function (k) { if (obj[k] !== undefined) out[k] = obj[k]; });
    if (out.favorite !== undefined) out.favorite = !!out.favorite;
    return out;
  }

  async function loadAll() {
    const client = getClient();
    const results = await Promise.all([
      client.from('cinema_titles').select('*').order('created_at', { ascending: false }),
      client.from('cinema_conversations').select('*').order('created_at', { ascending: false }),
      client.from('cinema_activity').select('*').order('created_at', { ascending: false }).limit(200),
      client.from('cinema_meta').select('*'),
      client.from('cinema_ai_models').select('*'),
      client.from('cinema_ai_models_deleted').select('id')
    ]);
    const tRes = results[0], cRes = results[1], aRes = results[2], mRes = results[3], amRes = results[4], delRes = results[5];

    if (tRes.error) throw tRes.error;
    titles = (tRes.data || []).map(fromDbTitle);
    titlesById = {};
    titles.forEach(function (t) { titlesById[t.id] = t; });

    conversations = cRes.data || [];
    activity = aRes.data || [];
    meta = {};
    (mRes.data || []).forEach(function (r) { meta[r.k] = r.v; });
    aiModels = amRes.data || [];
    deletedAiModelIds = new Set((delRes.data || []).map(function (r) { return r.id; }));
  }

  async function init() {
    if (ready) return true;
    await initAuth();
    if (!currentUser) return false;
    await loadAll();
    ready = true;
    return true;
  }

  function isReady() { return ready; }

  function getAllTitles() { return titles.slice(); }
  function getTitle(id) { return titlesById[id] || null; }

  function insertTitle(data, log) {
    var tempId = 'tmp_' + Date.now();
    var now = new Date().toISOString();
    var local = Object.assign({
      id: tempId, category: 'good', type: 'series', rating: 0, favorite: false,
      notes: '', created_at: now, updated_at: now
    }, data);
    titles.unshift(local);
    titlesById[tempId] = local;

    (async function () {
      try {
        var row = toDbTitle(local);
        row.created_at = now; row.updated_at = now;
        var res = await getClient().from('cinema_titles').insert(row).select().single();
        if (res.error) throw res.error;
        var real = fromDbTitle(res.data);
        var idx = titles.findIndex(function (t) { return t.id === tempId; });
        if (idx >= 0) titles[idx] = real;
        delete titlesById[tempId];
        titlesById[real.id] = real;
        if (log !== false) logActivity('create', 'title', real.id, real.title);
      } catch (e) {
        console.error('insertTitle failed', e);
        titles = titles.filter(function (t) { return t.id !== tempId; });
        delete titlesById[tempId];
      }
    })();
    return local.id;
  }

  function updateTitle(id, patch, log) {
    var cur = titlesById[id];
    if (!cur) return null;
    var updated = Object.assign({}, cur, patch, { updated_at: new Date().toISOString() });
    titlesById[id] = updated;
    var idx = titles.findIndex(function (t) { return t.id === id; });
    if (idx >= 0) titles[idx] = updated;

    (async function () {
      try {
        var row = toDbTitle(patch);
        row.updated_at = updated.updated_at;
        var res = await getClient().from('cinema_titles').update(row).eq('id', id);
        if (res.error) throw res.error;
        if (log !== false) logActivity('update', 'title', id, updated.title);
      } catch (e) { console.error('updateTitle failed', e); }
    })();
    return updated;
  }

  function deleteTitle(id) {
    var t = titlesById[id];
    titles = titles.filter(function (x) { return x.id !== id; });
    delete titlesById[id];
    (async function () {
      try {
        await getClient().from('cinema_titles').delete().eq('id', id);
        if (t) logActivity('delete', 'title', id, t.title);
      } catch (e) { console.error(e); }
    })();
    return true;
  }

  function logActivity(action, entity, entityId, detail) {
    var row = { id: 'tmp_' + Date.now(), action: action, entity: entity, entity_id: entityId, detail: detail || null, created_at: new Date().toISOString() };
    activity.unshift(row);
    (async function () {
      try {
        await getClient().from('cinema_activity').insert({ action: action, entity: entity, entity_id: entityId, detail: detail || null });
      } catch (e) { console.error(e); }
    })();
  }

  function getActivity(limit) { return activity.slice(0, limit || 50); }

  function getMeta(key) { return meta[key] != null ? meta[key] : null; }
  function setMeta(key, value) {
    meta[key] = String(value);
    (async function () {
      try { await getClient().from('cinema_meta').upsert({ k: key, v: String(value) }); }
      catch (e) { console.error(e); }
    })();
  }

  function saveConversation(conv) {
    if (conv.id && String(conv.id).indexOf('tmp_') !== 0) {
      var idx = conversations.findIndex(function (c) { return c.id === conv.id; });
      if (idx >= 0) conversations[idx] = Object.assign({}, conversations[idx], conv, { updated_at: new Date().toISOString() });
      (async function () {
        try {
          await getClient().from('cinema_conversations').update({
            title_id: conv.title_id || null, title_context: conv.title_context || '',
            prompt: conv.prompt, response: conv.response || '', ai_model: conv.ai_model || '',
            tags: conv.tags || '', updated_at: new Date().toISOString()
          }).eq('id', conv.id);
        } catch (e) { console.error(e); }
      })();
      return conv.id;
    }
    var tempId = 'tmp_' + Date.now();
    var local = Object.assign({ id: tempId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, conv);
    conversations.unshift(local);
    (async function () {
      try {
        var res = await getClient().from('cinema_conversations').insert({
          title_id: conv.title_id || null, title_context: conv.title_context || '',
          prompt: conv.prompt, response: conv.response || '', ai_model: conv.ai_model || '', tags: conv.tags || ''
        }).select().single();
        if (res.error) throw res.error;
        var i = conversations.findIndex(function (c) { return c.id === tempId; });
        if (i >= 0) conversations[i] = res.data;
      } catch (e) { console.error(e); }
    })();
    return tempId;
  }

  function getAllConversations() { return conversations.slice(); }
  function getConversationsByTitle(titleId) { return conversations.filter(function (c) { return c.title_id === titleId; }); }
  function getConversation(id) { return conversations.find(function (c) { return c.id === id; }) || null; }
  function deleteConversation(id) {
    conversations = conversations.filter(function (c) { return c.id !== id; });
    (async function () {
      try { await getClient().from('cinema_conversations').delete().eq('id', id); } catch (e) { console.error(e); }
    })();
  }
  function updateConversation(id, patch) { return saveConversation(Object.assign({ id: id }, patch)); }

  function getAiModels() { return aiModels.slice(); }
  function getAiModel(id) { return aiModels.find(function (m) { return m.id === id; }) || null; }
  function countAiModels() { return aiModels.length; }

  function upsertAiModel(model) {
    var idx = aiModels.findIndex(function (m) { return m.id === model.id; });
    if (idx >= 0) aiModels[idx] = Object.assign({}, aiModels[idx], model);
    else aiModels.push(model);
    (async function () {
      try {
        await getClient().from('cinema_ai_models').upsert({
          id: model.id, label: model.label, vendor: model.vendor || '', size: model.size || '',
          context: model.context || '', speed: model.speed || '', note: model.note || '',
          tags: Array.isArray(model.tags) ? model.tags.join(',') : (model.tags || ''),
          recommended: !!model.recommended, best_for: model.best_for || model.bestFor || '',
          is_free: model.is_free !== false, source: model.source || 'seed', updated_at: new Date().toISOString()
        });
      } catch (e) { console.error(e); }
    })();
  }

  function deleteAiModel(id) {
    aiModels = aiModels.filter(function (m) { return m.id !== id; });
    deletedAiModelIds.add(id);
    (async function () {
      try {
        await getClient().from('cinema_ai_models').delete().eq('id', id);
        await getClient().from('cinema_ai_models_deleted').upsert({ id: id });
      } catch (e) { console.error(e); }
    })();
  }

  function getDeletedAiModelIds() { return Array.from(deletedAiModelIds); }
  function markAiModelDeleted(id) { deletedAiModelIds.add(id); }
  function unmarkAiModelDeleted(id) {
    deletedAiModelIds.delete(id);
    (async function () {
      try { await getClient().from('cinema_ai_models_deleted').delete().eq('id', id); } catch (e) {}
    })();
  }
  function clearDeletedAiModelIds() {
    deletedAiModelIds.clear();
    (async function () {
      try { await getClient().from('cinema_ai_models_deleted').delete().neq('id', ''); } catch (e) {}
    })();
  }
  function countDeletedAiModels() { return deletedAiModelIds.size; }

  function seedAiModels() {
    if (!CONFIG.AI || !Array.isArray(CONFIG.AI.MODELS)) return;
    CONFIG.AI.MODELS.forEach(function (m) {
      if (!aiModels.find(function (x) { return x.id === m.id; }) && !deletedAiModelIds.has(m.id)) {
        upsertAiModel(m);
      }
    });
  }

  function getStarCounts() {
    var counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    titles.forEach(function (t) {
      var s = Math.round(Number(t.rating) || 0);
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }

  function getStats() {
    var byCat = { love: 0, good: 0, hate: 0 };
    var totalRating = 0, rated = 0, fav = 0;
    titles.forEach(function (t) {
      if (byCat[t.category] !== undefined) byCat[t.category]++;
      if (t.rating > 0) { totalRating += t.rating; rated++; }
      if (t.favorite) fav++;
    });
    var avg = rated ? totalRating / rated : 0;
    return {
      total: titles.length,
      byCategory: byCat,
      avgRating: avg,
      ratedCount: rated,
      favoriteCount: fav,
      totals: { count: titles.length, avgRating: avg, favorites: fav }
    };
  }

  function findSimilar() { return []; }

  async function bulkInsertFromSqliteRows(rows) {
    var mapped = rows.map(function (r) {
      return {
        legacy_id: r.id, title: r.title, category: r.category || 'good', type: r.type || 'series',
        genre: r.genre || '', year: r.year, rating: Number(r.rating) || 0, favorite: !!r.favorite,
        notes: r.notes || '', watched_date: r.watched_date, summary: r.summary || '',
        original_title: r.original_title || '', seasons: r.seasons, episodes: r.episodes,
        episodes_per_season: r.episodes_per_season, country: r.country || '', language: r.language || '',
        status: r.status || '', reason: r.reason || '', story_analysis: r.story_analysis || '',
        ai_standardized_at: r.ai_standardized_at,
        created_at: r.created_at || new Date().toISOString(),
        updated_at: r.updated_at || new Date().toISOString()
      };
    });
    var client = getClient();
    var inserted = 0;
    for (var i = 0; i < mapped.length; i += 40) {
      var chunk = mapped.slice(i, i + 40);
      var res = await client.from('cinema_titles').insert(chunk);
      if (res.error) throw res.error;
      inserted += chunk.length;
    }
    await loadAll();
    return inserted;
  }

  function exportBinary() { return null; }
  function exportBase64() { return null; }
  function exportJSON() { return JSON.stringify({ titles: titles, conversations: conversations, meta: meta }); }
  function importJSON() { return false; }
  function importBinary() { return false; }
  function persistLocal() {}
  function pullFromGitHub() { return Promise.resolve(false); }
  function pushToGitHub() { return Promise.resolve(false); }
  function getLastSha() { return null; }
  function query() { return []; }
  function run() { return { changes: 0 }; }

  return {
    init: init, initAuth: initAuth, getUser: getUser, signIn: signIn, signUp: signUp, signOut: signOut,
    ready: isReady, isReady: isReady,
    getAllTitles: getAllTitles, getTitle: getTitle, insertTitle: insertTitle, updateTitle: updateTitle, deleteTitle: deleteTitle,
    logActivity: logActivity, getActivity: getActivity, getStarCounts: getStarCounts, getStats: getStats, findSimilar: findSimilar,
    getMeta: getMeta, setMeta: setMeta,
    saveConversation: saveConversation, getAllConversations: getAllConversations, getConversationsByTitle: getConversationsByTitle,
    getConversation: getConversation, deleteConversation: deleteConversation, updateConversation: updateConversation,
    getAiModels: getAiModels, getAiModel: getAiModel, countAiModels: countAiModels, upsertAiModel: upsertAiModel, deleteAiModel: deleteAiModel,
    seedAiModels: seedAiModels, getDeletedAiModelIds: getDeletedAiModelIds, markAiModelDeleted: markAiModelDeleted,
    unmarkAiModelDeleted: unmarkAiModelDeleted, clearDeletedAiModelIds: clearDeletedAiModelIds, countDeletedAiModels: countDeletedAiModels,
    bulkInsertFromSqliteRows: bulkInsertFromSqliteRows, loadAll: loadAll,
    exportBinary: exportBinary, exportBase64: exportBase64, exportJSON: exportJSON, importJSON: importJSON, importBinary: importBinary,
    persistLocal: persistLocal, pullFromGitHub: pullFromGitHub, pushToGitHub: pushToGitHub, getLastSha: getLastSha, query: query, run: run
  };
})();
