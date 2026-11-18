// js/config.js
export const SUPABASE_URL = 'https://kehylspimkjheqlsvepd.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable__KcpgRwSLxHi3OpcQCghMQ_n_JpfGxI';

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
export const APP_NAME = 'DevSpace';

export const STORAGE = {
  openrouterKey: 'devspace.openrouter_key',
  lastModelSync: 'devspace.last_model_sync',
  lastProjectId: 'devspace.last_project',
  theme: 'devspace.theme',
};

export const FS_SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.cache',
  'coverage', '.turbo', '.vercel', 'vendor', '__pycache__',
]);

export const AGENT_LIMITS = {
  maxIterations: 30,
  maxToolResultChars: 12000,
  maxFileReadChars: 20000,
  maxContextChars: 90000,
  modelTimeoutMs: 120000,
  maxRetries: 3,
};
