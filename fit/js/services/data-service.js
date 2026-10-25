/* ==========================================================================
   Service — Data
   Pure read helpers over the current dataset.
   Sorting, filtering, statistics, column extraction.
   Does NOT mutate State — use State for that.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});

  /**
   * Return a filtered+sorted view of rows.
   * - appends the original index for stable operations
   */
  function getVisibleRows() {
    const data = App.State.getData();
    let rows = data.rows.map((row, idx) => ({ row, originalIndex: idx }));

    // Search filter
    const q = (data.searchQuery || '').trim();
    if (q) {
      const qLower = App.Format.toLatin(q).toLowerCase();
      rows = rows.filter(({ row }) =>
        row.cells.some((v) => App.Format.toLatin(String(v ?? '')).toLowerCase().includes(qLower))
      );
    }

    // Sort
    const { colIndex, dir } = data.sort;
    if (colIndex >= 0 && dir !== 'none') {
      const mul = dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a.row.cells[colIndex];
        const bv = b.row.cells[colIndex];
        return compareCells(av, bv) * mul;
      });
    }

    return rows;
  }

  /**
   * Compare two cell values.
   * Numbers sort numerically; empty strings sort last (ascending).
   */
  function compareCells(a, b) {
    const aEmpty = a === '' || a === null || a === undefined;
    const bEmpty = b === '' || b === null || b === undefined;
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    const an = App.Format.parseNumber(a);
    const bn = App.Format.parseNumber(b);
    const aNum = isFinite(an);
    const bNum = isFinite(bn);
    if (aNum && bNum) return an - bn;
    if (aNum && !bNum) return -1;
    if (!aNum && bNum) return 1;
    return String(a).localeCompare(String(b), 'fa');
  }

  /**
   * Extract a numeric column as array. Skips empty/invalid cells.
   */
  function getColumnNumbers(colId) {
    const cols = App.State.getColumns();
    const idx = cols.findIndex((c) => c.id === colId);
    if (idx < 0) return [];
    const out = [];
    for (const row of App.State.getRows()) {
      const v = App.Format.parseNumber(row.cells[idx]);
      if (isFinite(v)) out.push(v);
    }
    return out;
  }

  /**
   * Extract a column's raw string values.
   */
  function getColumnValues(colId) {
    const cols = App.State.getColumns();
    const idx = cols.findIndex((c) => c.id === colId);
    if (idx < 0) return [];
    return App.State.getRows().map((r) => r.cells[idx]);
  }

  /**
   * Descriptive statistics for a numeric array.
   */
  function computeStats(numbers) {
    const n = numbers.length;
    if (n === 0) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        range: 0,
        variance: 0,
        stdDev: 0,
        q1: 0,
        q3: 0,
        iqr: 0
      };
    }
    const sorted = numbers.slice().sort((a, b) => a - b);
    const sum = App.Math.sum(numbers);
    const mean = sum / n;
    const variance =
      n > 1
        ? numbers.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
        : 0;
    const stdDev = Math.sqrt(variance);
    const median = percentileFromSorted(sorted, 50);
    const q1 = percentileFromSorted(sorted, 25);
    const q3 = percentileFromSorted(sorted, 75);
    return {
      count: n,
      sum,
      mean,
      median,
      min: sorted[0],
      max: sorted[n - 1],
      range: sorted[n - 1] - sorted[0],
      variance,
      stdDev,
      q1,
      q3,
      iqr: q3 - q1
    };
  }

  /**
   * Linear-interpolation percentile from an already-sorted array.
   */
  function percentileFromSorted(sorted, p) {
    if (!sorted.length) return 0;
    if (sorted.length === 1) return sorted[0];
    const pos = (sorted.length - 1) * (p / 100);
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }

  /**
   * Per-column summary for the entire dataset.
   * For numeric columns, runs computeStats over numeric values.
   * For text columns, returns distinct/sample/most-frequent.
   */
  function summarizeAllColumns() {
    const cols = App.State.getColumns();
    const rows = App.State.getRows();
    return cols.map((col, idx) => {
      const raw = rows.map((r) => r.cells[idx]);
      const numeric = [];
      let textCount = 0;
      let emptyCount = 0;
      const freq = Object.create(null);
      for (const v of raw) {
        if (v === '' || v === null || v === undefined) {
          emptyCount++;
          continue;
        }
        const num = App.Format.parseNumber(v);
        if (isFinite(num)) numeric.push(num);
        else textCount++;
        const key = String(v);
        freq[key] = (freq[key] || 0) + 1;
      }
      let topValue = null;
      let topCount = 0;
      for (const k of Object.keys(freq)) {
        if (freq[k] > topCount) {
          topCount = freq[k];
          topValue = k;
        }
      }
      const distinct = Object.keys(freq).length;
      return {
        columnId: col.id,
        columnName: col.name,
        columnIndex: idx,
        type: col.type,
        total: raw.length,
        numericCount: numeric.length,
        textCount,
        emptyCount,
        distinct,
        topValue,
        topCount,
        numericStats: numeric.length ? computeStats(numeric) : null
      };
    });
  }

  /**
   * Total numeric-value count and non-empty count over the whole table.
   */
  function getTableStats() {
    const rows = App.State.getRows();
    const cols = App.State.getColumns();
    let totalCells = 0;
    let nonEmpty = 0;
    let numeric = 0;
    for (const row of rows) {
      for (let c = 0; c < cols.length; c++) {
        totalCells++;
        const v = row.cells[c];
        if (v === '' || v === null || v === undefined) continue;
        nonEmpty++;
        if (isFinite(App.Format.parseNumber(v))) numeric++;
      }
    }
    return {
      rowCount: rows.length,
      colCount: cols.length,
      totalCells,
      nonEmpty,
      empty: totalCells - nonEmpty,
      numeric
    };
  }

  /**
   * Check whether a column can be used as a fit x/y source.
   * Returns { ok, reason }.
   */
  function validateColumnForFit(colId) {
    const cols = App.State.getColumns();
    const col = cols.find((c) => c.id === colId);
    if (!col) return { ok: false, reason: 'ستون وجود ندارد' };
    if (col.type === 'empty') return { ok: false, reason: 'ستون خالی است' };
    if (col.type === 'text') return { ok: false, reason: 'ستون متنی است' };
    return { ok: true, reason: '' };
  }

  /**
   * Compute bounds of an array of numbers.
   */
  function computeBounds(arr) {
    if (!arr.length) return { min: 0, max: 1 };
    let min = arr[0],
      max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
      if (arr[i] > max) max = arr[i];
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return { min, max };
  }

  /**
   * Predict y for a given x using the current fit result.
   */
  function predict(x) {
    const result = App.State.getFitResult();
    if (!result) return null;
    if (typeof result.predict !== 'function') return null;
    const y = result.predict(x);
    return isFinite(y) ? y : null;
  }

  App.DataService = {
    getVisibleRows,
    compareCells,
    getColumnNumbers,
    getColumnValues,
    computeStats,
    percentileFromSorted,
    summarizeAllColumns,
    getTableStats,
    validateColumnForFit,
    computeBounds,
    predict
  };
})(window);