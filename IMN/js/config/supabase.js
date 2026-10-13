/**
 * Supabase client bootstrap with parallel multi-CDN fallback.
 *
 * NETWORK NOTES (why this file changed)
 * -------------------------------------
 * In Iran (and behind some corporate networks) jsdelivr / esm.sh can
 * resolve DNS but never answer TCP, so `await import()` hangs *forever*
 * instead of throwing. That's what caused the 8-second watchdog: we were
 * waiting for a request that would never come back.
 *
 * Fix:
 *   • Import from ALL CDNs in parallel using `Promise.any()`.
 *   • Race against a hard 6-second timeout so the module graph always
 *     resolves (either with a working client or with a captured error).
 *   • Never throw out of this module — always export a usable `supabase`
 *     object (real client or a safe stub) so consumers keep working and
 *     the app can display a proper diagnostic.
 *
 * SECURITY
 * --------
 * The publishable key below is SAFE to ship to the browser. It grants
 * nothing beyond what Row Level Security (RLS) policies allow. Never put
 * the service_role key in the browser.
 */

/* ---------- 1. Credentials ------------------------------------------- */
const SUPABASE_URL = "https://zzwctmqfxxnsxkumddvi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qzd7iXR5WYwIL-q1a9Gcfg_ZjYTlttz";

/* Allow override from window.__SUPABASE__ / window.SUPABASE_CONFIG */
function resolveCredentials() {
  if (typeof window !== "undefined" && window.__SUPABASE__) {
    const g = window.__SUPABASE__;
    if (g.url && (g.anonKey || g.key)) return { url: g.url, anonKey: g.anonKey || g.key };
  }
  if (typeof window !== "undefined" && window.SUPABASE_CONFIG) {
    const c = window.SUPABASE_CONFIG;
    if (c.url && (c.anonKey || c.key)) return { url: c.url, anonKey: c.anonKey || c.key };
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

const { url, anonKey } = resolveCredentials();

export const isConfigured =
  !!url &&
  !!anonKey &&
  !url.includes("YOUR-PROJECT") &&
  !String(anonKey).includes("YOUR-ANON-KEY");

/* ---------- 2. Progress reporting ------------------------------------ */
function report(msg) {
  try { window.__appBootProgress?.(msg); } catch {}
  // eslint-disable-next-line no-console
  console.info("[supabase]", msg);
}

/* ---------- 3. Hard-timeout helper ----------------------------------- */
function withTimeout(promise, ms, message) {
  let to;
  const timeout = new Promise((_, reject) => {
    to = setTimeout(() => {
      const e = new Error(message);
      e.code = "TIMEOUT";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(to));
}

/* ---------- 4. Parallel multi-CDN SDK loader ------------------------- */
const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  "https://esm.sh/@supabase/supabase-js@2",
  "https://unpkg.com/@supabase/supabase-js@2/+esm",
];

async function loadSdkFromCDNs() {
  // Prefer a UMD/global build if one happens to be present
  if (typeof window !== "undefined" && window.supabase?.createClient) {
    report("استفاده از کتابخانه Supabase موجود در صفحه");
    return window.supabase.createClient;
  }

  report("در حال دریافت کتابخانه Supabase از CDN…");

  // Kick off every CDN at once. First successful one wins.
  const attempts = CDN_URLS.map(async (cdnUrl) => {
    const started = Date.now();
    const mod = await import(/* @vite-ignore */ cdnUrl);
    const fn = mod?.createClient || mod?.default?.createClient;
    if (typeof fn !== "function") {
      throw new Error(`createClient export یافت نشد در ${cdnUrl}`);
    }
    // eslint-disable-next-line no-console
    console.info("[supabase] loaded from", cdnUrl, "in", Date.now() - started, "ms");
    return fn;
  });

  try {
    return await withTimeout(
      Promise.any(attempts),
      8000,
      "هیچ‌کدام از CDN ها در ۸ ثانیه پاسخ ندادند"
    );
  } catch (err) {
    // Promise.any throws AggregateError with .errors array
    const details =
      err?.errors && Array.isArray(err.errors)
        ? err.errors.map((e) => `• ${e.message || e}`).join("\n")
        : err?.message || String(err);
    const e = new Error("بارگذاری کتابخانه Supabase ناموفق بود:\n" + details);
    e.code = "SDK_LOAD_FAILED";
    throw e;
  }
}

/* ---------- 5. Build the client (never throw) ------------------------- */
let supabaseClient = null;
let clientError = null;

if (isConfigured) {
  try {
    const createClient = await loadSdkFromCDNs();
    report("در حال ساخت کلاینت Supabase…");
    supabaseClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "activity-tracker.auth",
        flowType: "pkce",
      },
      global: {
        headers: { "x-application-name": "activity-tracker" },
      },
    });
    report("اتصال Supabase آماده است");
  } catch (err) {
    clientError = err;
    // eslint-disable-next-line no-console
    console.error("[supabase] client init failed:", err);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn("[supabase] not configured — provide window.SUPABASE_CONFIG");
}

export const clientReady = !!supabaseClient;
export const clientErrorMessage = clientError?.message || null;

/* ---------- 6. Safe stub so consumers never crash -------------------- */
const rejectingStub = () =>
  Promise.reject(
    clientError ||
      new Error(
        !isConfigured
          ? "Supabase تنظیم نشده است"
          : "اتصال به Supabase برقرار نشد"
      )
  );

const tableStub = new Proxy(
  {},
  {
    get() {
      return rejectingStub;
    },
  }
);

export const supabase = supabaseClient || {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe() {} } },
    }),
    signInWithPassword: rejectingStub,
    signUp: rejectingStub,
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: rejectingStub,
    updateUser: rejectingStub,
    refreshSession: () =>
      Promise.resolve({ data: { session: null }, error: null }),
  },
  from: () => tableStub,
  storage: { from: () => tableStub },
  rpc: rejectingStub,
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
};

/* ---------- 7. Convenience accessors --------------------------------- */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("AUTH_REQUIRED");
    err.code = "AUTH_REQUIRED";
    throw err;
  }
  return user;
}