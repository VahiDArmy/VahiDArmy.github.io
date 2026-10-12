/* ============================================================================
   TOAST / NOTIFICATIONS
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Helpers = window.Helpers;

  const root = () => Dom.id("toast-root");

  const ICONS = {
    success: "ri-checkbox-circle-fill",
    error: "ri-error-warning-fill",
    danger: "ri-error-warning-fill",
    warning: "ri-alert-fill",
    info: "ri-information-fill",
    default: "ri-notification-3-fill",
  };

  const Toast = {
    /* ---------- Show ---------- */
    show(message, options = {}) {
      const {
        title = "",
        type = "info",
        duration = (window.ENV?.TOAST_DURATION ?? 4500),
        actions = [],
        dismissible = true,
        icon,
      } = options;

      const container = root();
      if (!container) return null;

      const el = Dom.el("div", {
        class: `toast toast--${type}`,
        role: "status",
        "aria-live": type === "error" || type === "danger" ? "assertive" : "polite",
      });

      // Icon
      const iconEl = Dom.el("div", { class: "toast__icon" }, [
        Dom.el("i", { class: icon || ICONS[type] || ICONS.default }),
      ]);
      el.appendChild(iconEl);

      // Body
      const body = Dom.el("div", { class: "toast__body" });
      if (title) body.appendChild(Dom.el("div", { class: "toast__title" }, title));
      body.appendChild(Dom.el("div", { class: "toast__message" }, message));

      if (actions && actions.length) {
        const actionsEl = Dom.el("div", { class: "toast__actions" });
        actions.forEach((a) => {
          const btn = Dom.el(
            "button",
            {
              class: `btn btn--xs ${a.variant ? `btn--${a.variant}` : "btn--ghost"}`,
              type: "button",
            },
            a.label
          );
          btn.addEventListener("click", () => {
            if (typeof a.onClick === "function") a.onClick();
            if (a.closeOnClick !== false) Toast.dismiss(el);
          });
          actionsEl.appendChild(btn);
        });
        body.appendChild(actionsEl);
      }

      el.appendChild(body);

      // Close button
      if (dismissible) {
        const close = Dom.el("button", {
          class: "toast__close",
          type: "button",
          "aria-label": "بستن",
        }, [Dom.el("i", { class: "ri-close-line" })]);
        close.addEventListener("click", () => Toast.dismiss(el));
        el.appendChild(close);
      }

      // Progress bar
      if (duration > 0) {
        const progress = Dom.el("div", { class: "toast__progress" });
        progress.style.animationDuration = `${duration}ms`;
        el.appendChild(progress);
      }

      container.appendChild(el);

      if (duration > 0) {
        el._timer = setTimeout(() => Toast.dismiss(el), duration);
        el.addEventListener("mouseenter", () => {
          if (el._timer) clearTimeout(el._timer);
          const bar = el.querySelector(".toast__progress");
          if (bar) bar.style.animationPlayState = "paused";
        });
        el.addEventListener("mouseleave", () => {
          const bar = el.querySelector(".toast__progress");
          if (bar) bar.style.animationPlayState = "running";
          el._timer = setTimeout(() => Toast.dismiss(el), 1800);
        });
      }

      return el;
    },

    /* ---------- Dismiss ---------- */
    dismiss(el) {
      if (!el || !el.parentNode) return;
      if (el._timer) clearTimeout(el._timer);
      el.classList.add("is-leaving");
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    },

    dismissAll() {
      const container = root();
      if (!container) return;
      Array.from(container.children).forEach((c) => Toast.dismiss(c));
    },

    /* ---------- Shorthand ---------- */
    success(message, title = "موفق", opts = {}) {
      return this.show(message, { ...opts, type: "success", title });
    },

    error(message, title = "خطا", opts = {}) {
      return this.show(message, { ...opts, type: "error", title });
    },

    warning(message, title = "هشدار", opts = {}) {
      return this.show(message, { ...opts, type: "warning", title });
    },

    info(message, title = "اطلاع", opts = {}) {
      return this.show(message, { ...opts, type: "info", title });
    },

    /* ---------- Promise helpers ---------- */
    loading(message = "در حال پردازش…") {
      return this.show(message, {
        type: "info",
        duration: 0,
        dismissible: false,
        icon: "ri-loader-4-line",
      });
    },

    async promise(promise, { loading = "در حال پردازش…", success = "انجام شد", error = "خطایی رخ داد" } = {}) {
      const t = this.loading(loading);
      try {
        const result = await promise;
        this.dismiss(t);
        this.success(typeof success === "function" ? success(result) : success);
        return result;
      } catch (e) {
        this.dismiss(t);
        this.error(typeof error === "function" ? error(e) : (e.message || error));
        throw e;
      }
    },

    /* ---------- Confirm ---------- */
    confirm(message, { yes = "بله", no = "خیر", type = "warning" } = {}) {
      return new Promise((resolve) => {
        const t = this.show(message, {
          type,
          title: "تأیید عملیات",
          duration: 0,
          dismissible: false,
          actions: [
            {
              label: yes,
              variant: type === "danger" ? "danger" : "primary",
              onClick: () => resolve(true),
            },
            {
              label: no,
              variant: "ghost",
              onClick: () => resolve(false),
            },
          ],
        });
        // Auto-reject on manual close
        const observer = new MutationObserver(() => {
          if (!document.body.contains(t)) {
            observer.disconnect();
            resolve(false);
          }
        });
        observer.observe(root(), { childList: true });
      });
    },
  };

  window.Toast = Toast;
})(window);