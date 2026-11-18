// ---------------------------------------------------------------------------
// App bootstrap: auth gate, schema gate, hash router, shared context.
// ---------------------------------------------------------------------------

import { auth, db } from './core/db.js';
import { repo } from './core/repo.js';
import { loadRegistry, syncRegistry } from './core/models.js';
import { renderAuth, renderSetup } from './ui/auth.js';
import { renderProjects } from './ui/projects.js';
import { renderWorkspace } from './ui/workspace.js';
import { renderModels } from './ui/models.js';
import { renderSettings } from './ui/settings.js';
import { closeModal, icon, toast } from './ui/dom.js';

const app = document.getElementById('app');

export const state = {
  user: null,
  settings: null,
  registry: [],
  prefs: {},
  modelsReady: false,
  schema: null,
};

let cleanup = null;

export function navigate(path) {
  const next = path.startsWith('#') ? path : `#${path}`;
  if (location.hash === next) render();
  else location.hash = next;
}

export async function refreshSettings() {
  state.settings = await repo.loadSettings();
  return state.settings;
}

/** Load (and if needed sync) the model registry. Never throws. */
export async function ensureModels({ force = false } = {}) {
  if (!auth.isSignedIn) return state;
  try {
    if (!state.registry.length) state.registry = await loadRegistry();
    if (force || !state.registry.length) {
      const result = await syncRegistry({ force });
      if (result?.models) state.registry = result.models;
      else state.registry = await loadRegistry({ refresh: true });
    }
    state.prefs = await repo.listPrefs();
    state.modelsReady = true;
  } catch (err) {
    console.warn('model registry unavailable', err);
    if (!state.registry.length) {
      try { state.registry = await loadRegistry({ refresh: true }); } catch { /* offline */ }
    }
  }
  return state;
}

export const ctx = {
  auth,
  db,
  repo,
  state,
  navigate,
  refreshSettings,
  ensureModels,
  toast,
};

// ---------------------------------------------------------------------------
// routing
// ---------------------------------------------------------------------------

function parseRoute() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length) return { name: 'projects' };
  if (parts[0] === 'models') return { name: 'models' };
  if (parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'p' && parts[1]) {
    return { name: 'workspace', projectId: parts[1], tab: parts[2] || 'chat' };
  }
  return { name: 'projects' };
}

function navItem(route, iconName, label, current) {
  const active = (route === '/' && current === 'projects') || route === `/${current}`;
  return `<a href="#${route}" class="${active ? 'active' : ''}">
    ${icon(iconName)}<span>${label}</span>
  </a>`;
}

function shell(active) {
  app.innerHTML = `
    <header class="topbar">
      <button class="brand" id="brand-home" style="background:none;border:0;cursor:pointer;padding:0">
        <span class="brand-dot">F</span> Forgebook
      </button>
      <span class="spacer"></span>
      <a class="btn ghost icon" href="#/settings" aria-label="Settings" title="Settings">${icon('settings')}</a>
    </header>
    <main class="view" id="view"></main>
    <nav class="tabbar">
      ${navItem('/', 'list', 'Projects', active)}
      ${navItem('/models', 'cpu', 'Models', active)}
      ${navItem('/settings', 'settings', 'Settings', active)}
    </nav>`;
  app.querySelector('#brand-home').addEventListener('click', () => navigate('/'));
}

// ---------------------------------------------------------------------------
// render loop
// ---------------------------------------------------------------------------

async function render() {
  if (cleanup) {
    try { cleanup(); } catch (err) { console.warn(err); }
    cleanup = null;
  }
  closeModal();
  document.body.classList.remove('mode-workspace');

  if (!auth.isSignedIn) {
    app.innerHTML = '';
    renderAuth(app);
    return;
  }

  state.user = auth.user;

  try {
    if (!state.settings) await refreshSettings();
  } catch (err) {
    console.warn('settings failed to load', err);
  }

  if (!state.schema) {
    try { state.schema = await db.checkSchema(); } catch (err) { console.warn(err); }
  }

  if (state.schema && !state.schema.ready) {
    app.innerHTML = '';
    await renderSetup(app, {
      missing: state.schema.missing,
      reason: state.schema.networkProblem || '',
    });
    return;
  }

  const route = parseRoute();

  try {
    if (route.name === 'workspace') {
      document.body.classList.add('mode-workspace');
      app.innerHTML = '<main class="view" id="view"></main>';
      cleanup = await renderWorkspace(document.getElementById('view'), ctx, route);
      return;
    }

    shell(route.name);
    const view = document.getElementById('view');
    if (route.name === 'models') cleanup = await renderModels(view, ctx);
    else if (route.name === 'settings') cleanup = await renderSettings(view, ctx);
    else cleanup = await renderProjects(view, ctx);
  } catch (err) {
    console.error(err);
    if (document.getElementById('view')) {
      document.getElementById('view').innerHTML = `
        <div class="callout danger" style="margin-top:20px">
          <strong>Something went wrong.</strong><br/>${String(err.message || err)}
          <div style="margin-top:10px"><button class="btn small" onclick="location.reload()">Reload</button></div>
        </div>`;
    }
  }
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function boot() {
  try {
    await auth.init();
  } catch (err) {
    console.warn('auth init failed', err);
  }

  auth.onChange(() => {
    state.schema = null;
    state.settings = null;
    state.modelsReady = false;
    render();
  });

  await render();

  const bootEl = document.getElementById('boot');
  if (bootEl) bootEl.remove();
  app.hidden = false;

  if (auth.isSignedIn) {
    // Warm the registry in the background; the UI never waits for it.
    ensureModels().catch(() => {});
  }
}

window.addEventListener('hashchange', () => render());

window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason?.message || String(event.reason || 'Unknown error');
  if (/AbortError/.test(message)) return;
  console.error('unhandled rejection', event.reason);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

boot();
