/** Persistent conversation navigation, search, and conversation actions. */
import {
  dayBucket,
  escapeHtml,
  formatDateTime,
  groupBy,
  initials,
  prettyModelName,
  relativeTime,
  truncate,
  download,
} from '../utils.js';
import { state, subscribe, setState, removeConversationFromState, updateConversationInState } from '../store.js';
import * as db from '../services/db.js';
import { signOut, userDisplayName } from '../services/auth.js';
import { getSidebarCollapsed, setSidebarCollapsed } from '../services/settings.js';
import { pathToLeaf, resolveActiveLeaf } from '../tree.js';
import { conversationToMarkdown, safeFilename } from '../services/export.js';
import { openMenu } from '../ui/menu.js';
import { promptDialog, confirmDialog } from '../ui/modal.js';
import { toast, toastError } from '../ui/toast.js';
import { icon, logoMark } from '../ui/icons.js';

let root = null;
let ctx = null;
let query = '';
let showArchived = false;
let collapsed = false;
let mobileOpen = false;
let renderFrame = null;
let unsub = null;
let backdrop = null;
let viewportQuery = null;
let onViewportChange = null;

function ensureBackdrop() {
  if (!backdrop) {
    backdrop = document.querySelector('#drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'drawer-backdrop';
      backdrop.className = 'drawer-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.addEventListener('click', closeSidebar);
  }
  return backdrop;
}

export function openSidebar() {
  if (!root) return;
  mobileOpen = true;
  root.classList.add('is-open');
  ensureBackdrop().classList.add('is-visible');
  document.body.classList.add('drawer-open');
}

export function closeSidebar() {
  mobileOpen = false;
  root?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
  document.body.classList.remove('drawer-open');
}

export function toggleSidebar() {
  if (mobileOpen) closeSidebar();
  else openSidebar();
}

/* ───────────────────────────── rendering ───────────────────────────── */

function modelNameFor(slug) {
  const model = state.models.find((item) => item.slug === slug);
  return model?.name || (slug === 'openrouter/free' ? 'Free Models Router' : prettyModelName(slug));
}

function conversationRow(conversation) {
  const isActive = conversation.id === state.activeConversationId;
  return `<div class="conv ${isActive ? 'is-active' : ''}" data-conv-row="${conversation.id}">
    <a class="conv__link" href="#/c/${conversation.id}" data-conv-link="${conversation.id}" aria-current="${isActive ? 'page' : 'false'}">
      <span class="conv__glyph">${conversation.pinned ? icon('pin', { size: 13 }) : icon('message', { size: 14 })}</span>
      <span class="conv__copy">
        <span class="conv__title">${escapeHtml(truncate(conversation.title || 'New conversation', 64))}</span>
        <span class="conv__meta">
          <span class="conv__model">${escapeHtml(modelNameFor(conversation.model_slug))}</span>
          <i></i>
          <span>${escapeHtml(relativeTime(conversation.last_message_at || conversation.updated_at))}</span>
        </span>
      </span>
    </a>
    <button type="button" class="conv__more icon-btn icon-btn--xs" data-conv-more="${conversation.id}" aria-label="Conversation actions">${icon('more', { size: 16 })}</button>
  </div>`;
}

function listMarkup() {
  const source = showArchived ? state.archivedConversations : state.conversations;
  const needle = query.trim().toLowerCase();
  const filtered = source.filter((conversation) => {
    if (!needle) return true;
    return `${conversation.title} ${conversation.model_slug} ${conversation.system_prompt || ''}`.toLowerCase().includes(needle);
  });

  if (!filtered.length) {
    return `<div class="conv-empty">
      ${icon(showArchived ? 'archive' : 'message', { size: 22 })}
      <p>${needle ? `No conversation matches “${escapeHtml(query)}”.` : showArchived ? 'No archived conversations.' : 'No conversations yet.'}</p>
      ${!needle && !showArchived ? `<button type="button" class="btn btn--small btn--primary" data-new-chat>${icon('plus', { size: 14 })}<span>Start one</span></button>` : ''}
    </div>`;
  }

  if (showArchived) {
    return `<div class="conv-group"><p class="conv-group__label">Archived <span>${filtered.length}</span></p>${filtered.map(conversationRow).join('')}</div>`;
  }

  const pinned = filtered.filter((conversation) => conversation.pinned);
  const rest = filtered.filter((conversation) => !conversation.pinned);
  const groups = groupBy(rest, (conversation) => dayBucket(conversation.last_message_at || conversation.updated_at));
  const order = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older'];
  let html = '';
  if (pinned.length) {
    html += `<div class="conv-group"><p class="conv-group__label">${icon('pin', { size: 11 })} Pinned <span>${pinned.length}</span></p>${pinned.map(conversationRow).join('')}</div>`;
  }
  for (const key of order) {
    const list = groups.get(key);
    if (!list?.length) continue;
    html += `<div class="conv-group"><p class="conv-group__label">${key} <span>${list.length}</span></p>${list.map(conversationRow).join('')}</div>`;
  }
  return html;
}

function userInitials() {
  return initials(userDisplayName(state.user, state.profile));
}

function render() {
  if (!root) return;
  const user = state.user;
  const sourceCount = showArchived ? state.archivedConversations.length : state.conversations.length;
  const activeModels = state.models.filter((model) => model.is_active !== false).length;
  const name = userDisplayName(user, state.profile);
  const email = user?.email || '';

  root.innerHTML = `
    <div class="sidebar__top">
      <a class="brand" href="#/chat" data-brand aria-label="معراج home">
        <span class="brand__mark">${logoMark({ size: 34 })}</span>
        <span class="brand__text"><strong>معراج</strong><em>MI'RAJ</em></span>
      </a>
      <button type="button" class="icon-btn sidebar__collapse" data-collapse aria-label="Collapse sidebar" title="Collapse sidebar">${icon('sidebar', { size: 17 })}</button>
      <button type="button" class="icon-btn sidebar__mobile-close" data-close-drawer aria-label="Close menu">${icon('close', { size: 18 })}</button>
    </div>
    <button type="button" class="new-chat-btn" data-new-chat>
      ${icon('plus', { size: 17 })}
      <span>New conversation</span>
      <kbd class="kbd kbd--dark">⌘⇧N</kbd>
    </button>
    <div class="sidebar__search">
      <div class="searchfield">${icon('search', { size: 16 })}<input id="conv-search" type="search" class="input input--search" placeholder="Search conversations…" value="${escapeHtml(query)}" autocomplete="off"><kbd class="kbd kbd--dark">/</kbd></div>
    </div>
    <div class="sidebar__scroll">
      <div class="conv-list" id="conv-list">${listMarkup()}</div>
    </div>
    <div class="sidebar__tools">
      <button type="button" class="side-tool ${showArchived ? 'is-active' : ''}" data-archive-toggle>
        ${icon('archive', { size: 16 })}
        <span>${showArchived ? 'Back to chats' : 'Archived'}</span>
        <span class="side-tool__count">${state.archivedConversations.length}</span>
      </button>
      <button type="button" class="side-tool" data-open-cmdk>
        ${icon('command', { size: 16 })}
        <span>Command palette</span>
        <kbd class="kbd kbd--dark">⌘K</kbd>
      </button>
    </div>
    <div class="sidebar__footer">
      <div class="connection-line"><span class="status-dot ${state.schema.status === 'ready' ? 'status-dot--ok' : 'status-dot--warn'}"></span><span>Supabase · ${state.schema.status === 'ready' ? 'synced' : 'check required'}</span><span class="connection-line__sep"></span><span>${activeModels} active</span></div>
      <button type="button" class="user-card" data-user-menu>
        <span class="user-avatar">${escapeHtml(userInitials())}</span>
        <span class="user-card__copy"><strong>${escapeHtml(truncate(name, 26))}</strong><span>${escapeHtml(truncate(email, 30))}</span></span>
        ${icon('more', { size: 16 })}
      </button>
    </div>
  `;

  if (collapsed) {
    root.classList.add('is-collapsed');
    document.documentElement.dataset.sidebar = 'collapsed';
  } else {
    root.classList.remove('is-collapsed');
    document.documentElement.dataset.sidebar = 'expanded';
  }
  if (mobileOpen) root.classList.add('is-open');
  void sourceCount;
}

function scheduleRender() {
  if (renderFrame) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    render();
  });
}

function refreshList() {
  const list = root?.querySelector('#conv-list');
  if (list) list.innerHTML = listMarkup();
}

/* ───────────────────────────── actions ───────────────────────────── */

async function renameConversation(id) {
  const conversation = [...state.conversations, ...state.archivedConversations].find((item) => item.id === id);
  if (!conversation) return;
  const title = await promptDialog({
    title: 'Rename conversation',
    label: 'Title',
    value: conversation.title || '',
    confirmLabel: 'Rename',
    maxLength: 120,
    validate: (value) => (value ? null : 'A title is required.'),
  });
  if (!title || title === conversation.title) return;
  const { data, error } = await db.updateConversation(id, { title });
  if (error) {
    toastError('Rename failed', error);
    return;
  }
  if (data) updateConversationInState({ ...conversation, ...data });
  toast({ title: 'Renamed', message: title, type: 'success', duration: 2400 });
}

async function togglePin(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  const { data, error } = await db.updateConversation(id, { pinned: !conversation.pinned });
  if (error) {
    toastError('Could not update pin', error);
    return;
  }
  if (data) updateConversationInState({ ...conversation, ...data });
  toast({ title: data?.pinned ? 'Pinned' : 'Unpinned', message: conversation.title, type: 'info', duration: 2200 });
}

async function archiveConversation(id) {
  const conversation = state.conversations.find((item) => item.id === id);
  if (!conversation) return;
  const { data, error } = await db.updateConversation(id, { archived: true, pinned: false });
  if (error) {
    toastError('Archive failed', error);
    return;
  }
  removeConversationFromState(id);
  setState({ archivedConversations: [{ ...conversation, ...(data || {}), archived: true }, ...state.archivedConversations] }, 'conversation-archived');
  if (state.activeConversationId === id) {
    ctx?.onConversationGone?.(id);
  }
  toast({ title: 'Archived', message: 'Find it under Archived in the sidebar.', type: 'success', duration: 3000 });
  scheduleRender();
}

async function unarchiveConversation(id) {
  const conversation = state.archivedConversations.find((item) => item.id === id);
  if (!conversation) return;
  const { data, error } = await db.updateConversation(id, { archived: false });
  if (error) {
    toastError('Could not unarchive', error);
    return;
  }
  setState({ archivedConversations: state.archivedConversations.filter((item) => item.id !== id) }, 'conversation-unarchived');
  setState({ conversations: [{ ...conversation, ...(data || {}), archived: false }, ...state.conversations] }, 'conversation-unarchived');
  toast({ title: 'Restored', message: conversation.title, type: 'success', duration: 2400 });
  scheduleRender();
}

async function deleteConversation(id) {
  const conversation = [...state.conversations, ...state.archivedConversations].find((item) => item.id === id);
  if (!conversation) return;
  const confirmed = await confirmDialog({
    title: 'Delete this conversation?',
    message: `“${conversation.title}” and every branch, message and archived request inside it will be permanently deleted. This cannot be undone.`,
    confirmLabel: 'Delete permanently',
    danger: true,
  });
  if (!confirmed) return;
  const { error } = await db.deleteConversation(id);
  if (error) {
    toastError('Delete failed', error);
    return;
  }
  removeConversationFromState(id);
  if (state.activeConversationId === id) ctx?.onConversationGone?.(id);
  toast({ title: 'Conversation deleted', message: conversation.title, type: 'success', duration: 3000 });
  scheduleRender();
}

async function exportConversation(id) {
  const conversation = [...state.conversations, ...state.archivedConversations].find((item) => item.id === id);
  if (!conversation) return;
  toast({ title: 'Preparing export', type: 'loading', duration: 1200 });
  const { data: fresh, error: convError } = await db.getConversation(id);
  if (convError) {
    toastError('Export failed', convError);
    return;
  }
  const { data: messages, error } = await db.listMessages(id);
  if (error) {
    toastError('Export failed', error);
    return;
  }
  const activeLeaf = resolveActiveLeaf(messages || [], fresh?.active_leaf_id);
  const path = pathToLeaf(messages || [], activeLeaf);
  const markdown = conversationToMarkdown(fresh || conversation, path);
  download(`${safeFilename(conversation.title)}.md`, markdown, 'text/markdown;charset=utf-8');
  toast({ title: 'Markdown exported', message: `${path.length} visible message(s).`, type: 'success' });
}

function openConversationMenu(anchor, id) {
  const archived = state.archivedConversations.some((item) => item.id === id);
  const conversation = [...state.conversations, ...state.archivedConversations].find((item) => item.id === id);
  if (!conversation) return;
  openMenu(anchor, [
    { heading: conversation.title.slice(0, 34) },
    { label: 'Rename', icon: 'edit', action: () => renameConversation(id) },
    archived
      ? { label: 'Restore from archive', icon: 'archive', action: () => unarchiveConversation(id) }
      : { label: conversation.pinned ? 'Unpin' : 'Pin to top', icon: 'pin', action: () => togglePin(id) },
    !archived && { label: 'Archive', icon: 'archive', action: () => archiveConversation(id) },
    { label: 'Export as Markdown', icon: 'download', action: () => exportConversation(id) },
    { separator: true },
    { label: 'Delete conversation', icon: 'trash', danger: true, action: () => deleteConversation(id) },
  ]);
}

function openUserMenu(anchor) {
  openMenu(anchor, [
    { heading: userDisplayName(state.user, state.profile) },
    { label: 'Settings & keys', icon: 'settings', action: () => ctx?.navigate?.('/settings') },
    { label: 'Prompt atelier', icon: 'book', action: () => ctx?.navigate?.('/prompts') },
    { label: 'Model atelier', icon: 'cpu', action: () => ctx?.navigate?.('/models') },
    { label: 'Command palette', icon: 'command', note: '⌘K', action: () => ctx?.openCommandPalette?.() },
    { separator: true },
    {
      label: 'Sign out',
      icon: 'logout',
      danger: true,
      action: async () => {
        const { error } = await signOut();
        if (error) toastError('Sign out failed', error);
      },
    },
  ]);
}

/* ───────────────────────────── mount ───────────────────────────── */

export function mountSidebar(element, context) {
  root = element;
  ctx = context;
  viewportQuery = window.matchMedia('(max-width: 900px)');
  collapsed = viewportQuery.matches ? false : getSidebarCollapsed();
  if (onViewportChange) viewportQuery.removeEventListener?.('change', onViewportChange);
  onViewportChange = () => {
    collapsed = viewportQuery.matches ? false : getSidebarCollapsed();
    render();
  };
  viewportQuery.addEventListener?.('change', onViewportChange);
  showArchived = false;
  query = '';
  ensureBackdrop();

  if (unsub) unsub();
  unsub = subscribe((changed) => {
    const keys = [
      'conversations',
      'archivedConversations',
      'activeConversationId',
      'models',
      'profile',
      'user',
      'schema',
      'openRouterKeyPresent',
    ];
    if (keys.some((key) => key in changed)) scheduleRender();
  });

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-new-chat]')) {
      event.preventDefault();
      closeSidebar();
      ctx?.newChat?.();
      return;
    }
    if (event.target.closest('[data-conv-link]')) {
      closeSidebar();
      return;
    }
    if (event.target.closest('[data-brand]')) {
      closeSidebar();
      return;
    }
    if (event.target.closest('[data-collapse]')) {
      collapsed = !collapsed;
      setSidebarCollapsed(collapsed);
      document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
      render();
      return;
    }
    if (event.target.closest('[data-close-drawer]')) {
      closeSidebar();
      return;
    }
    if (event.target.closest('[data-archive-toggle]')) {
      showArchived = !showArchived;
      render();
      return;
    }
    if (event.target.closest('[data-open-cmdk]')) {
      closeSidebar();
      ctx?.openCommandPalette?.();
      return;
    }
    const more = event.target.closest('[data-conv-more]');
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      openConversationMenu(more, more.dataset.convMore);
      return;
    }
    const userMenu = event.target.closest('[data-user-menu]');
    if (userMenu) {
      openUserMenu(userMenu);
    }
  });

  root.addEventListener('input', (event) => {
    if (event.target.id === 'conv-search') {
      query = event.target.value;
      refreshList();
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === '/' && document.activeElement !== root.querySelector('#conv-search')) {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      root.querySelector('#conv-search')?.focus();
    }
    if (event.key === 'Escape' && mobileOpen) closeSidebar();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileOpen) closeSidebar();
  });

  render();
}

export function unmountSidebar() {
  if (unsub) unsub();
  unsub = null;
  if (viewportQuery && onViewportChange) viewportQuery.removeEventListener?.('change', onViewportChange);
  viewportQuery = null;
  onViewportChange = null;
  closeSidebar();
  root = null;
  ctx = null;
}

export function refreshSidebar() {
  scheduleRender();
}

export function setSidebarActiveConversation(id) {
  setState({ activeConversationId: id }, 'active-conversation');
}

export function toggleArchivedView(force) {
  showArchived = typeof force === 'boolean' ? force : !showArchived;
  render();
}

void formatDateTime;
