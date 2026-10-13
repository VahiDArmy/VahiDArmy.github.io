/**
 * Confirm dialog — styled alternative to window.confirm().
 *
 *   const ok = await confirm({
 *     title: "حذف آیتم",
 *     message: "آیا مطمئن هستید؟ این عملیات قابل بازگشت نیست.",
 *     confirmLabel: "حذف",
 *     cancelLabel: "انصراف",
 *     variant: "danger",
 *   });
 *   if (ok) doIt();
 */

import { createElement, focusFirst } from "../utils/dom.js";
import { icon } from "./icons.js";

const ROOT_ID = "confirm-root";

function getRoot() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = createElement("div", { id: ROOT_ID, class: "confirm-root", "aria-hidden": "true" });
    document.body.appendChild(root);
  }
  return root;
}

const VARIANT_ICON = {
  danger: "alert",
  warning: "alert",
  success: "check",
  primary: "helpCircle",
  info: "info",
};

export function confirm(opts = {}) {
  const {
    title = "تأیید عملیات",
    message = "",
    confirmLabel = "تأیید",
    cancelLabel = "انصراف",
    variant = "primary",
    iconName,
    hideCancel = false,
  } = opts;

  return new Promise((resolve) => {
    const root = getRoot();
    root.innerHTML = "";
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");

    const backdrop = createElement("div", { class: "modal-backdrop" });
    const dialog = createElement("div", {
      class: "confirm",
      role: "alertdialog",
      "aria-modal": "true",
      "aria-label": title,
    });

    const iconVariant = variant === "primary" ? "primary" : variant;

    dialog.innerHTML = `
      <div class="confirm__icon confirm__icon--${iconVariant}">
        ${icon(iconName || VARIANT_ICON[variant] || "helpCircle", { size: 28 })}
      </div>
      <div class="confirm__title"></div>
      <div class="confirm__message"></div>
      <div class="confirm__actions"></div>
    `;
    dialog.querySelector(".confirm__title").textContent = title;
    dialog.querySelector(".confirm__message").textContent = message;

    const actionsEl = dialog.querySelector(".confirm__actions");

    const cancelBtn = createElement(
      "button",
      { type: "button", class: "btn btn--ghost" },
      cancelLabel
    );
    const confirmBtn = createElement(
      "button",
      {
        type: "button",
        class: `btn btn--${variant === "primary" ? "primary" : variant}`,
      },
      confirmLabel
    );

    if (!hideCancel) actionsEl.appendChild(cancelBtn);
    actionsEl.appendChild(confirmBtn);

    function cleanup(result) {
      document.removeEventListener("keydown", onKey, true);
      root.classList.remove("is-open");
      root.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
      root.innerHTML = "";
      resolve(result);
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cleanup(false);
      } else if (e.key === "Enter" && document.activeElement !== cancelBtn) {
        e.preventDefault();
        cleanup(true);
      }
    }

    cancelBtn.addEventListener("click", () => cleanup(false));
    confirmBtn.addEventListener("click", () => cleanup(true));
    backdrop.addEventListener("click", () => cleanup(false));

    root.appendChild(backdrop);
    root.appendChild(dialog);

    document.addEventListener("keydown", onKey, true);

    requestAnimationFrame(() => {
      focusFirst(dialog);
      if (document.activeElement === document.body) confirmBtn.focus();
    });
  });
}

/** Convenience wrappers */
export function confirmDanger(title, message, opts = {}) {
  return confirm({ title, message, variant: "danger", confirmLabel: "حذف", ...opts });
}

export function confirmWarning(title, message, opts = {}) {
  return confirm({ title, message, variant: "warning", confirmLabel: "ادامه", ...opts });
}