/* ============================================================
   js/ui/theme.js
   FIXED: Removed prefers-color-scheme check. The app is ALWAYS
          dark by default unless the user explicitly changes it.
   ============================================================ */

import { get, set } from '../utils/storage.js';
import { LS_KEYS } from '../config/app.config.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { byId } from '../utils/dom.js';

export const THEMES = Object.freeze(['dark', 'midnight', 'obsidian', 'light']);
export const ACCENTS = Object.freeze([
  { id: 'violet',  label: 'بنفش نیلی',   hsl: 258 },
  { id: 'blue',    label: 'آبی',         hsl: 214 },
  { id: 'cyan',    label: 'فیروزه‌ای',   hsl: 190 },
  { id: 'emerald', label: 'زمرد',        hsl: 158 },
  { id: 'amber',   label: 'کهربا',       hsl: 34 },
  { id: 'rose',    label: 'سرخابی',      hsl: 344 },
  { id: 'fuchsia', label: 'ارغوانی',     hsl: 292 },
]);
export const FONT_SIZES = Object.freeze(['sm', 'md', 'lg', 'xl']);

let current = {
  theme: 'dark',
  accent: 'violet',
  fontSize: 'md',
};

export function applyTheme(patch = {}, opts = {}) {
  const { persist = true, silent = false } = opts;
  if (patch.theme && THEMES.includes(patch.theme)) current.theme = patch.theme;
  if (patch.accent && ACCENTS.some((a) => a.id === patch.accent)) current.accent = patch.accent;
  if (patch.fontSize && FONT_SIZES.includes(patch.fontSize)) current.fontSize = patch.fontSize;

  const html = document.documentElement;
  html.setAttribute('data-theme', current.theme);
  html.setAttribute('data-accent', current.accent);
  html.setAttribute('data-fontsize', current.fontSize);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const bg = getComputedStyle(html).getPropertyValue('--bg-base').trim() || '#0a0a0f';
    metaTheme.setAttribute('content', bg);
  }

  const btn = byId('theme-toggle-btn');
  if (btn) {
    const icon = current.theme === 'light' ? '☀️' : '🌙';
    btn.textContent = icon;
    btn.title = current.theme === 'light' ? 'حالت تاریک' : 'حالت روشن';
  }

  if (persist) {
    set(LS_KEYS.THEME, current.theme);
    set(LS_KEYS.ACCENT, current.accent);
    set(LS_KEYS.FONT_SIZE, current.fontSize);
  }

  if (!silent) {
    bus.emit(EVENTS.THEME_CHANGED, { ...current });
  }
}

export function initTheme() {
  const savedTheme = get(LS_KEYS.THEME, null);
  const savedAccent = get(LS_KEYS.ACCENT, null);
  const savedFont = get(LS_KEYS.FONT_SIZE, null);

  // 🛡️ FIX: The app is dark by default. We ignore OS light-mode preference.
  applyTheme({
    theme: savedTheme || 'dark',
    accent: savedAccent || 'violet',
    fontSize: savedFont || 'md',
  }, { persist: false });

  return { ...current };
}

export function cycleTheme() {
  const idx = THEMES.indexOf(current.theme);
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme({ theme: next });
}

export function getTheme() { return { ...current }; }
export function setTheme(theme) { applyTheme({ theme }); }
export function setAccent(accent) { applyTheme({ accent }); }
export function setFontSize(size) { applyTheme({ fontSize: size }); }

export default {
  initTheme, applyTheme, cycleTheme, getTheme, setTheme, setAccent, setFontSize,
  THEMES, ACCENTS, FONT_SIZES,
};