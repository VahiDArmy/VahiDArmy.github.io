// ---------------------------------------------------------------------------
// Forgebook configuration
//
// The Supabase key below is a *publishable* key: it is designed to be shipped
// to browsers. It grants nothing on its own — every table is guarded by Row
// Level Security keyed on the signed-in user. Never put a `service_role` key or
// an OpenRouter key in this file.
// ---------------------------------------------------------------------------

export const APP = {
  name: 'Forgebook',
  tagline: 'An AI development workspace where the project stays yours',
  version: '1.0.0',
};

export const SUPABASE_URL = 'https://kehylspimkjheqlsvepd.supabase.co';
export const SUPABASE_KEY = 'sb_publishable__KcpgRwSLxHi3OpcQCghMQ_n_JpfGxI';

export const TABLES = {
  projects: 'fb_projects',
  messages: 'fb_messages',
  memory: 'fb_memory',
  tasks: 'fb_tasks',
  runs: 'fb_runs',
  steps: 'fb_steps',
  checkpoints: 'fb_checkpoints',
  files: 'fb_file_index',
  models: 'fb_models',
  prefs: 'fb_model_prefs',
  settings: 'fb_settings',
};

export const OPENROUTER = {
  base: 'https://openrouter.ai/api/v1',
  modelsUrl: 'https://openrouter.ai/api/v1/models',
  keyStore: 'fb:openrouter-key',
  referer: 'https://forgebook.app',
  title: 'Forgebook',
};

export const LIMITS = {
  maxSteps: 34,             // hard cap on agent turns per run
  runSeconds: 15 * 60,      // wall clock cap per run
  maxToolOutput: 7000,      // chars of tool output fed back to the model
  maxContextChars: 58000,   // prompt budget before sending
  maxFileReadBytes: 600000, // refuse to read larger files into the model
  maxWriteBytes: 400000,
  maxFiles: 6000,
  snapshotBytes: 2000000,   // full checkpoint only under this total size
  heartbeatMs: 15000,
  staleRunMs: 60 * 1000,
  recentMessages: 10,
  retriesPerModel: 2,
  repairAttempts: 1,
};

export const DEFAULT_SETTINGS = {
  defaultModel: '',
  roleModels: { chat: '', plan: '', code: '', review: '' },
  preferFree: true,
  autoSyncModels: true,
  temperature: 0.2,
  maxSteps: LIMITS.maxSteps,
  autoVerify: true,
  showActivity: true,
};

export const MEMORY_SECTIONS = [
  { key: 'overview', label: 'Overview', hint: 'What the project is, who it is for, and what matters most.' },
  { key: 'architecture', label: 'Architecture', hint: 'Structure, key modules, data flow, how it runs.' },
  { key: 'conventions', label: 'Conventions', hint: 'Code style, naming, libraries and patterns to follow.' },
  { key: 'decisions', label: 'Decisions', hint: 'Technical choices already made and why. Do not revisit casually.' },
  { key: 'issues', label: 'Known issues', hint: 'Bugs, gaps and things that are known to be fragile.' },
];

export const SCHEMA_FILE = 'supabase/schema.sql';
