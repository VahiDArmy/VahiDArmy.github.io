/* ============================================================================
   ORDERS SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const TABLE = "orders";
  const DEMO_KEY = "demo-orders";

  const STATUSES = ["draft", "pending", "confirmed", "shipped", "delivered", "cancelled"];

  const SAMPLE = [
    { customer_name: "شرکت پارس تجارت", customer_id: "cus-1000", amount: 12850000, items_count: 4, status: "delivered", note: "تحویل داده شد", created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
    { customer_name: "علی رضایی", customer_id: "cus-1001", amount: 1850000, items_count: 1, status: "shipped", note: "", created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { customer_name: "فروشگاه افق کوروش", customer_id: "cus-1002", amount: 84200000, items_count: 12, status: "pending", note: "در انتظار تأیید", created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
    { customer_name: "مریم حسینی", customer_id: "cus-1003", amount: 4200000, items_count: 2, status: "confirmed", note: "", created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
    { customer_name: "شرکت گلستان", customer_id: "cus-1004", amount: 45600000, items_count: 8, status: "delivered", note: "", created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
    { customer_name: "رضا محمدی", customer_id: "cus-1005", amount: 1650000, items_count: 1, status: "cancelled", note: "لغو توسط مشتری", created_at: new Date(Date.now() - 86400000 * 6).toISOString() },
    { customer_name: "بانک ملی", customer_id: "cus-1006", amount: 128000000, items_count: 24, status: "confirmed", note: "", created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
    { customer_name: "زهرا کریمی", customer_id: "cus-1007", amount: 28400000, items_count: 5, status: "pending", note: "", created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
    { customer_name: "پخش بهاران", customer_id: "cus-1008", amount: 385000000, items_count: 18, status: "shipped", note: "ارسال با باربری", created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
    { customer_name: "حسین نوری", customer_id: "cus-1009", amount: 8900000, items_count: 3, status: "delivered", note: "", created_at: new Date(Date.now() - 86400000 * 12).toISOString() },
    { customer_name: "شرکت پارس تجارت", customer_id: "cus-1000", amount: 22400000, items_count: 6, status: "draft", note: "", created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
    { customer_name: "علی رضایی", customer_id: "cus-1001", amount: 5600000, items_count: 2, status: "delivered", note: "", created_at: new Date(Date.now() - 86400000 * 16).toISOString() },
  ];

  const seedDemo = () => {
    const existing = Storage.get(DEMO_KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE.map((o, i) => ({
      id: `ord-${1000 + i}`,
      order_number: `ORD-${(2400 + i).toString()}`,
      ...o,
      updated_at: o.created_at,
    }));
    Storage.set(DEMO_KEY, seeded);
    return seeded;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    async list({ page = 1, pageSize = 20, search = "", status = "", customer_id = "", from, to, sortBy = "created_at", sortDir = "desc" } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (search) q = q.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
        if (status) q = q.eq("status", status);
        if (customer_id) q = q.eq("customer_id", customer_id);
        if (from) q = q.gte("created_at", from);
        if (to) q = q.lte("created_at", to);
        q = q.order(sortBy, { ascending: sortDir === "asc" });
        const start = (page - 1) * pageSize;
        q = q.range(start, start + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }

      await delay(150);
      let items = seedDemo();
      if (search) items = Helpers.search(items, search, ["order_number", "customer_name", "note"]);
      if (status) items = items.filter((o) => o.status === status);
      if (customer_id) items = items.filter((o) => o.customer_id === customer_id);
      if (from) items = items.filter((o) => new Date(o.created_at) >= new Date(from));
      if (to) items = items.filter((o) => new Date(o.created_at) <= new Date(to));
      items = Helpers.sortBy(items, (o) => o[sortBy], sortDir);
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
      return seedDemo().find((o) => o.id === id) || null;
    },

    async create(payload) {
      const now = new Date().toISOString();
      const record = {
        ...payload,
        id: payload.id || Helpers.uid("ord"),
        order_number: payload.order_number || Helpers.orderId(),
        status: payload.status || "pending",
        items_count: Number(payload.items_count) || 0,
        amount: Number(payload.amount) || 0,
        created_at: now,
        updated_at: now,
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

    async update(id, patch) {
      const payload = { ...patch, updated_at: new Date().toISOString() };
      if (Supabase.isReady()) {
        const { data, error } = await Supabase.client.from(TABLE).update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data;
      }
      await delay(130);
      const items = seedDemo();
      const i = items.findIndex((o) => o.id === id);
      if (i < 0) throw new Error("سفارش یافت نشد");
      items[i] = { ...items[i], ...payload };
      Storage.set(DEMO_KEY, items);
      return items[i];
    },

    async updateStatus(id, status) {
      if (!STATUSES.includes(status)) throw new Error("وضعیت نامعتبر");
      return this.update(id, { status });
    },

    async remove(id) {
      if (Supabase.isReady()) {
        const { error } = await Supabase.client.from(TABLE).delete().eq("id", id);
        if (error) throw error;
        return true;
      }
      await delay(120);
      Storage.set(DEMO_KEY, seedDemo().filter((o) => o.id !== id));
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
      Storage.set(DEMO_KEY, seedDemo().filter((o) => !ids.includes(o.id)));
      return true;
    },

    async stats() {
      if (Supabase.isReady()) {
        const { data } = await Supabase.client.from(TABLE).select("status,amount,created_at");
        const rows = data || [];
        const total = rows.length;
        const revenue = rows.filter((r) => r.status === "delivered").reduce((a, r) => a + Number(r.amount || 0), 0);
        const pending = rows.filter((r) => r.status === "pending").length;
        const byStatus = STATUSES.reduce((acc, s) => {
          acc[s] = rows.filter((r) => r.status === s).length;
          return acc;
        }, {});
        return { total, revenue, pending, byStatus };
      }
      await delay(120);
      const items = seedDemo();
      const revenue = items.filter((o) => o.status === "delivered").reduce((a, o) => a + Number(o.amount || 0), 0);
      const pending = items.filter((o) => o.status === "pending").length;
      const byStatus = STATUSES.reduce((acc, s) => {
        acc[s] = items.filter((o) => o.status === s).length;
        return acc;
      }, {});
      return { total: items.length, revenue, pending, byStatus };
    },

    async trend(days = 30) {
      await delay(140);
      const items = seedDemo();
      const now = Date.now();
      const buckets = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now - i * 86400000);
        buckets[d.toISOString().slice(0, 10)] = { sales: 0, orders: 0 };
      }
      items.forEach((o) => {
        const k = new Date(o.created_at).toISOString().slice(0, 10);
        if (k in buckets) {
          buckets[k].orders += 1;
          if (o.status === "delivered") buckets[k].sales += Number(o.amount || 0);
        }
      });
      return Object.entries(buckets).map(([date, v]) => ({ date, ...v }));
    },

    async recent(limit = 5) {
      await delay(100);
      const items = seedDemo().slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
      return items;
    },
  };

  window.OrdersService = Service;
})(window);