/* ============================================================================
   COMMAND PALETTE (Ctrl+K / Cmd+K)
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;

  const state = {
    open: false,
    query: "",
    activeIndex: 0,
    commands: [],
    filtered: [],
  };

  const COMMANDS = [
    // Navigation
    { id: "nav-dashboard", group: "پیمایش", icon: "ri-dashboard-3-line", title: "داشبورد", sub: "نمای کلی", action: () => location.hash = "#/dashboard", keys: ["dashboard", "نمای کلی"] },
    { id: "nav-products", group: "پیمایش", icon: "ri-archive-2-line", title: "محصولات", sub: "کاتالوگ کالا", action: () => location.hash = "#/products", keys: ["products", "محصولات", "کالا"] },
    { id: "nav-inventory", group: "پیمایش", icon: "ri-stack-line", title: "موجودی انبار", action: () => location.hash = "#/inventory", keys: ["inventory", "موجودی", "انبار"] },
    { id: "nav-orders", group: "پیمایش", icon: "ri-shopping-bag-3-line", title: "سفارشات", action: () => location.hash = "#/orders", keys: ["orders", "سفارشات"] },
    { id: "nav-customers", group: "پیمایش", icon: "ri-group-line", title: "مشتریان", action: () => location.hash = "#/customers", keys: ["customers", "مشتریان"] },
    { id: "nav-suppliers", group: "پیمایش", icon: "ri-truck-line", title: "تأمین‌کنندگان", action: () => location.hash = "#/suppliers", keys: ["suppliers", "تأمین"] },
    { id: "nav-warehouses", group: "پیمایش", icon: "ri-building-4-line", title: "انبارها", action: () => location.hash = "#/warehouses", keys: ["warehouses", "انبارها"] },
    { id: "nav-reports", group: "پیمایش", icon: "ri-bar-chart-2-line", title: "گزارشات", action: () => location.hash = "#/reports", keys: ["reports", "گزارشات"] },
    { id: "nav-activity", group: "پیمایش", icon: "ri-history-line", title: "تاریخچه فعالیت‌ها", action: () => location.hash = "#/activity-log", keys: ["activity", "تاریخچه"] },
    { id: "nav-settings", group: "پیمایش", icon: "ri-settings-3-line", title: "تنظیمات", action: () => location.hash = "#/settings", keys: ["settings", "تنظیمات"] },

    // Actions
    { id: "act-new-product", group: "دستورات", icon: "ri-add-line", title: "محصول جدید", action: () => window.App?.dispatch("new-product"), keys: ["new product", "محصول جدید"] },
    { id: "act-new-order", group: "دستورات", icon: "ri-add-line", title: "سفارش جدید", action: () => window.App?.dispatch("new-order"), keys: ["new order", "سفارش"] },
    { id: "act-new-customer", group: "دستورات", icon: "ri-user-add-line", title: "مشتری جدید", action: () => window.App?.dispatch("new-customer"), keys: ["new customer", "مشتری جدید"] },
    { id: "act-refresh", group: "دستورات", icon: "ri-refresh-line", title: "بروزرسانی داده‌ها", action: () => window.App?.refresh(), keys: ["refresh", "بروزرسانی"] },
    { id: "act-toggle-theme", group: "دستورات", icon: "ri-contrast-line", title: "تغییر تم روشن/تیره", action: () => window.ThemeSwitcher.toggle(), keys: ["theme", "تم", "تیره", "روشن"] },
    { id: "act-toggle-sidebar", group: "دستورات", icon: "ri-sidebar-fold-line", title: "جمع/باز کردن نوار کناری", action: () => {
        const s = Dom.id("sidebar");
        window.Sidebar.setCollapsed(s.dataset.state !== "collapsed");
      }, keys: ["sidebar"] },
    { id: "act-export", group: "دستورات", icon: "ri-download-line", title: "خروجی گرفتن", action: () => window.Toast?.info("از دکمه‌های خروجی هر صفحه استفاده کنید"), keys: ["export", "خروجی"] },
    { id: "act-logout", group: "دستورات", icon: "ri-logout-box-r-line", title: "خروج از حساب", action: async () => {
        await window.AuthService.logout();
        location.href = "login.html";
      }, keys: ["logout", "خروج"] },
  ];

  function ensureDom() {
    const palette = Dom.id("command-palette");
    if (!palette) return null;
    return palette;
  }

  function filter(query) {
    if (!query) return COMMANDS.slice(0, 20);
    const q = window.Persian.normalize(query).toLowerCase();
    return COMMANDS.filter((c) => {
      const bag = [c.title, c.sub, ...(c.keys || [])].map((s) =>
        window.Persian.normalize(s || "").toLowerCase()
      );
      return bag.some((s) => s.includes(q));
    }).slice(0, 30);
  }

  function render() {
    const palette = ensureDom();
    if (!palette) return;
    const list = Dom.id("cp-list");
    Dom.empty(list);

    if (!state.filtered.length) {
      list.appendChild(Dom.el("div", { class: "command-palette__empty" }, "نتیجه‌ای یافت نشد"));
      return;
    }

    const grouped = state.filtered.reduce((acc, c) => {
      if (!acc[c.group]) acc[c.group] = [];
      acc[c.group].push(c);
      return acc;
    }, {});

    let idx = 0;
    Object.entries(grouped).forEach(([group, items]) => {
      list.appendChild(Dom.el("div", { class: "command-palette__group" }, group));
      items.forEach((cmd) => {
        const i = idx++;
        const item = Dom.el("div", {
          class: `command-palette__item ${i === state.activeIndex ? "is-active" : ""}`.trim(),
          dataset: { index: i },
        });
        item.appendChild(Dom.el("div", { class: "command-palette__item-icon" }, [
          Dom.el("i", { class: cmd.icon }),
        ]));
        const textWrap = Dom.el("div", { class: "command-palette__item-text" });
        textWrap.appendChild(Dom.el("div", { class: "command-palette__item-title" }, cmd.title));
        if (cmd.sub) textWrap.appendChild(Dom.el("div", { class: "command-palette__item-sub" }, cmd.sub));
        item.appendChild(textWrap);

        item.addEventListener("click", () => run(i));
        item.addEventListener("mouseenter", () => {
          state.activeIndex = i;
          Dom.qa(".command-palette__item", list).forEach((el, j) =>
            Dom.toggleClass(el, "is-active", j === i)
          );
        });
        list.appendChild(item);
      });
    });
  }

  function run(index) {
    const cmd = state.filtered[index];
    if (!cmd) return;
    close();
    setTimeout(() => cmd.action(), 120);
  }

  function open() {
    const palette = ensureDom();
    if (!palette) return;
    if (state.open) return;
    state.open = true;
    state.query = "";
    state.activeIndex = 0;
    state.filtered = filter("");
    palette.hidden = false;
    const input = Dom.id("cp-input");
    if (input) { input.value = ""; setTimeout(() => input.focus(), 60); }
    render();
    Dom.lockScroll();
  }

  function close() {
    const palette = ensureDom();
    if (!palette) return;
    state.open = false;
    palette.hidden = true;
    Dom.unlockScroll();
  }

  const CommandPalette = {
    init() {
      const palette = ensureDom();
      if (!palette) return;
      const input = Dom.id("cp-input");
      if (input) {
        input.addEventListener("input", () => {
          state.query = input.value;
          state.filtered = filter(state.query);
          state.activeIndex = 0;
          render();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            state.activeIndex = Math.min(state.activeIndex + 1, state.filtered.length - 1);
            render();
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            state.activeIndex = Math.max(state.activeIndex - 1, 0);
            render();
          } else if (e.key === "Enter") {
            e.preventDefault();
            run(state.activeIndex);
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        });
      }

      Dom.qa("[data-cp-close]").forEach((el) => el.addEventListener("click", close));

      document.addEventListener("keydown", (e) => {
        const isMac = navigator.platform.toUpperCase().includes("MAC");
        const modKey = isMac ? e.metaKey : e.ctrlKey;
        if (modKey && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          state.open ? close() : open();
        }
        if (e.key === "Escape" && state.open) {
          e.preventDefault();
          close();
        }
      });
    },
    open,
    close,
  };

  window.CommandPalette = CommandPalette;
})(window);