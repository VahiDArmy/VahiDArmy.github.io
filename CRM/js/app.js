/* ============================================================================
   MAIN APPLICATION — with Tabs auto-init and new page registration
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Router = window.Router;
  const AuthService = window.AuthService;
  const Sidebar = window.Sidebar;
  const Topbar = window.Topbar;
  const ThemeSwitcher = window.ThemeSwitcher;
  const CommandPalette = window.CommandPalette;
  const Toast = window.Toast;

  const App = {
    pages: {},
    _tabsObserver: null,

    async init() {
      try {
        // 1. Theme
        ThemeSwitcher.init();

        // 2. Auth check
        await AuthService.init();
        if (!AuthService.isAuthenticated()) {
          Toast?.info("حالت نمایشی — برای دسترسی به همه امکانات وارد شوید", "توجه", { duration: 6000 });
        }

        // 3. Register pages
        this.registerPages();

        // 4. Init UI components
        Sidebar.init();
        Topbar.init();
        CommandPalette.init();

        // 5. Tooltips
        if (window.Tooltip) window.Tooltip.autoBind();

        // 6. Router
        this.registerRoutes();
        Router.start();

        // 7. Global events
        this.bindGlobalEvents();

        // 8. Auto-init tabs (initial + observer)
        this.setupTabsAutoInit();

        // 9. Hide preloader
        this.hidePreloader();
        document.body.classList.add("app-ready");

        // 10. Cleanup on unload
        window.addEventListener("beforeunload", () => {
          window.Charts?.destroyAll();
          if (this._tabsObserver) this._tabsObserver.disconnect();
        });
      } catch (err) {
        console.error("app.init failed:", err);
        this.showFatalError(err);
      }
    },

    registerPages() {
      this.pages = {
        dashboard: window.DashboardPage,
        products: window.ProductsPage,
        inventory: window.InventoryPage,
        orders: window.OrdersPage,
        customers: window.CustomersPage,
        suppliers: window.SuppliersPage,
        warehouses: window.WarehousesPage,
        reports: window.ReportsPage,
        "activity-log": window.ActivityLogPage,
        settings: window.SettingsPage,
      };
    },

    registerRoutes() {
      const C = window.C.ROUTES;
      const make = (key, label) => async ({ page, params }) => {
        const ok = page(key, params);
        if (!ok) throw new Error("صفحه یافت نشد");
        Topbar.setBreadcrumb([{ label }]);
        const mod = this.pages[key];
        if (mod && typeof mod.mount === "function") {
          await mod.mount(params || {});
          // بعد از mount، تبها را دوباره بررسی کن
          setTimeout(() => this.reinitTabs(), 30);
        }
      };

      Router
        .register(C.DASHBOARD, make("dashboard", "داشبورد"))
        .register(C.PRODUCTS, make("products", "محصولات"))
        .register(C.INVENTORY, make("inventory", "موجودی انبار"))
        .register(C.ORDERS, make("orders", "سفارشات"))
        .register(C.CUSTOMERS, make("customers", "مشتریان"))
        .register(C.SUPPLIERS, make("suppliers", "تأمین‌کنندگان"))
        .register(C.WAREHOUSES, make("warehouses", "انبارها"))
        .register(C.REPORTS, make("reports", "گزارشات"))
        .register(C.ACTIVITY_LOG, make("activity-log", "تاریخچه فعالیت‌ها"))
        .register(C.SETTINGS, make("settings", "تنظیمات"));

      Router.setNotFound(async ({ page }) => {
        page("not-found");
        Topbar.setBreadcrumb([{ label: "یافت نشد" }]);
      });
    },

    /* ==========================================================
       TABS AUTO-INIT
       ========================================================== */
    setupTabsAutoInit() {
      const main = Dom.id("main");
      if (!main || !window.Tabs) return;

      // Initial pass
      this.reinitTabs();

      // Watch for DOM changes in main and re-init tabs
      const debounced = Dom.debounce(() => this.reinitTabs(), 120);
      try {
        this._tabsObserver = new MutationObserver(debounced);
        this._tabsObserver.observe(main, { childList: true, subtree: true });
      } catch (e) {
        console.warn("tabs observer init failed:", e);
      }
    },

    reinitTabs() {
      if (!window.Tabs) return;
      try {
        window.Tabs.autoInit(document);
      } catch (e) {
        console.warn("tabs autoInit failed:", e);
      }
    },

    /* ==========================================================
       GLOBAL EVENTS
       ========================================================== */
    bindGlobalEvents() {
      // Global action dispatcher
      document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-action]");
        if (!trigger) return;
        const action = trigger.dataset.action;
        this.dispatch(action, trigger, e);
      });

      // Swipe-to-open on mobile
      let touchStartX = 0;
      document.addEventListener("touchstart", (e) => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      document.addEventListener("touchend", (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx > 80 && touchStartX < 30 && window.innerWidth < 1024) {
          Sidebar.toggleMobile();
        } else if (dx < -80 && window.innerWidth < 1024) {
          Sidebar.closeMobile();
        }
      });

      // Realtime
      if (window.ENV?.FEATURES?.REALTIME && window.Supabase?.isReady()) {
        try {
          window.ProductsService.subscribe?.(() => {
            if (Router.getCurrent()?.path === "products") {
              window.ProductsPage?.mount?.();
            }
          });
        } catch (_) { /* ignore */ }
      }

      // Footer info
      const year = Dom.id("footer-year");
      if (year) year.textContent = Persian.toPersianDigits(new Date().getFullYear());
      const version = Dom.id("footer-version");
      if (version) version.textContent = window.ENV.APP_VERSION || "1.0.0";

      // Auth state change
      AuthService.onChange((user) => {
        if (user) Topbar.renderUserInfo();
      });
    },

    dispatch(action, trigger, event) {
      const route = Router.getCurrent()?.path || "dashboard";
      const handlerMap = {
        "new-product": () => window.ProductsPage?.openForm?.(),
        "new-order": () => window.OrdersPage?.openForm?.(),
        "new-customer": () => window.CustomersPage?.openForm?.(),
        "new-supplier": () => window.SuppliersPage?.openForm?.(),
        "new-warehouse": () => window.WarehousesPage?.openForm?.(),
        "refresh-dashboard": () => window.DashboardPage?.mount?.(),
        "export-dashboard": () => window.DashboardPage?.exportReport?.(),
        "inventory-adjust": () => window.InventoryPage?.openAdjust?.(),
        "inventory-transfer": () => window.InventoryPage?.openTransfer?.(),
      };

      const fn = handlerMap[action];
      if (fn) {
        try { fn(); } catch (e) {
          console.error("action failed:", action, e);
          Toast?.error(e.message || "خطا در انجام عملیات");
        }
      } else {
        const page = this.pages[route];
        const method = `handleAction_${action}`;
        if (page && typeof page[method] === "function") {
          page[method](trigger, event);
        }
      }
    },

    refresh() {
      const route = Router.getCurrent()?.path;
      const page = this.pages[route];
      if (page && typeof page.mount === "function") {
        page.mount({ force: true });
        Toast?.info("داده‌ها بروزرسانی شد", "موفق");
      }
    },

    hidePreloader() {
      const preloader = Dom.id("app-preloader");
      const app = Dom.id("app");
      if (preloader) {
        preloader.classList.add("is-hidden");
        setTimeout(() => (preloader.hidden = true), 700);
      }
      if (app) app.hidden = false;
    },

    showFatalError(err) {
      const preloader = Dom.id("app-preloader");
      if (preloader) preloader.hidden = true;
      const app = Dom.id("app");
      if (app) app.hidden = false;
      const main = Dom.id("main");
      if (main) {
        main.innerHTML = `
          <div class="empty-state" style="padding:80px 20px">
            <i class="ri-error-warning-line empty-state__icon"></i>
            <h2>خطای راه‌اندازی</h2>
            <p>${Dom.escape(err?.message || "خطای ناشناخته")}</p>
            <button class="btn btn--primary" onclick="location.reload()">تلاش مجدد</button>
          </div>
        `;
      }
    },
  };

  window.App = App;

  Dom.ready(() => App.init());
})(window);