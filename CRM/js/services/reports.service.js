/* ============================================================================
   REPORTS SERVICE — aggregations and export helpers
   ============================================================================ */

(function (window) {
  "use strict";

  const ProductsService = window.ProductsService;
  const OrdersService = window.OrdersService;
  const CustomersService = window.CustomersService;
  const SuppliersService = window.SuppliersService;
  const InventoryService = window.InventoryService;

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    /* ---------- Sales report ---------- */
    async salesReport({ from, to } = {}) {
      await delay(200);
      const orders = (await OrdersService.list({ pageSize: 1000, from, to })).data;
      const total = orders.length;
      const revenue = orders
        .filter((o) => o.status === "delivered")
        .reduce((a, o) => a + Number(o.amount || 0), 0);
      const pending = orders.filter((o) => o.status === "pending").length;
      const cancelled = orders.filter((o) => o.status === "cancelled").length;
      const avgOrder = total ? revenue / Math.max(1, orders.filter((o) => o.status === "delivered").length) : 0;

      const byStatus = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {});

      const byDay = {};
      orders.forEach((o) => {
        const k = o.created_at.slice(0, 10);
        if (!byDay[k]) byDay[k] = { date: k, count: 0, revenue: 0 };
        byDay[k].count += 1;
        if (o.status === "delivered") byDay[k].revenue += Number(o.amount || 0);
      });

      return {
        total,
        revenue,
        pending,
        cancelled,
        avgOrder,
        byStatus,
        trend: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      };
    },

    /* ---------- Inventory report ---------- */
    async inventoryReport() {
      await delay(200);
      const stats = await ProductsService.stats();
      const low = await ProductsService.lowStock(20);
      const categories = await ProductsService.categories();
      const movements = await InventoryService.trend(30);

      const catStats = categories.map((cat) => {
        return { category: cat, count: 0, value: 0 };
      });

      return { stats, low, catStats, movements };
    },

    /* ---------- Customers report ---------- */
    async customersReport() {
      await delay(180);
      const stats = await CustomersService.stats();
      const top = await CustomersService.topCustomers(8);
      const cities = await CustomersService.cities();
      return { stats, top, cities };
    },

    /* ---------- Suppliers report ---------- */
    async suppliersReport() {
      await delay(160);
      const stats = await SuppliersService.stats();
      const list = (await SuppliersService.list({ pageSize: 100 })).data;
      const sorted = list.slice().sort((a, b) => (b.products_count || 0) - (a.products_count || 0));
      return { stats, top: sorted.slice(0, 8) };
    },

    /* ---------- Profit & loss ---------- */
    async profitReport({ from, to } = {}) {
      await delay(200);
      const orders = (await OrdersService.list({ pageSize: 1000, from, to })).data;
      const products = (await ProductsService.list({ pageSize: 1000 })).data;

      const productMap = new Map(products.map((p) => [p.id, p]));
      const revenue = orders
        .filter((o) => o.status === "delivered")
        .reduce((a, o) => a + Number(o.amount || 0), 0);

      // Estimate cost using product cost ratio
      const avgMargin = products.length
        ? products.reduce((a, p) => a + (1 - Number(p.cost || 0) / Math.max(1, Number(p.price || 1))), 0) / products.length
        : 0.3;
      const cost = revenue * (1 - avgMargin);
      const profit = revenue - cost;

      return {
        revenue,
        cost,
        profit,
        margin: revenue ? (profit / revenue) * 100 : 0,
        orderCount: orders.length,
      };
    },

    /* ---------- Export helpers ---------- */
    exportCSV(rows, headers, filename) {
      const Helpers = window.Helpers;
      const csv = Helpers.toCSV(rows, headers);
      window.Dom.download(csv, filename || `report-${Helpers.timestampForFile()}.csv`, "text/csv;charset=utf-8");
    },

    exportJSON(data, filename) {
      const Helpers = window.Helpers;
      const json = JSON.stringify(data, null, 2);
      window.Dom.download(json, filename || `report-${Helpers.timestampForFile()}.json`, "application/json");
    },

    /* ---------- KPI snapshot for dashboard ---------- */
    async dashboardSnapshot() {
      await delay(220);
      const [productStats, orderStats, customerStats, supplierStats, warehouseStats, inventoryStats] =
        await Promise.all([
          ProductsService.stats(),
          OrdersService.stats(),
          CustomersService.stats(),
          SuppliersService.stats(),
          window.WarehousesService.stats(),
          InventoryService.stats(),
        ]);

      const salesTrend = await OrdersService.trend(30);
      const inventoryTrend = await InventoryService.trend(30);

      return {
        productStats,
        orderStats,
        customerStats,
        supplierStats,
        warehouseStats,
        inventoryStats,
        salesTrend,
        inventoryTrend,
      };
    },
  };

  window.ReportsService = Service;
})(window);