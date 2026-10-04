/**
 * دیتابیس SQL.js با ذخیره‌سازی در IndexedDB و همگام‌سازی با GitHub
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

    // ============================================
    // راه‌اندازی
    // ============================================

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
            } else {
                this.db = new this.SQL.Database();
                this._createSchema();
                console.log('✅ دیتابیس جدید ساخته شد');
            }

            this.isReady = true;
            return true;
        } catch (error) {
            console.error('❌ خطا در راه‌اندازی SQLStorage:', error);
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
                created_at INTEGER,
                updated_at INTEGER
            );
        `);

        this.db.run(`
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL UNIQUE,
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
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp DESC);`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_stories_timestamp ON stories(timestamp DESC);`);

        this._scheduleSave();
    },

    // ============================================
    // عملیات CRUD
    // ============================================

    query(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    run(sql, params = []) {
        this.db.run(sql, params);
        this._scheduleSave();
    },

    // ============================================
    // افراد
    // ============================================

    getAllPeople() {
        return this.query('SELECT * FROM people ORDER BY created_at DESC');
    },

    getStarredPeople() {
        return this.query('SELECT * FROM people WHERE starred = 1 ORDER BY created_at DESC');
    },

    addPerson(person) {
        const id = person.id || Utils.generateId('person');
        const now = Date.now();
        this.run(
            `INSERT INTO people (id, name, description, starred, color, weight, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                person.name || 'بدون نام',
                person.description || '',
                person.starred ? 1 : 0,
                person.color || Utils.randomColor(),
                person.weight || 1,
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
            values.push(key === 'starred' ? (value ? 1 : 0) : value);
        });
        fields.push('updated_at = ?');
        values.push(Date.now());
        values.push(id);

        this.run(`UPDATE people SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.query('SELECT * FROM people WHERE id = ?', [id])[0];
    },

    removePerson(id) {
        this.run('DELETE FROM people WHERE id = ?', [id]);
    },

    // ============================================
    // آیتم‌ها
    // ============================================

    getAllItems() {
        return this.query('SELECT * FROM items ORDER BY created_at DESC');
    },

    addItem(label) {
        const id = Utils.generateId('item');
        const now = Date.now();
        try {
            this.run('INSERT INTO items (id, label, created_at) VALUES (?, ?, ?)', [id, label, now]);
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

    // ============================================
    // توصیفات
    // ============================================

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

    // ============================================
    // تاریخچه
    // ============================================

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

    // ============================================
    // داستان‌ها
    // ============================================

    addStory(story) {
        this.run(
            `INSERT INTO stories (id, content, model, context, timestamp)
             VALUES (?, ?, ?, ?, ?)`,
            [
                story.id,
                story.content,
                story.model,
                story.context || '',
                story.timestamp || Date.now(),
            ]
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

    // ============================================
    // تنظیمات
    // ============================================

    setSetting(key, value) {
        this.run(
            `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
            [key, JSON.stringify(value)]
        );
    },

    getSetting(key) {
        const rows = this.query('SELECT value FROM settings WHERE key = ?', [key]);
        if (rows.length === 0) return null;
        try {
            return JSON.parse(rows[0].value);
        } catch {
            return rows[0].value;
        }
    },

    // ============================================
    // ذخیره‌سازی محلی (IndexedDB)
    // ============================================

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
            this._saveToIndexedDB().catch((e) =>
                console.error('خطا در ذخیره‌سازی SQL:', e)
            );
        }, 500);
    },

    async saveNow() {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        await this._saveToIndexedDB();
    },

    // ============================================
    // همگام‌سازی با GitHub
    // ============================================

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
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    },

    async pushToGitHub(message = 'به‌روزرسانی دیتابیس SQLite') {
        if (!GitHubStorage.isConfigured()) {
            throw new Error('تنظیمات GitHub کامل نیست');
        }

        const config = GitHubStorage.getConfig();
        const binaryArray = this.db.export();
        const base64Content = this._uint8ToBase64(binaryArray);
        const path = 'data/wheel_db.sqlite';

        let sha = null;
        try {
            const existing = await GitHubStorage.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
            );
            sha = existing.sha;
        } catch (e) {
            // فایل جدید است
        }

        const body = {
            message,
            content: base64Content,
            branch: config.branch,
        };
        if (sha) body.sha = sha;

        await GitHubStorage.request(
            `/repos/${config.owner}/${config.repo}/contents/${path}`,
            {
                method: 'PUT',
                body: JSON.stringify(body),
            }
        );

        Notification.success('دیتابیس با موفقیت به GitHub ارسال شد');
        return { path, size: binaryArray.length, sha };
    },

    async pullFromGitHub() {
        if (!GitHubStorage.isConfigured()) {
            throw new Error('تنظیمات GitHub کامل نیست');
        }

        const config = GitHubStorage.getConfig();
        const path = 'data/wheel_db.sqlite';

        try {
            const data = await GitHubStorage.request(
                `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`
            );

            const binaryArray = this._base64ToUint8(
                data.content.replace(/\n/g, '')
            );

            if (this.db) this.db.close();
            this.db = new this.SQL.Database(binaryArray);

            await this.saveNow();

            Notification.success('دیتابیس از GitHub بارگذاری شد');
            return true;
        } catch (error) {
            if (error.message.includes('404')) {
                Notification.warning('فایل دیتابیس در GitHub یافت نشد');
                return false;
            }
            throw error;
        }
    },

    downloadDatabase() {
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
        await this.saveNow();

        Notification.success('دیتابیس بارگذاری شد');
    },

    // ============================================
    // ابزارهای کمکی
    // ============================================

    _camelToSnake(str) {
        return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    },

    getInfo() {
        if (!this.db) return null;
        const size = this.db.export().length;
        const peopleCount = this.query('SELECT COUNT(*) as c FROM people')[0].c;
        const itemsCount = this.query('SELECT COUNT(*) as c FROM items')[0].c;
        const historyCount = this.query('SELECT COUNT(*) as c FROM history')[0].c;
        const storiesCount = this.query('SELECT COUNT(*) as c FROM stories')[0].c;

        return {
            size,
            sizeFormatted: Utils.formatBytes(size),
            peopleCount,
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