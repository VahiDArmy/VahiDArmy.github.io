/**
 * سرویس پایگاه داده
 * مدیریت عملیات اصلی پایگاه داده با sql.js
 */
class DatabaseService {
  constructor() {
    this.SQL = null;
    this.db = null;
    this.initialized = false;
    this.initPromise = null;
    this.queryHistory = [];
    this.maxHistory = 100;
    this.listeners = new Map();
  }

  /**
   * راه‌اندازی اولیه sql.js
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.emit('initializing');

        // بارگذاری sql.js از CDN یا فایل محلی
        const SQL = await initSqlJs({
          locateFile: file => {
            // اولویت: فایل محلی، سپس CDN
            const localPath = `./libs/${file}`;
            const cdnPath = `https://sql.js.org/dist/${file}`;

            // تلاش برای بارگذاری از مسیر محلی
            return localPath;
          }
        });

        this.SQL = SQL;
        this.initialized = true;
        this.emit('initialized');

        console.log('sql.js با موفقیت راه‌اندازی شد');
        return true;
      } catch (error) {
        console.error('خطا در راه‌اندازی sql.js:', error);
        this.emit('error', error);

        // تلاش مجدد با CDN
        try {
          const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
          });
          this.SQL = SQL;
          this.initialized = true;
          this.emit('initialized');
          return true;
        } catch (cdnError) {
          console.error('خطا در راه‌اندازی sql.js از CDN:', cdnError);
          throw new Error('راه‌اندازی sql.js با شکست مواجه شد');
        }
      }
    })();

    return this.initPromise;
  }

  /**
   * ایجاد پایگاه داده جدید
   */
  async createDatabase() {
    await this.initialize();

    this.db = new this.SQL.Database();
    this.emit('databaseCreated');

    return this.db;
  }

  /**
   * بارگذاری پایگاه داده از فایل
   * @param {Uint8Array} data - داده‌های فایل
   * @param {string} name - نام فایل
   */
  async loadDatabase(data, name = 'database.db') {
    await this.initialize();

    try {
      this.db = new this.SQL.Database(data);
      this.emit('databaseLoaded', { name, size: data.length });

      return {
        success: true,
        name,
        size: data.length
      };
    } catch (error) {
      console.error('خطا در بارگذاری پایگاه داده:', error);
      this.emit('error', error);
      throw new Error(`بارگذاری پایگاه داده ناموفق: ${error.message}`);
    }
  }

  /**
   * بارگذاری از URL
   */
  async loadFromUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const name = url.split('/').pop() || 'database.db';

      return await this.loadDatabase(data, name);
    } catch (error) {
      console.error('خطا در بارگذاری از URL:', error);
      throw error;
    }
  }

  /**
   * بارگذاری از Base64
   */
  async loadFromBase64(base64, name = 'database.db') {
    try {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return await this.loadDatabase(bytes, name);
    } catch (error) {
      console.error('خطا در بارگذاری از Base64:', error);
      throw error;
    }
  }

  /**
   * صادرات پایگاه داده به Uint8Array
   */
  exportDatabase() {
    if (!this.db) {
      throw new Error('پایگاه داده بارگذاری نشده است');
    }

    try {
      const data = this.db.export();
      this.emit('databaseExported', { size: data.length });
      return data;
    } catch (error) {
      console.error('خطا در صادرات پایگاه داده:', error);
      throw error;
    }
  }

  /**
   * صادرات به Base64
   */
  exportToBase64() {
    const data = this.exportDatabase();
    let binary = '';
    const bytes = new Uint8Array(data);

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  /**
   * اجرای کوئری SQL
   * @param {string} sql - کوئری SQL
   * @param {Object} params - پارامترها
   * @param {Object} options - تنظیمات
   */
  executeQuery(sql, params = {}, options = {}) {
    if (!this.db) {
      throw new Error('پایگاه داده بارگذاری نشده است');
    }

    const startTime = performance.now();
    const { limit, offset, timeout } = options;

    try {
      // ثبت در تاریخچه
      this._addToHistory(sql);

      let result;

      if (limit) {
        // افزودن LIMIT و OFFSET به کوئری
        const limitSql = `${sql} LIMIT ${limit}${offset ? ` OFFSET ${offset}` : ''}`;
        result = this.db.exec(limitSql, params);
      } else {
        result = this.db.exec(sql, params);
      }

      const executionTime = performance.now() - startTime;

      this.emit('queryExecuted', {
        sql,
        executionTime,
        rowCount: result.length > 0 ? result[0].values.length : 0
      });

      return {
        success: true,
        data: this._formatResult(result),
        raw: result,
        executionTime,
        columns: result.length > 0 ? result[0].columns : [],
        rowCount: result.length > 0 ? result[0].values.length : 0
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;

      this.emit('queryError', { sql, error, executionTime });

      return {
        success: false,
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * اجرای کوئری با پارامترهای متعدد
   */
  executeQueryWithParams(sql, params = []) {
    return this.executeQuery(sql, params);
  }

  /**
   * اجرای کوئری بدون بازگشت نتیجه
   */
  run(sql, params = {}) {
    if (!this.db) {
      throw new Error('پایگاه داده بارگذاری نشده است');
    }

    try {
      this.db.run(sql, params);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * آماده‌سازی statement
   */
  prepare(sql) {
    if (!this.db) {
      throw new Error('پایگاه داده بارگذاری نشده است');
    }

    return this.db.prepare(sql);
  }

  /**
   * دریافت لیست جداول
   */
  getTables() {
    const result = this.executeQuery(
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    if (!result.success) return [];

    return result.data.map(row => ({
      name: row.name,
      type: row.type
    }));
  }

  /**
   * دریافت اطلاعات جدول
   */
  getTableInfo(tableName) {
    const result = this.executeQuery(`PRAGMA table_info("${tableName}")`);

    if (!result.success) return [];

    return result.data.map(row => ({
      cid: row.cid,
      name: row.name,
      type: row.type,
      notNull: row.notnull === 1,
      defaultValue: row.dflt_value,
      primaryKey: row.pk === 1
    }));
  }

  /**
   * دریافت تعداد ردیف‌های جدول
   */
  getTableRowCount(tableName) {
    const result = this.executeQuery(`SELECT COUNT(*) as count FROM "${tableName}"`);

    if (!result.success || result.data.length === 0) return 0;

    return result.data[0].count;
  }

  /**
   * دریافت داده‌های جدول با صفحه‌بندی
   */
  getTableData(tableName, options = {}) {
    const {
      page = 1,
      pageSize = 50,
      sortColumn = null,
      sortDirection = 'asc',
      filters = []
    } = options;

    const offset = (page - 1) * pageSize;
    let sql = `SELECT * FROM "${tableName}"`;
    const params = {};

    // افزودن فیلترها
    if (filters.length > 0) {
      const whereClauses = [];

      filters.forEach((filter, index) => {
        const paramName = `:filter_${index}`;
        const column = `"${filter.column}"`;

        switch (filter.operator) {
          case 'equals':
            whereClauses.push(`${column} = ${paramName}`);
            params[paramName] = filter.value;
            break;
          case 'notEquals':
            whereClauses.push(`${column} != ${paramName}`);
            params[paramName] = filter.value;
            break;
          case 'contains':
            whereClauses.push(`${column} LIKE ${paramName}`);
            params[paramName] = `%${filter.value}%`;
            break;
          case 'notContains':
            whereClauses.push(`${column} NOT LIKE ${paramName}`);
            params[paramName] = `%${filter.value}%`;
            break;
          case 'startsWith':
            whereClauses.push(`${column} LIKE ${paramName}`);
            params[paramName] = `${filter.value}%`;
            break;
          case 'endsWith':
            whereClauses.push(`${column} LIKE ${paramName}`);
            params[paramName] = `%${filter.value}`;
            break;
          case 'greaterThan':
            whereClauses.push(`${column} > ${paramName}`);
            params[paramName] = filter.value;
            break;
          case 'lessThan':
            whereClauses.push(`${column} < ${paramName}`);
            params[paramName] = filter.value;
            break;
          case 'greaterOrEqual':
            whereClauses.push(`${column} >= ${paramName}`);
            params[paramName] = filter.value;
            break;
          case 'lessOrEqual':
            whereClauses.push(`${column} <= ${paramName}`);
            params[paramName] = filter.value;
            break;
          case 'isNull':
            whereClauses.push(`${column} IS NULL`);
            break;
          case 'isNotNull':
            whereClauses.push(`${column} IS NOT NULL`);
            break;
          case 'between':
            whereClauses.push(`${column} BETWEEN ${paramName}_from AND ${paramName}_to`);
            params[`${paramName}_from`] = filter.value[0];
            params[`${paramName}_to`] = filter.value[1];
            break;
          case 'in':
            whereClauses.push(`${column} IN (${filter.value.map((_, i) => `${paramName}_${i}`).join(', ')})`);
            filter.value.forEach((v, i) => {
              params[`${paramName}_${i}`] = v;
            });
            break;
          case 'notIn':
            whereClauses.push(`${column} NOT IN (${filter.value.map((_, i) => `${paramName}_${i}`).join(', ')})`);
            filter.value.forEach((v, i) => {
              params[`${paramName}_${i}`] = v;
            });
            break;
        }
      });

      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }
    }

    // افزودن مرتب‌سازی
    if (sortColumn) {
      const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';
      sql += ` ORDER BY "${sortColumn}" ${direction}`;
    }

    // افزودن صفحه‌بندی
    sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

    const result = this.executeQuery(sql, params);
    const total = this.getTableRowCount(tableName);

    return {
      success: result.success,
      data: result.data,
      columns: result.columns,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      executionTime: result.executionTime
    };
  }

  /**
   * درج ردیف
   */
  insertRow(tableName, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `:value_${i}`).join(', ');
    const columnNames = columns.map(c => `"${c}"`).join(', ');

    const sql = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
    const params = {};
    values.forEach((v, i) => {
      params[`value_${i}`] = v;
    });

    return this.executeQuery(sql, params);
  }

  /**
   * درج چندین ردیف
   */
  insertRows(tableName, rows) {
    if (!rows || rows.length === 0) {
      return { success: false, error: 'داده‌ای برای درج وجود ندارد' };
    }

    const columns = Object.keys(rows[0]);
    const columnNames = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;

    try {
      const stmt = this.db.prepare(sql);

      this.db.run('BEGIN TRANSACTION');

      for (const row of rows) {
        stmt.run(columns.map(c => row[c]));
      }

      this.db.run('COMMIT');
      stmt.free();

      return { success: true, count: rows.length };
    } catch (error) {
      try {
        this.db.run('ROLLBACK');
      } catch (e) {
        // ignore
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * به‌روزرسانی ردیف
   */
  updateRow(tableName, data, where) {
    const setClauses = [];
    const params = {};
    let paramIndex = 0;

    Object.entries(data).forEach(([key, value]) => {
      const paramName = `set_${paramIndex}`;
      setClauses.push(`"${key}" = ${paramName}`);
      params[paramName] = value;
      paramIndex++;
    });

    const whereClauses = [];
    Object.entries(where).forEach(([key, value]) => {
      const paramName = `where_${paramIndex}`;
      whereClauses.push(`"${key}" = ${paramName}`);
      params[paramName] = value;
      paramIndex++;
    });

    const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

    return this.executeQuery(sql, params);
  }

  /**
   * حذف ردیف
   */
  deleteRow(tableName, where) {
    const whereClauses = [];
    const params = {};
    let paramIndex = 0;

    Object.entries(where).forEach(([key, value]) => {
      const paramName = `where_${paramIndex}`;
      whereClauses.push(`"${key}" = ${paramName}`);
      params[paramName] = value;
      paramIndex++;
    });

    const sql = `DELETE FROM "${tableName}" WHERE ${whereClauses.join(' AND ')}`;

    return this.executeQuery(sql, params);
  }

  /**
   * حذف ردیف‌ها با شرط
   */
  deleteRows(tableName, conditions) {
    if (!conditions || conditions.length === 0) {
      return { success: false, error: 'شرطی برای حذف وجود ندارد' };
    }

    const whereClauses = conditions.map(cond => {
      return Object.entries(cond).map(([key, value]) => {
        if (value === null) {
          return `"${key}" IS NULL`;
        }
        return `"${key}" = '${String(value).replace(/'/g, "''")}'`;
      }).join(' AND ');
    });

    const sql = `DELETE FROM "${tableName}" WHERE ${whereClauses.join(' OR ')}`;

    return this.executeQuery(sql);
  }

  /**
   * ایجاد جدول
   */
  createTable(tableName, columns, options = {}) {
    const columnDefs = columns.map(col => {
      let def = `"${col.name}" ${col.type}`;

      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
      if (col.notNull) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.defaultValue !== undefined) def += ` DEFAULT ${col.defaultValue}`;
      if (col.check) def += ` CHECK (${col.check})`;
      if (col.references) {
        def += ` REFERENCES "${col.references.table}"("${col.references.column}")`;
        if (col.references.onDelete) def += ` ON DELETE ${col.references.onDelete}`;
        if (col.references.onUpdate) def += ` ON UPDATE ${col.references.onUpdate}`;
      }

      return def;
    });

    let sql = `CREATE TABLE ${options.ifNotExists ? 'IF NOT EXISTS ' : ''}"${tableName}" (\n  ${columnDefs.join(',\n  ')}`;

    if (options.primaryKey && options.primaryKey.length > 0) {
      sql += `,\n  PRIMARY KEY (${options.primaryKey.map(c => `"${c}"`).join(', ')})`;
    }

    if (options.foreignKeys) {
      options.foreignKeys.forEach(fk => {
        sql += `,\n  FOREIGN KEY ("${fk.column}") REFERENCES "${fk.refTable}"("${fk.refColumn}")`;
        if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`;
        if (fk.onUpdate) sql += ` ON UPDATE ${fk.onUpdate}`;
      });
    }

    sql += '\n)';

    if (options.withoutRowid) {
      sql += ' WITHOUT ROWID';
    }

    if (options.strict) {
      sql += ' STRICT';
    }

    return this.executeQuery(sql);
  }

  /**
   * حذف جدول
   */
  dropTable(tableName, ifExists = true) {
    const sql = `DROP TABLE ${ifExists ? 'IF EXISTS ' : ''}"${tableName}"`;
    return this.executeQuery(sql);
  }

  /**
   * تغییر نام جدول
   */
  renameTable(oldName, newName) {
    const sql = `ALTER TABLE "${oldName}" RENAME TO "${newName}"`;
    return this.executeQuery(sql);
  }

  /**
   * افزودن ستون
   */
  addColumn(tableName, column) {
    let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}`;

    if (column.notNull) sql += ' NOT NULL';
    if (column.defaultValue !== undefined) sql += ` DEFAULT ${column.defaultValue}`;

    return this.executeQuery(sql);
  }

  /**
   * ایجاد ایندکس
   */
  createIndex(indexName, tableName, columns, options = {}) {
    const unique = options.unique ? 'UNIQUE ' : '';
    const ifNotExists = options.ifNotExists ? 'IF NOT EXISTS ' : '';
    const columnNames = columns.map(c => `"${c}"`).join(', ');

    const sql = `CREATE ${unique}INDEX ${ifNotExists}"${indexName}" ON "${tableName}" (${columnNames})`;

    return this.executeQuery(sql);
  }

  /**
   * حذف ایندکس
   */
  dropIndex(indexName, ifExists = true) {
    const sql = `DROP INDEX ${ifExists ? 'IF EXISTS ' : ''}"${indexName}"`;
    return this.executeQuery(sql);
  }

  /**
   * ایجاد ویو
   */
  createView(viewName, selectSql, options = {}) {
    const ifNotExists = options.ifNotExists ? 'IF NOT EXISTS ' : '';
    const sql = `CREATE VIEW ${ifNotExists}"${viewName}" AS ${selectSql}`;
    return this.executeQuery(sql);
  }

  /**
   * حذف ویو
   */
  dropView(viewName, ifExists = true) {
    const sql = `DROP VIEW ${ifExists ? 'IF EXISTS ' : ''}"${viewName}"`;
    return this.executeQuery(sql);
  }

  /**
   * ایجاد تریگر
   */
  createTrigger(triggerName, tableName, timing, event, body, options = {}) {
    const ifNotExists = options.ifNotExists ? 'IF NOT EXISTS ' : '';
    const sql = `CREATE TRIGGER ${ifNotExists}"${triggerName}" ${timing} ${event} ON "${tableName}" BEGIN ${body} END`;
    return this.executeQuery(sql);
  }

  /**
   * حذف تریگر
   */
  dropTrigger(triggerName, ifExists = true) {
    const sql = `DROP TRIGGER ${ifExists ? 'IF EXISTS ' : ''}"${triggerName}"`;
    return this.executeQuery(sql);
  }

  /**
   * دریافت ایندکس‌های جدول
   */
  getIndexes(tableName) {
    const result = this.executeQuery(`PRAGMA index_list("${tableName}")`);
    if (!result.success) return [];

    return result.data.map(idx => {
      const infoResult = this.executeQuery(`PRAGMA index_info("${idx.name}")`);
      const columns = infoResult.success
        ? infoResult.data.map(i => i.name)
        : [];

      return {
        name: idx.name,
        unique: idx.unique === 1,
        origin: idx.origin,
        partial: idx.partial === 1,
        columns
      };
    });
  }

  /**
   * دریافت کلیدهای خارجی
   */
  getForeignKeys(tableName) {
    const result = this.executeQuery(`PRAGMA foreign_key_list("${tableName}")`);
    if (!result.success) return [];

    return result.data.map(fk => ({
      id: fk.id,
      seq: fk.seq,
      table: fk.table,
      from: fk.from,
      to: fk.to,
      onUpdate: fk.on_update,
      onDelete: fk.on_delete,
      match: fk.match
    }));
  }

  /**
   * دریافت محدودیت‌ها
   */
  getConstraints(tableName) {
    const sql = `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`;
    const result = this.executeQuery(sql);

    if (!result.success || result.data.length === 0) return [];

    const createSql = result.data[0].sql;
    const constraints = [];

    // استخراج PRIMARY KEY
    const pkMatch = createSql.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
    if (pkMatch) {
      constraints.push({
        type: 'PRIMARY KEY',
        columns: pkMatch[1].split(',').map(c => c.trim().replace(/"/g, ''))
      });
    }

    // استخراج FOREIGN KEY
    const fkRegex = /FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)\s*\(([^)]+)\)/gi;
    let fkMatch;
    while ((fkMatch = fkRegex.exec(createSql)) !== null) {
      constraints.push({
        type: 'FOREIGN KEY',
        column: fkMatch[1].trim().replace(/"/g, ''),
        refTable: fkMatch[2],
        refColumn: fkMatch[3].trim().replace(/"/g, '')
      });
    }

    // استخراج UNIQUE
    const uniqueRegex = /UNIQUE\s*\(([^)]+)\)/gi;
    let uniqueMatch;
    while ((uniqueMatch = uniqueRegex.exec(createSql)) !== null) {
      constraints.push({
        type: 'UNIQUE',
        columns: uniqueMatch[1].split(',').map(c => c.trim().replace(/"/g, ''))
      });
    }

    // استخراج CHECK
    const checkRegex = /CHECK\s*\(([^)]+)\)/gi;
    let checkMatch;
    while ((checkMatch = checkRegex.exec(createSql)) !== null) {
      constraints.push({
        type: 'CHECK',
        expression: checkMatch[1].trim()
      });
    }

    return constraints;
  }

  /**
   * دریافت SQL ایجاد جدول
   */
  getCreateTableSql(tableName) {
    const result = this.executeQuery(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`
    );

    if (!result.success || result.data.length === 0) return null;

    return result.data[0].sql;
  }

  /**
   * دریافت SQL ایجاد ویو
   */
  getCreateViewSql(viewName) {
    const result = this.executeQuery(
      `SELECT sql FROM sqlite_master WHERE type = 'view' AND name = '${viewName}'`
    );

    if (!result.success || result.data.length === 0) return null;

    return result.data[0].sql;
  }

  /**
   * دریافت SQL ایجاد ایندکس
   */
  getCreateIndexSql(indexName) {
    const result = this.executeQuery(
      `SELECT sql FROM sqlite_master WHERE type = 'index' AND name = '${indexName}'`
    );

    if (!result.success || result.data.length === 0) return null;

    return result.data[0].sql;
  }

  /**
   * دریافت SQL ایجاد تریگر
   */
  getCreateTriggerSql(triggerName) {
    const result = this.executeQuery(
      `SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = '${triggerName}'`
    );

    if (!result.success || result.data.length === 0) return null;

    return result.data[0].sql;
  }

  /**
   * دریافت همه اشیاء پایگاه داده
   */
  getAllObjects() {
    const result = this.executeQuery(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
    );

    if (!result.success) return {};

    const objects = {
      tables: [],
      views: [],
      indexes: [],
      triggers: []
    };

    result.data.forEach(obj => {
      switch (obj.type) {
        case 'table':
          objects.tables.push(obj);
          break;
        case 'view':
          objects.views.push(obj);
          break;
        case 'index':
          objects.indexes.push(obj);
          break;
        case 'trigger':
          objects.triggers.push(obj);
          break;
      }
    });

    return objects;
  }

  /**
   * اجرای VACUUM
   */
  vacuum() {
    return this.executeQuery('VACUUM');
  }

  /**
   * اجرای ANALYZE
   */
  analyze() {
    return this.executeQuery('ANALYZE');
  }

  /**
   * اجرای REINDEX
   */
  reindex() {
    return this.executeQuery('REINDEX');
  }

  /**
   * بررسی یکپارچگی
   */
  integrityCheck() {
    return this.executeQuery('PRAGMA integrity_check');
  }

  /**
   * دریافت اطلاعات پایگاه داده
   */
  getDatabaseInfo() {
    const objects = this.getAllObjects();

    let totalRows = 0;
    let totalSize = 0;

    // محاسبه تعداد ردیف‌های کل
    for (const table of objects.tables) {
      const count = this.getTableRowCount(table.name);
      totalRows += count;
    }

    // محاسبه حجم پایگاه داده
    try {
      const pageCount = this.executeQuery('PRAGMA page_count');
      const pageSize = this.executeQuery('PRAGMA page_size');

      if (pageCount.success && pageSize.success) {
        const count = pageCount.data[0].page_count || 0;
        const size = pageSize.data[0].page_size || 0;
        totalSize = count * size;
      }
    } catch (e) {
      // ignore
    }

    return {
      tableCount: objects.tables.length,
      viewCount: objects.views.length,
      indexCount: objects.indexes.length,
      triggerCount: objects.triggers.length,
      totalRows,
      totalSize,
      pageCount: this.executeQuery('PRAGMA page_count').data?.[0]?.page_count || 0,
      pageSize: this.executeQuery('PRAGMA page_size').data?.[0]?.page_size || 0,
      encoding: this.executeQuery('PRAGMA encoding').data?.[0]?.encoding || 'UTF-8',
      autoVacuum: this.executeQuery('PRAGMA auto_vacuum').data?.[0]?.auto_vacuum || 0,
      journalMode: this.executeQuery('PRAGMA journal_mode').data?.[0]?.journal_mode || 'delete'
    };
  }

  /**
   * بستن پایگاه داده
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.emit('databaseClosed');
    }
  }

  /**
   * فرمت‌دهی نتیجه کوئری
   */
  _formatResult(result) {
    if (!result || result.length === 0) return [];

    const { columns, values } = result[0];

    return values.map(row => {
      const obj = {};
      columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });
  }

  /**
   * افزودن به تاریخچه کوئری
   */
  _addToHistory(sql) {
    this.queryHistory.unshift({
      sql,
      timestamp: Date.now()
    });

    if (this.queryHistory.length > this.maxHistory) {
      this.queryHistory.pop();
    }
  }

  /**
   * دریافت تاریخچه کوئری
   */
  getQueryHistory() {
    return [...this.queryHistory];
  }

  /**
   * پاک کردن تاریخچه
   */
  clearQueryHistory() {
    this.queryHistory = [];
  }

  /**
   * ثبت شنونده
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
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

    // انتشار از طریق EventBus
    if (typeof eventBus !== 'undefined') {
      eventBus.emit(`database:${event}`, data);
    }
  }
}

// ایجاد نمونه Singleton
const databaseService = new DatabaseService();