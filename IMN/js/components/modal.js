/**
 * Modal system.
 *
 * Public API:
 *   const m = modal.open({ title, content, footer, ... });
 *   m.close();
 *   m.setContent(...);
 *   modal.closeAll();
 *
 * Footer action contract
 * ----------------------
 * Each action is `{ label, variant, onClick, keepOpen, closeOnClick }`.
 * `onClick` may return:
 *   • undefined / true  → modal closes
 *   • false             → modal stays open (keep user's input)
 *   • a Promise         → awaited; resolves to one of the above
 *
 * This makes async validation and network errors safe: return `false`
 * from the awaited handler and the modal won't close on failure.
 */

import { $, createElement, focusFirst } from "../utils/dom.js";
import { icon } from "./icons.js";

const ROOT_ID = "modal-root";
let root = null;
const stack = [];
let previousFocus = null;

function getRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById(ROOT_ID) || (() => {
    const r = createElement("div", { id: ROOT_ID, class: "modal-root", "aria-hidden": "true" });
    document.body.appendChild(r);
    return r;
  })();
  return root;
}

const SIZE = {
  sm: "modal--sm",
  md: "modal--md",
  lg: "modal--lg",
  xl: "modal--xl",
  full: "modal--full",
};

export function open(opts = {}) {
  const {
    title = "",
    iconName,
    size = "md",
    content = "",
    footer = null,
    closeOnBackdrop = true,
    closeOnEscape = true,
    onClose,
    className = "",
  } = opts;

  const container = getRoot();
  previousFocus = document.activeElement;

  const backdrop = createElement("div", { class: "modal-backdrop" });
  const modal = createElement("div", {
    class: `modal ${SIZE[size] || SIZE.md} ${className}`,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title || undefined,
    tabindex: "-1",
  });

  modal.innerHTML = `
    <div class="modal__header">
      <div class="modal__title">
        ${iconName ? icon(iconName, { size: 20 }) : ""}
        <span class="modal__title-text"></span>
      </div>
      <div class="modal__close" role="button" tabindex="0" aria-label="بستن">${icon("close", { size: 18 })}</div>
    </div>
    <div class="modal__body"></div>
    ${footer ? '<div class="modal__footer"></div>' : ""}
  `;

  modal.querySelector(".modal__title-text").textContent = title;

  const body = modal.querySelector(".modal__body");
  if (typeof content === "string") body.innerHTML = content;
  else if (content instanceof Node) body.appendChild(content);

  /* ---------- Footer actions ---------- */
  if (footer && Array.isArray(footer)) {
    const footerEl = modal.querySelector(".modal__footer");

    footer.forEach((action) => {
      const btn = createElement("button", {
        type: "button",
        class: `btn btn--${action.variant || "secondary"}${action.icon ? " btn--icon" : ""}`,
      });
      if (action.icon) btn.innerHTML = icon(action.icon, { size: 16 });
      else btn.textContent = action.label || "";
      if (action.title) btn.title = action.title;

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;

        const wasDisabled = btn.disabled;
        btn.disabled = true;
        const isPrimary = (action.variant || "secondary") === "primary";
        if (isPrimary) btn.classList.add("is-loading");

        try {
          let result = action.onClick ? action.onClick(e, handle) : undefined;
          if (result && typeof result.then === "function") {
            result = await result;
          }
          if (result === false) return; // keep open
          if (action.keepOpen) return;
          if (action.closeOnClick === false) return;
          close();
        } catch (err) {
          // Swallow to keep the modal open on error; callers normally
          // surface the error via toast before rejecting.
          console.error("[modal] footer action failed", err);
        } finally {
          if (document.body.contains(btn)) {
            btn.disabled = wasDisabled;
            if (isPrimary) btn.classList.remove("is-loading");
          }
        }
      });

      footerEl.appendChild(btn);
    });
  }

  /* ---------- Backdrop ---------- */
  if (closeOnBackdrop) backdrop.addEventListener("click", () => close());

  /* ---------- Keyboard + focus trap ---------- */
  function onKey(e) {
    if (e.key === "Escape" && closeOnEscape) {
      e.stopPropagation();
      close();
    }
    if (e.key === "Tab") {
      const focusables = modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ---------- Close ---------- */
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;

    document.removeEventListener("keydown", onKey, true);
    modal.style.transition = "transform .18s, opacity .18s";
    modal.style.transform = "scale(.96)";
    modal.style.opacity = "0";
    backdrop.style.transition = "opacity .18s";
    backdrop.style.opacity = "0";

    setTimeout(() => {
      backdrop.remove();
      modal.remove();
      const idx = stack.indexOf(handle);
      if (idx >= 0) stack.splice(idx, 1);
      if (!stack.length) {
        container.classList.remove("is-open");
        container.setAttribute("aria-hidden", "true");
        document.body.classList.remove("no-scroll");
      }
      try { previousFocus?.focus?.(); } catch { /* ignore */ }
      onClose?.();
    }, 200);
  }

  const handle = {
    el: modal,
    backdrop,
    close,
    setTitle(t) { modal.querySelector(".modal__title-text").textContent = t; },
    setContent(c) {
      if (typeof c === "string") body.innerHTML = c;
      else {
        body.innerHTML = "";
        if (c) body.appendChild(c);
      }
    },
    get body() { return body; },
  };

  modal.querySelector(".modal__close").addEventListener("click", close);

  container.appendChild(backdrop);
  container.appendChild(modal);
  container.classList.add("is-open");
  container.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  document.addEventListener("keydown", onKey, true);

  stack.push(handle);
  requestAnimationFrame(() => {
    focusFirst(modal);
    if (document.activeElement === document.body) modal.focus();
  });

  return handle;
}

export function closeAll() {
  [...stack].forEach((h) => h.close());
}

export const modal = { open, closeAll };
export default modal;