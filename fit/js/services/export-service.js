/* ==========================================================================
   Service — Export
   Produces downloadable Excel workbooks from:
     · current data table
     · current fit result
     · full report (data + fit + comparison)
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const Events = App.Events;

  function timestampForFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      '_' +
      pad(d.getHours()) +
      pad(d.getMinutes())
    );
  }

  /* ---------- Sheet builders ---------- */

  /**
   * Sheet 1 — the raw data table with headers.
   */
  function buildDataSheet() {
    const table = {
      rows: App.State.getRows(),
      columns: App.State.getColumns()
    };
    return App.ExcelService.tableToAoA(table, {
      includeHeaders: true,
      onlyVisibleColumns: true
    });
  }

  /**
   * Sheet 2 — the fit result: summary, params, metrics, and per-point data.
   */
  function buildFitSheet(result) {
    if (!result) return null;
    const rows = [];
    rows.push(['گزارش برازش']);
    rows.push(['نوع برازش', result.fitTypeName]);
    rows.push(['ستون x', result.xColName]);
    rows.push(['ستون y', result.yColName]);
    rows.push(['معادله', result.equation]);
    rows.push([]);
    rows.push(['پارامترها']);
    rows.push(['نام', 'مقدار', 'توضیح']);
    for (const coef of App.FitService.getCoefficientRows(result)) {
      rows.push([coef.label, coef.value, coef.description]);
    }
    rows.push([]);
    rows.push(['شاخص‌های آماری']);
    rows.push(['تعداد نقاط', result.metrics.n]);
    rows.push(['SSE', result.metrics.sse]);
    rows.push(['MSE', result.metrics.mse]);
    rows.push(['RMSE', result.metrics.rmse]);
    rows.push(['MAE', result.metrics.mae]);
    rows.push(['MAPE (%)', result.metrics.mape]);
    rows.push(['R²', result.metrics.r2]);
    rows.push(['R² تعدیل‌شده', result.metrics.adjR2]);
    rows.push(['درجهٔ آزادی', result.metrics.dof]);
    rows.push([]);
    rows.push(['داده و پیش‌بینی']);
    rows.push(['x', 'y (واقعی)', 'ŷ (پیش‌بینی)', 'باقی‌مانده']);
    for (let i = 0; i < result.xs.length; i++) {
      rows.push([result.xs[i], result.ys[i], result.yHat[i], result.residuals[i]]);
    }
    return rows;
  }

  /**
   * Sheet 3 — comparison of all fit types.
   */
  function buildComparisonSheet(comparison) {
    if (!Array.isArray(comparison) || comparison.length === 0) return null;
    const rows = [];
    rows.push(['مقایسهٔ انواع برازش']);
    rows.push(['نوع', 'R²', 'R² تعدیل‌شده', 'RMSE', 'MAE', 'وضعیت']);
    for (const c of comparison) {
      if (c.ok) {
        rows.push([c.name, c.r2, c.adjR2, c.rmse, c.mae, 'موفق']);
      } else {
        rows.push([c.name, '', '', '', '', c.error || 'خطا']);
      }
    }
    return rows;
  }

  /* ---------- Public API ---------- */

  /**
   * Export the current data table as .xlsx.
   */
  function exportData() {
    try {
      Events.emit(C.EVENTS.EXPORT_START, { kind: 'data' });
      const table = {
        rows: App.State.getRows(),
        columns: App.State.getColumns()
      };
      const filename = `data_${timestampForFilename()}.xlsx`;
      App.ExcelService.exportToFile(
        table,
        filename,
        null,
        { sheetName: 'داده‌ها', includeHeaders: true }
      );
      return { ok: true, filename };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Export the current fit result as .xlsx.
   */
  function exportFit() {
    const result = App.State.getFitResult();
    if (!result) return { ok: false, error: 'هیچ برازشی اجرا نشده است.' };
    try {
      Events.emit(C.EVENTS.EXPORT_START, { kind: 'fit' });
      const table = {
        rows: App.State.getRows(),
        columns: App.State.getColumns()
      };
      const fitSheet = buildFitSheet(result);
      const filename = `fit_${result.type}_${timestampForFilename()}.xlsx`;
      App.ExcelService.exportToFile(
        table,
        filename,
        [{ name: 'نتیجهٔ برازش', aoa: fitSheet }],
        { sheetName: 'داده‌ها', includeHeaders: true }
      );
      return { ok: true, filename };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Export full report: data + fit result + comparison.
   */
  function exportReport() {
    try {
      Events.emit(C.EVENTS.EXPORT_START, { kind: 'report' });
      const table = {
        rows: App.State.getRows(),
        columns: App.State.getColumns()
      };
      const extra = [];
      const result = App.State.getFitResult();
      if (result) {
        extra.push({ name: 'نتیجهٔ برازش', aoa: buildFitSheet(result) });
      }
      const comparison = App.FitService.compareAll();
      if (comparison.length) {
        extra.push({ name: 'مقایسه', aoa: buildComparisonSheet(comparison) });
      }
      const filename = `report_${timestampForFilename()}.xlsx`;
      App.ExcelService.exportToFile(
        table,
        filename,
        extra,
        { sheetName: 'داده‌ها', includeHeaders: true }
      );
      return { ok: true, filename };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Export only the data as CSV (lightweight).
   */
  function exportCSV() {
    try {
      Events.emit(C.EVENTS.EXPORT_START, { kind: 'csv' });
      const table = {
        rows: App.State.getRows(),
        columns: App.State.getColumns()
      };
      const filename = `data_${timestampForFilename()}.csv`;
      App.ExcelService.exportCSV(table, filename);
      return { ok: true, filename };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  /**
   * Export the current fit's per-point data as CSV (for tooling).
   */
  function exportFitCSV() {
    const result = App.State.getFitResult();
    if (!result) return { ok: false, error: 'هیچ برازشی اجرا نشده است.' };
    try {
      Events.emit(C.EVENTS.EXPORT_START, { kind: 'fit-csv' });
      const aoa = [['x', 'y', 'yHat', 'residual']];
      for (let i = 0; i < result.xs.length; i++) {
        aoa.push([result.xs[i], result.ys[i], result.yHat[i], result.residuals[i]]);
      }
      // Build an xlsx-less CSV blob
      const csv = aoa
        .map((r) => r.map((v) => (v === null || v === undefined ? '' : String(v))).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const filename = `fit_${result.type}_${timestampForFilename()}.csv`;
      App.DOM.downloadBlob(blob, filename);
      Events.emit(C.EVENTS.EXPORT_DONE, { filename });
      return { ok: true, filename };
    } catch (err) {
      Events.emit(C.EVENTS.EXPORT_ERROR, { error: err });
      return { ok: false, error: err.message };
    }
  }

  App.ExportService = {
    exportData,
    exportFit,
    exportReport,
    exportCSV,
    exportFitCSV,
    buildDataSheet,
    buildFitSheet,
    buildComparisonSheet
  };
})(window);