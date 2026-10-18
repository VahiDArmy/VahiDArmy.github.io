/* ============================================================
   js/ui/theme.js
   FIXED: Unified localStorage read/write.
   ============================================================ */

import { get, set } from '../utils/storage.js';
import { LS_KEYS } from '../config/app.config.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { byId } from '../utils/dom.js';

export const THEMES = ['dark', 'midnight', 'obsidian', 'light'];
export const ACCENTS = [
  { id: 'violet', label: 'بنفش نیلی', hsl: 258 }, { id: 'blue', label: 'آبی', hsl: 214 },
  { id: 'cyan', label: 'فیروزه‌ای', hsl: 190 }, { id: 'emerald', label: 'زمرد', hsl: 158 },
  { id: 'amber', label: 'کهربا', hsl: 34 }, { id: 'rose', label: 'سرخابی', hsl: 344 },
  { id: 'fuchsia', label: 'ارغوانی', hsl: 292 },
];
export const FONT_SIZES = ['sm', 'md', 'lg', 'xl'];

let current = { theme: 'dark', accent: 'violet', fontSize: 'md' };

export function applyTheme(patch = {}, opts = {}) {
  if (patch.theme && THEMES.includes(patch.theme)) current.theme = patch.theme;
  if (patch.accent && ACCENTS.some(a => a.id === patch.accent)) current.accent = patch.accent;
  if (patch.fontSize && FONT_SIZES.includes(patch.fontSize)) current.fontSize = patch.fontSize;

  const html = document.documentElement;
  html.setAttribute('data-theme', current.theme);
  html.setAttribute('data-accent', current.accent);
  html.setAttribute('data-fontsize', current.fontSize);

  const btn = byId('theme-toggle-btn');
  if (btn) {
    btn.textContent = current.theme === 'light' ? '☀️' : '🌙';
    btn.title = current.theme === 'light' ? 'حالت تاریک' : 'حالت روشن';
  }

  if (opts.persist !== false) {
    set(LS_KEYS.THEME, current.theme);
    set(LS_KEYS.ACCENT, current.accent);
    set(LS_KEYS.FONT_SIZE, current.fontSize);
  }
  if (!opts.silent) bus.emit(EVENTS.THEME_CHANGED, { ...current });
}

export function initTheme() {
  applyTheme({
    theme: get(LS_KEYS.THEME, 'dark'),
    accent: get(LS_KEYS.ACCENT, 'violet'),
    fontSize: get(LS_KEYS.FONT_SIZE, 'md'),
  }, { persist: false, silent: true });
  return { ...current };
}

export function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(current.theme) + 1) % THEMES.length];
  applyTheme({ theme: next });
}