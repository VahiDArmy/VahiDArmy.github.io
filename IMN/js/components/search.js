/**
 * Search input with results dropdown.
 *
 *   const s = searchField({
 *     placeholder: "جستجوی غذا...",
 *     onQuery: debounce((q) => foods.search(q), 150),
 *     onSelect: (item) => addFood(item),
 *     renderItem: (item) => ({ title, subtitle, badge, icon }),
 *     emptyText: "نتیجه‌ای یافت نشد",
 *     minChars: 1,
 *   });
 *   container.appendChild(s.el);
 */

import { createElement, focusFirst } from "../utils/dom.js";
import { icon } from "./icons.js";
import { debounce } from "../utils/async.js";

export function searchField(opts = {}) {
  const {
    placeholder = "جستجو...",
    onQuery,
    onSelect,
    renderItem = (x) => ({ title: String(x) }),
    emptyText = "نتیجه‌ای یافت نشد",
    minChars = 1,
    delay = 180,
    clearable = true,
    showShortcut = false,
    shortcut = "/",
  } = opts;

  const el = createElement("div", { class: "search" });
  el.innerHTML = `
    <input type="search" class="search__input" autocomplete="off" aria-autocomplete="list" role="combobox" aria-expanded="false" />
    <span class="search__icon">${icon("search", { size: 18 })}</span>
    ${clearable ? `<span class="search__clear" hidden role="button" aria-label="پاک کردن">${icon("close", { size: 14 })}</span>` : ""}
    ${showShortcut ? `<span class="search__shortcut">${shortcut}</span>` : ""}
    <div class="search__results" role="listbox" hidden></div>
  `;

  const input = el.querySelector(".search__input");
  const clearBtn = el.querySelector(".search__clear");
  const results = el.querySelector(".search__results");
  input.placeholder = placeholder;

  let currentItems = [];
  let focusIdx = -1;

  const runQuery = debounce(async (q) => {
    if (!onQuery) return;
    const trimmed = q.trim();
    if (trimmed.length < minChars) {
      renderResults([]);
      return;
    }
    el.classList.add("is-loading");
    try {
      const items = (await onQuery(trimmed)) || [];
      currentItems = items;
      renderResults(items);
    } catch (err) {
      console.error("[search] query failed", err);
      renderResults([]);
    } finally {
      el.classList.remove("is-loading");
    }
  }, delay);

  function renderResults(items) {
    if (!items.length) {
      results.innerHTML = `<div class="food-search-empty">${emptyText}</div>`;
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      focusIdx = -1;
      return;
    }
    results.innerHTML = items
      .map((item, i) => {
        const meta = renderItem(item) || {};
        return `
          <div class="search__result" role="option" data-index="${i}">
            ${meta.icon ? `<span class="search__result-icon">${icon(meta.icon, { size: 16 })}</span>` : ""}
            <div class="search__result-body">
              <div class="search__result-title">${escapeHtml(meta.title || "")}</div>
              ${meta.subtitle ? `<div class="search__result-sub">${escapeHtml(meta.subtitle)}</div>` : ""}
            </div>
            ${meta.badge ? `<span class="search__result-badge">${escapeHtml(meta.badge)}</span>` : ""}
          </div>
        `;
      })
      .join("");
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    focusIdx = -1;
  }

  function closeResults() {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    focusIdx = -1;
  }

  function highlight(idx) {
    const nodes = [...results.querySelectorAll(".search__result")];
    nodes.forEach((n) => n.classList.remove("is-focused"));
    if (idx < 0 || idx >= nodes.length) return;
    nodes[idx].classList.add("is-focused");
    nodes[idx].scrollIntoView({ block: "nearest" });
  }

  function pick(idx) {
    if (idx < 0 || idx >= currentItems.length) return;
    const item = currentItems[idx];
    closeResults();
    onSelect?.(item);
  }

  input.addEventListener("input", () => {
    if (clearBtn) clearBtn.hidden = !input.value;
    runQuery(input.value);
  });

  input.addEventListener("focus", () => {
    if (currentItems.length) {
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusIdx = Math.min(focusIdx + 1, currentItems.length - 1);
      highlight(focusIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusIdx = Math.max(focusIdx - 1, 0);
      highlight(focusIdx);
    } else if (e.key === "Enter") {
      if (focusIdx >= 0) {
        e.preventDefault();
        pick(focusIdx);
      } else if (currentItems.length) {
        e.preventDefault();
        pick(0);
      }
    } else if (e.key === "Escape") {
      closeResults();
    }
  });

  results.addEventListener("mousedown", (e) => {
    const row = e.target.closest(".search__result");
    if (!row) return;
    e.preventDefault();
    pick(Number(row.dataset.index));
  });

  clearBtn?.addEventListener("click", () => {
    input.value = "";
    clearBtn.hidden = true;
    currentItems = [];
    closeResults();
    input.focus();
  });

  document.addEventListener("mousedown", (e) => {
    if (!el.contains(e.target)) closeResults();
  });

  // Global shortcut to focus
  if (showShortcut) {
    document.addEventListener("keydown", (e) => {
      if (
        e.key === shortcut &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  return {
    el,
    input,
    results,
    focus: () => focusFirst(el),
    setValue(v) {
      input.value = v;
      if (clearBtn) clearBtn.hidden = !v;
      runQuery(v);
    },
    clear() {
      input.value = "";
      currentItems = [];
      closeResults();
      if (clearBtn) clearBtn.hidden = true;
    },
    close: closeResults,
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}