/**
 * Supabase client bootstrap.
 *
 * IMPORTANT — why we use `esm.sh` and `@2` (no pin):
 *  - The older `jsdelivr/@supabase/supabase-js@2.45.4/+esm` build predates
 *    support for the new "publishable" key format (sb_publishable_…).
 *    Passing such a key to that build throws at createClient() time, which
 *    kills the whole ES module graph and leaves the page blank.
 *  - `esm.sh/@supabase/supabase-js@2` resolves to the latest v2, which
 *    supports both legacy `anon` JWT keys and the new publishable keys.
 *
 * SECURITY
 * --------
 *  - Only the anon / publishable key belongs here. It is designed to be
 *    public. It grants nothing beyond what RLS policies allow.
 *  - Never put the service_role key in the browser.
 *  - All tables in supabase-schema.sql have RLS with `auth.uid() = user_id`.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PLACEHOLDER_URL = "https://YOUR-PROJECT.supabase.co";
const PLACEHOLDER_KEY = "YOUR-ANON-KEY";

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
  return { url: PLACEHOLDER_URL, anonKey: PLACEHOLDER_KEY };
}

const { url, anonKey } = resolveCredentials();

export const isConfigured =
  url !== PLACEHOLDER_URL && anonKey !== PLACEHOLDER_KEY;

/* Build the client with defensive error handling — if the construction
 * itself fails (bad URL format, wrong key type, no fetch, etc.) we still
 * export a stub so importing modules don't crash. The app layer checks
 * `isConfigured` and `clientReady` before doing anything auth-related. */

let supabaseClient = null;
let clientError = null;

if (isConfigured) {
  try {
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
    console.error("[supabase] createClient failed:", err);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn("[supabase] not configured — provide window.SUPABASE_CONFIG");
}

export const clientReady = !!supabaseClient;
export const clientErrorMessage = clientError?.message || null;

/* A no-op stub so callers can safely reference the API even if the
 * client failed to construct. All methods reject with a clear message
 * that the UI surfaces via the boot diagnostics overlay. */
const stub = new Proxy(
  {},
  {
    get() {
      const fail = () =>
        Promise.reject(
          clientError ||
            new Error(
              !isConfigured
                ? "Supabase تنظیم نشده است"
                : "اتصال به Supabase برقرار نشد"
            )
        );
      return fail;
    },
  }
);

export const supabase = supabaseClient || {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: () =>
      Promise.reject(
        clientError ||
          new Error("اتصال به سرور احراز هویت برقرار نشد")
      ),
    signUp: () =>
      Promise.reject(
        clientError || new Error("اتصال به سرور احراز هویت برقرار نشد")
      ),
    signOut: () => Promise.resolve({ error: null }),
    resetPasswordForEmail: () =>
      Promise.reject(clientError || new Error("اتصال برقرار نشد")),
    updateUser: () =>
      Promise.reject(clientError || new Error("اتصال برقرار نشد")),
    refreshSession: () =>
      Promise.resolve({ data: { session: null }, error: null }),
  },
  from: () => stub,
  storage: { from: () => stub },
  rpc: () => Promise.reject(clientError || new Error("اتصال برقرار نشد")),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
};

/* Convenience accessors ------------------------------------------------ */

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session ?? null;
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