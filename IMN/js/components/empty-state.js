/**
 * Empty-state builder.
 *
 *   el.innerHTML = emptyState({
 *     icon: "apple",
 *     title: "هنوز غذایی ثبت نشده",
 *     text: "برای شروع، یک وعده غذایی اضافه کنید",
 *     actions: [{ label: "افزودن غذا", icon: "plus", variant: "primary", onClick }],
 *   });
 *
 * Or the DOM version:
 *   el.appendChild(emptyStateEl({ ... , actions }));
 */

import { createElement } from "../utils/dom.js";
import { icon } from "./icons.js";

export function emptyState(opts = {}) {
  const {
    iconName = "info",
    title = "موردی یافت نشد",
    text = "",
    actions = [],
    compact = false,
  } = opts;

  return `
    <div class="empty ${compact ? "empty--compact" : ""}">
      <div class="empty__art">
        ${icon(iconName, { size: 60, strokeWidth: 1.4 })}
      </div>
      <div class="empty__title">${escapeHtml(title)}</div>
      ${text ? `<div class="empty__text">${escapeHtml(text)}</div>` : ""}
      ${actions.length ? `
        <div class="empty__actions">
          ${actions.map((a, i) => `
            <button class="btn btn--${a.variant || "secondary"}" data-empty-action="${i}" type="button">
              ${a.icon ? icon(a.icon, { size: 16 }) : ""}
              <span>${escapeHtml(a.label || "")}</span>
            </button>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

export function emptyStateEl(opts = {}) {
  const wrapper = createElement("div");
  wrapper.innerHTML = emptyState(opts);
  const actions = opts.actions || [];
  wrapper.querySelectorAll("[data-empty-action]").forEach((btn) => {
    const i = Number(btn.dataset.emptyAction);
    btn.addEventListener("click", (e) => actions[i]?.onClick?.(e));
  });
  return wrapper.firstElementChild;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}