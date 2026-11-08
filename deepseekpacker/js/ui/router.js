// Simple hash-based router.

import { State } from '../core/state.js';
import { setActive } from './sidebar.js';
import { mountDashboard } from '../views/dashboard.js';
import { mountFiles } from '../views/files.js';
import { mountEditor } from '../views/editor.js';
import { mountLog } from '../views/log.js';
import { mountStats } from '../views/stats.js';
import { mountSettings } from '../views/settings.js';
import { mountHelp } from '../views/help.js';
import { mountSnapshots } from '../views/snapshots.js';
import { mountTemplates } from '../views/templates.js';
import { mountOnboarding } from '../views/onboarding.js';
import { mountDiff } from '../views/diff.js';
import { mountTags } from '../views/tags.js';

const VIEWS = {
  dashboard:  { mount: mountDashboard,  crumb: 'Dashboard',     sub: 'Overview' },
  files:      { mount: mountFiles,      crumb: 'Files',         sub: 'Pack workspace' },
  editor:     { mount: mountEditor,     crumb: 'Editor',        sub: 'Edit file content' },
  log:        { mount: mountLog,        crumb: 'Log',           sub: 'Ingest history' },
  stats:      { mount: mountStats,      crumb: 'Insights',      sub: 'Analytics' },
  diff:       { mount: mountDiff,       crumb: 'Compare',       sub: 'Line diff' },
  snapshots:  { mount: mountSnapshots,  crumb: 'Snapshots',     sub: 'Named restore points' },
  templates:  { mount: mountTemplates,  crumb: 'Templates',     sub: 'Starter packs' },
  tags:       { mount: mountTags,       crumb: 'Tags',          sub: 'Organization' },
  onboarding: { mount: mountOnboarding, crumb: 'Welcome',       sub: 'Quick start' },
  settings:   { mount: mountSettings,   crumb: 'Settings',      sub: 'Preferences' },
  help:       { mount: mountHelp,       crumb: 'Format & help', sub: 'Reference' },
};

let currentMount = null;
let currentView = null;

export function initRouter() {
  window.addEventListener('hashchange', () => {
    const { view, params } = parseHash();
    renderRoute(view, params);
  });
  const { view, params } = parseHash();
  renderRoute(view, params);
}

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return { view: 'dashboard', params: {} };
  const [view, ...rest] = hash.split('/');
  const params = {};
  for (const chunk of rest) {
    const [k, v] = chunk.split('=');
    if (k) params[k] = decodeURIComponent(v || '');
  }
  return { view: VIEWS[view] ? view : 'dashboard', params };
}

export function renderRoute(view, params = {}) {
  const entry = VIEWS[view] || VIEWS.dashboard;
  if (currentView && currentView !== view) {
    try {
      if (typeof currentMount === 'function') currentMount();
    } catch (err) {
      console.warn('[router] unmount failed', err);
    }
    currentMount = null;
  }
  currentView = view;
  State.ui.activeView = view;
  State.ui.activeViewParams = params;
  setActive(view);
  setCrumb(entry.crumb, entry.sub);

  const root = document.getElementById('view-root');
  if (!root) return;
  root.innerHTML = '';
  root.scrollTop = 0;
  try {
    currentMount = entry.mount(root, params) || null;
  } catch (err) {
    console.error('[router] mount failed', err);
    root.appendChild(errorNode(err));
  }
}

function errorNode(err) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.innerHTML = '<div class="empty-icon">!</div>' +
    '<div class="empty-title">View failed to load</div>' +
    '<div class="empty-sub"></div>';
  div.querySelector('.empty-sub').textContent = String(err && err.message ? err.message : err);
  return div;
}

export function navigate(view, params) {
  let hash = '#/' + view;
  if (params && Object.keys(params).length) {
    const parts = [];
    for (const [k, v] of Object.entries(params)) {
      parts.push(k + '=' + encodeURIComponent(v));
    }
    hash += '/' + parts.join('/');
  }
  if (window.location.hash === hash) renderRoute(view, params);
  else window.location.hash = hash;
}

export function setCrumb(main, sub) {
  const crumb = document.getElementById('crumb');
  if (!crumb) return;
  crumb.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = main;
  crumb.appendChild(b);
  if (sub) {
    const sep = document.createElement('span');
    sep.className = 'crumb-sep';
    sep.textContent = '/';
    crumb.appendChild(sep);
    const s = document.createElement('span');
    s.className = 'crumb-sub';
    s.textContent = sub;
    crumb.appendChild(s);
  }
}
