/* ==========================================================================
   Service — Excel
   Import & export Excel/CSV files via SheetJS (window.XLSX).
   All numeric cell values are normalized to strings (Persian-friendly parsing
   happens downstream in Format.parseNumber).
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const Events = App.Events;

  /* ---------- Guard ---------- */

  function ensureXLSX() {
    if (!window.XLSX) {
      throw new Error('کتابخانهٔ Excel (SheetJS) بارگذاری نشده است.');
    }
  }

  /* ---------- Cell normalisation ---------- */

  /**
   * SheetJS returns typed cells. We want strings so downstream code
   * can parse them uniformly (Persian digits, commas, etc.).
   */
  function normalizeCellValue(cell) {
    if (cell === null || cell === undefined) return '';
    if (typeof cell === 'number') {
      // Preserve integer look where possible; else use up to 15 sig digits
      if (Number.isInteger(cell)) return String(cell);
      return String(parseFloat(cell.toPrecision(15)));
    }
    if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
    if (cell instanceof Date) return cell.toISOString();
    return String(cell);
  }

  /* ---------- Column-name derivation ---------- */

  function columnNameFromIndex(idx) {
    let n = idx + 1;
    let s = '';
    while (n > 0) {
      n -= 1;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  /**
   * Convert an array-of-arrays (rows x cols) to { rows, columns } that
   * matches our internal schema.
   */
  function rowsArrayToTable(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
      return { rows: [], columns: [] };
    }

    // Determine max column count
    let maxCols = 0;
    for (let i = 0; i < matrix.length; i++) {
      maxCols = Math.max(maxCols, matrix[i].length);
    }

    // First row might be headers — auto-detect: if all cells are non-numeric strings.
    let hasHeaders = false;
    if (matrix.length > 1) {
      const first = matrix[0];
      let allText = true;
      let anyContent = false;
      for (let c = 0; c < maxCols; c++) {
        const v = first[c];
        if (v === '' || v === null || v === undefined) continue;
        anyContent = true;
        if (App.Validators.isNumber(v)) {
          allText = false;
          break;
        }
      }
      hasHeaders = anyContent && allText;
    }

    const headerRow = hasHeaders ? matrix[0] : null;
    const dataStart = hasHeaders ? 1 : 0;

    const columns = [];
    for (let c = 0; c < maxCols; c++) {
      const headerVal = headerRow ? headerRow[c] : null;
      const name =
        headerVal !== null && headerVal !== undefined && String(headerVal).trim() !== ''
          ? String(headerVal).trim()
          : columnNameFromIndex(c);
      columns.push({
        id: 'col_' + Date.now().toString(36) + '_' + c + '_' + Math.random().toString(36).slice(2, 5),
        name,
        width: C.DEFAULTS.DEFAULT_COL_WIDTH,
        hidden: false,
        type: 'empty'
      });
    }

    const rows = [];
    for (let r = dataStart; r < matrix.length; r++) {
      const src = matrix[r];
      const cells = new Array(maxCols).fill('');
      for (let c = 0; c < maxCols; c++) {
        cells[c] = normalizeCellValue(src[c]);
      }
      rows.push({
        id: 'row_' + Date.now().toString(36) + '_' + r + '_' + Math.random().toString(36).slice(2, 5),
        cells
      });
    }

    return { rows, columns };
  }

  /* ---------- Import ---------- */

  /**
   * Parse an ArrayBuffer or File into a table.
   * @param {ArrayBuffer|File} input
   * @param {Object} [opts]
   * @returns {Promise<{ rows, columns, sheetName, sheetNames, meta }>}
   */
  function parseWorkbook(input) {
    return new Promise((resolve, reject) => {
      try {
        ensureXLSX();

        if (input && input.size > C.LIMITS.MAX_FILE_SIZE_BYTES) {
          reject(
            new Error(
              `حجم فایل بیش از حد مجاز است. حداکثر ${App.Format.formatFileSize(
                C.LIMITS.MAX_FILE_SIZE_BYTES
              )}.`
            )
          );
          return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('خطا در خواندن فایل.'));
        reader.onload = (ev) => {
          try {
            const data = new Uint8Array(ev.target.result);
            const wb = window.XLSX.read(data, { type: 'array', cellDates: false });
            resolve(fromWorkbook(wb));
          } catch (err) {
            reject(new Error('فایل اکسل نامعتبر است: ' + (err.message || err)));
          }
        };

        if (input instanceof File || input instanceof Blob) {
          reader.readAsArrayBuffer(input);
        } else if (input instanceof ArrayBuffer) {
          reader.readAsArrayBuffer(new Blob([input]));
        } else {
          reject(new Error('ورودی نامعتبر است.'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Turn a SheetJS workbook into our table schema.
   * Uses the first sheet by default.
   */
  function fromWorkbook(wb, sheetName) {
    const names = wb.SheetNames || [];
    if (names.length === 0) throw new Error('فایل هیچ شیتی ندارد.');
    const chosen = sheetName && names.indexOf(sheetName) !== -1 ? sheetName : names[0];
    const sheet = wb.Sheets[chosen];
    if (!sheet) throw new Error('شیت انتخابی خالی است.');

    const matrix = window.XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false
    });

    if (!matrix.length) throw new Error('شیت انتخابی خالی است.');

    const table = rowsArrayToTable(matrix);

    return {
      rows: table.rows,
      columns: table.columns,
      sheetName: chosen,
      sheetNames: names,
      meta: {
        rowCount: table.rows.length,
        colCount: table.columns.length
      }
    };
  }

  /**
   * Parse the same workbook but return a list of sheet descriptors
   * so the user can pick one.
   */
  function listSheets(input) {
    return new Promise((resolve, reject) => {
      try {
        ensureXLSX();
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('خطا در خواندن فایل.'));
        reader.onload = (ev) => {
          try {
            const wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
            resolve(wb.SheetNames || []);
          } catch (err) {
            reject(err);
          }
        };
        if (input instanceof File || input instanceof Blob) {
          reader.readAsArrayBuffer(input);
        } else if (input instanceof ArrayBuffer) {
          reader.readAsArrayBuffer(new Blob([input]));
        } else {
          reject(new Error('ورودی نامعتبر است.'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  /* ---------- Export ---------- */

  /**
   * Convert our internal table to an AoA for SheetJS.
   * @param {Object} table  { rows, columns }
   * @param {Object} [opts] { includeHeaders, onlyVisibleColumns }
   */
  function tableToAoA(table, opts) {
    opts = opts || {};
    const includeHeaders = opts.includeHeaders !== false;
    const onlyVisible = opts.onlyVisibleColumns !== false;

    const columns = onlyVisible
      ? table.columns.filter((c) => !c.hidden)
      : table.columns.slice();

    const aoa = [];
    if (includeHeaders) {
      aoa.push(columns.map((c) => c.name));
    }
    for (const row of table.rows) {
      const line = columns.map((col) => {
        const idx = table.columns.indexOf(col);
        return idx >= 0 ? row.cells[idx] : '';
      });
      aoa.push(line);
    }
    return aoa;
  }

  /**
   * Build a workbook from a table, plus optional extra sheets.
   * @param {Object} table   { rows, columns }
   * @param {Array}  [extra] [{ name, aoa }]
   * @param {Object} [opts]  { sheetName }
   */
  function buildWorkbook(table, extra, opts) {
    ensureXLSX();
    opts = opts || {};
    const wb = window.XLSX.utils.book_new();

    const aoa = tableToAoA(table, opts);
    const ws = window.XLSX.utils.aoa_to_sheet(aoa);
    autoFitColumns(ws, aoa);
    window.XLSX.utils.book_append_sheet(wb, ws, opts.sheetName || 'داده‌ها');

    if (Array.isArray(extra)) {
      for (const extraSheet of extra) {
        if (!extraSheet || !Array.isArray(extraSheet.aoa)) continue;
        const wsExtra = window.XLSX.utils.aoa_to_sheet(extraSheet.aoa);
        autoFitColumns(wsExtra, extraSheet.aoa);
        window.XLSX.utils.book_append_sheet(wb, wsExtra, (extraSheet.name || 'Sheet').slice(0, 31));
      }
    }
    return wb;
  }

  function autoFitColumns(ws, aoa) {
    if (!aoa || !aoa.length) return;
    const cols = (aoa[0] || []).map((_, c) => {
      let maxLen = 8;
      for (let r = 0; r < aoa.length; r++) {
        const v = aoa[r][c];
        const len = v === null || v === undefined ? 0 : String(v).length;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = cols;
  }

  /**
   * Export a table (with optional extra sheets) as .xlsx file.
   */
  function exportToFile(table, filename, extra, opts) {
    try {
      ensureXLSX();
      const wb = buildWorkbook(table, extra, opts);
      window.XLSX.writeFile(wb, filename || 'export.xlsx');
      Events.emit(C.EVENTS.EXPORT_DONE, { filename });
      return true;
    } catch (err) {
      Events.emit(C.EVENTS.EXPORT_ERROR, { error: err });
      throw err;
    }
  }

  /**
   * Export only the current table (with headers) as CSV.
   */
  function exportCSV(table, filename) {
    try {
      ensureXLSX();
      const aoa = tableToAoA(table, { includeHeaders: true });
      const ws = window.XLSX.utils.aoa_to_sheet(aoa);
      const csv = window.XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      App.DOM.downloadBlob(blob, filename || 'export.csv');
      Events.emit(C.EVENTS.EXPORT_DONE, { filename });
      return true;
    } catch (err) {
      Events.emit(C.EVENTS.EXPORT_ERROR, { error: err });
      throw err;
    }
  }

  /* ---------- Public API ---------- */

  App.ExcelService = {
    parseWorkbook,
    fromWorkbook,
    listSheets,
    tableToAoA,
    buildWorkbook,
    exportToFile,
    exportCSV,
    normalizeCellValue
  };
})(window);