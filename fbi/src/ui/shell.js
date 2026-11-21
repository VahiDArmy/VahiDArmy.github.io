import { state, on, emit } from '../lib/state.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { escapeHtml, initials, formatRelative, clip, formatNum } from '../lib/utils.js';
import { action } from './actions.js';
import { openMenu, openModal, closeModal } from './overlay.js';
import { signOut } from '../lib/supabase.js';
import { toast } from './toast.js';
import { saveProfile } from '../lib/db.js';
import { copyText } from '../lib/utils.js';

const APP_SHELL = `
  <div class="app" id="app-shell">
    <div class="bg-layers" aria-hidden="true">
      <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
      <div class="grid-veil"></div>
    </div>
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="logo">${icon('spark')}</div>
        <div class="brand-text"><span class="brand-name">Nebula</span><span class="brand-sub">AI Studio</span></div>
        <button class="icon-btn sidebar-close" data-action="close-sidebar" aria-label="${t('Close')}">${icon('x')}</button>
      </div>
      <button class="new-chat-btn" data-action="new-chat">
        ${icon('plus')} <span id="new-chat-label">${t('New chat')}</span> <kbd>⇧⌘O</kbd>
      </button>
      <div class="side-search">
        ${icon('search')}
        <input id="conv-search" type="search" placeholder="${t('Search chats')}" dir="auto" autocomplete="off" />
      </div>
      <div class="side-scroll" id="conv-list"></div>
      <div class="side-footer" id="side-footer"></div>
    </aside>
    <div class="scrim" id="side-scrim" data-action="close-sidebar"></div>
    <main class="main">
      <header class="topbar" id="topbar"></header>
      <div class="viewport" id="viewport">
        <div class="viewport-inner"><div class="thread" id="thread"></div></div>
      </div>
      <div class="composer-dock" id="composer-dock">
        <div class="composer-holder" id="composer-holder"></div>
      </div>
    </main>
  </div>`;

export function mountShell() {
  const app = document.getElementById('app');
  app.innerHTML = APP_SHELL;
  setSidebar(state.sidebarOpen);
  const search = document.getElementById('conv-search');
  search.value = state.convSearch || '';
  search.addEventListener('input', () => {
    state.convSearch = search.value;
    renderSidebar();
  });
  renderSidebar();
  renderTopbar();
}

export function setSidebar(open) {
  state.sidebarOpen = open;
  const shell = document.getElementById('app-shell');
  const scrim = document.getElementById('side-scrim');
  if (shell) shell.classList.toggle('sidebar-open', open && window.matchMedia('(max-width: 980px)').matches);
  if (shell && !window.matchMedia('(max-width: 980px)').matches) {
    shell.classList.remove('sidebar-open');
    document.documentElement.classList.toggle('sidebar-collapsed', !open);
  }
  if (scrim) scrim.classList.toggle('show', open && window.matchMedia('(max-width: 980px)').matches);
}

export function renderSidebar() {
  const list = document.getElementById('conv-list');
  const footer = document.getElementById('side-footer');
  if (!list || !footer) return;

  const q = (state.convSearch || '').trim().toLowerCase();
  const matches = (c) =>
    !q ||
    (c.title || '').toLowerCase().includes(q) ||
    (c.model_id || '').toLowerCase().includes(q);

  const visible = state.conversations.filter((c) => matches(c) && (!c.archived || state.archivedOpen));
  const pinned = visible.filter((c) => c.pinned && !c.archived);
  const regular = visible.filter((c) => !c.pinned && !c.archived);
  const archived = visible.filter((c) => c.archived);

  const item = (conv) => {
    const active = state.conversation?.id === conv.id;
    return `<div class="conv-item ${active ? 'active' : ''}" data-action="open-conv" data-id="${conv.id}">
      <div class="conv-main">
        <div class="conv-title" dir="auto">${escapeHtml(conv.title || t('New chat'))}</div>
        <div class="conv-meta">
          ${conv.pinned ? `<span class="pin">${icon('pin')}</span>` : ''}
          <span>${escapeHtml(formatRelative(conv.last_message_at || conv.created_at))}</span>
          ${conv.model_id ? `<span>·</span><span dir="ltr" style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(
            conv.model_id === 'openrouter/free' ? 'openrouter/free' : conv.model_id.split('/').pop(),
          )}</span>` : ''}
        </div>
      </div>
      <button class="icon-btn conv-more" data-action="conv-menu" data-id="${conv.id}" aria-label="${t('More')}">${icon(
        'more',
      )}</button>
    </div>`;
  };

  let html = '';
  if (pinned.length) {
    html += `<div class="side-group">${t('Pinned')} <span class="count">${pinned.length}</span></div>`;
    html += pinned.map(item).join('');
  }
  html += `<div class="side-group">${t('Chats')} <span class="count">${regular.length}</span>
    <button class="icon-btn tiny" data-action="toggle-archived" title="${t('Archived')}">${icon(
      state.archivedOpen ? 'compress' : 'archive',
    )}</button>
  </div>`;
  html += regular.length
    ? regular.map(item).join('')
    : `<div class="conv-empty">${
        q ? t('No matches') : t('No chats yet — start with a question above.')
      }</div>`;

  if (state.archivedOpen) {
    html += `<div class="side-group">${t('Archived')} <span class="count">${archived.length}</span></div>`;
    html += archived.length ? archived.map(item).join('') : `<div class="conv-empty">${t('Nothing archived.')}</div>`;
  }

  list.innerHTML = html;

  const profile = state.profile || {};
  const email = state.user?.email || '';
  const name = profile.display_name || email.split('@')[0] || 'Explorer';
  footer.innerHTML = `
    <div class="user-card" data-action="user-menu">
      <div class="avatar">${
        profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="" />` : escapeHtml(initials(name, email))
      }</div>
      <div class="user-meta">
        <span class="user-name" dir="auto">${escapeHtml(name)}</span>
        <span class="user-sub" dir="ltr">${escapeHtml(email)}</span>
      </div>
      ${icon('chevronDown')}
    </div>
    <div class="side-actions">
      <button class="icon-btn" data-action="open-prompts" title="${t('Prompt library')}">${icon('book')}</button>
      <button class="icon-btn" data-action="open-palette" title="${t('Command palette')}">${icon('terminal')}</button>
      <button class="icon-btn" data-action="open-settings" title="${t('Settings')}">${icon('settings')}</button>
    </div>`;
}

export function renderTopbar() {
  const bar = document.getElementById('topbar');
  if (!bar) return;
  const conv = state.conversation;

  const leaves = new Set(state.messages.map((m) => m.parent_id).filter(Boolean));
  const leafCount = state.messages.length ? state.messages.filter((m) => !leaves.has(m.id)).length : 0;
  const modelId = conv?.model_id || state.settings?.defaultModel || 'openrouter/free';
  const streaming = Boolean(state.streaming);

  bar.innerHTML = `
    <button class="icon-btn menu-btn" data-action="toggle-sidebar" aria-label="${t('Toggle sidebar')}">${icon('menu')}</button>
    <div class="topbar-main">
      <div class="topbar-title" dir="auto">${escapeHtml(conv?.title || t('New chat'))}</div>
      <div class="topbar-meta">
        <button class="chip" data-action="open-model-picker" style="max-width:250px" title="${escapeHtml(modelId)}">
          ${icon('cpu')}<span class="truncate" dir="ltr">${escapeHtml(
            modelId === 'openrouter/free' ? 'openrouter/free' : modelId,
          )}</span>
        </button>
        ${
          conv
            ? `<span class="badge ${streaming ? 'accent' : ''}"><span class="dot" style="width:6px;height:6px;border-radius:50%;background:${
                streaming ? 'rgb(var(--a2))' : 'rgb(var(--ok))'
              };box-shadow:0 0 8px currentColor"></span>${streaming ? t('Streaming') : t('Ready')}</span>`
            : ''
        }
        <span class="hide-sm">${conv ? `${formatNum(state.messages.length)} ${t('messages')}` : ''}${
          conv && leafCount > 1 ? ` · ${leafCount} ${t('branches')}` : ''
        }</span>
      </div>
    </div>
    <div class="topbar-actions">
      <button class="icon-btn" data-action="branch-map" title="${t('Branch map')}">${icon('tree')}</button>
      <button class="icon-btn" data-action="open-inspector-last" title="${t('View request')}">${icon('eye')}</button>
      <button class="icon-btn" data-action="topbar-menu" title="${t('More')}">${icon('more')}</button>
      <button class="icon-btn" data-action="open-settings" title="${t('Settings')}">${icon('settings')}</button>
    </div>`;
}

export function initShell() {
  action('toggle-sidebar', () => {
    const mobile = window.matchMedia('(max-width: 980px)').matches;
    if (mobile) {
      const open = !document.getElementById('app-shell')?.classList.contains('sidebar-open');
      state.sidebarOpen = open;
      document.getElementById('app-shell')?.classList.toggle('sidebar-open', open);
      document.getElementById('side-scrim')?.classList.toggle('show', open);
    } else {
      setSidebar(!state.sidebarOpen);
    }
  });

  action('close-sidebar', () => {
    document.getElementById('app-shell')?.classList.remove('sidebar-open');
    document.getElementById('side-scrim')?.classList.remove('show');
    if (!window.matchMedia('(max-width: 980px)').matches) setSidebar(false);
  });

  action('toggle-archived', () => {
    state.archivedOpen = !state.archivedOpen;
    renderSidebar();
  });

  action('open-palette', () => emit('palette:open'));

  action('user-menu', (el) => {
    openMenu(el, [
      { label: t('Account'), icon: 'user', onClick: () => openProfileModal() },
      { label: t('Copy user ID'), icon: 'copy', onClick: () => copyUserId() },
      'sep',
      { label: t('Settings'), icon: 'settings', onClick: () => emit('settings:open') },
      { label: t('Prompt library'), icon: 'book', onClick: () => emit('prompts:open') },
      'sep',
      {
        label: t('Sign out'),
        icon: 'logout',
        danger: true,
        onClick: async () => {
          await signOut();
          toast(t('Signed out.'), { type: 'info' });
        },
      },
    ]);
  });

  on('conversations-changed', renderSidebar);
  on('conversation-changed', () => {
    renderTopbar();
    renderSidebar();
  });
  on('messages-changed', renderTopbar);
  on('stream-state', renderTopbar);
  on('models-changed', renderTopbar);
  on('settings-changed', () => {
    const newChatLabel = document.getElementById('new-chat-label');
    if (newChatLabel) newChatLabel.textContent = t('New chat');
    const search = document.getElementById('conv-search');
    if (search) search.placeholder = t('Search chats');
    renderSidebar();
    renderTopbar();
  });

  // Close mobile sidebar after navigating.
  on('chat:opened', () => {
    if (window.matchMedia('(max-width: 980px)').matches) {
      document.getElementById('app-shell')?.classList.remove('sidebar-open');
      document.getElementById('side-scrim')?.classList.remove('show');
    }
  });
}

async function copyUserId() {
  const ok = await copyText(state.user?.id || '');
  toast(ok ? t('User ID copied.') : t('Could not copy.'), { type: ok ? 'ok' : 'err' });
}

function openProfileModal() {
  openModal({
    title: t('Account'),
    iconName: 'user',
    className: 'narrow',
    body: `
      <div class="stack">
        <div class="field"><label>${t('Display name')}</label>
          <input class="input" id="profile-name" dir="auto" value="${escapeHtml(state.profile?.display_name || '')}" />
        </div>
        <div class="field"><label>${t('Email')}</label>
          <input class="input" value="${escapeHtml(state.user?.email || '')}" disabled dir="ltr" />
        </div>
        <div class="field"><label>${t('User ID')}</label>
          <input class="input mono" value="${escapeHtml(state.user?.id || '')}" disabled dir="ltr" />
        </div>
      </div>`,
    footer: `<div class="spacer"></div><button class="btn" data-action="close-modal">${t('Cancel')}</button>
      <button class="btn btn-primary" id="profile-save">${t('Save')}</button>`,
  });
  document.getElementById('profile-save')?.addEventListener('click', async () => {
    const value = document.getElementById('profile-name').value.trim();
    if (!value) return;
    try {
      await saveProfile(state.user.id, { display_name: value });
      state.profile.display_name = value;
      renderSidebar();
      closeModal();
      toast(t('Saved'), { type: 'ok' });
    } catch (error) {
      toast(error.message, { type: 'err' });
    }
  });
}
