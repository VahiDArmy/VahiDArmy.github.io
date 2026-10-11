/**
 * سرویس کوئری
 * مدیریت اجرای کوئری‌ها و ساخت کوئری‌های پیچیده
 */
class QueryService {
  constructor() {
    this.history = [];
    this.maxHistory = 100;
    this.savedQueries = new Map();
    this.templates = new Map();
    this.listeners = new Map();

    this._loadDefaultTemplates();
    this._loadFromStorage();
  }

  /**
   * اجرای کوئری
   */
  async execute(sql, options = {}) {
    if (!sql || !sql.trim()) {
      return { success: false, error: 'کوئری خالی است' };
    }

    const startTime = performance.now();

    const result = databaseService.executeQuery(sql, options.params || {}, options);
    const endTime = performance.now();

    const record = {
      id: this._generateId(),
      sql,
      timestamp: Date.now(),
      executionTime: endTime - startTime,
      success: result.success,
      rowCount: result.rowCount || 0,
      error: result.error || null
    };

    this._addToHistory(record);

    return { ...result, queryId: record.id };
  }

  /**
   * اجرای چند کوئری
   */
  async executeMany(statements, options = {}) {
    const results = [];

    for (const sql of statements) {
      const result = await this.execute(sql, options);
      results.push(result);

      if (!result.success && options.stopOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * اجرای کوئری با پارامترها
   */
  async executeWithParams(sql, params) {
    return this.execute(sql, { params });
  }

  /**
   * تجزیه و تحلیل کوئری (EXPLAIN)
   */
  explain(sql) {
    const explainSql = `EXPLAIN QUERY PLAN ${sql}`;
    return databaseService.executeQuery(explainSql);
  }

  /**
   * قالب‌بندی SQL
   */
  format(sql, options = {}) {
    const {
      indent = '  ',
      uppercaseKeywords = true,
      newlineBeforeAnd = true
    } = options;

    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'INNER JOIN', 'OUTER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
      'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'CREATE INDEX', 'DROP INDEX',
      'CREATE VIEW', 'DROP VIEW', 'UNION', 'UNION ALL', 'CASE', 'WHEN', 'THEN',
      'ELSE', 'END', 'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
      'BETWEEN', 'IN', 'NOT IN', 'LIKE', 'IS NULL', 'IS NOT NULL', 'PRIMARY KEY',
      'FOREIGN KEY', 'REFERENCES', 'NOT NULL', 'DEFAULT', 'UNIQUE', 'CHECK'
    ];

    let formatted = sql;

    // نرمال‌سازی فاصله‌ها
    formatted = formatted.replace(/\s+/g, ' ').trim();

    // افزودن خط جدید قبل از کلمات کلیدی اصلی
    const newlineKeywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'];

    newlineKeywords.forEach(keyword => {
      const regex = new RegExp(`\\s+${keyword}\\s+`, 'gi');
      formatted = formatted.replace(regex, `\n${keyword} `);
    });

    // AND / OR
    if (newlineBeforeAnd) {
      formatted = formatted.replace(/\s+(AND|OR)\s+/gi, `\n${indent}$1 `);
    }

    // JOIN‌ها
    formatted = formatted.replace(/\s+(LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|JOIN)\s+/gi, '\n$1 ');

    // کاما در SELECT
    // (به صورت ساده پیاده‌سازی شده)

    // بزرگ‌کردن کلمات کلیدی
    if (uppercaseKeywords) {
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        formatted = formatted.replace(regex, keyword);
      });
    }

    return formatted.trim();
  }

  /**
   * کوچک‌سازی SQL
   */
  minify(sql) {
    return sql
      .replace(/\s+/g, ' ')
      .replace(/\s*([(),;])\s*/g, '$1')
      .trim();
  }

  /**
   * بررسی اعتبار SQL
   */
  validate(sql) {
    const errors = [];
    const warnings = [];

    if (!sql || !sql.trim()) {
      errors.push({ message: 'کوئری خالی است', line: 1 });
      return { valid: false, errors, warnings };
    }

    // بررسی دستورات خطرناک
    const dangerous = ['DROP DATABASE', 'TRUNCATE', 'DELETE FROM'];
    const upperSql = sql.toUpperCase();

    dangerous.forEach(cmd => {
      if (upperSql.includes(cmd) && !upperSql.includes('WHERE')) {
        warnings.push({
          message: `دستور "${cmd}" بدون شرط WHERE ممکن است خطرناک باشد`,
          type: 'dangerous'
        });
      }
    });

    // بررسی توازن پرانتزها
    let parenCount = 0;
    for (const char of sql) {
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (parenCount < 0) {
        errors.push({ message: 'پرانتز بسته اضافی' });
        break;
      }
    }

    if (parenCount > 0) {
      errors.push({ message: 'پرانتز باز بدون بسته' });
    }

    // بررسی توازن نقل‌قول‌ها
    const singleQuotes = (sql.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push({ message: 'نقل‌قول تک بسته نشده' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * افزودن به تاریخچه
   */
  _addToHistory(record) {
    this.history.unshift(record);

    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this._saveToStorage();
    this.emit('historyUpdated', this.history);
  }

  /**
   * دریافت تاریخچه
   */
  getHistory(limit = null) {
    return limit ? this.history.slice(0, limit) : [...this.history];
  }

  /**
   * پاک کردن تاریخچه
   */
  clearHistory() {
    this.history = [];
    this._saveToStorage();
    this.emit('historyCleared');
  }

  /**
   * حذف از تاریخچه
   */
  removeFromHistory(id) {
    const index = this.history.findIndex(h => h.id === id);
    if (index >= 0) {
      this.history.splice(index, 1);
      this._saveToStorage();
      this.emit('historyUpdated', this.history);
    }
  }

  /**
   * ذخیره کوئری
   */
  saveQuery(name, sql, description = '') {
    const query = {
      id: this._generateId(),
      name,
      sql,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.savedQueries.set(query.id, query);
    this._saveToStorage();
    this.emit('querySaved', query);

    return query;
  }

  /**
   * بارگذاری کوئری ذخیره شده
   */
  loadQuery(id) {
    return this.savedQueries.get(id) || null;
  }

  /**
   * حذف کوئری ذخیره شده
   */
  deleteQuery(id) {
    if (this.savedQueries.delete(id)) {
      this._saveToStorage();
      this.emit('queryDeleted', id);
      return true;
    }
    return false;
  }

  /**
   * دریافت همه کوئری‌های ذخیره شده
   */
  getSavedQueries() {
    return Array.from(this.savedQueries.values());
  }

  /**
   * جستجو در کوئری‌های ذخیره شده
   */
  searchSavedQueries(term) {
    const lower = term.toLowerCase();
    return this.getSavedQueries().filter(q =>
      q.name.toLowerCase().includes(lower) ||
      q.sql.toLowerCase().includes(lower) ||
      (q.description && q.description.toLowerCase().includes(lower))
    );
  }

  /**
   * قالب‌های پیش‌فرض
   */
  _loadDefaultTemplates() {
    this.templates.set('select-all', {
      name: 'انتخاب همه',
      description: 'انتخاب تمام ردیف‌ها از یک جدول',
      sql: 'SELECT * FROM "table_name" LIMIT 100;'
    });

    this.templates.set('select-columns', {
      name: 'انتخاب ستون‌های خاص',
      description: 'انتخاب ستون‌های مشخص از جدول',
      sql: 'SELECT "col1", "col2" FROM "table_name" WHERE condition;'
    });

    this.templates.set('insert', {
      name: 'درج ردیف',
      description: 'درج یک ردیف جدید',
      sql: 'INSERT INTO "table_name" (col1, col2) VALUES (val1, val2);'
    });

    this.templates.set('update', {
      name: 'به‌روزرسانی',
      description: 'به‌روزرسانی ردیف‌های موجود',
      sql: 'UPDATE "table_name" SET col1 = val1 WHERE condition;'
    });

    this.templates.set('delete', {
      name: 'حذف',
      description: 'حذف ردیف‌ها',
      sql: 'DELETE FROM "table_name" WHERE condition;'
    });

    this.templates.set('count', {
      name: 'شمارش',
      description: 'شمارش ردیف‌ها',
      sql: 'SELECT COUNT(*) AS total FROM "table_name";'
    });

    this.templates.set('group-by', {
      name: 'گروه‌بندی',
      description: 'گروه‌بندی داده‌ها',
      sql: 'SELECT col1, COUNT(*) AS count FROM "table_name" GROUP BY col1;'
    });

    this.templates.set('join', {
      name: 'اتصال جداول',
      description: 'اتصال دو جدول',
      sql: 'SELECT t1.*, t2.* FROM "table1" t1 INNER JOIN "table2" t2 ON t1.id = t2.table1_id;'
    });

    this.templates.set('create-table', {
      name: 'ایجاد جدول',
      description: 'ایجاد جدول جدید',
      sql: 'CREATE TABLE "table_name" (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);'
    });

    this.templates.set('create-index', {
      name: 'ایجاد ایندکس',
      description: 'ایجاد ایندکس جدید',
      sql: 'CREATE INDEX "idx_name" ON "table_name" (column_name);'
    });

    this.templates.set('pragma', {
      name: 'PRAGMA',
      description: 'دستور PRAGMA',
      sql: 'PRAGMA table_info("table_name");'
    });
  }

  /**
   * دریافت قالب‌ها
   */
  getTemplates() {
    return Array.from(this.templates.entries()).map(([id, t]) => ({ id, ...t }));
  }

  /**
   * اعمال قالب
   */
  applyTemplate(templateId, variables = {}) {
    const template = this.templates.get(templateId);
    if (!template) return null;

    let sql = template.sql;

    Object.entries(variables).forEach(([key, value]) => {
      sql = sql.replace(new RegExp(`\\b${key}\\b`, 'g'), value);
    });

    return sql;
  }

  /**
   * تولید کوئری SELECT
   */
  buildSelect(tableName, options = {}) {
    const {
      columns = ['*'],
      where = null,
      orderBy = null,
      groupBy = null,
      having = null,
      limit = null,
      offset = null,
      joins = []
    } = options;

    const colList = columns.map(c => c === '*' ? '*' : `"${c}"`).join(', ');
    let sql = `SELECT ${colList} FROM "${tableName}"`;

    joins.forEach(join => {
      const joinType = join.type || 'INNER';
      sql += ` ${joinType} JOIN "${join.table}" ON ${join.on}`;
    });

    if (where) {
      sql += ` WHERE ${where}`;
    }

    if (groupBy && groupBy.length > 0) {
      sql += ` GROUP BY ${groupBy.map(c => `"${c}"`).join(', ')}`;
    }

    if (having) {
      sql += ` HAVING ${having}`;
    }

    if (orderBy) {
      if (Array.isArray(orderBy)) {
        sql += ` ORDER BY ${orderBy.map(o => `"${o.column}" ${o.direction || 'ASC'}`).join(', ')}`;
      } else {
        sql += ` ORDER BY ${orderBy}`;
      }
    }

    if (limit !== null) {
      sql += ` LIMIT ${limit}`;
      if (offset !== null) {
        sql += ` OFFSET ${offset}`;
      }
    }

    return sql;
  }

  /**
   * تولید کوئری INSERT
   */
  buildInsert(tableName, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);

    const colList = columns.map(c => `"${c}"`).join(', ');
    const valList = values.map(v => this._escapeValue(v)).join(', ');

    return `INSERT INTO "${tableName}" (${colList}) VALUES (${valList});`;
  }

  /**
   * تولید کوئری UPDATE
   */
  buildUpdate(tableName, data, where) {
    const setClauses = Object.entries(data)
      .map(([k, v]) => `"${k}" = ${this._escapeValue(v)}`)
      .join(', ');

    const whereClauses = Object.entries(where)
      .map(([k, v]) => `"${k}" = ${this._escapeValue(v)}`)
      .join(' AND ');

    return `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses};`;
  }

  /**
   * تولید کوئری DELETE
   */
  buildDelete(tableName, where) {
    const whereClauses = Object.entries(where)
      .map(([k, v]) => `"${k}" = ${this._escapeValue(v)}`)
      .join(' AND ');

    return `DELETE FROM "${tableName}" WHERE ${whereClauses};`;
  }

  /**
   * فرار دادن مقدار
   */
  _escapeValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * تولید شناسه یکتا
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * ذخیره در localStorage
   */
  _saveToStorage() {
    try {
      const data = {
        history: this.history.slice(0, 50),
        savedQueries: Array.from(this.savedQueries.values())
      };
      localStorage.setItem('dbmanager_queries', JSON.stringify(data));
    } catch (error) {
      console.error('خطا در ذخیره تاریخچه:', error);
    }
  }

  /**
   * بارگذاری از localStorage
   */
  _loadFromStorage() {
    try {
      const stored = localStorage.getItem('dbmanager_queries');
      if (!stored) return;

      const data = JSON.parse(stored);

      if (Array.isArray(data.history)) {
        this.history = data.history;
      }

      if (Array.isArray(data.savedQueries)) {
        data.savedQueries.forEach(q => {
          this.savedQueries.set(q.id, q);
        });
      }
    } catch (error) {
      console.error('خطا در بارگذاری تاریخچه:', error);
    }
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

const queryService = new QueryService();