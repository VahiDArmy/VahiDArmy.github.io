/* ============================================================================
   TABS COMPONENT
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;

  const Tabs = {
    /* ---------- Initialize a tab group ---------- */
    init(container, options = {}) {
      if (!container) return null;
      const tabs = Dom.qa(".tab", container);
      if (!tabs.length) return null;

      const {
        onChange = null,
        initial = null,
        panelsContainer = null,
      } = options;

      const panels = panelsContainer
        ? Dom.qa("[data-panel]", panelsContainer)
        : Dom.qa("[data-panel]");

      const activate = (key) => {
        tabs.forEach((t) => {
          const active = t.dataset.tab === key;
          Dom.toggleClass(t, "is-active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        panels.forEach((p) => {
          p.hidden = p.dataset.panel !== key;
        });
        if (onChange) onChange(key);
        container.dispatchEvent(new CustomEvent("tabs:change", { detail: { key } }));
      };

      tabs.forEach((tab) => {
        tab.setAttribute("role", "tab");
        tab.addEventListener("click", () => activate(tab.dataset.tab));
      });

      const start = initial || (tabs.find((t) => Dom.hasClass(t, "is-active"))?.dataset.tab) || tabs[0].dataset.tab;
      activate(start);

      return { activate };
    },

    autoInit() {
      Dom.qa("[data-tabs]").forEach((group) => {
        const name = group.dataset.tabs;
        const panels = Dom.qa(`[data-panel][data-tabs-parent="${name}"]`);
        Tabs.init(group, { panelsContainer: panels.length ? document : null });
      });
    },
  };

  window.Tabs = Tabs;
})(window);