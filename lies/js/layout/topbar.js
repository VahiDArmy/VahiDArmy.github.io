/* ============================================================
   js/layout/topbar.js
   Breadcrumb, global search, actions, notifications badge
   ============================================================ */

import { el, byId, on } from '../utils/dom.js';
import { EVENTS } from '../config/constants.js';
import { LIMITS } from '../config/app.config.js';
import { bus } from '../core/event-bus.js';
import { debounce } from '../utils/debounce.js';
import { renderBreadcrumb, crumbsForPath } from './breadcrumb.js';
import { toast } from '../ui/toast.js';
import { liesService } from '../services/index.js';
import { toFaDigits, formatRelative } from '../utils/format.js';
import { escapeHtml } from '../utils/sanitize.js';

let searchInput = null;
let searchResults = null;
let breadcrumbEl = null;
let notifBadge = null;
let _searchAbort = 0;

/* ── Public API ─────────────────────────────────────────── */

export function mountTopbar() {
  breadcrumbEl = byId('topbar-breadcrumb');
  searchInput = byId('global-search');
  searchResults = byId('global-search-results');
  notifBadge = byId('notif-badge');

  wireBreadcrumb();
  wireSearch();
  wireActions();
}

export function setBreadcrumb(crumbs) {
  if (!breadcrumbEl) return;
  renderBreadcrumb(breadcrumbEl, crumbs);
}

export function setPageTitle(title) {
  const b = byId('topbar-breadcrumb');
  if (!b) return;
  // Overrides breadcrumb with a single title in compact view
  b.setAttribute('data-title', title || '');
}

/* ── Breadcrumb ─────────────────────────────────────────── */

function wireBreadcrumb() {
  bus.on(EVENTS.ROUTE_CHANGED, ({ path }) => {
    setBreadcrumb(crumbsForPath(path));
  });
}

/* ── Search ─────────────────────────────────────────────── */

function wireSearch() {
  if (!searchInput || !searchResults) return;

  const run = debounce(async (q) => {
    const query = String(q || '').trim();
    if (query.length < 2) {
      closeResults();
      return;
    }
    const token = ++_searchAbort;
    try {
      const rows = await liesService.search(query, LIMITS.globalSearchLimit);
      if (token !== _searchAbort) return;
      renderResults(rows, query);
    } catch (err) {
      console.warn('[topbar] search failed', err);
      closeResults();
    }
  }, LIMITS.searchDebounceMs);

  searchInput.addEventListener('input', (ev) => {
    run(ev.target.value);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2) run(searchInput.value);
  });

  searchInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      searchInput.blur();
      closeResults();
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const first = searchResults.querySelector('.search-result');
      first?.focus();
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const first = searchResults.querySelector('.search-result');
      if (first) first.click();
    }
  });

  document.addEventListener('mousedown', (ev) => {
    if (!searchResults.contains(ev.target) && ev.target !== searchInput && !searchInput.contains(ev.target)) {
      closeResults();
    }
  });

  // Focus shortcut
  bus.on('ui:focus-search', () => {
    searchInput?.focus();
    searchInput?.select();
  });
}

function renderResults(rows, query) {
  if (!searchResults) return;
  searchResults.innerHTML = '';

  if (!rows.length) {
    searchResults.appendChild(el('div', { class: 'search-result-empty' }, {
      children: ['نتیجه‌ای برای «' + query + '» پیدا نشد.'],
    }));
    openResults();
    return;
  }

  for (const r of rows) {
    const a = el('button', {
      class: 'search-result',
      attrs: { type: 'button' },
      on: {
        click: () => {
          location.hash = `#/lie/${r.id}`;
          closeResults();
          searchInput?.blur();
        },
      },
    });

    const left = el('div', { class: 'search-result__icon' }, { children: ['🎭'] });
    const mid = el('div', { class: 'search-result__body' });
    const title = el('div', { class: 'search-result__title' }, { children: [r.title] });
    mid.appendChild(title);
    if (r.body) {
      const snippet = String(r.body).slice(0, 90);
      mid.appendChild(el('div', { class: 'search-result__snippet' }, { children: [snippet + (r.body.length > 90 ? '…' : '')] }));
    }
    const right = el('div', { class: 'search-result__meta' }, { children: [formatRelative(r.updated_at || r.created_at)] });

    a.appendChild(left);
    a.appendChild(mid);
    a.appendChild(right);
    searchResults.appendChild(a);
  }

  openResults();
}

function openResults() {
  if (!searchResults) return;
  searchResults.hidden = false;
  requestAnimationFrame(() => searchResults.classList.add('is-open'));
}

function closeResults() {
  if (!searchResults) return;
  searchResults.classList.remove('is-open');
  setTimeout(() => { searchResults.hidden = true; }, 160);
}

/* ── Actions ────────────────────────────────────────────── */

function wireActions() {
  // Mobile menu
  byId('mobile-menu-btn')?.addEventListener('click', async () => {
    const mod = await import('./sidebar.js');
    if (mod.isMobileSidebarOpen()) mod.closeMobileSidebar();
    else mod.openMobileSidebar();
  });

  byId('sidebar-backdrop')?.addEventListener('click', async () => {
    const mod = await import('./sidebar.js');
    mod.closeMobileSidebar();
  });

  // Sidebar collapse (desktop)
  byId('sidebar-collapse-btn')?.addEventListener('click', async () => {
    const mod = await import('./sidebar.js');
    mod.toggleCollapsed();
  });

  // Quick add
  byId('quick-add-btn')?.addEventListener('click', () => {
    location.hash = '#/lies?new=1';
  });

  // Theme toggle
  byId('theme-toggle-btn')?.addEventListener('click', async () => {
    const mod = await import('../ui/theme.js');
    mod.cycleTheme();
    const t = mod.getTheme();
    const label = t.theme === 'light' ? 'روشن' : t.theme === 'midnight' ? 'نیمه‌شب' : t.theme === 'obsidian' ? 'اُبسیدیَن' : 'تاریک';
    toast.info(`تم: ${label}`, { duration: 1800 });
  });

  // Notifications
  byId('notifications-btn')?.addEventListener('click', () => {
    toast.info('یادآور فعالی وجود ندارد.', { duration: 2200 });
  });

  // Help
  byId('help-btn')?.addEventListener('click', async () => {
    const { shortcuts } = await import('../core/shortcuts.js');
    const { openModal } = await import('../ui/modal.js');
    openShortcutsModal(shortcuts);
  });
}

/**
 * Open a modal listing every keyboard shortcut.
 * @param {any} shortcuts
 */
function openShortcutsModal(shortcuts) {
  import('../ui/modal.js').then(({ openModal }) => {
    const groups = shortcuts.grouped();
    const body = el('div', { class: 'shortcuts-list' });
    for (const g of groups) {
      const section = el('div', { class: 'shortcuts-group' });
      section.appendChild(el('h4', { class: 'shortcuts-group__title' }, { children: [g.group] }));
      for (const item of g.items) {
        const row = el('div', { class: 'shortcut-row' });
        row.appendChild(el('span', { class: 'shortcut-row__label' }, { children: [item.label] }));
        const keys = el('span', { class: 'shortcut-row__keys' });
        for (const part of item.combo.split(/[\s+]+/)) {
          const k = el('kbd', {}, { children: [part.toUpperCase() === 'CTRL' ? 'Ctrl' : part.length === 1 ? part.toUpperCase() : part] });
          keys.appendChild(k);
        }
        row.appendChild(keys);
        section.appendChild(row);
      }
      body.appendChild(section);
    }
    openModal({ title: 'میان‌برهای کیبورد', icon: '⌨️', size: 'md', content: body });
  });
}

/**
 * Set the notifications badge number.
 * @param {number} n
 */
export function setNotificationsBadge(n) {
  if (!notifBadge) return;
  if (!n) { notifBadge.hidden = true; notifBadge.textContent = ''; return; }
  notifBadge.hidden = false;
  notifBadge.textContent = n > 9 ? '۹+' : toFaDigits(n);
}

export default { mountTopbar, setBreadcrumb, setPageTitle, setNotificationsBadge };