/* ============================================================
   NEXUS CHAT — PROMPT LIBRARY
   Save, organize, tag, search, and insert reusable prompts.
   Supports variables {{name}} with a fill-in dialog, and
   per-prompt few-shot examples.

   Auto-loaded by index.html. Injects its own CSS.

   Public API:
     window.Nexus.PromptLibrary.open()
     window.Nexus.PromptLibrary.close()
     window.Nexus.PromptLibrary.createPrompt(data)
     window.Nexus.PromptLibrary.insertPrompt(prompt)
     window.Nexus.PromptLibrary.saveCurrentInput()
     window.Nexus.PromptLibrary.getPrompts()
     window.Nexus.PromptLibrary.getCategories()
     window.Nexus.PromptLibrary.exportPrompts()
     window.Nexus.PromptLibrary.importPrompts(json)
   ============================================================ */
(function () {
  'use strict';

  if (window.__nexus_pl_loaded__) return;
  window.__nexus_pl_loaded__ = true;

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const STORAGE_KEY = 'nexus_prompt_library_v1';
  const DEFAULT_CATEGORIES = ['General', 'Code', 'Writing', 'Analysis', 'Creative', 'Teaching'];
  const SEED_PROMPTS = [
    {
      id: 'seed-explain-simple',
      title: 'Explain in simple terms',
      category: 'Teaching',
      tags: ['explain', 'simplify'],
      body: 'Explain {{topic}} as if I have no background in it. Use a concrete analogy, avoid jargon, and keep it under 200 words.',
      examples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'seed-code-review',
      title: 'Code review',
      category: 'Code',
      tags: ['review', 'code'],
      body: 'Review the following code for correctness, edge cases, readability, and performance. Be specific about issues and suggest concrete fixes.\n\n```{{language}}\n{{code}}\n```',
      examples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'seed-write-blog',
      title: 'Blog post draft',
      category: 'Writing',
      tags: ['writing', 'blog'],
      body: 'Write a blog post about {{topic}}. Include a catchy title, an introduction, 3 main sections with subheadings, and a conclusion. Target audience: {{audience}}. Length: about {{words}} words.',
      examples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'seed-compare',
      title: 'Compare two things',
      category: 'Analysis',
      tags: ['compare', 'pros-cons'],
      body: 'Compare {{a}} and {{b}}. Present a table with pros and cons for each, then give a recommendation based on use cases.',
      examples: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'seed-socratic',
      title: 'Socratic tutor',
      category: 'Teaching',
      tags: ['tutor', 'questions'],
      body: 'You are a Socratic tutor. Instead of telling me the answer directly, guide me to it with focused questions. Start by asking what I already know about: {{topic}}.',
      examples: [
        { user: 'What is a derivative?', assistant: 'What do you already know about slope and change?' },
        { user: 'It measures how fast something changes.', assistant: 'Right. Can you think of a shape where we measure slope?' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    prompts: [],
    categories: [...DEFAULT_CATEGORIES],
    filterCategory: 'all',
    filterTag: null,
    searchQuery: '',
    editingId: null,
    modalEl: null,
    activeTab: 'browse', // 'browse' | 'tags' | 'import-export'
    sortMode: 'recent',  // 'recent' | 'name' | 'usage'
    variableDialogEl: null,
  };

  /* ============================================================
     CSS INJECTION
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-pl-styles')) return;
    const css = `
/* ============================================================
   PROMPT LIBRARY
   ============================================================ */
.nx-pl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 2750;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}
.nx-pl-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-pl-modal {
  width: 100%;
  max-width: 900px;
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
.nx-pl-overlay.open .nx-pl-modal {
  transform: scale(1) translateY(0);
}
.nx-pl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.nx-pl-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}
.nx-pl-header-actions {
  display: flex;
  gap: 6px;
}
.nx-pl-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: var(--bg-secondary);
}
.nx-pl-tab {
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
.nx-pl-tab:hover { color: var(--text-secondary); }
.nx-pl-tab.active {
  color: var(--accent-secondary);
  border-bottom-color: var(--accent-primary);
}
.nx-pl-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ---------- BROWSE TAB ---------- */
.nx-pl-toolbar {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  align-items: center;
  flex-wrap: wrap;
  background: var(--bg-secondary);
}
.nx-pl-search-wrap {
  flex: 1;
  min-width: 160px;
  position: relative;
}
.nx-pl-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
}
.nx-pl-search-input {
  width: 100%;
  padding: 8px 12px 8px 32px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.nx-pl-search-input:focus {
  border-color: var(--accent-primary);
}
.nx-pl-search-input::placeholder {
  color: var(--text-tertiary);
}
.nx-pl-sort-select {
  padding: 8px 28px 8px 12px;
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
.nx-pl-new-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--accent-primary);
  background: var(--accent-primary);
  color: #fff;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nx-pl-new-btn:hover {
  background: var(--accent-secondary);
  box-shadow: 0 0 16px var(--accent-glow);
}

.nx-pl-categories {
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.nx-pl-categories::-webkit-scrollbar { display: none; }
.nx-pl-cat-chip {
  padding: 4px 12px;
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nx-pl-cat-chip:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nx-pl-cat-chip.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
  font-weight: 600;
}
.nx-pl-cat-chip .count {
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 0 5px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.nx-pl-list {
  flex: 1;
  overflow-y: auto;
  padding: 14px 20px 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  align-content: start;
}

.nx-pl-card {
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  min-height: 100px;
}
.nx-pl-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}
.nx-pl-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.nx-pl-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.nx-pl-card-menu {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 0.12s;
  opacity: 0;
}
.nx-pl-card:hover .nx-pl-card-menu {
  opacity: 1;
}
.nx-pl-card-menu:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.nx-pl-card-preview {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-word;
}
.nx-pl-card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: auto;
  padding-top: 4px;
}
.nx-pl-card-badge {
  font-size: 9px;
  padding: 2px 7px;
  border-radius: 100px;
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  font-weight: 600;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.nx-pl-card-badge.var {
  background: rgba(108, 92, 231, 0.2);
  color: var(--accent-secondary);
}
.nx-pl-card-badge.example {
  background: rgba(116, 185, 255, 0.2);
  color: var(--info);
}
.nx-pl-empty {
  grid-column: 1 / -1;
  padding: 50px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  line-height: 1.6;
}
.nx-pl-empty .big-icon {
  font-size: 40px;
  margin-bottom: 10px;
  opacity: 0.5;
}

/* ---------- TAGS TAB ---------- */
.nx-pl-tags-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.nx-pl-tags-group {
  margin-bottom: 24px;
}
.nx-pl-tags-group-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-tertiary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.nx-pl-tags-group-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
}
.nx-pl-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nx-pl-tag {
  padding: 5px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 100px;
  color: var(--text-secondary);
  font-size: 11px;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: all 0.12s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nx-pl-tag:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-pl-tag.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-pl-tag .count {
  font-size: 9px;
  opacity: 0.7;
}
.nx-pl-tags-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
}

/* ---------- IMPORT/EXPORT TAB ---------- */
.nx-pl-ie-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.nx-pl-ie-section {
  margin-bottom: 22px;
}
.nx-pl-ie-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-tertiary);
  margin-bottom: 10px;
}
.nx-pl-ie-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 10px;
}
.nx-pl-ie-textarea {
  width: 100%;
  min-height: 180px;
  padding: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
  outline: none;
  resize: vertical;
}
.nx-pl-ie-textarea:focus {
  border-color: var(--accent-primary);
}
.nx-pl-ie-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.nx-pl-ie-btn {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
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
.nx-pl-ie-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-pl-ie-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-pl-ie-btn.primary:hover {
  background: var(--accent-secondary);
}

/* ---------- EDITOR MODAL (nested) ---------- */
.nx-pl-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 2800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}
.nx-pl-editor-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-pl-editor-modal {
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  transform: scale(0.96);
  transition: transform 0.18s;
}
.nx-pl-editor-overlay.open .nx-pl-editor-modal {
  transform: scale(1);
}
.nx-pl-editor-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.nx-pl-editor-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
.nx-pl-field {
  margin-bottom: 14px;
}
.nx-pl-field:last-child { margin-bottom: 0; }
.nx-pl-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}
.nx-pl-input,
.nx-pl-textarea,
.nx-pl-select {
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.nx-pl-textarea {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
  resize: vertical;
  min-height: 130px;
}
.nx-pl-input:focus,
.nx-pl-textarea:focus,
.nx-pl-select:focus {
  border-color: var(--accent-primary);
}
.nx-pl-hint {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 4px;
  line-height: 1.5;
}
.nx-pl-var-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.nx-pl-var-chip {
  padding: 2px 8px;
  background: rgba(108, 92, 231, 0.2);
  border: 1px solid var(--accent-primary);
  border-radius: 100px;
  color: var(--accent-secondary);
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 600;
}
.nx-pl-examples-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.nx-pl-example-item {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  position: relative;
}
.nx-pl-example-user {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  padding-right: 22px;
  line-height: 1.4;
}
.nx-pl-example-user::before {
  content: 'User: ';
  color: var(--accent-secondary);
  font-weight: 700;
  font-family: var(--font-mono);
  font-size: 10px;
}
.nx-pl-example-assistant {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
.nx-pl-example-assistant::before {
  content: 'Assistant: ';
  color: var(--info);
  font-weight: 700;
  font-family: var(--font-mono);
  font-size: 10px;
}
.nx-pl-example-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}
.nx-pl-example-remove:hover {
  background: rgba(225, 112, 85, 0.2);
  color: var(--danger);
}
.nx-pl-add-example-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px dashed var(--border-subtle);
  background: transparent;
  color: var(--text-tertiary);
  font-family: var(--font-sans);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.12s;
  width: 100%;
  margin-top: 8px;
}
.nx-pl-add-example-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}
.nx-pl-editor-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.nx-pl-editor-footer-left {
  display: flex;
  gap: 8px;
}
.nx-pl-editor-footer-right {
  display: flex;
  gap: 8px;
}
.nx-pl-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
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
.nx-pl-btn:hover { background: var(--bg-hover); }
.nx-pl-btn.primary {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}
.nx-pl-btn.primary:hover {
  background: var(--accent-secondary);
}
.nx-pl-btn.danger {
  color: var(--danger);
  border-color: rgba(225, 112, 85, 0.4);
}
.nx-pl-btn.danger:hover {
  background: rgba(225, 112, 85, 0.12);
  border-color: var(--danger);
}
.nx-pl-btn.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--text-secondary);
}
.nx-pl-btn.ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* ---------- VARIABLE FILL DIALOG ---------- */
.nx-pl-vars-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(4px);
  z-index: 2850;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s;
}
.nx-pl-vars-overlay.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-pl-vars-modal {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  transform: scale(0.96);
  transition: transform 0.18s;
}
.nx-pl-vars-overlay.open .nx-pl-vars-modal {
  transform: scale(1);
}
.nx-pl-vars-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.nx-pl-vars-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}
.nx-pl-vars-preview {
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-secondary);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 14px;
}
.nx-pl-vars-preview mark {
  background: rgba(108, 92, 231, 0.4);
  color: var(--accent-secondary);
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}
.nx-pl-vars-field {
  margin-bottom: 12px;
}
.nx-pl-vars-field:last-child {
  margin-bottom: 0;
}
.nx-pl-vars-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-tertiary);
  margin-bottom: 5px;
  font-family: var(--font-mono);
}
.nx-pl-vars-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ---------- CONTEXT MENU (reuses global) ---------- */

@media (max-width: 700px) {
  .nx-pl-overlay { padding: 10px; }
  .nx-pl-modal { max-height: 95vh; }
  .nx-pl-list {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .nx-pl-toolbar { padding: 10px 12px; }
  .nx-pl-tabs { padding: 0 6px; }
  .nx-pl-tab { padding: 10px 12px; font-size: 12px; }
  .nx-pl-editor-overlay { padding: 10px; }
  .nx-pl-editor-modal { max-height: 95vh; }
  .nx-pl-vars-overlay { padding: 10px; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-pl-styles';
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

  /* ============================================================
     UTILS
     ============================================================ */
  function escapeHtml(str) {
    if (window.__nexus && window.__nexus.escapeHtml) return window.__nexus.escapeHtml(str);
    if (str == null) return '';
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

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function extractVariables(text) {
    if (!text) return [];
    const vars = new Set();
    let m;
    VARIABLE_REGEX.lastIndex = 0;
    while ((m = VARIABLE_REGEX.exec(text)) !== null) {
      vars.add(m[1]);
    }
    return [...vars];
  }

  function substituteVariables(text, values) {
    return String(text).replace(VARIABLE_REGEX, (match, name) => {
      const v = values[name];
      return v != null ? v : match;
    });
  }

  /* ============================================================
     STORAGE
     ============================================================ */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.prompts)) {
          state.prompts = parsed.prompts;
          if (Array.isArray(parsed.categories) && parsed.categories.length) {
            state.categories = parsed.categories;
          }
        } else {
          state.prompts = SEED_PROMPTS.slice();
        }
      } else {
        // First launch — seed with defaults
        state.prompts = SEED_PROMPTS.slice();
        save();
      }
    } catch (e) {
      console.warn('PromptLibrary: load failed:', e);
      state.prompts = SEED_PROMPTS.slice();
    }
    // Ensure any category used by a prompt exists
    for (const p of state.prompts) {
      if (p.category && !state.categories.includes(p.category)) {
        state.categories.push(p.category);
      }
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        prompts: state.prompts,
        categories: state.categories,
      }));
    } catch (e) {
      console.warn('PromptLibrary: save failed:', e);
      showToast('Failed to save prompts: ' + e.message, 'error', 3500);
    }
  }

  /* ============================================================
     TOP BAR BUTTON
     ============================================================ */
  function mountTopBarButton() {
    const topBar = document.querySelector('.top-bar-right');
    if (!topBar) return;
    if (document.getElementById('nxPlBtn')) return;

    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'nxPlBtn';
    btn.title = 'Prompt library';
    btn.setAttribute('aria-label', 'Open prompt library');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 3.5A1.5 1.5 0 013.5 2h3A1.5 1.5 0 018 3.5v10A1.5 1.5 0 016.5 15h-3A1.5 1.5 0 012 13.5v-10z"/>
        <path d="M8 3.5A1.5 1.5 0 019.5 2h3A1.5 1.5 0 0114 3.5v10a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 018 13.5v-10z"/>
        <path d="M4.5 5h1M4.5 7.5h1M10.5 5h1M10.5 7.5h1"/>
      </svg>`;
    btn.addEventListener('click', open);
    topBar.insertBefore(btn, topBar.firstChild);
  }

  /* ============================================================
     MODAL BUILD
     ============================================================ */
  function buildModal() {
    if (state.modalEl) return;
    const overlay = document.createElement('div');
    overlay.className = 'nx-pl-overlay';
    overlay.id = 'nxPlOverlay';
    overlay.innerHTML = `
      <div class="nx-pl-modal" role="dialog" aria-modal="true" aria-label="Prompt library">
        <div class="nx-pl-header">
          <div class="nx-pl-header-title">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h3A1.5 1.5 0 018 3.5v10A1.5 1.5 0 016.5 15h-3A1.5 1.5 0 012 13.5v-10z"/>
              <path d="M8 3.5A1.5 1.5 0 019.5 2h3A1.5 1.5 0 0114 3.5v10a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 018 13.5v-10z"/>
            </svg>
            Prompt Library
          </div>
          <button class="modal-close" id="nxPlClose" aria-label="Close">×</button>
        </div>
        <div class="nx-pl-tabs">
          <button class="nx-pl-tab active" data-tab="browse">Browse</button>
          <button class="nx-pl-tab" data-tab="tags">Tags</button>
          <button class="nx-pl-tab" data-tab="ie">Import / Export</button>
        </div>
        <div class="nx-pl-body" id="nxPlBody"></div>
      </div>`;
    document.body.appendChild(overlay);
    state.modalEl = overlay;

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#nxPlClose').addEventListener('click', close);

    overlay.querySelectorAll('.nx-pl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeTab = tab.dataset.tab;
        overlay.querySelectorAll('.nx-pl-tab').forEach(t => {
          t.classList.toggle('active', t === tab);
        });
        renderBody();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        close();
      }
    });
  }

  function renderBody() {
    const body = state.modalEl.querySelector('#nxPlBody');
    if (!body) return;
    body.innerHTML = '';
    if (state.activeTab === 'browse') renderBrowseTab(body);
    else if (state.activeTab === 'tags') renderTagsTab(body);
    else if (state.activeTab === 'ie') renderIeTab(body);
  }

  /* ============================================================
     BROWSE TAB
     ============================================================ */
  function renderBrowseTab(container) {
    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'nx-pl-toolbar';
    toolbar.innerHTML = `
      <div class="nx-pl-search-wrap">
        <span class="nx-pl-search-icon">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="7" cy="7" r="4.5"/>
            <path d="M10.5 10.5L14 14"/>
          </svg>
        </span>
        <input type="text" class="nx-pl-search-input" id="nxPlSearch" placeholder="Search prompts…" value="${escapeHtml(state.searchQuery)}" autocomplete="off">
      </div>
      <select class="nx-pl-sort-select" id="nxPlSort">
        <option value="recent" ${state.sortMode === 'recent' ? 'selected' : ''}>Recent</option>
        <option value="name" ${state.sortMode === 'name' ? 'selected' : ''}>A–Z</option>
        <option value="usage" ${state.sortMode === 'usage' ? 'selected' : ''}>Most used</option>
      </select>
      <button class="nx-pl-new-btn" id="nxPlNew">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v10M3 8h10"/>
        </svg>
        New
      </button>`;
    container.appendChild(toolbar);

    // Category chips
    const catRow = document.createElement('div');
    catRow.className = 'nx-pl-categories';
    const allChip = document.createElement('button');
    allChip.className = 'nx-pl-cat-chip' + (state.filterCategory === 'all' ? ' active' : '');
    allChip.innerHTML = `All <span class="count">${state.prompts.length}</span>`;
    allChip.addEventListener('click', () => {
      state.filterCategory = 'all';
      state.filterTag = null;
      renderBody();
    });
    catRow.appendChild(allChip);

    for (const cat of state.categories) {
      const count = state.prompts.filter(p => p.category === cat).length;
      if (!count) continue;
      const chip = document.createElement('button');
      chip.className = 'nx-pl-cat-chip' + (state.filterCategory === cat ? ' active' : '');
      chip.innerHTML = `${escapeHtml(cat)} <span class="count">${count}</span>`;
      chip.addEventListener('click', () => {
        state.filterCategory = cat;
        state.filterTag = null;
        renderBody();
      });
      catRow.appendChild(chip);
    }
    container.appendChild(catRow);

    // List
    const list = document.createElement('div');
    list.className = 'nx-pl-list';
    container.appendChild(list);

    const filtered = getFilteredPrompts();
    if (!filtered.length) {
      list.innerHTML = `
        <div class="nx-pl-empty">
          <div class="big-icon">📚</div>
          <div>${state.prompts.length ? 'No prompts match your filters.' : 'Your prompt library is empty.'}</div>
          <div style="font-size:11px;opacity:0.7;margin-top:6px;">${state.prompts.length ? 'Try a different search or category.' : 'Click "New" to add your first prompt.'}</div>
        </div>`;
    } else {
      for (const p of filtered) {
        list.appendChild(renderCard(p));
      }
    }

    // Wire search
    const search = toolbar.querySelector('#nxPlSearch');
    let searchTimer = null;
    search.addEventListener('input', () => {
      state.searchQuery = search.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const focused = document.activeElement === search;
        const cursor = search.selectionStart;
        renderBody();
        if (focused) {
          const newSearch = document.getElementById('nxPlSearch');
          if (newSearch) {
            newSearch.focus();
            try { newSearch.setSelectionRange(cursor, cursor); } catch (e) {}
          }
        }
      }, 140);
    });

    // Wire sort
    toolbar.querySelector('#nxPlSort').addEventListener('change', (e) => {
      state.sortMode = e.target.value;
      renderBody();
    });

    // Wire new
    toolbar.querySelector('#nxPlNew').addEventListener('click', () => openEditor(null));
  }

  function getFilteredPrompts() {
    let arr = state.prompts.slice();

    if (state.filterCategory !== 'all') {
      arr = arr.filter(p => p.category === state.filterCategory);
    }
    if (state.filterTag) {
      arr = arr.filter(p => Array.isArray(p.tags) && p.tags.includes(state.filterTag));
    }
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase().trim();
      arr = arr.filter(p => {
        const haystack = [
          p.title || '',
          p.body || '',
          p.category || '',
          ...(p.tags || []),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    if (state.sortMode === 'name') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (state.sortMode === 'usage') {
      arr.sort((a, b) => (b.useCount || 0) - (a.useCount || 0));
    } else {
      // recent
      arr.sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
    }
    return arr;
  }

  function renderCard(prompt) {
    const vars = extractVariables(prompt.body);
    const hasExamples = Array.isArray(prompt.examples) && prompt.examples.length;

    const card = document.createElement('div');
    card.className = 'nx-pl-card';
    card.innerHTML = `
      <div class="nx-pl-card-header">
        <div class="nx-pl-card-title">${escapeHtml(prompt.title)}</div>
        <button class="nx-pl-card-menu" title="Options">⋯</button>
      </div>
      <div class="nx-pl-card-preview">${escapeHtml(prompt.body).slice(0, 180)}</div>
      <div class="nx-pl-card-footer">
        ${prompt.category ? `<span class="nx-pl-card-badge">${escapeHtml(prompt.category)}</span>` : ''}
        ${vars.length ? `<span class="nx-pl-card-badge var">${vars.length} var${vars.length === 1 ? '' : 's'}</span>` : ''}
        ${hasExamples ? `<span class="nx-pl-card-badge example">${prompt.examples.length} ex</span>` : ''}
      </div>`;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.nx-pl-card-menu')) return;
      insertPrompt(prompt);
    });

    const menuBtn = card.querySelector('.nx-pl-card-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCardContextMenu(e.currentTarget, prompt);
    });

    return card;
  }

  function openCardContextMenu(anchor, prompt) {
    // Remove any existing menu
    document.querySelectorAll('.nx-context-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'nx-context-menu open';
    menu.style.position = 'fixed';

    const items = [
      { icon: '↗', label: 'Insert into message', action: () => insertPrompt(prompt) },
      { icon: '✎', label: 'Edit…', action: () => openEditor(prompt) },
      { icon: '⧉', label: 'Duplicate', action: () => duplicatePrompt(prompt) },
      { divider: true },
      { icon: '🗑', label: 'Delete', danger: true, action: () => deletePrompt(prompt) },
    ];

    for (const item of items) {
      if (item.divider) {
        const d = document.createElement('div');
        d.className = 'nx-context-menu-divider';
        menu.appendChild(d);
        continue;
      }
      const el = document.createElement('div');
      el.className = 'nx-context-menu-item' + (item.danger ? ' danger' : '');
      el.innerHTML = `<span class="icon">${item.icon || ''}</span><span class="label">${escapeHtml(item.label)}</span>`;
      el.addEventListener('click', () => {
        menu.remove();
        if (typeof item.action === 'function') item.action();
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);

    // Position near anchor
    const rect = anchor.getBoundingClientRect();
    let left = rect.right - 200;
    let top = rect.bottom + 4;
    if (left < 8) left = 8;
    if (top + 240 > window.innerHeight) {
      top = rect.top - menu.offsetHeight - 4;
    }
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    setTimeout(() => {
      const handler = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('mousedown', handler, true);
        }
      };
      document.addEventListener('mousedown', handler, true);
    }, 0);
  }

  /* ============================================================
     TAGS TAB
     ============================================================ */
  function renderTagsTab(container) {
    const content = document.createElement('div');
    content.className = 'nx-pl-tags-content';

    const tagCounts = {};
    for (const p of state.prompts) {
      for (const t of (p.tags || [])) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }

    const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

    if (!tagEntries.length) {
      content.innerHTML = `
        <div class="nx-pl-tags-empty">
          No tags yet. Add tags to your prompts using the editor.
        </div>`;
      container.appendChild(content);
      return;
    }

    const group = document.createElement('div');
    group.className = 'nx-pl-tags-group';
    group.innerHTML = `
      <div class="nx-pl-tags-group-title">All tags</div>
      <div class="nx-pl-tag-list"></div>`;
    const list = group.querySelector('.nx-pl-tag-list');

    for (const [tag, count] of tagEntries) {
      const el = document.createElement('button');
      el.className = 'nx-pl-tag' + (state.filterTag === tag ? ' active' : '');
      el.innerHTML = `#${escapeHtml(tag)} <span class="count">${count}</span>`;
      el.addEventListener('click', () => {
        state.filterTag = state.filterTag === tag ? null : tag;
        state.filterCategory = 'all';
        state.activeTab = 'browse';
        state.modalEl.querySelectorAll('.nx-pl-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.tab === 'browse');
        });
        renderBody();
      });
      list.appendChild(el);
    }

    content.appendChild(group);
    container.appendChild(content);
  }

  /* ============================================================
     IMPORT/EXPORT TAB
     ============================================================ */
  function renderIeTab(container) {
    const content = document.createElement('div');
    content.className = 'nx-pl-ie-content';

    // Export section
    const expSection = document.createElement('div');
    expSection.className = 'nx-pl-ie-section';
    expSection.innerHTML = `
      <div class="nx-pl-ie-section-title">Export</div>
      <div class="nx-pl-ie-desc">
        Copy the JSON below or download it as a file. You can import it later or share it with others.
      </div>
      <textarea class="nx-pl-ie-textarea" id="nxPlExportArea" readonly></textarea>
      <div class="nx-pl-ie-actions">
        <button class="nx-pl-ie-btn" id="nxPlCopyExport">Copy to clipboard</button>
        <button class="nx-pl-ie-btn primary" id="nxPlDownloadExport">Download JSON</button>
      </div>`;
    content.appendChild(expSection);

    // Import section
    const impSection = document.createElement('div');
    impSection.className = 'nx-pl-ie-section';
    impSection.innerHTML = `
      <div class="nx-pl-ie-section-title">Import</div>
      <div class="nx-pl-ie-desc">
        Paste a JSON export, or load a file. Imported prompts will be added to your library.
      </div>
      <textarea class="nx-pl-ie-textarea" id="nxPlImportArea" placeholder='{"prompts":[...],"categories":[...]}'></textarea>
      <div class="nx-pl-ie-actions">
        <button class="nx-pl-ie-btn" id="nxPlChooseFile">Choose file</button>
        <button class="nx-pl-ie-btn primary" id="nxPlImportBtn">Import from text</button>
        <input type="file" id="nxPlFileInput" accept=".json,application/json" style="display:none">
      </div>
      <div id="nxPlImportStatus"></div>`;
    content.appendChild(impSection);

    // Danger zone
    const danger = document.createElement('div');
    danger.className = 'nx-pl-ie-section';
    danger.innerHTML = `
      <div class="nx-pl-ie-section-title" style="color:var(--danger);">Reset library</div>
      <div class="nx-pl-ie-desc">
        Replace your entire library with the default seed prompts. Your saved prompts will be lost.
      </div>
      <div class="nx-pl-ie-actions">
        <button class="nx-pl-ie-btn" id="nxPlResetLib" style="color:var(--danger);border-color:rgba(225,112,85,0.4);">Reset to defaults</button>
      </div>`;
    content.appendChild(danger);

    container.appendChild(content);

    // Populate export area
    const exportArea = expSection.querySelector('#nxPlExportArea');
    const exportJson = JSON.stringify({
      prompts: state.prompts,
      categories: state.categories,
      exportedAt: new Date().toISOString(),
      version: 1,
    }, null, 2);
    exportArea.value = exportJson;

    // Copy
    expSection.querySelector('#nxPlCopyExport').addEventListener('click', () => {
      navigator.clipboard.writeText(exportJson)
        .then(() => showToast('Copied to clipboard', 'success', 2000))
        .catch(() => {
          exportArea.select();
          document.execCommand('copy');
          showToast('Copied', 'success', 2000);
        });
    });

    // Download
    expSection.querySelector('#nxPlDownloadExport').addEventListener('click', () => {
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-prompts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('Downloaded prompt library', 'success', 2000);
    });

    // File chooser
    const fileInput = impSection.querySelector('#nxPlFileInput');
    impSection.querySelector('#nxPlChooseFile').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        importPrompts(text);
        fileInput.value = '';
      } catch (err) {
        showToast('Read failed: ' + err.message, 'error', 3000);
      }
    });

    // Import from text
    impSection.querySelector('#nxPlImportBtn').addEventListener('click', () => {
      const text = impSection.querySelector('#nxPlImportArea').value.trim();
      if (!text) {
        showToast('Nothing to import', 'warning', 2000);
        return;
      }
      importPrompts(text);
    });

    // Reset library
    danger.querySelector('#nxPlResetLib').addEventListener('click', () => {
      if (!confirm('Reset library to default seed prompts?\n\nYour custom prompts will be lost.')) return;
      state.prompts = SEED_PROMPTS.slice();
      state.categories = [...DEFAULT_CATEGORIES];
      save();
      showToast('Library reset to defaults', 'success', 2500);
      renderBody();
    });
  }

  /* ============================================================
     CRUD
     ============================================================ */
  function createPrompt(data) {
    const prompt = {
      id: uid(),
      title: String(data.title || 'Untitled prompt').slice(0, 120),
      body: String(data.body || ''),
      category: String(data.category || 'General'),
      tags: Array.isArray(data.tags) ? data.tags.map(t => String(t).trim()).filter(Boolean) : [],
      examples: Array.isArray(data.examples) ? data.examples.filter(e => e && e.user) : [],
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.prompts.unshift(prompt);
    if (prompt.category && !state.categories.includes(prompt.category)) {
      state.categories.push(prompt.category);
    }
    save();
    return prompt;
  }

  function updatePrompt(id, data) {
    const p = state.prompts.find(x => x.id === id);
    if (!p) return null;
    if (data.title != null) p.title = String(data.title).slice(0, 120);
    if (data.body != null) p.body = String(data.body);
    if (data.category != null) p.category = String(data.category);
    if (data.tags != null) p.tags = data.tags;
    if (data.examples != null) p.examples = data.examples;
    p.updatedAt = new Date().toISOString();
    if (p.category && !state.categories.includes(p.category)) {
      state.categories.push(p.category);
    }
    save();
    return p;
  }

  function deletePrompt(prompt) {
    if (!confirm(`Delete prompt "${prompt.title}"?`)) return;
    state.prompts = state.prompts.filter(p => p.id !== prompt.id);
    save();
    renderBody();
    showToast('Prompt deleted', 'success', 2000);
  }

  function duplicatePrompt(prompt) {
    const copy = {
      ...prompt,
      id: uid(),
      title: prompt.title + ' (copy)',
      useCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.prompts.unshift(copy);
    save();
    renderBody();
    showToast('Prompt duplicated', 'success', 2000);
  }

  /* ============================================================
     EDITOR MODAL
     ============================================================ */
  function buildEditorModal() {
    let overlay = document.getElementById('nxPlEditorOverlay');
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'nx-pl-editor-overlay';
    overlay.id = 'nxPlEditorOverlay';
    overlay.innerHTML = `
      <div class="nx-pl-editor-modal" role="dialog" aria-modal="true">
        <div class="nx-pl-editor-header">
          <span id="nxPlEditorTitle">New prompt</span>
          <button class="modal-close" id="nxPlEditorClose" aria-label="Close">×</button>
        </div>
        <div class="nx-pl-editor-body" id="nxPlEditorBody"></div>
        <div class="nx-pl-editor-footer">
          <div class="nx-pl-editor-footer-left" id="nxPlEditorFooterLeft"></div>
          <div class="nx-pl-editor-footer-right">
            <button class="nx-pl-btn ghost" id="nxPlEditorCancel">Cancel</button>
            <button class="nx-pl-btn primary" id="nxPlEditorSave">Save</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#nxPlEditorClose').addEventListener('click', closeEditor);
    overlay.querySelector('#nxPlEditorCancel').addEventListener('click', closeEditor);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) closeEditor();
    });
  }

  function openEditor(prompt) {
    buildEditorModal();
    state.editingId = prompt ? prompt.id : null;
    const overlay = document.getElementById('nxPlEditorOverlay');
    const title = document.getElementById('nxPlEditorTitle');
    const body = document.getElementById('nxPlEditorBody');
    const footerLeft = document.getElementById('nxPlEditorFooterLeft');
    title.textContent = prompt ? 'Edit prompt' : 'New prompt';
    body.innerHTML = '';
    footerLeft.innerHTML = '';

    const working = prompt ? {
      ...prompt,
      examples: (prompt.examples || []).slice(),
      tags: (prompt.tags || []).slice(),
    } : {
      title: '',
      body: '',
      category: state.filterCategory !== 'all' ? state.filterCategory : 'General',
      tags: [],
      examples: [],
    };

    // Title
    const titleField = document.createElement('div');
    titleField.className = 'nx-pl-field';
    titleField.innerHTML = `
      <label class="nx-pl-label">Title</label>
      <input type="text" class="nx-pl-input" id="nxPlEdTitle" maxlength="120" placeholder="e.g. Code review checklist" value="${escapeHtml(working.title)}">`;
    body.appendChild(titleField);

    // Body
    const bodyField = document.createElement('div');
    bodyField.className = 'nx-pl-field';
    bodyField.innerHTML = `
      <label class="nx-pl-label">Prompt body</label>
      <textarea class="nx-pl-textarea" id="nxPlEdBody" placeholder="Write your prompt… Use {{variable}} for dynamic values.">${escapeHtml(working.body)}</textarea>
      <div class="nx-pl-hint">Use <code style="font-family:var(--font-mono);background:var(--bg-tertiary);padding:1px 4px;border-radius:3px;color:var(--accent-secondary);">{{variable}}</code> for dynamic values. Variables appear in a fill-in dialog when the prompt is inserted.</div>
      <div class="nx-pl-var-preview" id="nxPlEdVarPreview"></div>`;
    body.appendChild(bodyField);

    // Category
    const catField = document.createElement('div');
    catField.className = 'nx-pl-field';
    const catSelect = document.createElement('select');
    catSelect.className = 'nx-pl-select';
    catSelect.id = 'nxPlEdCategory';
    for (const cat of state.categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === working.category) opt.selected = true;
      catSelect.appendChild(opt);
    }
    const optNew = document.createElement('option');
    optNew.value = '__new__';
    optNew.textContent = '+ New category…';
    catSelect.appendChild(optNew);
    catField.innerHTML = `<label class="nx-pl-label">Category</label>`;
    catField.appendChild(catSelect);
    body.appendChild(catField);

    // Tags
    const tagsField = document.createElement('div');
    tagsField.className = 'nx-pl-field';
    tagsField.innerHTML = `
      <label class="nx-pl-label">Tags</label>
      <input type="text" class="nx-pl-input" id="nxPlEdTags" placeholder="comma, separated, tags" value="${escapeHtml(working.tags.join(', '))}">
      <div class="nx-pl-hint">Optional. Comma-separated.</div>`;
    body.appendChild(tagsField);

    // Examples
    const exField = document.createElement('div');
    exField.className = 'nx-pl-field';
    exField.innerHTML = `
      <label class="nx-pl-label">Few-shot examples</label>
      <div class="nx-pl-examples-list" id="nxPlEdExamples"></div>
      <button type="button" class="nx-pl-add-example-btn" id="nxPlEdAddExample">+ Add example</button>`;
    body.appendChild(exField);

    // Render examples
    const exList = exField.querySelector('#nxPlEdExamples');
    const renderExamples = () => {
      exList.innerHTML = '';
      if (!working.examples.length) {
        exList.innerHTML = `<div style="font-size:11px;color:var(--text-tertiary);padding:8px 0;">No examples yet.</div>`;
        return;
      }
      working.examples.forEach((ex, i) => {
        const item = document.createElement('div');
        item.className = 'nx-pl-example-item';
        item.innerHTML = `
          <button type="button" class="nx-pl-example-remove" title="Remove">×</button>
          <div class="nx-pl-example-user">${escapeHtml(ex.user || '')}</div>
          <div class="nx-pl-example-assistant">${escapeHtml(ex.assistant || '')}</div>`;
        item.querySelector('.nx-pl-example-remove').addEventListener('click', () => {
          working.examples.splice(i, 1);
          renderExamples();
        });
        exList.appendChild(item);
      });
    };
    renderExamples();

    exField.querySelector('#nxPlEdAddExample').addEventListener('click', () => {
      const user = prompt('User message for example (the input):', '');
      if (user == null) return;
      const assistant = prompt('Assistant message for example (the expected response):', '');
      if (assistant == null) return;
      if (!user.trim()) return;
      working.examples.push({ user: user.trim(), assistant: assistant.trim() });
      renderExamples();
    });

    // Wire variable preview
    const varPreview = bodyField.querySelector('#nxPlEdVarPreview');
    const bodyInput = bodyField.querySelector('#nxPlEdBody');
    const updateVarPreview = () => {
      const vars = extractVariables(bodyInput.value);
      varPreview.innerHTML = vars.length
        ? vars.map(v => `<span class="nx-pl-var-chip">{{${escapeHtml(v)}}}</span>`).join('')
        : '';
    };
    updateVarPreview();
    bodyInput.addEventListener('input', updateVarPreview);

    // Handle new category selection
    catSelect.addEventListener('change', () => {
      if (catSelect.value === '__new__') {
        const newCat = prompt('New category name:', '');
        if (newCat && newCat.trim()) {
          const clean = newCat.trim().slice(0, 40);
          if (!state.categories.includes(clean)) {
            state.categories.push(clean);
          }
          // Add option and select it
          const opt = document.createElement('option');
          opt.value = clean;
          opt.textContent = clean;
          catSelect.insertBefore(opt, optNew);
          catSelect.value = clean;
        } else {
          catSelect.value = working.category;
        }
      }
    });

    // Delete button for existing
    if (prompt) {
      const delBtn = document.createElement('button');
      delBtn.className = 'nx-pl-btn danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Delete prompt "${prompt.title}"?`)) return;
        state.prompts = state.prompts.filter(p => p.id !== prompt.id);
        save();
        closeEditor();
        renderBody();
        showToast('Prompt deleted', 'success', 2000);
      });
      footerLeft.appendChild(delBtn);
    }

    // Save
    const saveBtn = document.getElementById('nxPlEditorSave');
    const onSave = () => {
      const t = titleField.querySelector('#nxPlEdTitle').value.trim();
      const b = bodyField.querySelector('#nxPlEdBody').value;
      const c = catSelect.value === '__new__' ? working.category : catSelect.value;
      const tagsRaw = tagsField.querySelector('#nxPlEdTags').value;
      const tags = tagsRaw.split(',').map(x => x.trim()).filter(Boolean);

      if (!t) { showToast('Title is required', 'error', 2000); return; }
      if (!b.trim()) { showToast('Prompt body is required', 'error', 2000); return; }

      if (state.editingId) {
        updatePrompt(state.editingId, {
          title: t, body: b, category: c, tags,
          examples: working.examples,
        });
        showToast('Prompt updated', 'success', 2000);
      } else {
        createPrompt({
          title: t, body: b, category: c, tags,
          examples: working.examples,
        });
        showToast('Prompt created', 'success', 2000);
      }
      closeEditor();
      renderBody();
    };
    saveBtn.onclick = onSave;

    // Cmd/Ctrl+Enter saves
    body.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onSave();
      }
    });

    overlay.classList.add('open');
    setTimeout(() => {
      titleField.querySelector('#nxPlEdTitle').focus();
    }, 100);
  }

  function closeEditor() {
    const overlay = document.getElementById('nxPlEditorOverlay');
    if (overlay) overlay.classList.remove('open');
    state.editingId = null;
  }

  /* ============================================================
     VARIABLE FILL DIALOG
     ============================================================ */
  function openVariableDialog(prompt, callback) {
    // Tear down any existing
    const existing = document.getElementById('nxPlVarsOverlay');
    if (existing) existing.remove();

    const vars = extractVariables(prompt.body);
    if (!vars.length) {
      callback(prompt.body);
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'nx-pl-vars-overlay';
    overlay.id = 'nxPlVarsOverlay';
    overlay.innerHTML = `
      <div class="nx-pl-vars-modal" role="dialog" aria-modal="true">
        <div class="nx-pl-vars-header">
          <span>Fill in variables</span>
          <button class="modal-close" id="nxPlVarsClose" aria-label="Close">×</button>
        </div>
        <div class="nx-pl-vars-body">
          <div class="nx-pl-vars-preview" id="nxPlVarsPreview"></div>
          <div id="nxPlVarsFields"></div>
        </div>
        <div class="nx-pl-vars-footer">
          <button class="nx-pl-btn ghost" id="nxPlVarsCancel">Cancel</button>
          <button class="nx-pl-btn primary" id="nxPlVarsInsert">Insert</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const fieldsHost = overlay.querySelector('#nxPlVarsFields');
    const preview = overlay.querySelector('#nxPlVarsPreview');
    const values = {};

    const renderPreview = () => {
      const substituted = substituteVariables(prompt.body, values);
      // Highlight remaining unfilled variables in original
      const escaped = escapeHtml(substituted);
      const highlighted = escaped.replace(
        /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g,
        (m, name) => `<mark>{{${name}}}</mark>`
      );
      preview.innerHTML = highlighted;
    };
    renderPreview();

    for (const name of vars) {
      const field = document.createElement('div');
      field.className = 'nx-pl-vars-field';
      field.innerHTML = `
        <label class="nx-pl-vars-label">{{${escapeHtml(name)}}}</label>
        <input type="text" class="nx-pl-input" data-var="${escapeHtml(name)}" placeholder="Enter value for ${escapeHtml(name)}">`;
      const input = field.querySelector('input');
      input.addEventListener('input', () => {
        values[name] = input.value;
        renderPreview();
      });
      fieldsHost.appendChild(field);
    }

    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    const insert = () => {
      const final = substituteVariables(prompt.body, values);
      close();
      callback(final);
    };

    overlay.querySelector('#nxPlVarsClose').addEventListener('click', close);
    overlay.querySelector('#nxPlVarsCancel').addEventListener('click', close);
    overlay.querySelector('#nxPlVarsInsert').addEventListener('click', insert);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        // Move to next field or submit
        const inputs = Array.from(fieldsHost.querySelectorAll('input'));
        const idx = inputs.indexOf(e.target);
        if (idx === inputs.length - 1) insert();
        else if (idx >= 0) inputs[idx + 1].focus();
      }
    });

    overlay.classList.add('open');
    setTimeout(() => {
      const first = fieldsHost.querySelector('input');
      if (first) first.focus();
    }, 100);
  }

  /* ============================================================
     INSERT PROMPT
     ============================================================ */
  function insertPrompt(prompt) {
    const hasVars = extractVariables(prompt.body).length > 0;
    const hasExamples = Array.isArray(prompt.examples) && prompt.examples.length > 0;

    const finish = (finalBody) => {
      let textToInsert = finalBody;

      if (hasExamples) {
        const include = confirm(
          `This prompt has ${prompt.examples.length} few-shot example${prompt.examples.length === 1 ? '' : 's'}.\n\n` +
          `Include them in the message? (They will be prepended as reference pairs.)`
        );
        if (include) {
          const exLines = prompt.examples.map((ex, i) =>
            `Example ${i + 1}:\nUser: ${ex.user}\nAssistant: ${ex.assistant || ''}`
          ).join('\n\n');
          textToInsert = `${exLines}\n\n---\n\n${finalBody}`;
        }
      }

      const input = document.getElementById('chatInput');
      if (!input) return;
      input.value = textToInsert;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      try {
        input.setSelectionRange(textToInsert.length, textToInsert.length);
      } catch (e) {}

      // Increment use count
      const original = state.prompts.find(p => p.id === prompt.id);
      if (original) {
        original.useCount = (original.useCount || 0) + 1;
        save();
      }

      close();
      showToast(`Inserted "${prompt.title}"`, 'success', 2000);
    };

    if (hasVars) {
      openVariableDialog(prompt, finish);
    } else {
      finish(prompt.body);
    }
  }

  /* ============================================================
     IMPORT / EXPORT (single-prompt JSON)
     ============================================================ */
  function importPrompts(jsonText) {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      showToast('Invalid JSON: ' + err.message, 'error', 4000);
      return;
    }

    let incoming = [];
    if (Array.isArray(parsed)) incoming = parsed;
    else if (parsed && Array.isArray(parsed.prompts)) incoming = parsed.prompts;
    else {
      showToast('No prompts array found in JSON', 'error', 3500);
      return;
    }

    if (!incoming.length) {
      showToast('No prompts to import', 'warning', 2500);
      return;
    }

    const mode = prompt(
      `Import ${incoming.length} prompt${incoming.length === 1 ? '' : 's'}.\n\n` +
      `Type "merge" to add them, or "replace" to overwrite your entire library:`,
      'merge'
    );
    if (!mode) return;
    const norm = mode.toLowerCase().trim();
    if (norm !== 'merge' && norm !== 'replace') {
      showToast('Import cancelled', 'info', 2000);
      return;
    }

    if (norm === 'replace') {
      if (!confirm('Replace your ENTIRE prompt library with the imported data?')) return;
      state.prompts = [];
    }

    let added = 0;
    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') continue;
      if (!raw.title || !raw.body) continue;

      const prompt = {
        id: raw.id || uid(),
        title: String(raw.title).slice(0, 120),
        body: String(raw.body),
        category: raw.category || 'General',
        tags: Array.isArray(raw.tags) ? raw.tags : [],
        examples: Array.isArray(raw.examples) ? raw.examples : [],
        useCount: raw.useCount || 0,
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString(),
      };
      // Deduplicate by title in merge mode
      if (norm === 'merge' && state.prompts.some(p => p.title === prompt.title)) {
        prompt.title = prompt.title + ' (imported)';
      }
      state.prompts.push(prompt);
      if (prompt.category && !state.categories.includes(prompt.category)) {
        state.categories.push(prompt.category);
      }
      added++;
    }

    // Include categories from payload
    if (parsed && Array.isArray(parsed.categories)) {
      for (const c of parsed.categories) {
        if (typeof c === 'string' && !state.categories.includes(c)) {
          state.categories.push(c);
        }
      }
    }

    save();
    renderBody();
    showToast(
      `Imported ${added} prompt${added === 1 ? '' : 's'}`,
      'success',
      3000
    );
  }

  /* ============================================================
     OPEN / CLOSE
     ============================================================ */
  function open() {
    if (!state.modalEl) buildModal();
    state.modalEl.classList.add('open');
    renderBody();
  }

  function close() {
    if (!state.modalEl) return;
    state.modalEl.classList.remove('open');
  }

  /* ============================================================
     SAVE CURRENT INPUT
     ============================================================ */
  function saveCurrentInput() {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) {
      showToast('Nothing in the input to save', 'warning', 2500);
      return;
    }
    const body = input.value;
    if (!state.modalEl) buildModal();
    state.modalEl.classList.add('open');
    state.activeTab = 'browse';
    state.modalEl.querySelectorAll('.nx-pl-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === 'browse');
    });
    renderBody();

    // Open editor pre-filled
    openEditor({
      title: body.slice(0, 40) + (body.length > 40 ? '…' : ''),
      body: body,
      category: 'General',
      tags: [],
      examples: [],
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  ready(() => {
    injectStyles();
    load();
    mountTopBarButton();
    buildModal();

    // Keyboard shortcut: Ctrl/Cmd+Shift+P opens library
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (state.modalEl && state.modalEl.classList.contains('open')) close();
        else open();
      }
    });
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.PromptLibrary = {
    open,
    close,
    createPrompt,
    updatePrompt,
    deletePrompt,
    duplicatePrompt,
    insertPrompt,
    saveCurrentInput,
    importPrompts,
    exportPrompts: () => JSON.stringify({
      prompts: state.prompts,
      categories: state.categories,
      exportedAt: new Date().toISOString(),
      version: 1,
    }, null, 2),
    getPrompts: () => state.prompts.slice(),
    getCategories: () => state.categories.slice(),
    extractVariables,
  };
})();
