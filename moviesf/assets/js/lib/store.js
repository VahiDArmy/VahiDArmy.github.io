/* ============================================================================
   FULL METAL CINEMA — store
   app state, preferences, repositories for every cinema_ table,
   and the statistics / recommendation engine that reads only your shelf.
   ========================================================================== */

import { CinemaClient, localStorageSafe as ls } from './client.js';
import { APP, SUPABASE, DEMO_TITLES, DEFAULT_AI } from '../config.js';
import { sortBy, uniq, sum, avg, groupBy, hash, fmtDate } from './dom.js';

/* ---------- preferences -------------------------------------------------- */
const PREF_KEY = `${APP.storagePrefix}prefs`;

const DEFAULT_PREFS = {
  theme: 'jungle',
  accent: '',
  density: 'regular',
  font: 'md',
  contentType: 'cards',
  gridDensity: 'regular',
  locale: 'en',
  ticker: true,
  grain: true,
  scanlines: true,
  pageSize: APP.pageSize,
  showScores: true,
  confirmDelete: true,
  tourTarget: 40,
  tourYear: new Date().getFullYear(),
  sidebarCollapsed: false,
  lastRoute: '#/library',
};

export const state = {
  client: null,
  session: null,
  user: null,
  ready: false,
  tables: {
    titles: [],
    collections: [],
    collectionItems: [],
    watchlist: [],
    ratings: [],
    people: [],
    credits: [],
    quotes: [],
    trivia: [],
    sessions: [],
    goals: [],
    challenges: [],
    events: [],
    prompts: [],
    conversations: [],
    models: [],
    activity: [],
    preferences: null,
    usage: [],
    relationships: [],
    awards: [],
    notes: [],
    shares: [],
    imports: [],
  },
  prefs: { ...DEFAULT_PREFS, ...ls.get(PREF_KEY, {}) },
  ai: { ...DEFAULT_AI, ...ls.get(`${APP.storagePrefix}ai`, {}) },
  ui: {
    filters: {},
    sort: 'recent',
    query: '',
    selection: new Set(),
    studioConversation: null,
  },
  error: null,
};

const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt)?.delete(fn);
}
export function emit(evt, payload) {
  listeners.get(evt)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(`[${evt}]`, e); } });
  listeners.get('*')?.forEach((fn) => fn(evt, payload));
}

export function savePrefs(patch = {}) {
  Object.assign(state.prefs, patch);
  ls.set(PREF_KEY, state.prefs);
  emit('prefs', state.prefs);
}
export function saveAi(patch = {}) {
  Object.assign(state.ai, patch);
  ls.set(`${APP.storagePrefix}ai`, state.ai);
  emit('ai', state.ai);
}

/* ---------- theme ------------------------------------------------------- */
export function applyTheme() {
  const p = state.prefs;
  const root = document.documentElement;
  root.dataset.theme = p.theme || 'jungle';
  root.dataset.density = p.density || 'regular';
  root.dataset.font = p.font || 'md';
  if (p.accent) {
    root.style.setProperty('--accent', p.accent);
    root.style.setProperty('--accent-2', p.accent);
    const rgb = hexToRgb(p.accent);
    if (rgb) root.style.setProperty('--glow', `${rgb.r} ${rgb.g} ${rgb.b}`);
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--glow');
  }
  document.querySelector('.fx-grain')?.style.setProperty('display', p.grain ? '' : 'none');
  document.querySelector('.fx-scan')?.style.setProperty('display', p.scanlines ? '' : 'none');
  const ticker = document.getElementById('ticker');
  if (ticker) ticker.style.display = p.ticker ? '' : 'none';
  const scheme = ['barracks'].includes(p.theme) ? 'light' : 'dark';
  document.documentElement.style.colorScheme = scheme;
}

export function hexToRgb(hex) {
  const m = String(hex || '').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/* ---------- client boot ------------------------------------------------- */
export function bootClient() {
  const c = new CinemaClient({
    url: SUPABASE.url,
    anonKey: SUPABASE.anonKey,
    prefix: APP.storagePrefix,
    edgeAiFunction: SUPABASE.edgeAiFunction,
  });
  state.client = c;
  if (c.isDemo && APP.demoSeed) seedDemo(c);
  return c;
}

function seedDemo(c) {
  const now = Date.now();
  const rows = DEMO_TITLES.map((t, i) => ({
    id: `demo-${i + 1}`,
    created_at: new Date(now - i * 86400000 * 3).toISOString(),
    updated_at: new Date(now - i * 86400000).toISOString(),
    user_id: 'demo-user-0000-0000-0000-000000000001',
    favorite: false,
    seasons: null, episodes: null, notes: '', original_title: '',
    source: 'demo', tags: '',
    ...t,
  }));
  c.seedLocal({
    cinema_titles: rows,
    cinema_collections: [
      { id: 'demo-c1', name: 'Night Shift', description: 'Films for the 2am version of me.', color: '#d8ff3e', icon: '☾', created_at: new Date(now - 86400000 * 30).toISOString(), user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-c2', name: 'Never Again', description: 'Logged so I stop rewatching them.', color: '#ff7a45', icon: '✖', created_at: new Date(now - 86400000 * 12).toISOString(), user_id: 'demo-user-0000-0000-0000-000000000001' },
    ],
    cinema_collection_items: [
      { id: 'demo-ci1', collection_id: 'demo-c1', title_id: 'demo-2', position: 0, user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-ci2', collection_id: 'demo-c1', title_id: 'demo-4', position: 1, user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-ci3', collection_id: 'demo-c2', title_id: 'demo-11', position: 0, user_id: 'demo-user-0000-0000-0000-000000000001' },
    ],
    cinema_watchlist: [
      { id: 'demo-w1', title_id: 'demo-6', priority: 2, done: false, note: '4K disc is on the shelf.', user_id: 'demo-user-0000-0000-0000-000000000001', created_at: new Date(now - 86400000 * 4).toISOString() },
      { id: 'demo-w2', title_id: 'demo-18', priority: 1, done: false, note: '', user_id: 'demo-user-0000-0000-0000-000000000001', created_at: new Date(now - 86400000 * 2).toISOString() },
    ],
    cinema_ratings: [
      { id: 'demo-r1', title_id: 'demo-1', story: 9, acting: 9, direction: 10, visuals: 9, sound: 9, rewatch: 8, review: 'The first act is the whole thesis.', spoiler: false, user_id: 'demo-user-0000-0000-0000-000000000001', created_at: new Date(now - 86400000 * 40).toISOString() },
      { id: 'demo-r2', title_id: 'demo-2', story: 10, acting: 9, direction: 10, visuals: 9, sound: 8, rewatch: 10, review: 'A walk that never ends and should not.', spoiler: false, user_id: 'demo-user-0000-0000-0000-000000000001', created_at: new Date(now - 86400000 * 20).toISOString() },
    ],
    cinema_people: [
      { id: 'demo-p1', name: 'Stanley Kubrick', role: 'director', country: 'USA', birth_year: 1928, following: true, user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-p2', name: 'Andrei Tarkovsky', role: 'director', country: 'Russia', birth_year: 1932, following: true, user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-p3', name: 'Asghar Farhadi', role: 'director', country: 'Iran', birth_year: 1972, following: true, user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-p4', name: 'Denis Villeneuve', role: 'director', country: 'Canada', birth_year: 1967, following: false, user_id: 'demo-user-0000-0000-0000-000000000001' },
    ],
    cinema_credits: [
      { id: 'demo-cr1', title_id: 'demo-1', person_id: 'demo-p1', role: 'director', user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-cr2', title_id: 'demo-2', person_id: 'demo-p2', role: 'director', user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-cr3', title_id: 'demo-8', person_id: 'demo-p3', role: 'director', user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-cr4', title_id: 'demo-6', person_id: 'demo-p4', role: 'director', user_id: 'demo-user-0000-0000-0000-000000000001' },
    ],
    cinema_quotes: [
      { id: 'demo-q1', title_id: 'demo-1', text: 'The dead know only one thing: it is better to be alive.', speaker: 'Joker', at_minute: 118, favorite: true, user_id: 'demo-user-0000-0000-0000-000000000001' },
      { id: 'demo-q2', title_id: 'demo-2', text: 'The room is not the point. The walking is.', speaker: 'Writer', at_minute: 44, favorite: false, user_id: 'demo-user-0000-0000-0000-000000000001' },
    ],
    cinema_goals: [
      { id: 'demo-g1', year: new Date().getFullYear(), target_titles: 60, target_minutes: 7200, target_rating_avg: 7.5, user_id: 'demo-user-0000-0000-0000-000000000001' },
    ],
    cinema_prompts: [],
    cinema_activity: DEMO_TITLES.slice(0, 8).map((t, i) => ({
      id: `demo-a${i}`,
      action: i % 3 === 0 ? 'created' : i % 3 === 1 ? 'rated' : 'watched',
      entity: 'title',
      entity_id: `demo-${i + 1}`,
      detail: t.title,
      created_at: new Date(now - i * 3600000 * 7).toISOString(),
      user_id: 'demo-user-0000-0000-0000-000000000001',
    })),
    cinema_ai_models: [
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free)', vendor: 'DeepSeek', provider: 'openrouter', is_free: true, active: true, wins: 0, losses: 0, recommended: true, tags: 'reasoning,free' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', vendor: 'Meta', provider: 'openrouter', is_free: true, active: true, wins: 0, losses: 0, tags: 'fast,free' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini', vendor: 'OpenAI', provider: 'openai', is_free: false, active: true, wins: 0, losses: 0, tags: 'balanced' },
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', vendor: 'Anthropic', provider: 'anthropic', is_free: false, active: true, wins: 0, losses: 0, tags: 'long-form' },
    ],
  });
}

/* ---------- load -------------------------------------------------------- */
const TABLE_MAP = {
  titles: 'cinema_titles',
  collections: 'cinema_collections',
  collectionItems: 'cinema_collection_items',
  watchlist: 'cinema_watchlist',
  ratings: 'cinema_ratings',
  people: 'cinema_people',
  credits: 'cinema_credits',
  quotes: 'cinema_quotes',
  trivia: 'cinema_trivia',
  sessions: 'cinema_watch_sessions',
  goals: 'cinema_goals',
  challenges: 'cinema_challenges',
  events: 'cinema_events',
  prompts: 'cinema_prompts',
  conversations: 'cinema_conversations',
  models: 'cinema_ai_models',
  activity: 'cinema_activity',
  usage: 'cinema_ai_usage',
  relationships: 'cinema_relationships',
  awards: 'cinema_awards',
  notes: 'cinema_mizan_notes',
  shares: 'cinema_shares',
  imports: 'cinema_import_batches',
};

const ORDER_OVERRIDES = {
  models: { column: 'label', ascending: true },
  prompts: { column: 'created_at', ascending: false },
};

export function tableName(key) { return TABLE_MAP[key] || key; }

export async function loadAll({ silent = false } = {}) {
  const c = state.client;
  if (!c) return;
  if (!silent) emit('loading', true);
  const uid = c.user?.id;
  const jobs = Object.entries(TABLE_MAP).map(async ([key, table]) => {
    try {
      let q = c.from(table).select('*');
      if (uid && key !== 'models') q = q.eq('user_id', uid);
      const order = ORDER_OVERRIDES[key] || (key === 'titles' || key === 'activity' || key === 'conversations'
        ? { column: 'created_at', ascending: false }
        : null);
      if (order) q = q.order(order.column, { ascending: order.ascending });
      const { data, error } = await q;
      if (error) throw error;
      state.tables[key] = data || [];
      if (key === 'titles') cacheTitles(state.tables.titles);
    } catch (err) {
      // a missing table must not blank the whole app: log once, keep going
      console.warn(`[store] ${table}: ${err.message}`);
      state.tables[key] = state.tables[key] || [];
    }
  });
  await Promise.all(jobs);
  state.ready = true;
  emit('loading', false);
  emit('data', state.tables);
}

function cacheTitles(rows) {
  try {
    ls.set(`${APP.storagePrefix}titles.cache`, rows.slice(0, 400));
  } catch { /* quota */ }
}
export function cachedTitles() { return ls.get(`${APP.storagePrefix}titles.cache`, []); }

/* ---------- activity ---------------------------------------------------- */
export async function logActivity(action, entity, entityId, detail = '') {
  const c = state.client;
  if (!c) return;
  const row = { action, entity, entity_id: entityId || null, detail: String(detail).slice(0, 240) };
  state.tables.activity.unshift({ ...row, id: `local-${Date.now()}`, created_at: new Date().toISOString(), user_id: c.user?.id });
  emit('activity');
  try {
    await c.from('cinema_activity').insert([row]).select();
  } catch (e) {
    c.queue({ table: 'cinema_activity', op: 'insert', rows: [row] });
  }
}

/* ---------- titles CRUD ------------------------------------------------- */
function nowIso() { return new Date().toISOString(); }

export async function saveTitle(payload, id = null) {
  const c = state.client;
  if (!c) throw new Error('No client');
  const clean = normaliseTitle(payload);
  if (id) {
    const { data, error } = await c.from('cinema_titles').update({ ...clean, updated_at: nowIso() }).eq('id', id).select().maybeSingle();
    if (error) throw error;
    const idx = state.tables.titles.findIndex((t) => t.id === id);
    if (idx >= 0) state.tables.titles[idx] = { ...state.tables.titles[idx], ...clean };
    logActivity('updated', 'title', id, clean.title);
    emit('titles');
    return data || { ...clean, id };
  }
  const row = { ...clean, user_id: c.user?.id, source: clean.source || 'manual' };
  const { data, error } = await c.from('cinema_titles').insert([row]).select().maybeSingle();
  if (error) {
    c.queue({ table: 'cinema_titles', op: 'insert', rows: [row] });
    throw error;
  }
  const created = data || { ...row, id: `tmp-${Date.now()}` };
  state.tables.titles.unshift(created);
  logActivity('created', 'title', created.id, clean.title);
  emit('titles');
  return created;
}

export function normaliseTitle(p = {}) {
  const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
  return {
    title: String(p.title || '').trim().slice(0, 200),
    original_title: String(p.original_title || '').trim().slice(0, 200),
    category: ['love', 'good', 'hate'].includes(p.category) ? p.category : 'good',
    type: p.type || 'movie',
    genre: String(p.genre || '').trim().toLowerCase(),
    year: num(p.year),
    rating: num(p.rating) == null ? 0 : Math.max(0, Math.min(10, Number(p.rating))),
    favorite: !!p.favorite,
    notes: String(p.notes || '').slice(0, 20000),
    watched_date: p.watched_date || null,
    summary: String(p.summary || '').slice(0, 2000),
    seasons: num(p.seasons),
    episodes: num(p.episodes),
    episodes_per_season: num(p.episodes_per_season),
    country: String(p.country || '').trim(),
    language: String(p.language || '').trim(),
    status: p.status || 'watched',
    reason: String(p.reason || '').slice(0, 4000),
    story_analysis: String(p.story_analysis || '').slice(0, 20000),
    tags: Array.isArray(p.tags) ? p.tags.join(', ') : String(p.tags || ''),
    poster_url: String(p.poster_url || '').slice(0, 800),
    backdrop_url: String(p.backdrop_url || '').slice(0, 800),
    runtime: num(p.runtime),
    trailer_url: String(p.trailer_url || '').slice(0, 800),
    source: String(p.source || 'manual').slice(0, 40),
  };
}

export async function deleteTitle(id) {
  const c = state.client;
  const t = state.tables.titles.find((x) => x.id === id);
  const { error } = await c.from('cinema_titles').delete().eq('id', id);
  if (error) throw error;
  state.tables.titles = state.tables.titles.filter((x) => x.id !== id);
  logActivity('deleted', 'title', id, t?.title || '');
  emit('titles');
}

export async function toggleFavorite(id) {
  const t = state.tables.titles.find((x) => x.id === id);
  if (!t) return;
  const next = !t.favorite;
  t.favorite = next;
  emit('titles');
  const { error } = await state.client.from('cinema_titles').update({ favorite: next }).eq('id', id);
  if (error) { t.favorite = !next; emit('titles'); throw error; }
  logActivity(next ? 'starred' : 'unstarred', 'title', id, t.title);
  return next;
}

export async function quickRate(id, rating) {
  const t = state.tables.titles.find((x) => x.id === id);
  if (!t) return;
  const prev = t.rating;
  t.rating = Number(rating);
  emit('titles');
  const { error } = await state.client.from('cinema_titles').update({ rating: Number(rating) }).eq('id', id);
  if (error) { t.rating = prev; emit('titles'); throw error; }
  logActivity('rated', 'title', id, `${t.title} → ${rating}`);
}

/* ---------- generic repo ------------------------------------------------ */
export function rows(key) { return state.tables[key] || []; }
export function titleById(id) { return rows('titles').find((t) => t.id === id) || null; }

export async function addRow(key, row) {
  const c = state.client;
  const payload = { ...row, user_id: c?.user?.id };
  const { data, error } = await c.from(tableName(key)).insert([payload]).select().maybeSingle();
  if (error) throw error;
  const created = data || { ...payload, id: `tmp-${Date.now()}` };
  state.tables[key].unshift(created);
  emit(key);
  return created;
}

export async function updateRow(key, id, patch) {
  const c = state.client;
  const { data, error } = await c.from(tableName(key)).update(patch).eq('id', id).select().maybeSingle();
  if (error) throw error;
  const idx = state.tables[key].findIndex((r) => r.id === id);
  if (idx >= 0) state.tables[key][idx] = { ...state.tables[key][idx], ...patch };
  emit(key);
  return data;
}

export async function removeRow(key, id) {
  const { error } = await state.client.from(tableName(key)).delete().eq('id', id);
  if (error) throw error;
  state.tables[key] = state.tables[key].filter((r) => r.id !== id);
  emit(key);
}

export async function upsertRow(key, row, conflict = 'id') {
  const c = state.client;
  const payload = { ...row, user_id: row.user_id || c?.user?.id };
  const { data, error } = await c.from(tableName(key)).upsert([payload], { onConflict: conflict }).select().maybeSingle();
  if (error) throw error;
  const idx = state.tables[key].findIndex((r) => r.id === payload.id);
  if (idx >= 0) state.tables[key][idx] = { ...state.tables[key][idx], ...payload };
  else state.tables[key].unshift(data || payload);
  emit(key);
  return data;
}

/* ---------- watchlist helpers ------------------------------------------ */
export function onWatchlist(titleId) {
  return rows('watchlist').some((w) => w.title_id === titleId && !w.done);
}
export async function toggleWatchlist(titleId) {
  const existing = rows('watchlist').find((w) => w.title_id === titleId && !w.done);
  if (existing) { await removeRow('watchlist', existing.id); return false; }
  await addRow('watchlist', { title_id: titleId, priority: 1, done: false, note: '' });
  logActivity('watchlisted', 'title', titleId, titleById(titleId)?.title || '');
  return true;
}

/* ---------- statistics engine ------------------------------------------ */
export function computeStats(titles = rows('titles')) {
  const list = titles.filter((t) => t && t.title);
  const ratings = list.map((t) => Number(t.rating) || 0).filter((r) => r > 0);
  const watched = list.filter((t) => ['watched', 'rewatching'].includes(t.status || 'watched'));
  const byCat = { love: [], good: [], hate: [] };
  list.forEach((t) => byCat[t.category || 'good']?.push(t));

  const byType = Object.fromEntries(
    Object.entries(groupBy(list, (t) => t.type || 'movie')).map(([k, v]) => [k, v.length]),
  );
  const byGenre = countMap(list.flatMap((t) => splitTags(t.genre)));
  const byCountry = countMap(list.flatMap((t) => splitTags(t.country)));
  const byLanguage = countMap(list.flatMap((t) => splitTags(t.language)));
  const byTag = countMap(list.flatMap((t) => splitTags(t.tags)));
  const byStatus = countMap(list.map((t) => t.status || 'watched'));
  const byYear = countMap(list.map((t) => t.year).filter(Boolean).map(String));

  const decades = Object.fromEntries(
    Object.entries(groupBy(list.filter((t) => t.year), (t) => `${Math.floor(t.year / 10) * 10}s`))
      .map(([k, v]) => [k, v.length]),
  );

  const scores = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  list.forEach((t) => {
    const r = Math.round(Number(t.rating) || 0);
    if (r >= 1 && r <= 10) scores[r - 1] += 1;
  });

  const now = new Date();
  const thisYear = list.filter((t) => t.watched_date && new Date(t.watched_date).getFullYear() === now.getFullYear());
  const lastYear = list.filter((t) => t.watched_date && new Date(t.watched_date).getFullYear() === now.getFullYear() - 1);

  const minutesOf = (t) => {
    if (t.runtime) return Number(t.runtime);
    const ep = Number(t.episodes) || (t.seasons && t.episodes_per_season ? t.seasons * t.episodes_per_season : 0);
    if (ep) return ep * 45;
    return t.type === 'series' ? 480 : 104;
  };
  const totalMinutes = sum(list, minutesOf);

  return {
    total: list.length,
    watched: watched.length,
    loved: byCat.love.length,
    good: byCat.good.length,
    hated: byCat.hate.length,
    favorites: list.filter((t) => t.favorite).length,
    avgRating: ratings.length ? avg(ratings) : 0,
    medianRating: median(ratings),
    rated: ratings.length,
    perfect: list.filter((t) => Number(t.rating) >= 9.5).length,
    hours: Math.round(totalMinutes / 60),
    minutes: totalMinutes,
    series: list.filter((t) => ['series', 'mini', 'anime'].includes(t.type)).length,
    movies: list.filter((t) => t.type === 'movie').length,
    episodes: sum(list, (t) => Number(t.episodes) || 0),
    countries: Object.keys(byCountry).length,
    genres: Object.keys(byGenre).length,
    yearsSpan: (() => {
      const ys = list.map((t) => t.year).filter(Boolean);
      return ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '—';
    })(),
    byCat, byType, byGenre, byCountry, byLanguage, byTag, byStatus, byYear, decades, scores,
    thisYear: thisYear.length,
    lastYear: lastYear.length,
    favorRatio: list.length ? byCat.love.length / list.length : 0,
    hateRatio: list.length ? byCat.hate.length / list.length : 0,
    topRated: sortBy(list.filter((t) => Number(t.rating) > 0), (t) => Number(t.rating), -1).slice(0, 10),
    worst: sortBy(list.filter((t) => Number(t.rating) > 0), (t) => Number(t.rating), 1).slice(0, 10),
    recent: sortBy(list, (t) => t.created_at || '', -1).slice(0, 12),
    streak: computeStreak(list),
    heat: computeHeat(list),
    months: computeMonths(list),
    years: computeYears(list),
    decadesList: Object.entries(decades).sort((a, b) => a[0].localeCompare(b[0])),
    genreList: topEntries(byGenre, 12),
    countryList: topEntries(byCountry, 12),
    tagList: topEntries(byTag, 24),
    statusList: topEntries(byStatus, 8),
    typeList: topEntries(byType, 8),
    yearList: topEntries(byYear, 40),
    longest: sortBy(list, minutesOf, -1).slice(0, 5),
    evolution: computeEvolution(list),
  };
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function countMap(arr) {
  const o = {};
  arr.forEach((k) => { if (k != null && k !== '') o[k] = (o[k] || 0) + 1; });
  return o;
}
function topEntries(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
}
export function splitTags(v) {
  if (!v) return [];
  return String(v).split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function computeStreak(list) {
  const days = new Set(
    list.filter((t) => t.watched_date).map((t) => String(t.watched_date).slice(0, 10)),
  );
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (days.has(key)) { streak += 1; d.setDate(d.getDate() - 1); }
    else if (streak === 0 && d.toDateString() === new Date().toDateString()) d.setDate(d.getDate() - 1);
    else break;
    if (streak > 4000) break;
  }
  return streak;
}

function computeHeat(list) {
  // 53 weeks x 7 days ending today
  const counts = {};
  list.forEach((t) => {
    if (!t.watched_date) return;
    const k = String(t.watched_date).slice(0, 10);
    counts[k] = (counts[k] || 0) + 1;
  });
  const cells = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());
  for (let i = 0; i < 371; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const n = counts[key] || 0;
    cells.push({ date: key, n, level: n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4 });
  }
  return cells;
}

function computeMonths(list) {
  const arr = Array.from({ length: 12 }, () => 0);
  list.forEach((t) => {
    if (!t.watched_date) return;
    const m = new Date(t.watched_date).getMonth();
    if (m >= 0 && m < 12) arr[m] += 1;
  });
  return arr;
}

function computeYears(list) {
  const m = {};
  list.forEach((t) => {
    if (!t.watched_date) return;
    const y = String(new Date(t.watched_date).getFullYear());
    m[y] = (m[y] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([year, n]) => ({ year, n }));
}

function computeEvolution(list) {
  // average rating by release decade — shows how taste drifts
  const map = new Map();
  list.forEach((t) => {
    if (!t.year || !Number(t.rating)) return;
    const d = Math.floor(t.year / 10) * 10;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(Number(t.rating));
  });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([decade, vals]) => ({
    decade: `${decade}s`, avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length,
  }));
}

/* ---------- recommendation engine ------------------------------------- */
export function affinity(title) {
  // how much this title matches the shelf you already love
  const list = rows('titles');
  const loved = list.filter((t) => t.category === 'love');
  if (!loved.length) return 0;
  const g = new Set(splitTags(title.genre));
  const c = new Set(splitTags(title.country));
  const tg = new Set(splitTags(title.tags));
  let score = 0;
  for (const l of loved) {
    if (l.id === title.id) continue;
    const lg = splitTags(l.genre), lc = splitTags(l.country), lt = splitTags(l.tags);
    score += lg.some((x) => g.has(x)) ? 1.2 : 0;
    score += lc.some((x) => c.has(x)) ? 0.6 : 0;
    score += lt.some((x) => tg.has(x)) ? 0.5 : 0;
    if (l.type === title.type) score += 0.2;
  }
  return score / loved.length;
}

export function similarTitles(title, n = 6) {
  return sortBy(
    rows('titles').filter((t) => t.id !== title.id),
    (t) => affinity(t) + (t.genre && t.genre === title.genre ? 1.5 : 0),
    -1,
  ).slice(0, n);
}

export function nextUp(n = 5) {
  const wl = rows('watchlist').filter((w) => !w.done).map((w) => ({ ...titleById(w.title_id), _w: w }));
  return sortBy(wl.filter((x) => x.id), (x) => (Number(x._w?.priority) || 0) + affinity(x), -1).slice(0, n);
}

export function recommendFromShelf(n = 8) {
  // unrated or good-but-not-loved titles that match your loved profile
  const list = rows('titles').filter((t) => t.category !== 'hate');
  return sortBy(list, (t) => affinity(t) + (Number(t.rating) || 0) / 20, -1).slice(0, n);
}

/* ---------- csv / json import ----------------------------------------- */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch === '\r') { /* skip */ }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((s) => s.trim().toLowerCase().replace(/\s+/g, '_'));
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const o = {};
    head.forEach((k, i) => { o[k] = r[i] ?? ''; });
    return o;
  });
}

export async function importTitles(items, { source = 'import', batch = null } = {}) {
  const c = state.client;
  const cleaned = items
    .filter((x) => x && (x.title || x.name))
    .map((x) => normaliseTitle({ title: x.title || x.name, ...x, source }));
  if (!cleaned.length) return { inserted: 0 };
  const withUser = cleaned.map((r) => ({ ...r, user_id: c.user?.id }));
  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < withUser.length; i += chunkSize) {
    const chunk = withUser.slice(i, i + chunkSize);
    const { data, error } = await c.from('cinema_titles').insert(chunk).select();
    if (error) throw error;
    inserted += (data || []).length;
    state.tables.titles.unshift(...(data || []));
  }
  logActivity('imported', 'batch', batch, `${inserted} titles from ${source}`);
  emit('titles');
  return { inserted };
}

/* ---------- aggregate helpers used by views --------------------------- */
export function titleMeta(t) {
  const bits = [];
  if (t.year) bits.push(t.year);
  if (t.type) bits.push(t.type);
  if (t.genre) bits.push(t.genre);
  if (t.country) bits.push(t.country);
  return bits.join(' · ');
}

export function groupTitlesForTimeline(titles) {
  const withDates = titles.filter((t) => t.watched_date || t.created_at);
  const byYear = new Map();
  for (const t of withDates) {
    const raw = t.watched_date || t.created_at;
    const d = new Date(raw);
    const y = Number.isNaN(d.getFullYear()) ? '—' : d.getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push({ ...t, _date: d });
  }
  return [...byYear.entries()].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
}

export function exportSnapshot() {
  const out = {
    app: APP.name,
    version: APP.version,
    exported_at: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(state.tables).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    tables: state.tables,
    prefs: state.prefs,
  };
  return out;
}

export const DateHelp = { hash, fmtDate, uniq };
