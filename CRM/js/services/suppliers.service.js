/* ============================================================================
   SUPPLIERS SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const TABLE = "suppliers";
  const DEMO_KEY = "demo-suppliers";

  const SAMPLE = [
    { name: "شرکت الکترونیک پارس", contact_person: "مهندس احمدی", phone: "02122334455", email: "info@epars.ir", city: "تهران", products_count: 42, status: "active" },
    { name: "صنایع روشنایی نور", contact_person: "آقای رضایی", phone: "03133445566", email: "sales@noor.ir", city: "اصفهان", products_count: 18, status: "active" },
    { name: "پخش لوازم خانگی ایرانیان", contact_person: "خانم حسینی", phone: "02155667788", email: "info@iranian.ir", city: "تهران", products_count: 24, status: "active" },
    { name: "زراعی سبز دشت", contact_person: "آقای کشاورز", phone: "05133445566", email: "info@dasht.ir", city: "مشهد", products_count: 12, status: "active" },
    { name: "پوشاک برتر", contact_person: "آقای محمدی", phone: "02177889900", email: "info@bartar.ir", city: "تهران", products_count: 36, status: "active" },
    { name: "ابزار صنعتی تولا", contact_person: "مهندس کریمی", phone: "02144332211", email: "info@tola.ir", city: "کرج", products_count: 8, status: "inactive" },
  ];

  const seedDemo = () => {
    const existing = Storage.get(DEMO_KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE.map((s, i) => ({
      id: `sup-${1000 + i}`,
      created_at: new Date(Date.now() - i * 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
      ...s,
    }));
    Storage.set(DEMO_KEY, seeded);
    return seeded;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    async list({ page = 1, pageSize = 20, search = "", city = "", status = "", sortBy = "created_at", sortDir = "desc" } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (search) q = q.or(`name.ilike.%${search}%,contact_person.ilike.%${search}%,email.ilike.%${search}%`);
        if (city) q = q.eq("city", city);
        if (status) q = q.eq("status", status);
        q = q.order(sortBy, { ascending: sortDir === "asc" });
        const start = (page - 1) * pageSize;
        q = q.range(start, start + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }

      await delay(140);
      let items = seedDemo();
      if (search) items = Helpers.search(items, search, ["name", "contact_person", "email", "phone"]);
      if (city) items = items.filter((s) => s.city === city);
      if (status) items = items.filter((s) => s.status === status);
      items = Helpers.sortBy(items, (s) => s[sortBy], sortDir);
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
      await delay(100);
      return seedDemo().find((s) => s.id === id) || null;
    },

    async create(payload) {
      const now = new Date().toISOString();
      const record = {
        ...payload,
        id: payload.id || Helpers.uid("sup"),
        created_at: now,
        updated_at: now,
        status: payload.status || "active",
        products_count: Number(payload.products_count) || 0,
      };
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).insert(record).select().single();
        if (error) throw error;
        return data;
      }
      await delay(130);
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
      await delay(120);
      const items = seedDemo();
      const i = items.findIndex((s) => s.id === id);
      if (i < 0) throw new Error("تأمین‌کننده یافت نشد");
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
      await delay(110);
      Storage.set(DEMO_KEY, seedDemo().filter((s) => s.id !== id));
      return true;
    },

    async removeMany(ids) {
      if (!ids || !ids.length) return true;
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.from(TABLE).delete().in("id", ids);
        if (error) throw error;
        return true;
      }
      await delay(150);
      Storage.set(DEMO_KEY, seedDemo().filter((s) => !ids.includes(s.id)));
      return true;
    },

    async stats() {
      await delay(100);
      const items = seedDemo();
      const active = items.filter((s) => s.status === "active").length;
      const products = items.reduce((a, s) => a + Number(s.products_count || 0), 0);
      return { total: items.length, active, products };
    },
  };

  window.SuppliersService = Service;
})(window);