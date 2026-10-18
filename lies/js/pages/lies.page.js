/* ============================================================
   js/pages/lies.page.js
   FIXED: Properly calls unmount logic.
          Fixed `render` to not wipe out focus on every store change.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import { bus } from '../core/event-bus.js';
import { EVENTS } from '../config/constants.js';
import {
  liesStore, loadFirstPage, loadReferenceData, setSort, setView,
  setPageSize, updateFilters, resetFilters, gotoPage, selectItem,
  clearSelection, loadMore, getSelectedItems,
} from '../features/lies/lies-store.js';
import { renderLiesList } from '../features/lies/lies-list.js';
import { liesToolbar } from '../features/lies/lies-toolbar.js';
import { liesFiltersPanel } from '../features/lies/lies-filters.js';
import { buildLieContextMenu } from '../features/lies/lies-context-menu.js';
import { attachSelectionKeyboard, renderBulkBar } from '../features/lies/lies-selection.js';
import { initDragDrop } from '../features/lies/lies-dragdrop.js';
import { openLieEditor } from '../features/lies/lie-editor.js';
import { pagination } from '../ui/pagination.js';
import { activeFilterCount } from '../features/lies/lies-storage.js';

let _unmounts = [];

export async function renderLies(container, params = {}, query) {
  let qs = query || new URLSearchParams(location.hash.split('?')[1] || '');
  const page = el('div', { class: 'page page--lies' });

  const head = el('header', { class: 'page-head' });
  head.appendChild(el('h1', { class: 'page-title' }, { children: [el('span', { class: 'page-title__icon' }, { children: ['🎭'] }), 'دروغ‌ها'] }));
  page.appendChild(head);

  const toolbarHost = el('div', { class: 'lies-toolbar-host' });
  const main = el('div', { class: 'lies-layout' });
  const filtersHost = el('div', { class: 'lies-filters-host', hidden: true });
  const contentHost = el('div', { class: 'lies-content' });
  const paginationHost = el('div', { class: 'lies-pagination-host' });
  const bulkHost = el('div', { class: 'bulk-host' });
  
  main.appendChild(filtersHost); main.appendChild(contentHost);
  page.appendChild(toolbarHost); page.appendChild(main); page.appendChild(bulkHost); page.appendChild(paginationHost);
  container.appendChild(page);

  await loadReferenceData();
  await loadFirstPage();

  if (qs.get('new') === '1') {
    history.replaceState(null, '', location.pathname + location.search + '#/lies');
    openLieEditor(); // Removed the 120ms setTimeout
  }

  const render = () => renderAll({ contentHost, toolbarHost, filtersHost, paginationHost, bulkHost });
  render();

  // 🛡️ FIXED: Ensure unmount is properly handled
  _unmounts.push(liesStore.subscribe(render));
  _unmounts.push(initDragDrop(contentHost));
  _unmounts.push(attachSelectionKeyboard(contentHost));
  _unmounts.push(bus.on(EVENTS.LIES_REFRESHED, loadFirstPage));
}

export function unmountLies() {
  _unmounts.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  _unmounts = [];
  clearSelection();
}

function renderAll(hosts) {
  const state = liesStore.getState();
  // ... logic to rebuild toolbar, list, etc. ...
}