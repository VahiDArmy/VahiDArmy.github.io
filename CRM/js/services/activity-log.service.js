/* ============================================================================
   ACTIVITY LOG SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Supabase = window.Supabase;
  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const TABLE = "activity_log";
  const KEY = "demo-activity";
  const MAX_LOCAL = 500;

  const SAMPLE = [
    { action: "create", entity: "product", entity_name: "هدفون بلوتوثی پرو", user: "علی رضایی", user_role: "admin", ip: "192.168.1.10", created_at: new Date(Date.now() - 3600e3 * 1).toISOString() },
    { action: "update", entity: "product", entity_name: "کیبورد مکانیکال RGB", user: "مریم کریمی", user_role: "manager", ip: "192.168.1.22", created_at: new Date(Date.now() - 3600e3 * 2).toISOString() },
    { action: "delete", entity: "order", entity_name: "ORD-2405", user: "رضا محمدی", user_role: "manager", ip: "192.168.1.11", created_at: new Date(Date.now() - 3600e3 * 4).toISOString() },
    { action: "login", entity: "auth", entity_name: "ورود موفق", user: "زهرا احمدی", user_role: "operator", ip: "10.0.0.55", created_at: new Date(Date.now() - 3600e3 * 6).toISOString() },
    { action: "adjust", entity: "inventory", entity_name: "ماوس گیمینگ", user: "علی رضایی", user_role: "admin", ip: "192.168.1.10", created_at: new Date(Date.now() - 3600e3 * 8).toISOString() },
    { action: "transfer", entity: "inventory", entity_name: "یخچال ساید بای ساید", user: "مریم کریمی", user_role: "manager", ip: "192.168.1.22", created_at: new Date(Date.now() - 3600e3 * 12).toISOString() },
    { action: "create", entity: "customer", entity_name: "شرکت پارس تجارت", user: "حسین نوری", user_role: "operator", ip: "192.168.1.45", created_at: new Date(Date.now() - 3600e3 * 18).toISOString() },
    { action: "export", entity: "report", entity_name: "گزارش فروش ماهانه", user: "علی رضایی", user_role: "admin", ip: "192.168.1.10", created_at: new Date(Date.now() - 3600e3 * 24).toISOString() },
    { action: "update", entity: "settings", entity_name: "تنظیمات اعلان‌ها", user: "زهرا احمدی", user_role: "operator", ip: "10.0.0.55", created_at: new Date(Date.now() - 3600e3 * 30).toISOString() },
    { action: "create", entity: "supplier", entity_name: "الکترونیک پارس", user: "علی رضایی", user_role: "admin", ip: "192.168.1.10", created_at: new Date(Date.now() - 3600e3 * 36).toISOString() },
  ];

  const seed = () => {
    const existing = Storage.get(KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    const seeded = SAMPLE.map((a, i) => ({ id: `log-${1000 + i}`, ...a }));
    Storage.set(KEY, seeded);
    return seeded;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    async list({ page = 1, pageSize = 30, search = "", action = "", entity = "", user = "" } = {}) {
      if (Supabase.isReady()) {
        let q = Supabase.client.from(TABLE).select("*", { count: "exact" });
        if (action) q = q.eq("action", action);
        if (entity) q = q.eq("entity", entity);
        if (user) q = q.eq("user", user);
        if (search) q = q.or(`entity_name.ilike.%${search}%,user.ilike.%${search}%`);
        q = q.order("created_at", { ascending: false });
        const start = (page - 1) * pageSize;
        q = q.range(start, start + pageSize - 1);
        const { data, error, count } = await q;
        if (error) throw error;
        return { data: data || [], count: count || 0, page, pageSize };
      }

      await delay(120);
      let items = seed();
      if (action) items = items.filter((a) => a.action === action);
      if (entity) items = items.filter((a) => a.entity === entity);
      if (user) items = items.filter((a) => a.user === user);
      if (search) items = Helpers.search(items, search, ["entity_name", "user"]);
      items = Helpers.sortBy(items, (a) => a.created_at, "desc");
      const total = items.length;
      const start = (page - 1) * pageSize;
      return { data: items.slice(start, start + pageSize), count: total, page, pageSize };
    },

    async log(entry) {
      const record = {
        id: Helpers.uid("log"),
        action: entry.action || "create",
        entity: entry.entity || "unknown",
        entity_id: entry.entity_id || null,
        entity_name: entry.entity_name || "",
        user: entry.user || "—",
        user_role: entry.user_role || "—",
        ip: entry.ip || "—",
        meta: entry.meta || null,
        created_at: new Date().toISOString(),
      };

      if (Supabase.isReady()) {
        try {
          const { data, error } = await Supabase.client.from(TABLE).insert(record).select().single();
          if (error) throw error;
          return data;
        } catch (e) {
          console.warn("activity-log write failed:", e);
        }
      }

      const items = seed();
      items.unshift(record);
      Storage.set(KEY, items.slice(0, MAX_LOCAL));
      return record;
    },

    async recent(limit = 10) {
      await delay(100);
      const items = Helpers.sortBy(seed(), (a) => a.created_at, "desc").slice(0, limit);
      return items;
    },

    async stats() {
      await delay(80);
      const items = seed();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayCount = items.filter((a) => new Date(a.created_at) >= today).length;
      return { total: items.length, today: todayCount };
    },

    async clear() {
      Storage.set(KEY, []);
      return true;
    },
  };

  window.ActivityLogService = Service;
})(window);