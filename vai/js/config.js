// ============================================================================
// config.js — constants, endpoint URLs, storage keys, defaults
// ============================================================================

export const SUPABASE_URL = "https://ummhohozmpwltbgeczsf.supabase.co";
export const SUPABASE_KEY = "sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6";

// OpenRouter
export const OPENROUTER_BASE  = "https://openrouter.ai/api/v1";
export const OPENROUTER_CHAT  = `${OPENROUTER_BASE}/chat/completions`;
export const OPENROUTER_MODELS = `${OPENROUTER_BASE}/models`;

// Where the (unavoidable) OpenRouter key lives.  The app is designed so the
// user can paste their own key in Settings and we prefer that one.  If no
// user key is present we fall back to this built-in key.
export const OPENROUTER_DEFAULT_KEY = "";

export const APP_NAME = "معراج";
export const APP_VERSION = "1.0.0";
export const APP_URL =
  (typeof window !== "undefined" && window.location.origin) || "https://localhost";

// localStorage keys
export const LS = {
  theme:        "miraj.theme",
  sidebarOpen:  "miraj.sidebar",
  lastModel:    "miraj.lastModel",
  lastConv:     "miraj.lastConv",
  apiKey:       "miraj.apiKey",
  modelFavs:    "miraj.modelFavs",
  localConvs:   "miraj.localConvs",
  localMsgs:    "miraj.localMsgs",
  modelsCache:  "miraj.modelsCache",
  settings:     "miraj.settings",
  onboarded:    "miraj.onboarded",
};

// Defaults
export const DEFAULTS = {
  theme: "dark",
  model: "openrouter/free",
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  frequency_penalty: 0,
  presence_penalty: 0,
  system_prompt: "",
  stream: true,
  include_reasoning: true,
  history_turns: 40, // how many prior messages to send as context
  model_refresh_ms: 1000 * 60 * 60 * 6, // 6h
  max_models_keep: 500,
};

// Signals to the model wrapper that the special "openrouter/free" id is used.
export const AUTO_FREE_MODEL = "openrouter/free";

// Text used in the modal that shows the exact request body
export const ROLES = {
  user: "کاربر",
  assistant: "دستیار",
  system: "سیستم",
};

export const ROUND_TRUNCATE_STEPS = [
  { at: 0.00, label: "سالم" },
  { at: 0.60, label: "متوسط" },
  { at: 0.80, label: "سنگین" },
  { at: 0.95, label: "اشباع" },
];
