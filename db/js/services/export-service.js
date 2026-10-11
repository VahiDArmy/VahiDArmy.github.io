/**
 * سرویس صادرات
 * تبدیل پایگاه داده به فرمت‌های مختلف
 */
class ExportService {
  constructor() {
    this.formats = {
      json: this.exportJSON.bind(this),
      csv: this.exportCSV.bind(this),
      sql: this.exportSQL.bind(this),
      xml: this.exportXML.bind(this),
      excel: this.exportExcel.bind(this),
      html: this.exportHTML.bind(this),
      markdown: this.exportMarkdown.bind(this),
      yaml: this.exportYaml.bind(this),
      tsv: this.exportTSV.bind(this),
      sqlite: this.exportSQLite.bind(this)
    };
    this.listeners = new Map();
  }

  /**
   * صادرات با فرمت مشخص
   */
  async export(format, data, options = {}) {
    if (!this.formats[format]) {
      throw new Error(`فرمت "${format}" پشتیبانی نمی‌شود`);
    }

    this.emit('exportStarted', { format, options });

    try {
      const result = await this.formats[format](data, options);
      this.emit('exportCompleted', { format, result });
      return result;
    } catch (error) {
      this.emit('exportError', { format, error });
      throw error;
    }
  }

  /**
   * صادرات JSON
   */
  exportJSON(data, options = {}) {
    const { prettyPrint = true, includeSchema = true, includeData = true } = options;

    const output = {};

    if (includeSchema && data.schema) {
      output.schema = data.schema;
    }

    if (includeData) {
      if (data.tables) {
        output.tables = {};
        Object.entries(data.tables).forEach(([name, table]) => {
          output.tables[name] = table;
        });
      } else if (data.data) {
        output.data = data.data;
      }
    }

    output._meta = {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      format: 'json'
    };

    return {
      content: prettyPrint ? JSON.stringify(output, null, 2) : JSON.stringify(output),
      mimeType: 'application/json',
      extension: '.json'
    };
  }

  /**
   * صادرات CSV
   */
  exportCSV(data, options = {}) {
    const {
      delimiter = ',',
      quote = '"',
      includeHeader = true,
      nullValue = '',
      tables = null
    } = options;

    const rows = Array.isArray(data) ? data : data.data || [];
    const columns = Array.isArray(data) ? Object.keys(rows[0] || {}) : data.columns || Object.keys(rows[0] || {});

    const escapeValue = (value) => {
      if (value === null || value === undefined) {
        return nullValue;
      }

      const str = String(value);

      if (str.includes(delimiter) || str.includes(quote) || str.includes('\n') || str.includes('\r')) {
        return quote + str.replace(new RegExp(quote, 'g'), quote + quote) + quote;
      }

      return str;
    };

    let csv = '';

    if (includeHeader && columns.length > 0) {
      csv += columns.map(escapeValue).join(delimiter) + '\n';
    }

    rows.forEach(row => {
      const values = columns.map(col => escapeValue(row[col]));
      csv += values.join(delimiter) + '\n';
    });

    return {
      content: csv,
      mimeType: 'text/csv',
      extension: '.csv'
    };
  }

  /**
   * صادرات TSV
   */
  exportTSV(data, options = {}) {
    return this.exportCSV(data, { ...options, delimiter: '\t' });
  }

  /**
   * صادرات SQL
   */
  exportSQL(data, options = {}) {
    const {
      includeSchema = true,
      includeData = true,
      includeDrop = false,
      includeCreate = true,
      transaction = true,
      batchSize = 1000,
      tables = null
    } = options;

    let sql = '';

    // هدر
    sql += `-- SQL Export\n`;
    sql += `-- Exported at: ${new Date().toISOString()}\n`;
    sql += `-- Version: 2.0.0\n\n`;

    // فعال‌سازی کلیدهای خارجی
    sql += `PRAGMA foreign_keys = OFF;\n\n`;

    if (transaction) {
      sql += `BEGIN TRANSACTION;\n\n`;
    }

    const tablesToExport = tables || Object.keys(data.tables || {});

    tablesToExport.forEach(tableName => {
      const table = data.tables ? data.tables[tableName] : null;

      if (!table) return;

      sql += `-- ----------------------------\n`;
      sql += `-- Table: ${tableName}\n`;
      sql += `-- ----------------------------\n\n`;

      if (includeDrop) {
        sql += `DROP TABLE IF EXISTS "${tableName}";\n\n`;
      }

      if (includeSchema && table.schema) {
        sql += table.schema.trim() + ';\n\n';
      } else if (includeCreate && table.columns) {
        const columnDefs = table.columns.map(col => {
          let def = `"${col.name}" ${col.type}`;
          if (col.primaryKey) def += ' PRIMARY KEY';
          if (col.notNull) def += ' NOT NULL';
          if (col.defaultValue !== undefined && col.defaultValue !== null) {
            def += ` DEFAULT ${col.defaultValue}`;
          }
          return def;
        });

        sql += `CREATE TABLE "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n);\n\n`;
      }

      if (includeData && table.data && table.data.length > 0) {
        const columns = table.columns
          ? table.columns.map(c => c.name)
          : Object.keys(table.data[0]);

        const columnList = columns.map(c => `"${c}"`).join(', ');

        for (let i = 0; i < table.data.length; i += batchSize) {
          const batch = table.data.slice(i, i + batchSize);

          sql += `INSERT INTO "${tableName}" (${columnList}) VALUES\n`;

          batch.forEach((row, idx) => {
            const values = columns.map(col => this._escapeSqlValue(row[col]));
            sql += `  (${values.join(', ')})${idx < batch.length - 1 ? ',' : ';\n'}`;
          });

          sql += '\n';
        }
      }

      sql += '\n';
    });

    if (transaction) {
      sql += `COMMIT;\n\n`;
    }

    sql += `PRAGMA foreign_keys = ON;\n`;

    return {
      content: sql,
      mimeType: 'text/plain',
      extension: '.sql'
    };
  }

  /**
   * صادرات XML
   */
  exportXML(data, options = {}) {
    const {
      rootName = 'database',
      tableTag = 'table',
      rowTag = 'row',
      prettyPrint = true
    } = options;

    const indent = prettyPrint ? '  ' : '';
    const newline = prettyPrint ? '\n' : '';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>${newline}`;
    xml += `<${rootName}>${newline}`;

    const tables = data.tables || {};

    Object.entries(tables).forEach(([tableName, table]) => {
      xml += `${indent}<${tableTag} name="${this._escapeXml(tableName)}">${newline}`;

      const rows = table.data || [];
      rows.forEach(row => {
        xml += `${indent}${indent}<${rowTag}>${newline}`;

        Object.entries(row).forEach(([col, value]) => {
          const tagName = this._sanitizeXmlTag(col);
          const displayValue = value === null || value === undefined ? '' : String(value);

          xml += `${indent}${indent}${indent}<${tagName}>${this._escapeXml(displayValue)}</${tagName}>${newline}`;
        });

        xml += `${indent}${indent}</${rowTag}>${newline}`;
      });

      xml += `${indent}</${tableTag}>${newline}`;
    });

    xml += `</${rootName}>`;

    return {
      content: xml,
      mimeType: 'application/xml',
      extension: '.xml'
    };
  }

  /**
   * صادرات HTML
   */
  exportHTML(data, options = {}) {
    const {
      title = 'Database Export',
      includeStyles = true,
      includeMetadata = true
    } = options;

    let html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHtml(title)}</title>`;

    if (includeStyles) {
      html += `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      padding: 20px;
      line-height: 1.6;
      direction: rtl;
    }
    h1, h2 { color: #818cf8; margin-bottom: 16px; }
    h1 { font-size: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 24px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: #334155;
      color: #f1f5f9;
      padding: 12px;
      text-align: right;
      font-weight: 600;
      border-bottom: 2px solid #475569;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #334155;
      color: #cbd5e1;
    }
    tr:hover td { background: rgba(99, 102, 241, 0.1); }
    .meta {
      color: #94a3b8;
      font-size: 12px;
      margin-bottom: 20px;
      padding: 12px;
      background: #1e293b;
      border-radius: 6px;
      border-right: 4px solid #6366f1;
    }
    .null-value { color: #64748b; font-style: italic; }
    .table-info { color: #94a3b8; font-size: 13px; margin-bottom: 8px; }
  </style>`;
    }

    html += `
</head>
<body>`;

    html += `\n  <h1>${this._escapeHtml(title)}</h1>`;

    if (includeMetadata) {
      html += `\n  <div class="meta">
    <div>تاریخ صادرات: ${new Date().toLocaleString('fa-IR')}</div>
    <div>تعداد جداول: ${Object.keys(data.tables || {}).length}</div>
  </div>`;
    }

    Object.entries(data.tables || {}).forEach(([tableName, table]) => {
      const rows = table.data || [];
      const columns = table.columns ? table.columns.map(c => c.name) : (rows[0] ? Object.keys(rows[0]) : []);

      html += `\n  <h2>${this._escapeHtml(tableName)}</h2>`;
      html += `\n  <div class="table-info">تعداد ردیف: ${rows.length}</div>`;
      html += `\n  <table>`;

      if (columns.length > 0) {
        html += `\n    <thead><tr>`;
        columns.forEach(col => {
          html += `<th>${this._escapeHtml(col)}</th>`;
        });
        html += `</tr></thead>`;
      }

      html += `\n    <tbody>`;
      rows.forEach(row => {
        html += `\n      <tr>`;
        columns.forEach(col => {
          const value = row[col];
          if (value === null || value === undefined) {
            html += `<td class="null-value">NULL</td>`;
          } else {
            html += `<td>${this._escapeHtml(String(value))}</td>`;
          }
        });
        html += `</tr>`;
      });

      html += `\n    </tbody>`;
      html += `\n  </table>`;
    });

    html += `\n</body>\n</html>`;

    return {
      content: html,
      mimeType: 'text/html',
      extension: '.html'
    };
  }

  /**
   * صادرات Markdown
   */
  exportMarkdown(data, options = {}) {
    let md = `# Database Export\n\n`;
    md += `> تاریخ صادرات: ${new Date().toLocaleString('fa-IR')}\n\n`;

    Object.entries(data.tables || {}).forEach(([tableName, table]) => {
      const rows = table.data || [];
      const columns = table.columns ? table.columns.map(c => c.name) : (rows[0] ? Object.keys(rows[0]) : []);

      md += `## ${tableName}\n\n`;
      md += `**تعداد ردیف:** ${rows.length}\n\n`;

      if (columns.length === 0 || rows.length === 0) {
        md += `*جدول خالی است*\n\n`;
        return;
      }

      md += `| ${columns.join(' | ')} |\n`;
      md += `| ${columns.map(() => '---').join(' | ')} |\n`;

      rows.forEach(row => {
        const values = columns.map(col => {
          const v = row[col];
          if (v === null || v === undefined) return 'NULL';
          return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
        });
        md += `| ${values.join(' | ')} |\n`;
      });

      md += '\n';
    });

    return {
      content: md,
      mimeType: 'text/markdown',
      extension: '.md'
    };
  }

  /**
   * صادرات YAML
   */
  exportYaml(data, options = {}) {
    const yaml = this._toYaml(data, 0);
    return {
      content: yaml,
      mimeType: 'text/yaml',
      extension: '.yaml'
    };
  }

  /**
   * تبدیل به YAML
   */
  _toYaml(obj, indent) {
    const spaces = '  '.repeat(indent);
    let yaml = '';

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      obj.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          yaml += `${spaces}-\n${this._toYaml(item, indent + 1)}`;
        } else {
          yaml += `${spaces}- ${this._yamlValue(item)}\n`;
        }
      });
      return yaml;
    }

    if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          yaml += `${spaces}${key}: null\n`;
        } else if (Array.isArray(value)) {
          yaml += `${spaces}${key}:\n${this._toYaml(value, indent + 1)}`;
        } else if (typeof value === 'object') {
          yaml += `${spaces}${key}:\n${this._toYaml(value, indent + 1)}`;
        } else {
          yaml += `${spaces}${key}: ${this._yamlValue(value)}\n`;
        }
      });
      return yaml;
    }

    return `${spaces}${this._yamlValue(obj)}\n`;
  }

  _yamlValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
      if (value.includes('\n') || value.includes(':') || value.includes('#') || /^[\s-]/.test(value)) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }

  /**
   * صادرات Excel (به فرمت XML SpreadsheetML)
   */
  exportExcel(data, options = {}) {
    // استفاده از فرمت SpreadsheetML که توسط Excel پشتیبانی می‌شود
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<?mso-application progid="Excel.Sheet"?>\n`;
    xml += `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n`;
    xml += `  xmlns:o="urn:schemas-microsoft-com:office:office"\n`;
    xml += `  xmlns:x="urn:schemas-microsoft-com:office:excel"\n`;
    xml += `  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n`;

    xml += `  <Styles>\n`;
    xml += `    <Style ss:ID="Header">\n`;
    xml += `      <Font ss:Bold="1" ss:Color="#FFFFFF"/>\n`;
    xml += `      <Interior ss:Color="#6366F1" ss:Pattern="Solid"/>\n`;
    xml += `    </Style>\n`;
    xml += `  </Styles>\n`;

    Object.entries(data.tables || {}).forEach(([tableName, table]) => {
      const safeName = tableName.replace(/[\\\/\?\*\[\]:]/g, '_').substring(0, 31);

      xml += `  <Worksheet ss:Name="${this._escapeXml(safeName)}">\n`;
      xml += `    <Table>\n`;

      const rows = table.data || [];
      const columns = table.columns ? table.columns.map(c => c.name) : (rows[0] ? Object.keys(rows[0]) : []);

      if (columns.length > 0) {
        xml += `      <Row>\n`;
        columns.forEach(col => {
          xml += `        <Cell ss:StyleID="Header"><Data ss:Type="String">${this._escapeXml(col)}</Data></Cell>\n`;
        });
        xml += `      </Row>\n`;
      }

      rows.forEach(row => {
        xml += `      <Row>\n`;
        columns.forEach(col => {
          const value = row[col];
          if (value === null || value === undefined) {
            xml += `        <Cell><Data ss:Type="String"></Data></Cell>\n`;
          } else if (typeof value === 'number') {
            xml += `        <Cell><Data ss:Type="Number">${value}</Data></Cell>\n`;
          } else if (typeof value === 'boolean') {
            xml += `        <Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>\n`;
          } else {
            xml += `        <Cell><Data ss:Type="String">${this._escapeXml(String(value))}</Data></Cell>\n`;
          }
        });
        xml += `      </Row>\n`;
      });

      xml += `    </Table>\n`;
      xml += `  </Worksheet>\n`;
    });

    xml += `</Workbook>`;

    return {
      content: xml,
      mimeType: 'application/vnd.ms-excel',
      extension: '.xls',
      isBinary: false
    };
  }

  /**
   * صادرات SQLite
   */
  exportSQLite(data, options = {}) {
    // این متد نیاز به databaseService دارد
    if (typeof databaseService !== 'undefined' && databaseService.db) {
      const uint8 = databaseService.exportDatabase();
      return {
        content: uint8,
        mimeType: 'application/x-sqlite3',
        extension: '.sqlite',
        isBinary: true
      };
    }
    throw new Error('پایگاه داده‌ای برای صادرات وجود ندارد');
  }

  /**
   * صادرات جدول به عنوان آرایه
   */
  exportTableArray(data, options = {}) {
    const rows = Array.isArray(data) ? data : data.data || [];
    const columns = data.columns || (rows[0] ? Object.keys(rows[0]) : []);

    const headers = columns;
    const records = rows.map(row => columns.map(col => row[col]));

    return { headers, records };
  }

  /**
   * دریافت لیست فرمت‌های پشتیبانی شده
   */
  getSupportedFormats() {
    return Object.keys(this.formats);
  }

  /**
   * بررسی پشتیبانی فرمت
   */
  supportsFormat(format) {
    return this.formats.hasOwnProperty(format);
  }

  /**
   * فرار دادن مقدار SQL
   */
  _escapeSqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value instanceof Date) return `'${value.toISOString()}'`;

    const str = String(value);
    if (str.includes("'")) {
      return `'${str.replace(/'/g, "''")}'`;
    }
    return `'${str}'`;
  }

  /**
   * فرار دادن XML
   */
  _escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * فرار دادن HTML
   */
  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * پاک‌سازی نام تگ XML
   */
  _sanitizeXmlTag(name) {
    let sanitized = String(name).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (/^[0-9]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }
    return sanitized || 'column';
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

const exportService = new ExportService();