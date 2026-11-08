// Project Packer — application bootstrap.

import { loadSettings, restore, subscribe, State, persist, setUI, clearAll } from './core/state.js';
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
import { toastInfo, toastOk, toast } from './ui/toast.js';
import { initPwa } from './ui/pwa.js';
import { initTooltips } from './ui/tooltip.js';
import { initContextMenuWiring } from './ui/context-wiring.js';
import { initShortcutsOverlay } from './ui/shortcuts-overlay.js';
import { initSearchOverlay } from './ui/search-overlay.js';
import { initMiscShortcuts } from './ui/misc-shortcuts.js';
import { confirmDialog, openModal } from './ui/modal.js';
import { copyToClipboard } from './utils/dom.js';
import { SYSTEM_PROMPT } from './core/prompt.js';

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

  // Mode Switch logic
  const modeSwitch = document.getElementById('mode-switch');
  if (modeSwitch) {
    for (const btn of modeSwitch.children) {
      btn.classList.toggle('active', btn.dataset.mode === State.ui.dashboardMode);
    }

    modeSwitch.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !btn.dataset.mode) return;
      const mode = btn.dataset.mode;
      
      if (State.ui.dashboardMode === mode) {
        if (mode === 'pack') {
          showSystemPrompt();
        }
        return;
      }

      for (const child of modeSwitch.children) {
        child.classList.toggle('active', child === btn);
      }
      setUI({ dashboardMode: mode });
    });
  }

  // Reset Button
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const ok = await confirmDialog(
        'Clear every packed file and the log? This cannot be undone.',
        { title: 'Start over', confirmLabel: 'Clear all', variant: 'danger' }
      );
      if (!ok) return;
      
      clearAll();
      toastOk('Workspace cleared');
      renderRoute('dashboard');
    });
  }

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

  // Default to the dashboard
  const hash = window.location.hash;
  if (hash && hash.startsWith('#/')) {
    const view = hash.replace(/^#\//, '').split('/')[0];
    renderRoute(view);
  } else {
    renderRoute('dashboard');
  }
}

function showSystemPrompt() {
  const pre = document.createElement('pre');
  pre.className = 'code-block';
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.maxHeight = '500px';
  pre.style.overflowY = 'auto';
  pre.style.userSelect = 'all';
  pre.style.fontSize = '12px';
  pre.style.lineHeight = '1.6';
  pre.textContent = SYSTEM_PROMPT;

  openModal({
    title: 'AI System Prompt',
    wide: true,
    body: pre,
    buttons: [
      {
        label: 'Copy Prompt',
        variant: 'primary',
        keepOpen: true,
        onClick: async () => {
          const ok = await copyToClipboard(SYSTEM_PROMPT);
          if (ok) toastOk('Prompt copied to clipboard');
          else toast('Copy failed');
        }
      },
      { label: 'Close' }
    ]
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
