// Sidebar navigation + auxiliary sidebar panel.

import { el, clear } from '../utils/dom.js';
import { State, subscribe, getStats } from '../core/state.js';
import { fmtBytes } from '../utils/format.js';
import { count as favCount } from '../core/favorites.js';
import { allTags } from '../core/tags.js';

export const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',     icon: '◈', group: 'Workspace' },
  { id: 'files',      label: 'Files',         icon: '▤', group: 'Workspace', countKey: 'files' },
  { id: 'editor',     label: 'Editor',        icon: '✎', group: 'Workspace' },
  { id: 'log',        label: 'Log',           icon: '≡', group: 'Workspace', countKey: 'log' },
  { id: 'stats',      label: 'Insights',      icon: '◔', group: 'Workspace' },
  { id: 'diff',       label: 'Compare',       icon: '⇄', group: 'Tools' },
  { id: 'snapshots',  label: 'Snapshots',     icon: '◫', group: 'Tools' },
  { id: 'tags',       label: 'Tags',          icon: '⚐', group: 'Tools' },
  { id: 'templates',  label: 'Templates',     icon: '⌗', group: 'Tools' },
  { id: 'onboarding', label: 'Welcome',       icon: '✦', group: 'System' },
  { id: 'settings',   label: 'Settings',      icon: '⚙', group: 'System' },
  { id: 'help',       label: 'Format & help', icon: '?', group: 'System' },
];

let currentRoute = 'dashboard';

export function initSidebar() {
  renderNav();
  renderPanel();
  subscribe((type) => {
    if (type === 'files' || type === 'log' || type === 'ingest' || type === 'settings' || type === 'favorites' || type === 'tags') {
      renderNav();
      renderPanel();
    }
  });
}

export function setActive(id) {
  currentRoute = id;
  renderNav();
}

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  clear(nav);

  const groups = new Map();
  for (const item of NAV_ITEMS) {
    if (!groups.has(item.group)) groups.set(item.group, []);
    groups.get(item.group).push(item);
  }

  const stats = getStats();

  for (const [groupName, items] of groups) {
    nav.appendChild(el('div', { class: 'nav-group-label', text: groupName }));
    for (const item of items) {
      let count = null;
      if (item.countKey === 'files') count = stats.fileCount;
      else if (item.countKey === 'log') count = stats.logEntries;
      else if (item.id === 'tags') {
        try {
          const n = allTags().length;
          if (n) count = n;
        } catch (e) { /* ignore */ }
      }

      const link = el('a', {
        class: ['nav-link', currentRoute === item.id ? 'is-active' : null].filter(Boolean).join(' '),
        href: '#/' + item.id,
        dataset: { view: item.id },
        onClick: (e) => {
          e.preventDefault();
          if (window.location.hash !== '#/' + item.id) {
            window.location.hash = '#/' + item.id;
          }
        },
      }, [
        el('span', { class: 'nav-icon', html: item.icon }),
        el('span', { class: 'nav-label', text: item.label }),
        count !== null ? el('span', { class: 'nav-count', text: String(count) }) : null,
      ]);
      nav.appendChild(link);
    }
  }
}

function renderPanel() {
  const panel = document.getElementById('sidebar-panel');
  if (!panel) return;
  clear(panel);

  const stats = getStats();

  panel.appendChild(el('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-2xs)',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--faint)',
      padding: '2px 0',
    },
  }, [
    el('span', { text: 'Packed' }),
    el('span', { text: fmtBytes(stats.totalBytes), style: { color: 'var(--ink-2)' } }),
  ]));

  panel.appendChild(el('div', { class: 'meter ' + (stats.failed ? 'bad' : stats.fileCount ? '' : 'warn') }, [
    el('span', { style: { width: Math.min(100, Math.max(2, stats.fileCount ? 100 : 0)) + '%' } }),
  ]));

  panel.appendChild(el('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--muted)',
      fontVariantNumeric: 'tabular-nums',
    },
  }, [
    el('span', { text: stats.fileCount + ' files' + (favCount() ? ' · ★' + favCount() : '') }),
    el('span', {
      text: stats.failed ? stats.failed + ' failed' : (stats.fileCount ? 'healthy' : 'empty'),
      style: { color: stats.failed ? 'var(--bad)' : stats.fileCount ? 'var(--ok)' : 'var(--faint)' },
    }),
  ]));

  const quick = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '4px',
      marginTop: '4px',
    },
  });
  const actions = [
    { label: '↑', tip: 'Download zip', run: () => import('./commands.js').then((m) => m.downloadCurrentPack()) },
    { label: '↓', tip: 'Load zip',     run: () => import('./zip-flow.js').then((m) => m.openZipPicker()) },
    { label: '✦', tip: 'Templates',    run: () => import('./router.js').then((m) => m.navigate('templates')) },
  ];
  for (const a of actions) {
    quick.appendChild(el('button', {
      class: 'icon-btn',
      type: 'button',
      title: a.tip,
      'aria-label': a.tip,
      html: a.label,
      onClick: () => a.run(),
      style: {
        width: '100%',
        height: '26px',
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        fontSize: 'var(--fs-sm)',
      },
    }));
  }
  panel.appendChild(quick);
}
