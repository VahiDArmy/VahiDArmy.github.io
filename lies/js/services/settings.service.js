/* ============================================================
   js/services/settings.service.js
   User preferences persisted in the user_settings table.
   Falls back to local storage for instant boot.
   ============================================================ */

import { getSupabase } from '../core/supabase.client.js';
import { TABLES } from '../config/constants.js';
import { get, set } from '../utils/storage.js';

const TABLE = TABLES.SETTINGS;
const LOCAL_KEY = 'user:settings';

const DEFAULTS = Object.freeze({
  theme: 'dark',
  accent: 'violet',
  font_size: 'md',
  sidebar_collapsed: false,
  lies_view: 'grid',
  lies_sort: 'created_desc',
  lies_page_size: 12,
  reminders_enabled: false,
  settings: {},
});

function normalize(row) {
  if (!row) return { ...DEFAULTS };
  return {
    theme: row.theme || DEFAULTS.theme,
    accent: row.accent || DEFAULTS.accent,
    font_size: row.font_size || DEFAULTS.font_size,
    sidebar_collapsed: !!row.sidebar_collapsed,
    lies_view: row.lies_view || DEFAULTS.lies_view,
    lies_sort: row.lies_sort || DEFAULTS.lies_sort,
    lies_page_size: row.lies_page_size || DEFAULTS.lies_page_size,
    reminders_enabled: !!row.reminders_enabled,
    settings: row.settings || {},
  };
}

/**
 * Get settings from local cache (instant, no network).
 * @returns {typeof DEFAULTS}
 */
export function getLocal() {
  return { ...DEFAULTS, ...(get(LOCAL_KEY, {}) || {}) };
}

/**
 * Persist settings locally (used for instant boot before server responds).
 * @param {object} patch
 */
export function setLocal(patch) {
  set(LOCAL_KEY, { ...getLocal(), ...patch });
}

/**
 * Fetch settings from the server (falls back to defaults).
 * @returns {Promise<typeof DEFAULTS>}
 */
export async function fetch() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getLocal();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.warn('[settings] fetch failed', error);
    return getLocal();
  }
  if (!data) {
    // No row yet → create with defaults
    const { data: inserted, error: insErr } = await supabase
      .from(TABLE)
      .insert({ user_id: user.id })
      .select('*')
      .single();
    if (insErr) {
      console.warn('[settings] insert failed', insErr);
      return getLocal();
    }
    const norm = normalize(inserted);
    setLocal(norm);
    return norm;
  }
  const norm = normalize(data);
  setLocal(norm);
  return norm;
}

/**
 * Update settings (partial). Upserts to handle first call.
 * @param {Partial<typeof DEFAULTS>} patch
 * @returns {Promise<typeof DEFAULTS>}
 */
export async function update(patch) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const clean = {};
  if (typeof patch.theme === 'string') clean.theme = patch.theme;
  if (typeof patch.accent === 'string') clean.accent = patch.accent;
  if (typeof patch.font_size === 'string') clean.font_size = patch.font_size;
  if (typeof patch.sidebar_collapsed === 'boolean') clean.sidebar_collapsed = patch.sidebar_collapsed;
  if (typeof patch.lies_view === 'string') clean.lies_view = patch.lies_view;
  if (typeof patch.lies_sort === 'string') clean.lies_sort = patch.lies_sort;
  if (typeof patch.lies_page_size === 'number') clean.lies_page_size = Math.max(6, Math.min(200, patch.lies_page_size));
  if (typeof patch.reminders_enabled === 'boolean') clean.reminders_enabled = patch.reminders_enabled;
  if (patch.settings && typeof patch.settings === 'object') clean.settings = patch.settings;

  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ user_id: user.id, ...clean }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;

  const norm = normalize(data);
  setLocal(norm);
  return norm;
}

export default { getLocal, setLocal, fetch, update, DEFAULTS };