// ============================================================================
// modal.js — full modal system (open, close, confirm, prompt)
// ============================================================================

import { escapeHtml, uuid, copyText } from "../utils.js";
import { toast } from "./toast.js";

const root = () => document.getElementById("modalRoot");
const stack = [];

const CLOSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/**
 * openModal({ title, subtitle, body, footer, className, onClose })
 *   body / footer: string | HTMLElement
 */
export function openModal(opts = {}) {
  const {
    title = "",
    subtitle = "",
    body = "",
    footer = "",
    className = "",
    width = "",
    closable = true,
    onClose,
    onMount,
    hideHead = false,
  } = opts;

  const id = uuid();
  const wrapper = document.createElement("div");
  wrapper.dataset.modalId = id;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  if (closable) backdrop.addEventListener("click", () => closeModal(id));

  const modal = document.createElement("div");
  modal.className = `modal ${className}`.trim();
  if (width) modal.style.width = width;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", title || "دیالوگ");

  const headHtml = hideHead
    ? ""
    : `<div class="modal__head">
        <div class="modal__title">
          <div>${escapeHtml(title)}</div>
          ${subtitle ? `<div class="modal__sub">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        ${
          closable
            ? `<button type="button" class="icon-btn icon-btn--tiny" data-close>${CLOSE_ICON}</button>`
            : ""
        }
      </div>`;

  modal.innerHTML = `${headHtml}<div class="modal__body"></div>${footer ? '<div class="modal__foot"></div>' : ""}`;

  const bodyEl = modal.querySelector(".modal__body");
  if (typeof body === "string") bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);

  if (footer) {
    const footEl = modal.querySelector(".modal__foot");
    if (typeof footer === "string") footEl.innerHTML = footer;
    else if (footer instanceof Node) footEl.appendChild(footer);
  }

  if (closable) {
    modal.querySelector("[data-close]")?.addEventListener("click", () => closeModal(id));
  }

  wrapper.appendChild(backdrop);
  wrapper.appendChild(modal);
  root().appendChild(wrapper);

  const entry = { id, wrapper, modal, onClose };
  stack.push(entry);

  if (onMount) onMount(modal, id);

  // Escape closes the top-most modal
  const onKey = (e) => {
    if (e.key === "Escape" && closable && stack[stack.length - 1]?.id === id) {
      e.preventDefault();
      closeModal(id);
    }
  };
  window.addEventListener("keydown", onKey);
  entry.cleanup = () => window.removeEventListener("keydown", onKey);

  return { id, modal, wrapper, close: () => closeModal(id) };
}

export function closeModal(id) {
  const idx = stack.findIndex((s) => s.id === id);
  if (idx === -1) {
    // maybe the caller passed the whole wrapper
    return;
  }
  const [entry] = stack.splice(idx, 1);
  entry.cleanup?.();
  entry.wrapper.remove();
  try {
    entry.onClose?.();
  } catch (e) {
    console.error(e);
  }
}

export function closeAllModals() {
  while (stack.length) closeModal(stack[stack.length - 1].id);
}

/**
 * Simple confirm dialog.
 *   confirmDialog({ title, message, okLabel, cancelLabel, danger })
 */
export function confirmDialog(opts = {}) {
  const {
    title = "تأیید",
    message = "آیا مطمئن هستید؟",
    okLabel = "تأیید",
    cancelLabel = "انصراف",
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;gap:8px;width:100%;justify-content:flex-start;";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = `btn ${danger ? "btn--danger" : "btn--primary"}`;
    okBtn.textContent = okLabel;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--ghost";
    cancelBtn.textContent = cancelLabel;

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);

    const m = openModal({
      title,
      className: "modal--narrow",
      body: `<div class="confirm-msg">${message}</div>`,
      footer,
      onClose: () => resolve(false),
    });

    cancelBtn.addEventListener("click", () => {
      resolve(false);
      m.close();
    });
    okBtn.addEventListener("click", () => {
      resolve(true);
      m.close();
    });
  });
}

/**
 * Simple prompt dialog.
 */
export function promptDialog(opts = {}) {
  const {
    title = "ورودی",
    label = "مقدار",
    defaultValue = "",
    multiline = false,
    okLabel = "ثبت",
    cancelLabel = "انصراف",
    placeholder = "",
  } = opts;

  return new Promise((resolve) => {
    const body = document.createElement("div");
    body.className = "stack";
    body.innerHTML = `<div class="field">
      <label class="field__label">${escapeHtml(label)}</label>
      ${
        multiline
          ? `<textarea class="textarea" placeholder="${escapeHtml(placeholder)}"></textarea>`
          : `<input class="input" placeholder="${escapeHtml(placeholder)}" />`
      }
    </div>`;

    const input = body.querySelector("input, textarea");
    input.value = defaultValue;

    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;gap:8px;";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn--primary";
    okBtn.textContent = okLabel;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--ghost";
    cancelBtn.textContent = cancelLabel;

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);

    const m = openModal({
      title,
      body,
      footer,
      className: "modal--narrow",
      onMount: () => setTimeout(() => input.focus(), 40),
      onClose: () => resolve(null),
    });

    const done = () => {
      resolve(input.value);
      m.close();
    };
    okBtn.addEventListener("click", done);
    cancelBtn.addEventListener("click", () => {
      resolve(null);
      m.close();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (!multiline || e.ctrlKey)) {
        e.preventDefault();
        done();
      }
    });
  });
}

/** Shorthand: copy text + toast. */
export async function copyWithFeedback(text, label = "متن کپی شد") {
  const ok = await copyText(text);
  if (ok) toast.ok(label);
  else toast.err("کپی ناموفق بود");
  return ok;
}
