// Project Packer — application bootstrap.

import { loadSettings, restore, subscribe, State, persist } from './core/state.js';
import { initRouter, renderRoute } from './ui/router.js';
import { initSidebar } from './ui/sidebar.js';
import { initTopbar } from './ui/topbar.js';
import { initStatusbar } from './ui/statusbar.js';
import { initDrawer } from './ui/drawer.js';
import { initDropVeil } from './ui/dropveil.js';
import { initPasteCapture } from './ui/paste-capture.js';
import { initThemeButton } from './ui/theme.js';
import { initHelpButton } from './ui/help-modal.js';
import { initZipInput, handleZipFile } from './ui/zip-flow.js';
import { bindShortcuts } from './ui/commands.js';
import { openPalette } from './ui/palette.js';
import { buildCommands } from './ui/commands.js';
import { toastInfo } from './ui/toast.js';
import { initPwa } from './ui/pwa.js';
import { initTooltips } from './ui/tooltip.js';
import { initContextMenuWiring } from './ui/context-wiring.js';
import { initShortcutsOverlay } from './ui/shortcuts-overlay.js';
import { initSearchOverlay } from './ui/search-overlay.js';
import { initMiscShortcuts } from './ui/misc-shortcuts.js';

function boot() {
  loadSettings();
  restore();

  initSidebar();
  initTopbar();
  initStatusbar();
  initDrawer();
  initThemeButton();
  initHelpButton();
  initZipInput();
  initPasteCapture();
  initTooltips();
  initContextMenuWiring();
  initShortcutsOverlay();
  initSearchOverlay();
  initMiscShortcuts();
  bindShortcuts();
  initRouter();
  initPwa();

  initDropVeil((file) => {
    handleZipFile(file);
  });

  const cmdTrigger = document.getElementById('cmd-trigger');
  if (cmdTrigger) {
    cmdTrigger.addEventListener('click', () => openPalette(buildCommands()));
  }
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette(buildCommands());
    }
  });

  subscribe((type, payload) => {
    if (type === 'ingest' && payload && payload.entry) {
      const entry = payload.entry;
      const live = document.getElementById('live-region');
      if (live) {
        live.textContent = 'Paste #' + entry.n + ' ingested: ' +
          entry.fresh + ' new, ' + entry.errors + ' error' +
          (entry.errors === 1 ? '' : 's');
      }
    }
  });

  const onHide = () => { try { persist(); } catch (err) { /* ignore */ } };
  window.addEventListener('pagehide', onHide);
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });

  toastInfo('Ready — paste blocks or load a .zip to start');

  const hash = window.location.hash;
  if (hash && hash.startsWith('#/')) {
    const view = hash.replace(/^#\//, '').split('/')[0];
    renderRoute(view);
  } else if (!State.files.size && !localStorage.getItem('pp:visited')) {
    try { localStorage.setItem('pp:visited', '1'); } catch (err) { /* ignore */ }
    renderRoute('onboarding');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
