/* =========================================================
   لایه‌ی دیتابیس با sql.js
   ========================================================= */
window.DB = (function () {
  let SQL = null;
  let db = null;
  let lastSha = null;
  let ready = false;

  /* =========================================================
     SCHEMA — هر دستور یک رشته‌ی کامل جدا
     ========================================================= */
  const SQL_TITLES =
    'CREATE TABLE IF NOT EXISTS titles (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  title TEXT NOT NULL,' +
    '  category TEXT DEFAULT "",' +
    '  type TEXT NOT NULL DEFAULT "series",' +
    '  genre TEXT DEFAULT "",' +
    '  year INTEGER,' +
    '  rating REAL DEFAULT 0,' +
    '  favorite INTEGER NOT NULL DEFAULT 0,' +
    '  notes TEXT DEFAULT "",' +
    '  watched_date TEXT,' +
    '  summary TEXT DEFAULT "",' +
    '  original_title TEXT DEFAULT "",' +
    '  seasons INTEGER,' +
    '  episodes INTEGER,' +
    '  episodes_per_season INTEGER,' +
    '  country TEXT DEFAULT "",' +
    '  language TEXT DEFAULT "",' +
    '  status TEXT DEFAULT "",' +
    '  reason TEXT DEFAULT "",' +
    '  story_analysis TEXT DEFAULT "",' +
    '  ai_standardized_at TEXT,' +
    '  created_at TEXT NOT NULL,' +
    '  updated_at TEXT NOT NULL' +
    ')';

  const SQL_TITLES_IDX_RATING = 'CREATE INDEX IF NOT EXISTS idx_titles_rating ON titles(rating)';
  const SQL_TITLES_IDX_CREATED = 'CREATE INDEX IF NOT EXISTS idx_titles_created ON titles(created_at)';

  const SQL_CONVERSATIONS =
    'CREATE TABLE IF NOT EXISTS conversations (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  title_id INTEGER,' +
    '  title_context TEXT DEFAULT "",' +
    '  prompt TEXT NOT NULL,' +
    '  response TEXT DEFAULT "",' +
    '  ai_model TEXT DEFAULT "",' +
    '  tags TEXT DEFAULT "",' +
    '  created_at TEXT NOT NULL,' +
    '  updated_at TEXT NOT NULL' +
    ')';

  const SQL_CONV_IDX_TITLE = 'CREATE INDEX IF NOT EXISTS idx_conv_title ON conversations(title_id)';
  const SQL_CONV_IDX_CREATED = 'CREATE INDEX IF NOT EXISTS idx_conv_created ON conversations(created_at)';

  const SQL_ACTIVITY =
    'CREATE TABLE IF NOT EXISTS activity (' +
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,' +
    '  action TEXT NOT NULL,' +
    '  entity TEXT,' +
    '  entity_id INTEGER,' +
    '  detail TEXT,' +
    '  created_at TEXT NOT NULL' +
    ')';

  const SQL_META = 'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)';

  /* ---- مدل‌های AI ---- */
  const SQL_AI_MODELS =
    'CREATE TABLE IF NOT EXISTS ai_models (' +
    '  id TEXT PRIMARY KEY,' +
    '  label TEXT NOT NULL,' +
    '  vendor TEXT DEFAULT "",' +
    '  size TEXT DEFAULT "",' +
    '  context TEXT DEFAULT "",' +
    '  speed TEXT DEFAULT "",' +
    '  note TEXT DEFAULT "",' +
    '  tags TEXT DEFAULT "",' +
    '  recommended INTEGER NOT NULL DEFAULT 0,' +
    '  best_for TEXT DEFAULT "",' +
    '  is_free INTEGER NOT NULL DEFAULT 1,' +
    '  source TEXT DEFAULT "seed",' +
    '  fetched_at TEXT,' +
    '  created_at TEXT NOT NULL,' +
    '  updated_at TEXT NOT NULL' +
    ')';

  const SQL_AI_MODELS_IDX_REC = 'CREATE INDEX IF NOT EXISTS idx_ai_models_rec ON ai_models(recommended)';

  /* ---- سنگ‌قبر مدل‌ها — حذف‌شده‌ها که نباید دوباره پیشنهاد شوند ---- */
  const SQL_AI_MODELS_DELETED =
    'CREATE TABLE IF NOT EXISTS ai_models_deleted (' +
    '  id TEXT PRIMARY KEY,' +
    '  deleted_at TEXT NOT NULL' +
    ')';

  function ensureTable(table, createSql) {
    try {
      const rows = query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
      if (!rows.length) {
        db.exec(createSql);
        console.log('[DB] Created table: ' + table);
      }
    } catch (e) {
      console.warn('[DB] ensureTable ' + table + ':', e);
    }
  }

  function ensureColumn(table, col, type) {
    try {
      const info = query('PRAGMA table_info(' + table + ')');
      let has = false;
      for (let i = 0; i < info.length; i++) {
        if (info[i].name === col) { has = true; break; }
      }
      if (!has) {
        run('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + type);
        console.log('[DB] Migrated: added ' + table + '.' + col);
      }
    } catch (e) { console.warn('[DB] ensureColumn ' + table + '.' + col + ':', e); }
  }

  function runMigrations() {
    const titleCols = [
      ['summary', 'TEXT DEFAULT ""'],
      ['original_title', 'TEXT DEFAULT ""'],
      ['seasons', 'INTEGER'],
      ['episodes', 'INTEGER'],
      ['episodes_per_season', 'INTEGER'],
      ['country', 'TEXT DEFAULT ""'],
      ['language', 'TEXT DEFAULT ""'],
      ['status', 'TEXT DEFAULT ""'],
      ['reason', 'TEXT DEFAULT ""'],
      ['story_analysis', 'TEXT DEFAULT ""'],
      ['ai_standardized_at', 'TEXT']
    ];
    titleCols.forEach(function (c) { ensureColumn('titles', c[0], c[1]); });

    ensureColumn('conversations', 'tags', 'TEXT DEFAULT ""');
    ensureColumn('conversations', 'ai_model', 'TEXT DEFAULT ""');
    ensureColumn('conversations', 'title_context', 'TEXT DEFAULT ""');
  }

  function migrateCategoryToStars() {
    try {
      const flag = getMeta('stars_migrated');
      if (flag === '1') return;
      const rows = query('SELECT id, category, rating FROM titles WHERE category IS NOT NULL AND category != ""');
      if (!rows.length) { setMeta('stars_migrated', '1'); return; }
      let count = 0;
      rows.forEach(function (r) {
        if (Number(r.rating) > 0) return;
        let stars = 3;
        if (r.category === 'love') stars = 5;
        else if (r.category === 'hate') stars = 1;
        run('UPDATE titles SET rating = ? WHERE id = ?', [stars, r.id]);
        count++;
      });
      setMeta('stars_migrated', '1');
      logActivity('migrate', 'titles', null, count + ' عنوان از دسته‌بندی به ستاره');
    } catch (e) { console.warn('[DB] migration:', e); }
  }

  function setMeta(k, v) {
    const stmt = db.prepare('INSERT OR REPLACE INTO meta(k, v) VALUES (?, ?)');
    stmt.run([k, String(v)]);
    stmt.free();
  }
  function getMeta(k) {
    const stmt = db.prepare('SELECT v FROM meta WHERE k = ?');
    let out = null;
    if (stmt.step()) out = stmt.getAsObject().v;
    stmt.free();
    return out;
  }

  function logActivity(action, entity, entityId, detail) {
    try {
      const stmt = db.prepare(
        'INSERT INTO activity(action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?)'
      );
      stmt.run([action, entity || null, entityId || null, detail || '', new Date().toISOString()]);
      stmt.free();
    } catch (e) {}
  }

  function bootMsg(msg) {
    if (window.BootLog && typeof window.BootLog.info === 'function') {
      try { window.BootLog.info(msg); } catch (e) {}
    }
  }

  /* =========================================================
     ساخت کامل تمام جداول
     ========================================================= */
  function buildSchema() {
    try { db.exec(SQL_META); } catch (e) { console.warn('[DB] meta:', e); }

    ensureTable('titles', SQL_TITLES);
    ensureTable('conversations', SQL_CONVERSATIONS);
    ensureTable('activity', SQL_ACTIVITY);
    ensureTable('ai_models', SQL_AI_MODELS);
    ensureTable('ai_models_deleted', SQL_AI_MODELS_DELETED);

    try { db.exec(SQL_TITLES_IDX_RATING); } catch (e) {}
    try { db.exec(SQL_TITLES_IDX_CREATED); } catch (e) {}
    try { db.exec(SQL_CONV_IDX_TITLE); } catch (e) {}
    try { db.exec(SQL_CONV_IDX_CREATED); } catch (e) {}
    try { db.exec(SQL_AI_MODELS_IDX_REC); } catch (e) {}

    runMigrations();
  }

  /* =========================================================
     Init
     ========================================================= */
  async function init() {
    if (ready) return;

    SQL = await initSqlJs({
      locateFile: function (f) {
        return 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/' + f;
      }
    });

    let loadedFromRemote = false;
    if (GitHub.isConfigured()) {
      bootMsg('دریافت دیتابیس از گیت‌هاب…');
      try {
        const file = await GitHub.readFile();
        if (file && file.content) {
          const bytes = Utils.base64ToUint8(file.content);
          db = new SQL.Database(bytes);
          lastSha = file.sha;
          loadedFromRemote = true;
        }
      } catch (e) {
        console.warn('[DB] GitHub load failed:', e);
        bootMsg('دریافت از گیت‌هاب ناموفق — نسخه محلی');
      }
    }

    if (!loadedFromRemote) {
      bootMsg('بارگذاری از حافظه محلی…');
      const local = localStorage.getItem(CONFIG.STORAGE.LOCAL_DB);
      if (local) {
        try {
          const bytes = Utils.base64ToUint8(local);
          db = new SQL.Database(bytes);
        } catch (e) {}
      }
    }

    if (!db) db = new SQL.Database();

    bootMsg('آماده‌سازی جداول دیتابیس…');
    buildSchema();

    const countRow = query('SELECT COUNT(*) AS c FROM titles')[0];
    const count = countRow ? countRow.c : 0;
    if (!count && window.INITIAL_DATA) {
      bootMsg('وارد کردن داده اولیه…');
      seedFromInitial();
    }

    migrateCategoryToStars();

    const aiSeeded = getMeta('ai_models_seeded');
    if (aiSeeded !== '1') {
      if (countAiModels() === 0 && window.CONFIG && window.CONFIG.AI && Array.isArray(CONFIG.AI.MODELS)) {
        bootMsg('ثبت مدل‌های پیش‌فرض AI…');
        const n = seedAiModels(CONFIG.AI.MODELS);
        console.log('[DB] Seeded ' + n + ' AI models from config');
      }
      setMeta('ai_models_seeded', '1');
    }

    setMeta('schema_version', 6);
    setMeta('last_boot', new Date().toISOString());
    ready = true;
    persistLocal();

    if (!loadedFromRemote && GitHub.isConfigured()) {
      setTimeout(function () { pushToGitHub().catch(function () {}); }, 1000);
    }
  }

  function seedFromInitial() {
    const data = window.INITIAL_DATA;
    if (!Array.isArray(data)) return;
    data.forEach(function (item) {
      insertTitle({
        title: item.title, rating: item.rating || 0, type: 'series',
        genre: '', year: null, favorite: 0, notes: '', watched_date: null
      }, false);
    });
    logActivity('seed', 'titles', null, 'وارد کردن داده اولیه');
  }

  function rowToObj(row) {
    let storyAnalysis = null;
    if (row.story_analysis) storyAnalysis = Utils.safeParse(row.story_analysis, null);
    return {
      id: row.id,
      title: row.title,
      type: row.type || 'series',
      genre: row.genre || '',
      year: row.year || null,
      rating: row.rating != null ? Number(row.rating) : 0,
      favorite: !!row.favorite,
      notes: row.notes || '',
      watched_date: row.watched_date || null,
      summary: row.summary || '',
      original_title: row.original_title || '',
      seasons: row.seasons != null ? row.seasons : null,
      episodes: row.episodes != null ? row.episodes : null,
      episodes_per_season: row.episodes_per_season != null ? row.episodes_per_season : null,
      country: row.country || '',
      language: row.language || '',
      status: row.status || '',
      reason: row.reason || '',
      story_analysis: storyAnalysis,
      ai_standardized_at: row.ai_standardized_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function rowToConversation(row) {
    let model = null;
    if (row.ai_model) model = Utils.safeParse(row.ai_model, null);
    return {
      id: row.id,
      title_id: row.title_id || null,
      title_context: row.title_context || '',
      prompt: row.prompt || '',
      response: row.response || '',
      ai_model: model,
      tags: row.tags || '',
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function rowToAiModel(row) {
    const parsedTags = Utils.safeParse(row.tags, []);
    const tags = Array.isArray(parsedTags) ? parsedTags : [];
    return {
      id: row.id,
      label: row.label || row.id,
      vendor: row.vendor || '',
      size: row.size || '',
      context: row.context || '',
      speed: row.speed || '',
      note: row.note || '',
      tags: tags,
      recommended: !!row.recommended,
      bestFor: row.best_for || '',
      isFree: !!row.is_free,
      source: row.source || 'seed',
      fetchedAt: row.fetched_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function query(sql, params) {
    params = params || [];
    try {
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params);
      const out = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      stmt.free();
      return out;
    } catch (e) {
      console.error('[DB] query error:', sql, e);
      throw e;
    }
  }

  function run(sql, params) {
    params = params || [];
    try {
      const stmt = db.prepare(sql);
      stmt.run(params);
      stmt.free();
    } catch (e) {
      console.error('[DB] run error:', sql, e);
      throw e;
    }
  }

  /* ---- Titles ---- */
  const INSERT_COLS = 'title, category, type, genre, year, rating, favorite, notes, watched_date, ' +
    'summary, original_title, seasons, episodes, episodes_per_season, ' +
    'country, language, status, reason, story_analysis, ai_standardized_at';

  function insertTitle(data, log) {
    if (log == null) log = true;
    const now = new Date().toISOString();
    const sql = 'INSERT INTO titles (' + INSERT_COLS + ', created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      String(data.title || '').trim(),
      data.category || 'love',
      data.type || 'series',
      data.genre || '',
      data.year ? Number(data.year) : null,
      Number(data.rating) || 0,
      data.favorite ? 1 : 0,
      data.notes || '',
      data.watched_date || null,
      data.summary || '',
      data.original_title || '',
      data.seasons != null ? Number(data.seasons) : null,
      data.episodes != null ? Number(data.episodes) : null,
      data.episodes_per_season != null ? Number(data.episodes_per_season) : null,
      data.country || '',
      data.language || '',
      data.status || '',
      data.reason || '',
      data.story_analysis || '',
      data.ai_standardized_at || null,
      now, now
    ];
    run(sql, params);
    const id = query('SELECT last_insert_rowid() AS id')[0].id;
    if (log) logActivity('create', 'title', id, data.title);
    persistLocal();
    return id;
  }

  function updateTitle(id, data, log) {
    if (log == null) log = true;
    const now = new Date().toISOString();
    const sql = 'UPDATE titles SET title=?, type=?, genre=?, year=?, rating=?, favorite=?, notes=?, watched_date=?, summary=?, original_title=?, seasons=?, episodes=?, episodes_per_season=?, country=?, language=?, status=?, reason=?, story_analysis=?, ai_standardized_at=?, updated_at=? WHERE id=?';
    const params = [
      String(data.title || '').trim(),
      data.type || 'series',
      data.genre || '',
      data.year ? Number(data.year) : null,
      Number(data.rating) || 0,
      data.favorite ? 1 : 0,
      data.notes || '',
      data.watched_date || null,
      data.summary || '',
      data.original_title || '',
      data.seasons != null ? Number(data.seasons) : null,
      data.episodes != null ? Number(data.episodes) : null,
      data.episodes_per_season != null ? Number(data.episodes_per_season) : null,
      data.country || '',
      data.language || '',
      data.status || '',
      data.reason || '',
      data.story_analysis || '',
      data.ai_standardized_at || null,
      now, id
    ];
    run(sql, params);
    if (log) logActivity('update', 'title', id, data.title);
    persistLocal();
  }

  function deleteTitle(id, log) {
    if (log == null) log = true;
    const row = getTitle(id);
    run('DELETE FROM titles WHERE id=?', [id]);
    if (log && row) logActivity('delete', 'title', id, row.title);
    persistLocal();
    return row;
  }

  function restoreTitle(row) {
    if (!row) return null;
    const now = new Date().toISOString();
    const sql = 'INSERT INTO titles (' + INSERT_COLS + ', created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      row.title, 'love', row.type || 'series', row.genre || '',
      row.year || null, Number(row.rating) || 0, row.favorite ? 1 : 0,
      row.notes || '', row.watched_date || null, row.summary || '',
      row.original_title || '',
      row.seasons != null ? row.seasons : null,
      row.episodes != null ? row.episodes : null,
      row.episodes_per_season != null ? row.episodes_per_season : null,
      row.country || '', row.language || '', row.status || '', row.reason || '',
      row.story_analysis ? JSON.stringify(row.story_analysis) : '',
      row.ai_standardized_at || null,
      row.created_at || now, now
    ];
    run(sql, params);
    const newId = query('SELECT last_insert_rowid() AS id')[0].id;
    logActivity('restore', 'title', newId, row.title);
    persistLocal();
    return newId;
  }

  function getTitle(id) {
    const rows = query('SELECT * FROM titles WHERE id=?', [id]);
    return rows[0] ? rowToObj(rows[0]) : null;
  }
  function getAllTitles() {
    return query('SELECT * FROM titles ORDER BY created_at DESC').map(rowToObj);
  }
  function getActivity(limit) {
    limit = limit || 30;
    return query('SELECT * FROM activity ORDER BY id DESC LIMIT ?', [limit]);
  }

  function getStarCounts() {
    const rows = query('SELECT CAST(rating AS INTEGER) AS r, COUNT(*) AS c FROM titles GROUP BY CAST(rating AS INTEGER)');
    const out = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, all: 0 };
    rows.forEach(function (r) {
      const key = Math.round(Number(r.r) || 0);
      if (out[key] != null) out[key] = r.c;
      out.all += r.c;
    });
    return out;
  }

  function getStats() {
    const rows = query('SELECT CAST(rating AS INTEGER) AS stars, COUNT(*) AS count FROM titles GROUP BY CAST(rating AS INTEGER)');
    const totals = query('SELECT COUNT(*) AS c, AVG(NULLIF(rating,0)) AS a, SUM(favorite) AS f FROM titles')[0];
    const rated = query('SELECT COUNT(*) AS c FROM titles WHERE rating > 0')[0];
    let convCount = 0;
    try {
      const cr = query('SELECT COUNT(*) AS c FROM conversations')[0];
      convCount = cr ? cr.c : 0;
    } catch (e) {}
    return {
      byStars: rows,
      totals: {
        count: totals ? totals.c : 0,
        avgRating: totals ? totals.a : 0,
        favorites: totals ? totals.f : 0,
        rated: rated ? rated.c : 0,
        conversations: convCount
      }
    };
  }

  /* ---- Conversations ---- */
  function saveConversation(data) {
    const now = new Date().toISOString();
    const modelJson = data.ai_model ? JSON.stringify(data.ai_model) : '';
    const sql = 'INSERT INTO conversations (title_id, title_context, prompt, response, ai_model, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)';
    run(sql, [
      data.title_id || null,
      data.title_context || '',
      data.prompt || '',
      data.response || '',
      modelJson,
      data.tags || '',
      now, now
    ]);
    const id = query('SELECT last_insert_rowid() AS id')[0].id;
    logActivity('prompt_save', 'conversation', id, (data.prompt || '').slice(0, 80));
    persistLocal();
    return id;
  }

  function getAllConversations() {
    try {
      return query('SELECT * FROM conversations ORDER BY created_at DESC').map(rowToConversation);
    } catch (e) { return []; }
  }
  function getConversationsByTitle(titleId) {
    try {
      return query('SELECT * FROM conversations WHERE title_id = ? ORDER BY created_at DESC', [titleId]).map(rowToConversation);
    } catch (e) { return []; }
  }
  function getConversation(id) {
    const rows = query('SELECT * FROM conversations WHERE id = ?', [id]);
    return rows[0] ? rowToConversation(rows[0]) : null;
  }
  function deleteConversation(id) {
    run('DELETE FROM conversations WHERE id=?', [id]);
    logActivity('prompt_delete', 'conversation', id, '');
    persistLocal();
  }
  function updateConversation(id, data) {
    const now = new Date().toISOString();
    const modelJson = data.ai_model ? JSON.stringify(data.ai_model) : '';
    run('UPDATE conversations SET prompt=?, response=?, ai_model=?, title_id=?, title_context=?, tags=?, updated_at=? WHERE id=?', [
      data.prompt || '', data.response || '', modelJson,
      data.title_id || null, data.title_context || '', data.tags || '',
      now, id
    ]);
    persistLocal();
  }

  /* =========================================================
     AI Models
     ========================================================= */
  function getAiModels() {
    try {
      return query('SELECT * FROM ai_models ORDER BY recommended DESC, label ASC').map(rowToAiModel);
    } catch (e) { return []; }
  }

  function getAiModel(id) {
    if (!id) return null;
    const rows = query('SELECT * FROM ai_models WHERE id=?', [id]);
    return rows[0] ? rowToAiModel(rows[0]) : null;
  }

  function countAiModels() {
    try {
      const r = query('SELECT COUNT(*) AS c FROM ai_models')[0];
      return r ? Number(r.c) : 0;
    } catch (e) { return 0; }
  }

  function upsertAiModel(m, silent) {
    if (!m || !m.id) throw new Error('id مدل لازم است');
    const now = new Date().toISOString();
    const existing = getAiModel(m.id);
    const tagsJson = Array.isArray(m.tags) ? JSON.stringify(m.tags) : String(m.tags || '');
    const recommended = m.recommended ? 1 : 0;
    const isFree = m.isFree === false ? 0 : 1;
    const source = m.source || (existing ? existing.source : 'manual');
    const fetchedAt = m.fetchedAt || (existing ? existing.fetchedAt : null);

    if (existing) {
      run(
        'UPDATE ai_models SET label=?, vendor=?, size=?, context=?, speed=?, note=?, tags=?, recommended=?, best_for=?, is_free=?, source=?, fetched_at=?, updated_at=? WHERE id=?',
        [
          String(m.label || existing.label || m.id),
          m.vendor != null ? m.vendor : existing.vendor,
          m.size != null ? m.size : existing.size,
          m.context != null ? m.context : existing.context,
          m.speed != null ? m.speed : existing.speed,
          m.note != null ? m.note : existing.note,
          tagsJson,
          recommended,
          m.bestFor != null ? m.bestFor : existing.bestFor,
          isFree,
          source,
          fetchedAt,
          now,
          m.id
        ]
      );
    } else {
      run(
        'INSERT INTO ai_models (id, label, vendor, size, context, speed, note, tags, recommended, best_for, is_free, source, fetched_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          m.id,
          String(m.label || m.id),
          m.vendor || '',
          m.size || '',
          m.context || '',
          m.speed || '',
          m.note || '',
          tagsJson,
          recommended,
          m.bestFor || '',
          isFree,
          source,
          fetchedAt,
          now,
          now
        ]
      );
    }

    /* اگر قبلاً حذف شده بود، حالا که برگشت، از لیست سنگ‌قبر بیرون بیاید */
    try { unmarkAiModelDeleted(m.id, true); } catch (e) {}

    if (!silent) persistLocal();
    return m.id;
  }

  function deleteAiModel(id) {
    if (!id) return 0;
    run('DELETE FROM ai_models WHERE id=?', [id]);
    /* سنگ‌قبر: دفعه‌ی بعد در جستجوی OpenRouter پیشنهاد نشود */
    try { markAiModelDeleted(id, true); } catch (e) {}
    persistLocal();
    return 1;
  }

  /* ---- سنگ‌قبر مدل‌های حذف‌شده ---- */
  function getDeletedAiModelIds() {
    try {
      const rows = query('SELECT id FROM ai_models_deleted ORDER BY deleted_at DESC');
      return rows.map(function (r) { return r.id; });
    } catch (e) { return []; }
  }

  function markAiModelDeleted(id, silent) {
    if (!id) return;
    const now = new Date().toISOString();
    run('INSERT OR REPLACE INTO ai_models_deleted (id, deleted_at) VALUES (?, ?)', [id, now]);
    if (!silent) persistLocal();
  }

  function unmarkAiModelDeleted(id, silent) {
    if (!id) return;
    run('DELETE FROM ai_models_deleted WHERE id=?', [id]);
    if (!silent) persistLocal();
  }

  function clearDeletedAiModelIds() {
    const before = getDeletedAiModelIds().length;
    run('DELETE FROM ai_models_deleted');
    persistLocal();
    return before;
  }

  function countDeletedAiModels() {
    try {
      const r = query('SELECT COUNT(*) AS c FROM ai_models_deleted')[0];
      return r ? Number(r.c) : 0;
    } catch (e) { return 0; }
  }

  function seedAiModels(list) {
    if (!Array.isArray(list)) return 0;
    const deleted = {};
    getDeletedAiModelIds().forEach(function (id) { deleted[id] = true; });
    let added = 0;
    list.forEach(function (m) {
      if (!m || !m.id) return;
      if (deleted[m.id]) return;   /* اگر کاربر قبلاً حذف کرده، دیگر وارد نشود */
      try {
        upsertAiModel({
          id: m.id,
          label: m.label || m.id,
          vendor: m.vendor || '',
          size: m.size || '',
          context: m.context || '',
          speed: m.speed || '',
          note: m.note || '',
          tags: m.tags || [],
          recommended: !!m.recommended,
          bestFor: m.bestFor || '',
          isFree: true,
          source: 'seed'
        }, true);
        added++;
      } catch (e) { console.warn('[DB] seedAiModels:', e); }
    });
    if (added > 0) persistLocal();
    return added;
  }

  /* ---- Similar ---- */
  function normalizeForCompare(s) {
    if (!s) return '';
    let n = String(s).toLowerCase();
    n = n.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    n = n.replace(/\([^)]*\)/g, '');
    n = n.replace(/\[[^\]]*\]/g, '');
    n = n.replace(/[^\p{L}\p{N}\s]/gu, ' ');
    n = n.replace(/\s+/g, ' ').trim();
    return n;
  }

  function similarityRatio(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const aW = a.split(' ').filter(function (w) { return w.length > 1; });
    const bW = b.split(' ').filter(function (w) { return w.length > 1; });
    if (!aW.length || !bW.length) return 0;
    let matches = 0;
    aW.forEach(function (aw) {
      if (bW.some(function (bw) {
        return bw === aw || (aw.length > 3 && bw.length > 3 && (bw.indexOf(aw) > -1 || aw.indexOf(bw) > -1));
      })) matches++;
    });
    return matches / Math.max(aW.length, bW.length);
  }

  function findSimilar(title, excludeId) {
    if (!title) return [];
    const norm = normalizeForCompare(title);
    if (!norm) return [];
    const all = getAllTitles();
    const results = [];
    all.forEach(function (t) {
      if (excludeId && t.id === excludeId) return;
      const tNorm = normalizeForCompare(t.title);
      if (!tNorm) return;
      if (tNorm === norm) {
        results.push({ id: t.id, title: t.title, year: t.year, type: t.type, _matchType: 'exact', _ratio: 1 });
        return;
      }
      if (tNorm.indexOf(norm) > -1 || norm.indexOf(tNorm) > -1) {
        results.push({ id: t.id, title: t.title, year: t.year, type: t.type, _matchType: 'contains', _ratio: 0.9 });
        return;
      }
      const ratio = similarityRatio(norm, tNorm);
      if (ratio >= 0.5) {
        results.push({ id: t.id, title: t.title, year: t.year, type: t.type, _matchType: 'similar', _ratio: ratio });
      }
    });
    results.sort(function (a, b) { return b._ratio - a._ratio; });
    return results;
  }

  /* ---- Export / Import ---- */
  function exportBinary() { return db.export(); }
  function exportBase64() { return Utils.uint8ToBase64(exportBinary()); }
  function exportJSON() {
    return {
      version: CONFIG.APP_VERSION,
      exportedAt: new Date().toISOString(),
      titles: getAllTitles(),
      conversations: getAllConversations(),
      aiModels: getAiModels(),
      aiModelsDeleted: getDeletedAiModelIds(),
      activity: getActivity(500)
    };
  }
  function importJSON(payload, replace) {
    if (!payload || !Array.isArray(payload.titles)) throw new Error('فایل نامعتبر');
    if (replace) {
      run('DELETE FROM titles');
      try { run('DELETE FROM conversations'); } catch (e) {}
      try { run('DELETE FROM ai_models'); } catch (e) {}
      try { run('DELETE FROM ai_models_deleted'); } catch (e) {}
    }
    let added = 0;
    payload.titles.forEach(function (t) {
      try {
        insertTitle({
          title: t.title, type: t.type || 'series', genre: t.genre || '',
          year: t.year, rating: t.rating || 0, favorite: t.favorite ? 1 : 0,
          notes: t.notes || '', watched_date: t.watched_date,
          summary: t.summary, original_title: t.original_title,
          seasons: t.seasons, episodes: t.episodes,
          episodes_per_season: t.episodes_per_season,
          country: t.country, language: t.language, status: t.status,
          reason: t.reason,
          story_analysis: t.story_analysis ? JSON.stringify(t.story_analysis) : '',
          ai_standardized_at: t.ai_standardized_at
        }, false);
        added++;
      } catch (e) {}
    });
    let convAdded = 0;
    if (Array.isArray(payload.conversations)) {
      payload.conversations.forEach(function (c) {
        try {
          saveConversation({
            title_id: c.title_id, title_context: c.title_context,
            prompt: c.prompt, response: c.response,
            ai_model: c.ai_model, tags: c.tags
          });
          convAdded++;
        } catch (e) {}
      });
    }
    let modelsAdded = 0;
    if (Array.isArray(payload.aiModels)) {
      payload.aiModels.forEach(function (m) {
        try {
          upsertAiModel({
            id: m.id, label: m.label, vendor: m.vendor,
            size: m.size, context: m.context, speed: m.speed,
            note: m.note, tags: m.tags || [],
            recommended: !!m.recommended, bestFor: m.bestFor,
            isFree: m.isFree !== false, source: m.source || 'import',
            fetchedAt: m.fetchedAt
          }, true);
          modelsAdded++;
        } catch (e) {}
      });
    }
    if (Array.isArray(payload.aiModelsDeleted)) {
      payload.aiModelsDeleted.forEach(function (id) {
        try { markAiModelDeleted(id, true); } catch (e) {}
      });
    }
    logActivity('import', 'titles', null, added + ' عنوان، ' + convAdded + ' پرامپت، ' + modelsAdded + ' مدل');
    persistLocal();
    return added;
  }
  function importBinary(bytes) {
    db = new SQL.Database(bytes);
    buildSchema();
    ready = true;
    persistLocal();
  }
  function persistLocal() {
    try {
      localStorage.setItem(CONFIG.STORAGE.LOCAL_DB, exportBase64());
    } catch (e) { console.warn('[DB] persist:', e); }
  }

  async function pullFromGitHub() {
    const file = await GitHub.readFile();
    if (!file || !file.content) throw new Error('فایل روی گیت‌هاب پیدا نشد.');
    const bytes = Utils.base64ToUint8(file.content);
    db = new SQL.Database(bytes);
    buildSchema();
    migrateCategoryToStars();
    const aiSeeded = getMeta('ai_models_seeded');
    if (aiSeeded !== '1' && countAiModels() === 0 && window.CONFIG && window.CONFIG.AI && Array.isArray(CONFIG.AI.MODELS)) {
      seedAiModels(CONFIG.AI.MODELS);
      setMeta('ai_models_seeded', '1');
    }
    lastSha = file.sha;
    ready = true;
    persistLocal();
    return { sha: file.sha, size: file.size };
  }
  async function pushToGitHub(message) {
    const b64 = exportBase64();
    if (!lastSha) {
      try {
        const info = await GitHub.readFile();
        lastSha = info ? info.sha : null;
      } catch (e) { lastSha = null; }
    }
    const commitMsg = message || (CONFIG.GITHUB.COMMIT_PREFIX + Utils.toJalaliLong(new Date()));
    const res = await GitHub.writeFile(b64, commitMsg, lastSha);
    lastSha = (res.content && res.content.sha) || null;
    setMeta('last_push', new Date().toISOString());
    persistLocal();
    return res;
  }
  function getLastSha() { return lastSha; }

  /* =========================================================
     Admin / low-level helpers — برای پنل مدیریت دیتابیس
     ========================================================= */
  function escapeIdent(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
  }

  function listTables() {
    return query("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name");
  }

  function getTableColumns(table) {
    return query('PRAGMA table_info(' + escapeIdent(table) + ')');
  }

  function getTableIndices(table) {
    let list;
    try { list = query('PRAGMA index_list(' + escapeIdent(table) + ')'); }
    catch (e) { return []; }
    return list.map(function (ix) {
      let cols = [];
      try { cols = query('PRAGMA index_info(' + escapeIdent(ix.name) + ')'); } catch (e) {}
      return {
        name: ix.name,
        unique: !!ix.unique,
        origin: ix.origin || '',
        partial: !!ix.partial,
        columns: cols.map(function (c) { return c.name; })
      };
    });
  }

  function getForeignKeys(table) {
    try { return query('PRAGMA foreign_key_list(' + escapeIdent(table) + ')'); }
    catch (e) { return []; }
  }

  function getTableRowCount(table) {
    const r = query('SELECT COUNT(*) AS c FROM ' + escapeIdent(table));
    return r[0] ? Number(r[0].c) : 0;
  }

  function getTableRowCountFiltered(table, filterColumn, filterValue) {
    const v = String(filterValue == null ? '' : filterValue).trim();
    if (!v) return getTableRowCount(table);
    const cols = getTableColumns(table).map(function (c) { return c.name; });
    if (!cols.length) return 0;
    const search = '%' + v + '%';
    let sql, params;
    if (filterColumn && filterColumn !== '__all__' && cols.indexOf(filterColumn) > -1) {
      sql = 'SELECT COUNT(*) AS c FROM ' + escapeIdent(table) + ' WHERE CAST(' + escapeIdent(filterColumn) + ' AS TEXT) LIKE ?';
      params = [search];
    } else {
      sql = 'SELECT COUNT(*) AS c FROM ' + escapeIdent(table) + ' WHERE (' +
        cols.map(function (c) { return 'CAST(' + escapeIdent(c) + ' AS TEXT) LIKE ?'; }).join(' OR ') + ')';
      params = cols.map(function () { return search; });
    }
    const r = query(sql, params);
    return r[0] ? Number(r[0].c) : 0;
  }

  function getTableRows(table, opts) {
    opts = opts || {};
    const cols = getTableColumns(table).map(function (c) { return c.name; });
    const params = [];
    let where = '';
    const v = String(opts.filterValue == null ? '' : opts.filterValue).trim();
    if (v) {
      const search = '%' + v + '%';
      if (opts.filterColumn && opts.filterColumn !== '__all__' && cols.indexOf(opts.filterColumn) > -1) {
        where = ' WHERE CAST(' + escapeIdent(opts.filterColumn) + ' AS TEXT) LIKE ?';
        params.push(search);
      } else {
        where = ' WHERE (' + cols.map(function (c) { return 'CAST(' + escapeIdent(c) + ' AS TEXT) LIKE ?'; }).join(' OR ') + ')';
        cols.forEach(function () { params.push(search); });
      }
    }
    let order = '';
    if (opts.orderBy && cols.indexOf(opts.orderBy) > -1) {
      order = ' ORDER BY ' + escapeIdent(opts.orderBy) + (opts.orderDir === 'desc' ? ' DESC' : ' ASC');
    }
    const limit = Math.max(1, Math.min(500, Number(opts.limit) || 40));
    const offset = Math.max(0, Number(opts.offset) || 0);
    const sql = 'SELECT * FROM ' + escapeIdent(table) + where + order + ' LIMIT ' + limit + ' OFFSET ' + offset;
    return query(sql, params);
  }

  function getDbInfo() {
    function one(sql, key) {
      try { const r = query(sql); return r[0] ? r[0][key] : null; } catch (e) { return null; }
    }
    const pageCount = Number(one('PRAGMA page_count', 'page_count')) || 0;
    const pageSize = Number(one('PRAGMA page_size', 'page_size')) || 0;
    return {
      pageCount: pageCount,
      pageSize: pageSize,
      sizeBytes: pageCount * pageSize,
      encoding: one('PRAGMA encoding', 'encoding') || '',
      userVersion: Number(one('PRAGMA user_version', 'user_version')) || 0,
      foreignKeysOn: !!Number(one('PRAGMA foreign_keys', 'foreign_keys')),
      journalMode: one('PRAGMA journal_mode', 'journal_mode') || '',
      schemaVersion: getMeta('schema_version')
    };
  }

  function integrityCheck() {
    try {
      return query('PRAGMA integrity_check').map(function (r) { return Object.values(r)[0]; });
    } catch (e) { return ['خطا: ' + e.message]; }
  }

  function vacuum() {
    db.exec('VACUUM');
    persistLocal();
  }

  function runRaw(sql, params) {
    const trimmed = String(sql == null ? '' : sql).trim();
    if (!trimmed) return { kind: 'empty', rows: [], columns: [], changes: 0 };
    const isRead = /^(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);
    if (isRead) {
      const stmt = db.prepare(trimmed);
      try {
        if (params && params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        const columns = stmt.getColumnNames();
        return { kind: 'read', rows: rows, columns: columns, changes: 0 };
      } finally { stmt.free(); }
    }
    db.run(trimmed, params || []);
    const changes = db.getRowsModified();
    const idRow = query('SELECT last_insert_rowid() AS id')[0];
    persistLocal();
    return {
      kind: 'write',
      rows: [], columns: [],
      changes: changes,
      lastInsertRowid: idRow ? idRow.id : null
    };
  }

  function insertRow(table, data) {
    const keys = Object.keys(data);
    if (!keys.length) {
      run('INSERT INTO ' + escapeIdent(table) + ' DEFAULT VALUES');
    } else {
      const sql = 'INSERT INTO ' + escapeIdent(table) +
        ' (' + keys.map(escapeIdent).join(',') + ') VALUES (' +
        keys.map(function () { return '?'; }).join(',') + ')';
      run(sql, keys.map(function (k) { return data[k]; }));
    }
    const idRow = query('SELECT last_insert_rowid() AS id')[0];
    persistLocal();
    return idRow ? idRow.id : null;
  }

  function updateRow(table, pkMap, data) {
    const setKeys = Object.keys(data).filter(function (k) { return !(k in pkMap); });
    if (!setKeys.length) return 0;
    const whereKeys = Object.keys(pkMap);
    const sql = 'UPDATE ' + escapeIdent(table) +
      ' SET ' + setKeys.map(function (k) { return escapeIdent(k) + '=?'; }).join(', ') +
      ' WHERE ' + whereKeys.map(function (k) { return escapeIdent(k) + '=?'; }).join(' AND ');
    const params = setKeys.map(function (k) { return data[k]; })
      .concat(whereKeys.map(function (k) { return pkMap[k]; }));
    run(sql, params);
    const changes = db.getRowsModified();
    persistLocal();
    return changes;
  }

  function deleteRow(table, pkMap) {
    const whereKeys = Object.keys(pkMap);
    const sql = 'DELETE FROM ' + escapeIdent(table) +
      ' WHERE ' + whereKeys.map(function (k) { return escapeIdent(k) + '=?'; }).join(' AND ');
    run(sql, whereKeys.map(function (k) { return pkMap[k]; }));
    const changes = db.getRowsModified();
    persistLocal();
    return changes;
  }

  return {
    init: init,
    ready: function () { return ready; },
    query: query, run: run,
    insertTitle: insertTitle, updateTitle: updateTitle, deleteTitle: deleteTitle, restoreTitle: restoreTitle,
    getTitle: getTitle, getAllTitles: getAllTitles,
    getActivity: getActivity, getStarCounts: getStarCounts, getStats: getStats,
    logActivity: logActivity, findSimilar: findSimilar,
    saveConversation: saveConversation,
    getAllConversations: getAllConversations,
    getConversationsByTitle: getConversationsByTitle,
    getConversation: getConversation,
    deleteConversation: deleteConversation,
    updateConversation: updateConversation,
    exportBinary: exportBinary, exportBase64: exportBase64, exportJSON: exportJSON,
    importJSON: importJSON, importBinary: importBinary, persistLocal: persistLocal,
    pullFromGitHub: pullFromGitHub, pushToGitHub: pushToGitHub, getLastSha: getLastSha,

    /* ---- AI Models ---- */
    getAiModels: getAiModels,
    getAiModel: getAiModel,
    countAiModels: countAiModels,
    upsertAiModel: upsertAiModel,
    deleteAiModel: deleteAiModel,
    seedAiModels: seedAiModels,

    /* ---- AI Models — Deleted (tombstones) ---- */
    getDeletedAiModelIds: getDeletedAiModelIds,
    markAiModelDeleted: markAiModelDeleted,
    unmarkAiModelDeleted: unmarkAiModelDeleted,
    clearDeletedAiModelIds: clearDeletedAiModelIds,
    countDeletedAiModels: countDeletedAiModels,

    /* ---- Admin / low-level ---- */
    escapeIdent: escapeIdent,
    listTables: listTables,
    getTableColumns: getTableColumns,
    getTableIndices: getTableIndices,
    getForeignKeys: getForeignKeys,
    getTableRowCount: getTableRowCount,
    getTableRowCountFiltered: getTableRowCountFiltered,
    getTableRows: getTableRows,
    getDbInfo: getDbInfo,
    integrityCheck: integrityCheck,
    vacuum: vacuum,
    runRaw: runRaw,
    insertRow: insertRow,
    updateRow: updateRow,
    deleteRow: deleteRow
  };
})();