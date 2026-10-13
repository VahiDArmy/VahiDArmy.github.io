/**
 * Theme manager — dark / light.
 *
 * Applies `data-theme` on <html>, persists the choice, honors the OS
 * preference on first visit, and emits `theme:changed` on the bus.
 */

import { STORAGE_KEYS } from "./constants.js";
import { storage } from "../core/storage.js";
import { bus } from "../core/event-bus.js";

export const THEMES = ["dark", "light"];
const DEFAULT_THEME = "dark";

let current = DEFAULT_THEME;

function systemPrefersLight() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function readInitial() {
  const saved = storage.get(STORAGE_KEYS.THEME);
  if (saved && THEMES.includes(saved)) return saved;
  return systemPrefersLight() ? "light" : DEFAULT_THEME;
}

export const theme = {
  init() {
    current = readInitial();
    this.apply(current, { silent: true });
    this._watchSystem();
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

  _watchSystem() {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener?.("change", (e) => {
      // Only follow the OS if the user never explicitly picked.
      if (!storage.get(STORAGE_KEYS.THEME)) {
        this.apply(e.matches ? "light" : "dark");
      }
    });
  },
};