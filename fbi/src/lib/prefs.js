import { state, emit } from './state.js';
import { saveSettings } from './db.js';
import { applyTheme } from './themes.js';
import { setLocale } from './i18n.js';
import { toast } from '../ui/toast.js';

let saveTimer = 0;
let errorShown = false;

export function applySettings() {
  const s = state.settings || {};
  applyTheme(s.theme || 'nebula');
  setLocale(s.locale || 'en');
  document.documentElement.style.setProperty('--font-scale', String(s.fontScale || 1));
  document.documentElement.setAttribute('data-motion', s.reduceMotion ? 'off' : 'on');
}

/** Merge a patch into settings, apply to the DOM, and persist (debounced). */
export function updateSettings(patch, { persist = true } = {}) {
  state.settings = { ...state.settings, ...patch };
  if (patch.theme || patch.locale || patch.fontScale !== undefined || patch.reduceMotion !== undefined) {
    applySettings();
  }
  emit('settings-changed', state.settings);
  if (!persist || !state.user) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveSettings(state.user.id, state.settings);
      errorShown = false;
    } catch (error) {
      console.error('settings save failed', error);
      if (!errorShown) {
        errorShown = true;
        toast('Could not save settings to Supabase. Check your connection.', { type: 'err' });
      }
    }
  }, 550);
}

export function replaceSettings(next) {
  state.settings = next;
  applySettings();
  emit('settings-changed', state.settings);
}
