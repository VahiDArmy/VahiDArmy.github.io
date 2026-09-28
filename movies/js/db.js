/* =========================================================
   لایه‌ی دیتابیس با sql.js
   ========================================================= */
window.DB = (function () {
  let SQL = null;
  let db = null;
  let lastSha = null;
  let ready = false;

  const SCHEMA = [
    'CREATE TABLE IF NOT EXISTS titles (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  title TEXT NOT NULL,',
    '  category TEXT DEFAULT "",',             /* legacy — نادیده گرفته می‌شود */
    '  type TEXT NOT NULL DEFAULT "series",',
    '  genre TEXT DEFAULT "",',
    '  year INTEGER,',
    '  rating REAL DEFAULT 0,',
    '  favorite INTEGER NOT NULL DEFAULT 0,',
    '  notes TEXT DEFAULT "",',
    '  watched_date TEXT,',
    '  summary TEXT DEFAULT "",',
    '  original_title TEXT DEFAULT "",',
    '  seasons INTEGER,',
    '  episodes INTEGER,',
    '  episodes_per_season INTEGER,',
    '  country TEXT DEFAULT "",',
    '  language TEXT DEFAULT "",',
    '  status TEXT DEFAULT "",',
    '  reason TEXT DEFAULT "",',
    '  story_analysis TEXT DEFAULT "",',
    '  ai_standardized_at TEXT,',
    '  created_at TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL',
    ')',
    'CREATE INDEX IF NOT EXISTS idx_titles_rating ON titles(rating)',
    'CREATE INDEX IF NOT EXISTS idx_titles_created ON titles(created_at)',
    'CREATE TABLE IF NOT EXISTS activity (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  action TEXT NOT NULL,',
    '  entity TEXT,',
    '  entity_id INTEGER,',
    '  detail TEXT,',
    '  created_at TEXT NOT NULL',
    ')',
    'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)'
  ];

  function ensureColumn(table, col, type) {
    try {
      const info = query('PRAGMA table_info(' + table + ')');
      let has = false;
      for (let i = 0; i < info.length; i++) { if (info[i].name === col) { has = true; break; } }
      if (!has) {
        run('ALTER TABLE ' + table + ' ADD COLUMN ' + col + ' ' + type);
        console.log('[DB] Migrated: added ' + table + '.' + col);
      }
    } catch (e) { console.warn('[DB] ensureColumn ' + table + '.' + col + ':', e); }
  }

  function runMigrations() {
    const cols = [
      ['titles', 'summary', 'TEXT DEFAULT ""'],
      ['titles', 'original_title', 'TEXT DEFAULT ""'],
      ['titles', 'seasons', 'INTEGER'],
      ['titles', 'episodes', 'INTEGER'],
      ['titles', 'episodes_per_season', 'INTEGER'],
      ['titles', 'country', 'TEXT DEFAULT ""'],
      ['titles', 'language', 'TEXT DEFAULT ""'],
      ['titles', 'status', 'TEXT DEFAULT ""'],
      ['titles', 'reason', 'TEXT DEFAULT ""'],
      ['titles', 'story_analysis', 'TEXT DEFAULT ""'],
      ['titles', 'ai_standardized_at', 'TEXT']
    ];
    cols.forEach(function (c) { ensureColumn(c[0], c[1], c[2]); });
  }

  /* ---- مهاجرت از دسته‌بندی سه‌گانه به ستاره ---- */
  function migrateCategoryToStars() {
    try {
      const flag = getMeta('stars_migrated');
      if (flag === '1') return;

      /* بررسی وجود رکوردهای با category */
      const rows = query('SELECT id, category, rating FROM titles WHERE category IS NOT NULL AND category != ""');
      if (!rows.length) {
        setMeta('stars_migrated', '1');
        return;
      }

      let count = 0;
      rows.forEach(function (r) {
        /* اگر کاربر قبلاً ستاره داده، دست نزن */
        if (Number(r.rating) > 0) return;

        let stars = 3;
        if (r.category === 'love') stars = 5;
        else if (r.category === 'hate') stars = 1;

        run('UPDATE titles SET rating = ? WHERE id = ?', [stars, r.id]);
        count++;
      });

      setMeta('stars_migrated', '1');
      logActivity('migrate', 'titles', null, count + ' عنوان از دسته‌بندی به ستاره منتقل شد');
      console.log('[DB] Migrated ' + count + ' titles from category to stars');
    } catch (e) {
      console.warn('[DB] migration failed:', e);
    }
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
    } catch (e) { console.warn('activity log failed', e); }
  }

  function bootMsg(msg) {
    if (window.BootLog && typeof window.BootLog.info === 'function') {
      try { window.BootLog.info(msg); } catch (e) {}
    }
  }

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
        bootMsg('دریافت از گیت‌هاب ناموفق — استفاده از نسخه‌ی محلی');
      }
    }

    if (!loadedFromRemote) {
      bootMsg('بارگذاری از حافظه‌ی محلی…');
      const local = localStorage.getItem(CONFIG.STORAGE.LOCAL_DB);
      if (local) {
        try {
          const bytes = Utils.base64ToUint8(local);
          db = new SQL.Database(bytes);
        } catch (e) {
          console.warn('[DB] localStorage load failed:', e);
        }
      }
    }

    if (!db) db = new SQL.Database();

    /* اعمال schema */
    SCHEMA.forEach(function (sql) {
      try { db.exec(sql); } catch (e) { /* ممکنه جدول قبلاً باشه */ }
    });

    runMigrations();

    const countRow = query('SELECT COUNT(*) AS c FROM titles')[0];
    const count = countRow ? countRow.c : 0;
    if (!count && window.INITIAL_DATA) {
      bootMsg('وارد کردن داده‌ی اولیه…');
      seedFromInitial();
    }

    /* مهاجرت از category به rating */
    migrateCategoryToStars();

    setMeta('schema_version', 4);
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
        title: item.title,
        rating: item.rating || 0,
        type: 'series',
        genre: '',
        year: null,
        favorite: 0,
        notes: '',
        watched_date: null
      }, false);
    });
    logActivity('seed', 'titles', null, 'وارد کردن داده‌ی اولیه');
  }

  function rowToObj(row) {
    let storyAnalysis = null;
    if (row.story_analysis) {
      storyAnalysis = Utils.safeParse(row.story_analysis, null);
    }
    return {
      id: row.id,
      title: row.title,
      /* category نگه داشته می‌شود برای backward compat ولی استفاده نمی‌شود */
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

  /* ---- ستون‌ها بدون category ---- */
  const INSERT_COLS = 'title, category, type, genre, year, rating, favorite, notes, watched_date, ' +
    'summary, original_title, seasons, episodes, episodes_per_season, ' +
    'country, language, status, reason, story_analysis, ai_standardized_at';

  function insertTitle(data, log) {
    if (log == null) log = true;
    const now = new Date().toISOString();
    const sql = 'INSERT INTO titles (' + INSERT_COLS + ', created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      String(data.title || '').trim(),
      data.category || 'love',   /* legacy placeholder */
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
    const sql = 'UPDATE titles SET ' +
      'title=?, type=?, genre=?, year=?, rating=?, favorite=?, notes=?, watched_date=?, ' +
      'summary=?, original_title=?, seasons=?, episodes=?, episodes_per_season=?, ' +
      'country=?, language=?, status=?, reason=?, story_analysis=?, ai_standardized_at=?, updated_at=? ' +
      'WHERE id=?';
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

  /* ---- بازگردانی یک رکورد حذف‌شده ---- */
  function restoreTitle(row) {
    if (!row) return null;
    const now = new Date().toISOString();
    const sql = 'INSERT INTO titles (' + INSERT_COLS + ', created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      row.title,
      'love',
      row.type || 'series',
      row.genre || '',
      row.year || null,
      Number(row.rating) || 0,
      row.favorite ? 1 : 0,
      row.notes || '',
      row.watched_date || null,
      row.summary || '',
      row.original_title || '',
      row.seasons != null ? row.seasons : null,
      row.episodes != null ? row.episodes : null,
      row.episodes_per_season != null ? row.episodes_per_season : null,
      row.country || '',
      row.language || '',
      row.status || '',
      row.reason || '',
      row.story_analysis ? JSON.stringify(row.story_analysis) : '',
      row.ai_standardized_at || null,
      row.created_at || now,
      now
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

  /* ---- آمار بر اساس ستاره ---- */
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
    const rows = query(
      'SELECT CAST(rating AS INTEGER) AS stars, COUNT(*) AS count ' +
      'FROM titles GROUP BY CAST(rating AS INTEGER)'
    );
    const totals = query('SELECT COUNT(*) AS c, AVG(NULLIF(rating,0)) AS a, SUM(favorite) AS f FROM titles')[0];
    const rated = query('SELECT COUNT(*) AS c FROM titles WHERE rating > 0')[0];
    return {
      byStars: rows,
      totals: {
        count: totals ? totals.c : 0,
        avgRating: totals ? totals.a : 0,
        favorites: totals ? totals.f : 0,
        rated: rated ? rated.c : 0
      }
    };
  }

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
    const aWords = a.split(' ').filter(function (w) { return w.length > 1; });
    const bWords = b.split(' ').filter(function (w) { return w.length > 1; });
    if (!aWords.length || !bWords.length) return 0;
    let matches = 0;
    aWords.forEach(function (aw) {
      if (bWords.some(function (bw) {
        return bw === aw || (aw.length > 3 && bw.length > 3 && (bw.indexOf(aw) > -1 || aw.indexOf(bw) > -1));
      })) matches++;
    });
    return matches / Math.max(aWords.length, bWords.length);
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

  function exportBinary() { return db.export(); }
  function exportBase64() { return Utils.uint8ToBase64(exportBinary()); }
  function exportJSON() {
    return {
      version: CONFIG.APP_VERSION,
      exportedAt: new Date().toISOString(),
      titles: getAllTitles(),
      activity: getActivity(500)
    };
  }
  function importJSON(payload, replace) {
    if (!payload || !Array.isArray(payload.titles)) throw new Error('فایل نامعتبر');
    if (replace) run('DELETE FROM titles');
    let added = 0;
    payload.titles.forEach(function (t) {
      try {
        insertTitle({
          title: t.title,
          type: t.type || 'series',
          genre: t.genre || '',
          year: t.year,
          rating: t.rating || 0,
          favorite: t.favorite ? 1 : 0,
          notes: t.notes || '',
          watched_date: t.watched_date,
          summary: t.summary,
          original_title: t.original_title,
          seasons: t.seasons,
          episodes: t.episodes,
          episodes_per_season: t.episodes_per_season,
          country: t.country,
          language: t.language,
          status: t.status,
          reason: t.reason,
          story_analysis: t.story_analysis ? JSON.stringify(t.story_analysis) : '',
          ai_standardized_at: t.ai_standardized_at
        }, false);
        added++;
      } catch (e) {}
    });
    logActivity('import', 'titles', null, added + ' عنوان وارد شد');
    persistLocal();
    return added;
  }
  function importBinary(bytes) {
    db = new SQL.Database(bytes);
    SCHEMA.forEach(function (sql) { try { db.exec(sql); } catch (e) {} });
    runMigrations();
    ready = true;
    persistLocal();
  }
  function persistLocal() {
    try {
      localStorage.setItem(CONFIG.STORAGE.LOCAL_DB, exportBase64());
    } catch (e) { console.warn('[DB] persist failed:', e); }
  }

  async function pullFromGitHub() {
    const file = await GitHub.readFile();
    if (!file || !file.content) throw new Error('فایل روی گیت‌هاب پیدا نشد.');
    const bytes = Utils.base64ToUint8(file.content);
    db = new SQL.Database(bytes);
    SCHEMA.forEach(function (sql) { try { db.exec(sql); } catch (e) {} });
    runMigrations();
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
    query: query,
    run: run,
    insertTitle: insertTitle,
    updateTitle: updateTitle,
    deleteTitle: deleteTitle,
    restoreTitle: restoreTitle,
    getTitle: getTitle,
    getAllTitles: getAllTitles,
    getActivity: getActivity,
    getStarCounts: getStarCounts,
    getStats: getStats,
    logActivity: logActivity,
    findSimilar: findSimilar,
    exportBinary: exportBinary,
    exportBase64: exportBase64,
    exportJSON: exportJSON,
    importJSON: importJSON,
    importBinary: importBinary,
    persistLocal: persistLocal,
    pullFromGitHub: pullFromGitHub,
    pushToGitHub: pushToGitHub,
    getLastSha: getLastSha
  };
})();