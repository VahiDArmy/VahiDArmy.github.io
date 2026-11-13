/* ============================================================
   NEXUS CHAT — EXPORT / IMPORT / BACKUP
   Single self-contained module. Auto-loaded by index.html.

   Public API:
     window.Nexus.Export.exportChats(chats, format, options)
     window.Nexus.Export.exportCurrentChat(format)
     window.Nexus.Export.exportAllChats(format)
     window.Nexus.Export.toJson(chats, opts)
     window.Nexus.Export.toMarkdown(chats, opts)
     window.Nexus.Export.toHtml(chats, opts)
     window.Nexus.Export.toPlainText(chats, opts)
     window.Nexus.Export.toCsv(chats, opts)
     window.Nexus.Export.download(filename, content, mime)
     window.Nexus.Export.open()
     window.Nexus.Export.importJson(jsonText, mode)
     window.Nexus.Export.buildShareLink(chats)  // async

     window.Nexus.Backup.create()               // download
     window.Nexus.Backup.openRestore()
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_export_loaded__) return;
  window.__nexus_export_loaded__ = true;

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const BACKUP_VERSION = 1;
  const EXPORT_VERSION = 1;
  const SHARE_VERSION = 1;

  const EXPORT_FORMATS = {
    json:     { label: 'JSON',         ext: 'json', mime: 'application/json', desc: 'Full structured data' },
    markdown: { label: 'Markdown',     ext: 'md',   mime: 'text/markdown',    desc: 'Readable text with markup' },
    html:     { label: 'HTML',         ext: 'html', mime: 'text/html',        desc: 'Standalone styled document' },
    txt:      { label: 'Plain text',   ext: 'txt',  mime: 'text/plain',       desc: 'Simple text, no formatting' },
    csv:      { label: 'CSV',          ext: 'csv',  mime: 'text/csv',         desc: 'Tabular, one row per message' },
  };

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    activeTab: 'export',
    exportFormat: 'json',
    exportScope: 'active',           // 'active' | 'all' | 'custom'
    selectedChatIds: new Set(),
    exportIncludeSettings: false,
    exportIncludeMeta: true,
    importMode: 'merge',             // 'merge' | 'replace' | 'skip'
    pendingImport: null,
    modalEl: null,
    previewContent: null,
  };

  /* ============================================================
     CSS INJECTION
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-export-styles')) return;
    const css = `
/* ============================================================
   DATA MANAGER MODAL
   ============================================================ */
.nx-data-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 2700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}
.nx-data-overlay.open { opacity: 1; pointer-events: auto; }
.nx-data-modal {
  width: 100%;
  max-width: 780px;
  max-height: 90vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(0.96) translateY(-8px);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.nx-data-overlay.open .nx-data-modal {
  transform: scale(1) translateY(0);
}

.nx-data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.nx-data-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}
.nx-data-header-title svg { color: var(--accent-secondary); }

.nx-data-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: var(--bg-secondary);
}
.nx-data-tab {
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;
  position: relative;
  top: 1px;
}
.nx-data-tab:hover {
  color: var(--text-secondary);
}
.nx-data-tab.active {
  color: var(--accent-secondary);
  border-bottom-color: var(--accent-primary);
}

.nx-data-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 22px 22px;
}

.nx-data-section {
  margin-bottom: 22px;
}
.nx-data-section:last-child { margin-bottom: 0; }
.nx-data-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: var(--text-tertiary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.nx-data-section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}

.nx-radio-group {
  display: flex;
  gap: 4px;
  background: var(--bg-tertiary);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}
.nx-radio-chip {
  flex: 1;
  padding: 8px 14px;
  border-radius: 7px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  min-width: 0;
  text-align: center;
}
.nx-radio-chip:hover { color: var(--text-primary); background: var(--bg-hover); }
.nx-radio-chip.active {
  background: var(--accent-primary);
  color: #fff;
  font-weight: 600;
}
.nx-radio-chip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nx-format-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.nx-format-card {
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.nx-format-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-format-card.active {
  border-color: var(--accent-primary);
  background: rgba(108, 92, 231, 0.1);
}
.nx-format-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.nx-format-card.active .nx-format-card-name {
  color: var(--accent-secondary);
}
.nx-format-card-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.nx-checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.12s;
}
.nx-checkbox-row:hover { background: var(--bg-hover); }
.nx-checkbox-row input[type="checkbox"] {
  margin-top: 2px;
  accent-color: var(--accent-primary);
  cursor: pointer;
  flex-shrink: 0;
}
.nx-checkbox-label {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
}
.nx-checkbox-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
  line-height: 1.4;
}

.nx-chat-checklist {
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 4px;
  margin-top: 8px;
}
.nx-chat-check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.nx-chat-check-item:hover { background: var(--bg-hover); }
.nx-chat-check-item input[type="checkbox"] {
  accent-color: var(--accent-primary);
  cursor: pointer;
}
.nx-chat-check-title {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nx-chat-check-meta {
  font-size: 10px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
.nx-chat-check-toolbar {
  display: flex;
  gap: 6px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 4px;
}
.nx-mini-btn {
  padding: 3px 8px;
  border-radius: 5px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 10px;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.1s;
}
.nx-mini-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

.nx-action-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.nx-action-btn {
  padding: 9px 18px;
  border-radius: 9px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nx-action-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nx-action-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-action-btn.primary:hover {
  background: var(--accent-secondary);
  box-shadow: 0 0 20px var(--accent-glow);
}
.nx-action-btn.danger {
  color: var(--danger);
  border-color: rgba(225, 112, 85, 0.4);
  background: transparent;
}
.nx-action-btn.danger:hover {
  background: rgba(225, 112, 85, 0.12);
  border-color: var(--danger);
}
.nx-action-btn .spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: nx-spin 0.7s linear infinite;
}
@keyframes nx-spin { to { transform: rotate(360deg); } }

/* Drop zone */
.nx-drop-zone {
  padding: 32px 20px;
  border: 2px dashed var(--border-strong);
  border-radius: 12px;
  background: var(--bg-tertiary);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.nx-drop-zone:hover,
.nx-drop-zone.dragover {
  border-color: var(--accent-primary);
  background: rgba(108, 92, 231, 0.08);
}
.nx-drop-zone.dragover {
  transform: scale(1.01);
}
.nx-drop-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.6;
}
.nx-drop-text {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 4px;
}
.nx-drop-sub {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* Import status */
.nx-import-status {
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 10px;
}
.nx-import-status.success {
  border-color: rgba(0, 184, 148, 0.4);
  background: rgba(0, 184, 148, 0.08);
  color: var(--success);
}
.nx-import-status.error {
  border-color: rgba(225, 112, 85, 0.4);
  background: rgba(225, 112, 85, 0.08);
  color: var(--danger);
}
.nx-import-status-icon {
  font-size: 16px;
  flex-shrink: 0;
  line-height: 1.2;
}
.nx-import-status-body {
  flex: 1;
  min-width: 0;
}
.nx-import-status-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: inherit;
}
.nx-import-status-detail {
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.5;
}
.nx-import-status.success .nx-import-status-detail { color: rgba(0, 184, 148, 0.8); }
.nx-import-status.error .nx-import-status-detail { color: rgba(225, 112, 85, 0.85); }

/* Backup cards */
.nx-backup-card {
  padding: 16px 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.nx-backup-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
}
.nx-backup-info {
  flex: 1;
  min-width: 0;
}
.nx-backup-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.nx-backup-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
.nx-backup-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* Preview panel */
.nx-preview-panel {
  margin-top: 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
}
.nx-preview-header {
  padding: 8px 14px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}
.nx-preview-pre {
  padding: 14px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-secondary);
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Responsive */
@media (max-width: 700px) {
  .nx-data-overlay { padding: 12px; }
  .nx-data-modal { max-height: 95vh; }
  .nx-format-grid { grid-template-columns: repeat(2, 1fr); }
  .nx-data-body { padding: 16px; }
  .nx-data-header { padding: 14px 16px; }
  .nx-backup-card { flex-wrap: wrap; }
  .nx-backup-actions { width: 100%; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-export-styles';
    style.textContent = css;
    document.head.appendChild(style);
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
    mountTopBarButton();
    buildModal();
    checkShareOnLoad();
  });

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg, type, dur) {
    if (window.__nexus && window.__nexus.showToast) {
      window.__nexus.showToast(msg, type, dur);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }

  function slugify(str) {
    if (!str) return 'untitled';
    return String(str)
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06ff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'untitled';
  }

  function formatDate(d) {
    const date = d ? new Date(d) : new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}_${h}${min}`;
  }

  function formatDateHuman(d) {
    const date = d ? new Date(d) : new Date();
    return date.toLocaleString();
  }

  function humanBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* ============================================================
     TOP BAR BUTTON
     ============================================================ */
  function mountTopBarButton() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar) return;
    if (document.getElementById('nxDataBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxDataBtn';
    btn.title = 'Data manager — export, import, backup';
    btn.setAttribute('aria-label', 'Open data manager');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5"/>
        <path d="M2 12v1.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V12"/>
      </svg>`;
    btn.addEventListener('click', openModal);

    // Insert first so it's easy to find
    topBar.insertBefore(btn, topBar.firstChild);
  }

  /* ============================================================
     MODAL BUILD
     ============================================================ */
  function buildModal() {
    if (state.modalEl) return;

    const overlay = document.createElement('div');
    overlay.className = 'nx-data-overlay';
    overlay.id = 'nxDataOverlay';
    overlay.innerHTML = `
      <div class="nx-data-modal" role="dialog" aria-modal="true" aria-label="Data manager">
        <div class="nx-data-header">
          <div class="nx-data-header-title">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 4.5C2 3.1 4.7 2 8 2s6 1.1 6 2.5v7C14 12.9 11.3 14 8 14s-6-1.1-6-2.5v-7z"/>
              <path d="M2 4.5v3C2 8.9 4.7 10 8 10s6-1.1 6-2.5v-3"/>
              <path d="M2 7.5v3C2 11.9 4.7 13 8 13s6-1.1 6-2.5v-3"/>
            </svg>
            Data Manager
          </div>
          <button class="modal-close" id="nxDataClose" aria-label="Close">×</button>
        </div>
        <div class="nx-data-tabs">
          <button class="nx-data-tab active" data-tab="export">Export</button>
          <button class="nx-data-tab" data-tab="import">Import</button>
          <button class="nx-data-tab" data-tab="backup">Backup</button>
        </div>
        <div class="nx-data-body" id="nxDataBody"></div>
      </div>`;
    document.body.appendChild(overlay);
    state.modalEl = overlay;

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('#nxDataClose').addEventListener('click', closeModal);

    overlay.querySelectorAll('.nx-data-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
    });
  }

  function openModal(opts) {
    if (!state.modalEl) buildModal();
    if (opts && opts.tab) state.activeTab = opts.tab;
    if (opts && opts.scope) state.exportScope = opts.scope;
    if (opts && opts.chatId) {
      state.selectedChatIds = new Set([opts.chatId]);
      state.exportScope = 'custom';
    }
    state.modalEl.classList.add('open');
    switchTab(state.activeTab);
  }

  function closeModal() {
    if (!state.modalEl) return;
    state.modalEl.classList.remove('open');
  }

  function switchTab(tab) {
    state.activeTab = tab;
    state.modalEl.querySelectorAll('.nx-data-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    const body = state.modalEl.querySelector('#nxDataBody');
    if (tab === 'export') renderExportTab(body);
    else if (tab === 'import') renderImportTab(body);
    else if (tab === 'backup') renderBackupTab(body);
  }

  /* ============================================================
     EXPORT TAB
     ============================================================ */
  function renderExportTab(container) {
    const chats = window.__nexus?.state?.chats || [];
    const activeId = window.__nexus?.state?.activeChatId;

    container.innerHTML = '';

    // ---------- Scope ----------
    const scopeSection = document.createElement('div');
    scopeSection.className = 'nx-data-section';
    scopeSection.innerHTML = `
      <div class="nx-data-section-title">Scope</div>
      <div class="nx-radio-group" id="nxScopeGroup">
        <button class="nx-radio-chip ${state.exportScope === 'active' ? 'active' : ''}"
                data-scope="active" ${!activeId ? 'disabled title="No active chat"' : ''}>
          Current chat
        </button>
        <button class="nx-radio-chip ${state.exportScope === 'all' ? 'active' : ''}"
                data-scope="all">
          All chats (${chats.length})
        </button>
        <button class="nx-radio-chip ${state.exportScope === 'custom' ? 'active' : ''}"
                data-scope="custom">
          Select chats
        </button>
      </div>
      <div id="nxCustomSelectorHost"></div>`;
    container.appendChild(scopeSection);

    scopeSection.querySelectorAll('.nx-radio-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        state.exportScope = btn.dataset.scope;
        scopeSection.querySelectorAll('.nx-radio-chip').forEach(b => {
          b.classList.toggle('active', b.dataset.scope === state.exportScope);
        });
        renderCustomSelector(scopeSection.querySelector('#nxCustomSelectorHost'));
        updateExportActions(container);
      });
    });

    // Custom selector host
    renderCustomSelector(scopeSection.querySelector('#nxCustomSelectorHost'));

    // ---------- Format ----------
    const formatSection = document.createElement('div');
    formatSection.className = 'nx-data-section';
    formatSection.innerHTML = `<div class="nx-data-section-title">Format</div>`;
    const grid = document.createElement('div');
    grid.className = 'nx-format-grid';
    for (const [key, spec] of Object.entries(EXPORT_FORMATS)) {
      const card = document.createElement('button');
      card.className = 'nx-format-card' + (state.exportFormat === key ? ' active' : '');
      card.dataset.format = key;
      card.innerHTML = `
        <div class="nx-format-card-name">${escapeHtml(spec.label)}</div>
        <div class="nx-format-card-desc">${escapeHtml(spec.desc)}</div>`;
      card.addEventListener('click', () => {
        state.exportFormat = key;
        grid.querySelectorAll('.nx-format-card').forEach(c => {
          c.classList.toggle('active', c.dataset.format === key);
        });
        updateExportActions(container);
      });
      grid.appendChild(card);
    }
    formatSection.appendChild(grid);
    container.appendChild(formatSection);

    // ---------- Options ----------
    const optionsSection = document.createElement('div');
    optionsSection.className = 'nx-data-section';
    optionsSection.innerHTML = `<div class="nx-data-section-title">Options</div>`;

    const settingsRow = document.createElement('label');
    settingsRow.className = 'nx-checkbox-row';
    settingsRow.innerHTML = `
      <input type="checkbox" id="nxIncludeSettings" ${state.exportIncludeSettings ? 'checked' : ''}>
      <div>
        <div class="nx-checkbox-label">Include app settings and folders</div>
        <div class="nx-checkbox-hint">Applies to JSON format and full backups only.</div>
      </div>`;
    settingsRow.querySelector('input').addEventListener('change', (e) => {
      state.exportIncludeSettings = e.target.checked;
    });
    optionsSection.appendChild(settingsRow);

    container.appendChild(optionsSection);

    // ---------- Preview ----------
    const previewSection = document.createElement('div');
    previewSection.className = 'nx-data-section';
    previewSection.id = 'nxPreviewSection';
    previewSection.style.display = 'none';
    container.appendChild(previewSection);

    // ---------- Actions ----------
    const actionRow = document.createElement('div');
    actionRow.className = 'nx-action-row';
    actionRow.id = 'nxExportActions';
    actionRow.innerHTML = `
      <button class="nx-action-btn" id="nxPreviewBtn">Preview</button>
      <button class="nx-action-btn primary" id="nxDownloadBtn">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5"/>
          <path d="M2 12v1.5A1.5 1.5 0 003.5 15h9a1.5 1.5 0 001.5-1.5V12"/>
        </svg>
        Download
      </button>
      <button class="nx-action-btn" id="nxPrintBtn">Print / PDF</button>
      <button class="nx-action-btn" id="nxShareBtn">Copy share link</button>`;
    container.appendChild(actionRow);

    actionRow.querySelector('#nxPreviewBtn').addEventListener('click', previewExport);
    actionRow.querySelector('#nxDownloadBtn').addEventListener('click', downloadExport);
    actionRow.querySelector('#nxPrintBtn').addEventListener('click', printExport);
    actionRow.querySelector('#nxShareBtn').addEventListener('click', copyShareLink);

    updateExportActions(container);
  }

  function renderCustomSelector(host) {
    if (!host) return;
    if (state.exportScope !== 'custom') {
      host.innerHTML = '';
      return;
    }
    const chats = window.__nexus?.state?.chats || [];
    if (!chats.length) {
      host.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-tertiary);font-size:12px;">No chats to select</div>';
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'nx-chat-checklist';
    wrap.innerHTML = `
      <div class="nx-chat-check-toolbar">
        <button class="nx-mini-btn" data-act="all">Select all</button>
        <button class="nx-mini-btn" data-act="none">Select none</button>
        <button class="nx-mini-btn" data-act="invert">Invert</button>
      </div>`;

    chats.forEach(chat => {
      const item = document.createElement('label');
      item.className = 'nx-chat-check-item';
      item.innerHTML = `
        <input type="checkbox" ${state.selectedChatIds.has(chat.id) ? 'checked' : ''}>
        <span class="nx-chat-check-title">${escapeHtml(chat.title)}</span>
        <span class="nx-chat-check-meta">${chat.messages.length} msg</span>`;
      const cb = item.querySelector('input');
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedChatIds.add(chat.id);
        else state.selectedChatIds.delete(chat.id);
      });
      wrap.appendChild(item);
    });

    wrap.querySelector('[data-act="all"]').addEventListener('click', () => {
      chats.forEach(c => state.selectedChatIds.add(c.id));
      wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    wrap.querySelector('[data-act="none"]').addEventListener('click', () => {
      state.selectedChatIds.clear();
      wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    wrap.querySelector('[data-act="invert"]').addEventListener('click', () => {
      wrap.querySelectorAll('.nx-chat-check-item').forEach((item, i) => {
        const cb = item.querySelector('input');
        cb.checked = !cb.checked;
        if (cb.checked) state.selectedChatIds.add(chats[i].id);
        else state.selectedChatIds.delete(chats[i].id);
      });
    });

    host.innerHTML = '';
    host.appendChild(wrap);
  }

  function updateExportActions(container) {
    const printBtn = container.querySelector('#nxPrintBtn');
    const shareBtn = container.querySelector('#nxShareBtn');
    if (printBtn) {
      printBtn.disabled = state.exportFormat === 'csv';
      printBtn.title = state.exportFormat === 'csv'
        ? 'Print is not available for CSV'
        : 'Open print dialog (save as PDF)';
    }
    if (shareBtn) {
      const n = getChatsToExport().length;
      shareBtn.disabled = n === 0;
      shareBtn.title = n === 0
        ? 'No chats selected'
        : `Generate shareable link for ${n} chat${n === 1 ? '' : 's'}`;
    }
  }

  /* ============================================================
     GET CHATS TO EXPORT
     ============================================================ */
  function getChatsToExport() {
    const allChats = window.__nexus?.state?.chats || [];
    if (state.exportScope === 'active') {
      const activeId = window.__nexus?.state?.activeChatId;
      if (!activeId) return [];
      const c = allChats.find(x => x.id === activeId);
      return c ? [c] : [];
    }
    if (state.exportScope === 'all') {
      return allChats.slice();
    }
    if (state.exportScope === 'custom') {
      return allChats.filter(c => state.selectedChatIds.has(c.id));
    }
    return [];
  }

  /* ============================================================
     FORMAT: JSON
     ============================================================ */
  function toJson(chats, options = {}) {
    const payload = {
      nexus_export_version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      chatCount: chats.length,
      chats: chats.map(serializeChat),
    };
    if (options.includeSettings) {
      if (window.Nexus?.Settings) {
        try { payload.settings = window.Nexus.Settings.get(); } catch (e) {}
      }
      if (window.Nexus?.Folders) {
        try { payload.folders = window.Nexus.Folders.getState(); } catch (e) {}
      }
    }
    return JSON.stringify(payload, null, 2);
  }

  function serializeChat(chat) {
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      parentChatId: chat.parentChatId || undefined,
      branchedFromIndex: chat.branchedFromIndex != null ? chat.branchedFromIndex : undefined,
      messages: (chat.messages || []).map(m => {
        const out = {
          role: m.role,
          content: m.content,
        };
        if (m.timestamp) out.timestamp = m.timestamp;
        if (m.model) out.model = m.model;
        if (m.usage) out.usage = m.usage;
        if (m.error) out.error = true;
        return out;
      }),
    };
  }

  /* ============================================================
     FORMAT: MARKDOWN
     ============================================================ */
  function toMarkdown(chats, options = {}) {
    const parts = [];

    parts.push(`# Nexus Chat Export`);
    parts.push('');
    parts.push(`_Exported: ${formatDateHuman()}_`);
    parts.push(`_Chats: ${chats.length} · Messages: ${chats.reduce((s, c) => s + c.messages.length, 0)}_`);
    parts.push('');
    parts.push('---');
    parts.push('');

    chats.forEach((chat, chatIdx) => {
      if (chatIdx > 0) {
        parts.push('');
        parts.push('---');
        parts.push('');
      }

      parts.push(`## ${chat.title}`);
      parts.push('');
      const meta = [
        `Created: ${formatDateHuman(chat.createdAt)}`,
        `Updated: ${formatDateHuman(chat.updatedAt)}`,
        `Messages: ${chat.messages.length}`,
      ];
      if (chat.parentChatId) {
        meta.push(`Branched from: ${chat.parentChatId.slice(0, 8)}…`);
      }
      parts.push('_' + meta.join(' · ') + '_');
      parts.push('');

      chat.messages.forEach(msg => {
        const roleLabel = msg.role === 'user'
          ? '### 👤 User'
          : msg.role === 'assistant'
            ? `### 🤖 Assistant${msg.model ? ` _(${msg.model})_` : ''}`
            : '### ⚙️ System';

        parts.push(roleLabel);
        parts.push('');

        // Preserve original markdown of the message
        const content = msg.content || '';
        if (msg.error) {
          parts.push('> ⚠️ _Error response_');
          parts.push('');
        }
        parts.push(content);
        parts.push('');
      });
    });

    return parts.join('\n');
  }

  /* ============================================================
     FORMAT: PLAIN TEXT
     ============================================================ */
  function toPlainText(chats, options = {}) {
    const parts = [];

    parts.push('NEXUS CHAT EXPORT');
    parts.push('='.repeat(50));
    parts.push(`Exported: ${formatDateHuman()}`);
    parts.push(`Chats: ${chats.length} · Messages: ${chats.reduce((s, c) => s + c.messages.length, 0)}`);
    parts.push('');

    chats.forEach((chat, idx) => {
      if (idx > 0) {
        parts.push('');
        parts.push('─'.repeat(60));
        parts.push('');
      }
      parts.push(`CHAT: ${chat.title}`);
      parts.push(`Created: ${formatDateHuman(chat.createdAt)}`);
      parts.push(`Messages: ${chat.messages.length}`);
      parts.push('');

      chat.messages.forEach(msg => {
        const role = msg.role === 'user' ? 'USER'
          : msg.role === 'assistant' ? `ASSISTANT${msg.model ? ' [' + msg.model + ']' : ''}`
          : 'SYSTEM';
        parts.push(`[${role}]`);
        parts.push(msg.content || '');
        parts.push('');
      });
    });

    return parts.join('\n');
  }

  /* ============================================================
     FORMAT: CSV
     ============================================================ */
  function toCsv(chats, options = {}) {
    const rows = [];
    rows.push(['chat_id', 'chat_title', 'message_index', 'role', 'timestamp', 'model', 'content'].join(','));

    chats.forEach(chat => {
      chat.messages.forEach((msg, i) => {
        rows.push([
          csvEscape(chat.id),
          csvEscape(chat.title),
          i,
          csvEscape(msg.role),
          csvEscape(msg.timestamp || ''),
          csvEscape(msg.model || ''),
          csvEscape(msg.content || ''),
        ].join(','));
      });
    });

    return rows.join('\n');
  }

  function csvEscape(val) {
    const s = val == null ? '' : String(val);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /* ============================================================
     FORMAT: HTML
     ============================================================ */
  function toHtml(chats, options = {}) {
    const isPrint = !!options.printMode;
    const totalMessages = chats.reduce((s, c) => s + c.messages.length, 0);

    const chatHtml = chats.map((chat, idx) => {
      const messagesHtml = chat.messages.map(msg => {
        const roleClass = msg.role === 'user' ? 'user' : 'assistant';
        const roleLabel = msg.role === 'user' ? 'You' : 'AI';
        const modelTag = msg.model
          ? `<span class="model-tag">${escapeHtml(msg.model)}</span>`
          : '';
        const content = msg.role === 'user'
          ? `<div class="content-plain">${escapeHtml(msg.content)}</div>`
          : `<div class="content-markdown">${renderMarkdownSafe(msg.content)}</div>`;
        const errorBadge = msg.error ? '<span class="error-badge">ERROR</span>' : '';

        return `
          <div class="message ${roleClass}">
            <div class="msg-header">
              <span class="role">${roleLabel}</span>
              ${modelTag}
              ${errorBadge}
            </div>
            ${content}
          </div>`;
      }).join('');

      return `
        <section class="chat">
          <header class="chat-header">
            <h1>${escapeHtml(chat.title)}</h1>
            <div class="chat-meta">
              Created ${escapeHtml(formatDateHuman(chat.createdAt))} ·
              ${chat.messages.length} messages
            </div>
          </header>
          <div class="messages">
            ${messagesHtml}
          </div>
        </section>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Nexus Chat Export</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
    background: #0a0a0f;
    color: #f0f0f5;
    margin: 0;
    padding: 40px 20px;
    line-height: 1.65;
  }
  .container { max-width: 860px; margin: 0 auto; }
  .export-header {
    text-align: center;
    padding: 30px 20px;
    margin-bottom: 40px;
    border-bottom: 2px solid #2a2a3d;
  }
  .export-header h1 {
    margin: 0 0 8px;
    font-size: 28px;
    background: linear-gradient(135deg, #a29bfe, #6c5ce7);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .export-header .meta {
    color: #6a6a88;
    font-size: 13px;
  }
  .chat {
    margin-bottom: 60px;
    background: #12121a;
    border: 1px solid #2a2a3d;
    border-radius: 16px;
    overflow: hidden;
  }
  .chat-header {
    padding: 20px 24px;
    background: #1a1a26;
    border-bottom: 1px solid #2a2a3d;
  }
  .chat-header h1 {
    margin: 0 0 6px;
    font-size: 20px;
    color: #f0f0f5;
  }
  .chat-meta {
    color: #6a6a88;
    font-size: 12px;
  }
  .messages { padding: 16px; }
  .message {
    padding: 14px 16px;
    margin-bottom: 12px;
    border-radius: 12px;
    background: #0a0a0f;
    border: 1px solid #2a2a3d;
  }
  .message.user {
    background: rgba(108, 92, 231, 0.12);
    border-color: rgba(108, 92, 231, 0.35);
  }
  .msg-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 11px;
    color: #a0a0b8;
  }
  .role {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .message.user .role { color: #a29bfe; }
  .message.assistant .role { color: #74b9ff; }
  .model-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    padding: 2px 8px;
    background: #1a1a26;
    border-radius: 100px;
    color: #6a6a88;
    border: 1px solid #2a2a3d;
  }
  .error-badge {
    padding: 2px 6px;
    background: rgba(225, 112, 85, 0.2);
    border: 1px solid rgba(225, 112, 85, 0.5);
    color: #e17055;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
  }
  .content-plain, .content-markdown {
    font-size: 14px;
    color: #f0f0f5;
    line-height: 1.65;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .content-markdown { white-space: normal; }
  .content-markdown pre {
    background: #050508;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 12px;
    border: 1px solid #2a2a3d;
  }
  .content-markdown code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88em;
    padding: 1px 5px;
    background: #1a1a26;
    border-radius: 4px;
  }
  .content-markdown pre code {
    background: none;
    padding: 0;
  }
  .content-markdown h1, .content-markdown h2, .content-markdown h3 {
    margin: 1em 0 0.4em;
    color: #f0f0f5;
  }
  .content-markdown a { color: #a29bfe; }
  .content-markdown blockquote {
    border-left: 3px solid #6c5ce7;
    padding: 4px 12px;
    margin: 8px 0;
    color: #a0a0b8;
    background: #1a1a26;
  }
  .content-markdown table {
    border-collapse: collapse;
    margin: 8px 0;
  }
  .content-markdown th, .content-markdown td {
    border: 1px solid #2a2a3d;
    padding: 6px 10px;
    font-size: 13px;
  }
  .content-markdown th { background: #1a1a26; }
  .content-markdown ul, .content-markdown ol {
    padding-left: 1.5em;
  }

  @media print {
    body {
      background: #fff;
      color: #000;
      padding: 20px;
    }
    .chat {
      background: #fff;
      border-color: #ccc;
      page-break-inside: avoid;
    }
    .chat-header {
      background: #f5f5f5;
      border-color: #ccc;
    }
    .chat-header h1 { color: #000; }
    .chat-meta { color: #666; }
    .message {
      background: #fff;
      border-color: #ddd;
    }
    .message.user {
      background: #f0f0ff;
      border-color: #ccc;
    }
    .content-plain, .content-markdown { color: #000; }
    .msg-header { color: #555; }
    .message.user .role { color: #444; }
    .message.assistant .role { color: #444; }
    .content-markdown code { background: #f0f0f0; }
    .content-markdown pre { background: #f8f8f8; border-color: #ccc; }
    .model-tag { background: #eee; border-color: #ccc; color: #555; }
  }
</style>
</head>
<body>
  <div class="container">
    <header class="export-header">
      <h1>Nexus Chat Export</h1>
      <div class="meta">
        Exported ${escapeHtml(formatDateHuman())} ·
        ${chats.length} chat${chats.length === 1 ? '' : 's'} ·
        ${totalMessages} message${totalMessages === 1 ? '' : 's'}
      </div>
    </header>
    ${chatHtml}
  </div>
  ${isPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script>' : ''}
</body>
</html>`;
  }

  function renderMarkdownSafe(text) {
    // Use the markdown module if present; otherwise escape
    if (window.Nexus?.Markdown?.render) {
      try { return window.Nexus.Markdown.render(text || ''); } catch (e) {}
    }
    return escapeHtml(text || '');
  }

  /* ============================================================
     BUILD EXPORT CONTENT
     ============================================================ */
  function buildExportContent(chats, format, options = {}) {
    if (!chats || !chats.length) {
      throw new Error('No chats to export');
    }
    switch (format) {
      case 'json': return toJson(chats, options);
      case 'markdown': return toMarkdown(chats, options);
      case 'html': return toHtml(chats, options);
      case 'txt': return toPlainText(chats, options);
      case 'csv': return toCsv(chats, options);
      default: throw new Error(`Unknown format: ${format}`);
    }
  }

  /* ============================================================
     DOWNLOAD
     ============================================================ */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadExport() {
    const chats = getChatsToExport();
    if (!chats.length) {
      showToast('No chats selected', 'warning', 2500);
      return;
    }
    const spec = EXPORT_FORMATS[state.exportFormat];
    if (!spec) {
      showToast('Unknown format', 'error', 2500);
      return;
    }

    let content;
    try {
      content = buildExportContent(chats, state.exportFormat, {
        includeSettings: state.exportIncludeSettings,
      });
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error', 4000);
      return;
    }

    const filename = chats.length === 1
      ? `nexus-chat-${slugify(chats[0].title)}-${formatDate()}.${spec.ext}`
      : `nexus-chats-${formatDate()}.${spec.ext}`;

    download(filename, content, spec.mime);
    showToast(`Downloaded ${filename} (${humanBytes(content.length)})`, 'success', 3000);
  }

  function previewExport() {
    const chats = getChatsToExport();
    if (!chats.length) {
      showToast('No chats selected', 'warning', 2500);
      return;
    }

    let content;
    try {
      content = buildExportContent(chats, state.exportFormat, {
        includeSettings: state.exportIncludeSettings,
      });
    } catch (err) {
      showToast('Preview failed: ' + err.message, 'error', 4000);
      return;
    }

    const section = state.modalEl.querySelector('#nxPreviewSection');
    if (!section) return;

    const MAX = 60000;
    const previewText = content.length > MAX
      ? content.slice(0, MAX) + '\n\n... [truncated — ' + humanBytes(content.length - MAX) + ' more]'
      : content;

    section.innerHTML = `
      <div class="nx-data-section-title">Preview</div>
      <div class="nx-preview-panel">
        <div class="nx-preview-header">
          <span>${escapeHtml(EXPORT_FORMATS[state.exportFormat].label)} · ${humanBytes(content.length)}</span>
          <span>${chats.length} chat${chats.length === 1 ? '' : 's'}</span>
        </div>
        <pre class="nx-preview-pre">${escapeHtml(previewText)}</pre>
      </div>`;
    section.style.display = '';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function printExport() {
    const chats = getChatsToExport();
    if (!chats.length) {
      showToast('No chats selected', 'warning', 2500);
      return;
    }
    if (state.exportFormat === 'csv') {
      showToast('Print is not available for CSV', 'warning', 2500);
      return;
    }
    const html = toHtml(chats, { printMode: true });

    // Use hidden iframe to avoid popup blockers
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          showToast('Print failed — try Download as HTML instead', 'error', 3500);
        }
        setTimeout(() => iframe.remove(), 10000);
      }, 800);
    } catch (err) {
      showToast('Print failed: ' + err.message, 'error', 3000);
      iframe.remove();
    }
  }

  /* ============================================================
     SHARE LINK
     ============================================================ */
  function minimizeChat(chat) {
    return {
      t: chat.title,
      m: (chat.messages || []).map(m => ({
        r: m.role === 'user' ? 'u' : m.role === 'assistant' ? 'a' : 's',
        c: m.content || '',
      })),
    };
  }

  async function copyShareLink() {
    const chats = getChatsToExport();
    if (!chats.length) {
      showToast('No chats selected', 'warning', 2500);
      return;
    }

    const payload = {
      v: SHARE_VERSION,
      chats: chats.map(minimizeChat),
    };
    const json = JSON.stringify(payload);
    let encoded;
    try {
      encoded = await compressToUrlSafe(json);
    } catch (err) {
      showToast('Compression failed: ' + err.message, 'error', 3000);
      return;
    }

    const url = `${location.origin}${location.pathname}#share=${encoded}`;

    if (url.length > 8000) {
      showToast(
        `Share link is too large (${humanBytes(url.length)}). Try fewer chats or download instead.`,
        'warning',
        6000
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast(`Share link copied (${humanBytes(url.length)})`, 'success', 3000);
    } catch (e) {
      // Fallback: prompt
      window.prompt('Copy this share link:', url);
    }
  }

  async function compressToUrlSafe(str) {
    const bytes = new TextEncoder().encode(str);
    let compressed;

    if (typeof CompressionStream !== 'undefined') {
      try {
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const reader = cs.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        compressed = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          compressed.set(c, off);
          off += c.length;
        }
      } catch (e) {
        compressed = bytes;
      }
    } else {
      compressed = bytes;
    }
    return base64UrlEncode(compressed);
  }

  async function decompressFromUrlSafe(str) {
    const bytes = base64UrlDecode(str);

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) {
          out.set(c, off);
          off += c.length;
        }
        return new TextDecoder().decode(out);
      } catch (e) {
        // Not compressed — try raw
        return new TextDecoder().decode(bytes);
      }
    }
    return new TextDecoder().decode(bytes);
  }

  function base64UrlEncode(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function base64UrlDecode(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function checkShareOnLoad() {
    if (!location.hash.startsWith('#share=')) return;
    const encoded = location.hash.slice(7);
    if (!encoded) return;
    try {
      const json = await decompressFromUrlSafe(encoded);
      const payload = JSON.parse(json);
      if (payload && Array.isArray(payload.chats) && payload.chats.length) {
        // Confirm before importing
        setTimeout(() => {
          const ok = confirm(
            `This link contains ${payload.chats.length} shared chat${payload.chats.length === 1 ? '' : 's'}.\n\n` +
            `Import them into your local chats?`
          );
          if (ok) {
            // Expand minimized format back to full chats
            const expanded = payload.chats.map(c => ({
              id: genUuid(),
              title: c.t || 'Shared chat',
              messages: (c.m || []).map(m => ({
                role: m.r === 'u' ? 'user' : m.r === 'a' ? 'assistant' : 'system',
                content: m.c || '',
                timestamp: new Date().toISOString(),
              })),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
            const result = applyImport({ chats: expanded }, 'merge');
            showToast(
              `Imported ${result.imported} chat${result.imported === 1 ? '' : 's'} from share link`,
              'success',
              3500
            );
            history.replaceState(null, '', location.pathname + location.search);
          }
        }, 600);
      }
    } catch (err) {
      console.warn('Invalid share link:', err);
      showToast('Invalid share link', 'error', 3000);
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function genUuid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ============================================================
     IMPORT TAB
     ============================================================ */
  function renderImportTab(container) {
    container.innerHTML = '';

    // Drop zone
    const dropSection = document.createElement('div');
    dropSection.className = 'nx-data-section';
    dropSection.innerHTML = `
      <div class="nx-data-section-title">Upload file</div>
      <div class="nx-drop-zone" id="nxDropZone">
        <div class="nx-drop-icon">📥</div>
        <div class="nx-drop-text">Drop a JSON export file here</div>
        <div class="nx-drop-sub">or click to browse · .json only</div>
      </div>
      <input type="file" id="nxFileInput" accept=".json,application/json" style="display:none">
      <div id="nxImportStatusHost"></div>`;
    container.appendChild(dropSection);

    const dropZone = dropSection.querySelector('#nxDropZone');
    const fileInput = dropSection.querySelector('#nxFileInput');
    const statusHost = dropSection.querySelector('#nxImportStatusHost');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) await handleImportFile(file, statusHost);
      fileInput.value = '';
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) await handleImportFile(file, statusHost);
    });

    // Paste JSON directly
    const pasteSection = document.createElement('div');
    pasteSection.className = 'nx-data-section';
    pasteSection.innerHTML = `
      <div class="nx-data-section-title">Or paste JSON</div>
      <textarea id="nxPasteArea" placeholder="Paste exported JSON here…"
        style="width:100%;min-height:100px;padding:10px;border-radius:8px;
        border:1px solid var(--border-subtle);background:var(--bg-tertiary);
        color:var(--text-primary);font-family:var(--font-mono);font-size:11px;
        resize:vertical;outline:none;line-height:1.5;"></textarea>
      <div class="nx-action-row" style="margin-top:10px;">
        <button class="nx-action-btn" id="nxPasteBtn">Load from text</button>
      </div>`;
    container.appendChild(pasteSection);

    const pasteArea = pasteSection.querySelector('#nxPasteArea');
    pasteSection.querySelector('#nxPasteBtn').addEventListener('click', () => {
      const text = pasteArea.value.trim();
      if (!text) {
        showToast('Nothing to import', 'warning', 2500);
        return;
      }
      try {
        const payload = JSON.parse(text);
        validateAndStoreImport(payload, statusHost);
      } catch (err) {
        showImportStatus(statusHost, 'error', 'Invalid JSON', err.message);
      }
    });

    // Options
    const optionsSection = document.createElement('div');
    optionsSection.className = 'nx-data-section';
    optionsSection.innerHTML = `
      <div class="nx-data-section-title">Merge mode</div>
      <div class="nx-radio-group" id="nxImportModeGroup">
        <button class="nx-radio-chip ${state.importMode === 'merge' ? 'active' : ''}" data-mode="merge">Merge</button>
        <button class="nx-radio-chip ${state.importMode === 'replace' ? 'active' : ''}" data-mode="replace">Replace all</button>
        <button class="nx-radio-chip ${state.importMode === 'skip' ? 'active' : ''}" data-mode="skip">Skip existing</button>
      </div>
      <div class="nx-checkbox-hint" style="margin-top:8px;">
        <strong>Merge:</strong> add all chats from the file (IDs are regenerated to avoid conflicts).<br>
        <strong>Replace:</strong> delete all existing chats first, then import.<br>
        <strong>Skip:</strong> keep existing chats with matching IDs, add the rest.
      </div>`;
    container.appendChild(optionsSection);

    optionsSection.querySelectorAll('.nx-radio-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.importMode = btn.dataset.mode;
        optionsSection.querySelectorAll('.nx-radio-chip').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
      });
    });

    // Action
    const actionSection = document.createElement('div');
    actionSection.className = 'nx-action-row';
    actionSection.innerHTML = `
      <button class="nx-action-btn primary" id="nxImportBtn" disabled>Import chats</button>`;
    container.appendChild(actionSection);

    actionSection.querySelector('#nxImportBtn').addEventListener('click', () => {
      if (!state.pendingImport) return;
      doImport(statusHost);
    });
  }

  async function handleImportFile(file, statusHost) {
    if (file.size > 20 * 1024 * 1024) {
      showImportStatus(statusHost, 'error', 'File too large', `Maximum size is 20 MB (got ${humanBytes(file.size)})`);
      return;
    }
    try {
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (err) {
        showImportStatus(statusHost, 'error', 'Invalid JSON', err.message);
        return;
      }
      validateAndStoreImport(payload, statusHost, file.name);
    } catch (err) {
      showImportStatus(statusHost, 'error', 'Read failed', err.message);
    }
  }

  function validateAndStoreImport(payload, statusHost, filename) {
    const result = validateImportPayload(payload);
    if (!result.valid) {
      state.pendingImport = null;
      showImportStatus(statusHost, 'error', 'Invalid import file', result.error);
      const btn = document.querySelector('#nxImportBtn');
      if (btn) btn.disabled = true;
      return;
    }

    state.pendingImport = payload;

    const totalMessages = payload.chats.reduce((s, c) => s + (c.messages?.length || 0), 0);
    const details = [
      `${payload.chats.length} chat${payload.chats.length === 1 ? '' : 's'}`,
      `${totalMessages} message${totalMessages === 1 ? '' : 's'}`,
    ];
    if (filename) details.push(`File: ${filename}`);
    if (payload.exportedAt) details.push(`Exported: ${formatDateHuman(payload.exportedAt)}`);
    if (payload.nexus_export_version) details.push(`Version: ${payload.nexus_export_version}`);

    showImportStatus(statusHost, 'success', 'Ready to import', details.join(' · '));

    const btn = document.querySelector('#nxImportBtn');
    if (btn) btn.disabled = false;
  }

  function validateImportPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { valid: false, error: 'Root must be an object' };
    }
    if (!Array.isArray(payload.chats)) {
      return { valid: false, error: 'Missing "chats" array' };
    }
    if (!payload.chats.length) {
      return { valid: false, error: 'File contains no chats' };
    }
    for (let i = 0; i < payload.chats.length; i++) {
      const c = payload.chats[i];
      if (!c || typeof c !== 'object') {
        return { valid: false, error: `Chat ${i + 1} is not an object` };
      }
      if (typeof c.title !== 'string' || !c.title.trim()) {
        return { valid: false, error: `Chat ${i + 1} is missing a title` };
      }
      if (!Array.isArray(c.messages)) {
        return { valid: false, error: `Chat ${i + 1} is missing a messages array` };
      }
      for (let j = 0; j < c.messages.length; j++) {
        const m = c.messages[j];
        if (!m || typeof m !== 'object') {
          return { valid: false, error: `Chat ${i + 1} · message ${j + 1} is not an object` };
        }
        if (!['user', 'assistant', 'system'].includes(m.role)) {
          return { valid: false, error: `Chat ${i + 1} · message ${j + 1} has invalid role: ${m.role}` };
        }
        if (typeof m.content !== 'string') {
          return { valid: false, error: `Chat ${i + 1} · message ${j + 1} has non-string content` };
        }
      }
    }
    return { valid: true };
  }

  function showImportStatus(host, kind, title, detail) {
    if (!host) return;
    const icon = kind === 'success' ? '✓' : kind === 'error' ? '✕' : 'ℹ';
    host.innerHTML = `
      <div class="nx-import-status ${kind}">
        <div class="nx-import-status-icon">${icon}</div>
        <div class="nx-import-status-body">
          <div class="nx-import-status-title">${escapeHtml(title)}</div>
          <div class="nx-import-status-detail">${escapeHtml(detail || '')}</div>
        </div>
      </div>`;
  }

  function doImport(statusHost) {
    if (!state.pendingImport) return;

    let result;
    try {
      result = applyImport(state.pendingImport, state.importMode);
    } catch (err) {
      showImportStatus(statusHost, 'error', 'Import failed', err.message);
      return;
    }

    // Refresh UI
    window.__nexus.renderChatList();
    if (result.imported > 0 && window.__nexus.state.chats.length > 0) {
      // Select first imported chat
      const firstImported = window.__nexus.state.chats.find(c => result.importedIds.includes(c.id));
      if (firstImported) {
        window.__nexus.state.activeChatId = firstImported.id;
        window.__nexus.renderActiveChat();
      }
    }

    showToast(
      `Imported ${result.imported} chat${result.imported === 1 ? '' : 's'} · ` +
      `${result.messages} message${result.messages === 1 ? '' : 's'}`,
      'success',
      3500
    );

    // Reset pending import
    state.pendingImport = null;

    const btn = document.querySelector('#nxImportBtn');
    if (btn) btn.disabled = true;

    showImportStatus(
      statusHost,
      'success',
      'Import complete',
      `${result.imported} chat${result.imported === 1 ? '' : 's'} added to your library.`
    );
  }

  function applyImport(payload, mode) {
    const nexusState = window.__nexus.state;
    const existingChats = nexusState.chats;
    const existingIds = new Set(existingChats.map(c => c.id));

    if (mode === 'replace') {
      nexusState.chats.length = 0;
      nexusState.activeChatId = null;
    }

    let importedCount = 0;
    let importedMessages = 0;
    const importedIds = [];

    for (const rawChat of payload.chats) {
      // Skip if mode is 'skip' and chat id exists
      if (mode === 'skip' && rawChat.id && existingIds.has(rawChat.id)) {
        continue;
      }

      // Generate a fresh ID unless it's safe to use existing
      let chatId;
      if (rawChat.id && !existingIds.has(rawChat.id) && mode !== 'merge') {
        chatId = rawChat.id;
      } else {
        chatId = genUuid();
      }

      const newChat = {
        id: chatId,
        title: String(rawChat.title || 'Imported chat').slice(0, 100),
        messages: (rawChat.messages || []).map(m => ({
          role: m.role,
          content: m.content || '',
          timestamp: m.timestamp || new Date().toISOString(),
          model: m.model,
          usage: m.usage,
          error: m.error,
        })),
        createdAt: rawChat.createdAt || new Date().toISOString(),
        updatedAt: rawChat.updatedAt || new Date().toISOString(),
        parentChatId: rawChat.parentChatId,
        branchedFromIndex: rawChat.branchedFromIndex,
      };

      // Merge mode: if title collision, suffix
      if (mode === 'merge') {
        const titleExists = existingChats.some(c => c.title === newChat.title);
        if (titleExists) {
          newChat.title = newChat.title + ' (imported)';
        }
      }

      nexusState.chats.push(newChat);
      existingIds.add(chatId);
      importedIds.push(chatId);
      importedCount++;
      importedMessages += newChat.messages.length;
    }

    // Restore settings/folders if included in payload
    if (payload.settings && window.Nexus?.Settings) {
      try {
        const currentSettings = window.Nexus.Settings.get();
        const merged = { ...currentSettings, ...payload.settings };
        // Write via localStorage directly (Settings has no public setter for partial)
        localStorage.setItem('nexus_settings_v1', JSON.stringify(merged));
        // Trigger settings reload event
        window.dispatchEvent(new Event('nexus:settings-changed'));
        // Note: actual full reload requires page refresh. We apply what we can.
      } catch (e) {
        console.debug('Settings merge skipped:', e.message);
      }
    }

    if (payload.folders && typeof payload.folders === 'object') {
      try {
        localStorage.setItem('nexus_folders_v1', JSON.stringify(payload.folders));
        window.dispatchEvent(new Event('nexus:folders-changed'));
      } catch (e) {
        console.debug('Folders merge skipped:', e.message);
      }
    }

    // Persist
    if (window.__nexus.persistChats) window.__nexus.persistChats();

    return {
      imported: importedCount,
      messages: importedMessages,
      importedIds,
    };
  }

  /* ============================================================
     BACKUP TAB
     ============================================================ */
  function renderBackupTab(container) {
    container.innerHTML = '';

    const infoSection = document.createElement('div');
    infoSection.className = 'nx-data-section';
    infoSection.innerHTML = `
      <div class="nx-data-section-title">Overview</div>
      <div style="padding:14px 16px;background:var(--bg-tertiary);border:1px solid var(--border-subtle);
        border-radius:10px;font-size:12px;color:var(--text-secondary);line-height:1.6;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Chats</span>
          <span style="font-family:var(--font-mono);color:var(--text-primary);">${(window.__nexus?.state?.chats || []).length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Messages</span>
          <span style="font-family:var(--font-mono);color:var(--text-primary);">${(window.__nexus?.state?.chats || []).reduce((s, c) => s + c.messages.length, 0)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>Local storage usage</span>
          <span style="font-family:var(--font-mono);color:var(--text-primary);" id="nxStorageSize">—</span>
        </div>
      </div>`;
    container.appendChild(infoSection);

    // Compute storage size
    setTimeout(() => {
      const el = container.querySelector('#nxStorageSize');
      if (el) {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('nexus_')) {
            total += (localStorage.getItem(key) || '').length + key.length;
          }
        }
        el.textContent = humanBytes(total * 2); // rough UTF-16 estimate
      }
    }, 20);

    // Backup card
    const backupSection = document.createElement('div');
    backupSection.className = 'nx-data-section';
    backupSection.innerHTML = `
      <div class="nx-data-section-title">Create backup</div>
      <div class="nx-backup-card">
        <div class="nx-backup-icon">💾</div>
        <div class="nx-backup-info">
          <div class="nx-backup-name">Full backup (JSON)</div>
          <div class="nx-backup-desc">
            All chats, folders, and settings in one portable file.
            Can be restored later or imported into another Nexus instance.
          </div>
        </div>
        <div class="nx-backup-actions">
          <button class="nx-action-btn primary" id="nxCreateBackupBtn">Download</button>
        </div>
      </div>`;
    container.appendChild(backupSection);

    backupSection.querySelector('#nxCreateBackupBtn').addEventListener('click', createBackup);

    // Restore card
    const restoreSection = document.createElement('div');
    restoreSection.className = 'nx-data-section';
    restoreSection.innerHTML = `
      <div class="nx-data-section-title">Restore backup</div>
      <div class="nx-backup-card">
        <div class="nx-backup-icon">📂</div>
        <div class="nx-backup-info">
          <div class="nx-backup-name">Restore from file</div>
          <div class="nx-backup-desc">
            Load a backup file. You'll be asked how to merge with your current data.
          </div>
        </div>
        <div class="nx-backup-actions">
          <button class="nx-action-btn" id="nxRestoreBackupBtn">Choose file</button>
        </div>
      </div>
      <input type="file" id="nxRestoreInput" accept=".json,application/json" style="display:none">
      <div id="nxRestoreStatusHost"></div>`;
    container.appendChild(restoreSection);

    const restoreBtn = restoreSection.querySelector('#nxRestoreBackupBtn');
    const restoreInput = restoreSection.querySelector('#nxRestoreInput');
    const restoreStatus = restoreSection.querySelector('#nxRestoreStatusHost');

    restoreBtn.addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        await handleRestore(payload, restoreStatus);
      } catch (err) {
        showImportStatus(restoreStatus, 'error', 'Restore failed', err.message);
      }
      restoreInput.value = '';
    });

    // Danger zone
    const dangerSection = document.createElement('div');
    dangerSection.className = 'nx-data-section';
    dangerSection.innerHTML = `
      <div class="nx-data-section-title" style="color:var(--danger);">Danger zone</div>
      <div class="nx-backup-card" style="border-color:rgba(225,112,85,0.3);">
        <div class="nx-backup-icon" style="border-color:rgba(225,112,85,0.3);">⚠️</div>
        <div class="nx-backup-info">
          <div class="nx-backup-name" style="color:var(--danger);">Clear all local data</div>
          <div class="nx-backup-desc">
            Delete all chats, folders, settings, and search history from this browser.
            This cannot be undone.
          </div>
        </div>
        <div class="nx-backup-actions">
          <button class="nx-action-btn danger" id="nxClearAllBtn">Clear everything</button>
        </div>
      </div>`;
    container.appendChild(dangerSection);

    dangerSection.querySelector('#nxClearAllBtn').addEventListener('click', clearAllData);
  }

  function createBackup() {
    const chats = window.__nexus.state.chats || [];
    const payload = {
      nexus_backup_version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: 'nexus-chat',
      chats: chats.map(serializeChat),
    };
    if (window.Nexus?.Settings) {
      try { payload.settings = window.Nexus.Settings.get(); } catch (e) {}
    }
    if (window.Nexus?.Folders) {
      try { payload.folders = window.Nexus.Folders.getState(); } catch (e) {}
    }

    const json = JSON.stringify(payload, null, 2);
    const filename = `nexus-backup-${formatDate()}.json`;
    download(filename, json, 'application/json');
    showToast(
      `Backup created (${humanBytes(json.length)} · ${chats.length} chats)`,
      'success',
      3500
    );
  }

  async function handleRestore(payload, statusHost) {
    if (!payload || typeof payload !== 'object') {
      showImportStatus(statusHost, 'error', 'Invalid backup', 'Root must be an object');
      return;
    }
    if (!Array.isArray(payload.chats)) {
      showImportStatus(statusHost, 'error', 'Invalid backup', 'Missing chats array');
      return;
    }

    const result = validateImportPayload(payload);
    if (!result.valid) {
      showImportStatus(statusHost, 'error', 'Invalid backup', result.error);
      return;
    }

    // Ask user
    const mode = window.prompt(
      `Restore ${payload.chats.length} chat${payload.chats.length === 1 ? '' : 's'}?\n\n` +
      `Type "merge" to add them alongside existing chats.\n` +
      `Type "replace" to wipe existing chats and restore only this backup.`,
      'merge'
    );
    if (!mode) return;
    const normalized = mode.toLowerCase().trim();
    if (normalized !== 'merge' && normalized !== 'replace') {
      showImportStatus(statusHost, 'error', 'Restore cancelled', 'Invalid mode');
      return;
    }

    try {
      const importResult = applyImport(payload, normalized);
      window.__nexus.renderChatList();

      if (importResult.imported > 0) {
        const firstImported = window.__nexus.state.chats.find(c => importResult.importedIds.includes(c.id));
        if (firstImported) {
          window.__nexus.state.activeChatId = firstImported.id;
          window.__nexus.renderActiveChat();
        }
      }

      showImportStatus(
        statusHost,
        'success',
        'Restore complete',
        `${importResult.imported} chats · ${importResult.messages} messages restored. ` +
        `Reload the page to see settings/folder changes take effect.`
      );
      showToast(
        `Restored ${importResult.imported} chat${importResult.imported === 1 ? '' : 's'}`,
        'success',
        3500
      );
    } catch (err) {
      showImportStatus(statusHost, 'error', 'Restore failed', err.message);
    }
  }

  function clearAllData() {
    const first = confirm(
      'Clear all local data?\n\n' +
      'This will delete all chats, folders, settings, and search history from this browser.'
    );
    if (!first) return;
    const second = confirm(
      'Are you absolutely sure?\n\n' +
      'This cannot be undone. Consider creating a backup first.'
    );
    if (!second) return;

    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('nexus_')) toRemove.push(key);
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      window.__nexus.state.chats = [];
      window.__nexus.state.activeChatId = null;
      window.__nexus.renderChatList();
      window.__nexus.renderActiveChat();

      showToast('All local data cleared', 'success', 3000);
      closeModal();
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      showToast('Clear failed: ' + err.message, 'error', 3500);
    }
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Export = {
    open: openModal,
    close: closeModal,
    toJson,
    toMarkdown,
    toHtml,
    toPlainText,
    toCsv,
    download,
    buildExportContent,
    exportChats: (chats, format, options) => {
      const spec = EXPORT_FORMATS[format];
      if (!spec) throw new Error(`Unknown format: ${format}`);
      const content = buildExportContent(chats, format, options || {});
      const filename = `nexus-chats-${formatDate()}.${spec.ext}`;
      download(filename, content, spec.mime);
      return { filename, content, size: content.length };
    },
    exportCurrentChat: (format) => {
      const id = window.__nexus.state.activeChatId;
      const chat = window.__nexus.state.chats.find(c => c.id === id);
      if (!chat) throw new Error('No active chat');
      const spec = EXPORT_FORMATS[format || 'json'];
      const content = buildExportContent([chat], format || 'json', {});
      const filename = `nexus-chat-${slugify(chat.title)}-${formatDate()}.${spec.ext}`;
      download(filename, content, spec.mime);
      return { filename, content, size: content.length };
    },
    exportAllChats: (format) => {
      return window.Nexus.Export.exportChats(
        window.__nexus.state.chats.slice(),
        format || 'json',
        { includeSettings: true }
      );
    },
    buildShareLink: async (chats) => {
      const payload = {
        v: SHARE_VERSION,
        chats: (chats || []).map(minimizeChat),
      };
      const encoded = await compressToUrlSafe(JSON.stringify(payload));
      return `${location.origin}${location.pathname}#share=${encoded}`;
    },
    importJson: (jsonText, mode) => {
      let payload;
      try { payload = JSON.parse(jsonText); }
      catch (e) { throw new Error('Invalid JSON: ' + e.message); }
      const v = validateImportPayload(payload);
      if (!v.valid) throw new Error(v.error);
      const result = applyImport(payload, mode || 'merge');
      window.__nexus.renderChatList();
      return result;
    },
    validateImportPayload,
    applyImport,
    formats: EXPORT_FORMATS,
  };

  window.Nexus.Backup = {
    create: createBackup,
    openRestore: () => {
      openModal({ tab: 'backup' });
      setTimeout(() => {
        const input = document.getElementById('nxRestoreInput');
        if (input) input.click();
      }, 200);
    },
    clearAll: clearAllData,
  };

  window.Nexus.DataManager = {
    open: openModal,
    close: closeModal,
  };
})();
