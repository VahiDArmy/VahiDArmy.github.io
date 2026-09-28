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

  const SCHEMA = [
    SQL_TITLES,
    SQL_TITLES_IDX_RATING,
    SQL_TITLES_IDX_CREATED,
    SQL_CONVERSATIONS,
    SQL_CONV_IDX_TITLE,
    SQL_CONV_IDX_CREATED,
    SQL_ACTIVITY,
    SQL_META
  ];

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
    /* ---- titles ---- */
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

    /* ---- conversations ---- */
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
    /* روش مطمئن: هر جدول را جداگانه چک و ایجاد کن */
    try {
      db.exec(SQL_META);
    } catch (e) { console.warn('[DB] meta:', e); }

    ensureTable('titles', SQL_TITLES);
    ensureTable('conversations', SQL_CONVERSATIONS);
    ensureTable('activity', SQL_ACTIVITY);

    /* ایندکس‌ها */
    try { db.exec(SQL_TITLES_IDX_RATING); } catch (e) {}
    try { db.exec(SQL_TITLES_IDX_CREATED); } catch (e) {}
    try { db.exec(SQL_CONV_IDX_TITLE); } catch (e) {}
    try { db.exec(SQL_CONV_IDX_CREATED); } catch (e) {}

    /* migration */
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

    /* ساخت تمام جداول */
    bootMsg('آماده‌سازی جداول دیتابیس…');
    buildSchema();

    /* seed */
    const countRow = query('SELECT COUNT(*) AS c FROM titles')[0];
    const count = countRow ? countRow.c : 0;
    if (!count && window.INITIAL_DATA) {
      bootMsg('وارد کردن داده اولیه…');
      seedFromInitial();
    }

    migrateCategoryToStars();

    setMeta('schema_version', 5);
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
      activity: getActivity(500)
    };
  }
  function importJSON(payload, replace) {
    if (!payload || !Array.isArray(payload.titles)) throw new Error('فایل نامعتبر');
    if (replace) { run('DELETE FROM titles'); try { run('DELETE FROM conversations'); } catch (e) {} }
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
    logActivity('import', 'titles', null, added + ' عنوان، ' + convAdded + ' پرامپت');
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
    pullFromGitHub: pullFromGitHub, pushToGitHub: pushToGitHub, getLastSha: getLastSha
  };
})();