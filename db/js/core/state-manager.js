/**
 * مدیر وضعیت (State Manager)
 * مدیریت متمرکز وضعیت برنامه با قابلیت اشتراک
 */
class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.subscribers = new Map();
    this.globalSubscribers = new Set();
    this.middlewares = [];
    this.history = [];
    this.maxHistory = 50;
    this.debug = false;
    this._isUpdating = false;
  }

  /**
   * دریافت وضعیت
   * @param {string} key - کلید وضعیت (اختیاری)
   * @returns {*} مقدار وضعیت
   */
  get(key) {
    if (!key) return { ...this.state };

    return key.split('.').reduce((obj, part) => {
      return obj && obj[part] !== undefined ? obj[part] : undefined;
    }, this.state);
  }

  /**
   * تنظیم وضعیت
   * @param {string|Object} key - کلید یا شیء وضعیت
   * @param {*} value - مقدار جدید
   * @param {Object} options - تنظیمات
   */
  set(key, value, options = {}) {
    if (this._isUpdating) {
      console.warn('به‌روزرسانی تودرتو در StateManager');
    }

    this._isUpdating = true;

    try {
      let oldState;
      let newState;

      if (typeof key === 'object') {
        // تنظیم چندین کلید
        oldState = { ...this.state };
        newState = { ...this.state, ...key };
        this.state = newState;
      } else {
        // تنظیم یک کلید
        const parts = key.split('.');
        oldState = this.get(key);
        newState = this._setNested(key, value);
      }

      // اجرای میان‌افزارها
      for (const middleware of this.middlewares) {
        middleware(key, this.state, oldState);
      }

      // ثبت در تاریخچه
      this._addToHistory(key, oldState, this.get(key));

      // اطلاع‌رسانی به مشترکین
      this._notify(key, this.get(key), oldState);

      if (this.debug) {
        console.log(`[StateManager] "${key}" تغییر کرد:`, {
          from: oldState,
          to: this.get(key)
        });
      }
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * تنظیم تودرتوی کلید
   */
  _setNested(key, value) {
    const parts = key.split('.');
    const newState = { ...this.state };
    let current = newState;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      } else {
        current[parts[i]] = { ...current[parts[i]] };
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    this.state = newState;
    return newState;
  }

  /**
   * به‌روزرسانی وضعیت با تابع
   */
  update(key, updater) {
    const currentValue = this.get(key);
    const newValue = typeof updater === 'function'
      ? updater(currentValue)
      : updater;

    this.set(key, newValue);
  }

  /**
   * ادغام وضعیت
   */
  merge(key, value) {
    const current = this.get(key) || {};
    this.set(key, { ...current, ...value });
  }

  /**
   * حذف کلید
   */
  remove(key) {
    const parts = key.split('.');
    const newState = { ...this.state };
    let current = newState;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) return;
      current[parts[i]] = { ...current[parts[i]] };
      current = current[parts[i]];
    }

    delete current[parts[parts.length - 1]];
    this.state = newState;
    this._notify(key, undefined);
  }

  /**
   * اشتراک در تغییرات
   * @param {string} key - کلید وضعیت
   * @param {Function} callback - تابع callback
   * @returns {Function} تابع لغو اشتراک
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key).add(callback);

    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * اشتراک سراسری
   */
  subscribeAll(callback) {
    this.globalSubscribers.add(callback);
    return () => this.globalSubscribers.delete(callback);
  }

  /**
   * اطلاع‌رسانی به مشترکین
   */
  _notify(key, newValue, oldValue) {
    // مشترکین کلید خاص
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`خطا در callback اشتراک "${key}":`, error);
        }
      });
    }

    // مشترکین کلیدهای والد
    const parts = key.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const parentKey = parts.slice(0, i).join('.');
      if (this.subscribers.has(parentKey)) {
        this.subscribers.get(parentKey).forEach(callback => {
          try {
            callback(this.get(parentKey), undefined, parentKey);
          } catch (error) {
            console.error(`خطا در callback اشتراک "${parentKey}":`, error);
          }
        });
      }
    }

    // مشترکین سراسری
    this.globalSubscribers.forEach(callback => {
      try {
        callback(this.state, key, newValue, oldValue);
      } catch (error) {
        console.error('خطا در callback سراسری:', error);
      }
    });
  }

  /**
   * افزودن میان‌افزار
   */
  use(middleware) {
    if (typeof middleware === 'function') {
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * ثبت در تاریخچه
   */
  _addToHistory(key, oldValue, newValue) {
    this.history.push({
      key,
      oldValue,
      newValue,
      timestamp: Date.now()
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * بازگشت به حالت قبل
   */
  undo() {
    const lastChange = this.history.pop();
    if (!lastChange) return false;

    this.state = {
      ...this.state,
      [lastChange.key]: lastChange.oldValue
    };

    this._notify(lastChange.key, lastChange.oldValue, lastChange.newValue);
    return true;
  }

  /**
   * دریافت تاریخچه
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * بازنشانی وضعیت
   */
  reset(initialState = {}) {
    this.state = { ...initialState };
    this._notify('*', this.state);
  }

  /**
   * دریافت وضعیت به صورت سریال
   */
  serialize() {
    return JSON.stringify(this.state);
  }

  /**
   * بارگذاری وضعیت از سریال
   */
  deserialize(serialized) {
    try {
      this.state = JSON.parse(serialized);
      this._notify('*', this.state);
    } catch (error) {
      console.error('خطا در بارگذاری وضعیت:', error);
    }
  }
}

// ایجاد نمونه Singleton
const stateManager = new StateManager({
  // وضعیت اولیه برنامه
  app: {
    initialized: false,
    loading: false,
    theme: 'dark',
    language: 'fa',
    sidebarCollapsed: false,
    currentView: 'dashboard',
    notifications: [],
    modals: []
  },
  database: {
    loaded: false,
    name: null,
    path: null,
    size: 0,
    tables: [],
    activeTable: null,
    data: [],
    columns: [],
    schema: null,
    dirty: false,
    lastSaved: null
  },
  query: {
    sql: '',
    results: [],
    columns: [],
    error: null,
    history: [],
    executing: false,
    executionTime: 0,
    rowsAffected: 0
  },
  ui: {
    loading: false,
    notification: null,
    contextMenu: {
      visible: false,
      x: 0,
      y: 0,
      items: []
    },
    selectedRows: new Set(),
    selectedColumns: new Set(),
    sortColumn: null,
    sortDirection: 'asc',
    filters: [],
    pagination: {
      page: 1,
      pageSize: 50,
      total: 0
    }
  }
});

Object.freeze(stateManager);