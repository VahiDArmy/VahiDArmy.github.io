/**
 * Local-first database.
 *
 * Every table in `schema (2).sql` exists here as an array of typed rows. The
 * store is the single source of truth for the UI: mutations emit once, persist
 * once (debounced), and append to the activity ledger. Nothing leaves this
 * device except AI requests the operator explicitly sends.
 */

import { useSyncExternalStore } from 'react';
import type {
  Activity,
  DatabaseShape,
  TableName,
  Title,
  AiUsageRow,
} from '../types';
import { buildSeedDatabase } from './seed';
import { nowIso, safeJsonParse, uid } from '../lib/utils';
import { SCHEMA_TABLES } from '../types';

export const DB_STORAGE_KEY = 'fmc.v2.db';
export const DB_VERSION = 2;

interface Envelope {
  version: number;
  saved_at: string;
  db: DatabaseShape;
}

type Row = { id: string } & Record<string, unknown>;

function emptyDb(): DatabaseShape {
  const shape: Record<string, unknown[]> = {};
  for (const table of Object.keys(buildSeedDatabase()) as TableName[]) shape[table] = [];
  return shape as unknown as DatabaseShape;
}

function normalise(input: Partial<DatabaseShape> | null | undefined): DatabaseShape {
  const base = emptyDb();
  if (!input) return base;
  for (const table of Object.keys(base) as TableName[]) {
    const value = (input as Record<string, unknown>)[table];
    if (Array.isArray(value)) {
      (base as unknown as Record<string, unknown[]>)[table] = value;
    }
  }
  return base;
}

function load(): DatabaseShape {
  if (typeof window === 'undefined') return buildSeedDatabase();
  try {
    const raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (!raw) return buildSeedDatabase();
    const parsed = safeJsonParse<Envelope>(raw);
    if (!parsed?.db) return buildSeedDatabase();
    const db = normalise(parsed.db);
    const titleCount = db.cinema_titles.length;
    if (!titleCount) {
      // A deliberately emptied shelf must not be re-seeded on reload.
      return db;
    }
    return db;
  } catch {
    return buildSeedDatabase();
  }
}

let state: DatabaseShape = load();
if (typeof window !== 'undefined' && !window.localStorage.getItem(DB_STORAGE_KEY)) {
  persistNow();
}

const listeners = new Set<() => void>();
let saveTimer: number | null = null;

function persistNow(): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: Envelope = { version: DB_VERSION, saved_at: nowIso(), db: state };
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.warn('[FMC] The local database could not be persisted.', error);
  }
}

function schedulePersist(): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, 260);
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDb(): DatabaseShape {
  return state;
}

export function useDb(): DatabaseShape {
  return useSyncExternalStore(subscribe, getDb, getDb);
}

export function replaceDb(next: DatabaseShape): void {
  state = normalise(next);
  schedulePersist();
  emit();
}

export function resetDb(): void {
  state = buildSeedDatabase();
  persistNow();
  emit();
}

export function clearDb(): void {
  const shape = emptyDb();
  state = shape;
  persistNow();
  emit();
}

function commit(next: DatabaseShape): void {
  state = next;
  schedulePersist();
  emit();
}

/* ── generic row operations ────────────────────────────────────────────── */

type RowOf<T extends TableName> = DatabaseShape[T][number];

export function insertRow<T extends TableName>(
  table: T,
  patch: Partial<RowOf<T>> & { id?: string },
): RowOf<T> {
  const stamp = nowIso();
  const row = {
    id: patch.id ?? uid(table.replace('cinema_', '').slice(0, 6)),
    created_at: stamp,
    updated_at: stamp,
    ...patch,
  } as RowOf<T>;
  const list = state[table] as unknown as Row[];
  commit({ ...state, [table]: [row as unknown as Row, ...list] } as DatabaseShape);
  return row;
}

export function updateRow<T extends TableName>(
  table: T,
  id: string,
  patch: Partial<RowOf<T>>,
): void {
  const list = state[table] as unknown as Row[];
  const index = list.findIndex((row) => row.id === id);
  if (index < 0) return;
  const next = [...list];
  next[index] = { ...next[index], ...patch, updated_at: nowIso() };
  commit({ ...state, [table]: next } as DatabaseShape);
}

export function patchRows<T extends TableName>(
  table: T,
  ids: string[],
  patch: Partial<RowOf<T>>,
): void {
  const idSet = new Set(ids);
  const list = (state[table] as unknown as Row[]).map((row) =>
    idSet.has(row.id) ? { ...row, ...patch, updated_at: nowIso() } : row,
  );
  commit({ ...state, [table]: list } as DatabaseShape);
}

export function removeRow<T extends TableName>(table: T, id: string): void {
  const list = state[table] as unknown as Row[];
  commit({ ...state, [table]: list.filter((row) => row.id !== id) } as DatabaseShape);
}

export function removeRows<T extends TableName>(table: T, ids: string[]): void {
  const idSet = new Set(ids);
  const list = state[table] as unknown as Row[];
  commit({ ...state, [table]: list.filter((row) => !idSet.has(row.id)) } as DatabaseShape);
}

export function upsertRow<T extends TableName>(
  table: T,
  row: Partial<RowOf<T>> & { id: string },
): RowOf<T> {
  const list = state[table] as unknown as Row[];
  const index = list.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    const next = [...list];
    next[index] = { ...next[index], ...row, updated_at: nowIso() };
    commit({ ...state, [table]: next } as DatabaseShape);
    return next[index] as unknown as RowOf<T>;
  }
  return insertRow(table, row);
}

/* ── activity ledger ───────────────────────────────────────────────────── */

export function logActivity(
  action: string,
  entity: string | null,
  entityId: string | null,
  detail: string,
): Activity {
  return insertRow('cinema_activity', {
    action,
    entity,
    entity_id: entityId,
    detail,
  } as Partial<Activity>);
}

export function logUsage(row: Omit<AiUsageRow, 'id' | 'created_at' | 'updated_at'>): AiUsageRow {
  return insertRow('cinema_ai_usage', row as Partial<AiUsageRow>);
}

/* ── cascade helpers ───────────────────────────────────────────────────── */

/**
 * Deleting a title must not leave orphaned joins. The Postgres schema uses
 * `on delete cascade`; this is the local equivalent, spelled out.
 */
export function deleteTitle(id: string): void {
  const strip = <T extends { id: string }>(rows: T[]): T[] => rows.filter((row) => row.id !== id);
  const byTitle = <T extends { title_id?: string | null }>(rows: T[]): T[] =>
    rows.filter((row) => row.title_id !== id);
  commit({
    ...state,
    cinema_titles: strip(state.cinema_titles),
    cinema_collection_items: byTitle(state.cinema_collection_items),
    cinema_ratings: byTitle(state.cinema_ratings),
    cinema_watchlist: byTitle(state.cinema_watchlist),
    cinema_watch_sessions: byTitle(state.cinema_watch_sessions),
    cinema_credits: byTitle(state.cinema_credits),
    cinema_quotes: byTitle(state.cinema_quotes),
    cinema_trivia: byTitle(state.cinema_trivia),
    cinema_awards: byTitle(state.cinema_awards),
    cinema_mizan_notes: byTitle(state.cinema_mizan_notes),
    cinema_shares: byTitle(state.cinema_shares),
    cinema_relationships: state.cinema_relationships.filter(
      (row) => row.title_id !== id && row.related_title_id !== id,
    ),
    cinema_events: state.cinema_events.map((row) =>
      row.title_id === id ? { ...row, title_id: null } : row,
    ),
  });
  logActivity('deleted', 'cinema_titles', id, 'Title removed from the shelf');
}

export function deleteCollection(id: string): void {
  commit({
    ...state,
    cinema_collections: state.cinema_collections.filter((row) => row.id !== id),
    cinema_collection_items: state.cinema_collection_items.filter((row) => row.collection_id !== id),
  });
  logActivity('deleted', 'cinema_collections', id, 'Collection removed');
}

export function deletePerson(id: string): void {
  commit({
    ...state,
    cinema_people: state.cinema_people.filter((row) => row.id !== id),
    cinema_credits: state.cinema_credits.filter((row) => row.person_id !== id),
  });
  logActivity('deleted', 'cinema_people', id, 'Person removed from the index');
}

export function deleteThread(id: string): void {
  commit({
    ...state,
    cinema_ai_threads: state.cinema_ai_threads.filter((row) => row.id !== id),
    cinema_ai_turns: state.cinema_ai_turns.filter((row) => row.thread_id !== id),
  });
}

/* ── meta key/value ────────────────────────────────────────────────────── */

export function setMeta(k: string, v: string): void {
  const existing = state.cinema_meta.find((row) => row.k === k);
  if (existing) {
    commit({
      ...state,
      cinema_meta: state.cinema_meta.map((row) => (row.k === k ? { ...row, v } : row)),
    });
    return;
  }
  commit({ ...state, cinema_meta: [...state.cinema_meta, { k, v, user_id: null }] });
}

export function getMeta(k: string): string | null {
  return state.cinema_meta.find((row) => row.k === k)?.v ?? null;
}

/* ── backup / restore ──────────────────────────────────────────────────── */

export function exportDatabase(): string {
  const envelope: Envelope = { version: DB_VERSION, saved_at: nowIso(), db: state };
  return JSON.stringify(envelope, null, 2);
}

export function importDatabase(text: string): { ok: boolean; message: string; count?: number } {
  const parsed = safeJsonParse<Envelope | DatabaseShape>(text);
  if (!parsed) return { ok: false, message: 'That file is not valid JSON.' };
  const candidate = (parsed as Envelope).db ?? (parsed as DatabaseShape);
  if (!Array.isArray((candidate as DatabaseShape).cinema_titles)) {
    return { ok: false, message: 'The file has no cinema_titles array, so it is not an FMC backup.' };
  }
  state = normalise(candidate as DatabaseShape);
  persistNow();
  emit();
  return {
    ok: true,
    message: `Restored ${state.cinema_titles.length} titles and ${SCHEMA_TABLES.length} tables.`,
    count: state.cinema_titles.length,
  };
}

/** Manual save, for the settings screen's "write now" control. */
export function flush(): void {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  persistNow();
}

/** Storage footprint in bytes. */
export function storageFootprint(): number {
  try {
    return new Blob([exportDatabase()]).size;
  } catch {
    return exportDatabase().length;
  }
}

export type { Title };
