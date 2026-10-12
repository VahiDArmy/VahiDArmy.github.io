/* ============================================================================
   CUSTOMERS SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const TABLE = "customers";
  const DEMO_KEY = "demo-customers";

  const SAMPLE = [
    { name: "شرکت پارس تجارت", type: "company", phone: "09121234567", email: "info@parstrade.ir", city: "تهران", address: "خیابان ولیعصر، پلاک ۱۲", total_orders: 42, total_amount: 128500000, status: "active" },
    { name: "علی رضایی", type: "individual", phone: "09351112233", email: "ali@example.com", city: "اصفهان", address: "خیابان چهارباغ", total_orders: 8, total_amount: 18500000, status: "active" },
    { name: "فروشگاه زنجیره‌ای افق کوروش", type: "company", phone: "02188776655", email: "contact@okcs.ir", city: "تهران", address: "بلوار کشاورز", total_orders: 156, total_amount: 842000000, status: "active" },
    { name: "مریم حسینی", type: "individual", phone: "09123334455", email: "maryam@example.com", city: "شیراز", address: "بلوار زند", total_orders: 5, total_amount: 4200000, status: "active" },
    { name: "شرکت صنایع غذایی گلستان", type: "company", phone: "02144556677", email: "sales@golestan.ir", city: "تهران", address: "کمربندی جنوبی", total_orders: 88, total_amount: 456000000, status: "active" },
    { name: "رضا محمدی", type: "individual", phone: "09387778899", email: "reza@example.com", city: "تبریز", address: "خیابان امام", total_orders: 3, total_amount: 1650000, status: "inactive" },
    { name: "بانک ملی ایران", type: "government", phone: "02166880000", email: "info@bmi.ir", city: "تهران", address: "خیابان فردوسی", total_orders: 24, total_amount: 128000000, status: "active" },
    { name: "زهرا کریمی", type: "individual", phone: "09151119999", email: "zahra@example.com", city: "مشهد", address: "بلوار وکیل‌آباد", total_orders: 12, total_amount: 28400000, status: "active" },
    { name: "شرکت پخش سراسری بهاران", type: "company", phone: "02133445566", email: "info@baharan.ir", city: "تهران", address: "جاده مخصوص کرج", total_orders: 72, total_amount: 385000000, status: "active" },
    { name: "حسین نوری", type: "individual", phone: "09128887766", email: "hossein@example.com", city: "کرج", address: "عظیمیه", total_orders: 6, total_amount: 8900000, status: "active" },
  ];

  const seedDemo = () => {
    const existing = Storage.get(DEMO_KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE.map((c, i) => ({
      id: `cus-${1000 + i}`,
      created_at: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
      ...c,
    }));
    Storage.set(DEMO_KEY, seeded);
    return seeded;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    async list({ page = 1, pageSize = 20, search = "", type = "", city = "", status = "", sortBy = "created_at", sortDir = "desc" } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        if (type) q = q.eq("type", type);
        if (city) q = q.eq("city", city);
        if (status) q = q.eq("status", status);
        q = q.order(sortBy, { ascending: sortDir === "asc" });
        const from = (page - 1) * pageSize;
        q = q.range(from, from + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }

      await delay(150);
      let items = seedDemo();
      if (search) items = Helpers.search(items, search, ["name", "email", "phone", "city"]);
      if (type) items = items.filter((c) => c.type === type);
      if (city) items = items.filter((c) => c.city === city);
      if (status) items = items.filter((c) => c.status === status);
      items = Helpers.sortBy(items, (c) => c[sortBy], sortDir);
      const total = items.length;
      const start = (page - 1) * pageSize;
      return { data: items.slice(start, start + pageSize), count: total, page, pageSize };
    },

    async getById(id) {
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).select("*").eq("id", id).single();
        if (error) throw error;
        return data;
      }
      await delay(120);
      return seedDemo().find((c) => c.id === id) || null;
    },

    async create(payload) {
      const now = new Date().toISOString();
      const record = {
        ...payload,
        id: payload.id || Helpers.uid("cus"),
        created_at: now,
        updated_at: now,
        total_orders: Number(payload.total_orders) || 0,
        total_amount: Number(payload.total_amount) || 0,
        status: payload.status || "active",
      };

      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).insert(record).select().single();
        if (error) throw error;
        return data;
      }
      await delay(140);
      const items = seedDemo();
      items.unshift(record);
      Storage.set(DEMO_KEY, items);
      return record;
    },

    async update(id, patch) {
      const payload = { ...patch, updated_at: new Date().toISOString() };
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      await delay(130);
      const items = seedDemo();
      const i = items.findIndex((c) => c.id === id);
      if (i < 0) throw new Error("مشتری یافت نشد");
      items[i] = { ...items[i], ...payload };
      Storage.set(DEMO_KEY, items);
      return items[i];
    },

    async remove(id) {
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.from(TABLE).delete().eq("id", id);
        if (error) throw error;
        return true;
      }
      await delay(120);
      Storage.set(DEMO_KEY, seedDemo().filter((c) => c.id !== id));
      return true;
    },

    async removeMany(ids) {
      if (!ids || !ids.length) return true;
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.from(TABLE).delete().in("id", ids);
        if (error) throw error;
        return true;
      }
      await delay(160);
      Storage.set(DEMO_KEY, seedDemo().filter((c) => !ids.includes(c.id)));
      return true;
    },

    async stats() {
      if (Supabase.isReady()) {
        const { count } = await Supabase.client.from(TABLE).select("*", { head: true, count: "exact" });
        const { data } = await Supabase.client.from(TABLE).select("total_amount,status");
        const active = (data || []).filter((c) => c.status === "active").length;
        const sum = (data || []).reduce((a, c) => a + Number(c.total_amount || 0), 0);
        return { total: count || 0, active, revenue: sum };
      }
      await delay(120);
      const items = seedDemo();
      const active = items.filter((c) => c.status === "active").length;
      const companies = items.filter((c) => c.type === "company").length;
      const revenue = items.reduce((a, c) => a + Number(c.total_amount || 0), 0);
      return { total: items.length, active, companies, revenue };
    },

    async cities() {
      await delay(80);
      const items = seedDemo();
      const set = new Set(items.map((c) => c.city).filter(Boolean));
      return Array.from(set).sort((a, b) => a.localeCompare(b, "fa"));
    },

    async topCustomers(limit = 5) {
      await delay(120);
      const items = seedDemo().slice().sort((a, b) => b.total_amount - a.total_amount).slice(0, limit);
      return items;
    },
  };

  window.CustomersService = Service;
})(window);