/* ==========================================================================
   Component — Data Table
   Full-featured spreadsheet-style grid (Excel LTR style).
   ========================================================================== */

(function (window) {
  'use strict';

  const App = (window.App = window.App || {});
  const C = App.Constants;
  const DOM = App.DOM;
  const State = App.State;
  const Events = App.Events;
  const Format = App.Format;

  /* ---------- Local UI state ---------- */

  const ui = {
    wrapper: null,
    lastFocusedCell: null, // { rowId, colIdx }
    editingCell: null, // { rowId, colIdx, element }
    clipboard: null, // { cells: [[...]], anchorRowIdx, anchorColIdx }
    dragRow: null, // { rowId, startIndex }
    resizeState: null, // { colId, startX, startWidth }
    sortHandlersAttached: false,
    _visibleRowsCache: null,
    _visibleRowsCacheKey: ''
  };

  function visibleRowsKey() {
    const d = State.getData();
    return (
      d.rows.length +
      ':' +
      (d.searchQuery || '') +
      ':' +
      d.sort.colIndex +
      ':' +
      d.sort.dir +
      ':' +
      d.columns.map((c) => c.id).join(',')
    );
  }

  function getVisibleRows() {
    const key = visibleRowsKey();
    if (ui._visibleRowsCache && ui._visibleRowsCacheKey === key) {
      return ui._visibleRowsCache;
    }
    const rows = App.DataService.getVisibleRows();
    ui._visibleRowsCache = rows;
    ui._visibleRowsCacheKey = key;
    return rows;
  }

  /* ---------- Public API ---------- */

  function mount(wrapperEl) {
    ui.wrapper = wrapperEl;
    Events.on(C.EVENTS.DATA_CHANGED, () => {
      ui._visibleRowsCache = null;
      ui._visibleRowsCacheKey = '';
      render();
    });
    Events.on(C.EVENTS.DATA_SELECTION_CHANGED, applySelectionClasses);
    render();
  }

  function render() {
    if (!ui.wrapper) return;
    const data = State.getData();
    const columns = data.columns;
    const visible = getVisibleRows();

    // Preserve scroll
    const scrollEl = ui.wrapper.querySelector('.data-table-scroll');
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const scrollLeft = scrollEl ? scrollEl.scrollLeft : 0;

    // Show empty state if no columns
    if (columns.length === 0) {
      DOM.empty(ui.wrapper);
      const empty = DOM.el('div', { class: 'data-table-wrapper' });
      const state = DOM.el('div', { class: 'empty-state' });
      state.innerHTML = `
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </div>
        <div class="empty-state__title">جدول خالی است</div>
        <div class="empty-state__description">برای شروع، داده‌ها را وارد کنید یا از فایل اکسل بارگذاری کنید.</div>
        <div class="empty-state__actions">
          <button class="btn btn--primary" data-action="add-column">افزودن ستون</button>
        </div>
      `;
      empty.appendChild(state);
      ui.wrapper.appendChild(empty);
      return;
    }

    DOM.empty(ui.wrapper);

    // Build table wrapper (Force LTR at DOM level)
    const tableWrap = DOM.el('div', { class: 'data-table-wrapper' });
    const scroll = DOM.el('div', { class: 'data-table-scroll', dir: 'ltr' });
    const table = DOM.el('table', { class: 'data-table', role: 'grid', dir: 'ltr' });

    // ---- THEAD ----
    const thead = DOM.el('thead');
    const headRow = DOM.el('tr');

    // Row number header (select-all) — First child -> Leftmost in LTR
    const rowNumHead = DOM.el('th', { class: 'row-number', scope: 'col' });
    if (isAllRowsSelected()) rowNumHead.classList.add('is-all-selected');
    rowNumHead.appendChild(
      DOM.el('span', {
        text: '',
        'aria-label': 'انتخاب همه'
      })
    );
    rowNumHead.addEventListener('click', () => {
      if (isAllRowsSelected()) State.clearSelection();
      else State.selectAllRows();
    });
    headRow.appendChild(rowNumHead);

    // Column headers (A, B, C...) flow left-to-right
    columns.forEach((col, colIdx) => {
      if (col.hidden) return;
      const th = DOM.el('th', { scope: 'col', 'data-col-index': colIdx, dir: 'ltr' });
      th.style.width = col.width + 'px';
      th.style.minWidth = col.width + 'px';
      th.style.maxWidth = col.width + 'px';

      // Sort arrow
      if (data.sort.colIndex === colIdx && data.sort.dir !== 'none') {
        th.setAttribute('data-sort', data.sort.dir);
      }

      const inner = DOM.el('div', { class: 'th-inner' });

      // Type badge
      const typeBadge = DOM.el('span', {
        class: 'col-type-badge col-type-badge--' + (col.type || 'empty'),
        'data-tooltip': typeLabel(col.type)
      });
      typeBadge.textContent = typeSymbol(col.type);
      inner.appendChild(typeBadge);

      // Name
      inner.appendChild(
        DOM.el('span', { class: 'th-label', text: col.name })
      );

      // Sort arrow
      const sortIcon = DOM.el('span', { class: 'th-sort-icon' });
      sortIcon.innerHTML =
        '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      inner.appendChild(sortIcon);

      // Menu button
      const menuBtn = DOM.el('button', {
        type: 'button',
        class: 'th-menu-btn',
        'aria-label': 'منوی ستون'
      });
      menuBtn.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
      menuBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        openColumnMenu(ev, col, colIdx);
      });
      inner.appendChild(menuBtn);

      th.appendChild(inner);

      // Click header to sort
      th.addEventListener('click', (ev) => {
        if (ev.target.closest('.th-menu-btn')) return;
        if (ev.target.closest('.col-resizer')) return;
        State.setSort(colIdx);
      });

      // Resizer (sits on right edge in LTR)
      const resizer = DOM.el('div', { class: 'col-resizer', 'data-col-id': col.id });
      resizer.addEventListener('mousedown', (ev) => startColumnResize(ev, col));
      th.appendChild(resizer);

      // Double-click header → rename
      th.addEventListener('dblclick', () => promptRenameColumn(col));

      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    // ---- TBODY ----
    const tbody = DOM.el('tbody');

    if (visible.length === 0) {
      const emptyRow = DOM.el('tr');
      const emptyTd = DOM.el('td', {
        colspan: String(visibleColumnsCount() + 1),
        class: 'data-table-empty'
      });
      if (data.searchQuery) {
        emptyTd.innerHTML = `نتیجه‌ای برای «<strong>${DOM.escapeHTML(data.searchQuery)}</strong>» یافت نشد.`;
      } else {
        emptyTd.textContent = 'داده‌ای وجود ندارد.';
      }
      emptyRow.appendChild(emptyTd);
      tbody.appendChild(emptyRow);
    } else {
      const frag = document.createDocumentFragment();
      visible.forEach(({ row, originalIndex }) => {
        frag.appendChild(buildRow(row, originalIndex, columns));
      });
      tbody.appendChild(frag);
    }

    table.appendChild(tbody);
    scroll.appendChild(table);
    tableWrap.appendChild(scroll);
    ui.wrapper.appendChild(tableWrap);

    // Restore scroll
    if (scrollEl) {
      scroll.scrollTop = scrollTop;
      scroll.scrollLeft = scrollLeft;
    }

    // Update row-actions bar (rendered by page, but we can notify)
    Events.emit('table:rendered', { rowCount: visible.length });

    applySelectionClasses();
  }

  function visibleColumnsCount() {
    return State.getColumns().filter((c) => !c.hidden).length;
  }

  function typeSymbol(t) {
    switch (t) {
      case 'number': return '۱';
      case 'text': return 'A';
      case 'mixed': return '!';
      case 'empty':
      default: return '·';
    }
  }

  function typeLabel(t) {
    switch (t) {
      case 'number': return 'ستون عددی';
      case 'text': return 'ستون متنی';
      case 'mixed': return 'ستون مختلط (عدد و متن)';
      case 'empty':
      default: return 'ستون خالی';
    }
  }

  function buildRow(row, originalIndex, columns) {
    const tr = DOM.el('tr', { 'data-row-id': row.id, 'data-row-index': String(originalIndex) });

    // Row number (leftmost)
    const rowNum = DOM.el('td', { class: 'row-number' });
    rowNum.appendChild(
      DOM.el('span', { text: Format.toPersian(String(originalIndex + 1)) })
    );
    rowNum.addEventListener('click', (ev) => {
      State.toggleRowSelection(row.id, ev.shiftKey || ev.metaKey || ev.ctrlKey);
    });
    tr.appendChild(rowNum);

    // Cells
    columns.forEach((col, colIdx) => {
      if (col.hidden) return;
      const td = DOM.el('td', {
        class: 'cell-editable',
        'data-col-id': col.id,
        'data-col-index': String(colIdx),
        'data-row-id': row.id,
        'data-row-index': String(originalIndex)
      });
      const cellValue = row.cells[colIdx];
      const isEmpty = cellValue === '' || cellValue === null || cellValue === undefined;
      const isNum = isFinite(Format.parseNumber(cellValue));

      const span = DOM.el('span', {
        class:
          'cell-value' +
          (isEmpty ? ' is-empty' : '') +
          (isNum ? ' is-number' : '')
      });
      if (isEmpty) {
        span.textContent = '—';
      } else if (isNum) {
        span.textContent = String(cellValue);
      } else {
        span.textContent = String(cellValue);
      }
      td.appendChild(span);

      // Single click on cell → select cell
      td.addEventListener('mousedown', (ev) => {
        if (ui.editingCell) return;
        if (ev.button !== 0) return;
        const anchor = State.getData().cellSelection
          ? State.getData().cellSelection.anchor
          : null;
        const newAnchor = { rowId: row.id, colIdx };
        const focus = { rowId: row.id, colIdx };
        if (ev.shiftKey && anchor) {
          State.setCellSelection(anchor, focus);
        } else {
          State.setCellSelection(newAnchor, newAnchor);
        }
        ui.lastFocusedCell = { rowId: row.id, colIdx };
      });

      // Double-click → edit
      td.addEventListener('dblclick', () => beginEdit(td, row, colIdx, col));

      // Context menu
      td.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        const cs = State.getData().cellSelection;
        if (!cs || !isSameCell(cs.focus, { rowId: row.id, colIdx })) {
          State.setCellSelection(
            { rowId: row.id, colIdx },
            { rowId: row.id, colIdx }
          );
        }
        openCellMenu(ev, row, colIdx);
      });

      tr.appendChild(td);
    });

    // Row drag (drag by row number)
    tr.setAttribute('draggable', 'false');
    rowNum.setAttribute('draggable', 'true');
    rowNum.addEventListener('dragstart', (ev) => {
      ui.dragRow = { rowId: row.id, startIndex: originalIndex };
      tr.classList.add('is-dragging');
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', row.id); } catch (e) {}
    });
    rowNum.addEventListener('dragend', () => {
      ui.dragRow = null;
      tr.classList.remove('is-dragging');
      document.querySelectorAll('.data-table tbody tr.is-drop-target')
        .forEach((el) => el.classList.remove('is-drop-target'));
    });
    tr.addEventListener('dragover', (ev) => {
      if (!ui.dragRow) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      tr.classList.add('is-drop-target');
    });
    tr.addEventListener('dragleave', () => {
      tr.classList.remove('is-drop-target');
    });
    tr.addEventListener('drop', (ev) => {
      if (!ui.dragRow) return;
      ev.preventDefault();
      tr.classList.remove('is-drop-target');
      const targetRowId = row.id;
      if (targetRowId === ui.dragRow.rowId) return;
      State.moveRow(ui.dragRow.startIndex, originalIndex);
    });

    return tr;
  }

  function isSameCell(a, b) {
    return a && b && a.rowId === b.rowId && a.colIdx === b.colIdx;
  }

  function isAllRowsSelected() {
    const rows = State.getRows();
    if (rows.length === 0) return false;
    return rows.every((r) => State.getData().rowSelection.has(r.id));
  }

  /* ---------- Selection classes ---------- */

  function applySelectionClasses() {
    if (!ui.wrapper) return;
    const data = State.getData();
    const rowSel = data.rowSelection;
    const cellSel = data.cellSelection;

    const rows = ui.wrapper.querySelectorAll('tbody tr');
    rows.forEach((tr) => {
      tr.classList.toggle('is-selected', rowSel.has(tr.dataset.rowId));
    });

    // Cell selection
    ui.wrapper.querySelectorAll('td.cell-selected').forEach((td) => {
      td.classList.remove('cell-selected');
    });
    ui.wrapper.querySelectorAll('td.cell-anchor').forEach((td) => {
      td.classList.remove('cell-anchor');
    });

    if (cellSel) {
      const range = getSelectionRange(cellSel.anchor, cellSel.focus);
      ui.wrapper.querySelectorAll('td[data-col-index]').forEach((td) => {
        const rId = td.dataset.rowId;
        const cIdx = parseInt(td.dataset.colIndex, 10);
        if (isInRange(rId, cIdx, range)) td.classList.add('cell-selected');
      });
      // Mark anchor
      const anchorTd = ui.wrapper.querySelector(
        `td[data-row-id="${cellSel.anchor.rowId}"][data-col-index="${cellSel.anchor.colIdx}"]`
      );
      if (anchorTd) anchorTd.classList.add('cell-anchor');
    }
  }

  function getSelectionRange(anchor, focus) {
    const visible = getVisibleRows();
    const rowIdxOf = (rowId) => visible.findIndex((v) => v.row.id === rowId);
    const aRow = rowIdxOf(anchor.rowId);
    const fRow = rowIdxOf(focus.rowId);
    if (aRow < 0 || fRow < 0) return null;
    return {
      rowStart: Math.min(aRow, fRow),
      rowEnd: Math.max(aRow, fRow),
      colStart: Math.min(anchor.colIdx, focus.colIdx),
      colEnd: Math.max(anchor.colIdx, focus.colIdx)
    };
  }

  function isInRange(rowId, colIdx, range) {
    if (!range) return false;
    const visible = getVisibleRows();
    const rIdx = visible.findIndex((v) => v.row.id === rowId);
    if (rIdx < 0) return false;
    return (
      rIdx >= range.rowStart &&
      rIdx <= range.rowEnd &&
      colIdx >= range.colStart &&
      colIdx <= range.colEnd
    );
  }

  /* ---------- Cell editing ---------- */

  function beginEdit(td, row, colIdx, col) {
    if (ui.editingCell) return;
    DOM.empty(td);
    const input = DOM.el('input', {
      type: 'text',
      class: 'cell-input',
      value: row.cells[colIdx] || ''
    });
    td.appendChild(input);
    input.focus();
    input.select();
    ui.editingCell = { rowId: row.id, colIdx, td, input, original: row.cells[colIdx] || '' };

    const commit = (next) => {
      if (!ui.editingCell) return;
      const { rowId, colIdx: cIdx, original } = ui.editingCell;
      const newVal = String(next);
      ui.editingCell = null;
      if (newVal !== original) {
        State.setCell(rowId, col.id, newVal);
      } else {
        render();
      }
    };

    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit(input.value);
        moveFocusRelative(row, colIdx, 1, 0);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        cancelEdit();
      } else if (ev.key === 'Tab') {
        ev.preventDefault();
        commit(input.value);
        moveFocusRelative(row, colIdx, 0, ev.shiftKey ? -1 : 1);
      }
    });
    input.addEventListener('blur', () => {
      if (ui.editingCell && ui.editingCell.input === input) {
        commit(input.value);
      }
    });
  }

  function cancelEdit() {
    if (!ui.editingCell) return;
    ui.editingCell = null;
    render();
  }

  function moveFocusRelative(row, colIdx, dRow, dCol) {
    const visible = getVisibleRows();
    const cols = State.getColumns().filter((c) => !c.hidden);
    let rowIdx = visible.findIndex((v) => v.row.id === row.id);
    if (rowIdx < 0) return;
    const visIdx = cols.findIndex((c) => State.getColumns().indexOf(c) === colIdx);
    if (visIdx < 0) return;

    let newRow = rowIdx + dRow;
    let newColVis = visIdx + dCol;
    if (newRow < 0) newRow = 0;
    if (newRow >= visible.length) newRow = visible.length - 1;
    if (newColVis < 0) newColVis = 0;
    if (newColVis >= cols.length) newColVis = cols.length - 1;

    const targetRow = visible[newRow];
    const targetCol = cols[newColVis];
    const targetColIdx = State.getColumns().indexOf(targetCol);
    if (!targetRow) return;

    const td = ui.wrapper.querySelector(
      `td[data-row-id="${targetRow.row.id}"][data-col-index="${targetColIdx}"]`
    );
    if (td) {
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      State.setCellSelection(
        { rowId: targetRow.row.id, colIdx: targetColIdx },
        { rowId: targetRow.row.id, colIdx: targetColIdx }
      );
      ui.lastFocusedCell = { rowId: targetRow.row.id, colIdx: targetColIdx };
    }
  }

  /* ---------- Column resize ---------- */

  function startColumnResize(ev, col) {
    ev.preventDefault();
    ev.stopPropagation();
    ui.resizeState = {
      colId: col.id,
      startX: ev.clientX,
      startWidth: col.width
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', endResize);
  }

  function onResizeMove(ev) {
    if (!ui.resizeState) return;
    // In LTR, dragging right increases width
    const delta = ev.clientX - ui.resizeState.startX;
    const newWidth = ui.resizeState.startWidth + delta;
    State.setColumnWidth(ui.resizeState.colId, newWidth);
  }

  function endResize() {
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', endResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    ui.resizeState = null;
  }

  /* ---------- Column menu ---------- */

  function openColumnMenu(ev, col, colIdx) {
    const items = [
      { header: `ستون: ${col.name}` },
      {
        icon: App.ContextMenu.ICONS.edit,
        label: 'تغییر نام',
        onClick: () => promptRenameColumn(col)
      },
      { type: 'separator' },
      {
        icon: App.ContextMenu.ICONS.plus,
        label: 'افزودن ستون به راست',
        onClick: () => State.addColumn(colIdx + 1)
      },
      {
        icon: App.ContextMenu.ICONS.plus,
        label: 'افزودن ستون به چپ',
        onClick: () => State.addColumn(colIdx)
      },
      { type: 'separator' },
      {
        icon: App.ContextMenu.ICONS.arrowUp,
        label: 'جابه‌جایی به چپ',
        disabled: colIdx === 0,
        onClick: () => State.moveColumn(colIdx, colIdx - 1)
      },
      {
        icon: App.ContextMenu.ICONS.arrowDown,
        label: 'جابه‌جایی به راست',
        disabled: colIdx === State.getColumns().length - 1,
        onClick: () => State.moveColumn(colIdx, colIdx + 1)
      },
      { type: 'separator' },
      {
        icon: App.ContextMenu.ICONS.copy,
        label: 'کپی مقادیر ستون',
        onClick: () => copyColumnToClipboard(colIdx)
      },
      {
        icon: App.ContextMenu.ICONS.clear,
        label: 'پاک‌سازی مقادیر ستون',
        onClick: () => clearColumnValues(colIdx)
      },
      {
        icon: App.ContextMenu.ICONS.eyeOff,
        label: 'مخفی کردن ستون',
        onClick: () => State.toggleColumnVisibility(col.id)
      },
      { type: 'separator' },
      {
        icon: App.ContextMenu.ICONS.trash,
        label: 'حذف ستون',
        danger: true,
        onClick: async () => {
          const ok = await App.Modal.confirm({
            title: 'حذف ستون',
            message: `آیا از حذف ستون «${col.name}» مطمئن هستید؟ این عمل قابل واگرد است.`,
            danger: true,
            confirmLabel: 'حذف'
          });
          if (ok) State.deleteColumn(col.id);
        }
      }
    ];
    App.ContextMenu.open(ev, items);
  }

  async function promptRenameColumn(col) {
    const newName = await App.Modal.prompt({
      title: 'تغییر نام ستون',
      message: `نام جدید برای «${col.name}»:`,
      value: col.name,
      validate: (v) => (v.trim() ? true : 'نام نمی‌تواند خالی باشد')
    });
    if (newName !== null) State.renameColumn(col.id, newName);
  }

  function copyColumnToClipboard(colIdx) {
    const rows = State.getRows();
    const values = rows.map((r) => r.cells[colIdx] || '');
    copyToClipboard(values.join('\n'));
    App.Toast.success('کپی شد', 'مقادیر ستون در حافظهٔ موقت قرار گرفت.');
  }

  function clearColumnValues(colIdx) {
    const col = State.getColumns()[colIdx];
    if (!col) return;
    State.getRows().forEach((r) => State.setCell(r.id, col.id, ''));
  }

  /* ---------- Cell menu ---------- */

  function openCellMenu(ev, row, colIdx) {
    const cellSel = State.getData().cellSelection;
    const range = cellSel ? getSelectionRange(cellSel.anchor, cellSel.focus) : null;
    const multi = range && (range.rowEnd - range.rowStart > 0 || range.colEnd - range.colStart > 0);

    const items = [
      { header: multi ? 'چند سلول انتخاب شده' : 'سلول' },
      {
        icon: App.ContextMenu.ICONS.copy,
        label: 'کپی',
        shortcut: 'Ctrl+C',
        onClick: () => copySelection()
      },
      {
        icon: App.ContextMenu.ICONS.cut,
        label: 'برداشتن',
        shortcut: 'Ctrl+X',
        onClick: () => cutSelection()
      },
      {
        icon: App.ContextMenu.ICONS.paste,
        label: 'جای‌گذاری',
        shortcut: 'Ctrl+V',
        disabled: !ui.clipboard,
        onClick: () => pasteAtSelection()
      },
      { type: 'separator' },
      {
        icon: App.ContextMenu.ICONS.edit,
        label: 'ویرایش',
        onClick: () => {
          const td = ui.wrapper.querySelector(
            `td[data-row-id="${row.id}"][data-col-index="${colIdx}"]`
          );
          if (td) beginEdit(td, row, colIdx, State.getColumns()[colIdx]);
        }
      },
      {
        icon: App.ContextMenu.ICONS.clear,
        label: 'پاک کردن',
        shortcut: 'Delete',
        onClick: () => clearSelection()
      }
    ];

    App.ContextMenu.open(ev, items);
  }

  /* ---------- Clipboard operations ---------- */

  function copySelection() {
    const cellSel = State.getData().cellSelection;
    if (!cellSel) return;
    const range = getSelectionRange(cellSel.anchor, cellSel.focus);
    if (!range) return;
    const visible = getVisibleRows();
    const cols = State.getColumns();
    const cells = [];
    for (let r = range.rowStart; r <= range.rowEnd; r++) {
      const row = visible[r].row;
      const line = [];
      for (let c = range.colStart; c <= range.colEnd; c++) {
        if (cols[c].hidden) continue;
        line.push(row.cells[c] || '');
      }
      cells.push(line);
    }
    ui.clipboard = {
      cells,
      anchorRowIdx: range.rowStart,
      anchorColIdx: range.colStart
    };
    const text = cells.map((r) => r.join('\t')).join('\n');
    copyToClipboard(text);
    App.Toast.info('کپی شد', `${cells.length} سطر × ${cells[0].length} ستون`);
  }

  function cutSelection() {
    copySelection();
    clearSelection();
  }

  function pasteAtSelection() {
    if (!ui.clipboard) return;
    const cellSel = State.getData().cellSelection;
    if (!cellSel) return;
    const visible = getVisibleRows();
    const startRowIdx = visible.findIndex((v) => v.row.id === cellSel.focus.rowId);
    if (startRowIdx < 0) return;
    const cols = State.getColumns();
    const startColIdx = cellSel.focus.colIdx;

    const cells = ui.clipboard.cells;
    for (let r = 0; r < cells.length; r++) {
      const targetRow = visible[startRowIdx + r];
      if (!targetRow) break;
      for (let c = 0; c < cells[r].length; c++) {
        const targetCol = cols[startColIdx + c];
        if (!targetCol) break;
        State.setCell(targetRow.row.id, targetCol.id, cells[r][c]);
      }
    }
    App.Toast.success('جای‌گذاری شد', '');
  }

  function clearSelection() {
    const cellSel = State.getData().cellSelection;
    if (!cellSel) return;
    const range = getSelectionRange(cellSel.anchor, cellSel.focus);
    if (!range) return;
    const visible = getVisibleRows();
    const cols = State.getColumns();
    for (let r = range.rowStart; r <= range.rowEnd; r++) {
      const row = visible[r].row;
      for (let c = range.colStart; c <= range.colEnd; c++) {
        if (cols[c].hidden) continue;
        State.setCell(row.id, cols[c].id, '');
      }
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    ta.remove();
  }

  /* ---------- Keyboard shortcuts within table ---------- */

  function installKeyboard() {
    if (ui.sortHandlersAttached) return;
    ui.sortHandlersAttached = true;
    document.addEventListener('keydown', (ev) => {
      if (DOM.isEditableTarget(ev.target) && !ev.target.classList.contains('cell-input')) return;
      // Only when data tab is active
      const activeTab = document.querySelector('.app-tab.is-active');
      if (!activeTab || activeTab.dataset.tab !== 'data') return;

      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c') {
        if (ui.lastFocusedCell) {
          ev.preventDefault();
          copySelection();
        }
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'x') {
        if (ui.lastFocusedCell) {
          ev.preventDefault();
          cutSelection();
        }
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v') {
        if (ui.clipboard) {
          ev.preventDefault();
          pasteAtSelection();
        }
      } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        if (State.getData().cellSelection) {
          ev.preventDefault();
          clearSelection();
        }
      } else if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        if (!ui.lastFocusedCell) return;
        if (DOM.isEditableTarget(ev.target)) return;
        ev.preventDefault();
        const visible = getVisibleRows();
        const row = visible.find((v) => v.row.id === ui.lastFocusedCell.rowId);
        if (!row) return;
        let dRow = 0,
          dCol = 0;
        if (ev.key === 'ArrowUp') dRow = -1;
        else if (ev.key === 'ArrowDown') dRow = 1;
        else if (ev.key === 'ArrowLeft') dCol = -1;
        else if (ev.key === 'ArrowRight') dCol = 1;
        
        if (ev.shiftKey) {
          const anchor = State.getData().cellSelection
            ? State.getData().cellSelection.anchor
            : ui.lastFocusedCell;
          const focus = {
            rowId: row.row.id,
            colIdx: ui.lastFocusedCell.colIdx + dCol
          };
          if (dRow !== 0) {
            const rowIdx = visible.indexOf(row);
            const newIdx = Math.max(0, Math.min(visible.length - 1, rowIdx + dRow));
            focus.rowId = visible[newIdx].row.id;
          }
          const cols = State.getColumns();
          focus.colIdx = Math.max(0, Math.min(cols.length - 1, focus.colIdx));
          State.setCellSelection(anchor, focus);
          ui.lastFocusedCell = { rowId: focus.rowId, colIdx: focus.colIdx };
        } else {
          moveFocusRelative(row.row, ui.lastFocusedCell.colIdx, dRow, dCol);
        }
      } else if (ev.key === 'Enter') {
        if (ui.lastFocusedCell && !DOM.isEditableTarget(ev.target)) {
          const visible = getVisibleRows();
          const row = visible.find((v) => v.row.id === ui.lastFocusedCell.rowId);
          if (!row) return;
          ev.preventDefault();
          const td = ui.wrapper.querySelector(
            `td[data-row-id="${row.row.id}"][data-col-index="${ui.lastFocusedCell.colIdx}"]`
          );
          if (td) beginEdit(td, row.row, ui.lastFocusedCell.colIdx, State.getColumns()[ui.lastFocusedCell.colIdx]);
        }
      }
    });
  }

  /* ---------- Public API ---------- */

  App.DataTable = {
    mount,
    render,
    installKeyboard,
    copySelection,
    cutSelection,
    pasteAtSelection,
    clearSelection,
    beginEdit,
    cancelEdit
  };
})(window);