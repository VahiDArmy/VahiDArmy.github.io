/**
 * Theme manager — applies/removes data attributes on <html>, persists
 * the choice, and exposes an event so UI components can react.
 *
 * The dark theme is the default; a couple of dark variants (midnight,
 * slate) are supported through [data-theme] selectors. Because we ship a
 * single variables.css, the variants only override a handful of tokens.
 */

import { STORAGE_KEYS } from "./constants.js";
import { storage } from "../core/storage.js";
import { bus } from "../core/event-bus.js";

export const THEMES = ["dark", "midnight", "slate"];

const DEFAULT_THEME = "dark";

let current = DEFAULT_THEME;

function readInitial() {
  const saved = storage.get(STORAGE_KEYS.THEME);
  if (saved && THEMES.includes(saved)) return saved;
  // Prefer user's OS preference the first time.
  if (typeof window !== "undefined" && window.matchMedia) {
    // All our themes are dark; respect OS only to decide accent density,
    // but keep dark regardless.
    return DEFAULT_THEME;
  }
  return DEFAULT_THEME;
}

export const theme = {
  init() {
    current = readInitial();
    this.apply(current);
    this._watchSystem();
    return current;
  },

  apply(name) {
    if (!THEMES.includes(name)) name = DEFAULT_THEME;
    current = name;
    document.documentElement.setAttribute("data-theme", name);
    document.documentElement.setAttribute("data-color-scheme", "dark");
    storage.set(STORAGE_KEYS.THEME, name);
    bus.emit("theme:changed", { theme: name });
  },

  get current() {
    return current;
  },

  toggle() {
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    this.apply(next);
    return next;
  },

  _watchSystem() {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    // We still stay dark, but we nudge contrast for light-preferring users.
    const handler = (e) => {
      document.documentElement.setAttribute(
        "data-os-preference",
        e.matches ? "light" : "dark"
      );
    };
    handler(mq);
    mq.addEventListener?.("change", handler);
  },
};