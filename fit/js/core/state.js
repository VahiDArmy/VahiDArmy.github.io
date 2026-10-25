/* ==========================================================================
   Core — Application State
   Single source of truth. Mutations go through this module only.
   All mutations persist to localStorage (unless autoSave disabled)
   and emit events so the UI can react.
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const Events = App.Events;

  /* ---------- ID + name helpers ---------- */

  function uid(prefix) {
    return (
      (prefix || 'id') +
      '_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function columnNameFromIndex(i) {
    let n = i + 1;
    let s = '';
    while (n > 0) {
      n -= 1;
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  /* ---------- Factory functions ---------- */

  function makeColumn(index, name) {
    return {
      id: uid('col'),
      name: name || columnNameFromIndex(index),
      width: C.DEFAULTS.DEFAULT_COL_WIDTH,
      hidden: false,
      type: 'empty' // one of C.COLUMN_TYPES
    };
  }

  function makeRow(colCount) {
    const cells = [];
    for (let c = 0; c < colCount; c++) cells.push('');
    return { id: uid('row'), cells };
  }

  function createInitialData(rowsCount, colsCount) {
    const columns = [];
    for (let c = 0; c < colsCount; c++) columns.push(makeColumn(c));
    const rows = [];
    for (let r = 0; r < rowsCount; r++) rows.push(makeRow(colsCount));
    return {
      rows,
      columns,
      sort: { colIndex: -1, dir: 'none' }, // 'none' | 'asc' | 'desc'
      searchQuery: '',
      rowSelection: new Set(),
      cellSelection: null // { anchor: {rowId, colId}, focus: {rowId, colId} }
    };
  }

  function defaultSettings() {
    return {
      decimals: C.DEFAULTS.DEFAULT_DECIMALS,
      autoSave: true,
      showGrid: true,
      animateUi: true,
      includeResidualPlot: true,
      preserveZero: true, // keep trailing zeros in formatted output
      language: 'fa',
      digits: 'fa', // 'fa' | 'en'
      chartSmoothing: true
    };
  }

  function defaultFitConfig() {
    return {
      type: App.FitTypes.LINEAR,
      xColId: null,
      yColId: null,
      params: App.getDefaultFitParams(App.FitTypes.LINEAR),
      interceptFixed: false,
      interceptValue: 0
    };
  }

  /* ---------- Internal state ---------- */

  let _state = {
    data: createInitialData(
      C.DEFAULTS.TABLE_ROWS,
      C.DEFAULTS.TABLE_COLS
    ),
    fitConfig: defaultFitConfig(),
    fitResult: null,
    fitHistory: [],
    settings: defaultSettings(),
    history: {
      undo: [], // snapshots of {data, fitConfig}
      redo: []
    },
    meta: {
      version: 0,
      lastSavedAt: null,
      isSaving: false,
      saveError: null
    }
  };

  /* ---------- Save queue (debounced) ---------- */

  let saveTimer = null;
  let pendingSave = false;

  function scheduleSave() {
    if (!_state.settings.autoSave) return;
    if (saveTimer) clearTimeout(saveTimer);
    pendingSave = true;
    setMeta({ isSaving: true });
    saveTimer = setTimeout(() => {
      try {
        App.Storage.set(C.STORAGE_KEYS.DATA, {
          rows: _state.data.rows,
          columns: _state.data.columns,
          sort: _state.data.sort
        });
        App.Storage.set(C.STORAGE_KEYS.SETTINGS, _state.settings);
        App.Storage.set(C.STORAGE_KEYS.LAST_FIT, _state.fitConfig);
        setMeta({
          isSaving: false,
          lastSavedAt: Date.now(),
          saveError: null
        });
      } catch (err) {
        setMeta({ isSaving: false, saveError: err.message || 'Save failed' });
        // eslint-disable-next-line no-console
        console.error('[State] autosave failed', err);
      }
      pendingSave = false;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
    }, C.DEFAULTS.AUTOSAVE_DEBOUNCE_MS);
  }

  function setMeta(patch) {
    Object.assign(_state.meta, patch);
    // Footer subscribes directly
    const evt = C.EVENTS.SETTINGS_CHANGED;
    Events.emit(evt, { meta: _state.meta });
  }

  /* ---------- Undo / redo ---------- */

  function snapshot() {
    return {
      data: {
        rows: _state.data.rows.map((r) => ({ id: r.id, cells: r.cells.slice() })),
        columns: _state.data.columns.map((c) => ({ ...c })),
        sort: { ..._state.data.sort }
      },
      fitConfig: JSON.parse(JSON.stringify(_state.fitConfig))
    };
  }

  function pushUndo() {
    _state.history.undo.push(snapshot());
    if (_state.history.undo.length > C.DEFAULTS.MAX_UNDO_STACK) {
      _state.history.undo.shift();
    }
    _state.history.redo.length = 0;
  }

  /* ---------- Column type inference ---------- */

  const NUMBER_RE = /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

  function inferColumnType(colId) {
    let numberCount = 0;
    let textCount = 0;
    let nonEmpty = 0;
    for (const row of _state.data.rows) {
      const colIdx = _state.data.columns.findIndex((c) => c.id === colId);
      if (colIdx < 0) continue;
      const v = row.cells[colIdx];
      if (v === '' || v === null || v === undefined) continue;
      nonEmpty++;
      if (NUMBER_RE.test(String(v).trim())) numberCount++;
      else textCount++;
    }
    if (nonEmpty === 0) return 'empty';
    if (textCount === 0) return 'number';
    if (numberCount === 0) return 'text';
    return 'mixed';
  }

  function refreshColumnTypes() {
    _state.data.columns.forEach((col) => {
      const t = inferColumnType(col.id);
      if (col.type !== t) col.type = t;
    });
  }

  /* ---------- Public API ---------- */

  const State = {
    /* Accessors */
    get() {
      return _state;
    },
    getData() {
      return _state.data;
    },
    getColumns() {
      return _state.data.columns;
    },
    getRows() {
      return _state.data.rows;
    },
    getSettings() {
      return _state.settings;
    },
    getFitConfig() {
      return _state.fitConfig;
    },
    getFitResult() {
      return _state.fitResult;
    },
    getMeta() {
      return _state.meta;
    },
    canUndo() {
      return _state.history.undo.length > 0;
    },
    canRedo() {
      return _state.history.redo.length > 0;
    },

    /* ---------- Data mutations ---------- */

    /** Set a single cell's value. */
    setCell(rowId, colId, value) {
      const row = _state.data.rows.find((r) => r.id === rowId);
      if (!row) return;
      const colIdx = _state.data.columns.findIndex((c) => c.id === colId);
      if (colIdx < 0) return;
      const prev = row.cells[colIdx];
      if (prev === value) return;
      pushUndo();
      row.cells[colIdx] = value;
      _state.data.columns[colIdx].type = inferColumnType(colId);
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CELL_EDITED, { rowId, colId, value });
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Add a row at the end (or at index). */
    addRow(atIndex) {
      pushUndo();
      const row = makeRow(_state.data.columns.length);
      if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= _state.data.rows.length) {
        _state.data.rows.splice(atIndex, 0, row);
      } else {
        _state.data.rows.push(row);
      }
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_ROW_ADDED, { rowId: row.id, atIndex });
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
      return row;
    },

    /** Add multiple rows. */
    addRows(count) {
      if (count <= 0) return [];
      pushUndo();
      const added = [];
      for (let i = 0; i < count; i++) {
        const r = makeRow(_state.data.columns.length);
        _state.data.rows.push(r);
        added.push(r);
      }
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
      return added;
    },

    /** Delete a row by id. */
    deleteRow(rowId) {
      const idx = _state.data.rows.findIndex((r) => r.id === rowId);
      if (idx < 0) return;
      pushUndo();
      const removed = _state.data.rows.splice(idx, 1)[0];
      _state.data.rowSelection.delete(rowId);
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_ROW_REMOVED, { rowId, index: idx });
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
      return removed;
    },

    /** Delete a set of rows by id. */
    deleteRows(rowIds) {
      const set = new Set(rowIds);
      if (set.size === 0) return;
      pushUndo();
      _state.data.rows = _state.data.rows.filter((r) => {
        if (set.has(r.id)) {
          _state.data.rowSelection.delete(r.id);
          return false;
        }
        return true;
      });
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Duplicate a row. */
    duplicateRow(rowId) {
      const src = _state.data.rows.find((r) => r.id === rowId);
      if (!src) return;
      pushUndo();
      const copy = { id: uid('row'), cells: src.cells.slice() };
      const idx = _state.data.rows.indexOf(src);
      _state.data.rows.splice(idx + 1, 0, copy);
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
      return copy;
    },

    /** Move a row from one index to another. */
    moveRow(fromIndex, toIndex) {
      const rows = _state.data.rows;
      if (
        fromIndex < 0 ||
        fromIndex >= rows.length ||
        toIndex < 0 ||
        toIndex >= rows.length ||
        fromIndex === toIndex
      )
        return;
      pushUndo();
      const [row] = rows.splice(fromIndex, 1);
      rows.splice(toIndex, 0, row);
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Add a column at end or index. */
    addColumn(atIndex) {
      pushUndo();
      const index =
        typeof atIndex === 'number' && atIndex >= 0 && atIndex <= _state.data.columns.length
          ? atIndex
          : _state.data.columns.length;
      const col = makeColumn(index);
      _state.data.columns.splice(index, 0, col);
      // Add empty cell to every row at the same index
      _state.data.rows.forEach((r) => r.cells.splice(index, 0, ''));
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_COL_ADDED, { colId: col.id, atIndex: index });
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
      return col;
    },

    /** Delete a column by id. */
    deleteColumn(colId) {
      const idx = _state.data.columns.findIndex((c) => c.id === colId);
      if (idx < 0) return;
      pushUndo();
      _state.data.columns.splice(idx, 1);
      _state.data.rows.forEach((r) => r.cells.splice(idx, 1));
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_COL_REMOVED, { colId });
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Rename a column. */
    renameColumn(colId, newName) {
      const col = _state.data.columns.find((c) => c.id === colId);
      if (!col) return;
      const trimmed = String(newName || '').trim();
      if (!trimmed || trimmed === col.name) return;
      pushUndo();
      col.name = trimmed;
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Resize a column. */
    setColumnWidth(colId, width) {
      const col = _state.data.columns.find((c) => c.id === colId);
      if (!col) return;
      const w = Math.max(
        C.DEFAULTS.MIN_COL_WIDTH,
        Math.min(C.DEFAULTS.MAX_COL_WIDTH, Math.round(width))
      );
      if (col.width === w) return;
      col.width = w;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Toggle column visibility. */
    toggleColumnVisibility(colId) {
      const col = _state.data.columns.find((c) => c.id === colId);
      if (!col) return;
      col.hidden = !col.hidden;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Move a column. */
    moveColumn(fromIdx, toIdx) {
      const cols = _state.data.columns;
      if (
        fromIdx < 0 ||
        fromIdx >= cols.length ||
        toIdx < 0 ||
        toIdx >= cols.length ||
        fromIdx === toIdx
      )
        return;
      pushUndo();
      const [col] = cols.splice(fromIdx, 1);
      cols.splice(toIdx, 0, col);
      _state.data.rows.forEach((r) => {
        const [cell] = r.cells.splice(fromIdx, 1);
        r.cells.splice(toIdx, 0, cell);
      });
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Replace entire dataset (e.g. after Excel import). */
    replaceData(rows, columns) {
      pushUndo();
      _state.data = {
        rows: rows || [],
        columns: columns || [],
        sort: { colIndex: -1, dir: 'none' },
        searchQuery: '',
        rowSelection: new Set(),
        cellSelection: null
      };
      refreshColumnTypes();
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_LOADED, _state.data);
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Clear all data (keeps structure). */
    clearAll() {
      pushUndo();
      _state.data.rows.forEach((r) => {
        r.cells = r.cells.map(() => '');
      });
      _state.data.columns.forEach((c) => (c.type = 'empty'));
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CLEARED, {});
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Reset data to a fresh NxM grid. */
    resetData(rowsCount, colsCount) {
      pushUndo();
      _state.data = createInitialData(
        rowsCount || C.DEFAULTS.TABLE_ROWS,
        colsCount || C.DEFAULTS.TABLE_COLS
      );
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      scheduleSave();
    },

    /** Set sort state. Cycles: none → asc → desc → none. */
    setSort(colIndex) {
      if (colIndex === -1) {
        _state.data.sort = { colIndex: -1, dir: 'none' };
      } else if (_state.data.sort.colIndex === colIndex) {
        const next =
          _state.data.sort.dir === 'asc'
            ? 'desc'
            : _state.data.sort.dir === 'desc'
            ? 'none'
            : 'asc';
        _state.data.sort = next === 'none' ? { colIndex: -1, dir: 'none' } : { colIndex, dir: next };
      } else {
        _state.data.sort = { colIndex, dir: 'asc' };
      }
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
    },

    /** Set search query. */
    setSearchQuery(q) {
      _state.data.searchQuery = String(q || '');
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
    },

    /* ---------- Selection ---------- */

    toggleRowSelection(rowId, additive) {
      if (!additive) _state.data.rowSelection.clear();
      if (_state.data.rowSelection.has(rowId)) {
        _state.data.rowSelection.delete(rowId);
      } else {
        _state.data.rowSelection.add(rowId);
      }
      Events.emit(C.EVENTS.DATA_SELECTION_CHANGED, {
        rowSelection: _state.data.rowSelection,
        cellSelection: _state.data.cellSelection
      });
    },

    clearSelection() {
      _state.data.rowSelection.clear();
      _state.data.cellSelection = null;
      Events.emit(C.EVENTS.DATA_SELECTION_CHANGED, {
        rowSelection: _state.data.rowSelection,
        cellSelection: null
      });
    },

    selectAllRows() {
      _state.data.rows.forEach((r) => _state.data.rowSelection.add(r.id));
      Events.emit(C.EVENTS.DATA_SELECTION_CHANGED, {
        rowSelection: _state.data.rowSelection,
        cellSelection: _state.data.cellSelection
      });
    },

    setCellSelection(anchor, focus) {
      _state.data.cellSelection = { anchor, focus };
      Events.emit(C.EVENTS.DATA_SELECTION_CHANGED, {
        rowSelection: _state.data.rowSelection,
        cellSelection: _state.data.cellSelection
      });
    },

    /* ---------- Fit config ---------- */

    setFitType(type) {
      if (!App.getFitDefinition(type)) return;
      _state.fitConfig.type = type;
      _state.fitConfig.params = App.getDefaultFitParams(type);
      // Clear intercept lock when type changes (only linear/poly/log support it)
      const def = App.getFitDefinition(type);
      if (!def.supportsInterceptToggle) {
        _state.fitConfig.interceptFixed = false;
        _state.fitConfig.interceptValue = 0;
      }
      Events.emit(C.EVENTS.FIT_CONFIG_CHANGED, _state.fitConfig);
      scheduleSave();
    },

    setFitXColumn(colId) {
      _state.fitConfig.xColId = colId;
      Events.emit(C.EVENTS.FIT_CONFIG_CHANGED, _state.fitConfig);
      scheduleSave();
    },

    setFitYColumn(colId) {
      _state.fitConfig.yColId = colId;
      Events.emit(C.EVENTS.FIT_CONFIG_CHANGED, _state.fitConfig);
      scheduleSave();
    },

    setFitParam(key, value) {
      _state.fitConfig.params[key] = value;
      Events.emit(C.EVENTS.FIT_CONFIG_CHANGED, _state.fitConfig);
      scheduleSave();
    },

    setInterceptFixed(fixed, value) {
      _state.fitConfig.interceptFixed = !!fixed;
      if (typeof value === 'number') _state.fitConfig.interceptValue = value;
      Events.emit(C.EVENTS.FIT_CONFIG_CHANGED, _state.fitConfig);
      scheduleSave();
    },

    /* ---------- Fit result ---------- */

    setFitResult(result) {
      _state.fitResult = result;
      if (result) {
        _state.fitHistory.unshift({
          at: Date.now(),
          type: result.type,
          params: result.params,
          metrics: result.metrics
        });
        if (_state.fitHistory.length > 20) _state.fitHistory.length = 20;
      }
      Events.emit(C.EVENTS.FIT_COMPLETE, result);
      scheduleSave();
    },

    clearFitResult() {
      _state.fitResult = null;
      Events.emit(C.EVENTS.FIT_COMPLETE, null);
    },

    /* ---------- Settings ---------- */

    setSetting(key, value) {
      if (_state.settings[key] === value) return;
      _state.settings[key] = value;
      Events.emit(C.EVENTS.SETTINGS_CHANGED, _state.settings);
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data); // to re-render numbers
      if (key === 'autoSave') {
        if (value) scheduleSave();
        else {
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = null;
          pendingSave = false;
          setMeta({ isSaving: false });
        }
      } else if (_state.settings.autoSave) {
        scheduleSave();
      }
    },

    /* ---------- History ---------- */

    undo() {
      if (_state.history.undo.length === 0) return false;
      const current = snapshot();
      const prev = _state.history.undo.pop();
      _state.history.redo.push(current);
      this._applySnapshot(prev);
      return true;
    },

    redo() {
      if (_state.history.redo.length === 0) return false;
      const current = snapshot();
      const next = _state.history.redo.pop();
      _state.history.undo.push(current);
      this._applySnapshot(next);
      return true;
    },

    _applySnapshot(snap) {
      _state.data.rows = snap.data.rows.map((r) => ({
        id: r.id,
        cells: r.cells.slice()
      }));
      _state.data.columns = snap.data.columns.map((c) => ({ ...c }));
      _state.data.sort = { ...snap.data.sort };
      _state.fitConfig = JSON.parse(JSON.stringify(snap.fitConfig));
      _state.meta.version++;
      Events.emit(C.EVENTS.DATA_CHANGED, _state.data);
      Events.emit(C.EVENTS.FIT_CONFIG_CHANGED, _state.fitConfig);
      scheduleSave();
    },

    /* ---------- Persistence ---------- */

    loadFromStorage() {
      try {
        const savedData = App.Storage.get(C.STORAGE_KEYS.DATA);
        const savedSettings = App.Storage.get(C.STORAGE_KEYS.SETTINGS);
        const savedFit = App.Storage.get(C.STORAGE_KEYS.LAST_FIT);

        if (savedData && Array.isArray(savedData.rows) && Array.isArray(savedData.columns)) {
          _state.data = {
            rows: savedData.rows,
            columns: savedData.columns,
            sort: savedData.sort || { colIndex: -1, dir: 'none' },
            searchQuery: '',
            rowSelection: new Set(),
            cellSelection: null
          };
        }
        if (savedSettings) {
          Object.assign(_state.settings, defaultSettings(), savedSettings);
        }
        if (savedFit && savedFit.type) {
          _state.fitConfig = Object.assign(defaultFitConfig(), savedFit);
        }
        refreshColumnTypes();
        return true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[State] load failed', err);
        return false;
      }
    },

    saveNow() {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = null;
      if (!_state.settings.autoSave) return;
      try {
        App.Storage.set(C.STORAGE_KEYS.DATA, {
          rows: _state.data.rows,
          columns: _state.data.columns,
          sort: _state.data.sort
        });
        App.Storage.set(C.STORAGE_KEYS.SETTINGS, _state.settings);
        App.Storage.set(C.STORAGE_KEYS.LAST_FIT, _state.fitConfig);
        setMeta({ lastSavedAt: Date.now(), saveError: null });
      } catch (err) {
        setMeta({ saveError: err.message || 'Save failed' });
      }
    },

    /* ---------- Helpers ---------- */

    columnNameFromIndex,
    uid,
    makeColumn,
    makeRow,
    refreshColumnTypes
  };

  App.State = State;
})(window);