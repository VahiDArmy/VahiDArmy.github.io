/**
 * سرویس واردات
 * بارگذاری فایل‌های پایگاه داده در فرمت‌های مختلف
 */
class ImportService {
  constructor() {
    this.handlers = {
      sqlite: this.importSQLite.bind(this),
      sql: this.importSQL.bind(this),
      json: this.importJSON.bind(this),
      csv: this.importCSV.bind(this)
    };
    this.listeners = new Map();
  }

  /**
   * تشخیص خودکار فرمت فایل
   */
  detectFormat(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const map = {
      'db': 'sqlite',
      'sqlite': 'sqlite',
      'sqlite3': 'sqlite',
      'db3': 'sqlite',
      'sql': 'sql',
      'json': 'json',
      'csv': 'csv',
      'tsv': 'csv'
    };
    return map[ext] || null;
  }

  /**
   * واردات خودکار
   */
  async autoImport(file, options = {}) {
    const format = options.format || this.detectFormat(file);

    if (!format || !this.handlers[format]) {
      throw new Error(`فرمت فایل "${file.name}" پشتیبانی نمی‌شود`);
    }

    this.emit('importStarted', { file: file.name, format });

    try {
      const result = await this.handlers[format](file, options);
      this.emit('importCompleted', { file: file.name, format, result });
      return result;
    } catch (error) {
      this.emit('importError', { file: file.name, format, error });
      throw error;
    }
  }

  /**
   * واردات فایل SQLite
   */
  async importSQLite(file, options = {}) {
    const data = await fileService.readAsUint8Array(file);

    const result = await databaseService.loadDatabase(data, file.name);

    return {
      type: 'sqlite',
      name: file.name,
      size: file.size,
      success: true,
      database: result
    };
  }

  /**
   * واردات فایل SQL
   */
  async importSQL(file, options = {}) {
    const text = await fileService.readAsText(file);

    if (!databaseService.db) {
      await databaseService.createDatabase();
    }

    // تقسیم SQL به دستورات
    const statements = this._splitSQLStatements(text);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    databaseService.db.run('BEGIN TRANSACTION');

    try {
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;

        try {
          databaseService.db.run(trimmed);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({ statement: trimmed.substring(0, 100), error: error.message });

          if (options.stopOnError) {
            throw error;
          }
        }
      }

      databaseService.db.run('COMMIT');
    } catch (error) {
      try {
        databaseService.db.run('ROLLBACK');
      } catch (e) {
        // ignore
      }
      throw error;
    }

    return {
      type: 'sql',
      name: file.name,
      size: file.size,
      success: true,
      statementsExecuted: successCount,
      statementsFailed: errorCount,
      errors
    };
  }

  /**
   * تقسیم SQL به دستورات
   */
  _splitSQLStatements(sql) {
    const statements = [];
    let current = '';
    let inString = false;
    let stringChar = null;
    let inComment = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const nextChar = sql[i + 1];

      // بررسی کامنت خطی
      if (!inString && !inBlockComment && char === '-' && nextChar === '-') {
        inLineComment = true;
        current += char;
        continue;
      }

      if (inLineComment) {
        current += char;
        if (char === '\n') {
          inLineComment = false;
        }
        continue;
      }

      // بررسی کامنت بلوکی
      if (!inString && char === '/' && nextChar === '*') {
        inBlockComment = true;
        current += char;
        continue;
      }

      if (inBlockComment) {
        current += char;
        if (char === '*' && nextChar === '/') {
          current += nextChar;
          i++;
          inBlockComment = false;
        }
        continue;
      }

      // بررسی رشته
      if (!inString && (char === "'" || char === '"' || char === '`')) {
        inString = true;
        stringChar = char;
        current += char;
        continue;
      }

      if (inString) {
        current += char;
        if (char === stringChar) {
          // بررسی فرار
          if (sql[i - 1] !== '\\') {
            // بررسی دوگانه
            if (nextChar === stringChar) {
              current += nextChar;
              i++;
            } else {
              inString = false;
            }
          }
        }
        continue;
      }

      // بررسی نقطه‌ویرگول
      if (char === ';') {
        current += char;
        if (current.trim()) {
          statements.push(current);
        }
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      statements.push(current);
    }

    return statements;
  }

  /**
   * واردات JSON
   */
  async importJSON(file, options = {}) {
    const data = await fileService.readJSON(file);

    if (!databaseService.db) {
      await databaseService.createDatabase();
    }

    const tablesCreated = [];
    const tablesData = [];
    let rowsImported = 0;

    // بررسی ساختار
    let tables = {};

    if (data.tables) {
      tables = data.tables;
    } else if (data.data) {
      const tableName = options.tableName || fileService.getBaseName(file.name);
      tables[tableName] = {
        data: Array.isArray(data.data) ? data.data : [data.data]
      };
    } else if (Array.isArray(data)) {
      const tableName = options.tableName || fileService.getBaseName(file.name);
      tables[tableName] = { data };
    } else {
      throw new Error('ساختار JSON نامعتبر است');
    }

    Object.entries(tables).forEach(([tableName, table]) => {
      const rows = Array.isArray(table) ? table : table.data;

      if (!rows || rows.length === 0) return;

      const columns = Object.keys(rows[0]);

      // ایجاد جدول
      const colDefs = columns.map(col => {
        const type = this._inferColumnType(rows.map(r => r[col]));
        return `"${col}" ${type}`;
      });

      const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')})`;
      databaseService.executeQuery(createSql);
      tablesCreated.push(tableName);

      // درج داده‌ها
      const result = databaseService.insertRows(tableName, rows);
      if (result.success) {
        rowsImported += rows.length;
      }

      tablesData.push({ name: tableName, rows: rows.length });
    });

    return {
      type: 'json',
      name: file.name,
      size: file.size,
      success: true,
      tablesCreated,
      tablesData,
      rowsImported
    };
  }

  /**
   * واردات CSV
   */
  async importCSV(file, options = {}) {
    const text = await fileService.readAsText(file);
    const parsed = this._parseCSV(text, options);

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('فایل CSV خالی است');
    }

    if (!databaseService.db) {
      await databaseService.createDatabase();
    }

    const tableName = options.tableName || fileService.getBaseName(file.name);
    const headers = parsed.headers || Object.keys(parsed.data[0]);

    // ایجاد جدول
    const colDefs = headers.map(col => {
      const values = parsed.data.map(r => r[col]);
      const type = this._inferColumnType(values);
      return `"${this._sanitizeColumnName(col)}" ${type}`;
    });

    // حذف جدول قبلی اگر درخواست شده
    if (options.replaceExisting) {
      databaseService.executeQuery(`DROP TABLE IF EXISTS "${tableName}"`);
    }

    const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs.join(', ')})`;
    databaseService.executeQuery(createSql);

    // پاک‌سازی داده‌ها
    const cleanedData = parsed.data.map(row => {
      const obj = {};
      headers.forEach(h => {
        const sanitized = this._sanitizeColumnName(h);
        let value = row[h];

        // تبدیل مقادیر خالی به null
        if (value === '' || value === undefined) {
          obj[sanitized] = null;
        } else {
          obj[sanitized] = value;
        }
      });
      return obj;
    });

    // درج داده‌ها
    const result = databaseService.insertRows(tableName, cleanedData);

    if (!result.success) {
      throw new Error(result.error);
    }

    return {
      type: 'csv',
      name: file.name,
      size: file.size,
      success: true,
      tableName,
      columns: headers,
      rowsImported: cleanedData.length
    };
  }

  /**
   * تجزیه CSV
   */
  _parseCSV(text, options = {}) {
    const delimiter = options.delimiter || ',';
    const quote = options.quote || '"';
    const hasHeader = options.hasHeader !== false;

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === quote && nextChar === quote) {
          currentField += quote;
          i++;
        } else if (char === quote) {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === quote) {
          inQuotes = true;
        } else if (char === delimiter) {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          if (char === '\r') i++;
        } else if (char !== '\r') {
          currentField += char;
        }
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    if (hasHeader && rows.length > 0) {
      const headers = rows[0];
      const data = rows.slice(1)
        .filter(row => row.some(v => v !== ''))
        .map(row => {
          const obj = {};
          headers.forEach((h, i) => {
            obj[h] = row[i] !== undefined ? row[i] : '';
          });
          return obj;
        });

      return { headers, data };
    }

    return { headers: null, data: rows };
  }

  /**
   * استنتاج نوع ستون
   */
  _inferColumnType(values) {
    let hasInteger = false;
    let hasReal = false;
    let hasText = false;

    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;

      const str = String(value);

      if (/^-?\d+$/.test(str)) {
        hasInteger = true;
      } else if (/^-?\d*\.\d+([eE][+-]?\d+)?$/.test(str) || /^-?\d+[eE][+-]?\d+$/.test(str)) {
        hasReal = true;
      } else {
        hasText = true;
        break;
      }
    }

    if (hasText) return 'TEXT';
    if (hasReal) return 'REAL';
    if (hasInteger) return 'INTEGER';
    return 'TEXT';
  }

  /**
   * پاک‌سازی نام ستون
   */
  _sanitizeColumnName(name) {
    return String(name).trim().replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_') || 'column';
  }

  /**
   * پیش‌نمایش فایل
   */
  async preview(file, rows = 10) {
    const format = this.detectFormat(file);

    if (format === 'csv') {
      const text = await fileService.readAsText(file);
      const parsed = this._parseCSV(text);
      return {
        headers: parsed.headers,
        rows: parsed.data.slice(0, rows),
        totalRows: parsed.data.length
      };
    }

    if (format === 'json') {
      const data = await fileService.readJSON(file);
      let rows_data = [];

      if (Array.isArray(data)) rows_data = data;
      else if (data.data && Array.isArray(data.data)) rows_data = data.data;
      else if (data.tables) {
        const firstTable = Object.values(data.tables)[0];
        rows_data = Array.isArray(firstTable) ? firstTable : (firstTable.data || []);
      }

      return {
        headers: rows_data[0] ? Object.keys(rows_data[0]) : [],
        rows: rows_data.slice(0, rows),
        totalRows: rows_data.length
      };
    }

    return null;
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

const importService = new ImportService();