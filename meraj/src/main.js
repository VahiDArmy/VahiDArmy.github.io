/** معراج · application shell. */
import { CONFIG, THEMES } from './config.js';
import { state, setState } from './store.js';
import * as db from './services/db.js';
import { checkSchema } from './services/db.js';
import {
  getSession,
  onAuthStateChange,
  readAuthCallbackError,
  clearAuthCallbackParams,
  signOut,
  updatePassword,
  userDisplayName,
} from './services/auth.js';
import { syncFreeModels, modelsAreStale } from './services/models.js';
import { loadSettings, saveSettings, hasApiKey, setLastModel } from './services/settings.js';
import { applyAppearance } from './ui/theme.js';
import { mountSidebar, unmountSidebar, openSidebar } from './components/sidebar.js';
import { mountAuth, unmountAuth } from './views/auth.js';
import { mountSetup, unmountSetup } from './views/setup.js';
import { mountChat, unmountChat, focusComposer } from './views/chat.js';
import { mountModels, unmountModels } from './views/models.js';
import { mountAnalytics, unmountAnalytics } from './views/analytics.js';
import { mountPrompts, unmountPrompts } from './views/prompts.js';
import { mountSettings, unmountSettings } from './views/settings.js';
import { openCommandPalette } from './ui/command.js';
import { openModal, closeAllModals } from './ui/modal.js';
import { closeMenu } from './ui/menu.js';
import { toast } from './ui/toast.js';
import { reportError } from './ui/errorDialog.js';
import { icon, logoMark } from './ui/icons.js';
import { copyText, download, escapeHtml, formatNumber } from './utils.js';

const root = document.querySelector('#root');
const bootScreen = document.querySelector('#boot-screen');
const bootStatus = document.querySelector('#boot-status');
const bootDetail = document.querySelector('#boot-detail');

let workspaceBooted = false;
let booting = false;
let setupMode = false;
let workspaceSession = null;
let currentView = null;
let currentMount = null;
let routeToken = 0;
let authUnsub = null;
let authError = null;
let recoveryOpen = false;
let mobileNav = null;
let viewRoot = null;
let sidebarEl = null;
let initialised = false;

const VIEW_MODULES = {
  chat: { mount: mountChat, unmount: unmountChat },
  models: { mount: mountModels, unmount: unmountModels },
  analytics: { mount: mountAnalytics, unmount: unmountAnalytics },
  prompts: { mount: mountPrompts, unmount: unmountPrompts },
  settings: { mount: mountSettings, unmount: unmountSettings },
  setup: { mount: mountSetup, unmount: unmountSetup },
};

/* ───────────────────────────── boot chrome ───────────────────────────── */

function bootMessage(title, detail = '') {
  if (bootStatus) bootStatus.textContent = title;
  if (bootDetail) bootDetail.textContent = detail;
}

function hideBoot() {
  bootScreen?.classList.add('is-hidden');
}

function showBoot() {
  bootScreen?.classList.remove('is-hidden');
}

function setDocumentTitle(title) {
  document.title = title ? `${title} · معراج` : 'معراج · MI\'RAJ';
}

/* ───────────────────────────── auth screen ───────────────────────────── */

function renderAuthScreen() {
  cleanupCurrentView();
  unmountSidebarIfAny();
  root.innerHTML = `<div class="auth-mount" id="auth-mount"></div>`;
  mountAuth(document.querySelector('#auth-mount'), { authError, resetMode: false });
  hideBoot();
  setDocumentTitle('Sign in');
  document.body.classList.add('is-auth');
  document.body.classList.remove('is-workspace', 'is-setup', 'is-booting');
}

function teardownToAuth() {
  cleanupCurrentView();
  unmountSidebarIfAny();
  if (setupMode) {
    try {
      unmountSetup();
    } catch {
      /* ignore */
    }
    setupMode = false;
  }
  workspaceBooted = false;
  booting = false;
  workspaceSession = null;
  viewRoot = null;
  mobileNav = null;
  closeAllModals();
  closeMenu();
  setState(
    {
      session: null,
      user: null,
      profile: null,
      conversations: [],
      archivedConversations: [],
      models: [],
      activeConversationId: null,
      schema: { status: 'unknown', missing: [], error: null, checkedAt: null },
    },
    'signed-out',
  );
  renderAuthScreen();
}

function currentUserDisplay() {
  return userDisplayName(state.user, state.profile);
}

/* ───────────────────────────── workspace boot ───────────────────────────── */

async function startWorkspace(session, { force = false } = {}) {
  if (!session) {
    renderAuthScreen();
    return;
  }
  if (booting) return;
  if (workspaceBooted && !force) return;
  if (force) {
    if (setupMode) {
      try {
        unmountSetup();
      } catch {
        /* ignore */
      }
    }
    cleanupCurrentView();
    unmountSidebarIfAny();
    closeAllModals();
    closeMenu();
    root.innerHTML = '';
    workspaceBooted = false;
    setupMode = false;
  }
  booting = true;
  setupMode = false;
  authError = null;
  workspaceSession = session;
  setState({ session, user: session.user, openRouterKeyPresent: hasApiKey() }, 'session-set');
  showBoot();
  bootMessage('Opening معراج…', 'Checking your Supabase session and the six meraj_ tables.');

  try {
    const schema = await checkSchema();
    setState({ schema: { ...schema, checkedAt: new Date().toISOString() } }, 'schema-checked');
    if (schema.status !== 'ready') {
      booting = false;
      setupMode = true;
      renderSetupOnly();
      hideBoot();
      setDocumentTitle('Database setup');
      document.body.classList.remove('is-auth');
      return;
    }

    bootMessage('Reading your observatory…', 'Profile, conversations, archived branches, and the stored model catalogue.');

    const [profileResult, activeConversations, archivedConversations] = await Promise.all([
      db.getProfile(session.user.id),
      db.listConversations({ archived: false }),
      db.listConversations({ archived: true }),
    ]);

    let profile = profileResult.data || null;
    if (profileResult.error) {
      reportError('Could not read your profile row', profileResult.error);
    }
    if (!profile) {
      const displayName =
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Traveller';
      const created = await db.upsertProfile(session.user.id, {
        display_name: displayName,
        avatar_seed: displayName,
      });
      if (created.error) reportError('Could not create your profile row', created.error);
      else profile = created.data;
    }

    let conversationError = null;
    if (activeConversations.error) conversationError = activeConversations.error;
    else if (archivedConversations.error) conversationError = archivedConversations.error;

    bootMessage('Fetching free models…', 'Reading OpenRouter’s public catalogue and storing free text models for your account.');
    let modelsResult = await db.listModels();
    let models = modelsResult.data || [];
    let modelsError = modelsResult.error;
    if (!modelsError && (!models.length || modelsAreStale(models))) {
      const sync = await syncFreeModels(session.user.id, { currentModels: models });
      if (sync.error) {
        modelsError = sync.error;
        bootMessage('Catalogue unavailable', 'The workspace will open with the models already stored.');
      } else {
        modelsResult = await db.listModels();
        models = modelsResult.data || [];
        modelsError = modelsResult.error;
      }
    }

    setState(
      {
        profile,
        conversations: activeConversations.data || [],
        archivedConversations: archivedConversations.data || [],
        conversationsLoaded: true,
        conversationsError: conversationError,
        models,
        modelsLoaded: !modelsError,
        modelsError,
        modelsSyncing: false,
        openRouterKeyPresent: hasApiKey(),
        schema: { ...schema, checkedAt: new Date().toISOString() },
      },
      'workspace-loaded',
    );

    if (conversationError) {
      reportError('Conversations could not load', conversationError);
    }
    if (modelsError) {
      reportError('Model catalogue could not load', modelsError);
    }

    booting = false;
    workspaceBooted = true;
    authError = null;
    renderWorkspaceShell();
    hideBoot();
    document.body.classList.remove('is-auth', 'is-setup', 'is-booting');
    document.body.classList.add('is-workspace');
    await routeFromHash({ replace: true });
  } catch (error) {
    booting = false;
    renderFatalBootError(error);
  }
}

function renderSetupOnly() {
  cleanupCurrentView();
  unmountSidebarIfAny();
  setupMode = true;
  workspaceBooted = false;
  root.innerHTML = `<div class="setup-mount" id="setup-mount"></div>`;
  mountSetup(document.querySelector('#setup-mount'));
  document.body.classList.remove('is-auth', 'is-workspace', 'is-booting');
  document.body.classList.add('is-setup');
  void initialised;
}

function renderFatalBootError(error) {
  hideBoot();
  root.innerHTML = `<div class="fatal-page">
    <div class="fatal-card">
      <span class="fatal-card__mark">${logoMark({ size: 52 })}</span>
      <p class="eyebrow">Startup interrupted</p>
      <h1>معراج could not open.</h1>
      <p class="fatal-card__message">${escapeHtml(error?.message || String(error))}</p>
      <details class="fatal-card__details"><summary>Exact error and stack</summary><pre>${escapeHtml(`${error?.name || 'Error'}: ${error?.message || error}\n\n${error?.stack || ''}`)}</pre></details>
      <div class="fatal-card__actions">
        <button type="button" class="btn btn--primary" data-fatal-retry>${icon('refresh', { size: 16 })}<span>Retry</span></button>
        <button type="button" class="btn btn--ghost" data-fatal-signout>${icon('logout', { size: 16 })}<span>Sign out</span></button>
      </div>
      <p class="field-help">If this is a network error, reconnecting may be enough. The raw message above is unchanged.</p>
    </div>
  </div>`;
  root.querySelector('[data-fatal-retry]')?.addEventListener('click', async () => {
    const { data } = await getSession();
    if (data?.session) startWorkspace(data.session, { force: true });
    else renderAuthScreen();
  });
  root.querySelector('[data-fatal-signout]')?.addEventListener('click', async () => {
    await signOut();
    teardownToAuth();
  });
  document.body.classList.remove('is-auth', 'is-workspace', 'is-setup', 'is-booting');
  setDocumentTitle('Startup error');
}

/* ───────────────────────────── shell ───────────────────────────── */

function renderWorkspaceShell() {
  closeAllModals();
  closeMenu();
  setupMode = false;
  currentView = null;
  currentMount = null;
  root.innerHTML = `<div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="Conversations"></aside>
    <div class="app-main">
      <main class="view-root" id="view-root"></main>
      <nav class="mobile-nav" id="mobile-nav" aria-label="Primary navigation"></nav>
    </div>
  </div>
  <div class="drawer-backdrop" id="drawer-backdrop"></div>`;
  sidebarEl = document.querySelector('#sidebar');
  viewRoot = document.querySelector('#view-root');
  mobileNav = document.querySelector('#mobile-nav');

  mountSidebar(sidebarEl, {
    navigate,
    newChat,
    openSidebar,
    openCommandPalette: openPalette,
    onConversationGone: handleConversationGone,
  });
  renderMobileNav('/chat');
}

function unmountSidebarIfAny() {
  if (sidebarEl) {
    unmountSidebar();
    sidebarEl = null;
  }
}

function renderMobileNav(activePath) {
  if (!mobileNav) return;
  const items = [
    { path: '/chat', label: 'Chats', icon: 'message' },
    { path: '/models', label: 'Models', icon: 'cpu' },
    { path: '/analytics', label: 'Insights', icon: 'chart' },
    { path: '/prompts', label: 'Prompts', icon: 'book' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];
  const active = activePath.startsWith('/c/') ? '/chat' : activePath;
  mobileNav.innerHTML = items
    .map(
      (item) => `<a class="mobile-nav__item ${active === item.path ? 'is-active' : ''}" href="#${item.path}" ${active === item.path ? 'aria-current="page"' : ''}>
        <span class="mobile-nav__icon">${icon(item.icon, { size: 20 })}</span>
        <span>${item.label}</span>
      </a>`,
    )
    .join('');
}

/* ───────────────────────────── routing ───────────────────────────── */

function parseRoute() {
  let raw = window.location.hash.replace(/^#/, '');
  if (!raw) raw = '/chat';
  const [pathname, search = ''] = raw.split('?');
  const parts = pathname.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(search));
  if (parts[0] === 'c' && parts[1]) return { name: 'chat', path: `/c/${parts[1]}`, params: { ...params, id: parts[1] } };
  if (parts[0] === 'models') return { name: 'models', path: '/models', params };
  if (parts[0] === 'analytics') return { name: 'analytics', path: '/analytics', params };
  if (parts[0] === 'prompts') return { name: 'prompts', path: '/prompts', params };
  if (parts[0] === 'settings') return { name: 'settings', path: '/settings', params };
  if (parts[0] === 'setup') return { name: 'setup', path: '/setup', params };
  if (!parts.length || parts[0] === 'chat') return { name: 'chat', path: '/chat', params };
  return { name: 'notfound', path: pathname, params };
}

function navigate(path) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.hash === `#${target}`) {
    if (target === '/chat') {
      window.dispatchEvent(new CustomEvent('meraj:new-chat'));
    }
    return;
  }
  window.location.hash = target;
}

function newChat(force = false) {
  if (!workspaceBooted) return;
  const route = parseRoute();
  if (route.name === 'chat') {
    window.dispatchEvent(new CustomEvent('meraj:new-chat'));
    if (force) closeSidebarOnMobile();
  } else {
    navigate('/chat');
  }
}

function handleConversationGone(id) {
  const route = parseRoute();
  if (route.name === 'chat' && route.params.id) {
    navigate('/chat');
  } else {
    window.dispatchEvent(new CustomEvent('meraj:conversation-gone', { detail: { id } }));
  }
}

function closeSidebarOnMobile() {
  document.querySelector('#sidebar')?.classList.remove('is-open');
  document.querySelector('#drawer-backdrop')?.classList.remove('is-visible');
  document.body.classList.remove('drawer-open');
}

async function routeFromHash({ replace = false } = {}) {
  if (!workspaceBooted) return;
  const route = parseRoute();
  const token = ++routeToken;
  setState({ route }, 'route-changed');
  renderMobileNav(route.path);
  setDocumentTitle(
    {
      chat: 'Chat',
      models: 'Model atelier',
      analytics: 'Analytics',
      prompts: 'Prompt atelier',
      settings: 'Settings',
      setup: 'Database setup',
      notfound: 'Not found',
    }[route.name] || 'معراج',
  );
  closeAllModals();
  closeMenu();
  closeSidebarOnMobile();

  cleanupCurrentView();
  if (!viewRoot) return;
  viewRoot.innerHTML = '';
  const mountEl = document.createElement('div');
  mountEl.className = `view-mount view-mount--${route.name}`;
  viewRoot.appendChild(mountEl);
  currentMount = mountEl;

  if (route.name === 'chat') {
    setState({ activeConversationId: route.params.id || null }, 'route-chat');
  }

  if (route.name === 'notfound') {
    mountEl.innerHTML = `<div class="fatal-page"><div class="fatal-card">
      <span class="fatal-card__mark">${logoMark({ size: 48 })}</span>
      <p class="eyebrow">404</p><h1>No room by that name.</h1>
      <p>${escapeHtml(route.path)} is not a route in معراج. The instrument panel is still here.</p>
      <div class="fatal-card__actions"><a class="btn btn--primary" href="#/chat">Return to chat</a><a class="btn btn--ghost" href="#/settings">Settings</a></div>
    </div></div>`;
    return;
  }

  const module = VIEW_MODULES[route.name];
  if (!module) return;

  const context = {
    navigate,
    newChat,
    openSidebar,
    openCommandPalette: openPalette,
    onConversationGone: handleConversationGone,
    params: route.params,
  };

  // Register the cleanup target *before* awaiting the async mount, so a fast
  // route change can unmount a partially mounted view instead of racing it.
  currentView = {
    name: route.name,
    mountEl,
    unmount: () => {
      try {
        module.unmount?.();
      } catch (error) {
        console.warn('[معراج] view cleanup failed', error);
      }
    },
  };

  try {
    await module.mount(mountEl, context);
    if (token !== routeToken) {
      mountEl.remove();
      return;
    }
    if (replace) window.history.replaceState(null, '', `#${route.path}`);
  } catch (error) {
    console.error('[معراج] route mount failed', error);
    if (token !== routeToken) return;
    mountEl.innerHTML = `<div class="fatal-page"><div class="fatal-card">
      <span class="fatal-card__mark">${logoMark({ size: 48 })}</span>
      <p class="eyebrow">View error</p><h1>This view failed to open.</h1>
      <p>${escapeHtml(error?.message || String(error))}</p>
      <details class="fatal-card__details" open><summary>Exact error</summary><pre>${escapeHtml(`${error?.name || 'Error'}\n\n${error?.stack || ''}`)}</pre></details>
      <div class="fatal-card__actions"><button type="button" class="btn btn--primary" data-view-retry>Retry</button><a class="btn btn--ghost" href="#/chat">New chat</a></div>
    </div></div>`;
    mountEl.querySelector('[data-view-retry]')?.addEventListener('click', () => routeFromHash());
  }
}

function cleanupCurrentView() {
  if (currentView?.unmount) {
    try {
      currentView.unmount();
    } catch (error) {
      console.warn('[معراج] cleanup error', error);
    }
  }
  currentView = null;
  if (currentMount && currentMount.parentElement) currentMount.remove();
  currentMount = null;
}

/* ───────────────────────────── command palette ───────────────────────────── */

function openPalette() {
  if (!workspaceBooted) return;
  const commands = [
    { label: 'New conversation', hint: 'Start a clean thread', icon: 'plus', note: '⌘⇧N', run: () => newChat(true) },
    { label: 'Chat', hint: 'Your conversations', icon: 'message', keywords: ['home'], run: () => navigate('/chat') },
    { label: 'Model atelier', hint: 'Manage free models', icon: 'cpu', run: () => navigate('/models') },
    { label: 'Analytics', hint: 'Usage, latency, routing, errors', icon: 'chart', run: () => navigate('/analytics') },
    { label: 'Prompt atelier', hint: 'Personas, starters, saved prompts', icon: 'book', run: () => navigate('/prompts') },
    { label: 'Settings & keys', hint: 'OpenRouter, appearance, data', icon: 'settings', run: () => navigate('/settings') },
    { label: 'Focus composer', hint: 'Return to the message box', icon: 'edit', keywords: ['type', 'write'], run: () => { if (parseRoute().name === 'chat') focusComposer(); else navigate('/chat'); } },
    {
      label: 'Sync free model catalogue',
      hint: 'Fetch OpenRouter /models and store it',
      icon: 'refresh',
      keywords: ['openrouter', 'free', 'models'],
      run: async () => {
        if (state.modelsSyncing) {
          toast({ title: 'Sync already running', message: 'Wait for the current catalogue sync to finish.', type: 'info' });
          return;
        }
        setState({ modelsSyncing: true }, 'models-syncing');
        const result = await syncFreeModels(state.user.id, { currentModels: state.models, force: true });
        setState({ modelsSyncing: false }, 'models-sync-done');
        if (result.error) {
          setState({ modelsError: result.error }, 'models-sync-error');
          reportError('Catalogue sync failed', result.error);
          return;
        }
        const { data, error } = await db.listModels();
        if (error) {
          reportError('Catalogue read failed', error);
          return;
        }
        setState({ models: data || [], modelsError: null, modelsLoaded: true }, 'models-synced');
        toast({ title: 'Catalogue synced', message: `${formatNumber((data || []).length)} free models stored.`, type: 'success' });
      },
    },
    {
      label: 'Cycle observatory theme',
      hint: 'Move through Nocturne, Mihrab, Nebula, Dawn',
      icon: 'sun',
      run: () => {
        const current = state.settings?.theme || CONFIG.defaults.theme;
        const index = THEMES.findIndex((theme) => theme.id === current);
        const next = THEMES[(index + 1) % THEMES.length];
        const nextSettings = saveSettings({ theme: next.id });
        setState({ settings: nextSettings }, 'settings-changed');
        applyAppearance(nextSettings);
        toast({ title: `${next.name}`, message: next.note, type: 'info', duration: 2600 });
      },
    },
    {
      label: 'Copy schema SQL',
      hint: 'Copy supabase/schema.sql to the clipboard',
      icon: 'code',
      run: async () => {
        try {
          const response = await fetch(CONFIG.setup.sqlPath);
          if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
          const text = await response.text();
          const ok = await copyText(text);
          toast(
            ok
              ? { title: 'Schema copied', message: 'Paste it into the Supabase SQL editor.', type: 'success' }
              : { title: 'Clipboard blocked', message: 'Open supabase/schema.sql instead.', type: 'error' },
          );
        } catch (error) {
          reportError('Could not read the schema', { message: error?.message || String(error), name: error?.name, kind: 'client' });
        }
      },
    },
    { label: 'Database setup status', hint: 'Table checklist and migration', icon: 'database', run: () => navigate('/setup') },
    {
      label: 'Sign out',
      hint: 'End this local session',
      icon: 'logout',
      keywords: ['logout', 'exit'],
      run: async () => {
        const { error } = await signOut();
        if (error) reportError('Sign out failed', error);
      },
    },
  ];

  const active = state.models.filter((model) => model.is_active !== false).slice(0, 8);
  if (active.length) {
    for (const model of active) {
      commands.push({
        label: model.slug === 'openrouter/free' ? 'Use the Free Models Router' : `Use ${model.name}`,
        hint: model.slug === 'openrouter/free' ? 'Let OpenRouter choose, then adopt the actual model' : `${model.provider || 'OpenRouter'} · ${model.slug}`,
        icon: model.slug === 'openrouter/free' ? 'spark' : 'cpu',
        keywords: [model.slug, model.provider, 'model'],
        run: () => {
          const next = saveSettings({ defaultModel: model.slug });
          setState({ settings: next }, 'settings-changed');
          setLastModel(model.slug);
          if (parseRoute().name === 'chat') newChat(true);
          else navigate('/chat');
          toast({ title: 'Model selected', message: `${model.name} will start a new chat.`, type: 'success', duration: 2800 });
        },
      });
    }
  }
  openCommandPalette(commands);
}

/* ───────────────────────────── recovery / password ───────────────────────────── */

function openRecoveryModal() {
  if (recoveryOpen) return;
  recoveryOpen = true;
  const modal = openModal({
    title: 'Set a new password',
    subtitle: 'Your recovery link is valid. Supabase Auth will confirm the change.',
    size: 'sm',
    body: `<div class="form">
      <label class="field"><span>New password</span><div class="input-wrap">${icon('lock', { size: 15 })}<input id="recovery-password" class="input" type="password" autocomplete="new-password" placeholder="At least 6 characters"></div></label>
      <label class="field"><span>Confirm password</span><div class="input-wrap">${icon('lock', { size: 15 })}<input id="recovery-confirm" class="input" type="password" autocomplete="new-password" placeholder="Repeat the password"></div></label>
      <div id="recovery-error"></div>
      <p class="field-help">If the link was already used or has expired, Supabase's exact error will appear here.</p>
    </div>`,
    actions: [
      {
        label: 'Not now',
        variant: 'ghost',
        onClick: () => {
          recoveryOpen = false;
        },
      },
      {
        label: 'Update password',
        variant: 'primary',
        close: false,
        busyLabel: 'Updating…',
        onClick: async ({ body }) => {
          const password = body.querySelector('#recovery-password')?.value || '';
          const confirmation = body.querySelector('#recovery-confirm')?.value || '';
          const holder = body.querySelector('#recovery-error');
          if (password.length < 6) {
            holder.innerHTML = `<p class="notice notice--danger">${icon('alert', { size: 14 })}At least 6 characters are required.</p>`;
            return false;
          }
          if (password !== confirmation) {
            holder.innerHTML = `<p class="notice notice--danger">${icon('alert', { size: 14 })}The passwords do not match.</p>`;
            return false;
          }
          const { error } = await updatePassword(password);
          if (error) {
            holder.innerHTML = `<div class="auth-error auth-error--compact">${icon('xCircle', { size: 17 })}<div><strong>Supabase Auth response</strong><p>${escapeHtml(error.message)}</p>${error.code ? `<span class="mono">code: ${escapeHtml(error.code)}</span>` : ''}</div></div>`;
            return false;
          }
          recoveryOpen = false;
          modal.close();
          toast({ title: 'Password updated', message: 'You can continue with the current session.', type: 'success' });
          clearAuthCallbackParams();
          if (!workspaceBooted && !booting) {
            const { data } = await getSession();
            if (data?.session) startWorkspace(data.session);
            else renderAuthScreen();
          }
          return false;
        },
      },
    ],
  });
  modal.body.querySelector('#recovery-password')?.focus();
}

/* ───────────────────────────── listeners ───────────────────────────── */

async function handleAuthEvent(event, session) {
  if (event === 'PASSWORD_RECOVERY') {
    window.setTimeout(openRecoveryModal, 400);
  }
  if (event === 'SIGNED_OUT' || !session) {
    if (event === 'SIGNED_OUT') teardownToAuth();
    return;
  }
  if (session) {
    setState(
      {
        session,
        user: session.user,
        openRouterKeyPresent: hasApiKey(),
      },
      'auth-session',
    );
    if (!workspaceBooted && !booting && !setupMode) {
      await startWorkspace(session);
    }
  }
}

function onHashChange() {
  if (workspaceBooted && !setupMode) routeFromHash();
}

function onShortcut(event) {
  if (!workspaceBooted) return;
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openPalette();
    return;
  }
  if (mod && event.shiftKey && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    newChat(true);
  }
}

function onRetryWorkspaceEvent() {
  if (!state.session) {
    if (workspaceSession) startWorkspace(workspaceSession, { force: true });
    return;
  }
  startWorkspace(state.session, { force: true });
}

async function onSignoutEvent() {
  const { error } = await signOut();
  if (error) reportError('Sign out failed', error);
}

function bindGlobalListeners() {
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('keydown', onShortcut);
  window.addEventListener('online', () => setState({ online: true }, 'online'));
  window.addEventListener('offline', () => setState({ online: false }, 'offline'));
  window.addEventListener('meraj:retry-workspace', onRetryWorkspaceEvent);
  window.addEventListener('meraj:signout', onSignoutEvent);
  window.addEventListener('error', (event) => {
    if (!event.error) return;
    console.error('[معراج] uncaught error', event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason?.name === 'AbortError') return;
    console.error('[معراج] unhandled rejection', reason);
    if (workspaceBooted) {
      toast({
        title: 'An operation failed',
        message: reason?.message || String(reason),
        type: 'error',
        duration: 7000,
        actions: [
          {
            label: 'Details',
            close: false,
            onClick: () => {
              import('./ui/errorDialog.js').then(({ openErrorDialog }) => openErrorDialog('Unhandled error', reason || { message: String(reason) }));
            },
          },
        ],
      });
    }
  });
}

async function init() {
  initialised = true;
  const settings = loadSettings();
  setState({ settings, openRouterKeyPresent: hasApiKey() }, 'settings-load');
  applyAppearance(settings);
  document.body.classList.add('is-booting');

  const callbackError = readAuthCallbackError();
  if (callbackError) {
    authError = {
      message: callbackError.description || callbackError.error,
      code: callbackError.code || callbackError.error,
      kind: 'auth-callback',
    };
  }

  bindGlobalListeners();
  authUnsub = onAuthStateChange(handleAuthEvent);

  bootMessage('Opening معراج…', 'Restoring your Supabase session.');
  let session = null;
  try {
    const result = await getSession();
    session = result.data?.session || null;
    if (result.error && !session) {
      authError = {
        ...result.error,
        message: result.error.message || 'The Supabase session could not be restored.',
      };
    }
  } catch (error) {
    authError = { message: error.message || String(error), code: 'session-restore', name: error.name || 'Error' };
  }

  document.body.classList.remove('is-booting');
  window.setTimeout(clearAuthCallbackParams, 1200);

  if (session) {
    await startWorkspace(session);
  } else {
    renderAuthScreen();
  }
}

init().catch((error) => {
  console.error('[معراج] boot failed', error);
  renderFatalBootError(error);
});

void db;
void currentUserDisplay;
void download;
void escapeHtml;
void logoMark;
void authUnsub;
