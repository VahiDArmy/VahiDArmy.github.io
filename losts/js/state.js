const listeners = new Map();

export const state = {
  session: null,
  user: null,
  displayName: 'کاربر',
  email: '',
  entries: [],
  karma_actions: [],
  goals: [],
  wishes: [],
  reflections: [],
  people: [],
  settings: null,
  loading: false,
  lastLoadedAt: null,
  filters: {
    search: '',
    category: 'all',
    favorite: false,
    sort: 'newest',
    period: 'all',
  },
  calendar: {
    year: null,
    month: null,
    selected: null,
  },
};

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  (listeners.get(event) || new Set()).forEach((handler) => {
    try { handler(payload); } catch (err) { console.error('[state] listener error', err); }
  });
  (listeners.get('*') || new Set()).forEach((handler) => {
    try { handler({ event, payload }); } catch (err) { console.error('[state] listener error', err); }
  });
}

export function resetState() {
  state.session = null;
  state.user = null;
  state.displayName = 'کاربر';
  state.email = '';
  state.entries = [];
  state.karma_actions = [];
  state.goals = [];
  state.wishes = [];
  state.reflections = [];
  state.people = [];
  state.settings = null;
  state.loading = false;
  state.lastLoadedAt = null;
  state.filters = { search: '', category: 'all', favorite: false, sort: 'newest', period: 'all' };
  state.calendar = { year: null, month: null, selected: null };
  emit('state:reset');
}

export function defaultSettings(userId) {
  return {
    user_id: userId,
    theme: 'light',
    currency: 'تومان',
    daily_goal: 1,
    display_name: null,
    preferences: {},
  };
}
