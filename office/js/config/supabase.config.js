/**
 * Supabase configuration.
 * Public anon/publishable key — safe to expose. All data access is
 * enforced by Row Level Security (see supabase/rls.sql).
 */

export const SUPABASE_URL =
  window.__SUPABASE_URL__ ||
  'https://nvmevqkaovazhmoznusf.supabase.co';

export const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY__ ||
  'sb_publishable_AuneSCRLhrKKDeK8q7kJtw_Bg4VNHgE';

/** Where Supabase should redirect after email confirmation / OAuth. */
export const AUTH_REDIRECT_PATH = '/auth/callback';

/**
 * Tables that must exist in Supabase (see /supabase/schema.sql)
 * Kept here so services can reference names safely.
 */
export const TABLES = Object.freeze({
  PROFILES:        'profiles',
  PEOPLE:          'people',
  THEORIES:        'theories',
  THEORY_VOTES:    'theory_votes',
  THEORY_COMMENTS: 'theory_comments',
  RANKINGS:        'rankings',
  RANKING_ENTRIES: 'ranking_entries',
  DATA_TABLES:     'data_tables',
  DATA_COLUMNS:    'data_columns',
  DATA_ROWS:       'data_rows',
  STORIES:         'stories',
  PROJECTS:        'projects',
  PERSON_LINKS:    'person_links',
  TELLALLS:        'tellalls',
  TELLALL_ENTRIES: 'tellall_entries',
  AUDIT_LOG:       'audit_log',
});