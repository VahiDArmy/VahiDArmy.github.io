/* ============================================================
   NEXUS CHAT — ATTACHMENTS
   File and image attachments for messages.
   - Images: sent to vision-capable models as image_url parts
   - Text/code files: inlined as text
   - PDF: extracted via PDF.js (lazy-loaded)

   Auto-loaded by index.html (in the auto-loader list).

   Public API:
     window.Nexus.Attachments.openFilePicker()
     window.Nexus.Attachments.addFile(file)          // File object
     window.Nexus.Attachments.addFiles(fileList)     // FileList or array
     window.Nexus.Attachments.getPending()           // pending attachment list
     window.Nexus.Attachments.clearPending()
     window.Nexus.Attachments.removeAt(index)
   ============================================================ */
(function () {
  'use strict';
  if (window.__nexus_attachments_loaded__) return;
  window.__nexus_attachments_loaded__ = true;

  /* ============================================================
     CONSTANTS
     ============================================================ */
  const MAX_FILE_SIZE = 20 * 1024 * 1024;      // 20 MB hard limit
  const IMAGE_WARN_SIZE = 5 * 1024 * 1024;      // warn above 5 MB
  const TEXT_MAX_CHARS = 400000;                // ~400KB of text
  const PDF_MAX_PAGES = 100;

  const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

  const TEXT_EXTS = [
    'txt', 'md', 'markdown', 'rst',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'swift', 'kt',
    'html', 'htm', 'xml', 'svg',
    'css', 'scss', 'sass', 'less',
    'json', 'jsonl', 'yaml', 'yml', 'toml',
    'sql', 'sh', 'bash', 'zsh', 'fish',
    'env', 'ini', 'conf', 'cfg',
    'csv', 'tsv', 'log',
    'vue', 'svelte', 'astro',
  ];

  /* ============================================================
     STATE
     ============================================================ */
  const state = {
    pending: [],       // [{ id, kind, name, size, mimeType, dataUrl?, content? }]
    pdfJsLoaded: false,
    pdfJsLoading: null,
    pickerInput: null,
    chipRow: null,
    dragOverlayEl: null,
  };

  /* ============================================================
     CSS
     ============================================================ */
  function injectStyles() {
    if (document.getElementById('nx-attach-styles')) return;
    const css = `
/* ============================================================
   ATTACHMENT BUTTON
   ============================================================ */
.nx-attach-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative;
  margin-right: 6px;
}
.nx-attach-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.nx-attach-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.nx-attach-btn .nx-attach-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  background: var(--accent-primary);
  color: #fff;
  border-radius: 100px;
  font-size: 9px;
  font-weight: 700;
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--bg-primary);
}

/* ============================================================
   PENDING ATTACHMENTS ROW (above input)
   ============================================================ */
.nx-attach-row {
  max-width: 860px;
  margin: 0 auto 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 4px;
}
.nx-attach-row:empty {
  display: none;
}
.nx-attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 260px;
  transition: all 0.15s;
  position: relative;
}
.nx-attach-chip:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}
.nx-attach-chip-thumb {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.nx-attach-chip-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.nx-attach-chip-thumb .icon {
  font-size: 16px;
  color: var(--text-tertiary);
}
.nx-attach-chip-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.nx-attach-chip-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nx-attach-chip-size {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-tertiary);
}
.nx-attach-chip-remove {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 12px;
  transition: all 0.12s;
  flex-shrink: 0;
}
.nx-attach-chip-remove:hover {
  background: rgba(225, 112, 85, 0.15);
  color: var(--danger);
}
.nx-attach-chip.processing {
  opacity: 0.6;
  pointer-events: none;
}
.nx-attach-chip.processing .nx-attach-chip-thumb::after {
  content: '';
  width: 14px;
  height: 14px;
  border: 2px solid var(--text-tertiary);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: nx-attach-spin 0.7s linear infinite;
}
@keyframes nx-attach-spin { to { transform: rotate(360deg); } }
.nx-attach-chip.error {
  border-color: var(--danger);
  background: rgba(225, 112, 85, 0.08);
}

/* ============================================================
   ATTACHMENTS IN MESSAGE
   ============================================================ */
.nx-msg-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.message.user .nx-msg-attachments {
  justify-content: flex-end;
}
.nx-msg-attach {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 6px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  font-size: 11px;
  color: inherit;
  max-width: 240px;
}
.message.assistant .nx-msg-attach {
  background: var(--bg-tertiary);
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}
.nx-msg-attach-thumb {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.nx-msg-attach-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: zoom-in;
}
.nx-msg-attach-thumb .icon {
  font-size: 14px;
  opacity: 0.8;
}
.nx-msg-attach-name {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   IMAGE VIEWER (lightbox)
   ============================================================ */
.nx-attach-viewer {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 2900;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  cursor: zoom-out;
}
.nx-attach-viewer.open {
  opacity: 1;
  pointer-events: auto;
}
.nx-attach-viewer img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
}
.nx-attach-viewer-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.nx-attach-viewer-close:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* ============================================================
   DRAG OVERLAY
   ============================================================ */
.nx-attach-dragover {
  position: fixed;
  inset: 0;
  background: rgba(108, 92, 231, 0.15);
  border: 3px dashed var(--accent-primary);
  z-index: 2600;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.nx-attach-dragover.visible {
  opacity: 1;
}
.nx-attach-dragover-inner {
  padding: 24px 40px;
  background: var(--bg-elevated);
  border-radius: 16px;
  text-align: center;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}
.nx-attach-dragover-inner .icon {
  font-size: 40px;
  margin-bottom: 8px;
  color: var(--accent-secondary);
}

/* ============================================================
   TOAST FOR ERRORS (uses existing .toast styles)
   ============================================================ */

@media (max-width: 700px) {
  .nx-attach-chip { max-width: 220px; }
  .nx-attach-viewer { padding: 16px; }
}
`;
    const style = document.createElement('style');
    style.id = 'nx-attach-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     UTILS
     ============================================================ */
  function uid() {
    return 'att-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }
  function escapeHtml(s) {
    if (window.__nexus && window.__nexus.escapeHtml) return window.__nexus.escapeHtml(s);
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function humanSize(bytes) {
    if (!bytes || bytes < 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function getExtension(name) {
    if (!name) return '';
    const m = String(name).match(/\.([a-zA-Z0-9]+)$/);
    return m ? m[1].toLowerCase() : '';
  }
  function showToast(msg, type, dur) {
    if (window.__nexus && window.__nexus.showToast) {
      window.__nexus.showToast(msg, type, dur);
    } else {
      console.log(`[${type}] ${msg}`);
    }
  }
  function isImage(file) {
    if (file.type && IMAGE_MIMES.includes(file.type.toLowerCase())) return true;
    const ext = getExtension(file.name);
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  }
  function isPDF(file) {
    return file.type === 'application/pdf' || getExtension(file.name) === 'pdf';
  }
  function isText(file) {
    if (file.type && file.type.startsWith('text/')) return true;
    if (file.type && ['application/json', 'application/xml', 'application/javascript'].includes(file.type)) return true;
    return TEXT_EXTS.includes(getExtension(file.name));
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsDataURL(file);
    });
  }
  function fileToText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsText(file);
    });
  }
  function fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsArrayBuffer(file);
    });
  }

  /* ============================================================
     PDF.js LAZY LOAD
     ============================================================ */
  async function ensurePdfJs() {
    if (state.pdfJsLoaded) return window.pdfjsLib;
    if (state.pdfJsLoading) return state.pdfJsLoading;

    state.pdfJsLoading = (async () => {
      try {
        const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs');
        mod.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs';
        state.pdfJsLoaded = true;
        window.pdfjsLib = mod;
        return mod;
      } catch (err) {
        state.pdfJsLoading = null;
        throw new Error('PDF library failed to load: ' + err.message);
      }
    })();
    return state.pdfJsLoading;
  }

  async function extractPdfText(file) {
    const pdfjs = await ensurePdfJs();
    const buffer = await fileToArrayBuffer(file);
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    const pageCount = Math.min(pdf.numPages, PDF_MAX_PAGES);
    const lines = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      lines.push(`--- Page ${i} ---\n${text}`);
    }
    if (pdf.numPages > pageCount) {
      lines.push(`\n[${pdf.numPages - pageCount} more pages omitted]`);
    }
    return lines.join('\n\n');
  }

  /* ============================================================
     ATTACHMENT OBJECTS
     ============================================================ */
  async function buildAttachment(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${humanSize(file.size)} (max ${humanSize(MAX_FILE_SIZE)})`);
    }

    const base = {
      id: uid(),
      name: file.name || 'attachment',
      size: file.size || 0,
      mimeType: file.type || '',
    };

    if (isImage(file)) {
      if (file.size > IMAGE_WARN_SIZE) {
        showToast(
          `Image is large (${humanSize(file.size)}). Some models may reject it.`,
          'warning',
          4000
        );
      }
      const dataUrl = await fileToDataUrl(file);
      return { ...base, kind: 'image', dataUrl };
    }

    if (isPDF(file)) {
      showToast('Extracting text from PDF…', 'info', 2000);
      const content = await extractPdfText(file);
      if (!content || content.length < 20) {
        throw new Error('PDF contains no readable text');
      }
      return {
        ...base,
        kind: 'pdf',
        content: content.slice(0, TEXT_MAX_CHARS),
        truncated: content.length > TEXT_MAX_CHARS,
      };
    }

    if (isText(file)) {
      const content = await fileToText(file);
      const truncated = content.length > TEXT_MAX_CHARS;
      return {
        ...base,
        kind: 'text',
        content: content.slice(0, TEXT_MAX_CHARS),
        truncated,
      };
    }

    // Unknown binary — try as text anyway
    try {
      const content = await fileToText(file);
      if (content && !/\u0000/.test(content)) {
        return {
          ...base,
          kind: 'text',
          content: content.slice(0, TEXT_MAX_CHARS),
          truncated: content.length > TEXT_MAX_CHARS,
          warning: 'File type not recognized, treated as text',
        };
      }
    } catch (e) {}

    throw new Error(`Unsupported file type: ${file.type || getExtension(file.name) || 'unknown'}`);
  }

  /* ============================================================
     PENDING QUEUE
     ============================================================ */
  async function addFile(file) {
    if (!file) return;
    // Prevent duplicate by name+size
    if (state.pending.some(a => a.name === file.name && a.size === file.size)) {
      showToast('Same file already attached', 'info', 2000);
      return;
    }

    // Add placeholder chip
    const placeholder = {
      id: uid(),
      name: file.name || 'attachment',
      size: file.size || 0,
      kind: 'pending',
      mimeType: file.type || '',
    };
    state.pending.push(placeholder);
    renderPending();

    try {
      const att = await buildAttachment(file);
      // Replace placeholder
      const idx = state.pending.findIndex(p => p.id === placeholder.id);
      if (idx !== -1) {
        // Preserve the ID so the chip identity is stable
        att.id = placeholder.id;
        state.pending[idx] = att;
      } else {
        state.pending.push(att);
      }
      renderPending();
    } catch (err) {
      const idx = state.pending.findIndex(p => p.id === placeholder.id);
      if (idx !== -1) {
        state.pending[idx] = {
          ...placeholder,
          kind: 'error',
          error: err.message,
        };
      }
      renderPending();
      showToast('Attachment failed: ' + err.message, 'error', 5000);
    }
  }

  async function addFiles(list) {
    if (!list) return;
    const arr = Array.from(list);
    if (!arr.length) return;
    // Handle sequentially to avoid overwhelming browser with reads
    for (const f of arr) {
      await addFile(f);
    }
  }

  function removeAttachment(id) {
    state.pending = state.pending.filter(a => a.id !== id);
    renderPending();
  }

  function clearPending() {
    state.pending = [];
    renderPending();
  }

  function commitPendingToMessage(msg) {
    if (!msg) return;
    if (!state.pending.length) return;
    const ready = state.pending.filter(a => a.kind !== 'error' && a.kind !== 'pending');
    if (!ready.length) return;
    msg.attachments = ready.map(a => ({ ...a }));
    // Clear pending
    state.pending = [];
    renderPending();
  }

  function renderPending() {
    if (!state.chipRow) return;
    state.chipRow.innerHTML = '';
    for (const a of state.pending) {
      state.chipRow.appendChild(renderChip(a));
    }
    // Update button badge
    const btn = document.getElementById('nxAttachBtn');
    if (btn) {
      const count = state.pending.filter(a => a.kind !== 'error').length;
      const existing = btn.querySelector('.nx-attach-count');
      if (existing) existing.remove();
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'nx-attach-count';
        badge.textContent = String(count);
        btn.appendChild(badge);
      }
    }
    // Recompute input height because pending row changes wrapper layout
    const input = document.getElementById('chatInput');
    if (input) {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    }
  }

  function renderChip(a) {
    const chip = document.createElement('div');
    chip.className = 'nx-attach-chip';
    if (a.kind === 'pending') chip.classList.add('processing');
    if (a.kind === 'error') chip.classList.add('error');
    chip.dataset.id = a.id;

    let thumbHtml = '';
    if (a.kind === 'image' && a.dataUrl) {
      thumbHtml = `<img src="${escapeHtml(a.dataUrl)}" alt="">`;
    } else if (a.kind === 'pdf') {
      thumbHtml = `<span class="icon">📄</span>`;
    } else if (a.kind === 'text') {
      thumbHtml = `<span class="icon">📝</span>`;
    } else if (a.kind === 'error') {
      thumbHtml = `<span class="icon">⚠️</span>`;
    } else {
      thumbHtml = `<span class="icon">📎</span>`;
    }

    const subtitle = a.kind === 'error'
      ? escapeHtml(a.error || 'error')
      : humanSize(a.size);

    chip.innerHTML = `
      <div class="nx-attach-chip-thumb">${thumbHtml}</div>
      <div class="nx-attach-chip-info">
        <div class="nx-attach-chip-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div>
        <div class="nx-attach-chip-size">${subtitle}</div>
      </div>
      <button class="nx-attach-chip-remove" title="Remove attachment">×</button>`;

    chip.querySelector('.nx-attach-chip-remove').addEventListener('click', () => {
      removeAttachment(a.id);
    });

    return chip;
  }

  /* ============================================================
     MESSAGE RENDERING (chips shown inside messages)
     ============================================================ */
  function renderAttachmentsInMessage(wrapper, msg) {
    if (!msg || !Array.isArray(msg.attachments) || !msg.attachments.length) return;
    if (wrapper.querySelector('.nx-msg-attachments')) return;

    const body = wrapper.querySelector('.message-body');
    if (!body) return;

    const container = document.createElement('div');
    container.className = 'nx-msg-attachments';

    for (const a of msg.attachments) {
      const chip = document.createElement('div');
      chip.className = 'nx-msg-attach';

      let thumbHtml = '';
      if (a.kind === 'image' && a.dataUrl) {
        thumbHtml = `<img src="${escapeHtml(a.dataUrl)}" alt="${escapeHtml(a.name)}" data-viewer="1">`;
      } else if (a.kind === 'pdf') {
        thumbHtml = `<span class="icon">📄</span>`;
      } else if (a.kind === 'text') {
        thumbHtml = `<span class="icon">📝</span>`;
      } else {
        thumbHtml = `<span class="icon">📎</span>`;
      }

      chip.innerHTML = `
        <div class="nx-msg-attach-thumb">${thumbHtml}</div>
        <div class="nx-msg-attach-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div>`;

      // Click to view image
      const img = chip.querySelector('img[data-viewer]');
      if (img) {
        img.addEventListener('click', () => openViewer(a.dataUrl));
      }

      container.appendChild(chip);
    }

    // Insert before the message-content
    const contentEl = body.querySelector('.message-content');
    if (contentEl && contentEl.parentNode === body) {
      body.insertBefore(container, contentEl);
    } else {
      body.appendChild(container);
    }
  }

  function openViewer(dataUrl) {
    let viewer = document.getElementById('nxAttachViewer');
    if (!viewer) {
      viewer = document.createElement('div');
      viewer.className = 'nx-attach-viewer';
      viewer.id = 'nxAttachViewer';
      viewer.innerHTML = `
        <button class="nx-attach-viewer-close" aria-label="Close">×</button>
        <img src="" alt="">`;
      document.body.appendChild(viewer);
      viewer.querySelector('.nx-attach-viewer-close').addEventListener('click', closeViewer);
      viewer.addEventListener('click', (e) => {
        if (e.target === viewer) closeViewer();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && viewer.classList.contains('open')) closeViewer();
      });
    }
    viewer.querySelector('img').src = dataUrl;
    viewer.classList.add('open');
  }
  function closeViewer() {
    const viewer = document.getElementById('nxAttachViewer');
    if (viewer) viewer.classList.remove('open');
  }

  /* ============================================================
     MOUNT BUTTON AND CHIP ROW
     ============================================================ */
  function mountAttachButton() {
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    if (document.getElementById('nxAttachBtn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nx-attach-btn';
    btn.id = 'nxAttachBtn';
    btn.title = 'Attach files or images';
    btn.setAttribute('aria-label', 'Attach files');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M9.5 3.5L4.5 8.5a3 3 0 004.2 4.2l5-5a4 4 0 10-5.7-5.6l-5 5a5 5 0 007.1 7.1l4.3-4.3"/>
      </svg>`;
    btn.addEventListener('click', openFilePicker);

    const sendBtn = wrapper.querySelector('#sendBtn');
    if (sendBtn) wrapper.insertBefore(btn, sendBtn);
    else wrapper.appendChild(btn);
  }

  function mountChipRow() {
    const inputArea = document.querySelector('.input-area');
    if (!inputArea) return;
    if (document.getElementById('nxAttachRow')) {
      state.chipRow = document.getElementById('nxAttachRow');
      return;
    }
    const row = document.createElement('div');
    row.className = 'nx-attach-row';
    row.id = 'nxAttachRow';
    const wrapper = inputArea.querySelector('.input-wrapper');
    if (wrapper) inputArea.insertBefore(row, wrapper);
    else inputArea.appendChild(row);
    state.chipRow = row;
  }

  /* ============================================================
     FILE PICKER
     ============================================================ */
  function openFilePicker() {
    if (!state.pickerInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.style.display = 'none';
      input.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files && files.length) {
          await addFiles(files);
        }
        input.value = '';
      });
      document.body.appendChild(input);
      state.pickerInput = input;
    }
    state.pickerInput.click();
  }

  /* ============================================================
     DRAG & DROP ON INPUT AREA
     ============================================================ */
  function mountDragDrop() {
    if (!state.dragOverlayEl) {
      const overlay = document.createElement('div');
      overlay.className = 'nx-attach-dragover';
      overlay.innerHTML = `
        <div class="nx-attach-dragover-inner">
          <div class="icon">📎</div>
          <div>Drop files to attach</div>
        </div>`;
      document.body.appendChild(overlay);
      state.dragOverlayEl = overlay;
    }

    let dragDepth = 0;

    document.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer) return;
      const items = Array.from(e.dataTransfer.items || []);
      const hasFiles = items.some(it => it.kind === 'file');
      if (!hasFiles) return;
      // Skip drags over our own dialogs to avoid confusing the user
      if (e.target.closest && e.target.closest('.nx-sandbox-overlay, .nx-search-overlay, .nx-data-overlay')) return;
      dragDepth++;
      state.dragOverlayEl.classList.add('visible');
      e.preventDefault();
    });

    document.addEventListener('dragover', (e) => {
      if (!e.dataTransfer) return;
      if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    document.addEventListener('dragleave', (e) => {
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        state.dragOverlayEl.classList.remove('visible');
      }
    });

    document.addEventListener('drop', async (e) => {
      dragDepth = 0;
      state.dragOverlayEl.classList.remove('visible');
      if (!e.dataTransfer) return;
      if (!e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      await addFiles(e.dataTransfer.files);
    });
  }

  /* ============================================================
     PASTE IMAGES FROM CLIPBOARD
     ============================================================ */
  function mountPasteHandler() {
    document.addEventListener('paste', async (e) => {
      const input = document.getElementById('chatInput');
      if (!input || document.activeElement !== input) return;
      const items = Array.from(e.clipboardData?.items || []);
      const files = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        e.preventDefault();
        await addFiles(files);
      }
    });
  }

  /* ============================================================
     API INTEGRATION — MULTIMODAL CONTENT
     ============================================================ */
  function modelSupportsVision(model) {
    if (!model) return false;
    const inMods = model.architecture?.input_modalities || [];
    return inMods.includes('image');
  }

  function buildUserContent(msg, model) {
    const attachments = msg.attachments || [];
    if (!attachments.length) return msg.content;

    const textParts = [];
    const imageParts = [];
    const nonVisionImages = [];

    // Prepend attachments descriptions to the text
    for (const a of attachments) {
      if (a.kind === 'image') {
        if (modelSupportsVision(model)) {
          imageParts.push({
            type: 'image_url',
            image_url: { url: a.dataUrl },
          });
        } else {
          nonVisionImages.push(a.name);
        }
      } else if (a.kind === 'text') {
        textParts.push(
          `<attachment name="${a.name}">\n${a.content}\n</attachment>` +
          (a.truncated ? '\n[content truncated]' : '')
        );
      } else if (a.kind === 'pdf') {
        textParts.push(
          `<attachment name="${a.name}" type="pdf">\n${a.content}\n</attachment>` +
          (a.truncated ? '\n[content truncated]' : '')
        );
      }
    }

    // If image unsupported by model, note it in text
    let mainText = msg.content || '';
    if (nonVisionImages.length) {
      mainText += `\n\n[Note: ${nonVisionImages.length} image attachment${nonVisionImages.length === 1 ? '' : 's'} omitted because the current model doesn't support vision]`;
    }

    // If no vision parts, keep content as plain string (works with all models)
    if (!imageParts.length) {
      const combined = textParts.join('\n\n');
      if (combined) {
        return mainText + (mainText ? '\n\n' : '') + combined;
      }
      return mainText;
    }

    // Build multimodal array
    const content = [];
    if (mainText) {
      content.push({ type: 'text', text: mainText });
    }
    if (textParts.length) {
      content.push({ type: 'text', text: textParts.join('\n\n') });
    }
    for (const p of imageParts) content.push(p);
    return content;
  }

  /* ============================================================
     HOOKS
     ============================================================ */
  function ready(fn) {
    if (window.__nexus && window.__nexus.ready) return fn();
    window.addEventListener('nexus:ready', fn, { once: true });
  }

  ready(() => {
    injectStyles();
    mountAttachButton();
    mountChipRow();
    mountDragDrop();
    mountPasteHandler();

    if (!window.__nexus.hooks) return;

    // ---------- afterMessageElement: render attachment chips ----------
    if (Array.isArray(window.__nexus.hooks.afterMessageElement)) {
      window.__nexus.hooks.afterMessageElement.push((wrapper, msg) => {
        if (!msg) return;
        renderAttachmentsInMessage(wrapper, msg);
      });
    }

    // ---------- beforeMessageSend: attach pending files to message ----------
    if (Array.isArray(window.__nexus.hooks.beforeMessageSend)) {
      window.__nexus.hooks.beforeMessageSend.push((chat, text) => {
        if (!state.pending.length) return;
        if (!chat || !chat.messages.length) return;
        // Find last user message
        for (let i = chat.messages.length - 1; i >= 0; i--) {
          if (chat.messages[i].role === 'user') {
            commitPendingToMessage(chat.messages[i]);
            break;
          }
        }
      });
    }

    // ---------- beforeRequestSent: build multimodal content ----------
    if (Array.isArray(window.__nexus.hooks.beforeRequestSent)) {
      window.__nexus.hooks.beforeRequestSent.push((body) => {
        if (!body || !Array.isArray(body.messages)) return;
        const chat = window.__nexus.getActiveChat();
        if (!chat) return;

        const activeModel = window.__nexus.state.activeModel;

        // Filter user messages from chat that match body.messages order
        const chatUserMsgs = chat.messages.filter(m => m.role === 'user' && m.content);

        let uIdx = 0;
        for (let i = 0; i < body.messages.length; i++) {
          const bm = body.messages[i];
          if (bm.role !== 'user') continue;
          const cm = chatUserMsgs[uIdx++];
          if (!cm) continue;
          if (!Array.isArray(cm.attachments) || !cm.attachments.length) continue;

          // Transform content
          body.messages[i] = {
            ...bm,
            content: buildUserContent(cm, activeModel),
          };
        }

        // Warn once per-request about vision incompatibility
        for (const cm of chatUserMsgs) {
          if (!cm.attachments || !cm.attachments.length) continue;
          const imageCount = cm.attachments.filter(a => a.kind === 'image').length;
          if (!imageCount) continue;
          if (!modelSupportsVision(activeModel)) {
            showToast(
              `Current model doesn't support images. ${imageCount} image${imageCount === 1 ? '' : 's'} will be omitted.`,
              'warning',
              4000
            );
            break;
          }
        }
      });
    }

    // ---------- afterMessageSend: safety clear ----------
    if (Array.isArray(window.__nexus.hooks.afterMessageSend)) {
      window.__nexus.hooks.afterMessageSend.push(() => {
        if (state.pending.length) clearPending();
      });
    }
  });

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.Nexus = window.Nexus || {};
  window.Nexus.Attachments = {
    openFilePicker,
    addFile,
    addFiles,
    getPending: () => state.pending.slice(),
    clearPending,
    removeAt: (idx) => {
      if (idx < 0 || idx >= state.pending.length) return;
      removeAttachment(state.pending[idx].id);
    },
    buildUserContent,
    modelSupportsVision,
  };
})();
