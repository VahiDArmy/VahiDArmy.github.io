/* ============================================================
   NEXUS CHAT — MODEL MANAGER
   Comprehensive model browser: search, sort, filter, favorite,
   compare, inspect, and manage fallback chains.

   Auto-loaded by index.html. Injects its own CSS.

   Public API:
     window.Nexus.ModelManager.open()
     window.Nexus.ModelManager.close()
     window.Nexus.ModelManager.getFavorites()
     window.Nexus.ModelManager.toggleFavorite(modelId)
     window.Nexus.ModelManager.getFallbackChain()
     window.Nexus.ModelManager.setFallbackChain(ids)
     window.Nexus.ModelManager.getCompareSet()
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_modelmanager_loaded__) return;
  window.__nexus_modelmanager_loaded__ = true;

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const FAVORITES_KEY = 'nexus_model_favorites_v1';
  const FALLBACK_KEY = 'nexus_fallback_default_v1';
  const COMPARE_KEY = 'nexus_compare_models_v1';
  const MAX_COMPARE = 4;
  const MAX_FALLBACK = 4;

  const SORT_MODES = [
    { id: 'name', label: 'Name (A–Z)' },
    { id: 'context', label: 'Context (largest)' },
    { id: 'context-asc', label: 'Context (smallest)' },
    { id: 'provider', label: 'Provider' },
    { id: 'favorites', label: 'Favorites first' },
  ];

  const PROVIDER_COLORS = {
    openai: '#74b9ff',
    anthropic: '#fdcb6e',
    google: '#00cec9',
    'meta-llama': '#a29bfe',
    mistralai: '#e17055',
    microsoft: '#74b9ff',
    deepseek: '#00b894',
    qwen: '#fdcb6e',
    'x-ai': '#e84393',
    'x-google': '#00cec9',
    nvidia: '#00b894',
    cohere: '#e84393',
    perplexity: '#74b9ff',
    openrouter: '#6c5ce7',
    nousresearch: '#a29bfe',
    'thudm': '#fdcb6e',
    'liquid': '#00b894',
  };

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    favorites: [],
    fallbackChain: [],
    compareSet: [],
    searchQuery: '',
    sortMode: 'name',
    filter: 'all',
    activeTab: 'browse',
    modalEl: null,
    infoModelId: null,
    infoOverlayEl: null,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-mm-styles')) return;
    const css = `
/* ============================================================
   MODEL MANAGER
   ============================================================ */
.nx-mm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 4, 10, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2650;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.nx-mm-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-mm-modal {
  width: 100%;
  max-width: 960px;
  max-height: 92vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(0.96) translateY(-6px);
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.nx-mm-overlay.open .nx-mm-modal {
  transform: scale(1) translateY(0);
}
.nx-mm-header {
  padding: 16px 22px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.nx-mm-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.nx-mm-title svg { color: var(--accent-secondary); }
.nx-mm-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: var(--bg-secondary);
  overflow-x: auto;
  scrollbar-width: none;
}
.nx-mm-tabs::-webkit-scrollbar { display: none; }
.nx-mm-tab {
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
  position: relative;
  top: 1px;
}
.nx-mm-tab:hover { color: var(--text-secondary); }
.nx-mm-tab.active {
  color: var(--accent-secondary);
  border-bottom-color: var(--accent-primary);
}
.nx-mm-tab .count {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border-radius: 100px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--text-tertiary);
}
.nx-mm-tab.active .count {
  background: var(--accent-glow);
  color: var(--accent-secondary);
}
.nx-mm-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ============================================================
   BROWSE TAB
   ============================================================ */
.nx-mm-toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.nx-mm-search-wrap {
  flex: 1;
  min-width: 200px;
  position: relative;
}
.nx-mm-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
  display: flex;
}
.nx-mm-search {
  width: 100%;
  padding: 9px 12px 9px 34px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.nx-mm-search:focus { border-color: var(--accent-primary); }
.nx-mm-search::placeholder { color: var(--text-tertiary); }
.nx-mm-sort-select {
  padding: 9px 28px 9px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23a0a0b8' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}
.nx-mm-filters {
  display: flex;
  gap: 6px;
  padding: 8px 20px 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.nx-mm-filters::-webkit-scrollbar { display: none; }
.nx-mm-filter {
  padding: 4px 11px;
  border-radius: 100px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.nx-mm-filter:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nx-mm-filter.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
  font-weight: 600;
}

.nx-mm-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 16px;
}
.nx-mm-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.1s;
  border: 1px solid transparent;
  cursor: pointer;
  margin-bottom: 2px;
}
.nx-mm-row:hover { background: var(--bg-tertiary); }
.nx-mm-row.active {
  background: var(--bg-elevated);
  border-color: var(--accent-primary);
}
.nx-mm-row-checkbox {
  width: 14px;
  height: 14px;
  accent-color: var(--accent-primary);
  cursor: pointer;
  flex-shrink: 0;
}
.nx-mm-row-star {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  padding: 0;
  flex-shrink: 0;
  transition: color 0.15s;
}
.nx-mm-row-star:hover { color: var(--warning); }
.nx-mm-row-star.active { color: var(--warning); }
.nx-mm-row-star svg { width: 14px; height: 14px; }

.nx-mm-row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.nx-mm-row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nx-mm-row-title .current-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  background: var(--accent-primary);
  color: #fff;
  border-radius: 100px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  flex-shrink: 0;
}
.nx-mm-row-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  flex-wrap: wrap;
}
.nx-mm-row-provider {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-elevated);
  font-size: 10px;
  font-weight: 600;
}
.nx-mm-row-provider .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.nx-mm-row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.nx-mm-row:hover .nx-mm-row-actions { opacity: 1; }
.nx-mm-icon-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  padding: 0;
  transition: all 0.12s;
}
.nx-mm-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-mm-icon-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-mm-icon-btn.primary:hover {
  background: var(--accent-secondary);
}

.nx-mm-empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.6;
}
.nx-mm-empty .big-icon {
  font-size: 42px;
  margin-bottom: 12px;
  opacity: 0.4;
}

/* ============================================================
   COMPARE TAB (matrix)
   ============================================================ */
.nx-mm-compare-wrap {
  flex: 1;
  overflow: auto;
  padding: 16px 20px 20px;
}
.nx-mm-compare-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.nx-mm-compare-toolbar .count {
  font-family: var(--font-mono);
  color: var(--accent-secondary);
  font-weight: 600;
}
.nx-mm-compare-toolbar .spacer { flex: 1; }
.nx-mm-compare-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  overflow: hidden;
  font-size: 12px;
}
.nx-mm-compare-table thead th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-strong);
  white-space: nowrap;
}
.nx-mm-compare-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 11px;
  vertical-align: middle;
  white-space: nowrap;
}
.nx-mm-compare-table tbody tr:last-child td { border-bottom: none; }
.nx-mm-compare-table tbody tr:hover { background: var(--bg-tertiary); }
.nx-mm-compare-table tbody td.primary-col {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
}
.nx-mm-compare-table .best {
  color: var(--success);
  font-weight: 700;
}
.nx-mm-compare-table .remove-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  transition: all 0.12s;
}
.nx-mm-compare-table .remove-btn:hover {
  background: rgba(225, 112, 85, 0.2);
  color: var(--danger);
}

/* ============================================================
   FALLBACK TAB
   ============================================================ */
.nx-mm-fallback-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.nx-mm-fallback-intro {
  padding: 12px 14px;
  background: rgba(108, 92, 231, 0.08);
  border: 1px solid rgba(108, 92, 231, 0.25);
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 16px;
}
.nx-mm-fallback-intro strong { color: var(--accent-secondary); }
.nx-mm-chain-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.nx-mm-chain-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  cursor: grab;
  transition: all 0.15s;
}
.nx-mm-chain-item:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}
.nx-mm-chain-item.dragging {
  opacity: 0.5;
  cursor: grabbing;
}
.nx-mm-chain-item.drop-target {
  border-color: var(--accent-primary);
  border-style: dashed;
}
.nx-mm-chain-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.nx-mm-chain-rank.primary {
  background: var(--accent-primary);
  color: #fff;
}
.nx-mm-chain-body {
  flex: 1;
  min-width: 0;
}
.nx-mm-chain-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nx-mm-chain-meta {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
  margin-top: 2px;
}
.nx-mm-chain-remove {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.12s;
}
.nx-mm-chain-remove:hover {
  background: rgba(225, 112, 85, 0.15);
  color: var(--danger);
}
.nx-mm-chain-add {
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  background: transparent;
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 12px;
  cursor: pointer;
  width: 100%;
  text-align: center;
  transition: all 0.12s;
}
.nx-mm-chain-add:hover {
  border-color: var(--accent-primary);
  background: rgba(108, 92, 231, 0.06);
  color: var(--text-primary);
}

/* ============================================================
   INFO CARD MODAL
   ============================================================ */
.nx-mm-info-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(6px);
  z-index: 2750;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}
.nx-mm-info-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-mm-info-modal {
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  transform: scale(0.96);
  transition: transform 0.18s;
  overflow: hidden;
}
.nx-mm-info-overlay.open .nx-mm-info-modal {
  transform: scale(1);
}
.nx-mm-info-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.nx-mm-info-title-wrap { flex: 1; min-width: 0; }
.nx-mm-info-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  word-break: break-word;
}
.nx-mm-info-id {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 4px;
  word-break: break-all;
}
.nx-mm-info-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
.nx-mm-info-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}
.nx-mm-info-section {
  margin-bottom: 16px;
}
.nx-mm-info-section:last-child { margin-bottom: 0; }
.nx-mm-info-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.nx-mm-info-section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}
.nx-mm-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  font-size: 12px;
  border-bottom: 1px dashed var(--border-subtle);
}
.nx-mm-info-row:last-child { border-bottom: none; }
.nx-mm-info-row .key {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.nx-mm-info-row .val {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: right;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.nx-mm-info-row .val.accent { color: var(--accent-secondary); }
.nx-mm-info-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.nx-mm-info-tag {
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}
.nx-mm-info-tag.success {
  background: rgba(0, 184, 148, 0.15);
  border-color: var(--success);
  color: var(--success);
}
.nx-mm-info-tag.accent {
  background: rgba(108, 92, 231, 0.15);
  border-color: var(--accent-primary);
  color: var(--accent-secondary);
}
.nx-mm-info-actions {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  flex-wrap: wrap;
}
.nx-mm-info-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nx-mm-info-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-mm-info-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-mm-info-btn.primary:hover { background: var(--accent-secondary); }
.nx-mm-info-btn.danger {
  color: var(--danger);
  border-color: rgba(225, 112, 85, 0.4);
}
.nx-mm-info-btn.danger:hover {
  background: rgba(225, 112, 85, 0.12);
  border-color: var(--danger);
}
.nx-mm-info-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ============================================================
   SIDEBAR MODEL-BROWSE BUTTON
   ============================================================ */
.nx-mm-sidebar-browse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 4px;
  gap: 5px;
}
.nx-mm-sidebar-browse:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

/* ============================================================
   RESPONSIVE
   ============================================================ */
@media (max-width: 700px) {
  .nx-mm-overlay { padding: 10px; }
  .nx-mm-modal { max-height: 95vh; }
  .nx-mm-header { padding: 14px 16px; }
  .nx-mm-toolbar { padding: 10px 14px; }
  .nx-mm-filters { padding: 6px 14px 10px; }
  .nx-mm-list { padding: 6px 6px 12px; }
  .nx-mm-compare-wrap { padding: 12px 10px; }
  .nx-mm-compare-table tbody td,
  .nx-mm-compare-table thead th { padding: 8px 6px; font-size: 10px; }
  .nx-mm-info-overlay { padding: 10px; }
  .nx-mm-info-modal { max-height: 92vh; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-mm-styles';
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
    load();
    mountTopBarButton();
    mountSidebarBrowseButton();
    buildModal();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.infoOverlayEl && state.infoOverlayEl.classList.contains('open')) {
        closeInfoCard();
      }
    });
  });

  /* ============================================================
     STORAGE
     ============================================================ */
  function load() {
    try {
      const fav = localStorage.getItem(FAVORITES_KEY);
      if (fav) state.favorites = JSON.parse(fav) || [];
    } catch (e) {}
    try {
      const fb = localStorage.getItem(FALLBACK_KEY);
      if (fb) state.fallbackChain = JSON.parse(fb) || [];
    } catch (e) {}
    try {
      const cmp = localStorage.getItem(COMPARE_KEY);
      if (cmp) state.compareSet = JSON.parse(cmp) || [];
    } catch (e) {}
  }

  function saveFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites)); } catch (e) {}
  }
  function saveFallback() {
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(state.fallbackChain)); } catch (e) {}
  }
  function saveCompare() {
    try { localStorage.setItem(COMPARE_KEY, JSON.stringify(state.compareSet)); } catch (e) {}
  }

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(str) {
    if (window.__nexus && window.__nexus.escapeHtml) return window.__nexus.escapeHtml(str);
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function showToast(msg, type, dur) {
    window.__nexus.showToast(msg, type, dur);
  }
  function providerOf(model) {
    if (!model || !model.id) return 'unknown';
    return String(model.id).split('/')[0] || 'unknown';
  }
  function providerColor(provider) {
    return PROVIDER_COLORS[provider] || 'var(--text-tertiary)';
  }
  function formatContext(n) {
    if (!n) return '?';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }
  function isFree(model) {
    const p = parseFloat(model.pricing?.prompt ?? '1');
    const c = parseFloat(model.pricing?.completion ?? '1');
    return p === 0 && c === 0;
  }
  function hasVision(model) {
    const inMod = model.architecture?.input_modalities || [];
    return inMod.includes('image');
  }
  function modalities(model) {
    const inMod = model.architecture?.input_modalities || ['text'];
    const outMod = model.architecture?.output_modalities || ['text'];
    return {
      input: [...new Set(inMod)],
      output: [...new Set(outMod)],
    };
  }

  /* ============================================================
     MOUNT BUTTONS
     ============================================================ */
  function mountTopBarButton() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar) return;
    if (document.getElementById('nxMmBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxMmBtn';
    btn.title = 'Browse models';
    btn.setAttribute('aria-label', 'Browse models');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1.5" y="3" width="13" height="2.5" rx="1"/>
        <rect x="1.5" y="6.75" width="13" height="2.5" rx="1"/>
        <rect x="1.5" y="10.5" width="13" height="2.5" rx="1"/>
      </svg>`;
    btn.addEventListener('click', open);
    topBar.insertBefore(btn, topBar.firstChild);
  }

  function mountSidebarBrowseButton() {
    const header = document.querySelector('.sidebar-header');
    if (!header) return;
    if (document.getElementById('nxMmSidebarBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'nx-mm-sidebar-browse';
    btn.id = 'nxMmSidebarBtn';
    btn.type = 'button';
    btn.title = 'Browse all free models';
    btn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="7" cy="7" r="4.5"/>
        <path d="M10.5 10.5L14 14"/>
      </svg>
      Browse all models`;
    btn.addEventListener('click', open);
    header.appendChild(btn);
  }

  /* ============================================================
     MODAL BUILD
     ============================================================ */
  function buildModal() {
    if (state.modalEl) return;
    const overlay = document.createElement('div');
    overlay.className = 'nx-mm-overlay';
    overlay.id = 'nxMmOverlay';
    overlay.innerHTML = `
      <div class="nx-mm-modal" role="dialog" aria-modal="true" aria-label="Model manager">
        <div class="nx-mm-header">
          <div class="nx-mm-title">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="1.5" y="3" width="13" height="2.5" rx="1"/>
              <rect x="1.5" y="6.75" width="13" height="2.5" rx="1"/>
              <rect x="1.5" y="10.5" width="13" height="2.5" rx="1"/>
            </svg>
            Models
          </div>
          <button class="modal-close" id="nxMmClose" aria-label="Close">×</button>
        </div>
        <div class="nx-mm-tabs" id="nxMmTabs">
          <button class="nx-mm-tab active" data-tab="browse">Browse</button>
          <button class="nx-mm-tab" data-tab="favorites">Favorites <span class="count" id="nxMmFavCount">0</span></button>
          <button class="nx-mm-tab" data-tab="compare">Compare <span class="count" id="nxMmCompareCount">0</span></button>
          <button class="nx-mm-tab" data-tab="fallback">Fallback <span class="count" id="nxMmFallbackCount">0</span></button>
        </div>
        <div class="nx-mm-body" id="nxMmBody"></div>
      </div>`;
    document.body.appendChild(overlay);
    state.modalEl = overlay;

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#nxMmClose').addEventListener('click', close);
    overlay.querySelectorAll('.nx-mm-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeTab = tab.dataset.tab;
        overlay.querySelectorAll('.nx-mm-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
        });
        renderBody();
      });
    });
  }

  function updateCounts() {
    const favCount = document.getElementById('nxMmFavCount');
    const cmpCount = document.getElementById('nxMmCompareCount');
    const fbCount = document.getElementById('nxMmFallbackCount');
    if (favCount) favCount.textContent = String(state.favorites.length);
    if (cmpCount) cmpCount.textContent = String(state.compareSet.length);
    if (fbCount) fbCount.textContent = String(state.fallbackChain.length);
  }

  function renderBody() {
    if (!state.modalEl) return;
    updateCounts();
    const body = state.modalEl.querySelector('#nxMmBody');
    if (!body) return;
    body.innerHTML = '';
    switch (state.activeTab) {
      case 'browse': return renderBrowseTab(body);
      case 'favorites': return renderFavoritesTab(body);
      case 'compare': return renderCompareTab(body);
      case 'fallback': return renderFallbackTab(body);
    }
  }

  /* ============================================================
     HELPERS: filter, sort
     ============================================================ */
  function filteredSortedModels() {
    let models = (window.__nexus.state.models || []).slice();

    if (state.filter === 'favorites') {
      models = models.filter(m => state.favorites.includes(m.id));
    } else if (state.filter === 'vision') {
      models = models.filter(m => hasVision(m));
    } else if (state.filter === 'large-ctx') {
      models = models.filter(m => (m.context_length || 0) >= 100000);
    } else if (state.filter === 'current') {
      const current = window.__nexus.state.activeModel;
      models = current ? models.filter(m => m.id === current.id) : [];
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      models = models.filter(m => {
        const hay = (m.name + ' ' + m.id + ' ' + (m.description || '')).toLowerCase();
        return hay.includes(q);
      });
    }

    switch (state.sortMode) {
      case 'name':
        models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
        break;
      case 'context':
        models.sort((a, b) => (b.context_length || 0) - (a.context_length || 0));
        break;
      case 'context-asc':
        models.sort((a, b) => (a.context_length || 0) - (b.context_length || 0));
        break;
      case 'provider':
        models.sort((a, b) => {
          const pa = providerOf(a);
          const pb = providerOf(b);
          if (pa !== pb) return pa.localeCompare(pb);
          return (a.name || a.id).localeCompare(b.name || b.id);
        });
        break;
      case 'favorites':
        models.sort((a, b) => {
          const fa = state.favorites.includes(a.id) ? 0 : 1;
          const fb = state.favorites.includes(b.id) ? 0 : 1;
          if (fa !== fb) return fa - fb;
          return (a.name || a.id).localeCompare(b.name || b.id);
        });
        break;
    }
    return models;
  }

  /* ============================================================
     BROWSE TAB
     ============================================================ */
  function renderBrowseTab(container) {
    const total = (window.__nexus.state.models || []).length;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'nx-mm-toolbar';
    toolbar.innerHTML = `
      <div class="nx-mm-search-wrap">
        <span class="nx-mm-search-icon">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="7" cy="7" r="4.5"/>
            <path d="M10.5 10.5L14 14"/>
          </svg>
        </span>
        <input type="text" class="nx-mm-search" id="nxMmSearch"
          placeholder="Search by name, ID, or description…"
          value="${escapeHtml(state.searchQuery)}" autocomplete="off" spellcheck="false">
      </div>
      <select class="nx-mm-sort-select" id="nxMmSort">
        ${SORT_MODES.map(s => `<option value="${s.id}" ${state.sortMode === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>`;
    container.appendChild(toolbar);

    // Filters
    const filters = document.createElement('div');
    filters.className = 'nx-mm-filters';
    const filterDefs = [
      { id: 'all', label: `All (${total})` },
      { id: 'favorites', label: `Favorites (${state.favorites.length})` },
      { id: 'vision', label: 'Vision capable' },
      { id: 'large-ctx', label: 'Context ≥ 100k' },
      { id: 'current', label: 'Current model' },
    ];
    for (const f of filterDefs) {
      const chip = document.createElement('button');
      chip.className = 'nx-mm-filter' + (state.filter === f.id ? ' active' : '');
      chip.textContent = f.label;
      chip.addEventListener('click', () => {
        state.filter = f.id;
        renderBody();
      });
      filters.appendChild(chip);
    }
    container.appendChild(filters);

    // List
    const list = document.createElement('div');
    list.className = 'nx-mm-list';
    const models = filteredSortedModels();
    if (!models.length) {
      list.innerHTML = `
        <div class="nx-mm-empty">
          <div class="big-icon">∅</div>
          <div>${total ? 'No models match your filters.' : 'Models have not loaded yet.'}</div>
          <div style="font-size:11px;opacity:0.7;margin-top:6px;">${total ? 'Try a different filter or search.' : 'Wait a moment, then reopen this panel.'}</div>
        </div>`;
    } else {
      for (const m of models) {
        list.appendChild(renderModelRow(m));
      }
    }
    container.appendChild(list);

    // Wire toolbar
    const search = toolbar.querySelector('#nxMmSearch');
    let t = null;
    search.addEventListener('input', () => {
      state.searchQuery = search.value;
      clearTimeout(t);
      t = setTimeout(() => {
        const focused = document.activeElement === search;
        const pos = search.selectionStart;
        renderBody();
        if (focused) {
          const ns = document.getElementById('nxMmSearch');
          if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch (e) {} }
        }
      }, 120);
    });
    toolbar.querySelector('#nxMmSort').addEventListener('change', (e) => {
      state.sortMode = e.target.value;
      renderBody();
    });
  }

  function renderModelRow(model) {
    const current = window.__nexus.state.activeModel;
    const isCurrent = current && current.id === model.id;
    const isFav = state.favorites.includes(model.id);
    const provider = providerOf(model);

    const row = document.createElement('div');
    row.className = 'nx-mm-row' + (isCurrent ? ' active' : '');
    row.dataset.modelId = model.id;

    row.innerHTML = `
      <input type="checkbox" class="nx-mm-row-checkbox" ${state.compareSet.includes(model.id) ? 'checked' : ''} title="Add to compare">
      <button class="nx-mm-row-star ${isFav ? 'active' : ''}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
        <svg viewBox="0 0 16 16" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.4">
          <path d="M8 1.5l2 4.1 4.5.65-3.25 3.18.77 4.48L8 11.79l-4.02 2.12.77-4.48L1.5 6.25 6 5.6z"/>
        </svg>
      </button>
      <div class="nx-mm-row-body">
        <div class="nx-mm-row-title">
          ${escapeHtml(model.name)}
          ${isCurrent ? '<span class="current-badge">active</span>' : ''}
        </div>
        <div class="nx-mm-row-meta">
          <span class="nx-mm-row-provider">
            <span class="dot" style="background:${providerColor(provider)}"></span>
            ${escapeHtml(provider)}
          </span>
          <span>ctx ${formatContext(model.context_length)}</span>
          ${hasVision(model) ? '<span style="color:var(--info)">👁 vision</span>' : ''}
          ${isFree(model) ? '<span style="color:var(--success)">free</span>' : ''}
        </div>
      </div>
      <div class="nx-mm-row-actions">
        <button class="nx-mm-icon-btn" title="View details" data-act="info">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6.5"/>
            <path d="M8 7v4M8 5v.5"/>
          </svg>
        </button>
        <button class="nx-mm-icon-btn primary" title="${isCurrent ? 'Already active' : 'Set as active model'}" data-act="set" ${isCurrent ? 'disabled' : ''}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M3 8l3 3 7-7"/>
          </svg>
        </button>
      </div>`;

    // Wire row actions
    row.querySelector('.nx-mm-row-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) addToCompare(model.id);
      else removeFromCompare(model.id);
    });
    row.querySelector('.nx-mm-row-star').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(model.id);
      renderBody();
    });
    row.querySelector('[data-act="info"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openInfoCard(model.id);
    });
    row.querySelector('[data-act="set"]').addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveModel(model.id);
    });

    // Whole row click = info card (but not on interactive elements)
    row.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      openInfoCard(model.id);
    });

    return row;
  }

  /* ============================================================
     FAVORITES TAB
     ============================================================ */
  function renderFavoritesTab(container) {
    const models = (window.__nexus.state.models || []).filter(m => state.favorites.includes(m.id));
    const list = document.createElement('div');
    list.className = 'nx-mm-list';
    list.style.padding = '16px 20px';

    if (!models.length) {
      list.innerHTML = `
        <div class="nx-mm-empty">
          <div class="big-icon">⭐</div>
          <div>No favorites yet.</div>
          <div style="font-size:11px;opacity:0.7;margin-top:6px;">Star models in the Browse tab to add them here.</div>
        </div>`;
    } else {
      for (const m of models) {
        list.appendChild(renderModelRow(m));
      }
    }
    container.appendChild(list);
  }

  /* ============================================================
     COMPARE TAB
     ============================================================ */
  function renderCompareTab(container) {
    const models = state.compareSet
      .map(id => (window.__nexus.state.models || []).find(m => m.id === id))
      .filter(Boolean);

    const wrap = document.createElement('div');
    wrap.className = 'nx-mm-compare-wrap';

    if (!models.length) {
      wrap.innerHTML = `
        <div class="nx-mm-empty">
          <div class="big-icon">⊞</div>
          <div>No models selected for comparison.</div>
          <div style="font-size:11px;opacity:0.7;margin-top:6px;">Go to Browse and tick the checkbox next to any model to add it here (up to ${MAX_COMPARE}).</div>
        </div>`;
      container.appendChild(wrap);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'nx-mm-compare-toolbar';
    toolbar.innerHTML = `
      <span>Comparing <span class="count">${models.length}</span> of ${MAX_COMPARE} models</span>
      <span class="spacer"></span>
      <button class="nx-mm-icon-btn" id="nxMmCmpClear" title="Clear all">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 4h10M6 4V2.5A1.5 1.5 0 017.5 1h1A1.5 1.5 0 0110 2.5V4M5 4l.5 8.5A1.5 1.5 0 007 14h2a1.5 1.5 0 001.5-1.5L11 4"/>
        </svg>
      </button>`;
    wrap.appendChild(toolbar);
    toolbar.querySelector('#nxMmCmpClear').addEventListener('click', () => {
      state.compareSet = [];
      saveCompare();
      renderBody();
    });

    // Table
    const bestCtx = Math.max(...models.map(m => m.context_length || 0));
    const table = document.createElement('table');
    table.className = 'nx-mm-compare-table';

    // Header row: Model | Provider | Context | Modalities | Description
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="width:24px"></th>
        <th>Model</th>
        <th>Provider</th>
        <th>Context</th>
        <th>Input</th>
        <th>Output</th>
        <th></th>
      </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const m of models) {
      const prov = providerOf(m);
      const mods = modalities(m);
      const isBestCtx = (m.context_length || 0) === bestCtx;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td></td>
        <td class="primary-col">${escapeHtml(m.name)}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:4px;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${providerColor(prov)}"></span>
            ${escapeHtml(prov)}
          </span>
        </td>
        <td class="${isBestCtx ? 'best' : ''}">${formatContext(m.context_length)}</td>
        <td>${mods.input.join(', ')}</td>
        <td>${mods.output.join(', ')}</td>
        <td><button class="remove-btn" title="Remove from compare">×</button></td>`;
      tr.querySelector('.remove-btn').addEventListener('click', () => {
        removeFromCompare(m.id);
        renderBody();
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);

    container.appendChild(wrap);
  }

  /* ============================================================
     FALLBACK TAB
     ============================================================ */
  function renderFallbackTab(container) {
    const wrap = document.createElement('div');
    wrap.className = 'nx-mm-fallback-wrap';

    // Intro
    const intro = document.createElement('div');
    intro.className = 'nx-mm-fallback-intro';
    intro.innerHTML = `
      <strong>Fallback chain:</strong> if the primary model (the one you're using now) fails to respond, the app will automatically retry with the next model in this list, in order, until one succeeds.
      <br><br>
      <span style="opacity:0.85;">You can reorder by dragging. Individual chats can override this chain in the chat context menu.</span>`;
    wrap.appendChild(intro);

    // Chain list
    const list = document.createElement('div');
    list.className = 'nx-mm-chain-list';

    if (!state.fallbackChain.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:12px;">
        No fallback models configured. Add up to ${MAX_FALLBACK} below.
      </div>`;
    } else {
      state.fallbackChain.forEach((id, idx) => {
        const model = (window.__nexus.state.models || []).find(m => m.id === id);
        if (!model) return;
        const provider = providerOf(model);
        const item = document.createElement('div');
        item.className = 'nx-mm-chain-item';
        item.draggable = true;
        item.dataset.index = String(idx);
        item.innerHTML = `
          <div class="nx-mm-chain-rank ${idx === 0 ? 'primary' : ''}">${idx + 1}</div>
          <div class="nx-mm-chain-body">
            <div class="nx-mm-chain-title">${escapeHtml(model.name)}</div>
            <div class="nx-mm-chain-meta">
              ${escapeHtml(provider)} · ctx ${formatContext(model.context_length)}
            </div>
          </div>
          <button class="nx-mm-chain-remove" title="Remove">×</button>`;
        item.querySelector('.nx-mm-chain-remove').addEventListener('click', () => {
          removeFromFallback(model.id);
          renderBody();
        });
        // Drag-drop
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(idx));
          e.dataTransfer.effectAllowed = 'move';
          item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          document.querySelectorAll('.nx-mm-chain-item.drop-target').forEach(el => el.classList.remove('drop-target'));
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          item.classList.add('drop-target');
        });
        item.addEventListener('dragleave', () => {
          item.classList.remove('drop-target');
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drop-target');
          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
          const toIdx = idx;
          if (isNaN(fromIdx) || fromIdx === toIdx) return;
          reorderFallback(fromIdx, toIdx);
          renderBody();
        });
        list.appendChild(item);
      });
    }
    wrap.appendChild(list);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'nx-mm-chain-add';
    if (state.fallbackChain.length >= MAX_FALLBACK) {
      addBtn.disabled = true;
      addBtn.textContent = `Maximum ${MAX_FALLBACK} fallback models reached`;
      addBtn.style.opacity = '0.5';
      addBtn.style.cursor = 'not-allowed';
    } else {
      addBtn.innerHTML = '+ Add fallback model';
      addBtn.addEventListener('click', () => {
        // Switch to browse tab with a filter "add to fallback" mode
        state.activeTab = 'browse';
        state.filter = 'all';
        state.modalEl.querySelectorAll('.nx-mm-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === 'browse');
        });
        renderBody();
        showToast('Open a model → "Add to fallback"', 'info', 3000);
      });
    }
    wrap.appendChild(addBtn);

    container.appendChild(wrap);
  }

  /* ============================================================
     INFO CARD
     ============================================================ */
  function openInfoCard(modelId) {
    const model = (window.__nexus.state.models || []).find(m => m.id === modelId);
    if (!model) return;
    state.infoModelId = modelId;

    if (!state.infoOverlayEl) {
      const overlay = document.createElement('div');
      overlay.className = 'nx-mm-info-overlay';
      overlay.id = 'nxMmInfoOverlay';
      overlay.innerHTML = `
        <div class="nx-mm-info-modal" role="dialog" aria-modal="true">
          <div class="nx-mm-info-header">
            <div class="nx-mm-info-title-wrap" id="nxMmInfoTitleWrap"></div>
            <button class="modal-close" id="nxMmInfoClose" aria-label="Close">×</button>
          </div>
          <div class="nx-mm-info-body" id="nxMmInfoBody"></div>
          <div class="nx-mm-info-actions" id="nxMmInfoActions"></div>
        </div>`;
      document.body.appendChild(overlay);
      state.infoOverlayEl = overlay;

      overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) closeInfoCard();
      });
      overlay.querySelector('#nxMmInfoClose').addEventListener('click', closeInfoCard);
    }

    // Fill content
    const titleWrap = state.infoOverlayEl.querySelector('#nxMmInfoTitleWrap');
    const body = state.infoOverlayEl.querySelector('#nxMmInfoBody');
    const actions = state.infoOverlayEl.querySelector('#nxMmInfoActions');

    const provider = providerOf(model);
    const mods = modalities(model);
    const current = window.__nexus.state.activeModel;
    const isCurrent = current && current.id === model.id;
    const isFav = state.favorites.includes(model.id);
    const isInCompare = state.compareSet.includes(model.id);
    const isInFallback = state.fallbackChain.includes(model.id);

    titleWrap.innerHTML = `
      <div class="nx-mm-info-title">${escapeHtml(model.name)}</div>
      <div class="nx-mm-info-id">${escapeHtml(model.id)}</div>`;

    let bodyHtml = '';
    if (model.description) {
      bodyHtml += `<div class="nx-mm-info-desc">${escapeHtml(model.description)}</div>`;
    }

    // Core section
    bodyHtml += `<div class="nx-mm-info-section">
      <div class="nx-mm-info-section-title">Core</div>
      <div class="nx-mm-info-row"><span class="key">Provider</span><span class="val">${escapeHtml(provider)}</span></div>
      <div class="nx-mm-info-row"><span class="key">Context length</span><span class="val accent">${formatContext(model.context_length)} tokens</span></div>
      <div class="nx-mm-info-row"><span class="key">Pricing</span><span class="val">${isFree(model) ? '<span style="color:var(--success)">Free</span>' : `in ${model.pricing?.prompt || '?'} / out ${model.pricing?.completion || '?'}`}</span></div>
    </div>`;

    // Modalities
    bodyHtml += `<div class="nx-mm-info-section">
      <div class="nx-mm-info-section-title">Modalities</div>
      <div class="nx-mm-info-row">
        <span class="key">Input</span>
        <div class="val">
          <div class="nx-mm-info-tag-row">
            ${mods.input.map(m => `<span class="nx-mm-info-tag${m === 'image' ? ' accent' : ''}">${escapeHtml(m)}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="nx-mm-info-row">
        <span class="key">Output</span>
        <div class="val">
          <div class="nx-mm-info-tag-row">
            ${mods.output.map(m => `<span class="nx-mm-info-tag success">${escapeHtml(m)}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

    // Status
    bodyHtml += `<div class="nx-mm-info-section">
      <div class="nx-mm-info-section-title">Status</div>
      <div class="nx-mm-info-row"><span class="key">Currently active</span><span class="val ${isCurrent ? 'accent' : ''}">${isCurrent ? '✓ yes' : 'no'}</span></div>
      <div class="nx-mm-info-row"><span class="key">Favorite</span><span class="val">${isFav ? '★ yes' : 'no'}</span></div>
      <div class="nx-mm-info-row"><span class="key">In compare set</span><span class="val">${isInCompare ? 'yes' : 'no'}</span></div>
      <div class="nx-mm-info-row"><span class="key">In fallback chain</span><span class="val">${isInFallback ? 'yes' : 'no'}</span></div>
    </div>`;

    body.innerHTML = bodyHtml;

    // Action buttons
    actions.innerHTML = '';

    const setBtn = document.createElement('button');
    setBtn.className = 'nx-mm-info-btn primary';
    setBtn.innerHTML = isCurrent ? '✓ Active' : 'Set active';
    setBtn.disabled = isCurrent;
    setBtn.addEventListener('click', () => {
      setActiveModel(model.id);
      closeInfoCard();
    });
    actions.appendChild(setBtn);

    const favBtn = document.createElement('button');
    favBtn.className = 'nx-mm-info-btn';
    favBtn.innerHTML = isFav ? '★ Unfavorite' : '☆ Favorite';
    favBtn.addEventListener('click', () => {
      toggleFavorite(model.id);
      openInfoCard(model.id); // refresh
    });
    actions.appendChild(favBtn);

    const cmpBtn = document.createElement('button');
    cmpBtn.className = 'nx-mm-info-btn';
    cmpBtn.textContent = isInCompare ? '− Remove from compare' : '+ Add to compare';
    cmpBtn.disabled = !isInCompare && state.compareSet.length >= MAX_COMPARE;
    cmpBtn.addEventListener('click', () => {
      if (isInCompare) removeFromCompare(model.id);
      else addToCompare(model.id);
      openInfoCard(model.id);
    });
    actions.appendChild(cmpBtn);

    const fbBtn = document.createElement('button');
    fbBtn.className = 'nx-mm-info-btn';
    fbBtn.textContent = isInFallback ? '− Remove from fallback' : '+ Add to fallback';
    fbBtn.disabled = !isInFallback && state.fallbackChain.length >= MAX_FALLBACK;
    fbBtn.addEventListener('click', () => {
      if (isInFallback) removeFromFallback(model.id);
      else addToFallback(model.id);
      openInfoCard(model.id);
    });
    actions.appendChild(fbBtn);

    state.infoOverlayEl.classList.add('open');
  }

  function closeInfoCard() {
    if (state.infoOverlayEl) state.infoOverlayEl.classList.remove('open');
    state.infoModelId = null;
  }

  /* ============================================================
     MUTATORS
     ============================================================ */
  function setActiveModel(modelId) {
    const model = (window.__nexus.state.models || []).find(m => m.id === modelId);
    if (!model) return;
    window.__nexus.selectModel(model);
    close();
    showToast(`Active model: ${model.name}`, 'success', 2000);
  }

  function toggleFavorite(modelId) {
    const idx = state.favorites.indexOf(modelId);
    if (idx === -1) {
      state.favorites.push(modelId);
      saveFavorites();
      showToast('Added to favorites', 'success', 1500);
    } else {
      state.favorites.splice(idx, 1);
      saveFavorites();
      showToast('Removed from favorites', 'info', 1500);
    }
    updateCounts();
  }

  function addToCompare(modelId) {
    if (state.compareSet.includes(modelId)) return;
    if (state.compareSet.length >= MAX_COMPARE) {
      showToast(`Maximum ${MAX_COMPARE} models in comparison`, 'warning', 2500);
      return;
    }
    state.compareSet.push(modelId);
    saveCompare();
    updateCounts();
    showToast('Added to compare', 'success', 1500);
  }

  function removeFromCompare(modelId) {
    state.compareSet = state.compareSet.filter(id => id !== modelId);
    saveCompare();
    updateCounts();
  }

  function addToFallback(modelId) {
    if (state.fallbackChain.includes(modelId)) return;
    if (state.fallbackChain.length >= MAX_FALLBACK) {
      showToast(`Maximum ${MAX_FALLBACK} fallback models`, 'warning', 2500);
      return;
    }
    state.fallbackChain.push(modelId);
    saveFallback();
    updateCounts();
    showToast('Added to fallback chain', 'success', 1500);
  }

  function removeFromFallback(modelId) {
    state.fallbackChain = state.fallbackChain.filter(id => id !== modelId);
    saveFallback();
    updateCounts();
  }

  function reorderFallback(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= state.fallbackChain.length) return;
    if (toIdx < 0 || toIdx >= state.fallbackChain.length) return;
    const [item] = state.fallbackChain.splice(fromIdx, 1);
    state.fallbackChain.splice(toIdx, 0, item);
    saveFallback();
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function open() {
    if (!state.modalEl) buildModal();
    state.modalEl.classList.add('open');
    state.activeTab = 'browse';
    state.modalEl.querySelectorAll('.nx-mm-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'browse');
    });
    renderBody();
  }

  function close() {
    if (state.modalEl) state.modalEl.classList.remove('open');
    closeInfoCard();
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.ModelManager = {
    open,
    close,
    getFavorites: () => state.favorites.slice(),
    toggleFavorite,
    getFallbackChain: () => state.fallbackChain.slice(),
    setFallbackChain: (ids) => {
      state.fallbackChain = (ids || []).slice(0, MAX_FALLBACK);
      saveFallback();
      updateCounts();
    },
    addToFallback,
    removeFromFallback,
    getCompareSet: () => state.compareSet.slice(),
    setCompareSet: (ids) => {
      state.compareSet = (ids || []).slice(0, MAX_COMPARE);
      saveCompare();
      updateCounts();
    },
    openInfoCard,
    MAX_COMPARE,
    MAX_FALLBACK,
  };
})();
