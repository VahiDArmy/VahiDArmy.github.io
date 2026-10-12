/* ============================================================================
   CONTEXT MENU (Right-click / Long-press)
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;

  let currentMenu = null;

  const ContextMenu = {
    /* ---------- Show ---------- */
    show(x, y, options = {}) {
      const {
        items = [],
        title = "",
        subtitle = "",
        onSelect = null,
      } = options;

      this.close();

      const menu = Dom.el("div", {
        class: "context-menu",
        role: "menu",
      });

      if (title || subtitle) {
        const head = Dom.el("div", { class: "context-menu__header" });
        if (title) head.appendChild(Dom.el("div", { class: "context-menu__title" }, title));
        if (subtitle) head.appendChild(Dom.el("div", { class: "context-menu__subtitle" }, subtitle));
        menu.appendChild(head);
      }

      items.forEach((item) => {
        if (!item) return;
        if (item.type === "divider" || item.label === "-") {
          menu.appendChild(Dom.el("div", { class: "context-menu__divider" }));
          return;
        }
        if (item.type === "header") {
          menu.appendChild(Dom.el("div", { class: "dropdown__section" }, item.label));
          return;
        }

        const el = Dom.el("button", {
          class: `context-menu__item ${item.danger ? "context-menu__item--danger" : ""} ${item.disabled ? "is-disabled" : ""}`.trim(),
          type: "button",
          role: "menuitem",
        });

        if (item.icon) el.appendChild(Dom.el("i", { class: item.icon }));
        el.appendChild(Dom.el("span", null, item.label));

        if (item.shortcut) {
          el.appendChild(Dom.el("span", { class: "context-menu__shortcut" }, item.shortcut));
        }
        if (item.children) {
          el.appendChild(Dom.el("i", { class: "context-menu__has-sub ri-arrow-left-s-line" }));
        }

        if (!item.disabled) {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof item.onClick === "function") item.onClick(e);
            if (onSelect) onSelect(item, e);
            if (!item.keepOpen) ContextMenu.close();
          });
        }

        menu.appendChild(el);
      });

      const container = Dom.id("context-menu-root");
      container.appendChild(menu);

      // Position at point
      Dom.positionAtPoint(menu, x, y);

      // Attach global listeners
      const closeOnClick = (e) => {
        if (!menu.contains(e.target)) this.close();
      };
      const closeOnEsc = (e) => {
        if (e.key === "Escape") this.close();
      };
      const closeOnScroll = () => this.close();
      const closeOnBlur = () => this.close();

      setTimeout(() => {
        document.addEventListener("mousedown", closeOnClick, { once: false });
        document.addEventListener("keydown", closeOnEsc);
        window.addEventListener("scroll", closeOnScroll, true);
        window.addEventListener("resize", closeOnScroll);
        window.addEventListener("blur", closeOnBlur);
      }, 0);

      currentMenu = {
        el: menu,
        cleanup() {
          document.removeEventListener("mousedown", closeOnClick);
          document.removeEventListener("keydown", closeOnEsc);
          window.removeEventListener("scroll", closeOnScroll, true);
          window.removeEventListener("resize", closeOnScroll);
          window.removeEventListener("blur", closeOnBlur);
        },
      };

      return currentMenu;
    },

    /* ---------- Close ---------- */
    close() {
      if (!currentMenu) return;
      if (currentMenu.cleanup) currentMenu.cleanup();
      const el = currentMenu.el;
      el.style.transition = "opacity 100ms ease";
      el.style.opacity = "0";
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 110);
      currentMenu = null;
    },

    /* ---------- Attach to element ---------- */
    attach(el, items, options = {}) {
      if (!el) return () => {};
      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const list = typeof items === "function" ? items(e) : items;
        if (!list || !list.length) return;
        this.show(e.clientX, e.clientY, { ...options, items: list });
      };

      // Long press for touch
      let pressTimer = null;
      const touchStart = (e) => {
        pressTimer = setTimeout(() => {
          const t = e.touches[0];
          const list = typeof items === "function" ? items(e) : items;
          if (list && list.length) {
            this.show(t.clientX, t.clientY, { ...options, items: list });
            if (navigator.vibrate) navigator.vibrate(20);
          }
        }, 550);
      };
      const touchEnd = () => {
        if (pressTimer) clearTimeout(pressTimer);
      };

      el.addEventListener("contextmenu", handler);
      el.addEventListener("touchstart", touchStart, { passive: true });
      el.addEventListener("touchend", touchEnd);
      el.addEventListener("touchmove", touchEnd);
      el.addEventListener("touchcancel", touchEnd);

      return () => {
        el.removeEventListener("contextmenu", handler);
        el.removeEventListener("touchstart", touchStart);
        el.removeEventListener("touchend", touchEnd);
        el.removeEventListener("touchmove", touchEnd);
        el.removeEventListener("touchcancel", touchEnd);
      };
    },
  };

  window.ContextMenu = ContextMenu;
})(window);