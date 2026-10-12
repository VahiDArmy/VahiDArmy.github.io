/* ============================================================================
   DROPDOWN MENU
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;

  const activeDropdowns = [];
  let globalListenerAttached = false;

  function ensureGlobalListener() {
    if (globalListenerAttached) return;
    globalListenerAttached = true;
    document.addEventListener("click", (e) => {
      for (let i = activeDropdowns.length - 1; i >= 0; i--) {
        const d = activeDropdowns[i];
        if (!d.menu.contains(e.target) && !d.anchor.contains(e.target)) {
          Dropdown.close(d);
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeDropdowns.length) {
        const top = activeDropdowns[activeDropdowns.length - 1];
        Dropdown.close(top);
      }
    });
    window.addEventListener("resize", () => {
      activeDropdowns.forEach((d) => Dropdown.close(d));
    });
    window.addEventListener("scroll", () => {
      activeDropdowns.forEach((d) => Dropdown.close(d));
    }, true);
  }

  const Dropdown = {
    open(anchor, options = {}) {
      if (!anchor) return null;
      const {
        items = [],
        placement = "bottom-end",
        align = "end",
        width,
        maxHeight,
        onSelect = null,
        className = "",
      } = options;

      ensureGlobalListener();

      // Close existing for this anchor
      const existing = activeDropdowns.find((d) => d.anchor === anchor);
      if (existing) Dropdown.close(existing);

      const menu = Dom.el("div", {
        class: `dropdown__menu ${className}`.trim(),
        role: "menu",
      });

      items.forEach((item) => {
        if (!item) return;
        if (item.type === "divider") {
          menu.appendChild(Dom.el("div", { class: "dropdown__divider" }));
          return;
        }
        if (item.type === "section") {
          menu.appendChild(Dom.el("div", { class: "dropdown__section" }, item.label));
          return;
        }

        const el = Dom.el("button", {
          class: `dropdown__item ${item.danger ? "dropdown__item--danger" : ""} ${item.disabled ? "is-disabled" : ""} ${item.active ? "is-active" : ""}`.trim(),
          type: "button",
          role: "menuitem",
          disabled: item.disabled ? "" : null,
          dataset: { id: item.id || "" },
        });

        if (item.icon) el.appendChild(Dom.el("i", { class: item.icon }));
        el.appendChild(Dom.el("span", null, item.label));

        if (item.shortcut) {
          const kbd = Dom.el("span", { class: "dropdown__shortcut" });
          String(item.shortcut).split("+").forEach((k) => {
            kbd.appendChild(Dom.el("kbd", null, k.trim()));
          });
          el.appendChild(kbd);
        } else if (item.meta) {
          el.appendChild(Dom.el("span", { class: "dropdown__shortcut" }, item.meta));
        }

        if (!item.disabled) {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (typeof item.onClick === "function") item.onClick(item, e);
            if (onSelect) onSelect(item, e);
            if (item.keepOpen !== true) Dropdown.close(instance);
          });
        }

        menu.appendChild(el);
      });

      if (width) menu.style.width = typeof width === "number" ? `${width}px` : width;
      if (maxHeight) menu.style.maxHeight = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;

      const container = Dom.id("dropdown-root");
      container.appendChild(menu);

      Dom.positionFor(menu, anchor, placement);

      const instance = { anchor, menu, options };
      activeDropdowns.push(instance);

      // Animate in
      menu.style.transform = "scale(0.96)";
      menu.style.opacity = "0";
      requestAnimationFrame(() => {
        menu.style.transition = "transform 150ms ease, opacity 150ms ease";
        menu.style.transform = "scale(1)";
        menu.style.opacity = "1";
      });

      return instance;
    },

    close(instance) {
      if (!instance || !instance.menu) return;
      const idx = activeDropdowns.indexOf(instance);
      if (idx >= 0) activeDropdowns.splice(idx, 1);
      instance.menu.style.transition = "opacity 120ms ease";
      instance.menu.style.opacity = "0";
      setTimeout(() => {
        if (instance.menu.parentNode) instance.menu.parentNode.removeChild(instance.menu);
      }, 130);
    },

    closeAll() {
      [...activeDropdowns].forEach((d) => Dropdown.close(d));
    },

    toggle(anchor, options) {
      const existing = activeDropdowns.find((d) => d.anchor === anchor);
      if (existing) {
        Dropdown.close(existing);
        return null;
      }
      return Dropdown.open(anchor, options);
    },

    /* ---------- Simple confirm menu ---------- */
    actions(anchor, actions = [], options = {}) {
      return this.open(anchor, {
        ...options,
        items: actions.map((a) => ({
          label: a.label,
          icon: a.icon,
          danger: a.danger,
          disabled: a.disabled,
          onClick: a.onClick,
        })),
      });
    },
  };

  window.Dropdown = Dropdown;
})(window);