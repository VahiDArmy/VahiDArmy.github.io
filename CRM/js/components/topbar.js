/* ============================================================================
   TOPBAR COMPONENT
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Dropdown = window.Dropdown;
  const Persian = window.Persian;
  const AuthService = window.AuthService;

  const NOTIFICATIONS = [
    { id: 1, type: "warning", title: "موجودی «ماوس گیمینگ» بحرانی است", time: new Date(Date.now() - 1000 * 60 * 12).toISOString(), read: false },
    { id: 2, type: "success", title: "سفارش ORD-2410 تحویل داده شد", time: new Date(Date.now() - 1000 * 60 * 90).toISOString(), read: false },
    { id: 3, type: "info", title: "محصول جدید «کتاب جاوااسکریپت» اضافه شد", time: new Date(Date.now() - 1000 * 60 * 240).toISOString(), read: true },
    { id: 4, type: "danger", title: "سفارش ORD-2405 لغو شد", time: new Date(Date.now() - 1000 * 60 * 720).toISOString(), read: true },
  ];

  const TASKS = [
    { id: "t1", title: "بررسی انبارگردانی هفته گذشته", done: false },
    { id: "t2", title: "تأیید سفارش‌های در انتظار", done: false },
    { id: "t3", title: "تماس با تأمین‌کننده الکترونیک", done: true },
  ];

  const Topbar = {
    init() {
      this.bindThemeToggle();
      this.bindNotifications();
      this.bindTasks();
      this.bindUserMenu();
      this.bindBreadcrumb();
      this.bindSearchShortcut();
      this.renderUserInfo();
    },

    bindThemeToggle() {
      const btn = Dom.id("theme-toggle");
      if (btn) {
        btn.addEventListener("click", () => window.ThemeSwitcher.toggle());
      }
    },

    renderUserInfo() {
      const user = AuthService.getUser();
      if (!user) return;
      const name = user.full_name || user.email?.split("@")[0] || "کاربر";
      const initials = window.Formatters.initials(name);
      Dom.qa("[data-user='name']").forEach((el) => (el.textContent = name));
      Dom.qa("[data-user='initial']").forEach((el) => (el.textContent = initials));
      Dom.qa("[data-user='role']").forEach((el) => (el.textContent = window.Formatters.roleLabel(user.role || "admin")));
    },

    bindNotifications() {
      const btn = Dom.id("notifications-btn");
      if (!btn) return;

      const unread = NOTIFICATIONS.filter((n) => !n.read).length;
      const dot = btn.querySelector("[data-badge='notifications']");
      if (dot && unread > 0) dot.hidden = false;

      btn.addEventListener("click", () => {
        const panel = this.buildNotificationsPanel();
        Dropdown.open(btn, {
          placement: "bottom-end",
          items: [],
        });
        // Replace empty menu with custom panel
        const menu = document.querySelector(".dropdown__menu");
        if (menu) {
          Dom.empty(menu);
          menu.appendChild(panel);
          menu.style.padding = "0";
          menu.style.minWidth = "360px";
          menu.style.background = "transparent";
          menu.style.border = "0";
          menu.style.boxShadow = "none";
        }
      });
    },

    buildNotificationsPanel() {
      const panel = Dom.el("div", { class: "notif-panel" });
      const header = Dom.el("div", { class: "notif-panel__header" });
      header.appendChild(Dom.el("h4", null, "اعلان‌ها"));
      const markAll = Dom.el("button", { class: "btn btn--text btn--xs", type: "button" }, "همه خوانده شد");
      markAll.addEventListener("click", () => {
        NOTIFICATIONS.forEach((n) => (n.read = true));
        Dom.qa(".notif-row").forEach((r) => Dom.removeClass(r, "is-unread"));
        const dot = document.querySelector("[data-badge='notifications']");
        if (dot) dot.hidden = true;
      });
      header.appendChild(markAll);
      panel.appendChild(header);

      const list = Dom.el("div", { class: "notif-panel__list" });
      if (!NOTIFICATIONS.length) {
        list.appendChild(Dom.el("div", { class: "empty-state", style: "padding:32px" }, [
          Dom.el("i", { class: "ri-notification-off-line empty-state__icon" }),
          Dom.el("p", null, "اعلان جدیدی وجود ندارد"),
        ]));
      } else {
        NOTIFICATIONS.forEach((n) => {
          const row = Dom.el("div", { class: `notif-row mini-list__item ${!n.read ? "is-unread" : ""}`.trim() });
          const icons = { warning: "ri-alert-line", success: "ri-check-line", info: "ri-information-line", danger: "ri-error-warning-line" };
          const tone = { warning: "warn", success: "success", info: "info", danger: "danger" };
          row.appendChild(Dom.el("div", { class: `mini-list__icon mini-list__icon--${tone[n.type] || "info"}` }, [
            Dom.el("i", { class: icons[n.type] || "ri-information-line" }),
          ]));
          const body = Dom.el("div", { class: "mini-list__body" });
          body.appendChild(Dom.el("div", { class: "mini-list__title" }, n.title));
          body.appendChild(Dom.el("div", { class: "mini-list__meta" }, Persian.timeAgoShort(n.time)));
          row.appendChild(body);
          list.appendChild(row);
        });
      }
      panel.appendChild(list);

      const footer = Dom.el("div", { class: "notif-panel__footer" });
      const link = Dom.el("a", { href: "#/activity-log" }, "مشاهده همه");
      link.addEventListener("click", () => Dropdown.closeAll());
      footer.appendChild(link);
      panel.appendChild(footer);

      return panel;
    },

    bindTasks() {
      const btn = Dom.id("tasks-btn");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const panel = Dom.el("div", { class: "task-panel" });
        const header = Dom.el("div", { class: "notif-panel__header" });
        header.appendChild(Dom.el("h4", null, "کارهای من"));
        panel.appendChild(header);
        const list = Dom.el("div", { class: "notif-panel__list" });
        TASKS.forEach((t) => {
          const row = Dom.el("label", { class: "checkbox", style: "display:flex;padding:12px 16px;border-bottom:1px solid var(--border-subtle)" });
          const input = Dom.el("input", { type: "checkbox" });
          input.checked = t.done;
          const box = Dom.el("span", { class: "checkbox__box" }, [Dom.el("i", { class: "ri-check-line" })]);
          row.appendChild(input);
          row.appendChild(box);
          const label = Dom.el("span", { style: t.done ? "text-decoration:line-through;color:var(--text-tertiary)" : "" }, t.title);
          row.appendChild(label);
          input.addEventListener("change", () => {
            t.done = input.checked;
            label.style.textDecoration = t.done ? "line-through" : "";
            label.style.color = t.done ? "var(--text-tertiary)" : "";
          });
          list.appendChild(row);
        });
        panel.appendChild(list);

        Dropdown.open(btn, { placement: "bottom-end", items: [] });
        const menu = document.querySelector(".dropdown__menu");
        if (menu) {
          Dom.empty(menu);
          menu.appendChild(panel);
          menu.style.padding = "0";
          menu.style.background = "transparent";
          menu.style.border = "0";
          menu.style.boxShadow = "none";
        }
      });
    },

    bindUserMenu() {
      const btn = Dom.id("topbar-user");
      const sidebarUser = Dom.id("user-menu-btn");
      const show = (anchor) => {
        const user = AuthService.getUser();
        const items = [
          { label: user?.full_name || "پروفایل", icon: "ri-user-line", onClick: () => (location.hash = "#/settings") },
          { label: "تنظیمات حساب", icon: "ri-settings-3-line", onClick: () => (location.hash = "#/settings") },
          { label: "تاریخچه فعالیت‌ها", icon: "ri-history-line", onClick: () => (location.hash = "#/activity-log") },
          { type: "divider" },
          { label: "تغییر تم", icon: "ri-moon-line", onClick: () => window.ThemeSwitcher.toggle() },
          { type: "divider" },
          { label: "خروج از حساب", icon: "ri-logout-box-r-line", danger: true, onClick: async () => {
            await AuthService.logout();
            location.href = "login.html";
          }},
        ];
        Dropdown.open(anchor, { items, placement: "bottom-end" });
      };
      if (btn) btn.addEventListener("click", () => show(btn));
      if (sidebarUser) sidebarUser.addEventListener("click", () => show(sidebarUser));
    },

    bindBreadcrumb() {
      // Handled by router
    },

    bindSearchShortcut() {
      const trigger = Dom.id("sidebar-search-trigger");
      if (trigger) {
        trigger.addEventListener("click", () => {
          if (window.CommandPalette) window.CommandPalette.open();
        });
      }
    },

    setBreadcrumb(items = []) {
      const container = Dom.id("breadcrumb");
      if (!container) return;
      const list = Dom.el("ol", { class: "breadcrumb__list" });
      const home = Dom.el("li", { class: "breadcrumb__item" });
      home.appendChild(Dom.el("a", { href: "#/dashboard" }, [Dom.el("i", { class: "ri-home-4-line" })]));
      list.appendChild(home);
      items.forEach((item, i) => {
        const li = Dom.el("li", { class: "breadcrumb__item" });
        if (i === items.length - 1 || !item.href) {
          li.appendChild(Dom.el("span", null, item.label));
        } else {
          li.appendChild(Dom.el("a", { href: item.href }, item.label));
        }
        list.appendChild(li);
      });
      Dom.empty(container);
      container.appendChild(list);
    },
  };

  window.Topbar = Topbar;
})(window);