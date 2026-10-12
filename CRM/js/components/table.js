/* ============================================================================
   DATA TABLE COMPONENT
   ----------------------------------------------------------------------------
   Features:
   - sortable columns
   - multi-select with shift+click
   - bulk actions
   - column visibility
   - dense/striped toggles
   - row actions
   - context menu support
   - drag & drop rows
   - sticky header
   - loading/empty states
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Persian = window.Persian;

  const Table = {
    /* ---------- Render ---------- */
    render(container, options = {}) {
      if (!container) return null;
      Dom.empty(container);

      const {
        columns = [],
        rows = [],
        keyField = "id",
        selection = true,
        loading = false,
        sortBy = null,
        sortDir = "asc",
        onSort = null,
        onRowClick = null,
        onSelectionChange = null,
        rowActions = null,
        contextMenu = null,
        draggable = false,
        onReorder = null,
        emptyState = null,
        striped = false,
        dense = false,
        stickyHeader = true,
        onCellRender = null,
      } = options;

      const wrap = Dom.el("div", { class: "table-wrap" });

      if (loading) {
        wrap.appendChild(Dom.el("div", { class: "table-loading" }, [
          Dom.el("div", { class: "table-loading__spinner" }),
          Dom.el("span", null, "در حال بارگذاری…"),
        ]));
        container.appendChild(wrap);
        return null;
      }

      if (!rows.length) {
        const empty = emptyState || {
          icon: "ri-inbox-line",
          title: "داده‌ای یافت نشد",
          text: "برای مشاهده نتایج، فیلترها یا عبارت جستجو را تغییر دهید.",
        };
        wrap.appendChild(this.renderEmpty(empty));
        container.appendChild(wrap);
        return null;
      }

      const visibleCols = columns.filter((c) => c.visible !== false);

      const table = Dom.el("table", {
        class: `table ${striped ? "table--striped" : ""} ${dense ? "table--dense" : ""}`.trim(),
      });

      /* ---------- Head ---------- */
      const thead = Dom.el("thead");
      const headRow = Dom.el("tr");

      if (selection) {
        const th = Dom.el("th", { class: "table__check-col" });
        const cb = Dom.el("label", { class: "checkbox" });
        const input = Dom.el("input", { type: "checkbox", "aria-label": "انتخاب همه" });
        const box = Dom.el("span", { class: "checkbox__box" }, [
          Dom.el("i", { class: "ri-check-line" }),
        ]);
        cb.appendChild(input);
        cb.appendChild(box);
        input.addEventListener("change", () => {
          Dom.qa("tbody tr", table).forEach((tr) => {
            const rowId = tr.dataset.rowId;
            const rowInput = tr.querySelector('input[type="checkbox"]');
            if (rowInput) {
              rowInput.checked = input.checked;
              Dom.toggleClass(tr, "is-selected", input.checked);
            }
            void rowId;
          });
          if (onSelectionChange) onSelectionChange(this.getSelected(table));
        });
        th.appendChild(cb);
        headRow.appendChild(th);
      }

      visibleCols.forEach((col) => {
        const th = Dom.el("th", {
          class: `${col.sortable ? "is-sortable" : ""} ${sortBy === col.key ? `is-sorted-${sortDir}` : ""} ${col.align === "center" ? "text-center" : col.align === "end" ? "text-end" : ""}`.trim(),
          style: col.width ? `width:${typeof col.width === "number" ? col.width + "px" : col.width}` : "",
        });

        const inner = Dom.el("div", { class: "th-inner" });
        inner.appendChild(Dom.el("span", null, col.label));
        if (col.sortable) {
          inner.appendChild(Dom.el("i", { class: "sort-icon ri-arrow-up-line" }));
        }
        th.appendChild(inner);

        if (col.sortable) {
          th.addEventListener("click", () => {
            const nextDir = sortBy === col.key && sortDir === "asc" ? "desc" : "asc";
            if (onSort) onSort(col.key, nextDir);
          });
        }

        headRow.appendChild(th);
      });

      if (rowActions) {
        headRow.appendChild(Dom.el("th", { class: "text-end", style: "width:120px" }, "عملیات"));
      }

      thead.appendChild(headRow);
      table.appendChild(thead);

      /* ---------- Body ---------- */
      const tbody = Dom.el("tbody");

      rows.forEach((row) => {
        const tr = Dom.el("tr", {
          dataset: { rowId: row[keyField] },
          draggable: draggable ? "true" : null,
        });

        // Selection checkbox
        if (selection) {
          const td = Dom.el("td", { class: "table__check-col" });
          const cb = Dom.el("label", { class: "checkbox" });
          const input = Dom.el("input", { type: "checkbox", "aria-label": "انتخاب ردیف" });
          input.checked = !!row._selected;
          const box = Dom.el("span", { class: "checkbox__box" }, [
            Dom.el("i", { class: "ri-check-line" }),
          ]);
          cb.appendChild(input);
          cb.appendChild(box);
          input.addEventListener("click", (e) => {
            if (e.shiftKey) {
              this.selectRange(table, row[keyField], input.checked);
            }
          });
          input.addEventListener("change", () => {
            Dom.toggleClass(tr, "is-selected", input.checked);
            if (onSelectionChange) onSelectionChange(this.getSelected(table));
          });
          td.appendChild(cb);
          tr.appendChild(td);
          if (row._selected) Dom.addClass(tr, "is-selected");
        }

        // Cells
        visibleCols.forEach((col) => {
          const td = Dom.el("td", {
            class: `${col.wrap ? "wrap" : ""} ${col.align === "center" ? "text-center" : col.align === "end" ? "text-end" : ""}`.trim(),
            dataset: { column: col.key },
          });

          let content;
          if (typeof col.render === "function") {
            content = col.render(row);
          } else {
            content = row[col.key];
          }

          if (content instanceof HTMLElement) td.appendChild(content);
          else if (content == null) td.textContent = "—";
          else td.innerHTML = String(content);

          if (typeof onCellRender === "function") onCellRender(td, row, col);

          tr.appendChild(td);
        });

        // Actions
        if (rowActions) {
          const td = Dom.el("td", { class: "text-end" });
          const actionsWrap = Dom.el("div", { class: "table__cell-actions" });

          const acts = typeof rowActions === "function" ? rowActions(row) : rowActions;
          (acts || []).forEach((a) => {
            const btn = Dom.el("button", {
              class: `icon-btn ${a.danger ? "text-danger" : ""}`,
              type: "button",
              title: a.title || "",
              "aria-label": a.title || "",
            }, [Dom.el("i", { class: a.icon })]);
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (typeof a.onClick === "function") a.onClick(row, e);
            });
            actionsWrap.appendChild(btn);
          });

          if (contextMenu) {
            const more = Dom.el("button", {
              class: "icon-btn",
              type: "button",
              title: "بیشتر",
              "aria-label": "منوی بیشتر",
            }, [Dom.el("i", { class: "ri-more-2-line" })]);
            more.addEventListener("click", (e) => {
              e.stopPropagation();
              const items = typeof contextMenu === "function" ? contextMenu(row) : contextMenu;
              window.ContextMenu.show(e.clientX, e.clientY, {
                title: row.name || row.title || "",
                subtitle: row.sku || row.order_number || "",
                items,
              });
            });
            actionsWrap.appendChild(more);
          }

          td.appendChild(actionsWrap);
          tr.appendChild(td);
        }

        // Row events
        if (onRowClick) {
          tr.addEventListener("click", (e) => {
            if (e.target.closest("button, a, input, label")) return;
            onRowClick(row, e);
          });
        }

        if (contextMenu) {
          window.ContextMenu.attach(tr, () => {
            const items = typeof contextMenu === "function" ? contextMenu(row) : contextMenu;
            return items;
          }, {
            title: row.name || row.title || "",
            subtitle: row.sku || row.order_number || "",
          });
        }

        if (draggable && onReorder) {
          this.attachDrag(tbody, tr, onReorder);
        }

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      wrap.appendChild(table);
      container.appendChild(wrap);

      return { table, wrap };
    },

    /* ---------- Empty ---------- */
    renderEmpty(state) {
      return Dom.el("div", { class: "empty-state" }, [
        Dom.el("i", { class: `${state.icon || "ri-inbox-line"} empty-state__icon` }),
        Dom.el("h3", null, state.title || "داده‌ای یافت نشد"),
        Dom.el("p", null, state.text || ""),
      ]);
    },

    /* ---------- Selection ---------- */
    getSelected(table) {
      const ids = [];
      Dom.qa("tbody tr.is-selected", table).forEach((tr) => {
        ids.push(tr.dataset.rowId);
      });
      return ids;
    },

    clearSelection(table) {
      Dom.qa("tbody tr.is-selected", table).forEach((tr) => {
        Dom.removeClass(tr, "is-selected");
        const cb = tr.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
      });
    },

    selectRange(table, currentId, checked) {
      const rows = Dom.qa("tbody tr", table);
      const idxCurrent = rows.findIndex((r) => r.dataset.rowId === currentId);
      const lastSelected = table._lastSelectedId;
      const idxLast = lastSelected ? rows.findIndex((r) => r.dataset.rowId === lastSelected) : idxCurrent;
      const start = Math.min(idxCurrent, idxLast);
      const end = Math.max(idxCurrent, idxLast);
      for (let i = start; i <= end; i++) {
        const tr = rows[i];
        const cb = tr.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = checked;
          Dom.toggleClass(tr, "is-selected", checked);
        }
      }
      table._lastSelectedId = currentId;
    },

    /* ---------- Drag & drop rows ---------- */
    attachDrag(tbody, tr, onReorder) {
      tr.addEventListener("dragstart", (e) => {
        Dom.addClass(tr, "is-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", tr.dataset.rowId);
      });

      tr.addEventListener("dragend", () => {
        Dom.removeClass(tr, "is-dragging");
        Dom.qa("tr", tbody).forEach((r) => Dom.removeClass(r, "is-drag-over"));
      });

      tr.addEventListener("dragover", (e) => {
        e.preventDefault();
        Dom.addClass(tr, "is-drag-over");
      });

      tr.addEventListener("dragleave", () => {
        Dom.removeClass(tr, "is-drag-over");
      });

      tr.addEventListener("drop", (e) => {
        e.preventDefault();
        Dom.removeClass(tr, "is-drag-over");
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === tr.dataset.rowId) return;
        const rows = Dom.qa("tr", tbody);
        const fromIdx = rows.findIndex((r) => r.dataset.rowId === draggedId);
        const toIdx = rows.findIndex((r) => r.dataset.rowId === tr.dataset.rowId);
        if (fromIdx < 0 || toIdx < 0) return;
        if (onReorder) onReorder(fromIdx, toIdx);
      });
    },

    /* ---------- Skeleton loader ---------- */
    skeleton(cols = 5, rows = 8) {
      const table = Dom.el("table", { class: "table table--dense" });
      const thead = Dom.el("thead");
      const hr = Dom.el("tr");
      for (let i = 0; i < cols; i++) hr.appendChild(Dom.el("th", null, ""));
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = Dom.el("tbody");
      for (let r = 0; r < rows; r++) {
        const tr = Dom.el("tr", { class: "skeleton-row" });
        for (let c = 0; c < cols; c++) {
          const td = Dom.el("td");
          td.appendChild(Dom.el("span", { class: `skeleton ${c === 0 ? "skeleton--avatar" : ""}`.trim() }));
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      return table;
    },

    /* ---------- Column picker ---------- */
    columnPicker(anchor, columns, onChange) {
      const items = columns.map((col) => ({
        label: col.label,
        icon: col.visible === false ? "ri-checkbox-blank-circle-line" : "ri-checkbox-circle-fill",
        onClick: () => {
          col.visible = col.visible === false;
          if (onChange) onChange(columns);
        },
        keepOpen: true,
      }));
      return window.Dropdown.open(anchor, { items });
    },
  };

  window.DataTable = Table;
})(window);