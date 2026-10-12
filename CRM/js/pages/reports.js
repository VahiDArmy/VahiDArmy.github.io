/* ============================================================================
   REPORTS PAGE — with working tabs
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
  const OrdersService = window.OrdersService;

  const TABS = ["sales", "inventory", "customers", "suppliers", "profit"];

  const ReportsPage = {
    async mount() {
      const panels = Dom.id("reports-panels");
      if (!panels) return;

      Dom.empty(panels);
      panels.classList.add("tab-panels");

      // Render panels with loading state first
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

      // Ensure tab group is initialized
      const group = document.querySelector('[data-tabs="reports"]');
      if (group) {
        setTimeout(() => window.Tabs?.initGroup?.(group), 0);
      }

      // Load each panel's content in parallel
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

    kpi(label, value, delta, tone) {
      const card = Dom.el("div", { class: "report-summary-card" });
      card.appendChild(Dom.el("div", { class: "report-summary-card__label" }, label));
      card.appendChild(Dom.el("div", { class: "report-summary-card__value" }, value));
      if (delta != null) {
        const cls = tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-tertiary";
        const icon = tone === "up" ? "ri-arrow-up-line" : tone === "down" ? "ri-arrow-down-line" : "ri-subtract-line";
        const d = Dom.el("div", { class: `report-summary-card__delta ${cls}` });
        d.appendChild(Dom.el("i", { class: icon }));
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
        summary.appendChild(this.kpi("کل سفارشات", Persian.toPersianDigits(data.total), null));
        summary.appendChild(this.kpi("درآمد (تحویلشده)", Formatters.moneyShort(data.revenue), null, "up"));
        summary.appendChild(this.kpi("در انتظار", Persian.toPersianDigits(data.pending), null));
        summary.appendChild(this.kpi("لغوشده", Persian.toPersianDigits(data.cancelled), null, "down"));
        panel.appendChild(summary);

        // Status breakdown
        const statusCard = Dom.el("div", { class: "report-chart" });
        const head = Dom.el("div", { class: "report-chart__head" });
        head.appendChild(Dom.el("h3", { class: "report-chart__title" }, "توزیع سفارشات بر اساس وضعیت"));
        statusCard.appendChild(head);

        const bars = Dom.el("div", { class: "databars" });
        const total = Object.values(data.byStatus).reduce((a, b) => a + b, 0) || 1;
        const map = { draft: "پیشنویس", pending: "در انتظار", confirmed: "تأیید شده", shipped: "ارسال شده", delivered: "تحویل شده", cancelled: "لغو شده" };
        const colors = { draft: "#6b7280", pending: "#f59e0b", confirmed: "#3b82f6", shipped: "#06b6d4", delivered: "#22c55e", cancelled: "#ef4444" };
        Object.entries(data.byStatus).forEach(([status, count]) => {
          const pct = (count / total) * 100;
          const bar = Dom.el("div", { class: "databar" });
          const h = Dom.el("div", { class: "databar__head" });
          h.appendChild(Dom.el("span", { class: "databar__label" }, map[status] || status));
          h.appendChild(Dom.el("span", { class: "databar__value" }, Persian.toPersianDigits(count)));
          bar.appendChild(h);
          const track = Dom.el("div", { class: "databar__track" });
          const fill = Dom.el("div", { class: "databar__fill", style: `width:${pct}%;background:${colors[status] || "#598eff"}` });
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
        summary.appendChild(this.kpi("کل محصولات", Persian.toPersianDigits(stats.total || 0), null));
        summary.appendChild(this.kpi("کالاهای رو به اتمام", Persian.toPersianDigits(stats.low || 0), null, "down"));
        summary.appendChild(this.kpi("ارزش انبار", Formatters.moneyShort(stats.value || 0), null));
        summary.appendChild(this.kpi("سود تخمینی", Formatters.moneyShort(stats.profit || 0), null, "up"));
        panel.appendChild(summary);

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
          const thead = Dom.el("thead");
          const hr = Dom.el("tr");
          ["محصول", "SKU", "موجودی فعلی", "حداقل", "وضعیت"].forEach((t) => hr.appendChild(Dom.el("th", null, t)));
          thead.appendChild(hr);
          table.appendChild(thead);

          const tbody = Dom.el("tbody");
          low.forEach((p) => {
            const tr = Dom.el("tr");
            tr.appendChild(Dom.el("td", null, p.name));
            tr.appendChild(Dom.el("td", { style: "font-family:var(--font-mono);font-size:12px" }, p.sku));
            tr.appendChild(Dom.el("td", { class: "text-end" }, Persian.toPersianDigits(p.stock)));
            tr.appendChild(Dom.el("td", { class: "text-end" }, Persian.toPersianDigits(p.min_stock)));
            const level = p.stock === 0 ? "danger" : p.stock <= p.min_stock / 2 ? "danger" : "warning";
            const label = p.stock === 0 ? "تمام شده" : p.stock <= p.min_stock / 2 ? "بحرانی" : "کم";
            tr.appendChild(Dom.el("td", null, Dom.el("span", { class: `badge badge--${level}` }, label)));
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
        summary.appendChild(this.kpi("کل مشتریان", Persian.toPersianDigits(stats.total || 0), null));
        summary.appendChild(this.kpi("مشتریان فعال", Persian.toPersianDigits(stats.active || 0), null, "up"));
        summary.appendChild(this.kpi("شرکتها", Persian.toPersianDigits(stats.companies || 0), null));
        summary.appendChild(this.kpi("درآمد کل", Formatters.moneyShort(stats.revenue || 0), null, "up"));
        panel.appendChild(summary);

        const card = Dom.el("div", { class: "report-table-wrap" });
        const head = Dom.el("div", { class: "report-table-head" });
        head.appendChild(Dom.el("h3", null, "مشتریان برتر"));
        card.appendChild(head);

        const table = Dom.el("table", { class: "table" });
        const thead = Dom.el("thead");
        const hr = Dom.el("tr");
        ["نام", "نوع", "شهر", "تعداد سفارش", "مبلغ کل"].forEach((t, idx) =>
          hr.appendChild(Dom.el("th", { class: idx >= 3 ? "text-end" : "" }, t)));
        thead.appendChild(hr);
        table.appendChild(thead);

        const tbody = Dom.el("tbody");
        top.forEach((c) => {
          const tr = Dom.el("tr");
          tr.appendChild(Dom.el("td", null, c.name));
          tr.appendChild(Dom.el("td", null, Formatters.customerTypeLabel(c.type)));
          tr.appendChild(Dom.el("td", null, c.city || "—"));
          tr.appendChild(Dom.el("td", { class: "text-end" }, Persian.toPersianDigits(c.total_orders || 0)));
          tr.appendChild(Dom.el("td", { class: "text-end" }, Dom.el("span", { class: "cell-money" }, Formatters.money(c.total_amount || 0))));
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
        summary.appendChild(this.kpi("کل تأمینکنندگان", Persian.toPersianDigits(data.stats.total || 0), null));
        summary.appendChild(this.kpi("فعال", Persian.toPersianDigits(data.stats.active || 0), null, "up"));
        summary.appendChild(this.kpi("محصولات تحت تأمین", Persian.toPersianDigits(data.stats.products || 0), null));
        panel.appendChild(summary);

        const card = Dom.el("div", { class: "report-table-wrap" });
        const head = Dom.el("div", { class: "report-table-head" });
        head.appendChild(Dom.el("h3", null, "تأمینکنندگان برتر"));
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
        summary.appendChild(this.kpi("درآمد کل", Formatters.moneyShort(data.revenue || 0), null, "up"));
        summary.appendChild(this.kpi("هزینه تخمینی", Formatters.moneyShort(data.cost || 0), null));
        summary.appendChild(this.kpi("سود خالص", Formatters.moneyShort(data.profit || 0), null, data.profit >= 0 ? "up" : "down"));
        summary.appendChild(this.kpi("حاشیه سود", Formatters.percent(data.margin || 0, 1), null));
        panel.appendChild(summary);

        // Visual bar
        const visual = Dom.el("div", { class: "report-chart" });
        const head = Dom.el("div", { class: "report-chart__head" });
        head.appendChild(Dom.el("h3", { class: "report-chart__title" }, "تجزیه درآمد و هزینه"));
        visual.appendChild(head);

        const bars = Dom.el("div", { class: "databars" });
        const max = Math.max(data.revenue, data.cost, 1);
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
          const fill = Dom.el("div", { class: "databar__fill", style: `width:${pct}%;background:${b.color}` });
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