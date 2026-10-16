/* ============================================================
   js/pages/lies.page.js
   Main page orchestrator for the lies list
   ============================================================ */

import { el, byId, clear } from '../utils/dom.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import { ROUTES } from '../config/app.config.js';
import { liesStore, loadFirstPage, loadReferenceData, setSort, setView, setPageSize, updateFilters, resetFilters, gotoPage, selectItem, clearSelection, loadMore } from '../features/lies/lies-store.js';
import { renderLiesList } from '../features/lies/lies-list.js';
import { liesToolbar } from '../features/lies/lies-toolbar.js';
import { liesFiltersPanel } from '../features/lies/lies-filters.js';
import { buildLieContextMenu } from '../features/lies/lies-context-menu.js';
import { attachSelectionKeyboard, renderBulkBar } from '../features/lies/lies-selection.js';
import { initDragDrop } from '../features/lies/lies-dragdrop.js';
import { openLieEditor } from '../features/lies/lie-editor.js';
import {
  bulkTrash, bulkArchive, bulkRestore, bulkHardDelete,
  bulkAddTag, bulkSetCategory, bulkTogglePin, bulkExport,
} from '../features/lies/lies-bulk-actions.js';
import { getSelectedItems } from '../features/lies/lies-store.js';
import { pagination } from '../ui/pagination.js';
import { toast } from '../ui/toast.js';
import { activeFilterCount } from '../features/lies/lies-storage.js';

let _unmounts = [];
let _container = null;

/**
 * Entry point — called by the router.
 * @param {HTMLElement} container
 * @param {URLSearchParams} query
 */
export async function renderLies(container, query = new URLSearchParams()) {
  _container = container;

  /* Layout: page-head + main grid (list + filters aside) */
  const page = el('div', { class: 'page page--lies' });

  /* Header */
  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['🎭'] }), 'دروغ‌ها'],
  }));
  headLeft.appendChild(el('p', { class: 'page-subtitle' }, {
    children: ['همهٔ دروغ‌هایی که تا حالا به خودت گفته‌ای — جست‌وجو، فیلتر، دسته‌بندی و بازنگری.'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  /* Toolbar host */
  const toolbarHost = el('div', { class: 'lies-toolbar-host' });
  page.appendChild(toolbarHost);

  /* Main layout: filters aside + content */
  const main = el('div', { class: 'lies-layout' });
  const filtersHost = el('div', { class: 'lies-filters-host', hidden: true });
  const contentHost = el('div', { class: 'lies-content' });
  main.appendChild(filtersHost);
  main.appendChild(contentHost);
  page.appendChild(main);

  /* Bulk bar host */
  const bulkHost = el('div', { class: 'bulk-host' });
  page.appendChild(bulkHost);

  /* Pagination host */
  const paginationHost = el('div', { class: 'lies-pagination-host' });
  page.appendChild(paginationHost);

  container.appendChild(page);

  /* Load data + reference in parallel */
  await loadReferenceData();
  await loadFirstPage();

  /* Open editor if ?new=1 */
  if (query.get('new') === '1') {
    setTimeout(() => openLieEditor(), 100);
  }

  /* Render pipeline */
  const render = () => renderAll({
    container, contentHost, toolbarHost, filtersHost, paginationHost, bulkHost,
  });

  render();

  /* Subscribe to store changes */
  const unsub = liesStore.subscribe(render);
  _unmounts.push(unsub);

  /* Drag & drop init */
  const detachDD = initDragDrop(contentHost);
  _unmounts.push(detachDD);

  /* Selection keyboard */
  const detachKey = attachSelectionKeyboard(contentHost);
  _unmounts.push(detachKey);

  /* Refresh on external changes */
  const onRefresh = async () => { await loadFirstPage(); };
  bus.on(EVENTS.LIES_REFRESHED, onRefresh);
  _unmounts.push(() => bus.off(EVENTS.LIES_REFRESHED, onRefresh));

  /* Listen for trash request from selection keyboard */
  const trashHandler = ({ items }) => bulkTrash(items.map((it) => it.id));
  bus.on('lies:request-trash', trashHandler);
  _unmounts.push(() => bus.off('lies:request-trash', trashHandler));
}

/* ── Unmount ──────────────────────────────────────────────── */

export function unmountLies() {
  _unmounts.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  _unmounts = [];
  clearSelection();
  _container = null;
}

/* ── Rendering ────────────────────────────────────────────── */

function renderAll(hosts) {
  const state = liesStore.getState();

  // Toolbar
  clear(hosts.toolbarHost);
  hosts.toolbarHost.appendChild(liesToolbar({
    state: {
      view: state.view,
      sort: state.sort,
      filters: state.filters,
      pageSize: state.pageSize,
      total: state.total,
      selection: state.selection,
    },
    onSearchChange: (q) => updateFilters({ query: q }),
    onSortChange: (s) => setSort(s),
    onViewChange: (v) => setView(v),
    onPageSizeChange: (n) => setPageSize(n),
    onToggleFilters: () => toggleFiltersPanel(hosts),
    onCreateNew: () => openLieEditor(),
  }));

  // Filters panel
  if (!hosts.filtersHost.hidden) {
    clear(hosts.filtersHost);
    hosts.filtersHost.appendChild(liesFiltersPanel({
      filters: state.filters,
      categories: state.categories,
      tags: state.tags,
      onApply: (patch) => updateFilters(patch),
      onReset: () => resetFilters(),
      onClose: () => toggleFiltersPanel(hosts, false),
    }));
  }

  // List
  clear(hosts.contentHost);
  const listState = {
    items: state.items,
    view: state.view,
    loading: state.loading,
    error: state.error,
    selection: state.selection,
    categories: state.categories,
    total: state.total,
    hasMore: state.hasMore,
    loadingMore: state.loadingMore,
    filtersAreActive: activeFilterCount() > 0 || !!state.filters.query,
    onOpen: (lie) => { location.hash = `#/lie/${lie.id}`; },
    onToggleSelect: (id, opts) => selectItem(id, opts),
    onContextMenu: (ev, lie) => buildLieContextMenu(ev, lie, {
      onRefresh: () => loadFirstPage(),
    }),
    onCreateNew: () => openLieEditor(),
    onResetFilters: () => resetFilters(),
    onLoadMore: () => loadMore(),
  };
  renderLiesList(hosts.contentHost, listState);

  // Bulk bar
  clear(hosts.bulkHost);
  if (state.selection.size > 0) {
    renderBulkBar(hosts.bulkHost, {
      onClear: () => clearSelection(),
      onTrash: () => bulkTrash(getSelectedItems().map((it) => it.id)),
      onArchive: () => bulkArchive(getSelectedItems().map((it) => it.id)),
      onRestore: () => bulkRestore(getSelectedItems().map((it) => it.id)),
      onTag: () => bulkAddTag(getSelectedItems().map((it) => it.id)),
      onCategory: () => bulkSetCategory(getSelectedItems().map((it) => it.id)),
      onPin: () => bulkTogglePin(getSelectedItems().map((it) => it.id)),
      onExport: () => bulkExport(getSelectedItems().map((it) => it.id)),
    });
  }

  // Pagination (only in grid/list views)
  clear(hosts.paginationHost);
  if (state.total > state.pageSize && state.view !== 'timeline') {
    hosts.paginationHost.appendChild(pagination({
      page: state.page,
      pageSize: state.pageSize,
      total: state.total,
      onChange: (p) => gotoPage(p),
      onPageSizeChange: (s) => setPageSize(s),
      showPageSize: false,
    }));
  }
}

/* ── Filters toggle ───────────────────────────────────────── */

function toggleFiltersPanel(hosts, force) {
  const open = force !== undefined ? force : hosts.filtersHost.hidden;
  hosts.filtersHost.hidden = !open;
  const layout = hosts.toolbarHost.parentElement?.querySelector('.lies-layout');
  layout?.classList.toggle('has-filters', open);
  if (open) {
    const state = liesStore.getState();
    clear(hosts.filtersHost);
    hosts.filtersHost.appendChild(liesFiltersPanel({
      filters: state.filters,
      categories: state.categories,
      tags: state.tags,
      onApply: (patch) => updateFilters(patch),
      onReset: () => resetFilters(),
      onClose: () => toggleFiltersPanel(hosts, false),
    }));
  }
}

export default { renderLies, unmountLies };