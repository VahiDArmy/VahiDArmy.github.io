/* ============================================================
   NEXUS CHAT — FOLDERS & CHAT ORGANIZATION
   - Pin / archive / custom folders
   - Grouped sidebar render
   - Context menus on chats and folders
   - Drag-and-drop (basic, HTML5)
   - Persists to localStorage (key: nexus_folders_v1)
   - Best-effort Supabase mirror (cinema_meta)
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_folders_loaded__) return;
  window.__nexus_folders_loaded__ = true;

  const STORAGE_KEY = 'nexus_folders_v1';

  /* ---------- State ---------- */
  const foldersState = {
    folders: [],       // { id, name, createdAt, collapsed }
    chatFolders: {},   // chatId -> folderId
    pinned: [],        // [chatId]
    archived: [],      // [chatId]
    showArchived: false,
  };

  let contextMenuEl = null;

  /* ---------- Ready ---------- */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    load();
    installHook();
    installContextMenu();
    mountNewFolderButton();
    listenForChanges();
    // Re-render since our hook now exists
    window.__nexus.renderChatList();
  });

  /* ---------- Storage ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(foldersState, {
            folders: Array.isArray(parsed.folders) ? parsed.folders : [],
            chatFolders: parsed.chatFolders && typeof parsed.chatFolders === 'object' ? parsed.chatFolders : {},
            pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
            archived: Array.isArray(parsed.archived) ? parsed.archived : [],
            showArchived: !!parsed.showArchived,
          });
        }
      }
    } catch (e) {
      console.warn('Folders: load failed:', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(foldersState));
      mirrorToSupabase();
    } catch (e) {
      console.warn('Folders: save failed:', e);
    }
  }

  async function mirrorToSupabase() {
    if (!window.supabase) return;
    try {
      const payload = {
        k: 'folders_state_v1',
        v: JSON.stringify({
          folders: foldersState.folders,
          chatFolders: foldersState.chatFolders,
          pinned: foldersState.pinned,
          archived: foldersState.archived,
        }),
      };
      await window.supabase.from('cinema_meta').upsert(payload, { onConflict: 'k' });
    } catch (e) {
      // Silent — Supabase is supplementary
    }
  }

  function listenForChanges() {
    window.addEventListener('nexus:folders-changed', () => {
      window.__nexus.renderChatList();
    });
  }

  /* ---------- Hook into sidebar render ---------- */
  function installHook() {
    window.__nexus.hooks.afterChatListRender.push(decorateAndGroup);
  }

  /* ---------- Decoration + grouping ---------- */
  function decorateAndGroup(container) {
    if (!container) return;
    // Wipe default items and rebuild from scratch using our grouping
    container.innerHTML = '';

    const chats = window.__nexus.state.chats || [];
    if (!chats.length) {
      container.innerHTML = '<div style="padding:16px;text-align:center;font-size:11px;color:var(--text-tertiary);">No conversations yet</div>';
      renderNewFolderButton(container);
      return;
    }

    const activeChatId = window.__nexus.state.activeChatId;

    // Partition
    const byId = new Map(chats.map(c => [c.id, c]));
    const pinnedChats = foldersState.pinned.map(id => byId.get(id)).filter(Boolean);
    const archivedChats = foldersState.archived.map(id => byId.get(id)).filter(Boolean);
    const nonArchived = chats.filter(c => !foldersState.archived.includes(c.id));
    const unpinned = nonArchived.filter(c => !foldersState.pinned.includes(c.id));

    // Build groups
    const groups = [];

    if (pinnedChats.length) {
      groups.push({
        id: '__pinned__',
        name: 'Pinned',
        icon: '📌',
        chats: pinnedChats,
        pinned: true,
      });
    }

    // Custom folders
    for (const f of foldersState.folders) {
      const inFolder = unpinned.filter(c => foldersState.chatFolders[c.id] === f.id);
      if (inFolder.length) {
        groups.push({
          id: f.id,
          name: f.name,
          icon: '📁',
          chats: inFolder,
          folder: f,
          collapsed: !!f.collapsed,
        });
      }
    }

    // Ungrouped / unassigned
    const assignedIds = new Set();
    for (const f of foldersState.folders) {
      for (const cid in foldersState.chatFolders) {
        if (foldersState.chatFolders[cid] === f.id) assignedIds.add(cid);
      }
    }
    const ungrouped = unpinned.filter(c => !assignedIds.has(c.id));
    if (ungrouped.length) {
      groups.push({
        id: '__ungrouped__',
        name: foldersState.folders.length ? 'Ungrouped' : 'All chats',
        icon: '💬',
        chats: ungrouped,
      });
    }

    // Render groups
    for (const g of groups) {
      container.appendChild(renderGroup(g, activeChatId));
    }

    // Archive toggle
    if (archivedChats.length) {
      container.appendChild(renderArchiveToggle(archivedChats.length));
      if (foldersState.showArchived) {
        container.appendChild(renderGroup({
          id: '__archived__',
          name: 'Archived',
          icon: '📦',
          chats: archivedChats,
          archived: true,
        }, activeChatId));
      }
    }

    renderNewFolderButton(container);
  }

  function renderGroup(group, activeChatId) {
    const wrap = document.createElement('div');
    wrap.className = 'nx-folder-group';
    wrap.dataset.groupId = group.id;
    if (group.collapsed) wrap.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'nx-folder-header';
    header.dataset.groupId = group.id;

    header.innerHTML = `
      <div class="nx-folder-chevron">▾</div>
      <div class="nx-folder-name">${escapeHtml(group.name)}</div>
      <div class="nx-folder-count">${group.chats.length}</div>
      <div class="nx-folder-actions"></div>
    `;

    // Toggle collapse
    header.addEventListener('click', (e) => {
      if (e.target.closest('.nx-folder-action-btn')) return;
      wrap.classList.toggle('collapsed');
      if (group.folder) {
        group.folder.collapsed = wrap.classList.contains('collapsed');
        save();
      }
    });

    // Context menu (custom folders only)
    if (group.folder) {
      header.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openFolderContextMenu(e.pageX, e.pageY, group.folder);
      });
      const actions = header.querySelector('.nx-folder-actions');
      actions.innerHTML = `<button class="nx-folder-action-btn" title="Folder options">⋯</button>`;
      actions.firstChild.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        openFolderContextMenu(rect.left, rect.bottom, group.folder);
      });
    }

    wrap.appendChild(header);

    const items = document.createElement('div');
    items.className = 'nx-folder-items';
    for (const chat of group.chats) {
      items.appendChild(renderChatItem(chat, chat.id === activeChatId, group));
    }
    wrap.appendChild(items);

    // Drop target for drag & drop (custom folders only)
    if (group.folder) {
      items.addEventListener('dragover', (e) => {
        e.preventDefault();
        items.classList.add('nx-folder-drop-target');
      });
      items.addEventListener('dragleave', () => {
        items.classList.remove('nx-folder-drop-target');
      });
      items.addEventListener('drop', (e) => {
        e.preventDefault();
        items.classList.remove('nx-folder-drop-target');
        const chatId = e.dataTransfer.getData('text/plain');
        if (chatId) {
          foldersState.chatFolders[chatId] = group.folder.id;
          save();
          window.__nexus.renderChatList();
        }
      });
    }

    return wrap;
  }

  function renderChatItem(chat, isActive, group) {
    const item = document.createElement('div');
    item.className = `chat-list-item ${isActive ? 'active' : ''}`;
    item.dataset.chatId = chat.id;
    item.draggable = true;

    const last = chat.messages[chat.messages.length - 1];
    const preview = last ? last.content.slice(0, 40) : 'Empty conversation';
    const isPinned = foldersState.pinned.includes(chat.id);
    const isArchived = foldersState.archived.includes(chat.id);
    const branchTag = chat.parentChatId
      ? '<span class="nx-branch-badge">branch</span>'
      : '';

    item.innerHTML = `
      <div class="chat-icon">${group.archived ? '📦' : group.pinned ? '📌' : '💬'}</div>
      <div style="flex:1;min-width:0;">
        <div class="chat-title">${escapeHtml(chat.title)}${branchTag}</div>
        <div class="chat-meta truncate">${escapeHtml(preview)}</div>
      </div>
      <div class="nx-chat-quick-actions">
        <button class="nx-chat-quick-btn ${isPinned ? 'pinned' : ''}" data-act="pin"
                title="${isPinned ? 'Unpin' : 'Pin'}">
          ${isPinned ? '📌' : '📍'}
        </button>
        <button class="nx-chat-quick-btn" data-act="menu" title="More">⋯</button>
      </div>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.nx-chat-quick-btn')) return;
      window.__nexus.state.activeChatId = chat.id;
      window.__nexus.renderChatList();
      window.__nexus.renderActiveChat();
      if (window.innerWidth <= 768) document.getElementById('sidebar').classList.remove('mobile-open');
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openChatContextMenu(e.pageX, e.pageY, chat);
    });

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', chat.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    const pinBtn = item.querySelector('[data-act="pin"]');
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePin(chat.id);
    });

    const menuBtn = item.querySelector('[data-act="menu"]');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      openChatContextMenu(rect.left, rect.bottom, chat);
    });

    return item;
  }

  function renderArchiveToggle(count) {
    const btn = document.createElement('button');
    btn.className = 'nx-archive-toggle';
    btn.innerHTML = `
      <span>${foldersState.showArchived ? '▾' : '▸'}</span>
      <span>Archived</span>
      <span class="count">${count}</span>
    `;
    btn.addEventListener('click', () => {
      foldersState.showArchived = !foldersState.showArchived;
      save();
      window.__nexus.renderChatList();
    });
    return btn;
  }

  function renderNewFolderButton(container) {
    const btn = document.createElement('button');
    btn.className = 'nx-folder-new-btn';
    btn.innerHTML = `<span>＋</span><span>New folder</span>`;
    btn.addEventListener('click', openNewFolderDialog);
    container.appendChild(btn);
  }

  function mountNewFolderButton() {
    // Handled inside renderNewFolderButton — nothing to do here.
  }

  /* ---------- Mutators ---------- */
  function togglePin(chatId) {
    const idx = foldersState.pinned.indexOf(chatId);
    if (idx === -1) {
      foldersState.pinned.push(chatId);
      window.__nexus.showToast('Chat pinned', 'success', 1500);
    } else {
      foldersState.pinned.splice(idx, 1);
      window.__nexus.showToast('Chat unpinned', 'info', 1500);
    }
    save();
    window.__nexus.renderChatList();
  }

  function toggleArchive(chatId) {
    const idx = foldersState.archived.indexOf(chatId);
    if (idx === -1) {
      foldersState.archived.push(chatId);
      window.__nexus.showToast('Chat archived', 'success', 1500);
    } else {
      foldersState.archived.splice(idx, 1);
      window.__nexus.showToast('Chat unarchived', 'info', 1500);
    }
    save();
    window.__nexus.renderChatList();
  }

  function deleteChat(chatId) {
    const state = window.__nexus.state;
    const idx = state.chats.findIndex(c => c.id === chatId);
    if (idx === -1) return;
    if (!confirm('Delete this conversation?')) return;
    state.chats.splice(idx, 1);
    foldersState.pinned = foldersState.pinned.filter(id => id !== chatId);
    foldersState.archived = foldersState.archived.filter(id => id !== chatId);
    delete foldersState.chatFolders[chatId];
    if (state.activeChatId === chatId) {
      state.activeChatId = state.chats[0]?.id || null;
    }
    window.__nexus.persistChats();
    save();
    window.__nexus.renderChatList();
    window.__nexus.renderActiveChat();
  }

  function renameChat(chatId) {
    const chat = window.__nexus.state.chats.find(c => c.id === chatId);
    if (!chat) return;
    const newTitle = prompt('Rename conversation:', chat.title);
    if (newTitle == null) return;
    const trimmed = String(newTitle).trim();
    if (!trimmed) return;
    chat.title = trimmed.slice(0, 60);
    chat.updatedAt = new Date().toISOString();
    window.__nexus.persistChats();
    window.__nexus.renderChatList();
    window.__nexus.renderActiveChat();
    window.__nexus.showToast('Renamed', 'success', 1500);
  }

  function createFolder(name) {
    const folder = {
      id: 'folder-' + Math.random().toString(36).slice(2, 10),
      name,
      createdAt: new Date().toISOString(),
      collapsed: false,
    };
    foldersState.folders.push(folder);
    save();
    window.__nexus.renderChatList();
    return folder;
  }

  function renameFolder(folderId) {
    const folder = foldersState.folders.find(f => f.id === folderId);
    if (!folder) return;
    const newName = prompt('Rename folder:', folder.name);
    if (newName == null) return;
    const trimmed = String(newName).trim();
    if (!trimmed) return;
    folder.name = trimmed.slice(0, 40);
    save();
    window.__nexus.renderChatList();
  }

  function deleteFolder(folderId) {
    const folder = foldersState.folders.find(f => f.id === folderId);
    if (!folder) return;
    if (!confirm(`Delete folder "${folder.name}"? Chats will be moved to Ungrouped.`)) return;
    foldersState.folders = foldersState.folders.filter(f => f.id !== folderId);
    for (const cid in foldersState.chatFolders) {
      if (foldersState.chatFolders[cid] === folderId) {
        delete foldersState.chatFolders[cid];
      }
    }
    save();
    window.__nexus.renderChatList();
  }

  function moveChatToFolder(chatId, folderId) {
    if (folderId === null) {
      delete foldersState.chatFolders[chatId];
    } else {
      foldersState.chatFolders[chatId] = folderId;
    }
    save();
    window.__nexus.renderChatList();
  }

  /* ---------- Context menu ---------- */
  function installContextMenu() {
    contextMenuEl = document.createElement('div');
    contextMenuEl.className = 'nx-context-menu';
    document.body.appendChild(contextMenuEl);

    document.addEventListener('mousedown', (e) => {
      if (contextMenuEl && !contextMenuEl.contains(e.target)) closeContextMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeContextMenu();
    });
    window.addEventListener('resize', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
  }

  function closeContextMenu() {
    if (!contextMenuEl) return;
    contextMenuEl.classList.remove('open');
    contextMenuEl.innerHTML = '';
  }

  function openContextMenu(x, y, items) {
    contextMenuEl.innerHTML = '';
    for (const item of items) {
      if (item.divider) {
        const d = document.createElement('div');
        d.className = 'nx-context-menu-divider';
        contextMenuEl.appendChild(d);
        continue;
      }
      if (item.header) {
        const h = document.createElement('div');
        h.className = 'nx-context-menu-header';
        h.textContent = item.header;
        contextMenuEl.appendChild(h);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'nx-context-menu-item' + (item.danger ? ' danger' : '');
      el.innerHTML = `
        <span class="icon">${item.icon || ''}</span>
        <span class="label">${escapeHtml(item.label)}</span>
        ${item.shortcut ? `<span class="shortcut">${escapeHtml(item.shortcut)}</span>` : ''}
      `;
      el.addEventListener('click', () => {
        closeContextMenu();
        if (typeof item.action === 'function') item.action();
      });
      contextMenuEl.appendChild(el);
    }

    // Position
    contextMenuEl.style.left = '0px';
    contextMenuEl.style.top = '0px';
    contextMenuEl.classList.add('open');
    const rect = contextMenuEl.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;
    const px = Math.min(x, maxX);
    const py = Math.min(y, maxY);
    contextMenuEl.style.left = px + 'px';
    contextMenuEl.style.top = py + 'px';
  }

  function openChatContextMenu(x, y, chat) {
    const isPinned = foldersState.pinned.includes(chat.id);
    const isArchived = foldersState.archived.includes(chat.id);

    const folderItems = foldersState.folders.map(f => ({
      icon: '📁',
      label: f.name,
      action: () => moveChatToFolder(chat.id, f.id),
    }));

    const items = [
      { header: chat.title.slice(0, 40) },
      { icon: '↗', label: 'Open', action: () => {
        window.__nexus.state.activeChatId = chat.id;
        window.__nexus.renderChatList();
        window.__nexus.renderActiveChat();
      }},
      { icon: '✎', label: 'Rename…', action: () => renameChat(chat.id) },
      { divider: true },
      {
        icon: isPinned ? '📍' : '📌',
        label: isPinned ? 'Unpin' : 'Pin to top',
        action: () => togglePin(chat.id),
      },
      {
        icon: isArchived ? '📤' : '📦',
        label: isArchived ? 'Unarchive' : 'Archive',
        action: () => toggleArchive(chat.id),
      },
      { divider: true },
      ...(folderItems.length ? [{ header: 'Move to folder' }, ...folderItems] : []),
      ...(foldersState.folders.length ? [{
        icon: '↩',
        label: 'Remove from folder',
        action: () => moveChatToFolder(chat.id, null),
      }] : []),
      { divider: true },
      { icon: '🗑', label: 'Delete', danger: true, action: () => deleteChat(chat.id) },
    ];
    openContextMenu(x, y, items);
  }

  function openFolderContextMenu(x, y, folder) {
    const items = [
      { header: folder.name },
      { icon: '✎', label: 'Rename folder…', action: () => renameFolder(folder.id) },
      { icon: folder.collapsed ? '▾' : '▸', label: folder.collapsed ? 'Expand' : 'Collapse', action: () => {
        folder.collapsed = !folder.collapsed;
        save();
        window.__nexus.renderChatList();
      }},
      { divider: true },
      { icon: '🗑', label: 'Delete folder', danger: true, action: () => deleteFolder(folder.id) },
    ];
    openContextMenu(x, y, items);
  }

  /* ---------- New folder dialog ---------- */
  function openNewFolderDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'nx-modal-overlay';
    overlay.innerHTML = `
      <div class="nx-modal">
        <div class="nx-modal-header">New folder</div>
        <div class="nx-modal-body">
          <input type="text" class="nx-modal-input" placeholder="Folder name" maxlength="40" />
        </div>
        <div class="nx-modal-footer">
          <button class="nx-btn" data-act="cancel">Cancel</button>
          <button class="nx-btn primary" data-act="create">Create</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const input = overlay.querySelector('.nx-modal-input');
    requestAnimationFrame(() => input.focus());

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    const submit = () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      createFolder(name);
      close();
      window.__nexus.showToast(`Folder "${name}" created`, 'success', 2000);
    };

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') close();
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);
    overlay.querySelector('[data-act="create"]').addEventListener('click', submit);
  }

  /* ---------- Utils ---------- */
  function escapeHtml(str) {
    return window.__nexus.escapeHtml(str);
  }

  /* ---------- Public API ---------- */
  window.Nexus = window.Nexus || {};
  window.Nexus.Folders = {
    getState: () => JSON.parse(JSON.stringify(foldersState)),
    createFolder,
    renameFolder,
    deleteFolder,
    moveChatToFolder,
    togglePin,
    toggleArchive,
    toggleArchiveView: () => {
      foldersState.showArchived = !foldersState.showArchived;
      save();
      window.__nexus.renderChatList();
    },
  };
})();
