/**
 * FULL METAL CINEMA — domain types.
 *
 * One block per table in `schema (2).sql`. Column names are kept identical to
 * the Postgres schema so the local store, the SQL export and the data lab all
 * speak the same language. Fields marked LOCAL are client-only additions that
 * the provided schema has no column for (AI request archives, streaming state).
 */

export type ISODate = string;
export type UUID = string;

export type Category = 'love' | 'good' | 'hate';
export type TitleStatus = 'watched' | 'watching' | 'queued' | 'abandoned' | 'unknown';
export type MediaType = 'film' | 'series' | 'mini' | 'documentary' | 'animation' | 'short' | 'special';

export interface BaseRow {
  id: UUID;
  created_at: ISODate;
  updated_at: ISODate;
  user_id?: UUID | null;
}

/* ── cinema_titles ─────────────────────────────────────────────────────── */

export interface Title extends BaseRow {
  legacy_id?: number | null;
  title: string;
  original_title: string;
  category: Category;
  type: MediaType | string;
  genre: string;
  tags: string;
  year: number | null;
  rating: number;
  favorite: boolean;
  notes: string;
  watched_date: string | null;
  summary: string;
  seasons: number | null;
  episodes: number | null;
  episodes_per_season: number | null;
  country: string;
  language: string;
  status: TitleStatus | string;
  reason: string;
  story_analysis: string;
  ai_standardized_at: ISODate | null;
  source: string;
  poster_url: string;
  backdrop_url: string;
  trailer_url: string;
  runtime: number | null;
}

/* ── cinema_activity ───────────────────────────────────────────────────── */

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'rated'
  | 'watched'
  | 'ai'
  | 'imported'
  | 'shared'
  | string;

export interface Activity extends BaseRow {
  action: ActivityAction;
  entity: string | null;
  entity_id: UUID | null;
  detail: string | null;
}

/* ── cinema_meta ───────────────────────────────────────────────────────── */

export interface MetaRow {
  k: string;
  v: string | null;
  user_id?: UUID | null;
}

/* ── cinema_conversations ──────────────────────────────────────────────── */

export interface Conversation extends BaseRow {
  title_id: UUID | null;
  title_context: string;
  prompt: string;
  response: string;
  ai_model: string;
  tags: string;
}

/* ── cinema_ai_models ──────────────────────────────────────────────────── */

export interface AiModelRow extends BaseRow {
  id: string;
  label: string;
  vendor: string;
  size: string;
  context: string;
  speed: string;
  note: string;
  tags: string;
  recommended: boolean;
  best_for: string;
  is_free: boolean;
  source: string;
  fetched_at: ISODate | null;
  provider: string;
  active: boolean;
  wins: number;
  losses: number;
  last_tried_at: ISODate | null;
  user_rating: number;
}

export interface DeletedModelRow {
  id: string;
  deleted_at: ISODate;
}

/* ── cinema_collections + items ────────────────────────────────────────── */

export interface Collection extends BaseRow {
  name: string;
  description: string;
  color: string;
  icon: string;
  is_public: boolean;
  sort_order: number;
}

export interface CollectionItem extends BaseRow {
  collection_id: UUID;
  title_id: UUID;
  position: number;
  note: string;
}

/* ── cinema_ratings ────────────────────────────────────────────────────── */

export interface Rating extends BaseRow {
  title_id: UUID;
  story: number;
  acting: number;
  direction: number;
  visuals: number;
  sound: number;
  rewatch: number;
  review: string;
  spoiler: boolean;
}

/* ── cinema_watchlist ──────────────────────────────────────────────────── */

export interface WatchlistItem extends BaseRow {
  title_id: UUID;
  priority: number;
  note: string;
  target_date: string | null;
  done: boolean;
}

/* ── cinema_watch_sessions ─────────────────────────────────────────────── */

export interface WatchSession extends BaseRow {
  title_id: UUID;
  season: number | null;
  episode: number | null;
  minutes: number;
  mood: string;
  device: string;
  note: string;
  watched_at: ISODate;
}

/* ── cinema_people + credits ───────────────────────────────────────────── */

export interface Person extends BaseRow {
  name: string;
  role: string;
  country: string;
  birth_year: number | null;
  notes: string;
  following: boolean;
}

export interface Credit extends BaseRow {
  title_id: UUID;
  person_id: UUID;
  role: string;
  character: string;
  billing: number | null;
}

/* ── cinema_quotes + trivia ────────────────────────────────────────────── */

export interface Quote extends BaseRow {
  title_id: UUID;
  text: string;
  speaker: string;
  at_minute: number | null;
  favorite: boolean;
}

export interface Trivia extends BaseRow {
  title_id: UUID;
  content: string;
  source: string;
}

/* ── cinema_relationships ──────────────────────────────────────────────── */

export interface Relationship extends BaseRow {
  title_id: UUID;
  related_title_id: UUID;
  kind: string;
  weight: number;
}

/* ── cinema_goals ──────────────────────────────────────────────────────── */

export interface Goal extends BaseRow {
  year: number;
  target_titles: number;
  target_minutes: number;
  target_rating_avg: number | null;
  progress: number;
}

/* ── cinema_challenges ─────────────────────────────────────────────────── */

export type ChallengeStatus = 'active' | 'done' | 'abandoned';

export interface Challenge extends BaseRow {
  name: string;
  description: string;
  rule: Record<string, unknown>;
  progress: number;
  target: number;
  status: ChallengeStatus;
}

/* ── cinema_events ─────────────────────────────────────────────────────── */

export interface CinemaEvent extends BaseRow {
  title_id: UUID | null;
  kind: string;
  starts_at: ISODate;
  location: string;
  note: string;
}

/* ── cinema_prompts ────────────────────────────────────────────────────── */

export interface PromptTemplate extends BaseRow {
  name: string;
  body: string;
  category: string;
  variables: string;
  use_count: number;
}

/* ── cinema_ai_usage ───────────────────────────────────────────────────── */

export interface AiUsageRow extends BaseRow {
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  ok: boolean;
  reasoning: boolean;
  error: string;
}

/* ── cinema_awards ─────────────────────────────────────────────────────── */

export interface Award extends BaseRow {
  title_id: UUID | null;
  body: string;
  category: string;
  year: number | null;
  won: boolean;
  note: string;
}

/* ── cinema_shares ─────────────────────────────────────────────────────── */

export interface Share extends BaseRow {
  title_id: UUID | null;
  slug: string;
  expires_at: ISODate | null;
  views: number;
}

/* ── cinema_import_batches ─────────────────────────────────────────────── */

export interface ImportBatch extends BaseRow {
  source: string;
  count: number;
  status: string;
  payload_summary: string;
}

/* ── cinema_mizan_notes ────────────────────────────────────────────────── */

export interface MizanNote extends BaseRow {
  content_id: number;
  title_id: UUID | null;
  anchor_before: string;
  anchor_selected: string;
  anchor_after: string;
  note_text: string;
}

/* ── cinema_saved_views ────────────────────────────────────────────────── */

export interface SavedView extends BaseRow {
  name: string;
  route: string;
  icon: string;
  pin: boolean;
}

/* ── LOCAL: AI turn archive ────────────────────────────────────────────── */
/* The provided SQL has no message table: `cinema_conversations` stores a single
 * prompt/response pair. A streaming, resumable, inspectable chat needs one row
 * per turn, so the client keeps its own archive next to the schema tables. */

export type TurnRole = 'user' | 'assistant' | 'system';
export type TurnStatus = 'pending' | 'streaming' | 'complete' | 'stopped' | 'error';

export interface AiThread extends BaseRow {
  title: string;
  title_id: UUID | null;
  model: string;
  system: string;
  params: GenerationParams;
  tags: string;
  pinned: boolean;
  archived: boolean;
  branch_of: UUID | null;
  last_at: ISODate;
}

export interface AiTurn extends BaseRow {
  thread_id: UUID;
  parent_id: UUID | null;
  role: TurnRole;
  content: string;
  reasoning: string;
  status: TurnStatus;
  model: string;
  requested_model: string;
  provider: string | null;
  continue_of: UUID | null;
  usage: TokenUsage | null;
  request: RequestSnapshot | null;
  error: AiError | null;
  meta: TurnMeta | null;
}

export interface AiThreadBundle {
  thread: AiThread;
  turns: AiTurn[];
  active_leaf: UUID | null;
}

/* ── AI transport types ────────────────────────────────────────────────── */

export type ProviderId = 'openrouter' | 'openai-compatible';

export interface GenerationParams {
  temperature: number;
  top_p: number;
  max_tokens: number | 'auto';
  frequency_penalty: number;
  presence_penalty: number;
  stream: boolean;
  reasoning: boolean;
  seed: number | null;
}

export const DEFAULT_PARAMS: GenerationParams = {
  temperature: 0.75,
  top_p: 1,
  max_tokens: 'auto',
  frequency_penalty: 0,
  presence_penalty: 0,
  stream: true,
  reasoning: true,
  seed: null,
};

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated?: boolean;
  cost?: number | null;
}

export interface RequestMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface RequestSnapshot {
  id: string;
  url: string;
  model: string;
  body: Record<string, unknown>;
  bodyText: string;
  headers: Record<string, string>;
  createdAt: ISODate;
  messageCount: number;
  estimatedInputTokens: number;
  autoMaxTokens: boolean;
  maxTokens: number | null;
  truncatedHistory: number;
  fingerprint: string;
}

export interface TurnMeta {
  started_at: ISODate;
  completed_at?: ISODate;
  latency_ms?: number;
  model?: string;
  provider?: string | null;
  generation_id?: string | null;
  finish_reason?: string | null;
  http_status?: number | null;
  mode?: string;
  aborted?: boolean;
  empty?: boolean;
}

export interface AiError {
  kind:
    | 'configuration'
    | 'network'
    | 'http'
    | 'stream'
    | 'provider'
    | 'shape'
    | 'empty'
    | 'client'
    | 'storage';
  name?: string;
  message: string;
  status?: number | null;
  statusText?: string | null;
  bodyText?: string;
  parsed?: unknown;
  url?: string;
  requestId?: string | null;
  provider?: string | null;
  headers?: Record<string, string>;
  latencyMs?: number | null;
  rawEvent?: string | null;
  finish_reason?: string | null;
  usage?: TokenUsage | null;
  at: ISODate;
}

export interface StreamCallbacks {
  onDelta?: (delta: string, full: string) => void;
  onReasoning?: (delta: string, full: string) => void;
  onMeta?: (meta: Partial<TurnMeta> & { usage?: TokenUsage | null }) => void;
  onEvent?: (event: StreamEvent) => void;
}

export interface StreamEvent {
  at: ISODate;
  kind: 'open' | 'delta' | 'reasoning' | 'meta' | 'done' | 'error' | 'abort';
  label: string;
  detail?: string;
}

export interface StreamResult {
  content: string;
  reasoning: string;
  model: string | null;
  provider: string | null;
  generationId: string | null;
  usage: TokenUsage | null;
  finishReason: string | null;
  latencyMs: number;
  headers: Record<string, string>;
  empty: boolean;
  mode: 'stream' | 'json';
  eventCount: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
  contextLength: number | null;
  maxCompletionTokens: number | null;
  description: string;
  isFree: boolean;
  supportsReasoning: boolean;
  supportsParams: string[];
  pricingPrompt: number | null;
  pricingCompletion: number | null;
  modality: string;
  fetchedAt?: ISODate;
}

/* ── Local store shape ─────────────────────────────────────────────────── */

export interface DatabaseShape {
  cinema_titles: Title[];
  cinema_activity: Activity[];
  cinema_meta: MetaRow[];
  cinema_conversations: Conversation[];
  cinema_ai_models: AiModelRow[];
  cinema_ai_models_deleted: DeletedModelRow[];
  cinema_collections: Collection[];
  cinema_collection_items: CollectionItem[];
  cinema_ratings: Rating[];
  cinema_watchlist: WatchlistItem[];
  cinema_watch_sessions: WatchSession[];
  cinema_people: Person[];
  cinema_credits: Credit[];
  cinema_quotes: Quote[];
  cinema_trivia: Trivia[];
  cinema_relationships: Relationship[];
  cinema_goals: Goal[];
  cinema_challenges: Challenge[];
  cinema_events: CinemaEvent[];
  cinema_prompts: PromptTemplate[];
  cinema_ai_usage: AiUsageRow[];
  cinema_awards: Award[];
  cinema_shares: Share[];
  cinema_import_batches: ImportBatch[];
  cinema_mizan_notes: MizanNote[];
  cinema_saved_views: SavedView[];
  cinema_ai_threads: AiThread[];
  cinema_ai_turns: AiTurn[];
}

export type TableName = keyof DatabaseShape;

export const SCHEMA_TABLES: TableName[] = [
  'cinema_titles',
  'cinema_activity',
  'cinema_meta',
  'cinema_conversations',
  'cinema_ai_models',
  'cinema_ai_models_deleted',
  'cinema_collections',
  'cinema_collection_items',
  'cinema_ratings',
  'cinema_watchlist',
  'cinema_watch_sessions',
  'cinema_people',
  'cinema_credits',
  'cinema_quotes',
  'cinema_trivia',
  'cinema_relationships',
  'cinema_goals',
  'cinema_challenges',
  'cinema_events',
  'cinema_prompts',
  'cinema_ai_usage',
  'cinema_awards',
  'cinema_shares',
  'cinema_import_batches',
  'cinema_mizan_notes',
  'cinema_saved_views',
];

export const LOCAL_TABLES: TableName[] = ['cinema_ai_threads', 'cinema_ai_turns'];

/* ── UI-facing types ───────────────────────────────────────────────────── */

export type RouteId =
  | 'dashboard'
  | 'library'
  | 'title'
  | 'collections'
  | 'ratings'
  | 'watchlist'
  | 'sessions'
  | 'people'
  | 'quotes'
  | 'constellation'
  | 'goals'
  | 'challenges'
  | 'events'
  | 'awards'
  | 'prompts'
  | 'studio'
  | 'arena'
  | 'usage'
  | 'shares'
  | 'imports'
  | 'notes'
  | 'data'
  | 'settings';

export interface RouteState {
  id: RouteId;
  param?: string;
  query?: string;
}

export interface FilterState {
  search: string;
  category: 'all' | Category;
  type: 'all' | string;
  status: 'all' | string;
  tag: string | null;
  minRating: number;
  yearFrom: number | null;
  yearTo: number | null;
  favoriteOnly: boolean;
  sort: 'recent' | 'title' | 'rating' | 'year' | 'year-asc' | 'runtime';
  view: 'grid' | 'table' | 'wall';
}

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
  duration?: number;
}

export interface AiActionContext {
  titles: Title[];
  ratings: Rating[];
  sessions: WatchSession[];
  collections: Collection[];
  quotes: Quote[];
  people: Person[];
  credits: Credit[];
  watchlist: WatchlistItem[];
  goals: Goal[];
  challenges: Challenge[];
  focus?: Title;
}

export interface AiAction {
  id: string;
  label: string;
  hint: string;
  group: 'analysis' | 'writing' | 'curation' | 'metadata' | 'arena';
  icon: string;
  expectsJson: boolean;
  system: string;
  user: (ctx: AiActionContext) => string;
}
