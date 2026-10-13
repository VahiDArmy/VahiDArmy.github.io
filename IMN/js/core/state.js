/**
 * Reactive-ish global app state.
 *
 * Change event contract:
 *   • `store.set(key, value)`         → updates state[key], emits state:changed + state:<key>
 *   • `store.setSelectedDate(iso)`    → updates state.selectedDate AND persists
 *   • `store.setGoals(patch)`         → merges into state.goals AND persists
 *   • `store.setPrefs(patch)`         → merges into state.prefs AND persists
 */

import { bus } from "./event-bus.js";
import { storage } from "./storage.js";
import { STORAGE_KEYS, DEFAULT_GOALS } from "../config/constants.js";

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const initial = {
  user: null,
  session: null,
  profile: null,
  ready: false,
  selectedDate: storage.get(STORAGE_KEYS.SELECTED_DATE) || todayISO(),
  route: "dashboard",
  goals: { ...DEFAULT_GOALS, ...(storage.get(STORAGE_KEYS.GOALS) || {}) },
  prefs: storage.get(STORAGE_KEYS.USER_PREFS) || {
    weekStartsOn: 6,
    notifications: true,
    compactMode: false,
  },
  todaySnapshot: null,
  loading: { global: false, route: false },
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  error: null,
};

export const state = { ...initial };

function notify(key, value) {
  bus.emit("state:changed", { key, value });
  bus.emit(`state:${key}`, value);
}

export const store = {
  get(key) {
    return state[key];
  },

  set(key, value) {
    if (state[key] === value) return;
    state[key] = value;
    notify(key, value);
  },

  update(patch) {
    Object.entries(patch).forEach(([k, v]) => {
      if (state[k] !== v) {
        state[k] = v;
        notify(k, v);
      }
    });
  },

  /* ---------- Domain helpers ---------------------------------------- */

  setUser(user, session = null) {
    this.update({ user, session });
  },

  setSelectedDate(iso) {
    if (!iso || state.selectedDate === iso) return;
    state.selectedDate = iso;
    storage.set(STORAGE_KEYS.SELECTED_DATE, iso);
    notify("selectedDate", iso);
  },

  setRoute(route) {
    if (state.route === route) return;
    state.route = route;
    storage.set(STORAGE_KEYS.LAST_PAGE, route);
    notify("route", route);
  },

  setGoals(patch) {
    const goals = { ...state.goals, ...patch };
    state.goals = goals;
    storage.set(STORAGE_KEYS.GOALS, goals);
    notify("goals", goals);
  },

  setPrefs(patch) {
    const prefs = { ...state.prefs, ...patch };
    state.prefs = prefs;
    storage.set(STORAGE_KEYS.USER_PREFS, prefs);
    notify("prefs", prefs);
  },

  setLoading(scope, value) {
    if (!(scope in state.loading)) return;
    if (state.loading[scope] === value) return;
    state.loading[scope] = value;
    bus.emit("loading:changed", { scope, value });
  },

  reset() {
    Object.assign(state, {
      ...initial,
      // Re-read persisted values so we don't reset the user's preferences
      goals: { ...DEFAULT_GOALS, ...(storage.get(STORAGE_KEYS.GOALS) || {}) },
      prefs: storage.get(STORAGE_KEYS.USER_PREFS) || initial.prefs,
      selectedDate: storage.get(STORAGE_KEYS.SELECTED_DATE) || todayISO(),
    });
    bus.emit("state:reset");
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => store.set("online", true));
  window.addEventListener("offline", () => store.set("online", false));
}