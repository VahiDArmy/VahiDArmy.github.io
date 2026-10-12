/* ============================================================================
   SIDEBAR COMPONENT
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Storage = window.Storage;

  const Sidebar = {
    init() {
      const sidebar = Dom.id("sidebar");
      const shell = Dom.id("app");
      const collapseBtn = Dom.id("sidebar-collapse");
      const mobileToggle = Dom.id("sidebar-toggle");
      const backdrop = Dom.id("sidebar-backdrop");

      if (!sidebar) return;

      // Restore state
      const saved = Storage.getSidebarState();
      if (saved === "collapsed" && window.innerWidth >= 1024) {
        this.setCollapsed(true);
      }

      // Collapse
      if (collapseBtn) {
        collapseBtn.addEventListener("click", () => {
          const collapsed = sidebar.dataset.state === "collapsed";
          this.setCollapsed(!collapsed);
        });
      }

      // Mobile toggle
      if (mobileToggle) {
        mobileToggle.addEventListener("click", () => this.toggleMobile());
      }

      if (backdrop) {
        backdrop.addEventListener("click", () => this.closeMobile());
      }

      // Close mobile on route change
      window.addEventListener("hashchange", () => this.closeMobile());

      // Auto collapse on small viewport
      let resizeTimer;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (window.innerWidth < 1024) {
            this.closeMobile();
          }
        }, 150);
      });

      // Update active state based on hash
      this.updateActive(window.location.hash);
      window.addEventListener("hashchange", () => this.updateActive(window.location.hash));
    },

    setCollapsed(collapsed) {
      const sidebar = Dom.id("sidebar");
      const shell = Dom.id("app");
      if (!sidebar) return;
      sidebar.dataset.state = collapsed ? "collapsed" : "expanded";
      if (shell) shell.dataset.sidebar = collapsed ? "collapsed" : "expanded";
      Storage.setSidebarState(collapsed ? "collapsed" : "expanded");

      // Resize charts after transition
      setTimeout(() => {
        if (window.Charts) window.Charts.refreshTheme();
        window.dispatchEvent(new Event("resize"));
      }, 320);
    },

    toggleMobile() {
      const sidebar = Dom.id("sidebar");
      const backdrop = Dom.id("sidebar-backdrop");
      if (!sidebar) return;
      const isOpen = sidebar.classList.contains("is-open");
      if (isOpen) this.closeMobile();
      else {
        sidebar.classList.add("is-open");
        if (backdrop) backdrop.hidden = false;
        Dom.lockScroll();
      }
    },

    closeMobile() {
      const sidebar = Dom.id("sidebar");
      const backdrop = Dom.id("sidebar-backdrop");
      if (!sidebar) return;
      sidebar.classList.remove("is-open");
      if (backdrop) backdrop.hidden = true;
      if (window.innerWidth < 1024) Dom.unlockScroll();
    },

    updateActive(hash) {
      const key = (hash || "").replace(/^#\/?/, "").split("/")[0] || "dashboard";
      Dom.qa(".sidebar__link").forEach((link) => {
        const active = link.dataset.route === key;
        Dom.toggleClass(link, "is-active", active);
        link.setAttribute("aria-current", active ? "page" : "false");
      });
    },

    updateBadges({ products, lowStock } = {}) {
      const p = document.querySelector('[data-count="products"]');
      const l = document.querySelector('[data-count="low-stock"]');
      if (p && products != null) p.textContent = window.Persian.toPersianDigits(products);
      if (l && lowStock != null) l.textContent = window.Persian.toPersianDigits(lowStock);
    },
  };

  window.Sidebar = Sidebar;
})(window);