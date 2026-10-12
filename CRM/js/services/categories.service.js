/* ============================================================================
   CATEGORIES SERVICE
   ============================================================================ */

(function (window) {
  "use strict";

  const Storage = window.Storage;
  const Helpers = window.Helpers;

  const KEY = "demo-categories";

  const DEFAULT_CATEGORIES = [
    { id: "cat-1", name: "الکترونیک", color: "#598eff", icon: "ri-smartphone-line", products_count: 45 },
    { id: "cat-2", name: "لوازم خانگی", color: "#06b6d4", icon: "ri-home-4-line", products_count: 32 },
    { id: "cat-3", name: "پوشاک", color: "#8b5cf6", icon: "ri-t-shirt-line", products_count: 78 },
    { id: "cat-4", name: "خوراکی", color: "#22c55e", icon: "ri-restaurant-line", products_count: 120 },
    { id: "cat-5", name: "ابزار", color: "#f59e0b", icon: "ri-tools-line", products_count: 26 },
    { id: "cat-6", name: "ورزشی", color: "#ec4899", icon: "ri-run-line", products_count: 18 },
    { id: "cat-7", name: "کتاب", color: "#14b8a6", icon: "ri-book-line", products_count: 42 },
    { id: "cat-8", name: "بهداشتی", color: "#ef4444", icon: "ri-heart-pulse-line", products_count: 34 },
  ];

  const seed = () => {
    const existing = Storage.get(KEY);
    if (existing && Array.isArray(existing) && existing.length) return existing;
    Storage.set(KEY, DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const Service = {
    async list() {
      await delay(80);
      return seed();
    },

    async getById(id) {
      await delay(60);
      return seed().find((c) => c.id === id) || null;
    },

    async create(payload) {
      await delay(100);
      const items = seed();
      const record = {
        id: Helpers.uid("cat"),
        color: Helpers.randomColor(),
        icon: "ri-folder-line",
        products_count: 0,
        ...payload,
      };
      items.push(record);
      Storage.set(KEY, items);
      return record;
    },

    async update(id, patch) {
      await delay(90);
      const items = seed();
      const i = items.findIndex((c) => c.id === id);
      if (i < 0) throw new Error("دسته‌بندی یافت نشد");
      items[i] = { ...items[i], ...patch };
      Storage.set(KEY, items);
      return items[i];
    },

    async remove(id) {
      await delay(90);
      Storage.set(KEY, seed().filter((c) => c.id !== id));
      return true;
    },
  };

  window.CategoriesService = Service;
})(window);