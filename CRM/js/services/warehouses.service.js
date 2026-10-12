/* ============================================================================
   WAREHOUSES SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const TABLE = "warehouses";
  const KEY = "demo-warehouses";

  const SAMPLE = [
    { name: "انبار مرکزی تهران", address: "تهران، جاده مخصوص کرج، کیلومتر ۵", city: "تهران", capacity: 100000, used: 68000, manager: "علی رضایی", phone: "02144332211", status: "active" },
    { name: "انبار شمال کشور", address: "گیلان، رشت، شهرک صنعتی", city: "رشت", capacity: 50000, used: 24000, manager: "زهرا احمدی", phone: "01333445566", status: "active" },
    { name: "انبار پوشاک اصفهان", address: "اصفهان، شهرک صنعتی جی", city: "اصفهان", capacity: 30000, used: 12500, manager: "مریم کریمی", phone: "03133445566", status: "active" },
    { name: "انبار خوراکی مشهد", address: "مشهد، شهرک صنعتی توس", city: "مشهد", capacity: 45000, used: 38000, manager: "رضا محمدی", phone: "05133445566", status: "active" },
    { name: "انبار ابزار کرج", address: "کرج، شهرک صنعتی سیمین‌دشت", city: "کرج", capacity: 25000, used: 8200, manager: "حسین نوری", phone: "02633445566", status: "active" },
    { name: "انبار ورزشی تبریز", address: "تبریز، شهرک صنعتی شهید سلیمی", city: "تبریز", capacity: 20000, used: 4500, manager: "محمد اکبری", phone: "04133445566", status: "active" },
    { name: "انبار کتاب قم", address: "قم، شهرک صنعتی شکوهیه", city: "قم", capacity: 15000, used: 6800, manager: "فاطمه سعیدی", phone: "02533445566", status: "active" },
    { name: "انبار بهداشتی شیراز", address: "شیراز، شهرک صنعتی بزرگ", city: "شیراز", capacity: 18000, used: 9200, manager: "سعید ناصری", phone: "07133445566", status: "active" },
  ];

  const seed = () => {
    const existing = Storage.get(KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE.map((w, i) => ({
      id: `wh-${i + 1}`,
      code: `WH-${String(i + 1).padStart(3, "0")}`,
      created_at: new Date(Date.now() - i * 86400000 * 10).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
      ...w,
    }));
    Storage.set(KEY, seeded);
    return seeded;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    async list({ page = 1, pageSize = 20, search = "", city = "", status = "" } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (search) q = q.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
        if (city) q = q.eq("city", city);
        if (status) q = q.eq("status", status);
        q = q.order("created_at", { ascending: false });
        const start = (page - 1) * pageSize;
        q = q.range(start, start + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }
      await delay(130);
      let items = seed();
      if (search) items = Helpers.search(items, search, ["name", "address", "manager"]);
      if (city) items = items.filter((w) => w.city === city);
      if (status) items = items.filter((w) => w.status === status);
      const total = items.length;
      const start = (page - 1) * pageSize;
      return { data: items.slice(start, start + pageSize), count: total, page, pageSize };
    },

    async getById(id) {
      await delay(100);
      return seed().find((w) => w.id === id) || null;
    },

    async create(payload) {
      const now = new Date().toISOString();
      const items = seed();
      const record = {
        ...payload,
        id: Helpers.uid("wh"),
        code: payload.code || `WH-${String(items.length + 1).padStart(3, "0")}`,
        capacity: Number(payload.capacity) || 0,
        used: Number(payload.used) || 0,
        status: payload.status || "active",
        created_at: now,
        updated_at: now,
      };
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).insert(record).select().single();
        if (error) throw error;
        return data;
      }
      await delay(140);
      items.push(record);
      Storage.set(KEY, items);
      return record;
    },

    async update(id, patch) {
      const payload = { ...patch, updated_at: new Date().toISOString() };
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      await delay(120);
      const items = seed();
      const i = items.findIndex((w) => w.id === id);
      if (i < 0) throw new Error("انبار یافت نشد");
      items[i] = { ...items[i], ...payload };
      Storage.set(KEY, items);
      return items[i];
    },

    async remove(id) {
      await delay(120);
      Storage.set(KEY, seed().filter((w) => w.id !== id));
      return true;
    },

    async stats() {
      await delay(100);
      const items = seed();
      const capacity = items.reduce((a, w) => a + Number(w.capacity || 0), 0);
      const used = items.reduce((a, w) => a + Number(w.used || 0), 0);
      return { total: items.length, capacity, used, fill: capacity ? (used / capacity) * 100 : 0 };
    },

    async cities() {
      await delay(60);
      const items = seed();
      const set = new Set(items.map((w) => w.city).filter(Boolean));
      return Array.from(set).sort((a, b) => a.localeCompare(b, "fa"));
    },
  };

  window.WarehousesService = Service;
})(window);