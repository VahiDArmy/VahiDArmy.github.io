/* ============================================================================
   DASHBOARD PAGE
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const Formatters = window.Formatters;
  const Persian = window.Persian;
  const Toast = window.Toast;
  const Charts = window.Charts;
  const ReportsService = window.ReportsService;
  const ProductsService = window.ProductsService;
  const ActivityLogService = window.ActivityLogService;

  const DashboardPage = {
    async mount(params = {}) {
      await this.loadData();
    },

    async loadData() {
      const stats = Dom.id("dashboard-stats");
      const lowStock = Dom.id("dashboard-low-stock");
      const activity = Dom.id("dashboard-activity");

      if (stats) this.renderSkeletonStats(stats);
      if (lowStock) lowStock.innerHTML = this.loadingMini();
      if (activity) activity.innerHTML = this.loadingMini();

      try {
        const snapshot = await ReportsService.dashboardSnapshot();
        this.renderStats(stats, snapshot);
        this.renderCharts(snapshot);
        await this.renderLowStock(lowStock);
        await this.renderActivity(activity);
      } catch (err) {
        console.error("[dashboard]", err);
        if (stats) {
          Dom.empty(stats);
          stats.appendChild(Dom.el("div", { class: "callout callout--danger" }, [
            Dom.el("i", { class: "callout__icon ri-error-warning-line" }),
            Dom.el("div", null, `خطا در بارگذاری: ${err.message || "نامشخص"}`),
          ]));
        }
      }
    },

    renderSkeletonStats(container) {
      Dom.empty(container);
      for (let i = 0; i < 4; i++) {
        const card = Dom.el("div", { class: "stat-card" });
        card.innerHTML = `
          <div class="stat-card__head">
            <span class="skeleton skeleton--avatar"></span>
            <span class="skeleton skeleton--sm"></span>
          </div>
          <div style="padding:8px 0"><span class="skeleton skeleton--lg" style="max-width:180px"></span></div>
          <div><span class="skeleton" style="max-width:100px"></span></div>
        `;
        container.appendChild(card);
      }
    },

    loadingMini() {
      return `<div style="padding:24px 16px;text-align:center;color:var(--text-tertiary);font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px">
        <span class="spinner spinner--sm"></span> در حال بارگذاری…
      </div>`;
    },

    renderStats(container, snapshot) {
      if (!container) return;
      const { productStats, orderStats, customerStats, supplierStats } = snapshot;

      const cards = [
        {
          icon: "ri-archive-2-line",
          tone: "brand",
          label: "کل محصولات",
          value: productStats.total || 0,
          foot: `${Persian.toPersianDigits(productStats.low || 0)} کالای رو به اتمام`,
        },
        {
          icon: "ri-shopping-bag-3-line",
          tone: "info",
          label: "سفارشات",
          value: orderStats.total || 0,
          foot: `فروش موفق: ${Formatters.moneyShort(orderStats.revenue || 0)}`,
        },
        {
          icon: "ri-group-line",
          tone: "violet",
          label: "مشتریان",
          value: customerStats.total || 0,
          foot: `${Persian.toPersianDigits(customerStats.active || 0)} مشتری فعال`,
        },
        {
          icon: "ri-money-dollar-circle-line",
          tone: "success",
          label: "ارزش انبار",
          value: Formatters.moneyShort(productStats.value || 0),
          foot: `سود تخمینی: ${Formatters.moneyShort(productStats.profit || 0)}`,
        },
      ];

      Dom.empty(container);
      cards.forEach((c, i) => {
        const card = Dom.el("div", { class: "stat-card anim-slide-up" });
        card.style.animationDelay = `${i * 60}ms`;

        const head = Dom.el("div", { class: "stat-card__head" });
        head.appendChild(Dom.el("div", { class: `stat-card__icon stat-card__icon--${c.tone}` }, [
          Dom.el("i", { class: c.icon }),
        ]));
        card.appendChild(head);

        card.appendChild(Dom.el("div", { class: "stat-card__value" }, this.formatValue(c.value)));
        card.appendChild(Dom.el("div", { class: "stat-card__label" }, c.label));

        if (c.foot) {
          card.appendChild(Dom.el("div", { class: "stat-card__foot" }, c.foot));
        }

        container.appendChild(card);
      });
    },

    formatValue(v) {
      if (typeof v === "number") return Persian.toPersianDigits(v.toLocaleString("fa-IR"));
      return v;
    },

    renderCharts(snapshot) {
      const salesCanvas = Dom.id("chart-sales");
      if (salesCanvas) {
        const trend = snapshot.salesTrend || [];
        const labels = trend.map((p) => {
          const d = new Date(p.date);
          return Persian.toPersianDigits(`${d.getMonth() + 1}/${d.getDate()}`);
        });
        Charts.line(salesCanvas, {
          labels,
          datasets: [
            {
              label: "فروش (تومان)",
              data: trend.map((p) => p.sales || 0),
              color: "#598eff",
              fill: true,
            },
            {
              label: "تعداد سفارش",
              data: trend.map((p) => p.orders || 0),
              color: "#06b6d4",
              fill: false,
            },
          ],
          options: {
            plugins: {
              legend: {
                display: true,
                position: "top",
                align: "end",
                labels: { color: "var(--text-tertiary)", usePointStyle: true, boxWidth: 8 },
              },
            },
          },
        });
      }

      const catCanvas = Dom.id("chart-categories");
      if (catCanvas) {
        const labels = ["الکترونیک", "لوازم خانگی", "پوشاک", "خوراکی", "ابزار", "سایر"];
        const values = [32, 18, 24, 15, 8, 3];
        Charts.donut(catCanvas, { labels, values });
      }
    },

    async renderLowStock(container) {
      if (!container) return;
      try {
        const items = await ProductsService.lowStock(6);
        Dom.empty(container);
        if (!items.length) {
          container.appendChild(this.emptyMini("ri-checkbox-circle-line", "هیچ کالایی رو به اتمام نیست"));
          return;
        }
        items.forEach((p) => {
          const row = Dom.el("div", { class: "mini-list__item" });
          row.appendChild(Dom.el("div", { class: "mini-list__icon mini-list__icon--warn" }, [
            Dom.el("i", { class: "ri-alert-line" }),
          ]));
          const body = Dom.el("div", { class: "mini-list__body" });
          body.appendChild(Dom.el("div", { class: "mini-list__title" }, p.name));
          body.appendChild(Dom.el("div", { class: "mini-list__meta" },
            `${p.sku} · حداقل ${Persian.toPersianDigits(p.min_stock)}`));
          row.appendChild(body);
          row.appendChild(Dom.el("div", { class: "mini-list__value mini-list__value--warn" },
            Persian.toPersianDigits(p.stock)));
          row.addEventListener("click", () => (location.hash = "#/inventory"));
          container.appendChild(row);
        });
      } catch (e) {
        console.error("[dashboard low-stock]", e);
        container.innerHTML = this.emptyMini("ri-error-warning-line", "خطا در بارگذاری");
      }
    },

    async renderActivity(container) {
      if (!container) return;
      try {
        const items = await ActivityLogService.recent(6);
        Dom.empty(container);
        if (!items.length) {
          container.appendChild(this.emptyMini("ri-history-line", "فعالیتی ثبت نشده"));
          return;
        }
        items.forEach((a) => {
          const cls = `timeline__item timeline__item--${this.activityTone(a.action)}`;
          const el = Dom.el("div", { class: cls });
          el.appendChild(Dom.el("div", { class: "timeline__title" }, this.activityTitle(a)));
          el.appendChild(Dom.el("div", { class: "timeline__time" }, Persian.timeAgoShort(a.created_at)));
          container.appendChild(el);
        });
      } catch (e) {
        console.error("[dashboard activity]", e);
        container.innerHTML = this.emptyMini("ri-error-warning-line", "خطا در بارگذاری");
      }
    },

    activityTitle(a) {
      const map = {
        create: "ایجاد",
        update: "ویرایش",
        delete: "حذف",
        login: "ورود",
        logout: "خروج",
        export: "خروجی",
        adjust: "تعدیل",
        transfer: "انتقال",
      };
      const verb = map[a.action] || a.action || "";
      return `${verb} ${a.entity_name || ""}`.trim();
    },

    activityTone(action) {
      if (action === "create") return "success";
      if (action === "delete") return "danger";
      if (action === "update") return "warning";
      return "";
    },

    emptyMini(icon, text) {
      return `<div style="padding:32px 16px;text-align:center;color:var(--text-tertiary);font-size:13px">
        <i class="${icon}" style="font-size:32px;display:block;margin-bottom:8px;opacity:.5"></i>
        <span>${text}</span>
      </div>`;
    },

    exportReport() {
      Toast.info("گزارش در حال آماده‌سازی است…");
      setTimeout(() => {
        const data = { generatedAt: new Date().toISOString() };
        ReportsService.exportJSON(data, `dashboard-${Date.now()}.json`);
        Toast.success("گزارش دانلود شد");
      }, 600);
    },
  };

  window.DashboardPage = DashboardPage;
})(window);