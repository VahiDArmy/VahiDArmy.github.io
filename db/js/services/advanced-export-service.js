/**
 * سرویس صادرات پیشرفته
 * قابلیت‌های:
 *  - گروه‌بندی ردیف‌ها بر اساس یک یا چند ستون (هر گروه = یک فایل)
 *  - ادغام چند ستون در یک ستون (الحاق / آرایه / شیء / قالب)
 *  - قالب نام فایل با {column} و {_index}
 *  - بسته‌بندی چند فایل در ZIP
 */
class AdvancedExportService {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * بررسی وجود JSZip
   */
  isZipAvailable() {
    return typeof JSZip !== 'undefined';
  }

  /**
   * گروه‌بندی ردیف‌ها بر اساس ستون‌های انتخابی
   * @param {Array} rows - ردیف‌های ورودی
   * @param {Array<string>} groupBy - نام ستون‌های گروه‌بندی
   * @returns {Array<{key, values, rows}>}
   */
  detectGroups(rows, groupBy) {
    if (!Array.isArray(groupBy) || groupBy.length === 0) {
      return [{ key: '__all__', values: {}, rows: rows.slice() }];
    }

    const map = new Map();

    rows.forEach(row => {
      const values = {};
      groupBy.forEach(col => {
        values[col] = row[col];
      });

      const key = JSON.stringify(values);

      if (!map.has(key)) {
        map.set(key, { key, values, rows: [] });
      }
      map.get(key).rows.push(row);
    });

    return Array.from(map.values());
  }

  /**
   * اعمال قوانین ادغام ستون روی یک ردیف
   * @param {Object} row - ردیف
   * @param {Array} rules - قوانین ادغام
   * @returns {Object} ردیف تبدیل‌شده
   */
  applyMergeToRow(row, rules) {
    if (!Array.isArray(rules) || rules.length === 0) {
      return { ...row };
    }

    const result = { ...row };

    rules.forEach(rule => {
      const { target, sources, mode, separator, template, removeSources } = rule;

      if (!target || !Array.isArray(sources) || sources.length === 0) return;

      const values = sources.map(s => row[s]);

      let merged;
      switch (mode) {
        case 'array':
          merged = values.slice();
          break;

        case 'object': {
          merged = {};
          sources.forEach(s => {
            merged[s] = row[s];
          });
          break;
        }

        case 'template': {
          merged = String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
            const v = row[key];
            return v === null || v === undefined ? '' : String(v);
          });
          break;
        }

        case 'concat':
        default: {
          merged = values
            .filter(v => v !== null && v !== undefined)
            .map(v => String(v))
            .join(separator !== undefined ? separator : ' ');
          break;
        }
      }

      result[target] = merged;

      if (removeSources && !sources.includes(target)) {
        sources.forEach(s => {
          if (s !== target) delete result[s];
        });
      }
    });

    return result;
  }

  /**
   * اعمال قوانین ادغام روی چند ردیف
   */
  applyMergesToRows(rows, rules) {
    if (!Array.isArray(rules) || rules.length === 0) {
      return rows.map(r => ({ ...r }));
    }
    return rows.map(r => this.applyMergeToRow(r, rules));
  }

  /**
   * پاک‌سازی نام فایل برای سازگاری با فایل‌سیستم
   */
  sanitizeFilename(name, fallback = 'file') {
    if (name === null || name === undefined) return fallback;

    let s = String(name).trim();

    if (!s) return fallback;

    // حذف کاراکترهای غیرمجاز (شامل جداکننده‌های مسیر)
    s = s.replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, '_');

    // حذف نقطه و فاصله از ابتدا و انتها
    s = s.replace(/^[\s.]+|[\s.]+$/g, '');

    // جمع کردن زیرخط‌های تکراری
    s = s.replace(/_{2,}/g, '_');

    // حذف فاصله‌های تکراری
    s = s.replace(/\s{2,}/g, ' ');

    if (s.length > 100) {
      s = s.substring(0, 100);
    }

    return s || fallback;
  }

  /**
   * ساخت نام فایل از قالب + مقادیر گروه
   * پشتیبانی از {columnName} و {_index}
   */
  buildFilename(template, groupValues, extension) {
    let name = template || 'file';

    // جایگزینی {column}
    name = name.replace(/\{(\w+)\}/g, (_, key) => {
      const v = groupValues[key];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        try { return JSON.stringify(v); } catch (e) { return ''; }
      }
      return String(v);
    });

    // حذف پسوند در صورت وجود
    if (extension && name.toLowerCase().endsWith(extension.toLowerCase())) {
      name = name.substring(0, name.length - extension.length);
    }

    const sanitized = this.sanitizeFilename(name, 'file');

    return sanitized + (extension || '');
  }

  /**
   * استخراج ستون‌های خروجی پس از اعمال قوانین ادغام
   */
  _deriveOutputColumns(info, mergeRules) {
    const removed = new Set();

    (mergeRules || []).forEach(rule => {
      if (rule.removeSources && Array.isArray(rule.sources)) {
        rule.sources.forEach(s => {
          if (s !== rule.target) removed.add(s);
        });
      }
    });

    const cols = [];
    (info || []).forEach(col => {
      if (!removed.has(col.name)) {
        cols.push({ name: col.name, type: col.type });
      }
    });

    (mergeRules || []).forEach(rule => {
      if (rule.target && Array.isArray(rule.sources) && rule.sources.length > 0) {
        cols.push({ name: rule.target, type: 'MERGED' });
      }
    });

    return cols;
  }

  /**
   * دریافت پسوند فایل از فرمت
   */
  _getExtension(format) {
    const formats = (AppConfig && AppConfig.export && AppConfig.export.formats) || [];
    const info = formats.find(f => f.id === format);
    return info ? info.extension : '.' + format;
  }

  /**
   * ساخت محتوای یک فایل (بر اساس فرمت)
   * نکته: فرمت CSV/TSV ساختار داده متفاوتی می‌خواهد
   */
  async _buildFileContent({ rows, columns, format, prettyPrint, includeSchema, schema, tableName }) {
    const columnNames = columns.map(c => c.name);

    // CSV/TSV فرمت خودشان را می‌خواهند
    if (format === 'csv' || format === 'tsv') {
      const result = await exportService.export(
        format,
        { data: rows, columns: columnNames },
        { prettyPrint, includeHeader: true }
      );
      return result;
    }

    // بقیه فرمت‌ها: { tables: { name: { columns, data, schema } } }
    const tableData = {
      tables: {
        [tableName]: {
          columns: columns.map(c => ({ name: c.name, type: c.type })),
          data: rows,
          schema: schema || null
        }
      }
    };

    return await exportService.export(format, tableData, {
      prettyPrint,
      includeSchema: !!includeSchema,
      includeData: true
    });
  }

  /**
   * تولید فایل‌ها برای یک جدول
   */
  async generateFilesForTable(tableName, options = {}) {
    const {
      groupBy = [],
      mergeRules = [],
      filenameTemplate = '{_index}',
      format = 'json',
      outputMode = 'per-group',
      prettyPrint = true,
      includeSchema = false
    } = options;

    const info = databaseService.getTableInfo(tableName);

    const tableData = databaseService.getTableData(tableName, {
      page: 1,
      pageSize: 10000000
    });

    let rows = tableData.success ? tableData.data : [];

    // اعمال قوانین ادغام
    rows = this.applyMergesToRows(rows, mergeRules);

    // ستون‌های خروجی
    const outputColumns = this._deriveOutputColumns(info, mergeRules);

    const extension = this._getExtension(format);

    // حالت تک فایل
    if (outputMode === 'single') {
      const result = await this._buildFileContent({
        rows,
        columns: outputColumns,
        format,
        prettyPrint,
        includeSchema,
        schema: includeSchema ? databaseService.getCreateTableSql(tableName) : null,
        tableName
      });

      const filename = this.buildFilename(
        filenameTemplate || tableName,
        { table: tableName, _index: 1 },
        extension
      );

      return [{
        name: filename,
        content: result.content,
        mimeType: result.mimeType,
        isBinary: !!result.isBinary,
        tableName,
        rowCount: rows.length
      }];
    }

    // حالت چند فایل (per-group)
    const groups = this.detectGroups(rows, groupBy);
    const files = [];

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];

      const groupValues = {
        ...group.values,
        table: tableName,
        _index: i + 1
      };

      const result = await this._buildFileContent({
        rows: group.rows,
        columns: outputColumns,
        format,
        prettyPrint,
        includeSchema: false,
        schema: null,
        tableName
      });

      const filename = this.buildFilename(filenameTemplate, groupValues, extension);

      files.push({
        name: filename,
        content: result.content,
        mimeType: result.mimeType,
        isBinary: !!result.isBinary,
        tableName,
        rowCount: group.rows.length,
        groupValues: group.values
      });
    }

    return files;
  }

  /**
   * تولید فایل‌ها برای چند جدول
   */
  async generateFiles(tableNames, options = {}) {
    const allFiles = [];

    for (const tableName of tableNames) {
      try {
        const files = await this.generateFilesForTable(tableName, options);
        allFiles.push(...files);
      } catch (error) {
        console.error(`خطا در جدول "${tableName}":`, error);
        this.emit('error', { tableName, error });
      }
    }

    return this._dedupeFilenames(allFiles);
  }

  /**
   * حذف تکراری نام فایل‌ها با افزودن _1، _2 ...
   */
  _dedupeFilenames(files) {
    const seen = new Map();

    return files.map(f => {
      const count = seen.get(f.name) || 0;
      seen.set(f.name, count + 1);

      if (count === 0) return f;

      const dotIdx = f.name.lastIndexOf('.');
      const base = dotIdx > 0 ? f.name.substring(0, dotIdx) : f.name;
      const ext = dotIdx > 0 ? f.name.substring(dotIdx) : '';

      return { ...f, name: `${base}_${count}${ext}` };
    });
  }

  /**
   * بسته‌بندی فایل‌ها در ZIP
   */
  async packAsZip(files, zipName = 'export.zip') {
    if (!this.isZipAvailable()) {
      throw new Error('کتابخانه JSZip بارگذاری نشده است');
    }

    const zip = new JSZip();

    files.forEach(file => {
      if (file.content instanceof Uint8Array || file.content instanceof ArrayBuffer) {
        zip.file(file.name, file.content);
      } else if (file.content instanceof Blob) {
        zip.file(file.name, file.content);
      } else {
        zip.file(file.name, String(file.content ?? ''));
      }
    });

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return { blob, name: zipName };
  }

  /**
   * دانلود فایل‌ها
   * - یک فایل + packAsZip=false → دانلود مستقیم
   * - چند فایل یا packAsZip=true → ZIP
   */
  async download(files, options = {}) {
    const {
      packAsZip = true,
      zipName = null
    } = options;

    if (!files || files.length === 0) {
      throw new Error('فایلی برای دانلود وجود ندارد');
    }

    // تک فایل بدون ZIP
    if (files.length === 1 && !packAsZip) {
      const f = files[0];
      if (f.content instanceof Uint8Array) {
        FileUtils.downloadUint8Array(f.content, f.name, f.mimeType);
      } else if (f.content instanceof Blob) {
        FileUtils.downloadBlob(f.content, f.name);
      } else {
        FileUtils.downloadText(f.content, f.name, f.mimeType || 'text/plain;charset=utf-8');
      }
      return { downloaded: 1, packed: false };
    }

    // ZIP
    const finalName = zipName && zipName.trim()
      ? (zipName.endsWith('.zip') ? zipName : zipName + '.zip')
      : this._defaultZipName();

    const { blob } = await this.packAsZip(files, finalName);
    FileUtils.downloadBlob(blob, finalName);

    return {
      downloaded: files.length,
      packed: true,
      zipName: finalName,
      zipSize: blob.size
    };
  }

  _defaultZipName() {
    const ts = DateUtils.formatPersian(new Date(), 'YYYY-MM-DD_HH-mm');
    return `export_${ts}.zip`;
  }

  /**
   * پیش‌نمایش: فقط نام فایل‌ها و تعداد ردیف
   * بدون تولید محتوای کامل (سریع‌تر)
   */
  async preview(tableNames, options = {}) {
    const results = [];

    for (const tableName of tableNames) {
      try {
        const info = databaseService.getTableInfo(tableName);
        const tableData = databaseService.getTableData(tableName, {
          page: 1,
          pageSize: 1000000
        });

        let rows = tableData.success ? tableData.data : [];
        rows = this.applyMergesToRows(rows, options.mergeRules || []);

        const extension = this._getExtension(options.format || 'json');

        if (options.outputMode === 'single') {
          results.push({
            tableName,
            totalRows: rows.length,
            totalGroups: 1,
            files: [{
              name: this.buildFilename(
                options.filenameTemplate || tableName,
                { table: tableName, _index: 1 },
                extension
              ),
              rowCount: rows.length
            }]
          });
        } else {
          const groups = this.detectGroups(rows, options.groupBy || []);

          const files = groups.map((group, i) => {
            const groupValues = {
              ...group.values,
              table: tableName,
              _index: i + 1
            };

            return {
              name: this.buildFilename(
                options.filenameTemplate,
                groupValues,
                extension
              ),
              rowCount: group.rows.length,
              groupValues: group.values
            };
          });

          results.push({
            tableName,
            totalRows: rows.length,
            totalGroups: groups.length,
            files
          });
        }
      } catch (error) {
        results.push({
          tableName,
          error: error.message,
          totalRows: 0,
          files: []
        });
      }
    }

    return results;
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

const advancedExportService = new AdvancedExportService();