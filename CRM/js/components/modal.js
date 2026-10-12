/* ============================================================================
   MODAL / DIALOG / DRAWER
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Helpers = window.Helpers;

  const activeModals = [];
  let escListener = null;

  const root = () => Dom.id("modal-root");
  const drawerRoot = () => Dom.id("drawer-root");

  function installEsc() {
    if (escListener) return;
    escListener = (e) => {
      if (e.key === "Escape" && activeModals.length) {
        const top = activeModals[activeModals.length - 1];
        if (top && top.closeOnEsc !== false) {
          e.preventDefault();
          Modal.close(top);
        }
      }
    };
    document.addEventListener("keydown", escListener);
  }

  function uninstallEsc() {
    if (!activeModals.length && escListener) {
      document.removeEventListener("keydown", escListener);
      escListener = null;
    }
  }

  function trapFocus(container) {
    const handler = (e) => {
      if (e.key !== "Tab") return;
      const focusables = Dom.focusable(container);
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
    };
    container.addEventListener("keydown", handler);
    return () => container.removeEventListener("keydown", handler);
  }

  const Modal = {
    /* ---------- Open ---------- */
    open(options = {}) {
      const {
        title = "",
        subtitle = "",
        content = "",
        icon = "",
        iconTone = "",
        size = "md", // sm | md | lg | xl | 2xl | full
        footer = null,
        footerSplit = false,
        closeOnEsc = true,
        closeOnBackdrop = true,
        onClose = null,
        onSubmit = null,
        submitLabel = "ذخیره",
        cancelLabel = "انصراف",
        showHeader = true,
        showFooter = true,
        className = "",
        initialFocus = true,
      } = options;

      const container = root();
      if (!container) return null;

      const overlay = Dom.el("div", { class: `modal modal--${size} ${className}`.trim() });

      const backdrop = Dom.el("div", { class: "modal__backdrop" });
      overlay.appendChild(backdrop);

      const panel = Dom.el("div", {
        class: "modal__panel",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": title || "دیالوگ",
      });

      // Header
      if (showHeader) {
        const header = Dom.el("div", { class: "modal__header" });
        if (icon) {
          header.appendChild(
            Dom.el("div", { class: `modal__icon ${iconTone ? `modal__icon--${iconTone}` : ""}`.trim() }, [
              Dom.el("i", { class: icon }),
            ])
          );
        }
        const titles = Dom.el("div", { class: "modal__titles" });
        if (title) titles.appendChild(Dom.el("h2", { class: "modal__title" }, title));
        if (subtitle) titles.appendChild(Dom.el("p", { class: "modal__subtitle" }, subtitle));
        header.appendChild(titles);

        const closeBtn = Dom.el("button", {
          class: "modal__close",
          type: "button",
          "aria-label": "بستن",
        }, [Dom.el("i", { class: "ri-close-line" })]);
        closeBtn.addEventListener("click", () => Modal.close(instance));
        header.appendChild(closeBtn);
        panel.appendChild(header);
      }

      // Body
      const body = Dom.el("div", { class: "modal__body" });
      if (content instanceof HTMLElement) body.appendChild(content);
      else if (typeof content === "string") body.innerHTML = content;
      panel.appendChild(body);

      // Footer
      if (showFooter) {
        const footerEl = Dom.el("div", { class: `modal__footer ${footerSplit ? "modal__footer--split" : ""}`.trim() });
        if (footer instanceof HTMLElement) {
          footerEl.appendChild(footer);
        } else if (Array.isArray(footer)) {
          footer.forEach((f) => footerEl.appendChild(f));
        } else if (onSubmit) {
          const cancel = Dom.el("button", {
            class: "btn btn--ghost",
            type: "button",
          }, cancelLabel);
          cancel.addEventListener("click", () => Modal.close(instance));
          footerEl.appendChild(cancel);

          const submit = Dom.el("button", {
            class: "btn btn--primary",
            type: "button",
          }, submitLabel);
          submit.addEventListener("click", async () => {
            submit.classList.add("is-loading");
            try {
              const res = await onSubmit();
              if (res !== false) Modal.close(instance);
            } catch (e) {
              window.Toast?.error(e.message || "خطا در انجام عملیات");
            } finally {
              submit.classList.remove("is-loading");
            }
          });
          footerEl.appendChild(submit);
        }
        panel.appendChild(footerEl);
      }

      overlay.appendChild(panel);

      // Backdrop click
      if (closeOnBackdrop) {
        backdrop.addEventListener("click", () => Modal.close(instance));
      }

      const instance = {
        overlay,
        panel,
        body,
        options,
        closeOnEsc,
        onClose,
        releaseFocus: null,
      };

      // Esc handler
      installEsc();
      activeModals.push(instance);

      Dom.lockScroll();
      container.appendChild(overlay);

      // Focus trap
      instance.releaseFocus = trapFocus(panel);

      if (initialFocus) {
        setTimeout(() => {
          const auto = panel.querySelector("[autofocus]");
          if (auto) auto.focus();
          else {
            const first = Dom.focusable(panel)[0];
            if (first) first.focus();
          }
        }, 60);
      }

      return instance;
    },

    /* ---------- Close ---------- */
    close(instance) {
      if (!instance || !instance.overlay) return;
      const idx = activeModals.indexOf(instance);
      if (idx >= 0) activeModals.splice(idx, 1);

      instance.overlay.classList.add("is-closing");
      if (instance.releaseFocus) instance.releaseFocus();

      setTimeout(() => {
        if (instance.overlay.parentNode) instance.overlay.parentNode.removeChild(instance.overlay);
        if (!activeModals.length) {
          Dom.unlockScroll();
          uninstallEsc();
        }
        if (typeof instance.onClose === "function") instance.onClose();
      }, 200);
    },

    closeAll() {
      [...activeModals].forEach((m) => Modal.close(m));
    },

    /* ---------- Confirm ---------- */
    confirm(options = {}) {
      const {
        title = "تأیید عملیات",
        message = "آیا از انجام این عملیات اطمینان دارید؟",
        confirmLabel = "بله، انجام بده",
        cancelLabel = "انصراف",
        tone = "danger", // danger | warning | info | success
        icon = "ri-alert-line",
      } = options;

      return new Promise((resolve) => {
        const instance = Modal.open({
          title,
          icon,
          iconTone: tone,
          size: "sm",
          content: `<div class="confirm-dialog__text">${Dom.escape(message)}</div>`,
          showFooter: true,
          footer: (() => {
            const wrap = Dom.el("div", { class: "modal__footer modal__footer--split" });
            wrap.style.width = "100%";
            const cancel = Dom.el("button", { class: "btn btn--ghost", type: "button" }, cancelLabel);
            cancel.addEventListener("click", () => {
              resolve(false);
              Modal.close(instance);
            });
            const ok = Dom.el(
              "button",
              { class: `btn btn--${tone === "danger" ? "danger" : "primary"}`, type: "button" },
              confirmLabel
            );
            ok.addEventListener("click", () => {
              resolve(true);
              Modal.close(instance);
            });
            wrap.appendChild(cancel);
            wrap.appendChild(ok);
            return wrap;
          })(),
          onClose: () => resolve(false),
        });
      });
    },

    /* ---------- Prompt ---------- */
    prompt(options = {}) {
      const {
        title = "ورود مقدار",
        message = "",
        defaultValue = "",
        placeholder = "",
        confirmLabel = "تأیید",
        cancelLabel = "انصراف",
        type = "text",
      } = options;

      return new Promise((resolve) => {
        const input = Dom.el("input", {
          class: "input",
          type,
          value: defaultValue,
          placeholder,
          autofocus: true,
        });
        const content = Dom.el("div");
        if (message) content.appendChild(Dom.el("p", { style: "margin-bottom:12px;color:var(--text-secondary)" }, message));
        content.appendChild(input);

        const instance = Modal.open({
          title,
          content,
          size: "sm",
          showFooter: true,
          footer: (() => {
            const wrap = Dom.el("div", { class: "modal__footer modal__footer--split" });
            wrap.style.width = "100%";
            const cancel = Dom.el("button", { class: "btn btn--ghost", type: "button" }, cancelLabel);
            cancel.addEventListener("click", () => {
              resolve(null);
              Modal.close(instance);
            });
            const ok = Dom.el("button", { class: "btn btn--primary", type: "button" }, confirmLabel);
            const submit = () => {
              const v = input.value;
              resolve(v);
              Modal.close(instance);
            };
            ok.addEventListener("click", submit);
            input.addEventListener("keydown", (e) => {
              if (e.key === "Enter") submit();
            });
            wrap.appendChild(cancel);
            wrap.appendChild(ok);
            return wrap;
          })(),
          onClose: () => resolve(null),
        });
      });
    },
  };

  /* ==========================================================================
     DRAWER
     ========================================================================== */
  const Drawer = {
    open(options = {}) {
      const {
        title = "",
        content = "",
        side = "right", // right | left
        width = "normal", // narrow | normal | wide
        footer = null,
        onClose = null,
        closeOnBackdrop = true,
      } = options;

      const container = drawerRoot();
      if (!container) return null;

      const overlay = Dom.el("div", { class: `drawer drawer--${side} drawer--${width}` });
      const backdrop = Dom.el("div", { class: "drawer__backdrop" });
      overlay.appendChild(backdrop);

      const panel = Dom.el("div", {
        class: "drawer__panel",
        role: "dialog",
        "aria-modal": "true",
      });

      const header = Dom.el("div", { class: "drawer__header" });
      header.appendChild(Dom.el("h2", { class: "drawer__title" }, title));
      const close = Dom.el("button", { class: "icon-btn", type: "button" }, [
        Dom.el("i", { class: "ri-close-line" }),
      ]);
      close.addEventListener("click", () => Drawer.close(instance));
      header.appendChild(close);
      panel.appendChild(header);

      const body = Dom.el("div", { class: "drawer__body" });
      if (content instanceof HTMLElement) body.appendChild(content);
      else body.innerHTML = content || "";
      panel.appendChild(body);

      if (footer) {
        const footerEl = Dom.el("div", { class: "drawer__footer" });
        if (footer instanceof HTMLElement) footerEl.appendChild(footer);
        else if (Array.isArray(footer)) footer.forEach((f) => footerEl.appendChild(f));
        panel.appendChild(footerEl);
      }

      overlay.appendChild(panel);

      if (closeOnBackdrop) {
        backdrop.addEventListener("click", () => Drawer.close(instance));
      }

      const instance = { overlay, panel, onClose };

      Dom.lockScroll();
      container.appendChild(overlay);

      // Esc close
      const escHandler = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          Drawer.close(instance);
        }
      };
      document.addEventListener("keydown", escHandler);
      instance._esc = escHandler;

      return instance;
    },

    close(instance) {
      if (!instance || !instance.overlay) return;
      if (instance._esc) document.removeEventListener("keydown", instance._esc);
      instance.overlay.style.animation = "fade-out 180ms forwards";
      setTimeout(() => {
        if (instance.overlay.parentNode) instance.overlay.parentNode.removeChild(instance.overlay);
        Dom.unlockScroll();
        if (typeof instance.onClose === "function") instance.onClose();
      }, 200);
    },
  };

  window.Modal = Modal;
  window.Drawer = Drawer;
})(window);