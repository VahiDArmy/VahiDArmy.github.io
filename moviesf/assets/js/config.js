/* ============================================================================
   FULL METAL CINEMA — config
   Everything the app needs to know about your deployment and its vocabulary.
   ========================================================================== */

export const SUPABASE = {
  // Project values. Dashboard → Project Settings → API.
  url: 'https://ummhohozmpwltbgeczsf.supabase.co',
  anonKey: 'sb_publishable_WcK2pmYMMu61z0KUub5jLA_KSxGpQD6',

  // Optional: a Supabase edge function name used as an AI fallback when the
  // operator has no browser key. Leave empty to disable the path entirely.
  // The local key path in Settings › AI Studio is independent of this.
  edgeAiFunction: '',
};

export const APP = {
  name: 'FULL METAL CINEMA',
  short: 'FMC',
  version: '4.0.0',
  build: '2026.11',
  storagePrefix: 'fmc4.',
  // how many rows per page in library / logs
  pageSize: 60,
  // demo mode seeds a small platoon so the UI is never empty
  demoSeed: true,
};

/* ---------- vocabulary -------------------------------------------------- */
export const CATEGORIES = [
  { id: 'love', label: 'Love', fa: 'عاشقانه', glyph: '♥', hint: 'It moved you. You defend it.' },
  { id: 'good', label: 'Good', fa: 'خوب', glyph: '◆', hint: 'Solid. Recommended without drama.' },
  { id: 'hate', label: 'Hate', fa: 'متنفر', glyph: '✖', hint: 'It wasted your night.' },
];

export const TYPES = [
  { id: 'series', label: 'Series' },
  { id: 'movie', label: 'Movie' },
  { id: 'anime', label: 'Anime' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'short', label: 'Short' },
  { id: 'mini', label: 'Mini-series' },
  { id: 'theatre', label: 'Stage' },
  { id: 'podcast', label: 'Podcast' },
];

export const STATUSES = [
  { id: 'watched', label: 'Watched' },
  { id: 'watching', label: 'Watching' },
  { id: 'paused', label: 'Paused' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'planned', label: 'Planned' },
  { id: 'rewatching', label: 'Rewatching' },
];

export const GENRES = [
  'drama', 'crime', 'thriller', 'war', 'comedy', 'romance', 'sci-fi', 'fantasy',
  'horror', 'mystery', 'action', 'adventure', 'animation', 'biography', 'history',
  'music', 'sport', 'western', 'noir', 'satire', 'psychological', 'slice-of-life',
  'coming-of-age', 'road-movie', 'heist', 'political', 'surreal', 'mockumentary',
];

export const COUNTRIES = [
  'USA', 'UK', 'Iran', 'France', 'Japan', 'South Korea', 'Germany', 'Italy',
  'Spain', 'Denmark', 'Sweden', 'Norway', 'Russia', 'Turkey', 'India', 'China',
  'Brazil', 'Mexico', 'Argentina', 'Poland', 'Czechia', 'Hungary', 'Romania',
  'Canada', 'Australia', 'New Zealand', 'Ireland', 'Belgium', 'Netherlands',
  'Finland', 'Iceland', 'Portugal', 'Greece', 'Israel', 'Lebanon', 'Egypt',
  'Nigeria', 'South Africa', 'Thailand', 'Vietnam', 'Indonesia', 'Philippines',
];

export const MOODS = [
  'focused', 'tired', 'hyped', 'melancholic', 'curious', 'nostalgic',
  'angry', 'cozy', 'restless', 'romantic', 'cynical', 'hopeful',
];

export const DEVICES = ['laptop', 'tv', 'cinema', 'phone', 'tablet', 'projector'];

export const COLLECTION_COLORS = [
  '#d8ff3e', '#ff5f7e', '#58d98a', '#7fe3ff', '#ffb03a',
  '#c08cff', '#ff7a45', '#9aa88a', '#f2f2f2',
];

export const RATING_CRITERIA = [
  { key: 'story', label: 'Story' },
  { key: 'acting', label: 'Acting' },
  { key: 'direction', label: 'Direction' },
  { key: 'visuals', label: 'Visuals' },
  { key: 'sound', label: 'Sound' },
  { key: 'rewatch', label: 'Rewatch' },
];

/* ---------- themes ------------------------------------------------------ */
export const THEMES = [
  { id: 'jungle', label: 'JUNGLE', swatch: 'linear-gradient(135deg,#0b0d0a 45%,#d8ff3e 46%)', scheme: 'dark' },
  { id: 'barracks', label: 'BARRACKS', swatch: 'linear-gradient(135deg,#e9e7dd 45%,#1f2b0c 46%)', scheme: 'light' },
  { id: 'napalm', label: 'NAPALM', swatch: 'linear-gradient(135deg,#0d0907 45%,#ff7a1a 46%)', scheme: 'dark' },
  { id: 'arctic', label: 'ARCTIC', swatch: 'linear-gradient(135deg,#070b10 45%,#7fe3ff 46%)', scheme: 'dark' },
  { id: 'inspection', label: 'INSPECTION', swatch: 'linear-gradient(135deg,#111 45%,#f4f4f4 46%)', scheme: 'dark' },
];

export const ACCENTS = ['#d8ff3e', '#ff5f7e', '#58d98a', '#7fe3ff', '#ffb03a', '#c08cff', '#ff7a45', '#f2f2f2'];

/* ---------- navigation ------------------------------------------------- */
export const NAV = [
  { group: 'ARMOURY' },
  { id: 'library', label: 'Library', glyph: '▤', route: '#/library' },
  { id: 'dossier', label: 'Watched', glyph: '▣', route: '#/library?status=watched' },
  { id: 'watchlist', label: 'Watchlist', glyph: '▢', route: '#/watchlist' },
  { id: 'collections', label: 'Collections', glyph: '❏', route: '#/collections' },
  { id: 'timeline', label: 'Timeline', glyph: '⌇', route: '#/timeline' },

  { group: 'INTEL' },
  { id: 'stats', label: 'Statistics', glyph: '▥', route: '#/stats' },
  { id: 'people', label: 'People', glyph: '☖', route: '#/people' },
  { id: 'activity', label: 'Activity', glyph: '≡', route: '#/activity' },
  { id: 'awards', label: 'Awards', glyph: '✪', route: '#/awards' },

  { group: 'MACHINE' },
  { id: 'studio', label: 'AI Studio', glyph: '✦', route: '#/studio' },
  { id: 'models', label: 'Model Arena', glyph: '⚔', route: '#/arena' },
  { id: 'prompts', label: 'Prompt Rack', glyph: '❝', route: '#/prompts' },

  { group: 'SYSTEM' },
  { id: 'settings', label: 'Settings', glyph: '⚙', route: '#/settings' },
  { id: 'about', label: 'Field Manual', glyph: '?', route: '#/about' },
];

/* ---------- AI providers ----------------------------------------------- */
/* Each provider entry describes how to reach it and how it speaks.
   kind: 'openai' | 'anthropic' | 'ollama' | 'custom'                        */
export const PROVIDERS = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsPath: '/models',
    defaultModel: 'deepseek/deepseek-r1:free',
    keysUrl: 'https://openrouter.ai/keys',
    note: 'One key, hundreds of models. Reasoning models expose their thoughts.',
    reasoning: 'body',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    modelsPath: '/models',
    defaultModel: 'gpt-4o-mini',
    keysUrl: 'https://platform.openai.com/api-keys',
    note: 'Direct OpenAI account. Reasoning via reasoning_effort on o-series.',
    reasoning: 'effort',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelsPath: '/models',
    defaultModel: 'claude-sonnet-4-20250514',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Extended thinking streams its reasoning as thinking_delta events.',
    reasoning: 'budget',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsPath: '/models',
    defaultModel: 'llama-3.3-70b-versatile',
    keysUrl: 'https://console.groq.com/keys',
    note: 'Very fast open models. Great for quick dossier drafts.',
    reasoning: 'none',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'ollama',
    baseUrl: 'http://localhost:11434/v1',
    modelsPath: '/models',
    defaultModel: 'llama3.2',
    keysUrl: 'https://ollama.com/download',
    note: 'Runs on your machine. Key can be anything, or blank.',
    reasoning: 'none',
  },
  {
    id: 'custom',
    label: 'Custom endpoint',
    kind: 'openai',
    baseUrl: '',
    modelsPath: '/models',
    defaultModel: '',
    keysUrl: '',
    note: 'Any OpenAI-compatible base URL: LM Studio, vLLM, a proxy, an edge function.',
    reasoning: 'body',
  },
];

export const DEFAULT_AI = {
  provider: 'openrouter',
  baseUrl: '',
  model: '',
  temperature: 0.7,
  maxTokens: 1800,
  reasoning: false,
  reasoningEffort: 'medium',
  reasoningBudget: 2048,
  streaming: true,
  systemPrompt:
    'You are the archivist of a private cinema collection. You are precise, unsentimental and ' +
    'occasionally funny. Use concrete detail from the dossier you are given. Never invent awards ' +
    'or dates. Answer in the language the operator uses.',
  historyDepth: 8,
  useEdgeFallback: false,
};

export const REASONING_EFFORTS = ['low', 'medium', 'high'];

/* ---------- prompt rack ------------------------------------------------- */
export const SEED_PROMPTS = [
  { name: 'Brutal review', category: 'review', body: 'Write a 250-word review of {{title}} that opens with the single strongest image in it and ends with who should never watch it.' },
  { name: 'Why I hate it', category: 'review', body: 'Argue the case against {{title}} without insulting its audience. Name the exact scene where it lost me.' },
  { name: 'Why I love it', category: 'review', body: 'Defend {{title}} against its three most common criticisms. Be specific about craft.' },
  { name: 'Sequel pitch', category: 'creative', body: 'Pitch a sequel to {{title}} set 12 years later, in three loglines and one poster tagline.' },
  { name: 'Double bill', category: 'recommend', body: 'Pair {{title}} with one film from a different country and decade. Explain the seam between them in 120 words.' },
  { name: 'Find the flaw', category: 'analysis', body: 'Identify the structural weakness of {{title}} and the moment it becomes unavoidable.' },
  { name: 'One location', category: 'creative', body: 'Re-stage {{title}} entirely inside a single room. Keep the plot beats. Write the new opening scene.' },
  { name: 'Standardise dossier', category: 'data', body: 'Return strict JSON with keys genre, country, language, status, year, seasons, summary (max 40 words), story_analysis (max 120 words) for {{title}}.' },
  { name: 'Watch order', category: 'recommend', body: 'Build a 6-title watch order starting from {{title}}, moving outward by tone, not by genre.' },
  { name: 'Name the theme', category: 'analysis', body: 'State the thesis of {{title}} in one sentence, then list three scenes that prove it and one that contradicts it.' },
  { name: 'Fix the ending', category: 'creative', body: 'Rewrite the last five minutes of {{title}} so its theme lands without dialogue.' },
  { name: 'Archive note', category: 'data', body: 'Compress {{title}} into a 60-word archive note: what it is, what it does, whether to keep it.' },
];

/* ---------- demo seed -------------------------------------------------- */
export const DEMO_TITLES = [
  { title: 'Full Metal Jacket', type: 'movie', category: 'love', genre: 'war', year: 1987, rating: 9.4, country: 'USA', language: 'English', status: 'watched', summary: 'A platoon is forged, then spent. The first act is a boot camp; the second is the bill for it.', story_analysis: 'Kubrick splits the film in two so that the second half can audit the first. The rifle is never the subject; the manufacture of a man is.', favorite: true, tags: 'kubrick, vietnam, boot camp', watched_date: '2021-03-12' },
  { title: 'Stalker', type: 'movie', category: 'love', genre: 'sci-fi', year: 1979, rating: 9.6, country: 'Russia', language: 'Russian', status: 'watched', summary: 'Three men walk toward a room that grants wishes. Nobody enters.', story_analysis: 'Tarkovsky films the walk, not the destination, because desire is the only real location.', tags: 'tarkovsky, slow cinema', watched_date: '2020-11-02' },
  { title: 'The Sopranos', type: 'series', category: 'love', genre: 'crime', year: 1999, rating: 9.7, country: 'USA', language: 'English', status: 'watched', seasons: 6, episodes: 86, summary: 'A mob boss takes his mother to therapy and the century takes his industry.', story_analysis: 'The show is about the death of a business model, disguised as a family drama with a psychiatry bill.', tags: 'hbo, antihero', watched_date: '2019-06-20' },
  { title: 'Paris, Texas', type: 'movie', category: 'love', genre: 'drama', year: 1984, rating: 9.1, country: 'Germany', language: 'English', status: 'watched', summary: 'A man walks out of the desert and back into a family he can only describe from behind glass.', story_analysis: 'Wenders uses the road as a confession booth. Red is the only colour that speaks.', tags: 'wenders, road', watched_date: '2022-01-09' },
  { title: 'Chernobyl', type: 'mini', category: 'good', genre: 'history', year: 2019, rating: 9.2, country: 'UK', language: 'English', status: 'watched', seasons: 1, episodes: 5, summary: 'The cost of a lie, measured in roentgen.', story_analysis: 'A procedural about institutional denial where every scientist is a detective of their own government.', tags: 'hbo, disaster' },
  { title: 'Blade Runner 2049', type: 'movie', category: 'good', genre: 'sci-fi', year: 2017, rating: 8.4, country: 'USA', language: 'English', status: 'watched', summary: 'A replicant looks for a miracle and finds an ordinary one.', story_analysis: 'Villeneuve turns the franchise question from "what is human" into "who is allowed to be ordinary".', tags: 'villeneuve, neon' },
  { title: 'The White Lotus', type: 'series', category: 'good', genre: 'satire', year: 2021, rating: 7.9, country: 'USA', language: 'English', status: 'watching', seasons: 3, episodes: 19, summary: 'Rich people on holiday, being slowly audited by the staff.', story_analysis: 'Each season is a murder mystery where the crime is class and the corpse is a courtesy.', tags: 'hbo, satire' },
  { title: 'A Separation', type: 'movie', category: 'love', genre: 'drama', year: 2011, rating: 9.3, country: 'Iran', language: 'Persian', status: 'watched', summary: 'Two families tell the truth in different dialects and the court cannot hear either.', story_analysis: 'Farhadi builds a machine where every character is right and every outcome is wrong.', tags: 'farhadi, iran', favorite: true },
  { title: 'Mad Max: Fury Road', type: 'movie', category: 'love', genre: 'action', year: 2015, rating: 8.9, country: 'Australia', language: 'English', status: 'watched', summary: 'A two-hour chase that is secretly a liberation story told in engine noise.', story_analysis: 'Miller edits on the centre of the frame so the eye never has to guess where the story is.', tags: 'practical effects' },
  { title: 'The Bear', type: 'series', category: 'good', genre: 'drama', year: 2022, rating: 8.6, country: 'USA', language: 'English', status: 'watched', seasons: 3, episodes: 28, summary: 'A kitchen as a grief processing unit.', story_analysis: 'The show uses volume as a character: silence is the only thing anyone is afraid of.', tags: 'fx, kitchen' },
  { title: 'Under the Skin', type: 'movie', category: 'hate', genre: 'surreal', year: 2013, rating: 4.2, country: 'UK', language: 'English', status: 'dropped', summary: 'An alien drives around Scotland. The film is the windshield.', story_analysis: 'Glazer withholds the only thing that would make it a story and calls the withholding the point.', tags: 'slow, alien', notes: 'Turned it off at 52 minutes. Twice.' },
  { title: 'Tenet', type: 'movie', category: 'hate', genre: 'thriller', year: 2020, rating: 5.1, country: 'USA', language: 'English', status: 'watched', summary: 'A plot delivered backwards through a wall of exposition.', story_analysis: 'The mechanism is genuinely new; the emotional register is a man reading a manual aloud.', tags: 'nolan, time' },
  { title: 'Neon Genesis Evangelion', type: 'anime', category: 'love', genre: 'psychological', year: 1995, rating: 9.0, country: 'Japan', language: 'Japanese', status: 'watched', seasons: 1, episodes: 26, summary: 'Teenagers in biomechanical bodies, and the therapy session the whole genre needed.', story_analysis: 'Anno converts the mecha frame into a confession; the final two episodes are the only honest ending.', tags: 'anno, mecha' },
  { title: 'Fleabag', type: 'series', category: 'love', genre: 'comedy', year: 2016, rating: 9.2, country: 'UK', language: 'English', status: 'watched', seasons: 2, episodes: 12, summary: 'A woman narrates her own destruction directly to you, until she stops.', story_analysis: 'The camera address is the character\'s only intimacy; season two removes it as punishment.', tags: 'bbc, fourth wall' },
  { title: 'Sicario', type: 'movie', category: 'good', genre: 'crime', year: 2015, rating: 8.0, country: 'USA', language: 'English', status: 'watched', summary: 'A raid on the idea of the rule of law, shot in dusk.', story_analysis: 'Villeneuve makes the audience complicit by refusing to show the file that authorises everything.', tags: 'denis, border' },
  { title: 'Spirited Away', type: 'anime', category: 'love', genre: 'fantasy', year: 2001, rating: 9.1, country: 'Japan', language: 'Japanese', status: 'watched', summary: 'A girl loses her name and works it back, one bath at a time.', story_analysis: 'Miyazaki treats labour as magic: every gift is a debt, every debt is a self.', tags: 'ghibli', favorite: true },
  { title: 'The Rehearsal', type: 'series', category: 'good', genre: 'mockumentary', year: 2022, rating: 8.1, country: 'USA', language: 'English', status: 'watching', seasons: 2, episodes: 12, summary: 'A man builds a world to practise being a person in it.', story_analysis: 'Fielder escalates until the format eats its author and the ethics become the plot.', tags: 'hbo, cringe' },
  { title: 'Seven Samurai', type: 'movie', category: 'love', genre: 'adventure', year: 1954, rating: 9.5, country: 'Japan', language: 'Japanese', status: 'watched', summary: 'Seven men are hired to die for a village that will not remember them.', story_analysis: 'Kurosawa defines the team-assembly template and then spends the last hour refuting it.', tags: 'kurosawa, classic' },
];

export const DEMO_NOTES = [
  ['Where is the film?', 'Notes on the empty room in Stalker and why the camera refuses to enter it.'],
  ['The bill for the first act', 'Boot camp as a manufacturing process. Pyle is the product and the warning.'],
  ['Kitchen volume', 'The Bear uses sound mixing as a substitute for dialogue in every argument.'],
];
