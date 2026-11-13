import { store } from './store.js';
import { icon } from './icons.js';
import { escapeHtml, formatDate, groupByDate } from './utils.js';

let boundHandlers = null;

export function renderSidebar(container, opts = {}) {
  const chats = store.getChats();
  const activeId = store.state.activeChatId;
  const settings = store.getSettings();
  const theme = settings.theme;

  container.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-brand">
        <div class="brand-logo">N</div>
        <div style="min-width:0;flex:1">
          <div class="brand-title">Nebula Chat</div>
          <div class="brand-sub">AI Workspace</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" data-action="toggle-theme" title="Toggle theme">
        ${icon(theme === 'dark' ? 'sun' : 'moon')}
      </button>
    </div>

    <div class="sidebar-actions">
      <button class="btn btn-primary btn-block" data-action="new-chat">
        ${icon('plus')} <span>New chat</span>
      </button>
    </div>

    <div class="sidebar-scroll" id="sidebar-scroll">
      ${chats.length === 0 ? `
        <div class="empty-state" style="padding:32px 16px;min-height:120px">
          <div class="empty-state-desc">No chats yet.<br>Start a new conversation.</div>
        </div>
      ` : renderChatGroups(chats, activeId)}
    </div>

    <div class="sidebar-footer">
      <button class="btn btn-ghost btn-block" data-action="open-models" style="justify-content:flex-start">
        ${icon('layers')} <span>Models</span>
      </button>
      <button class="btn btn-ghost btn-block" data-action="open-settings" style="justify-content:flex-start">
        ${icon('settings')} <span>Settings</span>
      </button>
    </div>
  `;
}

function renderChatGroups(chats, activeId) {
  const groups = groupByDate(chats, c => c.updatedAt || c.createdAt);
  const sorted = [];
  for (const [date, items] of groups) {
    sorted.push({ date, items: items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) });
  }

  return sorted.map(({ date, items }) => `
    <div class="sidebar-section">
      <div class="sidebar-section-title">${escapeHtml(date)}</div>
      ${items.map(c => `
        <div class="chat-item ${c.id === activeId ? 'active' : ''}" data-chat-id="${c.id}">
          <span style="flex-shrink:0;color:var(--text-dim)">${icon('messageSquare', 'icon-sm')}</span>
          <span class="chat-item-title">${escapeHtml(c.title || 'Untitled')}</span>
          <span class="chat-item-meta">${c.messages?.length || 0}</span>
          <div class="chat-item-actions">
            <button class="btn btn-ghost btn-icon btn-sm" data-action="rename-chat" data-id="${c.id}" title="Rename">
              ${icon('edit', 'icon-sm')}
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" data-action="delete-chat" data-id="${c.id}" title="Delete">
              ${icon('trash', 'icon-sm')}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

export function bindSidebarEvents(handlers = {}) {
  if (boundHandlers) {
    const sb = document.getElementById('sidebar');
    if (sb) sb.replaceWith(sb.cloneNode(true));
  }
  boundHandlers = handlers;
  const sb = document.getElementById('sidebar');
  if (!sb) return;

  sb.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      const action = actionEl.getAttribute('data-action');
      if (action === 'new-chat') return handlers.onNewChat?.();
      if (action === 'open-models') return handlers.onOpenModels?.();
      if (action === 'open-settings') return handlers.onOpenSettings?.();
      if (action === 'toggle-theme') return handlers.onToggleTheme?.();
      if (action === 'delete-chat') {
        e.stopPropagation();
        return handlers.onDeleteChat?.(actionEl.getAttribute('data-id'));
      }
      if (action === 'rename-chat') {
        e.stopPropagation();
        return handlers.onRenameChat?.(actionEl.getAttribute('data-id'));
      }
    }

    const chatEl = e.target.closest('[data-chat-id]');
    if (chatEl) {
      handlers.onSelectChat?.(chatEl.getAttribute('data-chat-id'));
    }
  });
}
