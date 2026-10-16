/* ============================================================
   js/features/lies/lies-store.js
   Local state machine for the lies page
   ============================================================ */

import { Store } from '../../core/store.js';
import * as liesService from '../../services/lies.service.js';
import * as categoriesService from '../../services/categories.service.js';
import * as tagsService from '../../services/tags.service.js';
import * as storage from './lies-storage.js';
import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';

/**
 * @typedef {Object} LiesState
 * @property {any[]} items
 * @property {any[]} categories
 * @property {any[]} tags
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {string} view
 * @property {string} sort
 * @property {object} filters
 * @property {Set<string>} selection
 * @property {boolean} loading
 * @property {boolean} loadingMore
 * @property {boolean} hasMore
 * @property {string|null} error
 * @property {string|null} lastAnchorId  for shift-click
 * @property {any} counts  {active, archived, trashed}
 */

export const liesStore = new Store(
  {
    items: [],
    categories: [],
    tags: [],
    total: 0,
    page: 1,
    pageSize: storage.getPageSize(),
    view: storage.getView(),
    sort: storage.getSort(),
    filters: storage.getFilters(),
    selection: new Set(),
    loading: false,
    loadingMore: false,
    hasMore: false,
    error: null,
    lastAnchorId: null,
    counts: { active: 0, archived: 0, trashed: 0 },
  },
  { name: 'lies' }
);

/* ── Loading ──────────────────────────────────────────────── */

/**
 * Load first page from server.
 * @param {{silent?:boolean}} [opts]
 */
export async function loadFirstPage(opts = {}) {
  const { silent = false } = opts;
  if (!silent) liesStore.set({ loading: true, error: null });

  const state = liesStore.getState();
  try {
    const [result, counts] = await Promise.all([
      liesService.list({
        ...state.filters,
        sort: state.sort,
        page: 1,
        pageSize: state.pageSize,
        withCount: true,
        withTags: true,
      }),
      liesService.counts().catch(() => state.counts),
    ]);

    liesStore.set({
      items: result.items,
      total: result.total,
      page: 1,
      hasMore: result.hasMore,
      loading: false,
      error: null,
      counts,
      lastAnchorId: null,
    });
  } catch (err) {
    console.error('[lies-store] load failed', err);
    liesStore.set({ loading: false, error: err.message || 'خطا در بارگذاری' });
  }
}

/**
 * Load next page (append).
 */
export async function loadMore() {
  const s = liesStore.getState();
  if (s.loadingMore || !s.hasMore) return;
  liesStore.set({ loadingMore: true });

  try {
    const next = s.page + 1;
    const result = await liesService.list({
      ...s.filters,
      sort: s.sort,
      page: next,
      pageSize: s.pageSize,
      withCount: false,
      withTags: true,
    });
    liesStore.set({
      items: [...s.items, ...result.items],
      page: next,
      hasMore: result.hasMore,
      loadingMore: false,
    });
  } catch (err) {
    console.error('[lies-store] loadMore failed', err);
    liesStore.set({ loadingMore: false });
  }
}

/**
 * Refresh current view preserving scroll and filters.
 */
export async function refresh() {
  await loadFirstPage({ silent: false });
}

/**
 * Go to a specific page.
 * @param {number} page
 */
export async function gotoPage(page) {
  const s = liesStore.getState();
  if (page < 1 || page === s.page && s.items.length) {
    // still refresh
  }
  liesStore.set({ loading: true, page });
  try {
    const result = await liesService.list({
      ...s.filters,
      sort: s.sort,
      page,
      pageSize: s.pageSize,
      withCount: true,
      withTags: true,
    });
    liesStore.set({
      items: result.items,
      total: result.total,
      page,
      hasMore: result.hasMore,
      loading: false,
    });
  } catch (err) {
    liesStore.set({ loading: false, error: err.message });
  }
}

/* ── Filters / sort / view ────────────────────────────────── */

/**
 * @param {object} patch
 */
export function updateFilters(patch) {
  const next = storage.setFilters(patch);
  liesStore.set({ filters: next });
  loadFirstPage();
}

export function resetFilters() {
  const next = storage.clearFilters();
  liesStore.set({ filters: next, page: 1 });
  loadFirstPage();
}

export function setSort(sort) {
  storage.setSort(sort);
  liesStore.set({ sort });
  loadFirstPage();
}

export function setView(view) {
  storage.setView(view);
  liesStore.set({ view });
}

export function setPageSize(size) {
  storage.setPageSize(size);
  liesStore.set({ pageSize: Number(size), page: 1 });
  loadFirstPage();
}

/* ── Reference data ───────────────────────────────────────── */

/**
 * Load categories + tags (idempotent).
 */
export async function loadReferenceData() {
  const s = liesStore.getState();
  const tasks = [];
  if (!s.categories.length) {
    tasks.push(categoriesService.list().then((categories) => liesStore.set({ categories })).catch(() => {}));
  }
  if (!s.tags.length) {
    tasks.push(tagsService.list().then((tags) => liesStore.set({ tags })).catch(() => {}));
  }
  await Promise.all(tasks);
}

/* ── Mutations ────────────────────────────────────────────── */

/**
 * Optimistic update of a single item in the list.
 * @param {string} id
 * @param {object} patch
 */
export function patchItem(id, patch) {
  const s = liesStore.getState();
  const items = s.items.map((it) => it.id === id ? { ...it, ...patch } : it);
  liesStore.set({ items });
}

/**
 * Remove items from the list.
 * @param {string[]} ids
 */
export function removeItems(ids) {
  const s = liesStore.getState();
  const set = new Set(ids);
  const items = s.items.filter((it) => !set.has(it.id));
  const selection = new Set([...s.selection].filter((id) => !set.has(id)));
  liesStore.set({ items, selection, total: Math.max(0, s.total - ids.length) });
}

/**
 * Insert a new item at the top.
 * @param {any} item
 */
export function prependItem(item) {
  const s = liesStore.getState();
  liesStore.set({
    items: [item, ...s.items],
    total: s.total + 1,
    counts: { ...s.counts, active: s.counts.active + 1 },
  });
}

/**
 * Update an item in place.
 * @param {any} item
 */
export function upsertItem(item) {
  const s = liesStore.getState();
  const idx = s.items.findIndex((it) => it.id === item.id);
  if (idx === -1) return prependItem(item);
  const items = [...s.items];
  items[idx] = item;
  liesStore.set({ items });
}

/* ── Selection ────────────────────────────────────────────── */

/**
 * @param {string} id
 * @param {{mode?:'single'|'toggle'|'range'}} [opts]
 */
export function selectItem(id, opts = {}) {
  const { mode = 'toggle' } = opts;
  const s = liesStore.getState();
  const next = new Set(s.selection);
  const items = s.items;

  if (mode === 'single') {
    next.clear();
    next.add(id);
    liesStore.set({ selection: next, lastAnchorId: id });
    bus.emit(EVENTS.LIES_SELECTION_CHANGED, { selection: next });
    return;
  }

  if (mode === 'range' && s.lastAnchorId) {
    const a = items.findIndex((it) => it.id === s.lastAnchorId);
    const b = items.findIndex((it) => it.id === id);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) next.add(items[i].id);
      liesStore.set({ selection: next });
      bus.emit(EVENTS.LIES_SELECTION_CHANGED, { selection: next });
      return;
    }
  }

  // toggle
  if (next.has(id)) next.delete(id);
  else next.add(id);
  liesStore.set({ selection: next, lastAnchorId: id });
  bus.emit(EVENTS.LIES_SELECTION_CHANGED, { selection: next });
}

export function clearSelection() {
  liesStore.set({ selection: new Set(), lastAnchorId: null });
  bus.emit(EVENTS.LIES_SELECTION_CHANGED, { selection: new Set() });
}

export function selectAll() {
  const s = liesStore.getState();
  const next = new Set(s.items.map((it) => it.id));
  liesStore.set({ selection: next });
  bus.emit(EVENTS.LIES_SELECTION_CHANGED, { selection: next });
}

export function invertSelection() {
  const s = liesStore.getState();
  const next = new Set();
  for (const it of s.items) if (!s.selection.has(it.id)) next.add(it.id);
  liesStore.set({ selection: next });
  bus.emit(EVENTS.LIES_SELECTION_CHANGED, { selection: next });
}

export function getSelectedItems() {
  const s = liesStore.getState();
  return s.items.filter((it) => s.selection.has(it.id));
}

/* ── Auto-refresh hooks ──────────────────────────────────── */

bus.on(EVENTS.LIES_REFRESHED, () => {
  // Only auto-refresh if the page is currently visible (avoid background churn)
  if (document.visibilityState === 'visible' && liesStore.get('items').length >= 0) {
    // We don't blindly reload; the page component decides.
  }
});

export default {
  liesStore,
  loadFirstPage, loadMore, refresh, gotoPage,
  updateFilters, resetFilters, setSort, setView, setPageSize,
  loadReferenceData,
  patchItem, removeItems, prependItem, upsertItem,
  selectItem, clearSelection, selectAll, invertSelection, getSelectedItems,
};