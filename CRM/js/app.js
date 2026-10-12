/* ============================================================================
   MAIN APPLICATION
   ----------------------------------------------------------------------------
   Bootstraps the whole app: auth, router, components, pages.
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

    /* ---------- Bootstrap ---------- */
    async init() {
      try {
        // 1. Theme
        ThemeSwitcher.init();

        // 2. Auth check
        await AuthService.init();
        if (!AuthService.isAuthenticated()) {
          // Allow rendering for demo purposes with a warning
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

        // 8. Hide preloader
        this.hidePreloader();
        document.body.classList.add("app-ready");

        // 9. Cleanup on unload
        window.addEventListener("beforeunload", () => {
          window.Charts?.destroyAll();
        });
      } catch (err) {
        console.error("app.init failed:", err);
        this.showFatalError(err);
      }
    },

    /* ---------- Register pages ---------- */
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

    /* ---------- Register routes ---------- */
    registerRoutes() {
      const C = window.C.ROUTES;
      const make = (key, label) => async ({ page, params }) => {
        const ok = page(key, params);
        if (!ok) throw new Error("صفحه یافت نشد");
        Topbar.setBreadcrumb([{ label }]);
        const mod = this.pages[key];
        if (mod && typeof mod.mount === "function") {
          await mod.mount(params || {});
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

    /* ---------- Global events ---------- */
    bindGlobalEvents() {
      // Global action dispatcher (from buttons with data-action)
      document.addEventListener("click", (e) => {
        const trigger = e.target.closest("[data-action]");
        if (!trigger) return;
        const action = trigger.dataset.action;
        this.dispatch(action, trigger, e);
      });

      // Mobile menu on left edge swipe — simple
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

      // Realtime subscriptions
      if (window.ENV?.FEATURES?.REALTIME && window.Supabase?.isReady()) {
        try {
          window.ProductsService.subscribe?.(() => {
            if (Router.getCurrent()?.path === "products") {
              window.ProductsPage?.mount?.();
            }
          });
        } catch (e) { /* ignore */ }
      }

      // Footer year
      const year = Dom.id("footer-year");
      if (year) year.textContent = window.Persian.toPersianDigits(new Date().getFullYear());
      const version = Dom.id("footer-version");
      if (version) version.textContent = window.ENV.APP_VERSION || "1.0.0";

      // Auth state change
      AuthService.onChange((user) => {
        if (!user) {
          // Could redirect to login
        } else {
          Topbar.renderUserInfo();
        }
      });
    },

    /* ---------- Action dispatcher ---------- */
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
        // Page-level: try `handle${Action}` in current page module
        const page = this.pages[route];
        const method = `handleAction_${action}`;
        if (page && typeof page[method] === "function") {
          page[method](trigger, event);
        }
      }
    },

    /* ---------- Global refresh ---------- */
    refresh() {
      const route = Router.getCurrent()?.path;
      const page = this.pages[route];
      if (page && typeof page.mount === "function") {
        page.mount({ force: true });
        Toast?.info("داده‌ها بروزرسانی شد", "موفق");
      }
    },

    /* ---------- Preloader ---------- */
    hidePreloader() {
      const preloader = Dom.id("app-preloader");
      const app = Dom.id("app");
      if (preloader) {
        preloader.classList.add("is-hidden");
        setTimeout(() => (preloader.hidden = true), 700);
      }
      if (app) app.hidden = false;
    },

    /* ---------- Fatal error ---------- */
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

  /* ---------- Boot ---------- */
  Dom.ready(() => App.init());
})(window);