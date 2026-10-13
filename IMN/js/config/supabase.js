/**
 * Supabase client bootstrap with multi-CDN fallback.
 *
 * CREDENTIALS
 * -----------
 * The URL and publishable key below are SAFE to ship to the browser.
 * The publishable key (sb_publishable_…) is designed to be public and
 * grants nothing beyond what Row Level Security (RLS) policies allow.
 * Never replace this with the service_role key.
 *
 * All tables in supabase-schema.sql have RLS enabled with
 * `auth.uid() = user_id` policies — anonymous requests are rejected and
 * authenticated users can only see/change their own rows.
 *
 * WHY THE MULTI-CDN LOADER
 * ------------------------
 * Static `import` of a CDN in an ES module fails the whole module graph
 * if the CDN is blocked/slow, which produces a blank page. We use
 * `await import()` inside a try/catch, trying several CDNs in order, so
 * a single CDN being unreachable does not break the app.
 */

/* ---------- 1. Credentials ------------------------------------------- */
const SUPABASE_URL = "https://zzwctmqfxxnsxkumddvi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qzd7iXR5WYwIL-q1a9Gcfg_ZjYTlttz";

/* Allow overriding from window.__SUPABASE__ or window.SUPABASE_CONFIG
 * (useful if you later want a different env per-deploy) — otherwise use
 * the constants above. */
function resolveCredentials() {
  if (typeof window !== "undefined" && window.__SUPABASE__) {
    const g = window.__SUPABASE__;
    if (g.url && (g.anonKey || g.key)) {
      return { url: g.url, anonKey: g.anonKey || g.key };
    }
  }
  if (typeof window !== "undefined" && window.SUPABASE_CONFIG) {
    const c = window.SUPABASE_CONFIG;
    if (c.url && (c.anonKey || c.key)) {
      return { url: c.url, anonKey: c.anonKey || c.key };
    }
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

const { url, anonKey } = resolveCredentials();

export const isConfigured =
  !!url &&
  !!anonKey &&
  !url.includes("YOUR-PROJECT") &&
  !String(anonKey).includes("YOUR-ANON-KEY");

/* ---------- 2. Load the SDK from a list of CDNs ---------------------- */
const CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
  "https://esm.sh/@supabase/supabase-js@2",
  "https://unpkg.com/@supabase/supabase-js@2/+esm",
];

async function loadSdkFromCDNs() {
  // Prefer a UMD/global build if one happens to be present
  if (typeof window !== "undefined" && window.supabase?.createClient) {
    return window.supabase.createClient;
  }

  const errors = [];
  for (const cdnUrl of CDN_URLS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const mod = await import(/* @vite-ignore */ cdnUrl);
      const fn = mod?.createClient || mod?.default?.createClient;
      if (typeof fn === "function") return fn;
      errors.push(`${cdnUrl}: createClient export missing`);
    } catch (err) {
      errors.push(`${cdnUrl}: ${err?.message || err}`);
      // eslint-disable-next-line no-console
      console.warn("[supabase] CDN failed:", cdnUrl, err?.message);
    }
  }
  const e = new Error(
    "بارگذاری کتابخانه Supabase از همه CDN ها ناموفق بود.\n" + errors.join("\n")
  );
  e.code = "SDK_LOAD_FAILED";
  throw e;
}

/* ---------- 3. Build the client (never throw) ------------------------- */
let supabaseClient = null;
let clientError = null;

if (isConfigured) {
  try {
    if (typeof window !== "undefined" && window.__appBootProgress) {
      window.__appBootProgress("در حال اتصال به Supabase…");
    }
    const createClient = await loadSdkFromCDNs();
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

/* ---------- 4. Safe stub so consumers never crash -------------------- */
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

/* ---------- 5. Convenience accessors --------------------------------- */
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