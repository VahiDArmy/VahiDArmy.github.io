// ============================================================================
// toast.js — non-blocking notification toasts
// ============================================================================

import { escapeHtml, uuid } from "../utils.js";

const ICONS = {
  ok: `<svg width="16" height="16" viewBox="0 0 24 24"><path d="M4.5 12.5 9 17l10.5-10.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  err: `<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v6M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  warn: `<svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 3.5 21 20H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  info: `<svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};

function getRoot() {
  return document.getElementById("toasts");
}

/**
 * showToast({ kind, title, message, timeout, actions })
 *   kind: "ok" | "err" | "warn" | "info"
 *   actions: [{ label, onClick }]
 */
export function showToast(opts = {}) {
  const root = getRoot();
  if (!root) return;
  const { kind = "info", title, message, timeout = 5000, actions = [] } = opts;

  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.setAttribute("role", kind === "err" ? "alert" : "status");
  el.dataset.id = uuid();

  const icon = ICONS[kind] || ICONS.info;
  el.innerHTML = `
    <span class="toast__ico">${icon}</span>
    <div class="toast__body">
      ${title ? `<div class="toast__title">${escapeHtml(title)}</div>` : ""}
      ${message ? `<div class="toast__msg">${escapeHtml(String(message))}</div>` : ""}
    </div>
    <button type="button" class="toast__close" aria-label="بستن">
      <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
  `;

  if (actions && actions.length) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;";
    for (const a of actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ghost-btn ghost-btn--tiny";
      b.textContent = a.label;
      b.addEventListener("click", () => {
        try {
          a.onClick?.();
        } finally {
          remove();
        }
      });
      bar.appendChild(b);
    }
    el.querySelector(".toast__body").appendChild(bar);
  }

  const remove = () => {
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector(".toast__close").addEventListener("click", remove);
  root.appendChild(el);

  if (timeout > 0) setTimeout(remove, timeout);
  return { remove };
}

export const toast = {
  ok: (msg, title) => showToast({ kind: "ok", message: msg, title }),
  err: (msg, title) => showToast({ kind: "err", message: msg, title, timeout: 9000 }),
  warn: (msg, title) => showToast({ kind: "warn", message: msg, title, timeout: 7000 }),
  info: (msg, title) => showToast({ kind: "info", message: msg, title }),
  custom: showToast,
};
