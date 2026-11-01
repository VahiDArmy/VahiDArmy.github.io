/* =========================================================
   لایهٔ دیتابیس — Supabase
   API همگام برای مصرف‌کننده‌ها؛ داده در حافظه نگه‌داری و در پس‌زمینه ذخیره می‌شود.
   جدول‌ها: cinema_titles · cinema_activity · cinema_meta · cinema_conversations · cinema_ai_models
   ========================================================= */
window.DB = (function () {
  let client = null;
  let ready = false;
  let currentUser = null;

  let titles = [];
  let titlesById = {};
  let conversations = [];
  let activity = [];
  let meta = {};
  let aiModels = [];

  function getClient() {
    if (!client) {
      if (typeof window.supabase === 'undefined') throw new Error('کتابخانه Supabase بارگذاری نشده');
      client = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
    return client;
  }

  /* ---------------- احراز هویت ---------------- */
  async function initAuth() {
    const res = await getClient().auth.getSession();
    currentUser = res.data.session ? res.data.session.user : null;
    return currentUser;
  }
  function getUser() { return currentUser; }

  async function signIn(email, password) {
    const res = await getClient().auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw res.error;
    currentUser = res.data.user;
    return res.data;
  }
  async function signUp(email, password) {
    const res = await getClient().auth.signUp({ email: email, password: password });
    if (res.error) throw res.error;
    return res.data;
  }
  async function signOut() {
    await getClient().auth.signOut();
    currentUser = null;
    titles = []; titlesById = {}; conversations = []; activity = []; meta = {}; aiModels = [];
    ready = false;
  }

  /* ---------------- نگاشت ردیف‌ها ---------------- */
  const TITLE_KEYS = ['title', 'category', 'type', 'genre', 'year', 'rating', 'favorite', 'notes',
    'watched_date', 'summary', 'original_title', 'seasons', 'episodes', 'episodes_per_season',
    'country', 'language', 'status', 'reason', 'story_analysis', 'ai_standardized_at', 'legacy_id'];

  function fromDbTitle(row) {
    return {
      id: row.id, legacy_id: row.legacy_id,
      title: row.title, category: row.category || 'good', type: row.type || 'series',
      genre: row.genre || '', year: row.year, rating: Number(row.rating) || 0,
      favorite: !!row.favorite, notes: row.notes || '', watched_date: row.watched_date,
      summary: row.summary || '', original_title: row.original_title || '',
      seasons: row.seasons, episodes: row.episodes, episodes_per_season: row.episodes_per_season,
      country: row.country || '', language: row.language || '', status: row.status || '',
      reason: row.reason || '',
      /* در دیتابیس متن JSON است؛ در برنامه همیشه آبجکت (یا null) */
      story_analysis: Utils.safeParse(row.story_analysis, null),
      ai_standardized_at: row.ai_standardized_at,
      created_at: row.created_at, updated_at: row.updated_at
    };
  }

  function toDbTitle(obj) {
    const out = {};
    TITLE_KEYS.forEach(function (k) { if (obj[k] !== undefined) out[k] = obj[k]; });
    if (out.favorite !== undefined) out.favorite = !!out.favorite;
    if (out.story_analysis !== undefined && typeof out.story_analysis !== 'string') {
      out.story_analysis = out.story_analysis ? JSON.stringify(out.story_analysis) : '';
    }
    return out;
  }

  function fromDbModel(row) {
    return {
      id: row.id,
      label: row.label || row.id,
      vendor: row.vendor || '',
      provider: row.provider || inferProvider(row.id),
      context: row.context || '',
      active: row.active !== false,
      wins: Number(row.wins) || 0,
      losses: Number(row.losses) || 0,
      fails: Number(row.fails) || 0,
      last_tried_at: row.last_tried_at || null
    };
  }

  function inferProvider(id) {
    return String(id || '').toLowerCase().indexOf('gemini') === 0 ? 'google' : 'openrouter';
  }

  /* ---------------- بارگذاری ---------------- */
  async function loadAll() {
    const c = getClient();
    const r = await Promise.all([
      c.from('cinema_titles').select('*').order('created_at', { ascending: false }),
      c.from('cinema_conversations').select('*').order('created_at', { ascending: false }),
      c.from('cinema_activity').select('*').order('created_at', { ascending: false }).limit(200),
      c.from('cinema_meta').select('*'),
      c.from('cinema_ai_models').select('*')
    ]);
    if (r[0].error) throw r[0].error;
    titles = (r[0].data || []).map(fromDbTitle);
    titlesById = {};
    titles.forEach(function (t) { titlesById[t.id] = t; });
    conversations = r[1].data || [];
    activity = r[2].data || [];
    meta = {};
    (r[3].data || []).forEach(function (x) { meta[x.k] = x.v; });
    aiModels = (r[4].data || []).map(fromDbModel);
  }

  async function init() {
    if (ready) return true;
    await initAuth();
    if (!currentUser) return false;
    await loadAll();
    seedGoogleModels();
    ready = true;
    return true;
  }
  function isReady() { return ready; }

  /* ---------------- عنوان‌ها ---------------- */
  function getAllTitles() { return titles.slice(); }
  function getTitle(id) { return titlesById[id] || null; }

  function insertTitle(data) {
    const tempId = 'tmp_' + Date.now();
    const now = new Date().toISOString();
    const local = Object.assign({
      id: tempId, category: 'good', type: 'series', rating: 0, favorite: false,
      notes: '', created_at: now, updated_at: now
    }, data);
    titles.unshift(local);
    titlesById[tempId] = local;

    (async function () {
      try {
        const row = toDbTitle(local);
        row.created_at = now; row.updated_at = now;
        const res = await getClient().from('cinema_titles').insert(row).select().single();
        if (res.error) throw res.error;
        const real = fromDbTitle(res.data);
        const i = titles.findIndex(function (t) { return t.id === tempId; });
        if (i >= 0) titles[i] = real;
        delete titlesById[tempId];
        titlesById[real.id] = real;
        logActivity('create', 'title', real.id, real.title);
      } catch (e) {
        console.error('insertTitle failed', e);
        titles = titles.filter(function (t) { return t.id !== tempId; });
        delete titlesById[tempId];
        if (window.Toast) Toast.error('ذخیرهٔ عنوان در سرور ناموفق بود');
      }
    })();
    return tempId;
  }

  function updateTitle(id, patch, log) {
    const cur = titlesById[id];
    if (!cur) return null;
    const updated = Object.assign({}, cur, patch, { updated_at: new Date().toISOString() });
    titlesById[id] = updated;
    const i = titles.findIndex(function (t) { return t.id === id; });
    if (i >= 0) titles[i] = updated;

    (async function () {
      try {
        const row = toDbTitle(patch);
        row.updated_at = updated.updated_at;
        const res = await getClient().from('cinema_titles').update(row).eq('id', id);
        if (res.error) throw res.error;
        if (log !== false) logActivity('update', 'title', id, updated.title);
      } catch (e) {
        console.error('updateTitle failed', e);
        if (window.Toast) Toast.error('ذخیرهٔ تغییرات در سرور ناموفق بود');
      }
    })();
    return updated;
  }

  function deleteTitle(id) {
    const t = titlesById[id];
    if (!t) return null;
    titles = titles.filter(function (x) { return x.id !== id; });
    delete titlesById[id];
    (async function () {
      try {
        await getClient().from('cinema_titles').delete().eq('id', id);
        logActivity('delete', 'title', id, t.title);
      } catch (e) { console.error(e); }
    })();
    return t;
  }

  function restoreTitle(row) {
    if (!row) return null;
    const keepId = row.id && String(row.id).indexOf('tmp_') !== 0;
    const now = new Date().toISOString();
    const local = Object.assign({}, row, { updated_at: now, created_at: row.created_at || now });
    if (!keepId) local.id = 'tmp_' + Date.now();
    titles.unshift(local);
    titlesById[local.id] = local;

    (async function () {
      try {
        const dbRow = toDbTitle(local);
        if (keepId) dbRow.id = row.id;
        dbRow.created_at = local.created_at;
        dbRow.updated_at = now;
        const res = await getClient().from('cinema_titles').upsert(dbRow).select().single();
        if (res.error) throw res.error;
        const real = fromDbTitle(res.data);
        const i = titles.findIndex(function (t) { return t.id === local.id; });
        if (i >= 0) titles[i] = real;
        if (local.id !== real.id) delete titlesById[local.id];
        titlesById[real.id] = real;
        logActivity('restore', 'title', real.id, real.title);
      } catch (e) { console.error('restoreTitle failed', e); }
    })();
    return local.id;
  }

  /* ---------------- فعالیت و متا ---------------- */
  function logActivity(action, entity, entityId, detail) {
    activity.unshift({ id: 'tmp_' + Date.now(), action: action, entity: entity, entity_id: entityId, detail: detail || null, created_at: new Date().toISOString() });
    (async function () {
      try {
        const eid = entityId && String(entityId).indexOf('tmp_') !== 0 ? entityId : null;
        await getClient().from('cinema_activity').insert({ action: action, entity: entity, entity_id: eid, detail: detail || null });
      } catch (e) { console.error(e); }
    })();
  }
  function getActivity(limit) { return activity.slice(0, limit || 50); }

  function getMeta(key) { return meta[key] != null ? meta[key] : null; }
  function setMeta(key, value) {
    meta[key] = String(value);
    (async function () {
      try { await getClient().from('cinema_meta').upsert({ k: key, v: String(value), user_id: currentUser && currentUser.id }); }
      catch (e) { console.error(e); }
    })();
  }

  /* ---------------- گفتگوهای ذخیره‌شده ---------------- */
  function saveConversation(conv) {
    const tempId = 'tmp_' + Date.now();
    const now = new Date().toISOString();
    const local = {
      id: tempId, title_id: conv.title_id || null, title_context: conv.title_context || '',
      prompt: conv.prompt, response: conv.response || '', ai_model: conv.ai_model || '',
      tags: conv.tags || '', created_at: now, updated_at: now
    };
    conversations.unshift(local);
    (async function () {
      try {
        const res = await getClient().from('cinema_conversations').insert({
          title_id: local.title_id, title_context: local.title_context, prompt: local.prompt,
          response: local.response, ai_model: local.ai_model, tags: local.tags
        }).select().single();
        if (res.error) throw res.error;
        const i = conversations.findIndex(function (c) { return c.id === tempId; });
        if (i >= 0) conversations[i] = res.data;
      } catch (e) {
        console.error(e);
        if (window.Toast) Toast.error('ذخیرهٔ گفتگو در سرور ناموفق بود');
      }
    })();
    return tempId;
  }
  function getAllConversations() { return conversations.slice(); }
  function deleteConversation(id) {
    conversations = conversations.filter(function (c) { return c.id !== id; });
    (async function () {
      try { await getClient().from('cinema_conversations').delete().eq('id', id); } catch (e) { console.error(e); }
    })();
  }

  /* ---------------- مدل‌های AI ---------------- */
  function getAiModels() { return aiModels.slice(); }
  function getAiModel(id) { return aiModels.find(function (m) { return m.id === id; }) || null; }
  function getActiveAiModels() { return aiModels.filter(function (m) { return m.active; }); }

  /* درج مدل‌های تازه؛ ردیف‌های موجود (و آمارشان) دست‌نخورده می‌مانند.
     برمی‌گرداند: تعداد مدل‌های واقعاً افزوده‌شده. */
  async function addAiModels(list) {
    const fresh = list.filter(function (m) { return !getAiModel(m.id); }).map(function (m) {
      return {
        id: m.id, label: m.label || m.id, vendor: m.vendor || '',
        provider: m.provider || inferProvider(m.id), context: m.context || ''
      };
    });
    if (!fresh.length) return 0;
    for (let i = 0; i < fresh.length; i += 50) {
      const res = await getClient().from('cinema_ai_models').insert(fresh.slice(i, i + 50));
      if (res.error) throw res.error;
    }
    fresh.forEach(function (m) { aiModels.push(fromDbModel(m)); });
    return fresh.length;
  }

  function seedGoogleModels() {
    const missing = CONFIG.AI.GOOGLE_MODELS.filter(function (m) { return !getAiModel(m.id); });
    if (missing.length) {
      addAiModels(missing.map(function (m) { return Object.assign({ provider: 'google' }, m); }))
        .catch(function (e) { console.error('seedGoogleModels', e); });
    }
  }

  function patchAiModel(id, patch) {
    const m = getAiModel(id);
    if (!m) return null;
    Object.assign(m, patch);
    (async function () {
      try {
        const res = await getClient().from('cinema_ai_models').update(Object.assign({}, patch, { updated_at: new Date().toISOString() })).eq('id', id);
        if (res.error) console.error('patchAiModel', res.error);
      } catch (e) { console.error('patchAiModel', e); }
    })();
    return m;
  }

  /* نتیجهٔ یک تلاش: 'win' = کاربر پذیرفت · 'loss' = کاربر رد کرد · 'fail' = خطا/پاسخ نامعتبر */
  function recordAiOutcome(id, outcome) {
    const m = getAiModel(id);
    if (!m) return null;
    const patch = { last_tried_at: new Date().toISOString() };
    if (outcome === 'win') patch.wins = m.wins + 1;
    else if (outcome === 'loss') patch.losses = m.losses + 1;
    else patch.fails = m.fails + 1;
    return patchAiModel(id, patch);
  }
  function setAiModelActive(id, active) { return patchAiModel(id, { active: !!active }); }
  function resetAiStats(id) { return patchAiModel(id, { wins: 0, losses: 0, fails: 0, last_tried_at: null }); }

  /* ---------------- آمار ---------------- */
  function getStarCounts() {
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    titles.forEach(function (t) {
      const s = Math.floor(Number(t.rating) || 0);
      if (counts[s] !== undefined) counts[s]++;
    });
    counts.all = titles.length;
    return counts;
  }

  function getStats() {
    let totalRating = 0, rated = 0, fav = 0;
    titles.forEach(function (t) {
      if (t.rating > 0) { totalRating += t.rating; rated++; }
      if (t.favorite) fav++;
    });
    return { total: titles.length, avgRating: rated ? totalRating / rated : 0, ratedCount: rated, favoriteCount: fav };
  }

  /* مقایسهٔ نزدیک عنوان‌ها برای هشدار تکراری */
  function findSimilar(raw) {
    const q = Utils.normalizeFa(raw);
    if (!q) return [];
    const out = [];
    titles.forEach(function (t) {
      const n = Utils.normalizeFa(t.title);
      if (n === q) out.push(Object.assign({ _matchType: 'exact' }, t));
      else if (q.length >= 3 && n.length >= 3 && (n.indexOf(q) > -1 || q.indexOf(n) > -1)) out.push(Object.assign({ _matchType: 'contains' }, t));
    });
    return out;
  }

  /* ---------------- پشتیبان JSON ---------------- */
  function exportJSON() { return { titles: titles, conversations: conversations, meta: meta, exported_at: new Date().toISOString() }; }

  async function importTitles(list) {
    const rows = (list || []).map(function (t) {
      const r = toDbTitle(t);
      r.title = String(t.title || '').trim();
      return r;
    }).filter(function (r) { return r.title; });
    for (let i = 0; i < rows.length; i += 40) {
      const res = await getClient().from('cinema_titles').insert(rows.slice(i, i + 40));
      if (res.error) throw res.error;
    }
    await loadAll();
    return rows.length;
  }

  return {
    init: init, isReady: isReady, getUser: getUser, signIn: signIn, signUp: signUp, signOut: signOut, loadAll: loadAll,
    getAllTitles: getAllTitles, getTitle: getTitle, insertTitle: insertTitle, updateTitle: updateTitle,
    deleteTitle: deleteTitle, restoreTitle: restoreTitle, findSimilar: findSimilar,
    logActivity: logActivity, getActivity: getActivity, getMeta: getMeta, setMeta: setMeta,
    saveConversation: saveConversation, getAllConversations: getAllConversations, deleteConversation: deleteConversation,
    getAiModels: getAiModels, getAiModel: getAiModel, getActiveAiModels: getActiveAiModels,
    addAiModels: addAiModels, recordAiOutcome: recordAiOutcome, setAiModelActive: setAiModelActive, resetAiStats: resetAiStats,
    getStarCounts: getStarCounts, getStats: getStats, exportJSON: exportJSON, importTitles: importTitles
  };
})();
