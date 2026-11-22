/**
 * Runtime configuration.
 * Sensitive keys are stored only in localStorage (never committed).
 * Supabase anon key is safe for the browser when RLS is enabled.
 */

const STORAGE_KEY = 'devspace_config';

const defaults = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  openRouterKey: '',
  defaultModel: 'openrouter/free',
  lastProjectId: null,
  confirmWrites: false,  // when true, write/edit require UI confirm
  streamResponses: true,
};

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

export function saveConfig(partial) {
  const next = { ...loadConfig(), ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function isConfigured() {
  const c = loadConfig();
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}

export function hasOpenRouterKey() {
  return Boolean(loadConfig().openRouterKey);
}
