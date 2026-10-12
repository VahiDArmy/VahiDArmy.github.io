/* ============================================================================
   PLACEHOLDER PAGES
   ----------------------------------------------------------------------------
   Pages: Inventory, Orders, Customers, Suppliers, Warehouses, Activity Log
   (Settings & Reports have their own dedicated files now.)
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Formatters = window.Formatters;
  const Persian = window.Persian;

  /* ---------- Inventory ---------- */
  window.InventoryPage = {
    async mount() {
      const stats = Dom.id("inventory-stats");
      const panel = Dom.id("inventory-panel");

      // Stats
      if (stats) {
        Dom.empty(stats);
        try {
          const s = await window.InventoryService.stats();
          const items = [
            { icon: "ri-stack-line",       tone: "brand",   label: "کل حرکات",       value: s.total || 0 },
            { icon: "ri-login-box-line",   tone: "success", label: "ورود امروز",       value: s.inToday || 0 },
            { icon: "ri-logout-box-line",  tone: "danger",  label: "خروج امروز",       value: s.outToday || 0 },
            { icon: "ri-calendar-line",    tone: "info",    label: "فعالیت امروز",    value: s.today || 0 },
          ];
          items.forEach((c) => {
            const card = Dom.el("div", { class: "stat-card" });
            const head = Dom.el("div", { class: "stat-card__head" });
            head.appendChild(Dom.el("div", { class: `stat-card__icon stat-card__icon--${c.tone}` }, [
              Dom.el("i", { class: c.icon }),
            ]));
            card.appendChild(head);
            card.appendChild(Dom.el("div", { class: "stat-card__value" },
              Persian.toPersianDigits(c.value.toLocaleString("fa-IR"))));
            card.appendChild(Dom.el("div", { class: "stat-card__label" }, c.label));
            stats.appendChild(card);
          });
        } catch (_) {}
      }

      if (!panel) return;
      Dom.empty(panel);

      const wrap = Dom.el("div", { class: "table-wrap" });
      wrap.innerHTML = `<div class="table-loading"><div class="table-loading__spinner"></div><span>در حال بارگذاری حرکات…</span></div>`;
      panel.appendChild(wrap);

      try {
        const res = await window.InventoryService.listMovements({ page: 1, pageSize: 30 });
        Dom.empty(wrap);
        if (!res.data.length) {
          wrap.appendChild(Dom.el("div", { class: "empty-state" }, [
            Dom.el("i", { class: "ri-inbox-line empty-state__icon" }),
            Dom.el("h3", null, "حرکتی ثبت نشده"),
          ]));
          return;
        }

        const table = Dom.el("table", { class: "table" });
        table.innerHTML = `<thead><tr>
          <th>نوع</th><th>محصول</th><th>انبار</th><th style="text-align:end">مقدار</th><th>کاربر</th><th>زمان</th>
        </tr></thead>`;
        const tbody = Dom.el("tbody");
        res.data.forEach((m) => {
          const tr = Dom.el("tr");
          const typeMap = { in: "ورود", out: "خروج", adjust: "تعدیل", transfer: "انتقال", return: "مرجوعی" };
          const typeTone = { in: "success", out: "danger", adjust: "info", transfer: "violet", return: "warning" };

          tr.appendChild(Dom.el("td", null, [
            Dom.el("span", { class: `badge badge--${typeTone[m.type] || "neutral"}` }, typeMap[m.type] || m.type),
          ]));
          tr.appendChild(Dom.el("td", null, m.product_name || "—"));
          tr.appendChild(Dom.el("td", null, m.warehouse_name || "—"));
          const qtyCls = m.qty > 0 ? "text-success" : "text-danger";
          tr.appendChild(Dom.el("td", { class: `text-end ${qtyCls}` },
            Persian.toPersianDigits((m.qty > 0 ? "+" : "") + m.qty)));
          tr.appendChild(Dom.el("td", null, m.user || "—"));
          tr.appendChild(Dom.el("td", null, Persian.timeAgoShort(m.created_at)));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
      } catch (err) {
        console.error("inventory", err);
        wrap.innerHTML = `<div class="empty-state"><i class="ri-error-warning-line empty-state__icon"></i><h3>خطا</h3><p>${Dom.escape(err.message || "")}</p></div>`;
      }
    },
    openAdjust() { window.Toast?.info("این قابلیت در حال توسعه است"); },
    openTransfer() { window.Toast?.info("این قابلیت در حال توسعه است"); },
  };

  /* ---------- Generic list page factory ---------- */
  function makePlaceholderPage(name, panelId, service, cols, emptyText) {
    return {
      async mount() {
        const panel = Dom.id(panelId);
        if (!panel) return;
        Dom.empty(panel);

        const toolbar = Dom.el("div", { class: "table-toolbar" });
        const toolbarSpacer = Dom.el("div", { class: "table-toolbar__spacer" });
        toolbar.appendChild(toolbarSpacer);
        const refresh = Dom.el("button", { class: "btn btn--ghost btn--sm", type: "button" }, [
          Dom.el("i", { class: "ri-refresh-line" }),
          Dom.el("span", null, "بروزرسانی"),
        ]);
        refresh.addEventListener("click", () => this.mount());
        toolbar.appendChild(refresh);
        panel.appendChild(toolbar);

        const wrap = Dom.el("div", { class: "table-wrap" });
        wrap.innerHTML = `<div class="table-loading"><div class="table-loading__spinner"></div><span>در حال بارگذاری…</span></div>`;
        panel.appendChild(wrap);

        try {
          if (!service) throw new Error("سرویس موجود نیست");
          const res = await service.list({ page: 1, pageSize: 20 });
          Dom.empty(wrap);

          if (!res.data || !res.data.length) {
            wrap.appendChild(Dom.el("div", { class: "empty-state" }, [
              Dom.el("i", { class: "ri-inbox-line empty-state__icon" }),
              Dom.el("h3", null, emptyText || "داده‌ای یافت نشد"),
              Dom.el("p", null, "برای شروع، اولین مورد را ایجاد کنید."),
            ]));
            return;
          }

          const table = Dom.el("table", { class: "table" });
          const thead = Dom.el("thead");
          const hr = Dom.el("tr");
          cols.forEach((c) => hr.appendChild(Dom.el("th", { class: c.align === "end" ? "text-end" : "" }, c.label)));
          thead.appendChild(hr);
          table.appendChild(thead);

          const tbody = Dom.el("tbody");
          res.data.forEach((row) => {
            const tr = Dom.el("tr");
            cols.forEach((c) => {
              const td = Dom.el("td", {
                class: c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "",
              });
              const val = c.render ? c.render(row) : row[c.key];
              if (val instanceof HTMLElement) td.appendChild(val);
              else td.innerHTML = val == null || val === "" ? "—" : String(val);
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          wrap.appendChild(table);
        } catch (err) {
          console.error(name, err);
          wrap.innerHTML = `
            <div class="empty-state">
              <i class="ri-error-warning-line empty-state__icon"></i>
              <h3>خطا در بارگذاری</h3>
              <p>${Dom.escape(err.message || "")}</p>
            </div>
          `;
        }
      },
    };
  }

  window.OrdersPage = makePlaceholderPage("orders", "orders-panel", window.OrdersService, [
    { key: "order_number", label: "شماره" },
    { key: "customer_name", label: "مشتری" },
    { key: "amount", label: "مبلغ", align: "end", render: (r) => Formatters.money(r.amount) },
    { key: "status", label: "وضعیت", align: "center",
      render: (r) => `<span class="badge badge--${(window.C?.ORDER_STATUS_TONE?.[r.status]) || "neutral"}">${Formatters.statusLabel(r.status)}</span>` },
  ], "سفارشی یافت نشد");

  window.CustomersPage = makePlaceholderPage("customers", "customers-panel", window.CustomersService, [
    { key: "name", label: "نام" },
    { key: "type", label: "نوع", render: (r) => Formatters.customerTypeLabel(r.type) },
    { key: "phone", label: "تلفن", render: (r) => Formatters.phone(r.phone) },
    { key: "city", label: "شهر" },
    { key: "total_orders", label: "سفارشات", align: "center" },
  ], "مشتری‌ای یافت نشد");

  window.SuppliersPage = makePlaceholderPage("suppliers", "suppliers-panel", window.SuppliersService, [
    { key: "name", label: "نام" },
    { key: "contact_person", label: "شخص رابط" },
    { key: "phone", label: "تلفن" },
    { key: "city", label: "شهر" },
  ], "تأمین‌کننده‌ای یافت نشد");

  window.WarehousesPage = makePlaceholderPage("warehouses", "warehouses-panel", window.WarehousesService, [
    { key: "name", label: "نام" },
    { key: "city", label: "شهر" },
    { key: "manager", label: "مدیر" },
    { key: "capacity", label: "ظرفیت", align: "end", render: (r) => Persian.toPersianDigits(r.capacity) },
  ], "انباری تعریف نشده");

  /* ---------- Activity Log ---------- */
  window.ActivityLogPage = {
    async mount() {
      const panel = Dom.id("activity-log-panel");
      if (!panel) return;
      Dom.empty(panel);

      const wrap = Dom.el("div", { class: "table-wrap" });
      wrap.innerHTML = `<div class="table-loading"><div class="table-loading__spinner"></div><span>در حال بارگذاری…</span></div>`;
      panel.appendChild(wrap);

      try {
        const res = await window.ActivityLogService.list({ page: 1, pageSize: 50 });
        Dom.empty(wrap);
        if (!res.data.length) {
          wrap.appendChild(Dom.el("div", { class: "empty-state" }, [
            Dom.el("i", { class: "ri-history-line empty-state__icon" }),
            Dom.el("h3", null, "فعالیتی ثبت نشده"),
          ]));
          return;
        }
        const list = Dom.el("div", { class: "log-list" });
        res.data.forEach((a) => {
          const tone = { create: "create", update: "update", delete: "delete", login: "login" }[a.action] || "";
          const row = Dom.el("div", { class: "log-row" });
          row.appendChild(Dom.el("div", { class: `log-row__icon log-row__icon--${tone}` }, [
            Dom.el("i", { class: this.actionIcon(a.action) }),
          ]));
          const body = Dom.el("div", { class: "log-row__body" });
          const title = Dom.el("div", { class: "log-row__title" });
          title.innerHTML = `<b>${Formatters.logActionLabel(a.action)}</b> — ${Dom.escape(a.entity_name || a.entity || "")}`;
          body.appendChild(title);
          const meta = Dom.el("div", { class: "log-row__meta" });
          meta.appendChild(Dom.el("span", { class: "log-row__meta-item" }, [
            Dom.el("i", { class: "ri-user-line" }),
            document.createTextNode(" " + (a.user || "—")),
          ]));
          if (a.ip) {
            meta.appendChild(Dom.el("span", { class: "log-row__meta-item" }, [
              Dom.el("i", { class: "ri-computer-line" }),
              document.createTextNode(" " + a.ip),
            ]));
          }
          body.appendChild(meta);
          row.appendChild(body);
          row.appendChild(Dom.el("div", { class: "log-row__time" }, Persian.timeAgoShort(a.created_at)));
          list.appendChild(row);
        });
        wrap.appendChild(list);
      } catch (err) {
        wrap.innerHTML = `<div class="empty-state"><i class="ri-error-warning-line empty-state__icon"></i><h3>خطا</h3></div>`;
      }
    },

    actionIcon(action) {
      const map = {
        create: "ri-add-line",
        update: "ri-edit-2-line",
        delete: "ri-delete-bin-line",
        login: "ri-login-box-line",
        logout: "ri-logout-box-line",
        export: "ri-download-line",
        adjust: "ri-equalizer-line",
        transfer: "ri-swap-box-line",
      };
      return map[action] || "ri-file-line";
    },
  };
})(window);