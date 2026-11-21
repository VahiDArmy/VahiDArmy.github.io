// Central configuration. Override with Vite env vars when you fork this app.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ummhohozmpwltbgeczsf.supabase.co';

// Supabase "publishable" key — safe for the browser; every table is guarded by RLS.
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6';

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
export const CHAT_ENDPOINT = `${OPENROUTER_URL}/chat/completions`;
export const MODELS_ENDPOINT = `${OPENROUTER_URL}/models`;

/** OpenRouter's free auto-router. Returns the concrete model in the response. */
export const AUTO_MODEL = 'openrouter/free';

export const TABLE = {
  profiles: 'fbai_profiles',
  conversations: 'fbai_conversations',
  messages: 'fbai_messages',
  models: 'fbai_models',
  prompts: 'fbai_prompts',
};

export const DEFAULT_SYSTEM_PROMPT =
  'You are Nebula, a precise, thoughtful AI assistant. Answer directly and accurately. ' +
  'Use clean Markdown for structure and fenced code blocks with language tags for code. ' +
  'Match the language the user writes in (English, Persian/Farsi, or mixed) and respect their intent. ' +
  'When you are unsure, say so plainly instead of inventing details.';

export const DEFAULT_SETTINGS = {
  theme: 'nebula',
  locale: 'en',
  fontScale: 1,
  reduceMotion: false,
  compact: false,

  temperature: 0.7,
  topP: 1,
  maxTokens: 2048,
  stream: true,
  reasoningEffort: 'auto',
  showReasoning: true,
  sendOnEnter: true,
  autoTitle: true,
  keepRawRequest: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  defaultModel: AUTO_MODEL,
  lockAutoModel: true,
};

export const LS = {
  leaves: 'nebula.leaves.v1',
  lastConversation: 'nebula.lastConversation.v1',
  ui: 'nebula.ui.v1',
};
