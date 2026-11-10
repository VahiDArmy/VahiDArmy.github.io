import { supabase } from './supabase.js';
import { TABLES } from './config.js';
import { state, defaultSettings, emit } from './state.js';

function handleError(error) {
  if (!error) return;
  const message = error.message || error.error_description || 'خطای ناشناخته رخ داد';
  throw new Error(message);
}

export async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user?.id || null;
}

async function requireUserId() {
  const id = await getUserId();
  if (!id) throw new Error('کاربر وارد نشده است');
  return id;
}

/* ---------------- People ---------------- */
export async function listPeople() {
  const { data, error } = await supabase
    .from(TABLES.people)
    .select('id, full_name, job_title, avatar_url')
    .order('full_name');
  handleError(error);
  return data || [];
}

export async function createPerson(fullName) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(TABLES.people)
    .insert({ full_name: fullName, created_by: userId })
    .select('id, full_name, job_title, avatar_url')
    .single();
  handleError(error);
  return data;
}

/* ---------------- Entries (Joy) ---------------- */
export async function listEntries() {
  const { data, error } = await supabase
    .from(TABLES.entries)
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  handleError(error);
  return data || [];
}

export async function createEntry(payload) {
  const userId = await requireUserId();
  const record = {
    user_id: userId,
    title: payload.title,
    description: payload.description || null,
    emoji: payload.emoji || '✨',
    category: payload.category || 'other',
    joy_score: Number(payload.joy_score) || 5,
    money_spent: Number(payload.money_spent) || 0,
    time_spent_minutes: Number(payload.time_spent_minutes) || 0,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    entry_date: payload.entry_date || new Date().toISOString().slice(0, 10),
    entry_time: payload.entry_time || null,
    is_favorite: !!payload.is_favorite,
    location: payload.location || null,
    with_people: payload.with_people || null,
    related_people: Array.isArray(payload.related_people) ? payload.related_people : [],
    mood_before: payload.mood_before || null,
    mood_after: payload.mood_after || null,
  };
  const { data, error } = await supabase.from(TABLES.entries).insert(record).select().single();
  handleError(error);
  return data;
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase
    .from(TABLES.entries)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  handleError(error);
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from(TABLES.entries).delete().eq('id', id);
  handleError(error);
}

export async function toggleEntryFavorite(id, value) {
  return updateEntry(id, { is_favorite: value });
}

/* ---------------- Karma Actions ---------------- */
export async function listKarmaActions() {
  const { data, error } = await supabase
    .from(TABLES.karma_actions)
    .select('*')
    .order('action_date', { ascending: false })
    .order('created_at', { ascending: false });
  handleError(error);
  return data || [];
}

export async function createKarmaAction(payload) {
  const userId = await requireUserId();
  const record = {
    user_id: userId,
    title: payload.title,
    description: payload.description || null,
    karma_score: Number(payload.karma_score) || 0,
    action_date: payload.action_date || new Date().toISOString().slice(0, 10),
    action_time: payload.action_time || null,
    related_people: Array.isArray(payload.related_people) ? payload.related_people : [],
    tags: Array.isArray(payload.tags) ? payload.tags : [],
  };
  const { data, error } = await supabase.from(TABLES.karma_actions).insert(record).select().single();
  handleError(error);
  return data;
}

export async function deleteKarmaAction(id) {
  const { error } = await supabase.from(TABLES.karma_actions).delete().eq('id', id);
  handleError(error);
}

/* ---------------- Goals ---------------- */
export async function listGoals() {
  const { data, error } = await supabase
    .from(TABLES.goals)
    .select('*')
    .order('created_at', { ascending: false });
  handleError(error);
  return data || [];
}

export async function createGoal(payload) {
  const userId = await requireUserId();
  const record = {
    user_id: userId,
    title: payload.title,
    description: payload.description || null,
    target_type: payload.target_type || 'count',
    target_value: Number(payload.target_value) || 1,
    current_value: Number(payload.current_value) || 0,
    period: payload.period || 'week',
    category: payload.category || null,
    deadline: payload.deadline || null,
    status: payload.status || 'active',
  };
  const { data, error } = await supabase.from(TABLES.goals).insert(record).select().single();
  handleError(error);
  return data;
}

export async function updateGoal(id, patch) {
  const { data, error } = await supabase
    .from(TABLES.goals)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  handleError(error);
  return data;
}

export async function deleteGoal(id) {
  const { error } = await supabase.from(TABLES.goals).delete().eq('id', id);
  handleError(error);
}

/* ---------------- Wishlist ---------------- */
export async function listWishes() {
  const { data, error } = await supabase
    .from(TABLES.wishes)
    .select('*')
    .order('is_done', { ascending: true })
    .order('created_at', { ascending: false });
  handleError(error);
  return data || [];
}

export async function createWish(payload) {
  const userId = await requireUserId();
  const record = {
    user_id: userId,
    title: payload.title,
    description: payload.description || null,
    estimated_cost: Number(payload.estimated_cost) || 0,
    priority: payload.priority || 'medium',
    url: payload.url || null,
    category: payload.category || 'other',
    is_done: !!payload.is_done,
  };
  const { data, error } = await supabase.from(TABLES.wishes).insert(record).select().single();
  handleError(error);
  return data;
}

export async function updateWish(id, patch) {
  const payload = { ...patch, updated_at: new Date().toISOString() };
  if (patch.is_done === true) payload.done_at = new Date().toISOString();
  if (patch.is_done === false) payload.done_at = null;
  const { data, error } = await supabase
    .from(TABLES.wishes)
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  handleError(error);
  return data;
}

export async function deleteWish(id) {
  const { error } = await supabase.from(TABLES.wishes).delete().eq('id', id);
  handleError(error);
}

/* ---------------- Reflections ---------------- */
export async function listReflections() {
  const { data, error } = await supabase
    .from(TABLES.reflections)
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  handleError(error);
  return data || [];
}

export async function createReflection(payload) {
  const userId = await requireUserId();
  const record = {
    user_id: userId,
    entry_date: payload.entry_date || new Date().toISOString().slice(0, 10),
    mood: payload.mood || 'neutral',
    content: payload.content,
    gratitude: Array.isArray(payload.gratitude) ? payload.gratitude : [],
  };
  const { data, error } = await supabase.from(TABLES.reflections).insert(record).select().single();
  handleError(error);
  return data;
}

export async function updateReflection(id, patch) {
  const { data, error } = await supabase
    .from(TABLES.reflections)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  handleError(error);
  return data;
}

export async function deleteReflection(id) {
  const { error } = await supabase.from(TABLES.reflections).delete().eq('id', id);
  handleError(error);
}

/* ---------------- Settings ---------------- */
export async function getSettings() {
  const userId = await getUserId();
  if (!userId) return defaultSettings(null);
  const { data, error } = await supabase
    .from(TABLES.settings)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[settings]', error.message);
    return defaultSettings(userId);
  }
  return data || defaultSettings(userId);
}

export async function saveSettings(patch) {
  const userId = await requireUserId();
  const payload = { user_id: userId, ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from(TABLES.settings)
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();
  handleError(error);
  return data;
}

/* ---------------- Aggregate load ---------------- */
export async function loadAll() {
  state.loading = true;
  emit('data:loading', true);
  try {
    const [entries, karma_actions, goals, wishes, reflections, settings, people] = await Promise.all([
      listEntries().catch((e) => { console.warn('entries', e.message); return []; }),
      listKarmaActions().catch((e) => { console.warn('karma_actions', e.message); return []; }),
      listGoals().catch((e) => { console.warn('goals', e.message); return []; }),
      listWishes().catch((e) => { console.warn('wishes', e.message); return []; }),
      listReflections().catch((e) => { console.warn('reflections', e.message); return []; }),
      getSettings().catch(() => defaultSettings(state.user?.id || null)),
      listPeople().catch((e) => { console.warn('people', e.message); return []; }),
    ]);
    state.entries = entries;
    state.karma_actions = karma_actions;
    state.goals = goals;
    state.wishes = wishes;
    state.reflections = reflections;
    state.settings = settings;
    state.people = people;
    state.lastLoadedAt = Date.now();
  } finally {
    state.loading = false;
    emit('data:changed');
    emit('data:loading', false);
  }
  return state;
}

export async function wipeAllData() {
  const userId = await requireUserId();
  const results = await Promise.all([
    supabase.from(TABLES.entries).delete().eq('user_id', userId),
    supabase.from(TABLES.karma_actions).delete().eq('user_id', userId),
    supabase.from(TABLES.goals).delete().eq('user_id', userId),
    supabase.from(TABLES.wishes).delete().eq('user_id', userId),
    supabase.from(TABLES.reflections).delete().eq('user_id', userId),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) handleError(failed.error);
}

export function exportData() {
  return {
    exported_at: new Date().toISOString(),
    app: 'joyyar',
    version: 1,
    user: { id: state.user?.id || null, email: state.email || null, name: state.displayName },
    settings: state.settings,
    entries: state.entries,
    karma_actions: state.karma_actions,
    goals: state.goals,
    wishes: state.wishes,
    reflections: state.reflections,
    people: state.people,
  };
}
