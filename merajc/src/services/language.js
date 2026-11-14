/** Change the interface language: apply live, keep it on this device, and save it to the profile. */
import { state, setState } from '../store.js';
import { saveSettings } from './settings.js';
import { saveProfilePreferences } from './db.js';
import { normalizeLanguage, setLocale } from '../i18n/index.js';

export async function changeLanguage(id) {
  const language = normalizeLanguage(id);
  setLocale(language);
  setState({ settings: saveSettings({ language }) }, 'settings-changed');
  if (!state.user) return { language, saved: false, error: null }; // signed out: device only
  const { data, error } = await saveProfilePreferences(state.user.id, state.profile?.preferences, { language });
  if (error) return { language, saved: false, error };
  setState(
    { profile: data || { ...(state.profile || {}), preferences: { ...(state.profile?.preferences || {}), language } } },
    'profile-updated',
  );
  return { language, saved: true, error: null };
}
