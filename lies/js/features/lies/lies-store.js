/* ============================================================
   js/features/lies/lies-store.js
   UPDATED: loadReferenceData now fetches lieTypes and moods.
   ============================================================ */

import { Store } from '../../core/store.js';
import * as liesService from '../../services/lies.service.js';
import * as categoriesService from '../../services/categories.service.js';
import * as tagsService from '../../services/tags.service.js';
import * as taxonomyService from '../../services/taxonomy.service.js';
import * as storage from './lies-storage.js';
import { bus } from '../../core/event-bus.js';
import { EVENTS } from '../../config/constants.js';

export const liesStore = new Store({
  items: [],
  categories: [],
  tags: [],
  lieTypes: [],
  moods: [],
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
}, { name: 'lies' });

export async function loadFirstPage(opts = {}) {
  const { silent = false } = opts;
  if (!silent) liesStore.set({ loading: true, error: null });

  const state = liesStore.getState();
  try {
    const [result, counts] = await Promise.all([
      liesService.list({ ...state.filters, sort: state.sort, page: 1, pageSize: state.pageSize, withCount: true, withTags: true }),
      liesService.counts().catch(() => state.counts),
    ]);
    liesStore.set({ items: result.items, total: result.total, page: 1, hasMore: result.hasMore, loading: false, error: null, counts, lastAnchorId: null });
  } catch (err) {
    console.error('[lies-store] load failed', err);
    liesStore.set({ loading: false, error: err.message || 'خطا' });
  }
}

export async function loadMore() {
  const s = liesStore.getState();
  if (s.loadingMore || !s.hasMore) return;
  liesStore.set({ loadingMore: true });
  try {
    const next = s.page + 1;
    const result = await liesService.list({ ...s.filters, sort: s.sort, page: next, pageSize: s.pageSize, withCount: false, withTags: true });
    liesStore.set({ items: [...s.items, ...result.items], page: next, hasMore: result.hasMore, loadingMore: false });
  } catch (err) { liesStore.set({ loadingMore: false }); }
}

export async function refresh() { await loadFirstPage({ silent: false }); }

export async function gotoPage(page) {
  liesStore.set({ loading: true, page });
  try {
    const s = liesStore.getState();
    const result = await liesService.list({ ...s.filters, sort: s.sort, page, pageSize: s.pageSize, withCount: true, withTags: true });
    liesStore.set({ items: result.items, total: result.total, page, hasMore: result.hasMore, loading: false });
  } catch (err) { liesStore.set({ loading: false, error: err.message }); }
}

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

export function setSort(sort) { storage.setSort(sort); liesStore.set({ sort }); loadFirstPage(); }
export function setView(view) { storage.setView(view); liesStore.set({ view }); }
export function setPageSize(size) { storage.setPageSize(size); liesStore.set({ pageSize: Number(size), page: 1 }); loadFirstPage(); }

export async function loadReferenceData() {
  const s = liesStore.getState();
  const tasks = [];
  if (!s.categories.length) tasks.push(categoriesService.list().then((c) => liesStore.set({ categories: c })).catch(() => {}));
  if (!s.tags.length) tasks.push(tagsService.list().then((t) => liesStore.set({ tags: t })).catch(() => {}));
  if (!s.lieTypes.length) tasks.push(taxonomyService.listTypes().then((t) => liesStore.set({ lieTypes: t })).catch(() => {}));
  if (!s.moods.length) tasks.push(taxonomyService.listMoods().then((m) => liesStore.set({ moods: m })).catch(() => {}));
  await Promise.all(tasks);
}

export function patchItem(id, patch) {
  const s = liesStore.getState();
  liesStore.set({ items: s.items.map((it) => it.id === id ? { ...it, ...patch } : it) });
}

export function removeItems(ids) {
  const s = liesStore.getState();
  const set = new Set(ids);
  liesStore.set({ items: s.items.filter((it) => !set.has(it.id)), selection: new Set([...s.selection].filter((id) => !set.has(id))), total: Math.max(0, s.total - ids.length) });
}

export function prependItem(item) { liesStore.set({ items: [item, ...liesStore.get('items')], total: liesStore.get('total') + 1 }); }

export function upsertItem(item) {
  const s = liesStore.getState();
  const idx = s.items.findIndex((it) => it.id === item.id);
  if (idx === -1) return prependItem(item);
  const items = [...s.items]; items[idx] = item; liesStore.set({ items });
}

export function selectItem(id, opts = {}) {
  const { mode = 'toggle' } = opts;
  const s = liesStore.getState();
  const next = new Set(s.selection);
  if (mode === 'single') { next.clear(); next.add(id); liesStore.set({ selection: next, lastAnchorId: id }); return; }
  if (mode === 'range' && s.lastAnchorId) {
    const a = s.items.findIndex((it) => it.id === s.lastAnchorId);
    const b = s.items.findIndex((it) => it.id === id);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) next.add(s.items[i].id);
      liesStore.set({ selection: next }); return;
    }
  }
  if (next.has(id)) next.delete(id); else next.add(id);
  liesStore.set({ selection: next, lastAnchorId: id });
}

export function clearSelection() { liesStore.set({ selection: new Set(), lastAnchorId: null }); }
export function selectAll() { liesStore.set({ selection: new Set(liesStore.get('items').map((it) => it.id)) }); }
export function invertSelection() {
  const s = liesStore.getState();
  const next = new Set();
  for (const it of s.items) if (!s.selection.has(it.id)) next.add(it.id);
  liesStore.set({ selection: next });
}
export function getSelectedItems() { const s = liesStore.getState(); return s.items.filter((it) => s.selection.has(it.id)); }

export default {
  liesStore, loadFirstPage, loadMore, refresh, gotoPage, updateFilters, resetFilters,
  setSort, setView, setPageSize, loadReferenceData, patchItem, removeItems,
  prependItem, upsertItem, selectItem, clearSelection, selectAll, invertSelection, getSelectedItems,
};