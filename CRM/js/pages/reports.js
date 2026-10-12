/* ============================================================================
   REPORTS PAGE — REDESIGNED (with icons in KPI cards)
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Formatters = window.Formatters;
  const Persian = window.Persian;
  const Toast = window.Toast;
  const ReportsService = window.ReportsService;
  const ProductsService = window.ProductsService;
  const CustomersService = window.CustomersService;
  const SuppliersService = window.SuppliersService;

  const TABS = ["sales", "inventory", "customers", "suppliers", "profit"];

  const ReportsPage = {
    async mount() {
      const panels = Dom.id("reports-panels");
      if (!panels) return;

      Dom.empty(panels);
      panels.classList.add("tab-panels");

      // Create panel containers with loading state
      TABS.forEach((key, i) => {
        const panel = Dom.el("div", {
          class: "tab-panel",
          dataset: { panel: key },
          role: "tabpanel",
          id: `reports-panel-${key}`,
        });
        if (i > 0) panel.hidden = true;
        panel.appendChild(this.loadingBlock());
        panels.appendChild(panel);
      });

      // Bind tabs
      const group = document.querySelector('[data-tabs="reports"]');
      if (group) {
        setTimeout(() => window.Tabs?.initGroup?.(group), 0);
      }

      // Load all panels in parallel
      this.renderSales();
      this.renderInventory();
      this.renderCustomers();
      this.renderSuppliers();
      this.renderProfit();
    },

    loadingBlock() {
      const wrap = Dom.el("div", { style: "padding:60px 20px;text-align:center" });
      wrap.appendChild(Dom.el("div", { class: "spinner spinner--lg", style: "margin:0 auto 12px" }));
      wrap.appendChild(Dom.el("p", { style: "color:var(--text-tertiary);font-size:13px" }, "در حال بارگذاری…"));
      return wrap;
    },

    /* ==========================================================
       KPI CARD BUILDER — redesigned
       ========================================================== */
    kpi({ icon, tone = "brand", label, value, delta = null, deltaTone = "up" }) {
      const card = Dom.el("div", { class: "report-summary-card" });

      // Head row: icon + label
      const head = Dom.el("div", { class: "report-summary-card__head" });
      if (icon) {
        head.appendChild(
          Dom.el("div", { class: `report-summary-card__icon report-summary-card__icon--${tone}` }, [
            Dom.el("i", { class: icon }),
          ])
        );
      }
      head.appendChild(Dom.el("div", { class: "report-summary-card__label" }, label));
      card.appendChild(head);

      // Value
      card.appendChild(Dom.el("div", { class: "report-summary-card__value" }, value));

      // Delta (optional)
      if (delta != null) {
        const toneCls = deltaTone === "up" ? "text-success" : deltaTone === "down" ? "text-danger" : "text-tertiary";
        const arrowIcon = deltaTone === "up" ? "ri-arrow-up-line" : deltaTone === "down" ? "ri-arrow-down-line" : "ri-subtract-line";
        const d = Dom.el("div", { class: `report-summary-card__delta ${toneCls}` });
        d.appendChild(Dom.el("i", { class: arrowIcon }));
        d.appendChild(Dom.el("span", null, Formatters.delta(delta)));
        card.appendChild(d);
      }

      return card;
    },

    errorBlock(err) {
      const wrap = Dom.el("div", { class: "empty-state", style: "padding:60px 20px" });
      wrap.appendChild(Dom.el("i", { class: "ri-error-warning-line empty-state__icon" }));
      wrap.appendChild(Dom.el("h3", null, "خطا در بارگذاری"));
      wrap.appendChild(Dom.el("p", null, err?.message || ""));
      return wrap;
    },

    /* ==========================================================
       TAB: SALES
       ========================================================== */
    async renderSales() {
      const panel = document.getElementById("reports-panel-sales");
      if (!panel) return;
      try {
        const data = await ReportsService.salesReport();
        Dom.empty(panel);

        const summary = Dom.el("div", { class: "report-summary" });
        summary.appendChild(this.kpi({
          icon: "ri-shopping-bag-3-line",
          tone: "brand",
          label: "کل سفارشات",
          value: Persian.toPersianDigits(data.total),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-money-dollar-circle-line",
          tone: "success",
          label: "درآمد تحویل‌شده",
          value: Formatters.moneyShort(data.revenue),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-time-line",
          tone: "warning",
          label: "در انتظار",
          value: Persian.toPersianDigits(data.pending),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-close-circle-line",
          tone: "danger",
          label: "لغوشده",
          value: Persian.toPersianDigits(data.cancelled),
        }));
        panel.appendChild(summary);

        // Status breakdown
        const statusCard = Dom.el("div", { class: "report-chart" });
        const head = Dom.el("div", { class: "report-chart__head" });
        head.appendChild(Dom.el("h3", { class: "report-chart__title" }, "توزیع سفارشات بر اساس وضعیت"));
        statusCard.appendChild(head);

        const bars = Dom.el("div", { class: "databars" });
        const total = Object.values(data.byStatus).reduce((a, b) => a + b, 0) || 1;
        const map = {
          draft: "پیش‌نویس",
          pending: "در انتظار",
          confirmed: "تأیید شده",
          shipped: "ارسال شده",
          delivered: "تحویل شده",
          cancelled: "لغو شده",
        };
        const colors = {
          draft: "#6b7280",
          pending: "#f59e0b",
          confirmed: "#3b82f6",
          shipped: "#06b6d4",
          delivered: "#22c55e",
          cancelled: "#ef4444",
        };

        Object.entries(data.byStatus).forEach(([status, count]) => {
          const pct = (count / total) * 100;
          const bar = Dom.el("div", { class: "databar" });
          const h = Dom.el("div", { class: "databar__head" });
          h.appendChild(Dom.el("span", { class: "databar__label" }, map[status] || status));
          h.appendChild(Dom.el("span", { class: "databar__value" },
            `${Persian.toPersianDigits(count)} سفارش`));
          bar.appendChild(h);
          const track = Dom.el("div", { class: "databar__track" });
          const fill = Dom.el("div", {
            class: "databar__fill",
            style: `width:${pct}%;background:${colors[status] || "#598eff"}`,
          });
          track.appendChild(fill);
          bar.appendChild(track);
          bars.appendChild(bar);
        });
        statusCard.appendChild(bars);
        panel.appendChild(statusCard);
      } catch (err) {
        console.error("[reports/sales]", err);
        Dom.empty(panel);
        panel.appendChild(this.errorBlock(err));
      }
    },

    /* ==========================================================
       TAB: INVENTORY
       ========================================================== */
    async renderInventory() {
      const panel = document.getElementById("reports-panel-inventory");
      if (!panel) return;
      try {
        const [stats, low] = await Promise.all([
          ProductsService.stats(),
          ProductsService.lowStock(10),
        ]);
        Dom.empty(panel);

        const summary = Dom.el("div", { class: "report-summary" });
        summary.appendChild(this.kpi({
          icon: "ri-archive-2-line",
          tone: "brand",
          label: "کل محصولات",
          value: Persian.toPersianDigits(stats.total || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-alert-line",
          tone: "warning",
          label: "رو به اتمام",
          value: Persian.toPersianDigits(stats.low || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-wallet-3-line",
          tone: "info",
          label: "ارزش انبار",
          value: Formatters.moneyShort(stats.value || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-line-chart-line",
          tone: "success",
          label: "سود تخمینی",
          value: Formatters.moneyShort(stats.profit || 0),
        }));
        panel.appendChild(summary);

        // Low stock table
        const card = Dom.el("div", { class: "report-table-wrap" });
        const head = Dom.el("div", { class: "report-table-head" });
        head.appendChild(Dom.el("h3", null, "کالاهای نیازمند تأمین"));
        card.appendChild(head);

        if (!low.length) {
          const empty = Dom.el("div", { class: "empty-state" });
          empty.appendChild(Dom.el("i", { class: "ri-checkbox-circle-line empty-state__icon" }));
          empty.appendChild(Dom.el("p", null, "همه کالاها موجودی کافی دارند"));
          card.appendChild(empty);
        } else {
          const table = Dom.el("table", { class: "table" });
          table.innerHTML = `<thead><tr>
            <th>محصول</th><th>SKU</th><th style="text-align:center">موجودی</th><th style="text-align:center">حداقل</th><th>وضعیت</th>
          </tr></thead>`;
          const tbody = Dom.el("tbody");
          low.forEach((p) => {
            const tr = Dom.el("tr");
            tr.appendChild(Dom.el("td", null, p.name));
            tr.appendChild(Dom.el("td", { style: "font-family:var(--font-mono);font-size:12px" }, p.sku));
            tr.appendChild(Dom.el("td", { class: "text-center" }, Persian.toPersianDigits(p.stock)));
            tr.appendChild(Dom.el("td", { class: "text-center" }, Persian.toPersianDigits(p.min_stock)));
            const level = p.stock === 0 ? "danger" : p.stock <= p.min_stock / 2 ? "danger" : "warning";
            const label = p.stock === 0 ? "تمام شده" : p.stock <= p.min_stock / 2 ? "بحرانی" : "کم";
            const td = Dom.el("td");
            td.appendChild(Dom.el("span", { class: `badge badge--${level}` }, label));
            tr.appendChild(td);
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          card.appendChild(table);
        }
        panel.appendChild(card);
      } catch (err) {
        console.error("[reports/inventory]", err);
        Dom.empty(panel);
        panel.appendChild(this.errorBlock(err));
      }
    },

    /* ==========================================================
       TAB: CUSTOMERS
       ========================================================== */
    async renderCustomers() {
      const panel = document.getElementById("reports-panel-customers");
      if (!panel) return;
      try {
        const [stats, top] = await Promise.all([
          CustomersService.stats(),
          CustomersService.topCustomers(10),
        ]);
        Dom.empty(panel);

        const summary = Dom.el("div", { class: "report-summary" });
        summary.appendChild(this.kpi({
          icon: "ri-group-line",
          tone: "brand",
          label: "کل مشتریان",
          value: Persian.toPersianDigits(stats.total || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-user-follow-line",
          tone: "success",
          label: "مشتریان فعال",
          value: Persian.toPersianDigits(stats.active || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-building-line",
          tone: "violet",
          label: "شرکت‌ها",
          value: Persian.toPersianDigits(stats.companies || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-money-dollar-box-line",
          tone: "info",
          label: "درآمد کل",
          value: Formatters.moneyShort(stats.revenue || 0),
        }));
        panel.appendChild(summary);

        // Top customers table
        const card = Dom.el("div", { class: "report-table-wrap" });
        const head = Dom.el("div", { class: "report-table-head" });
        head.appendChild(Dom.el("h3", null, "مشتریان برتر"));
        card.appendChild(head);

        const table = Dom.el("table", { class: "table" });
        const thead = Dom.el("thead");
        const hr = Dom.el("tr");
        ["نام", "نوع", "شهر", "سفارش‌ها", "مبلغ کل"].forEach((t, idx) => {
          const th = Dom.el("th", { class: idx >= 3 ? "text-end" : "" }, t);
          hr.appendChild(th);
        });
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = Dom.el("tbody");
        top.forEach((c) => {
          const tr = Dom.el("tr");
          tr.appendChild(Dom.el("td", null, c.name));
          tr.appendChild(Dom.el("td", null, Formatters.customerTypeLabel(c.type)));
          tr.appendChild(Dom.el("td", null, c.city || "—"));
          tr.appendChild(Dom.el("td", { class: "text-end" }, Persian.toPersianDigits(c.total_orders || 0)));
          const td = Dom.el("td", { class: "text-end" });
          td.appendChild(Dom.el("span", { class: "cell-money" }, Formatters.money(c.total_amount || 0)));
          tr.appendChild(td);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        card.appendChild(table);
        panel.appendChild(card);
      } catch (err) {
        console.error("[reports/customers]", err);
        Dom.empty(panel);
        panel.appendChild(this.errorBlock(err));
      }
    },

    /* ==========================================================
       TAB: SUPPLIERS
       ========================================================== */
    async renderSuppliers() {
      const panel = document.getElementById("reports-panel-suppliers");
      if (!panel) return;
      try {
        const data = await ReportsService.suppliersReport();
        Dom.empty(panel);

        const summary = Dom.el("div", { class: "report-summary" });
        summary.appendChild(this.kpi({
          icon: "ri-truck-line",
          tone: "brand",
          label: "کل تأمین‌کنندگان",
          value: Persian.toPersianDigits(data.stats.total || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-checkbox-circle-line",
          tone: "success",
          label: "فعال",
          value: Persian.toPersianDigits(data.stats.active || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-archive-line",
          tone: "info",
          label: "محصولات تحت تأمین",
          value: Persian.toPersianDigits(data.stats.products || 0),
        }));
        panel.appendChild(summary);

        const card = Dom.el("div", { class: "report-table-wrap" });
        const head = Dom.el("div", { class: "report-table-head" });
        head.appendChild(Dom.el("h3", null, "تأمین‌کنندگان برتر"));
        card.appendChild(head);

        const table = Dom.el("table", { class: "table" });
        table.innerHTML = `<thead><tr>
          <th>نام</th><th>رابط</th><th>شهر</th><th class="text-end">تعداد محصول</th>
        </tr></thead>`;
        const tbody = Dom.el("tbody");
        data.top.forEach((s) => {
          const tr = Dom.el("tr");
          tr.appendChild(Dom.el("td", null, s.name));
          tr.appendChild(Dom.el("td", null, s.contact_person || "—"));
          tr.appendChild(Dom.el("td", null, s.city || "—"));
          tr.appendChild(Dom.el("td", { class: "text-end" }, Persian.toPersianDigits(s.products_count || 0)));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        card.appendChild(table);
        panel.appendChild(card);
      } catch (err) {
        console.error("[reports/suppliers]", err);
        Dom.empty(panel);
        panel.appendChild(this.errorBlock(err));
      }
    },

    /* ==========================================================
       TAB: PROFIT
       ========================================================== */
    async renderProfit() {
      const panel = document.getElementById("reports-panel-profit");
      if (!panel) return;
      try {
        const data = await ReportsService.profitReport();
        Dom.empty(panel);

        const summary = Dom.el("div", { class: "report-summary" });
        summary.appendChild(this.kpi({
          icon: "ri-arrow-up-circle-line",
          tone: "success",
          label: "درآمد کل",
          value: Formatters.moneyShort(data.revenue || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-arrow-down-circle-line",
          tone: "danger",
          label: "هزینه تخمینی",
          value: Formatters.moneyShort(data.cost || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-money-dollar-circle-line",
          tone: "brand",
          label: "سود خالص",
          value: Formatters.moneyShort(data.profit || 0),
        }));
        summary.appendChild(this.kpi({
          icon: "ri-percent-line",
          tone: "info",
          label: "حاشیه سود",
          value: Formatters.percent(data.margin || 0, 1),
        }));
        panel.appendChild(summary);

        // Revenue breakdown visual
        const visual = Dom.el("div", { class: "report-chart" });
        const head = Dom.el("div", { class: "report-chart__head" });
        head.appendChild(Dom.el("h3", { class: "report-chart__title" }, "تجزیه درآمد و هزینه"));
        visual.appendChild(head);

        const bars = Dom.el("div", { class: "databars" });
        const max = Math.max(data.revenue, data.cost, data.profit, 1);
        [
          { label: "درآمد", value: data.revenue, color: "#22c55e" },
          { label: "هزینه", value: data.cost, color: "#ef4444" },
          { label: "سود", value: data.profit, color: "#598eff" },
        ].forEach((b) => {
          const pct = (Math.abs(b.value) / max) * 100;
          const bar = Dom.el("div", { class: "databar" });
          const h = Dom.el("div", { class: "databar__head" });
          h.appendChild(Dom.el("span", { class: "databar__label" }, b.label));
          h.appendChild(Dom.el("span", { class: "databar__value" }, Formatters.money(b.value)));
          bar.appendChild(h);
          const track = Dom.el("div", { class: "databar__track" });
          const fill = Dom.el("div", {
            class: "databar__fill",
            style: `width:${pct}%;background:${b.color}`,
          });
          track.appendChild(fill);
          bar.appendChild(track);
          bars.appendChild(bar);
        });
        visual.appendChild(bars);
        panel.appendChild(visual);
      } catch (err) {
        console.error("[reports/profit]", err);
        Dom.empty(panel);
        panel.appendChild(this.errorBlock(err));
      }
    },
  };

  window.ReportsPage = ReportsPage;
})(window);