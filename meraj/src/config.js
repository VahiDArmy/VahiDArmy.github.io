/**
 * معراج · MI'RAJ — application configuration
 * Every value here is public by design. The Supabase key is a publishable key
 * protected by Row Level Security; the OpenRouter key never lives in source.
 */

export const CONFIG = {
  app: {
    name: 'معراج',
    latin: "MI'RAJ",
    tagline: 'The ascent to clearer thought.',
    version: '1.0.0',
    storagePrefix: 'meraj.v1',
    supportNote: 'Free models via OpenRouter · chats stored in Supabase',
  },

  supabase: {
    url: 'https://nvmevqkaovazhmoznusf.supabase.co',
    publishableKey: 'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE',
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },

  openrouter: {
    apiBase: 'https://openrouter.ai/api/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    keyPath: '/key',
    title: "Ma'raj",
    get referer() {
      return typeof location !== 'undefined' ? location.origin : 'https://meraj.app';
    },
  },

  tables: {
    profiles: 'meraj_profiles',
    models: 'meraj_models',
    conversations: 'meraj_conversations',
    messages: 'meraj_messages',
    prompts: 'meraj_prompts',
    events: 'meraj_events',
    schemaStatus: 'meraj_schema_status',
  },

  keys: {
    settings: 'meraj.v1.settings',
    apiKey: 'meraj.v1.openrouter.key',
    apiKeySession: 'meraj.v1.openrouter.key.session',
    draft: 'meraj.v1.draft.',
    sidebarCollapsed: 'meraj.v1.sidebar',
    lastModel: 'meraj.v1.last-model',
    theme: 'meraj.v1.theme',
    setupDismissed: 'meraj.v1.setup-dismissed',
  },

  defaults: {
    model: 'openrouter/free',
    systemPrompt: '',
    theme: 'nocturne',
    accent: 'gold',
    density: 'comfortable',
    fontScale: 1,
    motion: true,
    timestamps: true,
    tokenMeter: true,
    sendWithEnter: true,
    stream: true,
    reasoning: 'off',
    showReasoning: true,
    rememberKey: true,
    requestPreview: true,
    params: {
      temperature: 0.7,
      top_p: 1,
      max_tokens: 2048,
      reasoning: 'off',
    },
  },

  limits: {
    messagesPerConversation: 2000,
    conversations: 300,
    events: 5000,
    modelSyncHours: 12,
    streamPersistIntervalMs: 900,
    titleLength: 64,
    toastMs: 5200,
  },

  setup: {
    sqlPath: 'supabase/schema.sql',
  },
};

/** Model used before the live catalogue arrives. */
export const FALLBACK_MODELS = [
  {
    slug: 'openrouter/free',
    name: 'Free Models Router',
    provider: 'OpenRouter',
    description:
      'Routes each request to a randomly selected free model and reports exactly which model answered.',
    context_length: 200000,
    max_completion_tokens: null,
    architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
    supported_parameters: [
      'temperature',
      'top_p',
      'max_tokens',
      'frequency_penalty',
      'presence_penalty',
      'reasoning',
    ],
    is_default: true,
  },
];

export const THEMES = [
  { id: 'nocturne', name: 'Nocturne', note: 'Indigo night · gilded', swatch: ['#0a0b14', '#e7c27d'] },
  { id: 'mihrab', name: 'Mihrab', note: 'Deep jade · brass', swatch: ['#07110e', '#d8b65f'] },
  { id: 'nebula', name: 'Nebula', note: 'Violet void · rose', swatch: ['#0c0716', '#e6a6c7'] },
  { id: 'dawn', name: 'Dawn', note: 'Warm parchment · clay', swatch: ['#f5eee2', '#a2543a'] },
];

export const ACCENTS = [
  { id: 'gold', name: 'Gold', hex: '#e7c27d' },
  { id: 'jade', name: 'Jade', hex: '#72d6bd' },
  { id: 'rose', name: 'Rose', hex: '#e6a6c7' },
  { id: 'azure', name: 'Azure', hex: '#8fb8ff' },
  { id: 'amber', name: 'Amber', hex: '#f0a35e' },
];
