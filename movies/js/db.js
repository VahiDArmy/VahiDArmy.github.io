/* =========================================================
   لایه‌ی دیتابیس با sql.js (با پشتیبانی از فیلدهای AI)
   ========================================================= */
window.DB = (function () {
  let SQL = null;
  let db = null;
  let lastSha = null;
  let ready = false;

  const SCHEMA = `
    CREATE TABLE IF NOT EXISTS titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('love','good','hate')),
      type TEXT NOT NULL DEFAULT 'series',
      genre TEXT DEFAULT '',
      year INTEGER,
      rating REAL DEFAULT 0,
      favorite INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      watched_date TEXT,
      summary TEXT DEFAULT '',
      original_title TEXT DEFAULT '',
      seasons INTEGER,
      episodes INTEGER,
      episodes_per_season INTEGER,
      country TEXT DEFAULT '',
      language TEXT DEFAULT '',
      status TEXT DEFAULT '',
      ai_standardized_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_titles_cat ON titles(category);
    CREATE INDEX IF NOT EXISTS idx_titles_rating ON titles(rating);
    CREATE INDEX IF NOT EXISTS idx_titles_created ON titles(created_at);

    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity TEXT,
      entity_id INTEGER,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at);

    CREATE TABLE IF NOT EXISTS meta (
      k TEXT PRIMARY KEY,
      v TEXT
    );
  `;

  /* ---- اطمینان از وجود ستون ---- */
  function ensureColumn(table, col, type) {
    try {
      const info = query(`PRAGMA table_info(${table})`);
      if (!info.some(c => c.name === col)) {
        run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
        console.log(`[DB] Migrated: added ${table}.${col} ${type}`);
      }
    } catch (e) {
      console.warn(`[DB] ensureColumn failed for ${table}.${col}:`, e);
    }
  }

  function runMigrations() {
    const migrations = [
      ['titles', 'summary', "TEXT DEFAULT ''"],
      ['titles', 'original_title', "TEXT DEFAULT ''"],
      ['titles', 'seasons', 'INTEGER'],
      ['titles', 'episodes', 'INTEGER'],
      ['titles', 'episodes_per_season', 'INTEGER'],
      ['titles', 'country', "TEXT DEFAULT ''"],
      ['titles', 'language', "TEXT DEFAULT ''"],
      ['titles', 'status', "TEXT DEFAULT ''"],
      ['titles', 'ai_standardized_at', 'TEXT']
    ];
    migrations.forEach(([t, c, ty]) => ensureColumn(t, c, ty));
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

  function logActivity(action, entity = null, entityId = null, detail = '') {
    try {
      const stmt = db.prepare(
        'INSERT INTO activity(action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?)'
      );
      stmt.run([action, entity, entityId, detail, new Date().toISOString()]);
      stmt.free();
    } catch (e) { console.warn('activity log failed', e); }
  }

  async function init() {
    if (ready) return;
    bootMsg('در حال بارگذاری موتور SQL…');

    SQL = await initSqlJs({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}`
    });

    let loadedFromRemote = false;
    if (GitHub.isConfigured()) {
      bootMsg('در حال دریافت دیتابیس از گیت‌هاب…');
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
      }
    }

    if (!loadedFromRemote) {
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

    db.exec(SCHEMA);
    runMigrations();

    const count = query('SELECT COUNT(*) AS c FROM titles')[0]?.c || 0;
    if (count === 0 && window.INITIAL_DATA) {
      bootMsg('در حال وارد کردن داده‌ی اولیه…');
      seedFromInitial();
    }

    setMeta('schema_version', 2);
    setMeta('last_boot', new Date().toISOString());

    ready = true;
    persistLocal();

    if (!loadedFromRemote && GitHub.isConfigured()) {
      setTimeout(() => { pushToGitHub().catch(() => {}); }, 1000);
    }
  }

  function bootMsg(msg) {
    const el = document.getElementById('boot-message');
    if (el) el.textContent = msg;
  }

  function seedFromInitial() {
    const data = window.INITIAL_DATA;
    if (!data) return;
    Object.entries(data).forEach(([cat, list]) => {
      list.forEach((title) => {
        insertTitle({
          title, category: cat, type: 'series', genre: '',
          year: null, rating: 0, favorite: 0, notes: '', watched_date: null
        }, false);
      });
    });
    logActivity('seed', 'titles', null, 'وارد کردن داده‌ی اولیه');
  }

  function rowToObj(row) {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      type: row.type || 'series',
      genre: row.genre || '',
      year: row.year || null,
      rating: row.rating || 0,
      favorite: !!row.favorite,
      notes: row.notes || '',
      watched_date: row.watched_date || null,
      summary: row.summary || '',
      original_title: row.original_title || '',
      seasons: row.seasons ?? null,
      episodes: row.episodes ?? null,
      episodes_per_season: row.episodes_per_season ?? null,
      country: row.country || '',
      language: row.language || '',
      status: row.status || '',
      ai_standardized_at: row.ai_standardized_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function query(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      if (params.length) stmt.bind(params);
      const out = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      stmt.free();
      return out;
    } catch (e) { console.error('[DB] query error:', sql, e); throw e; }
  }

  function run(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      stmt.run(params);
      stmt.free();
    } catch (e) { console.error('[DB] run error:', sql, e); throw e; }
  }

  const ALL_COLS = `title, category, type, genre, year, rating, favorite, notes, watched_date,
                    summary, original_title, seasons, episodes, episodes_per_season,
                    country, language, status, ai_standardized_at`;

  function insertTitle(data, log = true) {
    const now = new Date().toISOString();
    const sql = `INSERT INTO titles
      (${ALL_COLS}, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      String(data.title || '').trim(),
      data.category,
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
      data.ai_standardized_at || null,
      now, now
    ];
    run(sql, params);
    const res = query('SELECT last_insert_rowid() AS id')[0];
    const id = res?.id;
    if (log) logActivity('create', 'title', id, data.title);
    persistLocal();
    return id;
  }

  function updateTitle(id, data, log = true) {
    const now = new Date().toISOString();
    const sql = `UPDATE titles SET
      title=?, category=?, type=?, genre=?, year=?, rating=?, favorite=?, notes=?, watched_date=?,
      summary=?, original_title=?, seasons=?, episodes=?, episodes_per_season=?,
      country=?, language=?, status=?, ai_standardized_at=?, updated_at=?
      WHERE id=?`;
    const params = [
      String(data.title || '').trim(),
      data.category,
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
      data.ai_standardized_at || null,
      now, id
    ];
    run(sql, params);
    if (log) logActivity('update', 'title', id, data.title);
    persistLocal();
  }

  function deleteTitle(id, log = true) {
    const row = getTitle(id);
    run('DELETE FROM titles WHERE id=?', [id]);
    if (log && row) logActivity('delete', 'title', id, row.title);
    persistLocal();
  }

  function getTitle(id) {
    const rows = query('SELECT * FROM titles WHERE id=?', [id]);
    return rows[0] ? rowToObj(rows[0]) : null;
  }
  function getAllTitles() {
    return query('SELECT * FROM titles ORDER BY created_at DESC').map(rowToObj);
  }
  function getTitlesByCategory(cat) {
    return query('SELECT * FROM titles WHERE category=? ORDER BY created_at DESC', [cat]).map(rowToObj);
  }
  function getActivity(limit = 30) {
    return query('SELECT * FROM activity ORDER BY id DESC LIMIT ?', [limit]);
  }
  function getCounts() {
    const rows = query('SELECT category, COUNT(*) AS c FROM titles GROUP BY category');
    const out = { all: 0, love: 0, good: 0, hate: 0 };
    rows.forEach(r => { out[r.category] = r.c; out.all += r.c; });
    return out;
  }
  function getStats() {
    const rows = query(`
      SELECT category, COUNT(*) as count,
        AVG(NULLIF(rating,0)) as avg_rating,
        SUM(favorite) as favs, AVG(year) as avg_year
      FROM titles GROUP BY category
    `);
    const totals = query('SELECT COUNT(*) as c, AVG(NULLIF(rating,0)) as a, SUM(favorite) as f FROM titles')[0];
    return {
      byCategory: rows,
      totals: {
        count: totals?.c || 0,
        avgRating: totals?.a || 0,
        favorites: totals?.f || 0
      }
    };
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
  function importJSON(payload, replace = false) {
    if (!payload || !Array.isArray(payload.titles)) throw new Error('فایل نامعتبر');
    if (replace) run('DELETE FROM titles');
    let added = 0;
    payload.titles.forEach(t => {
      try {
        insertTitle({
          title: t.title, category: t.category, type: t.type || 'series',
          genre: t.genre || '', year: t.year, rating: t.rating || 0,
          favorite: t.favorite ? 1 : 0, notes: t.notes || '',
          watched_date: t.watched_date,
          summary: t.summary, original_title: t.original_title,
          seasons: t.seasons, episodes: t.episodes,
          episodes_per_season: t.episodes_per_season,
          country: t.country, language: t.language, status: t.status,
          ai_standardized_at: t.ai_standardized_at
        }, false);
        added++;
      } catch {}
    });
    logActivity('import', 'titles', null, `${added} عنوان وارد شد`);
    persistLocal();
    return added;
  }
  function importBinary(bytes) {
    db = new SQL.Database(bytes);
    db.exec(SCHEMA);
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
    db.exec(SCHEMA);
    runMigrations();
    lastSha = file.sha;
    ready = true;
    persistLocal();
    return { sha: file.sha, size: file.size };
  }
  async function pushToGitHub(message = null) {
    const b64 = exportBase64();
    if (!lastSha) {
      try {
        const info = await GitHub.readFile();
        lastSha = info ? info.sha : null;
      } catch { lastSha = null; }
    }
    const commitMsg = message || (CONFIG.GITHUB.COMMIT_PREFIX + Utils.toJalaliLong(new Date()));
    const res = await GitHub.writeFile(b64, commitMsg, lastSha);
    lastSha = res.content?.sha || null;
    setMeta('last_push', new Date().toISOString());
    persistLocal();
    return res;
  }
  function getLastSha() { return lastSha; }

  return {
    init, ready: () => ready,
    query, run,
    insertTitle, updateTitle, deleteTitle,
    getTitle, getAllTitles, getTitlesByCategory,
    getActivity, getCounts, getStats, logActivity,
    exportBinary, exportBase64, exportJSON,
    importJSON, importBinary, persistLocal,
    pullFromGitHub, pushToGitHub, getLastSha
  };
})();