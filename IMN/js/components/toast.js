/**
 * Toast notifications.
 *
 * Usage:
 *   toast.success("ذخیره شد");
 *   toast.error("خطا در ذخیره", { title: "خطا" });
 *   const t = toast.info("در حال بارگذاری...", { duration: 0 });
 *   t.dismiss();
 *
 * Features: queued limit, auto dismiss, manual close, hover-to-pause,
 * progress bar, action button, RTL-aware animation, ARIA live region.
 */

import { $, createElement } from "../utils/dom.js";
import { icon } from "./icons.js";
import { TOAST_DEFAULTS } from "../config/constants.js";

const ROOT_ID = "toast-root";
let root = null;
const active = new Set();

function getRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById(ROOT_ID) || (() => {
    const r = createElement("div", { id: ROOT_ID, class: "toast-root", "aria-live": "polite", "aria-atomic": "true" });
    document.body.appendChild(r);
    return r;
  })();
  return root;
}

const ICON_BY_TYPE = {
  success: "check",
  error: "alert",
  warning: "alert",
  info: "info",
  default: "bell",
};

const TITLE_BY_TYPE = {
  success: "موفق",
  error: "خطا",
  warning: "هشدار",
  info: "اطلاع",
};

/**
 * Show a toast.
 * opts: { type, title, duration, action, onAction, dismissible, icon }
 */
export function show(message, opts = {}) {
  const {
    type = "default",
    title,
    duration = TOAST_DEFAULTS.duration,
    action,
    onAction,
    dismissible = true,
    iconName,
  } = opts;

  const container = getRoot();

  // Enforce max
  if (active.size >= TOAST_DEFAULTS.max) {
    const oldest = active.values().next().value;
    oldest?.dismiss?.();
  }

  const el = createElement("div", {
    class: `toast toast--${type}`,
    role: type === "error" ? "alert" : "status",
  });

  el.innerHTML = `
    <div class="toast__icon">${icon(iconName || ICON_BY_TYPE[type] || ICON_BY_TYPE.default, { size: 18 })}</div>
    <div class="toast__body">
      ${title !== false ? `<div class="toast__title">${escapeHtml(title || TITLE_BY_TYPE[type] || "")}</div>` : ""}
      <div class="toast__message">${escapeHtml(message)}</div>
    </div>
    ${dismissible ? `<div class="toast__close" role="button" tabindex="0" aria-label="بستن">${icon("close", { size: 14 })}</div>` : ""}
    ${duration > 0 ? `<div class="toast__progress" style="animation-duration:${duration}ms"></div>` : ""}
  `;

  if (action && typeof action === "object") {
    const btn = createElement("button", { class: "btn btn--ghost btn--xs", type: "button", style: "margin-top:6px" }, action.label || "انجام");
    btn.addEventListener("click", () => {
      try { onAction?.(); } finally { dismiss(); }
    });
    el.querySelector(".toast__body")?.appendChild(btn);
  }

  container.appendChild(el);
  active.add(handle);

  let timer = null;
  let remaining = duration;
  let startedAt = 0;

  function startTimer() {
    if (!duration || duration <= 0) return;
    startedAt = Date.now();
    timer = setTimeout(dismiss, remaining);
  }

  function pauseTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining -= Date.now() - startedAt;
  }

  function resumeTimer() {
    if (remaining > 0) startTimer();
  }

  function dismiss() {
    if (!active.has(handle)) return;
    active.delete(handle);
    if (timer) clearTimeout(timer);
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    // Safety net in case animation doesn't fire
    setTimeout(() => el.isConnected && el.remove(), 600);
  }

  const handle = { el, dismiss };

  el.querySelector(".toast__close")?.addEventListener("click", dismiss);

  // Pause on hover so users can read
  el.addEventListener("mouseenter", pauseTimer);
  el.addEventListener("mouseleave", resumeTimer);

  // Focus pause (keyboard)
  el.addEventListener("focusin", pauseTimer);
  el.addEventListener("focusout", resumeTimer);

  startTimer();
  return handle;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const toast = {
  show,
  success: (msg, opts = {}) => show(msg, { ...opts, type: "success" }),
  error:   (msg, opts = {}) => show(msg, { ...opts, type: "error" }),
  warning: (msg, opts = {}) => show(msg, { ...opts, type: "warning" }),
  info:    (msg, opts = {}) => show(msg, { ...opts, type: "info" }),
  dismissAll() {
    active.forEach((h) => h.dismiss());
  },
};