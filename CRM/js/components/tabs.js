/* ============================================================================
   TABS COMPONENT — FIXED
   ----------------------------------------------------------------------------
   - Uses event delegation (binds once per group, survives re-renders)
   - Finds panels dynamically every activation (survives panel re-renders)
   - Auto-init scans for [data-tabs] groups
   - Dispatches `tabs:change` event so pages can react (render charts, etc.)
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;

  const Tabs = {
    /* ---------- Find panels container for a group ---------- */
    findPanels(groupEl, name) {
      // 1) Explicit attribute
      let el = document.querySelector(`[data-tabs-panels="${name}"]`);
      if (el) return el;

      // 2) Next sibling with .tab-panels class
      let next = groupEl.nextElementSibling;
      while (next) {
        if (next.classList && next.classList.contains("tab-panels")) return next;
        next = next.nextElementSibling;
      }

      // 3) By id convention: <name>-panels
      el = document.getElementById(`${name}-panels`);
      if (el) return el;

      return null;
    },

    /* ---------- Activate a tab (or sync current) ---------- */
    activate(groupEl, key) {
      const name = groupEl.dataset.tabs;
      const panelsEl = this.findPanels(groupEl, name);

      const tabs = Dom.qa(".tab", groupEl);
      if (!tabs.length) return;

      // Determine target key
      if (!key) {
        const activeTab =
          tabs.find((t) => t.classList.contains("is-active")) || tabs[0];
        key = activeTab?.dataset.tab;
      }
      if (!key) return;

      // Update tab states
      tabs.forEach((t) => {
        const active = t.dataset.tab === key;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
        t.setAttribute("tabindex", active ? "0" : "-1");
      });

      // Update panel visibility
      if (panelsEl) {
        Dom.qa("[data-panel]", panelsEl).forEach((p) => {
          const active = p.dataset.panel === key;
          p.hidden = !active;
          p.classList.toggle("is-active", active);
        });
      }

      // Fire event (bubbles so document-level listeners work too)
      const detail = { key, name, group: groupEl, panels: panelsEl };
      groupEl.dispatchEvent(new CustomEvent("tabs:change", { detail, bubbles: true }));
    },

    /* ---------- Initialize a single group (idempotent) ---------- */
    initGroup(groupEl) {
      if (!groupEl || groupEl.dataset.tabsBound === "1") {
        // Already bound — just re-sync visibility (panels may have been re-rendered)
        if (groupEl && groupEl.dataset.tabsBound === "1") {
          this.activate(groupEl);
        }
        return;
      }

      groupEl.dataset.tabsBound = "1";
      groupEl.setAttribute("role", "tablist");

      // Delegated click
      groupEl.addEventListener("click", (e) => {
        const tab = e.target.closest(".tab");
        if (!tab || !groupEl.contains(tab)) return;
        if (!tab.dataset.tab) return;
        e.preventDefault();
        this.activate(groupEl, tab.dataset.tab);
      });

      // Keyboard navigation (ArrowLeft / ArrowRight)
      groupEl.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const tabs = Dom.qa(".tab", groupEl);
        const currentIdx = tabs.indexOf(document.activeElement);
        if (currentIdx < 0) return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const nextIdx = (currentIdx + dir + tabs.length) % tabs.length;
        tabs[nextIdx].focus();
        this.activate(groupEl, tabs[nextIdx].dataset.tab);
      });

      // Initial activation
      this.activate(groupEl);
    },

    /* ---------- Auto-init all groups in scope ---------- */
    autoInit(scope = document) {
      Dom.qa("[data-tabs]", scope).forEach((group) => this.initGroup(group));
    },

    /* ---------- Public: set active tab programmatically ---------- */
    setActive(groupEl, key) {
      if (!groupEl) return;
      this.activate(groupEl, key);
    },
  };

  window.Tabs = Tabs;
})(window);