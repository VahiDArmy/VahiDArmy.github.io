import { $, $$, isMobile } from './utils.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { toast } from './toast.js';
import { renderSidebar, bindSidebarEvents } from './sidebar.js';
import { renderChatView, bindChatEvents, setModelsContext } from './chat.js';
import { renderModelsView } from './models.js';
import { openSettingsModal } from './settings.js';
import { loadModelsFromDB } from './supabase.js';

let currentView = 'chat';
let modelsById = new Map();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}

function buildShell() {
  return `
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
    <div class="app-shell">
      <aside class="sidebar" id="sidebar" aria-label="Sidebar"></aside>
      <main class="main-area" id="main-area"></main>
    </div>
  `;
}

async function initModels() {
  try {
    const rows = await loadModelsFromDB();
    modelsById = new Map();
    for (const r of rows) {
      modelsById.set(r.id, {
        ...r,
        context: parseInt(r.context, 10) || 0,
        is_free: r.is_free !== false
      });
    }
    setModelsContext(modelsById);
    return modelsById;
  } catch (e) {
    console.warn('[models] failed to load:', e?.message);
    setModelsContext(new Map());
    return new Map();
  }
}

function renderMain() {
  const main = $('#main-area');
  if (!main) return;
  if (currentView === 'models') {
    renderModelsView(main, modelsById, {
      onChange: async () => {
        await initModels();
        renderSidebarRefresh();
      },
      onBack: () => {
        currentView = 'chat';
        renderMain();
        renderSidebarRefresh();
      }
    });
  } else {
    renderChatView(main, modelsById);
    bindChatEvents();
  }
}

function renderSidebarRefresh() {
  const sb = $('#sidebar');
  if (sb) renderSidebar(sb, { currentView });
  bindSidebarEvents({
    onNewChat: () => {
      const settings = store.getSettings();
      store.createChat(settings.defaultModel);
      currentView = 'chat';
      renderMain();
      renderSidebarRefresh();
      closeMobileSidebar();
    },
    onSelectChat: (id) => {
      store.setActiveChat(id);
      currentView = 'chat';
      renderMain();
      renderSidebarRefresh();
      closeMobileSidebar();
    },
    onDeleteChat: (id) => {
      const c = store.getChat(id);
      if (!c) return;
      if (!confirm(`Delete "${c.title}"?`)) return;
      store.deleteChat(id);
      renderMain();
      renderSidebarRefresh();
    },
    onRenameChat: (id) => {
      const c = store.getChat(id);
      if (!c) return;
      const n = prompt('Rename chat', c.title);
      if (n == null) return;
      store.renameChat(id, n.trim() || c.title);
      renderSidebarRefresh();
    },
    onOpenModels: () => {
      currentView = 'models';
      renderMain();
      renderSidebarRefresh();
      closeMobileSidebar();
    },
    onOpenSettings: () => {
      openSettingsModal({
        models: Array.from(modelsById.values()),
        onSaved: () => {
          renderMain();
          renderSidebarRefresh();
        }
      });
      closeMobileSidebar();
    },
    onToggleTheme: () => {
      const cur = store.getSettings().theme;
      store.updateSettings({ theme: cur === 'dark' ? 'light' : 'dark' });
      renderSidebarRefresh();
    },
    onOpenSidebar: () => {
      $('#sidebar')?.classList.add('open');
      $('#sidebar-overlay')?.classList.add('visible');
    }
  });
}

function closeMobileSidebar() {
  $('#sidebar')?.classList.remove('open');
  $('#sidebar-overlay')?.classList.remove('visible');
}

function bindGlobalEvents() {
  $('#sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('#composer-input')?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      const settings = store.getSettings();
      store.createChat(settings.defaultModel);
      currentView = 'chat';
      renderMain();
      renderSidebarRefresh();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      openSettingsModal({
        models: Array.from(modelsById.values()),
        onSaved: () => {
          renderMain();
          renderSidebarRefresh();
        }
      });
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      currentView = currentView === 'models' ? 'chat' : 'models';
      renderMain();
      renderSidebarRefresh();
    }
  });
}

async function boot() {
  applyTheme(store.getSettings().theme);
  document.body.innerHTML = buildShell();
  bindGlobalEvents();

  await initModels();

  renderSidebarRefresh();
  renderMain();

  if (!store.getSettings().apiKey) {
    setTimeout(() => {
      toast({
        type: 'info',
        title: 'Welcome to Nebula Chat',
        message: 'Add your OpenRouter API key in Settings to start chatting.',
        duration: 6000,
        actions: [
          {
            label: 'Open Settings',
            onClick: () => openSettingsModal({
              models: Array.from(modelsById.values()),
              onSaved: () => renderMain()
            })
          }
        ]
      });
    }, 600);
  }
}

export function switchView(view) {
  currentView = view;
  renderMain();
  renderSidebarRefresh();
}

boot().catch(err => {
  console.error('[boot]', err);
  document.body.innerHTML = `
    <div style="padding:40px;color:#ef4444;font-family:system-ui;background:#0a0a0f;min-height:100vh">
      <h2>Failed to start</h2>
      <pre style="margin-top:12px;white-space:pre-wrap;font-size:12px;color:#a0a0b8">${String(err?.stack || err)}</pre>
    </div>
  `;
});
