/* =========================================================
   لایه‌ی دیتابیس با sql.js
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

  /* ---- راه‌اندازی ---- */
  async function init() {
    if (ready) return;
    bootMsg('در حال بارگذاری موتور SQL…');

    SQL = await initSqlJs({
      locateFile: (f) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}`
    });

    /* تلاش برای بارگذاری از گیت‌هاب */
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
          console.log('[DB] Loaded from GitHub. sha:', file.sha);
        }
      } catch (e) {
        console.warn('[DB] GitHub load failed:', e);
        Toast.warning('دریافت از گیت‌هاب ناموفق بود. از نسخه‌ی محلی استفاده می‌شود.');
      }
    }

    /* اگر از گیت‌هاب نیامد، از حافظه‌ی محلی */
    if (!loadedFromRemote) {
      const local = localStorage.getItem(CONFIG.STORAGE.LOCAL_DB);
      if (local) {
        try {
          const bytes = Utils.base64ToUint8(local);
          db = new SQL.Database(bytes);
          console.log('[DB] Loaded from localStorage');
        } catch (e) {
          console.warn('[DB] localStorage load failed:', e);
        }
      }
    }

    /* اگر هیچ‌جا نبود، دیتابیس جدید بساز */
    if (!db) {
      db = new SQL.Database();
      console.log('[DB] Fresh database');
    }

    /* اعمال schema */
    db.exec(SCHEMA);

    /* اگر جدول خالی بود، داده‌ی اولیه را وارد کن */
    const count = query('SELECT COUNT(*) AS c FROM titles')[0]?.c || 0;
    if (count === 0 && window.INITIAL_DATA) {
      bootMsg('در حال وارد کردن داده‌ی اولیه…');
      seedFromInitial();
      console.log('[DB] Seeded initial data');
    }

    setMeta('schema_version', 1);
    setMeta('last_boot', new Date().toISOString());

    ready = true;
    persistLocal();

    /* اگر از گیت‌هاب نیامد ولی کاربر تنظیم کرده، در پس‌زمینه ارسال کن */
    if (!loadedFromRemote && GitHub.isConfigured()) {
      setTimeout(() => { pushToGitHub().catch(() => {}); }, 1000);
    }
  }

  function bootMsg(msg) {
    const el = document.getElementById('boot-message');
    if (el) el.textContent = msg;
  }

  /* ---- بذر اولیه ---- */
  function seedFromInitial() {
    const data = window.INITIAL_DATA;
    if (!data) return;
    const now = new Date().toISOString();
    Object.entries(data).forEach(([cat, list]) => {
      list.forEach((title) => {
        insertTitle({
          title,
          category: cat,
          type: 'series',
          genre: '',
          year: null,
          rating: 0,
          favorite: 0,
          notes: '',
          watched_date: null
        }, false);
      });
    });
    logActivity('seed', 'titles', null, 'وارد کردن داده‌ی اولیه');
  }

  /* ---- تبدیل ردیف به آبجکت ---- */
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
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /* ---- کوئری عمومی ---- */
  function query(sql, params = []) {
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

  function run(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      stmt.run(params);
      stmt.free();
    } catch (e) {
      console.error('[DB] run error:', sql, e);
      throw e;
    }
  }

  /* ---- CRUD ---- */
  function insertTitle(data, log = true) {
    const now = new Date().toISOString();
    const sql = `INSERT INTO titles
      (title, category, type, genre, year, rating, favorite, notes, watched_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
      title=?, category=?, type=?, genre=?, year=?, rating=?, favorite=?, notes=?, watched_date=?, updated_at=?
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
      now,
      id
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
      SELECT
        category,
        COUNT(*) as count,
        AVG(NULLIF(rating,0)) as avg_rating,
        SUM(favorite) as favs,
        AVG(year) as avg_year
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

  /* ---- خروجی/ورودی ---- */
  function exportBinary() {
    return db.export();
  }

  function exportBase64() {
    return Utils.uint8ToBase64(exportBinary());
  }

  function exportJSON() {
    const titles = getAllTitles();
    const activity = getActivity(500);
    return {
      version: CONFIG.APP_VERSION,
      exportedAt: new Date().toISOString(),
      titles,
      activity
    };
  }

  function importJSON(payload, replace = false) {
    if (!payload || !Array.isArray(payload.titles)) throw new Error('فایل نامعتبر');
    if (replace) {
      run('DELETE FROM titles');
    }
    let added = 0;
    payload.titles.forEach(t => {
      try {
        insertTitle({
          title: t.title,
          category: t.category,
          type: t.type || 'series',
          genre: t.genre || '',
          year: t.year,
          rating: t.rating || 0,
          favorite: t.favorite ? 1 : 0,
          notes: t.notes || '',
          watched_date: t.watched_date
        }, false);
        added++;
      } catch (e) { /* skip invalid */ }
    });
    logActivity('import', 'titles', null, `${added} عنوان وارد شد`);
    persistLocal();
    return added;
  }

  function importBinary(bytes) {
    db = new SQL.Database(bytes);
    db.exec(SCHEMA);
    ready = true;
    persistLocal();
  }

  /* ---- ذخیره محلی ---- */
  function persistLocal() {
    try {
      const b64 = exportBase64();
      localStorage.setItem(CONFIG.STORAGE.LOCAL_DB, b64);
    } catch (e) {
      console.warn('[DB] localStorage persist failed (probably quota):', e);
    }
  }

  /* ---- سینک گیت‌هاب ---- */
  async function pullFromGitHub() {
    const file = await GitHub.readFile();
    if (!file || !file.content) throw new Error('فایل روی گیت‌هاب پیدا نشد.');
    const bytes = Utils.base64ToUint8(file.content);
    db = new SQL.Database(bytes);
    db.exec(SCHEMA);
    lastSha = file.sha;
    ready = true;
    persistLocal();
    return { sha: file.sha, size: file.size };
  }

  async function pushToGitHub(message = null) {
    const b64 = exportBase64();
    if (!lastSha) {
      // برای اطمینان از sha فعلی
      try {
        const info = await GitHub.readFile();
        lastSha = info ? info.sha : null;
      } catch (e) { lastSha = null; }
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
    getActivity, getCounts, getStats,
    logActivity,
    exportBinary, exportBase64, exportJSON,
    importJSON, importBinary,
    persistLocal,
    pullFromGitHub, pushToGitHub, getLastSha
  };
})();