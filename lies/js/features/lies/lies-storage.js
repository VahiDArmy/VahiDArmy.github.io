/* ============================================================
   js/features/lies/lies-storage.js
   Persist view mode, sort, page size, filters, columns
   ============================================================ */

import { get, set } from '../../utils/storage.js';
import { LS_KEYS, VIEW_MODES, PAGE_SIZES, SORT_OPTIONS } from '../../config/app.config.js';

const DEFAULT_FILTERS = Object.freeze({
  query: '',
  type: 'all',
  status: 'active',
  categoryId: null,
  tagIds: [],
  mood: 'all',
  intensityMin: 0,
  intensityMax: 10,
  beliefMin: 0,
  beliefMax: 10,
  dateFrom: null,
  dateTo: null,
  pinnedOnly: false,
});

/* ── View ─────────────────────────────────────────────────── */

export function getView() {
  const v = get(LS_KEYS.LIES_VIEW, VIEW_MODES.GRID);
  return Object.values(VIEW_MODES).includes(v) ? v : VIEW_MODES.GRID;
}

export function setView(view) {
  if (!Object.values(VIEW_MODES).includes(view)) return;
  set(LS_KEYS.LIES_VIEW, view);
}

/* ── Sort ─────────────────────────────────────────────────── */

export function getSort() {
  const s = get(LS_KEYS.LIES_SORT, 'created_desc');
  return SORT_OPTIONS.some((o) => o.id === s) ? s : 'created_desc';
}

export function setSort(sort) {
  if (!SORT_OPTIONS.some((o) => o.id === sort)) return;
  set(LS_KEYS.LIES_SORT, sort);
}

/* ── Page size ────────────────────────────────────────────── */

export function getPageSize() {
  const s = Number(get(LS_KEYS.LIES_PAGE_SIZE, 24));
  return PAGE_SIZES.includes(s) ? s : 24;
}

export function setPageSize(size) {
  const n = Number(size);
  if (!PAGE_SIZES.includes(n)) return;
  set(LS_KEYS.LIES_PAGE_SIZE, n);
}

/* ── Filters ──────────────────────────────────────────────── */

export function getFilters() {
  const stored = get(LS_KEYS.LIES_FILTERS, {}) || {};
  return { ...DEFAULT_FILTERS, ...stored };
}

export function setFilters(patch) {
  const next = { ...getFilters(), ...patch };
  set(LS_KEYS.LIES_FILTERS, next);
  return next;
}

export function clearFilters() {
  set(LS_KEYS.LIES_FILTERS, { ...DEFAULT_FILTERS });
  return { ...DEFAULT_FILTERS };
}

/**
 * How many filter criteria are active.
 * @returns {number}
 */
export function activeFilterCount() {
  const f = getFilters();
  let n = 0;
  if (f.type && f.type !== 'all') n++;
  if (f.categoryId) n++;
  if (Array.isArray(f.tagIds) && f.tagIds.length) n++;
  if (f.mood && f.mood !== 'all') n++;
  if (f.intensityMin > 0 || f.intensityMax < 10) n++;
  if (f.beliefMin > 0 || f.beliefMax < 10) n++;
  if (f.dateFrom || f.dateTo) n++;
  if (f.pinnedOnly) n++;
  return n;
}

export { DEFAULT_FILTERS };