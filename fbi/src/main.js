import './styles/base.css';
import './styles/layout.css';
import './styles/chat.css';
import './styles/ui.css';

import { supabase } from './lib/supabase.js';
import { LS } from './lib/config.js';
import { state, emit } from './lib/state.js';
import * as db from './lib/db.js';
import { mergeSettings } from './lib/db.js';
import { applySettings } from './lib/prefs.js';
import { icon } from './lib/icons.js';
import { t } from './lib/i18n.js';
import { escapeHtml } from './lib/utils.js';
import { action, bindActions } from './ui/actions.js';
import { closeModal, hasModal, closeMenu } from './ui/overlay.js';
import { renderAuthScreen, openPasswordRecovery } from './ui/auth.js';
import { renderSetupScreen } from './ui/setup.js';
import { mountShell, renderSidebar, renderTopbar, initShell } from './ui/shell.js';
import { renderComposer } from './ui/composer.js';
import { initChat, newChat, openConversation, renderChatArea } from './ui/chat.js';
import { initSettings } from './ui/settings.js';
import { initPalette, openPalette } from './ui/palette.js';
import { openModelPicker, ensureCatalog, syncFreeModels } from './ui/models.js';
import { toast } from './ui/toast.js';

/* ------------------------------ module wiring ----------------------------- */

bindActions();
action('close-modal', () => closeModal());
action('open-model-picker', () => openModelPicker());
action('sync-catalog', () => syncFreeModels());

initShell();
initSettings();
initChat();
initPalette();

/* --------------------------------- boot ---------------------------------- */

let starting = false;

async function boot() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hashError = hash.get('error_description') || hash.get('error');
  if (hashError) {
    try {
      history.replaceState(null, '', window.location.pathname);
    } catch {
      /* ignore */
    }
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) {
      await startApp(data.session);
    } else {
      renderAuthScreen(hashError ? decodeURIComponent(hashError.replaceAll('+', ' ')) : null);
    }
  } catch (error) {
    console.error('boot failed', error);
    renderBootError(error);
  }
}

async function startApp(session) {
  const userId = session?.user?.id;
  if (!userId) return;
  if (state.user?.id === userId && state.booted) return;
  if (starting) return;
  starting = true;

  state.session = session;
  state.user = session.user;

  try {
    const setup = await db.checkSetup();
    if (!setup.ok) {
      renderSetupScreen(t('The fbai_ tables were not found in this Supabase project.'));
      return;
    }

    let profile;
    try {
      profile = await db.ensureProfile(session.user);
    } catch (error) {
      if (error.missingTables) {
        renderSetupScreen(t('The fbai_ tables were not found in this Supabase project.'));
        return;
      }
      throw error;
    }

    state.profile = profile;
    state.settings = mergeSettings(profile.settings);
    applySettings();

    const app = document.getElementById('app');
    if (!document.getElementById('app-shell')) {
      app.innerHTML = '';
      mountShell();
      renderComposer(document.getElementById('composer-holder'));
    }

    const [conversations, models, prompts] = await Promise.all([
      db.listConversations(session.user.id),
      db.listModels(session.user.id),
      db.listPrompts(session.user.id),
    ]);
    state.conversations = conversations;
    state.models = models;
    state.prompts = prompts;

    renderSidebar();
    renderTopbar();
    emit('models-changed');
    emit('conversations-changed');

    const hashMatch = window.location.hash.match(/^#\/c\/([0-9a-f-]{36})/i);
    let lastId = null;
    try {
      lastId = localStorage.getItem(LS.lastConversation);
    } catch {
      /* ignore */
    }

    if (hashMatch) await openConversation(hashMatch[1]);
    else if (lastId && conversations.some((c) => c.id === lastId)) await openConversation(lastId);
    else newChat();

    state.booted = true;
    ensureCatalog();
  } catch (error) {
    console.error('startApp failed', error);
    renderBootError(error);
  } finally {
    starting = false;
  }
}

function renderBootError(error) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `<div class="auth-shell" style="grid-template-columns:1fr">
    <div class="bg-layers" aria-hidden="true"><div class="blob b1"></div><div class="blob b2"></div></div>
    <section class="auth-panel">
      <div class="setup-box">
        <div class="brand" style="padding:0">
          <div class="logo">${icon('spark')}</div>
          <div class="brand-text"><span class="brand-name">Nebula</span><span class="brand-sub">AI Studio</span></div>
        </div>
        <h1>${t('The workspace could not start')}</h1>
        <div class="auth-msg err">${escapeHtml(error?.message || String(error))}</div>
        <p class="small muted">${t(
          'Check that your Supabase project is reachable, the SQL schema has been applied, and this page’s URL is allowed as a redirect URL in Supabase → Authentication → URL Configuration.',
        )}</p>
        <div class="row">
          <button class="btn btn-primary" id="boot-retry">${icon('refresh')} ${t('Retry')}</button>
          <button class="btn" id="boot-logout">${icon('logout')} ${t('Sign out')}</button>
        </div>
      </div>
    </section>
  </div>`;
  app.querySelector('#boot-retry')?.addEventListener('click', () => location.reload());
  app.querySelector('#boot-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });
}

/* ------------------------------- auth events ----------------------------- */

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    openPasswordRecovery();
    return;
  }
  if (event === 'SIGNED_OUT' || !session) {
    const hadUser = Boolean(state.user);
    state.user = null;
    state.session = null;
    state.profile = null;
    state.conversation = null;
    state.messages = [];
    state.conversations = [];
    state.models = [];
    state.prompts = [];
    state.booted = false;
    if (hadUser) renderAuthScreen(t('You have been signed out.'));
    return;
  }
  if (session?.user && session.user.id !== state.user?.id) {
    startApp(session);
  }
});

/* ------------------------------- shortcuts ------------------------------- */

document.addEventListener('keydown', (event) => {
  const meta = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();

  if (meta && key === 'k') {
    event.preventDefault();
    openPalette();
    return;
  }
  if (meta && event.shiftKey && key === 'o') {
    event.preventDefault();
    newChat();
    return;
  }
  if (meta && event.shiftKey && key === 'l') {
    event.preventDefault();
    document.getElementById('composer-input')?.focus();
    return;
  }
  if (event.key === 'Escape') {
    if (document.getElementById('palette-scrim')) return; // palette handles itself
    if (document.querySelector('[data-overlay="menu"]')) {
      closeMenu();
      return;
    }
    if (hasModal()) {
      closeModal();
      return;
    }
    document.getElementById('app-shell')?.classList.remove('sidebar-open');
    document.getElementById('side-scrim')?.classList.remove('show');
  }
});

/* ----------------------------- dev inspection ----------------------------- */
// Handy while developing: window.__nebula.* exposes the *live* module instances
// (the same ones the UI uses), never in production builds.
if (import.meta.env.DEV) {
  window.__nebula = { state, db, supabase, emit };
  Promise.all([
    import('./lib/prefs.js'),
    import('./ui/shell.js'),
    import('./ui/chat.js'),
    import('./ui/composer.js'),
    import('./ui/settings.js'),
    import('./ui/models.js'),
    import('./ui/inspector.js'),
    import('./ui/overlay.js'),
    import('./ui/palette.js'),
  ]).then(([prefs, shell, chat, composer, settings, models, inspector, overlay, palette]) => {
    Object.assign(window.__nebula, { prefs, shell, chat, composer, settings, models, inspector, overlay, palette });
  });
}

/* -------------------------------- startup -------------------------------- */

applySettings();
boot();
