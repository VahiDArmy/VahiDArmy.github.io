/* ============================================================================
   TOPBAR COMPONENT — FIXED
   - user menu button now works (was hidden under sidebar due to z-index)
   - parent .sidebar__user is also clickable
   - dropdown opens ABOVE the button (top-end placement)
   - user role/full_name normalized for Supabase
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Dropdown = window.Dropdown;
  const Persian = window.Persian;
  const AuthService = window.AuthService;

  /* ---------- Demo notifications (in-memory) ---------- */
  const NOTIFICATIONS = [
    { id: 1, type: "warning", title: "موجودی «ماوس گیمینگ» بحرانی است", time: new Date(Date.now() - 1000 * 60 * 12).toISOString(), read: false },
    { id: 2, type: "success", title: "سفارش ORD-2410 تحویل داده شد", time: new Date(Date.now() - 1000 * 60 * 90).toISOString(), read: false },
    { id: 3, type: "info",    title: "محصول جدید «کتاب جاوااسکریپت» اضافه شد", time: new Date(Date.now() - 1000 * 60 * 240).toISOString(), read: true },
    { id: 4, type: "danger",  title: "سفارش ORD-2405 لغو شد", time: new Date(Date.now() - 1000 * 60 * 720).toISOString(), read: true },
  ];

  const TASKS = [
    { id: "t1", title: "بررسی انبارگردانی هفته گذشته", done: false },
    { id: "t2", title: "تأیید سفارش‌های در انتظار", done: false },
    { id: "t3", title: "تماس با تأمین‌کننده الکترونیک", done: true },
  ];

  /* ---------- Robust URL resolution (works on GitHub Pages subpaths) ---------- */
  function basePath() {
    return window.location.origin + window.location.pathname.replace(/[^/]*$/, "");
  }
  function resolveLoginUrl() { return basePath() + "login.html"; }
  function resolveIndexUrl() { return basePath() + "index.html"; }

  const Topbar = {
    init() {
      this.bindThemeToggle();
      this.bindNotifications();
      this.bindTasks();
      this.bindUserMenu();
      this.bindSearchShortcut();
      this.renderUserInfo();

      // Re-render user info whenever auth state changes
      if (AuthService && typeof AuthService.onChange === "function") {
        AuthService.onChange(() => this.renderUserInfo());
      }
    },

    bindThemeToggle() {
      const btn = Dom.id("theme-toggle");
      if (btn) btn.addEventListener("click", () => window.ThemeSwitcher.toggle());
    },

    /* ---------- User info rendering ---------- */
    renderUserInfo() {
      const user = AuthService.getUser();
      if (!user) {
        Dom.qa("[data-user='name']").forEach((el) => (el.textContent = "مهمان"));
        Dom.qa("[data-user='initial']").forEach((el) => (el.textContent = "؟"));
        Dom.qa("[data-user='role']").forEach((el) => (el.textContent = "—"));
        return;
      }
      const name = user.full_name || user.email?.split("@")[0] || "کاربر";
      const initials = window.Formatters.initials(name);
      const roleLabel = window.Formatters.roleLabel(user.role) || "کاربر";

      Dom.qa("[data-user='name']").forEach((el) => (el.textContent = name));
      Dom.qa("[data-user='initial']").forEach((el) => (el.textContent = initials));
      Dom.qa("[data-user='role']").forEach((el) => (el.textContent = roleLabel));
    },

    /* ---------- Notifications ---------- */
    bindNotifications() {
      const btn = Dom.id("notifications-btn");
      if (!btn) return;

      const unread = NOTIFICATIONS.filter((n) => !n.read).length;
      const dot = btn.querySelector("[data-badge='notifications']");
      if (dot) dot.hidden = unread === 0;

      btn.addEventListener("click", () => {
        const panel = this.buildNotificationsPanel();
        const inst = Dropdown.open(btn, {
          placement: "bottom-end",
          items: [],
        });
        this.swapMenuContent(inst, panel);
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
        list.appendChild(
          Dom.el("div", { style: "padding:32px;text-align:center;color:var(--text-tertiary);font-size:13px" }, "اعلان جدیدی وجود ندارد")
        );
      } else {
        NOTIFICATIONS.forEach((n) => {
          const row = Dom.el("div", { class: "mini-list__item notif-row" });
          const icons = { warning: "ri-alert-line", success: "ri-check-line", info: "ri-information-line", danger: "ri-error-warning-line" };
          const tones = { warning: "warn", success: "success", info: "info", danger: "danger" };
          row.appendChild(
            Dom.el("div", { class: `mini-list__icon mini-list__icon--${tones[n.type] || "info"}` }, [
              Dom.el("i", { class: icons[n.type] || "ri-information-line" }),
            ])
          );
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

    /* ---------- Tasks ---------- */
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
          const row = Dom.el("label", {
            class: "checkbox",
            style: "display:flex;padding:12px 16px;border-bottom:1px solid var(--border-subtle);cursor:pointer;width:100%",
          });
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

        const inst = Dropdown.open(btn, { placement: "bottom-end", items: [] });
        this.swapMenuContent(inst, panel);
      });
    },

    /* ---------- Helper: replace dropdown menu content with custom panel ---------- */
    swapMenuContent(instance, panel) {
      if (!instance || !instance.menu) return;
      const menu = instance.menu;
      Dom.empty(menu);
      menu.appendChild(panel);
      Object.assign(menu.style, {
        padding: "0",
        background: "transparent",
        border: "0",
        boxShadow: "none",
        minWidth: "0",
        maxWidth: "none",
        maxHeight: "none",
        overflow: "visible",
      });
    },

    /* ---------- User menu (✅ FIXED) ---------- */
    bindUserMenu() {
      const btn = Dom.id("topbar-user");
      const sidebarUserBtn = Dom.id("user-menu-btn");
      const sidebarUserWrap = Dom.id("sidebar-user");

      const openMenu = (anchor) => {
        const user = AuthService.getUser();

        // Determine menu placement: for sidebar, open ABOVE (top-end).
        const isSidebar = sidebarUserWrap && sidebarUserWrap.contains(anchor);
        const placement = isSidebar ? "top-end" : "bottom-end";

        const name = user?.full_name || user?.email?.split("@")[0] || "کاربر";
        const email = user?.email || "—";

        const items = [
          // Header: user info (non-clickable, styled)
          { type: "section", label: name },
          { type: "section", label: email },
          { type: "divider" },
          { label: "پروفایل کاربری", icon: "ri-user-line", onClick: () => (location.hash = "#/settings") },
          { label: "تنظیمات حساب", icon: "ri-settings-3-line", onClick: () => (location.hash = "#/settings") },
          { label: "تاریخچه فعالیت‌ها", icon: "ri-history-line", onClick: () => (location.hash = "#/activity-log") },
          { type: "divider" },
          { label: "تغییر تم روشن/تیره", icon: "ri-contrast-2-line", onClick: () => window.ThemeSwitcher.toggle() },
          {
            label: "دستورات سریع",
            icon: "ri-command-line",
            shortcut: "Ctrl+K",
            onClick: () => window.CommandPalette?.open(),
          },
          { type: "divider" },
          {
            label: "خروج از حساب",
            icon: "ri-logout-box-r-line",
            danger: true,
            onClick: async () => {
              try { await AuthService.logout(); } catch (e) { /* ignore */ }
              window.location.href = resolveLoginUrl();
            },
          },
        ];

        Dropdown.open(anchor, { items, placement });
      };

      // ✅ FIX: attach to the icon button AND its parent wrapper
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          openMenu(btn);
        });
      }
      if (sidebarUserBtn) {
        sidebarUserBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openMenu(sidebarUserBtn);
        });
      }
      if (sidebarUserWrap) {
        sidebarUserWrap.addEventListener("click", (e) => {
          // Only trigger if the click was on the wrapper itself, not on a child that already handles it
          if (e.target.closest("#user-menu-btn")) return;
          openMenu(sidebarUserWrap);
        });
      }
    },

    /* ---------- Sidebar search trigger ---------- */
    bindSearchShortcut() {
      const trigger = Dom.id("sidebar-search-trigger");
      if (trigger) {
        trigger.addEventListener("click", () => {
          if (window.CommandPalette) window.CommandPalette.open();
        });
      }
    },

    /* ---------- Breadcrumb ---------- */
    setBreadcrumb(items = []) {
      const container = Dom.id("breadcrumb");
      if (!container) return;

      const list = Dom.el("ol", { class: "breadcrumb__list" });

      // Home icon always first
      const homeLi = Dom.el("li", { class: "breadcrumb__item" });
      homeLi.appendChild(
        Dom.el("a", { href: "#/dashboard", title: "داشبورد", "aria-label": "داشبورد" }, [
          Dom.el("i", { class: "ri-home-4-line" }),
        ])
      );
      list.appendChild(homeLi);

      items.forEach((item, idx) => {
        const li = Dom.el("li", { class: "breadcrumb__item" });
        const isLast = idx === items.length - 1;
        if (item.href && !isLast) {
          li.appendChild(Dom.el("a", { href: item.href }, item.label));
        } else {
          li.appendChild(Dom.el("span", null, item.label));
        }
        list.appendChild(li);
      });

      Dom.empty(container);
      container.appendChild(list);
    },

    resolveLoginUrl,
    resolveIndexUrl,
  };

  window.Topbar = Topbar;
})(window);