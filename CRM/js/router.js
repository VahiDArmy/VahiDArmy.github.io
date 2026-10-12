/* ============================================================================
   HASH ROUTER
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = window.Dom;
  const C = window.C;
  const Storage = window.Storage;

  const routes = new Map();
  const notFoundHandler = { fn: null, title: "یافت نشد" };
  let current = null;

  const Router = {
    /* ---------- Register ---------- */
    register(path, handler) {
      routes.set(path, handler);
      return this;
    },

    registerAll(map) {
      Object.entries(map).forEach(([path, fn]) => this.register(path, fn));
      return this;
    },

    setNotFound(fn) {
      notFoundHandler.fn = fn;
    },

    /* ---------- Navigate ---------- */
    navigate(path) {
      if (!path.startsWith("#/")) path = "#/" + path.replace(/^#?\/?/, "");
      if (location.hash === path) this.handle();
      else location.hash = path;
    },

    /* ---------- Current ---------- */
    getCurrent() {
      return current;
    },

    parse(hash) {
      const raw = (hash || location.hash || "#/dashboard").replace(/^#\/?/, "");
      const [path, queryStr] = raw.split("?");
      const [base, ...rest] = path.split("/").filter(Boolean);
      const segments = [base || "dashboard", ...rest];
      const query = {};
      if (queryStr) {
        queryStr.split("&").forEach((pair) => {
          const [k, v] = pair.split("=");
          if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || "");
        });
      }
      return { segments, query, path: segments.join("/") };
    },

    /* ---------- Handle route ---------- */
    async handle() {
      const parsed = this.parse();
      const { segments, query } = parsed;
      const key = segments[0] || "dashboard";

      // Store last route
      Storage.set("last-route", key);

      // Hide all pages
      Dom.qa(".page").forEach((p) => {
        if (!p.hidden) {
          p.classList.add("is-leaving");
          setTimeout(() => {
            p.hidden = true;
            p.classList.remove("is-leaving");
          }, 140);
        }
      });

      const show = (pageKey, params = {}) => {
        const page = Dom.qa(`[data-page="${pageKey}"]`)[0];
        if (!page) return false;
        setTimeout(() => {
          page.hidden = false;
          page.classList.remove("is-leaving");
        }, 140);
        return true;
      };

      const handler = routes.get(key);
      if (!handler) {
        show("not-found");
        current = { path: key, params: query };
        document.dispatchEvent(new CustomEvent("route:change", { detail: current }));
        return;
      }

      try {
        current = { path: key, segments, params: query };
        await handler({ page: show, params: query, segments });
        document.dispatchEvent(new CustomEvent("route:change", { detail: current }));
        // Scroll main to top
        const main = Dom.id("main");
        if (main) main.scrollTop = 0;
        window.scrollTo({ top: 0, behavior: "instant" });
      } catch (err) {
        console.error("route handler error:", err);
        window.Toast?.error(err.message || "خطا در بارگذاری صفحه");
        show("not-found");
      }
    },

    /* ---------- Start ---------- */
    start() {
      if (!location.hash) {
        location.hash = "#/dashboard";
      }
      window.addEventListener("hashchange", () => this.handle());
      this.handle();
    },
  };

  window.Router = Router;
})(window);