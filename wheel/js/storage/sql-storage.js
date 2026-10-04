/**
 * دیتابیس SQL.js
 * - people = جعبه ابزار (toolbox)
 * - ستون in_wheel مشخص می‌کند چه کسی در گردونه (کارگاه) هست
 * - رمزها هرگز در SQLite ذخیره نمی‌شوند
 * @module SQLStorage
 */

const SQLStorage = {
    db: null,
    SQL: null,
    isReady: false,
    dbName: 'wheel_db.sqlite',
    idbStoreName: 'sqlite_store',
    idbKey: 'main_db',
    _idb: null,
    _saveTimer: null,
    SECRET_KEYS: ['githubToken', 'openrouterApiKey'],

    async init() {
        if (this.isReady) return;

        try {
            this.SQL = await initSqlJs({
                locateFile: (file) =>
                    `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
            });

            this._idb = await this._openIndexedDB();
            const existing = await this._loadFromIndexedDB();

            if (existing) {
                this.db = new this.SQL.Database(existing);
                console.log('✅ دیتابیس از IndexedDB بارگذاری شد');
                this._migrateSecretsToLocalStorage();
            } else {
                this.db = new this.SQL.Database();
                this._createSchema();
                console.log('✅ دیتابیس جدید ساخته شد');
            }

            this._migrateSchema();

            this.isReady = true;
            return true;
        } catch (error) {
            console.error('❌ خطا در SQLStorage:', error);
            throw error;
        }
    },

    _openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('wheel-app-storage', 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.idbStoreName)) {
                    db.createObjectStore(this.idbStoreName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    _createSchema() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS people (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                starred INTEGER DEFAULT 0,
                color TEXT DEFAULT '#8b5cf6',
                weight REAL DEFAULT 1,
                in_wheel INTEGER DEFAULT 1,
                created_at INTEGER,
                updated_at INTEGER
            );
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL UNIQUE,
                in_wheel INTEGER DEFAULT 1,
                created_at INTEGER
            );
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS descriptions (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at INTEGER
            );
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                winner_id TEXT,
                winner_name TEXT,
                mode TEXT,
                spin_type TEXT,
                timestamp INTEGER
            );
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                content TEXT,
                model TEXT,
                context TEXT,
                timestamp INTEGER
            );
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);

        this.db.run(`CREATE INDEX IF NOT EXISTS idx_people_starred ON people(starred);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_people_in_wheel ON people(in_wheel);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_stories_timestamp ON stories(timestamp DESC);`);

        this._scheduleSave();
    },

    /**
     * مهاجرت schema - افزودن ستون‌های جدید به جداول موجود
     */
    _migrateSchema() {
        // people.in_wheel
        try {
            const cols = this.query(`PRAGMA table_info(people)`);
            const hasInWheel = cols.some((c) => c.name === 'in_wheel');
            if (!hasInWheel) {
                this.db.run(`ALTER TABLE people ADD COLUMN in_wheel INTEGER DEFAULT 1`);
                console.log('✅ ستون in_wheel به people اضافه شد');
                this._scheduleSave();
            }
        } catch (e) {
            console.error('خطا در مهاجرت people:', e);
        }

        // items.in_wheel
        try {
            const cols = this.query(`PRAGMA table_info(items)`);
            const hasInWheel = cols.some((c) => c.name === 'in_wheel');
            if (!hasInWheel) {
                this.db.run(`ALTER TABLE items ADD COLUMN in_wheel INTEGER DEFAULT 1`);
                console.log('✅ ستون in_wheel به items اضافه شد');
                this._scheduleSave();
            }
        } catch (e) {
            console.error('خطا در مهاجرت items:', e);
        }
    },

    _migrateSecretsToLocalStorage() {
        let changed = false;
        this.SECRET_KEYS.forEach((key) => {
            try {
                const rows = this.query('SELECT value FROM settings WHERE key = ?', [key]);
                if (rows.length > 0) {
                    let val = rows[0].value;
                    try { val = JSON.parse(val); } catch (e) {}
                    if (val) LocalStorage.set('secret_' + key, val);
                    this.db.run(`DELETE FROM settings WHERE key = ?`, [key]);
                    changed = true;
                }
            } catch (e) {}
        });
        if (changed) this._scheduleSave();
    },

    query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
    },

    run(sql, params = []) {
        this.db.run(sql, params);
        this._scheduleSave();
    },

    // ═══════════════════════════════════════════
    // افراد (جعبه ابزار + کارگاه)
    // ═══════════════════════════════════════════

    /** همه افراد (جعبه ابزار) */
    getAllPeople() {
        return this.query('SELECT * FROM people ORDER BY created_at DESC');
    },

    /** فقط افرادی که در گردونه (کارگاه) هستند */
    getWheelPeople() {
        return this.query('SELECT * FROM people WHERE in_wheel = 1 ORDER BY created_at DESC');
    },

    /** افراد ستاره‌دار که در گردونه هستند */
    getStarredWheelPeople() {
        return this.query(
            'SELECT * FROM people WHERE starred = 1 AND in_wheel = 1 ORDER BY created_at DESC'
        );
    },

    addPerson(person) {
        const id = person.id || Utils.generateId('person');
        const now = Date.now();
        const inWheel = person.in_wheel !== undefined ? (person.in_wheel ? 1 : 0) : 1;
        this.run(
            `INSERT INTO people (id, name, description, starred, color, weight, in_wheel, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                person.name || 'بدون نام',
                person.description || '',
                person.starred ? 1 : 0,
                person.color || Utils.randomColor(),
                person.weight || 1,
                inWheel,
                now,
                now,
            ]
        );
        return this.query('SELECT * FROM people WHERE id = ?', [id])[0];
    },

    updatePerson(id, updates) {
        const fields = [];
        const values = [];
        Object.entries(updates).forEach(([key, value]) => {
            const column = this._camelToSnake(key);
            fields.push(`${column} = ?`);
            if (key === 'starred' || key === 'inWheel') {
                values.push(value ? 1 : 0);
            } else {
                values.push(value);
            }
        });
        fields.push('updated_at = ?');
        values.push(Date.now());
        values.push(id);

        this.run(`UPDATE people SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.query('SELECT * FROM people WHERE id = ?', [id])[0];
    },

    /** حذف واقعی از دیتابیس (جعبه ابزار) */
    removePerson(id) {
        this.run('DELETE FROM people WHERE id = ?', [id]);
    },

    /** افزودن به گردونه (فقط علامت‌گذاری) */
    addPersonToWheel(id) {
        this.run('UPDATE people SET in_wheel = 1, updated_at = ? WHERE id = ?', [Date.now(), id]);
    },

    /** حذف از گردونه (فقط علامت‌برداری) */
    removePersonFromWheel(id) {
        this.run('UPDATE people SET in_wheel = 0, updated_at = ? WHERE id = ?', [Date.now(), id]);
    },

    // ═══════════════════════════════════════════
    // آیتم‌ها
    // ═══════════════════════════════════════════

    getAllItems() {
        return this.query('SELECT * FROM items ORDER BY created_at DESC');
    },

    addItem(label) {
        const id = Utils.generateId('item');
        const now = Date.now();
        try {
            this.run('INSERT INTO items (id, label, in_wheel, created_at) VALUES (?, ?, 1, ?)', [id, label, now]);
            return this.query('SELECT * FROM items WHERE id = ?', [id])[0];
        } catch (e) {
            if (e.message.includes('UNIQUE')) {
                Notification.warning('این آیتم قبلاً وجود دارد');
                return null;
            }
            throw e;
        }
    },

    removeItem(id) {
        this.run('DELETE FROM items WHERE id = ?', [id]);
    },

    // ═══════════════════════════════════════════
    // توصیفات
    // ═══════════════════════════════════════════

    getAllDescriptions() {
        return this.query('SELECT * FROM descriptions');
    },

    setDescription(key, value) {
        this.run(
            `INSERT OR REPLACE INTO descriptions (key, value, updated_at) VALUES (?, ?, ?)`,
            [key, value, Date.now()]
        );
    },

    removeDescription(key) {
        this.run('DELETE FROM descriptions WHERE key = ?', [key]);
    },

    // ═══════════════════════════════════════════
    // تاریخچه
    // ═══════════════════════════════════════════

    addHistory(record) {
        const id = Utils.generateId('hist');
        this.run(
            `INSERT INTO history (id, winner_id, winner_name, mode, spin_type, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id,
                record.winner?.id || null,
                record.winner?.name || record.winner?.label || '',
                record.mode || 'single',
                record.spinType || 'random',
                Date.now(),
            ]
        );
    },

    getHistory(limit = 100) {
        return this.query('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?', [limit]);
    },

    clearHistory() {
        this.run('DELETE FROM history');
    },

    // ═══════════════════════════════════════════
    // داستان‌ها
    // ═══════════════════════════════════════════

    addStory(story) {
        this.run(
            `INSERT INTO stories (id, content, model, context, timestamp) VALUES (?, ?, ?, ?, ?)`,
            [story.id, story.content, story.model, story.context || '', story.timestamp || Date.now()]
        );
    },

    getAllStories(limit = 50) {
        return this.query('SELECT * FROM stories ORDER BY timestamp DESC LIMIT ?', [limit]);
    },

    removeStory(id) {
        this.run('DELETE FROM stories WHERE id = ?', [id]);
    },

    clearStories() {
        this.run('DELETE FROM stories');
    },

    // ═══════════════════════════════════════════
    // تنظیمات
    // ═══════════════════════════════════════════

    setSetting(key, value) {
        if (this.SECRET_KEYS.includes(key)) {
            LocalStorage.set('secret_' + key, value);
            return;
        }
        this.run(
            `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
            [key, JSON.stringify(value)]
        );
    },

    getSetting(key) {
        if (this.SECRET_KEYS.includes(key)) {
            return LocalStorage.get('secret_' + key, null);
        }
        const rows = this.query('SELECT value FROM settings WHERE key = ?', [key]);
        if (rows.length === 0) return null;
        try { return JSON.parse(rows[0].value); } catch { return rows[0].value; }
    },

    // ═══════════════════════════════════════════
    // IndexedDB
    // ═══════════════════════════════════════════

    async _saveToIndexedDB() {
        if (!this.db || !this._idb) return;
        const binaryArray = this.db.export();
        return new Promise((resolve, reject) => {
            const tx = this._idb.transaction(this.idbStoreName, 'readwrite');
            const store = tx.objectStore(this.idbStoreName);
            const request = store.put(binaryArray, this.idbKey);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async _loadFromIndexedDB() {
        if (!this._idb) return null;
        return new Promise((resolve, reject) => {
            const tx = this._idb.transaction(this.idbStoreName, 'readonly');
            const store = tx.objectStore(this.idbStoreName);
            const request = store.get(this.idbKey);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    _scheduleSave() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveToIndexedDB().catch((e) => console.error('خطا در ذخیره:', e));
        }, 500);
    },

    async saveNow() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        await this._saveToIndexedDB();
    },

    // ═══════════════════════════════════════════
    // GitHub Sync
    // ═══════════════════════════════════════════

    _uint8ToBase64(uint8) {
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    },

    _base64ToUint8(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    },

    async pushToGitHub(message = 'به‌روزرسانی دیتابیس') {
        if (!GitHubStorage.isConfigured()) throw new Error('تنظیمات GitHub کامل نیست');

        this.SECRET_KEYS.forEach((k) => {
            try { this.db.run(`DELETE FROM settings WHERE key = ?`, [k]); } catch (e) {}
        });

        const binaryArray = this.db.export();
        const base64Content = this._uint8ToBase64(binaryArray);
        await GitHubStorage.saveBinaryFile('data/wheel_db.sqlite', base64Content, message);
        Notification.success('دیتابیس به GitHub ارسال شد');
        return { size: binaryArray.length };
    },

    async pullFromGitHub() {
        if (!GitHubStorage.isConfigured()) throw new Error('تنظیمات GitHub کامل نیست');
        const config = GitHubStorage.getConfig();
        const branch = await GitHubStorage.resolveBranch();

        const secretsBackup = {};
        this.SECRET_KEYS.forEach((k) => {
            secretsBackup[k] = LocalStorage.get('secret_' + k, null);
        });

        try {
            const data = await GitHubStorage.request(
                `/repos/${config.owner}/${config.repo}/contents/data/wheel_db.sqlite?ref=${branch}`
            );
            const binaryArray = this._base64ToUint8(data.content.replace(/\n/g, ''));

            if (this.db) this.db.close();
            this.db = new this.SQL.Database(binaryArray);

            this.SECRET_KEYS.forEach((k) => {
                try { this.db.run(`DELETE FROM settings WHERE key = ?`, [k]); } catch (e) {}
            });
            this.SECRET_KEYS.forEach((k) => {
                if (secretsBackup[k]) LocalStorage.set('secret_' + k, secretsBackup[k]);
            });

            this._migrateSchema();
            await this.saveNow();
            Notification.success('دیتابیس از GitHub بارگذاری شد');
            return true;
        } catch (error) {
            if (error.message.includes('۴۰۴') || error.message.includes('404')) {
                Notification.warning('فایل دیتابیس در GitHub نیست');
                return false;
            }
            throw error;
        }
    },

    downloadDatabase() {
        this.SECRET_KEYS.forEach((k) => {
            try { this.db.run(`DELETE FROM settings WHERE key = ?`, [k]); } catch (e) {}
        });
        const binaryArray = this.db.export();
        const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.dbName;
        a.click();
        URL.revokeObjectURL(url);
    },

    async loadFromFile(file) {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        if (this.db) this.db.close();
        this.db = new this.SQL.Database(uint8);
        this.SECRET_KEYS.forEach((k) => {
            try { this.db.run(`DELETE FROM settings WHERE key = ?`, [k]); } catch (e) {}
        });
        this._migrateSchema();
        await this.saveNow();
        Notification.success('دیتابیس بارگذاری شد');
    },

    _camelToSnake(str) {
        return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    },

    getInfo() {
        if (!this.db) return null;
        const size = this.db.export().length;
        const peopleCount = this.query('SELECT COUNT(*) as c FROM people')[0].c;
        const wheelCount = this.query('SELECT COUNT(*) as c FROM people WHERE in_wheel = 1')[0].c;
        const itemsCount = this.query('SELECT COUNT(*) as c FROM items')[0].c;
        const historyCount = this.query('SELECT COUNT(*) as c FROM history')[0].c;
        const storiesCount = this.query('SELECT COUNT(*) as c FROM stories')[0].c;

        return {
            size,
            sizeFormatted: Utils.formatBytes(size),
            peopleCount,
            wheelCount,
            itemsCount,
            historyCount,
            storiesCount,
        };
    },

    async reset() {
        if (this.db) this.db.close();
        this.db = new this.SQL.Database();
        this._createSchema();
        await this.saveNow();
        Notification.info('دیتابیس بازنشانی شد');
    },
};

window.SQLStorage = SQLStorage;