/**
 * سرویس ذخیره‌سازی
 * مدیریت localStorage و IndexedDB
 */
class StorageService {
  constructor(options = {}) {
    this.prefix = options.prefix || 'dbmanager_';
    this.useIndexedDB = options.useIndexedDB !== false;
    this.dbName = options.dbName || 'DatabaseManager';
    this.dbVersion = options.dbVersion || 1;
    this.stores = options.stores || ['databases', 'settings', 'history'];
    this.db = null;
    this.dbPromise = null;
    this.listeners = new Map();
    this.memoryCache = new Map();
  }

  /**
   * راه‌اندازی IndexedDB
   */
  async init() {
    if (!this.useIndexedDB || typeof indexedDB === 'undefined') {
      return false;
    }

    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        this.stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('createdAt', 'createdAt', { unique: false });
          }
        });
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * ذخیره در localStorage
   */
  set(key, value) {
    try {
      const fullKey = this.prefix + key;
      const serialized = JSON.stringify({
        value,
        timestamp: Date.now()
      });
      localStorage.setItem(fullKey, serialized);
      this.memoryCache.set(key, value);
      this.emit('set', { key, value });
      return true;
    } catch (error) {
      console.error('خطا در ذخیره:', error);
      this.emit('error', { operation: 'set', key, error });
      return false;
    }
  }

  /**
   * بازیابی از localStorage
   */
  get(key, defaultValue = null) {
    try {
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key);
      }

      const fullKey = this.prefix + key;
      const stored = localStorage.getItem(fullKey);

      if (!stored) return defaultValue;

      const parsed = JSON.parse(stored);
      const value = parsed.value !== undefined ? parsed.value : parsed;

      this.memoryCache.set(key, value);
      return value;
    } catch (error) {
      console.error('خطا در بازیابی:', error);
      return defaultValue;
    }
  }

  /**
   * حذف از localStorage
   */
  remove(key) {
    try {
      const fullKey = this.prefix + key;
      localStorage.removeItem(fullKey);
      this.memoryCache.delete(key);
      this.emit('remove', { key });
      return true;
    } catch (error) {
      console.error('خطا در حذف:', error);
      return false;
    }
  }

  /**
   * پاک کردن همه
   */
  clear() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      this.memoryCache.clear();
      this.emit('cleared');
      return true;
    } catch (error) {
      console.error('خطا در پاک‌سازی:', error);
      return false;
    }
  }

  /**
   * دریافت همه کلیدها
   */
  keys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }

  /**
   * بررسی وجود کلید
   */
  has(key) {
    return localStorage.getItem(this.prefix + key) !== null;
  }

  /**
   * ذخیره در IndexedDB
   */
  async setDB(storeName, data, id = null) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const item = { ...data, updatedAt: Date.now() };
      if (id) item.id = id;
      if (!item.createdAt) item.createdAt = Date.now();

      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * بازیابی از IndexedDB
   */
  async getDB(storeName, id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * دریافت همه از IndexedDB
   */
  async getAllDB(storeName) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * حذف از IndexedDB
   */
  async removeDB(storeName, id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * پاک کردن store
   */
  async clearDB(storeName) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * ذخیره پایگاه داده
   */
  async saveDatabase(name, data, metadata = {}) {
    return this.setDB('databases', {
      name,
      data,
      size: data instanceof Uint8Array ? data.length : 0,
      metadata
    });
  }

  /**
   * بازیابی پایگاه داده
   */
  async loadDatabase(id) {
    return this.getDB('databases', id);
  }

  /**
   * دریافت همه پایگاه‌های داده
   */
  async getAllDatabases() {
    return this.getAllDB('databases');
  }

  /**
   * حذف پایگاه داده
   */
  async deleteDatabase(id) {
    return this.removeDB('databases', id);
  }

  /**
   * ذخیره تنظیمات
   */
  async saveSettings(settings) {
    return this.setDB('settings', { name: 'app_settings', ...settings }, 1);
  }

  /**
   * بازیابی تنظیمات
   */
  async loadSettings() {
    try {
      return await this.getDB('settings', 1);
    } catch (error) {
      return null;
    }
  }

  /**
   * محاسبه حجم استفاده‌شده
   */
  async getStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: estimate.quota > 0 ? (estimate.usage / estimate.quota) * 100 : 0
      };
    }

    // تخمین از localStorage
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        total += (localStorage.getItem(key) || '').length;
      }
    }

    return { usage: total, quota: 5 * 1024 * 1024, percentage: (total / (5 * 1024 * 1024)) * 100 };
  }

  /**
   * ثبت شنونده
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  /**
   * انتشار رویداد
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`خطا در شنونده "${event}":`, error);
        }
      });
    }
  }
}

const storageService = new StorageService();