/* ============================================================================
   SUPABASE CLIENT
   ============================================================================ */

(function (window) {
  "use strict";

  const env = window.ENV || {};

  const isConfigured =
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    !env.SUPABASE_URL.includes("YOUR-PROJECT") &&
    !env.SUPABASE_ANON_KEY.includes("YOUR-PUBLIC");

  let client = null;
  let initError = null;

  try {
    if (isConfigured && window.supabase && typeof window.supabase.createClient === "function") {
      client = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "crm:sb-auth",
          flowType: "pkce",
        },
        global: {
          headers: {
            "x-application-name": env.APP_SHORT_NAME || "crm-inventory",
          },
        },
        realtime: {
          params: { eventsPerSecond: 5 },
        },
      });
    }
  } catch (err) {
    initError = err;
    console.error("[supabase] init failed:", err);
  }

  const Supabase = {
    client,

    isReady() {
      return !!client;
    },

    isConfigured() {
      return isConfigured;
    },

    get error() {
      return initError;
    },

    /** Health-check: تست دسترسی به دیتابیس */
    async ping() {
      if (!client) return { ok: false, reason: "not-configured" };
      try {
        const { error } = await client
          .from("products")
          .select("id", { head: true, count: "exact" })
          .limit(1);
        if (error && error.code !== "PGRST116") throw error;
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: e.message || "error" };
      }
    },

    /** Subscribe to table changes */
    subscribe(table, callback) {
      if (!client || !window.ENV?.FEATURES?.REALTIME) return null;
      try {
        return client
          .channel(`realtime:${table}`)
          .on("postgres_changes", { event: "*", schema: "public", table }, callback)
          .subscribe();
      } catch (e) {
        console.warn("[supabase] realtime subscribe failed:", e);
        return null;
      }
    },

    unsubscribe(channel) {
      if (channel && client) {
        try { client.removeChannel(channel); } catch (_) {}
      }
    },
  };

  window.Supabase = Supabase;

  /* ---------- Global warn ---------- */
  if (!isConfigured) {
    console.warn(
      "[CRM] Supabase is not configured. Running in offline/demo mode.\n" +
      "Edit js/config/env.js and set SUPABASE_URL and SUPABASE_ANON_KEY."
    );
  }
})(window);