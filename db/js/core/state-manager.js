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

  get(key) {
    if (!key) return { ...this.state };
    return key.split('.').reduce((obj, part) => {
      return obj && obj[part] !== undefined ? obj[part] : undefined;
    }, this.state);
  }

  set(key, value, options = {}) {
    if (this._isUpdating) {
      console.warn('به‌روزرسانی تودرتو در StateManager');
    }

    this._isUpdating = true;

    try {
      let oldState;
      let newState;

      if (typeof key === 'object') {
        oldState = { ...this.state };
        newState = { ...this.state, ...key };
        this.state = newState;
      } else {
        const parts = key.split('.');
        oldState = this.get(key);
        newState = this._setNested(key, value);
      }

      for (const middleware of this.middlewares) {
        middleware(key, this.state, oldState);
      }

      this._addToHistory(key, oldState, this.get(key));
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

  update(key, updater) {
    const currentValue = this.get(key);
    const newValue = typeof updater === 'function' ? updater(currentValue) : updater;
    this.set(key, newValue);
  }

  merge(key, value) {
    const current = this.get(key) || {};
    this.set(key, { ...current, ...value });
  }

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

  subscribeAll(callback) {
    this.globalSubscribers.add(callback);
    return () => this.globalSubscribers.delete(callback);
  }

  _notify(key, newValue, oldValue) {
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`خطا در callback اشتراک "${key}":`, error);
        }
      });
    }

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

    this.globalSubscribers.forEach(callback => {
      try {
        callback(this.state, key, newValue, oldValue);
      } catch (error) {
        console.error('خطا در callback سراسری:', error);
      }
    });
  }

  use(middleware) {
    if (typeof middleware === 'function') {
      this.middlewares.push(middleware);
    }
    return this;
  }

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

  getHistory() {
    return [...this.history];
  }

  reset(initialState = {}) {
    this.state = { ...initialState };
    this._notify('*', this.state);
  }

  serialize() {
    return JSON.stringify(this.state);
  }

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
// ⚠️ توجه: اینجا Object.freeze وجود ندارد تا متد set() بتواند _isUpdating را تغییر دهد
const stateManager = new StateManager({
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