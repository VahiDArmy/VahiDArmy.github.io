/* ============================================================================
   INVENTORY SERVICE (stock levels + movement log)
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const TABLE = "stock_movements";
  const DEMO_KEY = "demo-movements";

  const SAMPLE_MOVEMENTS = [
    { type: "in", product_id: "prd-1000", product_name: "هدفون بلوتوثی پرو", qty: 20, warehouse_id: "wh-1", warehouse_name: "انبار مرکزی", user: "علی رضایی", note: "خرید از تأمین‌کننده", created_at: new Date(Date.now() - 3600e3 * 4).toISOString() },
    { type: "out", product_id: "prd-1002", product_name: "ماوس گیمینگ ۱۶۰۰۰ DPI", qty: -3, warehouse_id: "wh-1", warehouse_name: "انبار مرکزی", user: "زهرا احمدی", note: "فروش به مشتری", created_at: new Date(Date.now() - 3600e3 * 6).toISOString() },
    { type: "adjust", product_id: "prd-1001", product_name: "کیبورد مکانیکال RGB", qty: -2, warehouse_id: "wh-1", warehouse_name: "انبار مرکزی", user: "مریم کریمی", note: "اصلاح انبارگردانی", created_at: new Date(Date.now() - 3600e3 * 12).toISOString() },
    { type: "transfer", product_id: "prd-1003", product_name: "یخچال ساید بای ساید", qty: 5, warehouse_id: "wh-2", warehouse_name: "انبار شمال", user: "رضا محمدی", note: "انتقال از انبار مرکزی", created_at: new Date(Date.now() - 3600e3 * 24).toISOString() },
    { type: "in", product_id: "prd-1007", product_name: "زعفران سرگل ۱ گرمی", qty: 100, warehouse_id: "wh-4", warehouse_name: "انبار خوراکی", user: "علی رضایی", note: "خرید فصلی", created_at: new Date(Date.now() - 3600e3 * 36).toISOString() },
    { type: "out", product_id: "prd-1005", product_name: "تی‌شرت نخی مردانه", qty: -24, warehouse_id: "wh-3", warehouse_name: "انبار پوشاک", user: "حسین نوری", note: "فروش عمده", created_at: new Date(Date.now() - 3600e3 * 48).toISOString() },
  ];

  const seedDemo = () => {
    const existing = Storage.get(DEMO_KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE_MOVEMENTS.map((m, i) => ({
      id: `mov-${1000 + i}`,
      ...m,
    }));
    Storage.set(DEMO_KEY, seeded);
    return seeded;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    /* ---------- List movements ---------- */
    async listMovements({ page = 1, pageSize = 20, type = "", product_id = "", warehouse_id = "", search = "" } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (type) q = q.eq("type", type);
        if (product_id) q = q.eq("product_id", product_id);
        if (warehouse_id) q = q.eq("warehouse_id", warehouse_id);
        if (search) q = q.or(`product_name.ilike.%${search}%,note.ilike.%${search}%`);
        q = q.order("created_at", { ascending: false });
        const from = (page - 1) * pageSize;
        q = q.range(from, from + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }

      await delay(150);
      let items = seedDemo();
      if (type) items = items.filter((m) => m.type === type);
      if (product_id) items = items.filter((m) => m.product_id === product_id);
      if (warehouse_id) items = items.filter((m) => m.warehouse_id === warehouse_id);
      if (search) items = Helpers.search(items, search, ["product_name", "note", "user"]);
      items = Helpers.sortBy(items, (m) => m.created_at, "desc");
      const total = items.length;
      const start = (page - 1) * pageSize;
      return { data: items.slice(start, start + pageSize), count: total, page, pageSize };
    },

    /* ---------- Record movement ---------- */
    async recordMovement(payload) {
      const record = {
        id: Helpers.uid("mov"),
        type: payload.type || "in",
        product_id: payload.product_id,
        product_name: payload.product_name || "",
        qty: Number(payload.qty) || 0,
        warehouse_id: payload.warehouse_id || null,
        warehouse_name: payload.warehouse_name || "",
        user: payload.user || "کاربر",
        note: payload.note || "",
        created_at: new Date().toISOString(),
      };

      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).insert(record).select().single();
        if (error) throw error;
        return data;
      }

      await delay(120);
      const items = seedDemo();
      items.unshift(record);
      Storage.set(DEMO_KEY, items);
      return record;
    },

    /* ---------- Stats ---------- */
    async stats() {
      if (Supabase.isReady()) {
        const { count: total } = await Supabase.client.from(TABLE).select("*", { head: true, count: "exact" });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await Supabase.client
          .from(TABLE)
          .select("*", { head: true, count: "exact" })
          .gte("created_at", today.toISOString());
        return { total: total || 0, today: todayCount || 0 };
      }
      await delay(100);
      const items = seedDemo();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayCount = items.filter((m) => new Date(m.created_at) >= today).length;
      const inToday = items.filter((m) => new Date(m.created_at) >= today && m.type === "in").length;
      const outToday = items.filter((m) => new Date(m.created_at) >= today && m.type === "out").length;
      return { total: items.length, today: todayCount, inToday, outToday };
    },

    /* ---------- Trend data (last N days) ---------- */
    async trend(days = 30) {
      await delay(120);
      const items = seedDemo();
      const now = Date.now();
      const buckets = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { in: 0, out: 0 };
      }
      items.forEach((m) => {
        const key = new Date(m.created_at).toISOString().slice(0, 10);
        if (key in buckets) {
          if (m.qty > 0) buckets[key].in += m.qty;
          else buckets[key].out += Math.abs(m.qty);
        }
      });
      return Object.entries(buckets).map(([date, v]) => ({ date, ...v }));
    },
  };

  window.InventoryService = Service;
})(window);