/**
 * Lazy Supabase client.
 * Uses the official CDN ESM build so we stay zero-build.
 */
import { loadConfig } from './config.js';

let client = null;
let createClientFn = null;

async function ensureLib() {
  if (createClientFn) return createClientFn;
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  createClientFn = mod.createClient;
  return createClientFn;
}

export async function getSupabase() {
  const cfg = loadConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('Supabase is not configured. Open Settings and add your project URL + anon key.');
  }
  if (client) return client;
  const createClient = await ensureLib();
  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

/** Reset client after config change */
export function resetSupabaseClient() {
  client = null;
}
