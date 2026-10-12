/* ============================================================================
   PRODUCTS SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Helpers = window.Helpers;
  const Storage = window.Storage;

  const TABLE = "products";
  const DEMO_KEY = "demo-products";

  /* ---------- Demo seed ---------- */
  const CATEGORIES = [
    "الکترونیک", "لوازم خانگی", "پوشاک", "خوراکی", "ابزار", "ورزشی", "کتاب", "بهداشتی",
  ];

  const SAMPLE_PRODUCTS = [
    { name: "هدفون بلوتوثی پرو", sku: "ELC-1001", category: "الکترونیک", price: 2450000, cost: 1800000, stock: 42, min_stock: 10, warehouse_id: "wh-1", status: "active", image_url: null, description: "هدفون بی‌سیم با نویز کنسلینگ فعال" },
    { name: "کیبورد مکانیکال RGB", sku: "ELC-1002", category: "الکترونیک", price: 1890000, cost: 1200000, stock: 8, min_stock: 15, warehouse_id: "wh-1", status: "active", image_url: null, description: "کیبورد گیمینگ با سوییچ آبی" },
    { name: "ماوس گیمینگ ۱۶۰۰۰ DPI", sku: "ELC-1003", category: "الکترونیک", price: 890000, cost: 550000, stock: 3, min_stock: 20, warehouse_id: "wh-1", status: "active", image_url: null, description: "ماوس با سنسور اپتیکال پیشرفته" },
    { name: "یخچال ساید بای ساید", sku: "HOM-2001", category: "لوازم خانگی", price: 89000000, cost: 65000000, stock: 12, min_stock: 5, warehouse_id: "wh-2", status: "active", image_url: null, description: "یخچال ۳۲ فوت با آبسردکن" },
    { name: "ماشین لباسشویی ۹ کیلویی", sku: "HOM-2002", category: "لوازم خانگی", price: 32500000, cost: 24000000, stock: 6, min_stock: 8, warehouse_id: "wh-2", status: "active", image_url: null, description: "لباسشویی با موتور اینورتر" },
    { name: "تی‌شرت نخی مردانه", sku: "CLO-3001", category: "پوشاک", price: 385000, cost: 220000, stock: 156, min_stock: 30, warehouse_id: "wh-3", status: "active", image_url: null, description: "تی‌شرت نخ پنبه ۱۰۰٪" },
    { name: "شلوار جین اسلیم", sku: "CLO-3002", category: "پوشاک", price: 890000, cost: 550000, stock: 78, min_stock: 20, warehouse_id: "wh-3", status: "active", image_url: null, description: "شلوار جین کشی راحت" },
    { name: "زعفران سرگل ۱ گرمی", sku: "FOO-4001", category: "خوراکی", price: 285000, cost: 180000, stock: 240, min_stock: 50, warehouse_id: "wh-4", status: "active", image_url: null, description: "زعفران اعلا قائنات" },
    { name: "چای سیاه ۵۰۰ گرمی", sku: "FOO-4002", category: "خوراکی", price: 165000, cost: 95000, stock: 320, min_stock: 80, warehouse_id: "wh-4", status: "active", image_url: null, description: "چای ممتاز لاهیجان" },
    { name: "پیچ‌گوشتی برقی", sku: "TOO-5001", category: "ابزار", price: 1250000, cost: 800000, stock: 24, min_stock: 10, warehouse_id: "wh-5", status: "active", image_url: null, description: "پیچ‌گوشتی ۱۲ ولت با باتری" },
    { name: "دمبل ۱۰ کیلویی جفت", sku: "SPO-6001", category: "ورزشی", price: 980000, cost: 600000, stock: 15, min_stock: 6, warehouse_id: "wh-6", status: "active", image_url: null, description: "دمبل روکش لاستیکی" },
    { name: "کتاب برنامه‌نویسی جاوااسکریپت", sku: "BOK-7001", category: "کتاب", price: 450000, cost: 300000, stock: 62, min_stock: 15, warehouse_id: "wh-7", status: "active", image_url: null, description: "راهنمای جامع ES2023" },
    { name: "شامپو تقویت‌کننده", sku: "HYG-8001", category: "بهداشتی", price: 220000, cost: 130000, stock: 180, min_stock: 40, warehouse_id: "wh-8", status: "active", image_url: null, description: "شامپو ضد ریزش مو" },
    { name: "مسواک برقی", sku: "HYG-8002", category: "بهداشتی", price: 890000, cost: 550000, stock: 4, min_stock: 12, warehouse_id: "wh-8", status: "active", image_url: null, description: "مسواک برقی شارژی" },
  ];

  const state = {
    cache: null,
    cacheTs: 0,
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const genId = () => Helpers.uid("prd");

  const seedDemo = () => {
    const existing = Storage.get(DEMO_KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE_PRODUCTS.map((p, i) => ({
      id: `prd-${1000 + i}`,
      created_at: new Date(Date.now() - (i * 3600 * 1000 * 6)).toISOString(),
      updated_at: new Date(Date.now() - (i * 1800 * 1000)).toISOString(),
      ...p,
    }));
    Storage.set(DEMO_KEY, seeded);
    return seeded;
  };

  const Service = {
    /* ---------- List ---------- */
    async list({ page = 1, pageSize = 20, search = "", category = "", status = "", warehouse_id = "", sortBy = "created_at", sortDir = "desc", minStock, maxStock } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (search) {
          q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
        }
        if (category) q = q.eq("category", category);
        if (status) q = q.eq("status", status);
        if (warehouse_id) q = q.eq("warehouse_id", warehouse_id);
        if (typeof minStock === "number") q = q.gte("stock", minStock);
        if (typeof maxStock === "number") q = q.lte("stock", maxStock);
        q = q.order(sortBy, { ascending: sortDir === "asc" });
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        q = q.range(from, to);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }

      // Demo
      await delay(180);
      let items = seedDemo();
      if (search) {
        const term = (window.Persian ? window.Persian.normalize(search) : search).toLowerCase();
        items = items.filter((p) =>
          [p.name, p.sku, p.description].some((v) =>
            String(v || "").toLowerCase().includes(term)
          )
        );
      }
      if (category) items = items.filter((p) => p.category === category);
      if (status) items = items.filter((p) => p.status === status);
      if (warehouse_id) items = items.filter((p) => p.warehouse_id === warehouse_id);
      if (typeof minStock === "number") items = items.filter((p) => p.stock >= minStock);
      if (typeof maxStock === "number") items = items.filter((p) => p.stock <= maxStock);

      items = Helpers.sortBy(items, (p) => p[sortBy], sortDir);
      const total = items.length;
      const start = (page - 1) * pageSize;
      const data = items.slice(start, start + pageSize);
      return { data, count: total, page, pageSize };
    },

    /* ---------- Get by ID ---------- */
    async getById(id) {
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).select("*").eq("id", id).single();
        if (error) throw error;
        return data;
      }
      await delay(120);
      const items = seedDemo();
      return items.find((p) => p.id === id) || null;
    },

    /* ---------- Create ---------- */
    async create(payload) {
      const now = new Date().toISOString();
      const record = {
        ...payload,
        id: payload.id || genId(),
        created_at: now,
        updated_at: now,
        stock: Number(payload.stock) || 0,
        price: Number(payload.price) || 0,
        cost: Number(payload.cost) || 0,
        min_stock: Number(payload.min_stock) || 0,
      };

      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).insert(record).select().single();
        if (error) throw error;
        return data;
      }

      await delay(150);
      const items = seedDemo();
      items.unshift(record);
      Storage.set(DEMO_KEY, items);
      return record;
    },

    /* ---------- Update ---------- */
    async update(id, patch) {
      const payload = { ...patch, updated_at: new Date().toISOString() };

      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }

      await delay(140);
      const items = seedDemo();
      const idx = items.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error("محصول یافت نشد");
      items[idx] = { ...items[idx], ...payload };
      Storage.set(DEMO_KEY, items);
      return items[idx];
    },

    /* ---------- Delete ---------- */
    async remove(id) {
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.from(TABLE).delete().eq("id", id);
        if (error) throw error;
        return true;
      }
      await delay(120);
      const items = seedDemo().filter((p) => p.id !== id);
      Storage.set(DEMO_KEY, items);
      return true;
    },

    /* ---------- Bulk delete ---------- */
    async removeMany(ids) {
      if (!ids || !ids.length) return true;
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.from(TABLE).delete().in("id", ids);
        if (error) throw error;
        return true;
      }
      await delay(180);
      const items = seedDemo().filter((p) => !ids.includes(p.id));
      Storage.set(DEMO_KEY, items);
      return true;
    },

    /* ---------- Stats ---------- */
    async stats() {
      if (Supabase.isReady()) {
        const { count: total } = await Supabase.client.from(TABLE).select("*", { head: true, count: "exact" });
        const { data: low } = await Supabase.client.from(TABLE).select("id,stock,min_stock");
        const lowCount = (low || []).filter((p) => p.stock <= p.min_stock).length;
        const { data: values } = await Supabase.client.from(TABLE).select("price,stock,cost");
        const totalValue = (values || []).reduce((a, p) => a + Number(p.price || 0) * Number(p.stock || 0), 0);
        const totalCost = (values || []).reduce((a, p) => a + Number(p.cost || 0) * Number(p.stock || 0), 0);
        return { total: total || 0, low: lowCount, value: totalValue, cost: totalCost };
      }

      await delay(140);
      const items = seedDemo();
      const low = items.filter((p) => p.stock <= p.min_stock).length;
      const critical = items.filter((p) => p.stock <= Math.max(1, Math.floor((p.min_stock || 0) / 2))).length;
      const totalValue = items.reduce((a, p) => a + Number(p.price || 0) * Number(p.stock || 0), 0);
      const totalCost = items.reduce((a, p) => a + Number(p.cost || 0) * Number(p.stock || 0), 0);
      return {
        total: items.length,
        low,
        critical,
        value: totalValue,
        cost: totalCost,
        profit: totalValue - totalCost,
      };
    },

    /* ---------- Low stock ---------- */
    async lowStock(limit = 8) {
      if (Supabase.isReady()) {
        const { data } = await Supabase.client
          .from(TABLE)
          .select("*")
          .order("stock", { ascending: true })
          .limit(limit);
        return data || [];
      }
      await delay(140);
      const items = seedDemo()
        .slice()
        .sort((a, b) => a.stock - b.stock)
        .slice(0, limit);
      return items;
    },

    /* ---------- Categories ---------- */
    async categories() {
      if (Supabase.isReady()) {
        const { data } = await Supabase.client.from(TABLE).select("category");
        const set = new Set((data || []).map((r) => r.category).filter(Boolean));
        return Array.from(set).sort((a, b) => a.localeCompare(b, "fa"));
      }
      await delay(80);
      const items = seedDemo();
      const set = new Set(items.map((p) => p.category).filter(Boolean));
      return Array.from(set).sort((a, b) => a.localeCompare(b, "fa"));
    },

    /* ---------- Realtime subscribe ---------- */
    subscribe(cb) {
      if (!window.ENV?.FEATURES?.REALTIME) return null;
      return Supabase.subscribe(TABLE, (payload) => {
        cb && cb(payload);
      });
    },
  };

  window.ProductsService = Service;
})(window);