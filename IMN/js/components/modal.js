/**
 * Modal system.
 *
 * Usage:
 *   const m = modal.open({
 *     title: "افزودن غذا",
 *     size: "md",
 *     content: `<div>...</div>` || HTMLElement,
 *     footer: [ { label: "انصراف", variant: "ghost", onClick: close },
 *               { label: "ذخیره", variant: "primary", onClick: save } ],
 *     onClose,
 *     closeOnBackdrop: true,
 *     closeOnEscape: true,
 *   });
 *   m.close();
 *   m.setContent(...)
 *
 * Only one modal is visible at a time (a stack is supported but the top
 * one gets focus; when it closes, focus returns to the previous opener).
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

  // Body content
  const body = modal.querySelector(".modal__body");
  if (typeof content === "string") body.innerHTML = content;
  else if (content instanceof Node) body.appendChild(content);

  // Footer actions
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
      btn.addEventListener("click", (e) => {
        const result = action.onClick?.(e, handle);
        if (result === false) return; // keep modal open
        if (action.keepOpen) return;
        if (action.closeOnClick !== false) close();
      });
      footerEl.appendChild(btn);
    });
  }

  // Backdrop click
  if (closeOnBackdrop) {
    backdrop.addEventListener("click", () => close());
  }

  // Escape key
  function onKey(e) {
    if (e.key === "Escape" && closeOnEscape) {
      e.stopPropagation();
      close();
    }
    // Focus trap
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

  function close() {
    document.removeEventListener("keydown", onKey, true);
    modal.classList.add("is-leaving");
    backdrop.style.opacity = "0";
    backdrop.style.transition = "opacity .2s";
    modal.style.transition = "transform .18s, opacity .18s";
    modal.style.transform = "scale(.96)";
    modal.style.opacity = "0";
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

  // Focus first input
  requestAnimationFrame(() => {
    focusFirst(modal);
    if (document.activeElement === document.body) modal.focus();
  });

  return handle;
}

export function confirm(opts) {
  // delegate to confirm.js to avoid circular imports
  return import("./confirm.js").then((m) => m.confirm(opts));
}

export function closeAll() {
  [...stack].forEach((h) => h.close());
}