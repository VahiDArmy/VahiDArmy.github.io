/**
 * Data table with sort, search, pagination, row selection, and per-row
 * actions. Renders plain HTML — no framework.
 *
 *   const t = createTable({
 *     columns: [
 *       { key: "date",     label: "تاریخ",   sortable: true, format: (r) => ... },
 *       { key: "calories", label: "کالری",   sortable: true, align: "num" },
 *       { key: "actions",  label: "",        render: (r) => "..." },
 *     ],
 *     rows: data,
 *     pageSize: 10,
 *     searchable: true,
 *     onRowClick: (row) => ...,
 *     rowActions: (row) => [...],
 *   });
 *   container.appendChild(t.el);
 *   t.setRows(newData);
 */

import { createElement, delegate } from "../utils/dom.js";
import { icon } from "./icons.js";

export function createTable(opts = {}) {
  const {
    columns = [],
    rows: initialRows = [],
    pageSize = 10,
    searchable = true,
    searchKeys = null,
    emptyText = "داده‌ای وجود ندارد",
    onRowClick,
    onSelectionChange,
    rowActions,
    rowKey = (r, i) => r.id ?? i,
    rowClass,
  } = opts;

  let rows = [...initialRows];
  let sortKey = null;
  let sortDir = "asc";
  let query = "";
  let page = 1;
  let selected = new Set();

  const el = createElement("div", { class: "table-component" });
  el.innerHTML = `
    ${searchable ? `
      <div class="food-modal-toolbar">
        <div class="search">
          <input type="search" class="search__input" placeholder="جستجو..." />
          <span class="search__icon">${icon("search", { size: 18 })}</span>
        </div>
      </div>
    ` : ""}
    <div class="table-wrap">
      <table class="table">
        <thead></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="pagination">
      <div class="pagination__info"></div>
      <div class="pagination__controls"></div>
    </div>
  `;

  const thead = el.querySelector("thead");
  const tbody = el.querySelector("tbody");
  const searchInput = el.querySelector(".search__input");
  const pagInfo = el.querySelector(".pagination__info");
  const pagControls = el.querySelector(".pagination__controls");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      query = e.target.value.trim().toLowerCase();
      page = 1;
      render();
    });
  }

  delegate(thead, "click", "th[data-sortable]", (_, th) => {
    const key = th.dataset.key;
    if (sortKey === key) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = "asc";
    }
    render();
  });

  delegate(tbody, "click", "tr", (e, tr) => {
    const key = tr.dataset.key;
    const row = rows.find((r, i) => String(rowKey(r, i)) === key);
    if (!row) return;

    // Multi-select with checkbox
    if (e.target.closest("[data-row-check]")) {
      const k = tr.dataset.key;
      if (selected.has(k)) selected.delete(k);
      else selected.add(k);
      tr.classList.toggle("is-selected", selected.has(k));
      onSelectionChange?.([...selected]);
      return;
    }
    if (e.target.closest("[data-row-action]")) {
      const action = e.target.closest("[data-row-action]").dataset.rowAction;
      const found = (rowActions?.(row) || []).find((a) => a.id === action);
      found?.onClick?.(row, e);
      return;
    }
    onRowClick?.(row, e);
  });

  function getFilteredRows() {
    let out = rows;
    if (query) {
      const keys = searchKeys || columns.map((c) => c.key).filter(Boolean);
      out = out.filter((r) =>
        keys.some((k) => String(r[k] ?? "").toLowerCase().includes(query))
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      out = [...out].sort((a, b) => {
        const va = col?.sortValue ? col.sortValue(a) : a[sortKey];
        const vb = col?.sortValue ? col.sortValue(b) : b[sortKey];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") {
          return sortDir === "asc" ? va - vb : vb - va;
        }
        const sa = String(va), sb = String(vb);
        return sortDir === "asc" ? sa.localeCompare(sb, "fa") : sb.localeCompare(sa, "fa");
      });
    }
    return out;
  }

  function render() {
    // Header
    thead.innerHTML = `<tr>${
      rowActions ? '<th style="width:36px"></th>' : ""
    }${columns.map((c) => {
      const cls = [
        c.sortable ? "is-sortable" : "",
        sortKey === c.key ? `is-sorted-${sortDir}` : "",
        c.align === "num" ? "num" : "",
      ].filter(Boolean).join(" ");
      return `<th class="${cls}" data-key="${c.key}" data-sortable="${c.sortable ? "1" : ""}" style="${c.width ? `width:${c.width}` : ""}">${escapeHtml(c.label || "")}</th>`;
    }).join("")}</tr>`;

    const filtered = getFilteredRows();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages);
    const start = (page - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);

    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="${columns.length + (rowActions ? 1 : 0)}" class="table__empty">${emptyText}</td></tr>`;
      pagInfo.textContent = "";
      pagControls.innerHTML = "";
      return;
    }

    tbody.innerHTML = visible.map((r, i) => {
      const key = String(rowKey(r, start + i));
      const isSel = selected.has(key);
      const extraClass = rowClass?.(r) || "";
      const actionsHtml = rowActions
        ? `<td>${(rowActions(r) || []).map((a) =>
            `<button class="icon-btn" data-row-action="${a.id}" title="${escapeHtml(a.title || "")}" type="button">${icon(a.icon || "more", { size: 14 })}</button>`
          ).join("")}</td>`
        : "";
      return `
        <tr data-key="${key}" class="${isSel ? "is-selected" : ""} ${extraClass}">
          ${actionsHtml}
          ${columns.map((c) => {
            const content = c.render ? c.render(r) : escapeHtml(r[c.key] ?? "—");
            return `<td class="${c.align === "num" ? "num" : ""}">${content}</td>`;
          }).join("")}
        </tr>
      `;
    }).join("");

    // Pagination
    pagInfo.textContent = `${start + 1}–${Math.min(start + pageSize, filtered.length)} از ${filtered.length}`;
    pagControls.innerHTML = "";
    const mkBtn = (label, target, disabled, active) => {
      const b = createElement("button", {
        class: `pagination__btn${active ? " is-active" : ""}`,
        type: "button",
        disabled: disabled ? "true" : null,
      });
      if (typeof label === "string") b.innerHTML = label;
      else b.appendChild(label);
      if (!disabled && !active) {
        b.addEventListener("click", () => {
          page = target;
          render();
        });
      }
      return b;
    };
    pagControls.appendChild(mkBtn(icon("chevronRight", { size: 14 }), page - 1, page <= 1));
    const pageWindow = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pageWindow.push(p);
      else if (pageWindow[pageWindow.length - 1] !== "…") pageWindow.push("…");
    }
    pageWindow.forEach((p) => {
      if (p === "…") {
        const s = createElement("span", { class: "pagination__btn", style: "pointer-events:none" }, "…");
        pagControls.appendChild(s);
      } else {
        pagControls.appendChild(mkBtn(String(p), p, false, p === page));
      }
    });
    pagControls.appendChild(mkBtn(icon("chevronLeft", { size: 14 }), page + 1, page >= totalPages));
  }

  render();

  return {
    el,
    setRows(next) {
      rows = [...next];
      page = 1;
      selected.clear();
      render();
    },
    getRows() { return rows; },
    getSelection() { return [...selected]; },
    clearSelection() {
      selected.clear();
      render();
    },
    refresh: render,
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}