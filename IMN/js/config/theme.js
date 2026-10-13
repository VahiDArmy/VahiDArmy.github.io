/**
 * Theme manager — dark / light.
 *
 * Default behavior
 * ----------------
 * The app opens in DARK mode for every new user, regardless of the OS
 * preference. Only an explicit user choice (persisted in localStorage)
 * overrides the default.
 *
 * Applies `data-theme` on <html>, persists the choice, and emits
 * `theme:changed` on the bus.
 */

import { STORAGE_KEYS } from "./constants.js";
import { storage } from "../core/storage.js";
import { bus } from "../core/event-bus.js";

export const THEMES = ["dark", "light"];
const DEFAULT_THEME = "dark";

let current = DEFAULT_THEME;

function readInitial() {
  const saved = storage.get(STORAGE_KEYS.THEME);
  if (saved && THEMES.includes(saved)) return saved;
  // No saved preference → always start dark.
  return DEFAULT_THEME;
}

export const theme = {
  init() {
    current = readInitial();
    this.apply(current, { silent: true });
    return current;
  },

  apply(name, { silent = false } = {}) {
    if (!THEMES.includes(name)) name = DEFAULT_THEME;
    const changed = name !== current;
    current = name;
    document.documentElement.setAttribute("data-theme", name);
    storage.set(STORAGE_KEYS.THEME, name);
    if (changed && !silent) bus.emit("theme:changed", { theme: name });
  },

  get current() {
    return current;
  },

  toggle() {
    const next = current === "dark" ? "light" : "dark";
    this.apply(next);
    return next;
  },
};