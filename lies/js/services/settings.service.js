/* ============================================================
   js/services/settings.service.js
   FIXED: Replaced getUser() (network request) with getSession() 
          (instant read from local storage). 
          Removed the artificial 3-second timeout entirely.
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

export function getLocal() {
  return { ...DEFAULTS, ...(get(LOCAL_KEY, {}) || {}) };
}

export function setLocal(patch) {
  set(LOCAL_KEY, { ...getLocal(), ...patch });
}

export async function fetch() {
  const supabase = getSupabase();
  
  let user = null;
  try {
    // 🛡️ FIX: Use getSession instead of getUser to avoid network timeout
    const { data } = await supabase.auth.getSession();
    user = data?.session?.user;
  } catch (err) {
    console.warn('[settings] getSession failed:', err);
    return getLocal();
  }

  if (!user) return getLocal();

  try {
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
      // Create default row
      const { data: inserted, error: insErr } = await supabase
        .from(TABLE)
        .insert({ user_id: user.id })
        .select('*')
        .single();
        
      if (insErr) return getLocal();
      
      const norm = normalize(inserted);
      setLocal(norm);
      return norm;
    }
    
    const norm = normalize(data);
    setLocal(norm);
    return norm;
  } catch (err) {
    console.warn('[settings] unexpected error', err);
    return getLocal();
  }
}

export async function update(patch) {
  const supabase = getSupabase();
  
  // 🛡️ FIX: Use getSession instead of getUser
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
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