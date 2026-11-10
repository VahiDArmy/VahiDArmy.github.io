import { icon } from "./icons.js";
import { escapeHtml, copyToClipboard, uid } from "./utils.js";

let activeModal = null;
let dropdownsReady = false;

function ensureNode(id) {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    document.body.append(node);
  }
  return node;
}

export function toast({ title = "", message = "", type = "info", duration = 4200 } = {}) {
  const root = ensureNode("toast-root");
  const id = uid("toast");
  const iconMap = {
    success: "check-circle",
    error: "alert",
    warning: "alert",
    info: "info",
  };
  const node = document.createElement("div");
  node.className = `toast toast--${type}`;
  node.dataset.toastId = id;
  node.innerHTML = `
    <span class="toast__icon">${icon(iconMap[type] || "info", 16)}</span>
    <div class="toast__copy">
      ${title ? `<p class="toast__title">${escapeHtml(title)}</p>` : ""}
      ${message ? `<p class="toast__message">${escapeHtml(message)}</p>` : ""}
    </div>
    <button class="icon-btn icon-btn--sm toast__close" type="button" aria-label="بستن">${icon("x", 14)}</button>
  `;
  root.append(node);

  let timer = null;
  const close = () => {
    clearTimeout(timer);
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 180);
  };
  node.querySelector(".toast__close")?.addEventListener("click", close);
  if (duration > 0) timer = setTimeout(close, duration);
  return close;
}

function focusables(root) {
  return Array.from(
    root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((node) => node.offsetParent !== null);
}

export function closeModal() {
  if (!activeModal) return;
  const { backdrop, onClose } = activeModal;
  activeModal = null;
  document.body.classList.remove("modal-open");
  backdrop?.remove();
  if (onClose) onClose();
}

export function openModal(options = {}) {
  closeModal();
  const {
    title = "",
    description = "",
    iconName = "sparkles",
    iconClass = "",
    body = "",
    footer = "",
    size = "",
    onMount,
    onClose,
    closeOnBackdrop = true,
  } = options;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal ${size === "wide" ? "modal--wide" : size === "sm" ? "modal--sm" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal__head">
        <span class="modal__icon ${iconClass}">${icon(iconName, 22)}</span>
        <div class="modal__copy">
          <h2 class="modal__title" id="modal-title">${escapeHtml(title)}</h2>
          ${description ? `<p class="modal__desc">${escapeHtml(description)}</p>` : ""}
        </div>
        <button class="icon-btn icon-btn--sm modal__close" type="button" data-modal-close aria-label="بستن">${icon("x", 16)}</button>
      </div>
      ${body ? `<div class="modal__body">${body}</div>` : ""}
      ${footer ? `<div class="modal__footer">${footer}</div>` : ""}
    </div>
  `;

  document.body.append(backdrop);
  document.body.classList.add("modal-open");
  activeModal = { backdrop, onClose };

  const dialog = backdrop.querySelector(".modal");
  const close = () => closeModal();

  backdrop.addEventListener("click", (event) => {
    if (closeOnBackdrop && event.target === backdrop) close();
  });

  backdrop.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", close);
  });

  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      const items = focusables(dialog);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  requestAnimationFrame(() => {
    const first = focusables(dialog)[0];
    first?.focus();
  });

  if (onMount) onMount(dialog);
  return { close };
}

export function confirmDialog({
  title = "مطمئن هستید؟",
  description = "",
  confirmText = "تأیید",
  cancelText = "انصراف",
  danger = false,
  iconName = "alert",
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    openModal({
      title,
      description,
      iconName,
      iconClass: danger ? "modal__icon--danger" : "",
      size: "sm",
      footer: `
        <button class="btn btn--ghost" type="button" data-modal-close>${escapeHtml(cancelText)}</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" data-confirm>${escapeHtml(confirmText)}</button>
      `,
      onMount(root) {
        root.querySelector("[data-confirm]")?.addEventListener("click", () => {
          settled = true;
          closeModal();
          resolve(true);
        });
      },
      onClose() {
        if (!settled) resolve(false);
      },
    });
  });
}

export function closeDropdowns() {
  document.querySelectorAll(".dropdown__menu.is-open").forEach((menu) => {
    menu.classList.remove("is-open");
    menu.closest(".dropdown")?.querySelector("[data-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
  });
}

export function initDropdowns() {
  if (dropdownsReady) return;
  dropdownsReady = true;

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-dropdown-toggle]");
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      const dropdown = toggle.closest(".dropdown");
      const menu = dropdown?.querySelector(".dropdown__menu");
      if (!menu) return;
      const isOpen = menu.classList.contains("is-open");
      closeDropdowns();
      if (!isOpen) {
        menu.classList.add("is-open");
        toggle.setAttribute("aria-expanded", "true");
      }
      return;
    }
    if (!event.target.closest(".dropdown__menu")) closeDropdowns();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".dropdown__menu button, .dropdown__menu a")) {
      closeDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdowns();
  });
}

export function initCopyButtons() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    const value = button.dataset.copy || "";
    const ok = await copyToClipboard(value);
    toast({
      type: ok ? "success" : "error",
      title: ok ? "کپی شد" : "کپی انجام نشد",
      message: ok ? "متن در حافظه ذخیره شد." : "دسترسی به حافظه ممکن نبود.",
      duration: 2200,
    });
  });
}

export function setButtonLoading(button, loading = true) {
  if (!button) return;
  button.classList.toggle("is-loading", loading);
  button.disabled = Boolean(loading);
}

export function showFieldError(field, message) {
  if (!field) return;
  field.classList.add("has-error");
  const error = field.querySelector(".field__error");
  if (error) error.textContent = message;
}

export function clearFieldError(field) {
  field?.classList.remove("has-error");
}

export function clearFormErrors(root) {
  root?.querySelectorAll(".field.has-error").forEach((field) => field.classList.remove("has-error"));
}

export function initScrollTop() {
  let button = document.querySelector(".scroll-top");
  if (!button) {
    button = document.createElement("button");
    button.className = "scroll-top";
    button.type = "button";
    button.setAttribute("aria-label", "بازگشت به بالا");
    button.innerHTML = icon("arrow-up", 18);
    document.body.append(button);
    button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
  const onScroll = () => {
    button.classList.toggle("is-visible", window.scrollY > 520);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

export function renderErrorState(message, retry = false) {
  return `
    <div class="empty">
      <div class="empty__icon">${icon("alert", 28)}</div>
      <h2 class="empty__title">مشکلی پیش آمد</h2>
      <p class="empty__text">${escapeHtml(message || "خطای نامشخص")}</p>
      <div class="empty__actions">
        ${retry ? `<button class="btn btn--primary" type="button" onclick="location.reload()">تلاش دوباره</button>` : ""}
        <a class="btn btn--outline" href="#/">بازگشت به خانه</a>
      </div>
    </div>
  `;
}
