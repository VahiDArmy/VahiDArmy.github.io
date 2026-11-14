/** Supabase singleton + consistent error normalisation. */
import { CONFIG } from '../config.js';

const lib = typeof window !== 'undefined' ? window.supabase : null;

if (!lib || typeof lib.createClient !== 'function') {
  // A hard failure is better than silent data loss. The boot screen displays this.
  throw new Error(
    '[معراج] The vendored Supabase client did not load. Check src/vendor/supabase.js and that index.html loads it before src/main.js.',
  );
}

export const supabase = lib.createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.publishableKey,
  CONFIG.supabase.auth,
);

export const TABLES = CONFIG.tables;

/**
 * Preserve everything Supabase tells us. We add a stable `message` for display
 * but never discard the original fields.
 */
export function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') {
    return {
      message: error,
      code: null,
      details: null,
      hint: null,
      status: null,
      name: 'Error',
      raw: error,
    };
  }
  return {
    message: error.message || error.error_description || error.msg || String(error),
    code: error.code || error.error_code || null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    status: error.status ?? error.statusCode ?? null,
    name: error.name || 'Error',
    raw: error,
  };
}

export function isMissingTableError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

export function supabaseUrl(path) {
  return `${CONFIG.supabase.url}${path}`;
}
