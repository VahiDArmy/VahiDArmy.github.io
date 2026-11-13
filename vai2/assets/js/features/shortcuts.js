/* ============================================================
   NEXUS CHAT — KEYBOARD SHORTCUTS
   - Global shortcut registry with scopes
   - Searchable cheat sheet modal (?)
   - Customizable bindings (persisted)
   - Conflict detection
   - Press-to-record rebinding

   Public API:
     window.Nexus.Shortcuts.register(spec)
     window.Nexus.Shortcuts.open()
     window.Nexus.Shortcuts.close()
     window.Nexus.Shortcuts.reset()
     window.Nexus.Shortcuts.getBindings()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_shortcuts_loaded__) return;
  window.__nexus_shortcuts_loaded__ = true;

  const STORAGE_KEY = 'nexus_shortcuts_v1';

  /* ============================================================
     BUILT-IN SHORTCUTS
     id, description, category, defaults (list of combos), action
     ============================================================ */
  const BUILT_INS = [
    // Navigation
    { id: 'search',       category: 'Navigation', description: 'Open global search',            defaults: ['ctrl+k', 'meta+k'],              action: () => window.Nexus?.Search?.open?.() },
    { id: 'prompts',      category: 'Navigation', description: 'Open prompt library',            defaults: ['ctrl+shift+p', 'meta+shift+p'], action: () => window.Nexus?.PromptLibrary?.open?.() },
    { id: 'models',       category: 'Navigation', description: 'Open model manager',             defaults: ['ctrl+shift+m', 'meta+shift+m'], action: () => window.Nexus?.ModelManager?.open?.() },
    { id: 'settings',     category: 'Navigation', description: 'Open settings',                  defaults: ['ctrl+,', 'meta+,'],              action: () => window.Nexus?.Settings?.toggle?.() },
    { id: 'data',         category: 'Navigation', description: 'Open data manager',              defaults: ['ctrl+shift+e', 'meta+shift+e'],  action: () => window.Nexus?.Export?.open?.() },
    { id: 'compare',      category: 'Navigation', description: 'Open compare mode',              defaults: ['ctrl+shift+c', 'meta+shift+c'],  action: () => window.Nexus?.Compare?.open?.() },
    { id: 'cheatsheet',   category: 'Navigation', description: 'Show this cheat sheet',          defaults: ['?'],                              action: () => open() },

    // Chat
    { id: 'new-chat',     category: 'Chat',       description: 'New chat',                        defaults: ['ctrl+shift+n', 'meta+shift+n'], action: () => document.getElementById('newChatBtn')?.click() },
    { id: 'focus-input',  category: 'Chat',       description: 'Focus the message input',         defaults: ['/'],                              action: () => document.getElementById('chatInput')?.focus() },
    { id: 'stop',         category: 'Chat',       description: 'Stop the current generation',     defaults: ['escape'],                         action: () => window.Nexus?.Metrics?.stopGeneration?.() },
    { id: 'regenerate',   category: 'Chat',       description: 'Regenerate the last response',    defaults: ['ctrl+shift+r', 'meta+shift+r'], action: () => window.Nexus?.Branching?.regenerateAssistantMessage?.(window.__nexus.getActiveChat(), (window.__nexus.getActiveChat()?.messages.length || 1) - 1) },
    { id: 'continue',     category: 'Chat',       description: 'Continue a truncated response',   defaults: ['ctrl+enter', 'meta+enter'],       action: () => window.Nexus?.Regenerate?.continueCurrent?.() },

    // View
    { id: 'toggle-sidebar', category: 'View',     description: 'Collapse or expand sidebar',      defaults: ['ctrl+b', 'meta+b'],              action: () => document.getElementById('sidebarToggle')?.click() },
    { id: 'theme-cycle',  category: 'View',       description: 'Cycle through themes',            defaults: ['ctrl+shift+t', 'meta+shift+t'], action: cycleTheme },
    { id: 'font-larger',  category: 'View',       description: 'Increase font size',              defaults: ['ctrl+=', 'meta+='],              action: () => changeFont(1) },
    { id: 'font-smaller', category: 'View',       description: 'Decrease font size',              defaults: ['ctrl+-', 'meta+-'],              action: () => changeFont(-1) },
  ];

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    bindings: {},       // id -> [combo strings]
    overlayEl: null,
    recording: null,    // shortcut id currently listening for a new binding
    recordingHandler: null,
    searchQuery: '',
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-shortcuts-styles')) return;
    const css = `
.nx-sc-overlay {
  position: fixed; inset: 0; z-index: 2850;
  background: rgba(4, 4, 10, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s;
}
.nx-sc-overlay.open { opacity: 1; pointer-events: auto; }
.nx-sc-modal {
  width: 100%; max-width: 720px; max-height: 88vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
  display: flex; flex-direction: column; overflow: hidden;
  transform: scale(0.96); transition: transform 0.2s;
}
.nx-sc-overlay.open .nx-sc-modal { transform: scale(1); }
.nx-sc-header {
  padding: 16px 22px; border-bottom: 1px solid var(--border-subtle);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.nx-sc-title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  display: flex; align-items: center; gap: 10px;
}
.nx-sc-title svg { color: var(--accent-secondary); }
.nx-sc-search-row {
  padding: 12px 22px; border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.nx-sc-search {
  width: 100%; padding: 9px 12px;
  background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
  border-radius: 8px; color: var(--text-primary);
  font-family: var(--font-sans); font-size: 13px; outline: none;
  transition: border-color 0.15s;
}
.nx-sc-search:focus { border-color: var(--accent-primary); }
.nx-sc-body { flex: 1; overflow-y: auto; padding: 8px 12px 16px; }
.nx-sc-category { margin: 12px 0 8px; }
.nx-sc-category-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1.2px; color: var(--text-tertiary);
  padding: 0 10px; margin-bottom: 6px;
  display: flex; align-items: center; gap: 6px;
}
.nx-sc-category-title::after {
  content: ''; flex: 1; height: 1px; background: var(--border-subtle);
}
.nx-sc-row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 10px; border-radius: 8px;
  transition: background 0.12s;
}
.nx-sc-row:hover { background: var(--bg-tertiary); }
.nx-sc-desc {
  flex: 1; min-width: 0;
  font-size: 13px; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.nx-sc-keys {
  display: flex; gap: 4px; align-items: center;
  flex-wrap: wrap; justify-content: flex-end;
  min-width: 100px;
}
.nx-sc-key {
  padding: 3px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-primary); white-space: nowrap;
}
.nx-sc-row:hover .nx-sc-key {
  background: var(--bg-secondary);
  border-color: var(--border-strong);
}
.nx-sc-edit {
  width: 26px; height: 26px;
  border-radius: 5px; border: none; background: transparent;
  color: var(--text-tertiary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; padding: 0; transition: all 0.12s;
  flex-shrink: 0; opacity: 0;
}
.nx-sc-row:hover .nx-sc-edit { opacity: 1; }
.nx-sc-edit:hover { background: var(--bg-hover); color: var(--text-primary); }
.nx-sc-edit.recording { background: var(--danger); color: #fff; }
.nx-sc-recording {
  flex: 1;
  padding: 6px 10px;
  background: rgba(225, 112, 85, 0.12);
  border: 1px dashed var(--danger);
  border-radius: 6px;
  font-size: 11px; color: var(--danger); font-family: var(--font-mono);
  text-align: center;
  animation: nx-sc-rec 1.2s infinite;
}
@keyframes nx-sc-rec { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
.nx-sc-footer {
  padding: 12px 22px; border-top: 1px solid var(--border-subtle);
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  flex-shrink: 0; background: var(--bg-tertiary);
  font-size: 11px; color: var(--text-tertiary);
}
.nx-sc-btn {
  padding: 7px 14px; border-radius: 7px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary); color: var(--text-primary);
  font-family: var(--font-sans); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.nx-sc-btn:hover { background: var(--bg-hover); border-color: var(--border-strong); }
.nx-sc-btn.danger { color: var(--danger); border-color: rgba(225,112,85,0.4); }
.nx-sc-btn.danger:hover { background: rgba(225,112,85,0.12); border-color: var(--danger); }
`;
    const style = document.createElement('style');
    style.id = 'nx-shortcuts-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     BINDINGS
     ============================================================ */
  function loadBindings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') state.bindings = parsed;
      }
    } catch (e) {}
    // Fill defaults
    for (const s of BUILT_INS) {
      if (!Array.isArray(state.bindings[s.id])) {
        state.bindings[s.id] = s.defaults.slice();
      }
    }
  }
  function saveBindings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bindings)); } catch (e) {}
  }

  function normalizeCombo(combo) {
    if (!combo) return '';
    const parts = combo.toLowerCase().split('+').map(s => s.trim()).filter(Boolean);
    parts.sort();
    return parts.join('+');
  }

  /* ============================================================
     GLOBAL LISTENER
     ============================================================ */
  function handleKeyDown(e) {
    if (state.recording) return;
    // Ignore when typing in inputs except for specific handling
    const target = e.target;
    const inEditable = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    const combo = comboFromEvent(e);
    if (!combo) return;

    for (const shortcut of BUILT_INS) {
      const combos = state.bindings[shortcut.id] || [];
      if (combos.some(c => normalizeCombo(c) === normalizeCombo(combo))) {
        // Special: allow Escape and stop even in inputs
        // For single-key shortcuts like "/" and "?", skip in inputs
        if (inEditable) {
          if (shortcut.id === 'stop') { /* allow */ }
          else if (shortcut.id === 'focus-input') return;
          else if (/^[a-z0-9]$|^\/$|^\?$/.test(combo)) return;
        }
        e.preventDefault();
        try { shortcut.action(); } catch (err) { console.warn('[shortcuts]', err); }
        return;
      }
    }
  }

  function comboFromEvent(e) {
    const parts = [];
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    let key = e.key.toLowerCase();
    if (key === ' ') key = 'space';
    if (key === 'arrowup') key = 'up';
    if (key === 'arrowdown') key = 'down';
    if (key === 'arrowleft') key = 'left';
    if (key === 'arrowright') key = 'right';
    if (!['control', 'meta', 'alt', 'shift'].includes(key)) {
      parts.push(key);
    } else if (parts.length === 0) {
      return null; // only modifier keys pressed
    }
    return parts.join('+');
  }

  /* ============================================================
     MODAL
     ============================================================ */
  function buildModal() {
    if (state.overlayEl) return;
    const overlay = document.createElement('div');
    overlay.className = 'nx-sc-overlay';
    overlay.id = 'nxScOverlay';
    overlay.innerHTML = `
      <div class="nx-sc-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div class="nx-sc-header">
          <div class="nx-sc-title">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="1.5" y="4" width="13" height="8" rx="1.5"/>
              <path d="M4 7h.5M6 7h.5M8 7h.5M10 7h.5M4 9.5h8"/>
            </svg>
            Keyboard shortcuts
          </div>
          <button class="icon-btn" id="nxScClose" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3l8 8M11 3l-8 8"/>
            </svg>
          </button>
        </div>
        <div class="nx-sc-search-row">
          <input type="text" class="nx-sc-search" id="nxScSearch" placeholder="Filter shortcuts…" autocomplete="off">
        </div>
        <div class="nx-sc-body" id="nxScBody"></div>
        <div class="nx-sc-footer">
          <span>Click the ✎ next to any row to record a new binding. Press <strong>Esc</strong> to cancel.</span>
          <button class="nx-sc-btn danger" id="nxScReset">Reset defaults</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    state.overlayEl = overlay;

    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#nxScClose').addEventListener('click', close);
    overlay.querySelector('#nxScReset').addEventListener('click', reset);
    overlay.querySelector('#nxScSearch').addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderBody();
    });

    renderBody();
  }

  function renderBody() {
    if (!state.overlayEl) return;
    const body = state.overlayEl.querySelector('#nxScBody');
    if (!body) return;

    const q = state.searchQuery.trim().toLowerCase();
    const filtered = q
      ? BUILT_INS.filter(s =>
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          (state.bindings[s.id] || []).some(c => c.includes(q))
        )
      : BUILT_INS;

    const grouped = {};
    for (const s of filtered) {
      (grouped[s.category] || (grouped[s.category] = [])).push(s);
    }

    body.innerHTML = '';
    if (!filtered.length) {
      body.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary);font-size:12px;">No shortcuts match "${escapeHtml(state.searchQuery)}"</div>`;
      return;
    }

    const order = ['Navigation', 'Chat', 'View'];
    const cats = order.filter(c => grouped[c]).concat(Object.keys(grouped).filter(c => !order.includes(c)));

    for (const cat of cats) {
      const catEl = document.createElement('div');
      catEl.className = 'nx-sc-category';
      catEl.innerHTML = `<div class="nx-sc-category-title">${escapeHtml(cat)}</div>`;
      for (const s of grouped[cat]) {
        catEl.appendChild(renderRow(s));
      }
      body.appendChild(catEl);
    }
  }

  function renderRow(shortcut) {
    const row = document.createElement('div');
    row.className = 'nx-sc-row';
    row.dataset.id = shortcut.id;

    const combos = state.bindings[shortcut.id] || [];
    const recording = state.recording === shortcut.id;

    row.innerHTML = `
      <div class="nx-sc-desc">${escapeHtml(shortcut.description)}</div>
      ${recording
        ? `<div class="nx-sc-recording" id="nxScRecording">Press a key combination…</div>`
        : `<div class="nx-sc-keys">${combos.map(c => renderKeys(c)).join('<span style="color:var(--text-tertiary);font-size:10px;">or</span>')}</div>`
      }
      <button class="nx-sc-edit ${recording ? 'recording' : ''}" title="${recording ? 'Cancel' : 'Rebind'}">
        ${recording ? '✕' : '✎'}
      </button>`;

    const editBtn = row.querySelector('.nx-sc-edit');
    editBtn.addEventListener('click', () => {
      if (recording) {
        cancelRecording();
        renderBody();
      } else {
        startRecording(shortcut.id);
        renderBody();
      }
    });

    return row;
  }

  function renderKeys(combo) {
    const parts = combo.split('+');
    return parts.map(p => {
      const label = p === 'ctrl' ? 'Ctrl' : p === 'meta' ? '⌘' : p === 'alt' ? 'Alt'
        : p === 'shift' ? '⇧' : p === 'space' ? 'Space'
        : p === 'up' ? '↑' : p === 'down' ? '↓'
        : p === 'left' ? '←' : p === 'right' ? '→'
        : p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
      return `<span class="nx-sc-key">${escapeHtml(label)}</span>`;
    }).join('');
  }

  /* ============================================================
     RECORDING
     ============================================================ */
  function startRecording(shortcutId) {
    if (state.recordingHandler) {
      document.removeEventListener('keydown', state.recordingHandler, true);
    }
    state.recording = shortcutId;
    state.recordingHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        cancelRecording();
        renderBody();
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return;
      // Prevent conflicting with only modifier
      if (['ctrl', 'meta', 'alt', 'shift'].includes(combo)) return;

      state.bindings[shortcutId] = [combo];
      saveBindings();
      cancelRecording();
      renderBody();
      if (window.__nexus.showToast) {
        window.__nexus.showToast(`Bound to ${combo}`, 'success', 2000);
      }
    };
    document.addEventListener('keydown', state.recordingHandler, true);
  }

  function cancelRecording() {
    state.recording = null;
    if (state.recordingHandler) {
      document.removeEventListener('keydown', state.recordingHandler, true);
      state.recordingHandler = null;
    }
  }

  /* ============================================================
     THEME CYCLE + FONT SIZE
     ============================================================ */
  const THEMES = ['dark', 'light', 'midnight', 'rose', 'nord', 'high-contrast'];
  function cycleTheme() {
    const cur = document.documentElement.dataset.theme || 'dark';
    const idx = THEMES.indexOf(cur);
    const next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.dataset.theme = next;
    // Also persist via Settings
    if (window.Nexus?.Settings) {
      try {
        const s = window.Nexus.Settings.get();
        s.theme = next;
        localStorage.setItem('nexus_settings_v1', JSON.stringify(s));
      } catch (e) {}
    }
    if (window.__nexus.showToast) {
      window.__nexus.showToast(`Theme: ${next}`, 'info', 1500);
    }
  }

  const FONT_SIZES = ['sm', 'md', 'lg', 'xl'];
  function changeFont(delta) {
    const cur = document.documentElement.dataset.fontSize || 'md';
    const idx = FONT_SIZES.indexOf(cur);
    const next = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta))];
    document.documentElement.dataset.fontSize = next;
    if (window.Nexus?.Settings) {
      try {
        const s = window.Nexus.Settings.get();
        s.fontSize = next;
        localStorage.setItem('nexus_settings_v1', JSON.stringify(s));
      } catch (e) {}
    }
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function open() {
    if (!state.overlayEl) buildModal();
    state.searchQuery = '';
    const search = state.overlayEl.querySelector('#nxScSearch');
    if (search) search.value = '';
    renderBody();
    state.overlayEl.classList.add('open');
    setTimeout(() => search?.focus(), 100);
  }

  function close() {
    if (!state.overlayEl) return;
    state.overlayEl.classList.remove('open');
    cancelRecording();
  }

  function reset() {
    if (!confirm('Reset all keyboard shortcuts to defaults?')) return;
    state.bindings = {};
    for (const s of BUILT_INS) state.bindings[s.id] = s.defaults.slice();
    saveBindings();
    renderBody();
    if (window.__nexus.showToast) {
      window.__nexus.showToast('Shortcuts reset to defaults', 'success', 2000);
    }
  }

  /* ============================================================
     READY
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    loadBindings();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.overlayEl?.classList.contains('open')) {
        close();
      }
    });
  });

  /* ============================================================
     UTILS + PUBLIC API
     ============================================================ */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  window.Nexus = window.Nexus || {};
  window.Nexus.Shortcuts = {
    open, close, reset,
    getBindings: () => JSON.parse(JSON.stringify(state.bindings)),
    register: (spec) => {
      // Allow external registration (for future plugins)
      if (!spec || !spec.id || typeof spec.action !== 'function') return false;
      const exists = BUILT_INS.find(b => b.id === spec.id);
      if (exists) return false;
      BUILT_INS.push({
        id: spec.id,
        category: spec.category || 'Extensions',
        description: spec.description || spec.id,
        defaults: spec.defaults || [],
        action: spec.action,
      });
      if (!Array.isArray(state.bindings[spec.id])) {
        state.bindings[spec.id] = (spec.defaults || []).slice();
        saveBindings();
      }
      return true;
    },
  };
})();
