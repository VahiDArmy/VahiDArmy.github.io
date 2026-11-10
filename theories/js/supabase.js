import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const globalClient = window.supabase;

if (!globalClient) {
  throw new Error("Supabase JS library was not loaded.");
}

export const supabase = globalClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "nazariyeh-auth",
  },
  global: {
    headers: {
      "x-application-name": "nazariyeh-spa",
    },
  },
});

export function isSupabaseReady() {
  return Boolean(supabase);
}
