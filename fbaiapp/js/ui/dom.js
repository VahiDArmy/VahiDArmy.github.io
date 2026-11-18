// ---------------------------------------------------------------------------
// UI primitives: icons, toasts, modals, markdown.
// ---------------------------------------------------------------------------

import { escapeHtml } from '../core/util.js';

const ICONS = {
  plus: '<path d="M10 4v12M4 10h12"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3l1.5 2h6.5A1.5 1.5 0 0 1 17 8.5v6A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5z"/>',
  file: '<path d="M5 3.5h6l4 4V16a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 5 16z"/><path d="M11 3.5V8h4"/>',
  chat: '<path d="M3.5 5.5h13v8h-7l-3 2.5v-2.5h-3z"/>',
  list: '<path d="M6 5.5h10M6 10h10M6 14.5h10"/><circle cx="3.5" cy="5.5" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="3.5" cy="14.5" r=".9" fill="currentColor" stroke="none"/>',
  activity: '<path d="M2.5 10h3l2-5 3 10 2-5h5"/>',
  brain: '<path d="M7.5 4.5A2.5 2.5 0 0 0 5 7v.5A2.5 2.5 0 0 0 4 12a2.5 2.5 0 0 0 1.5 3.5A2.5 2.5 0 0 0 10 17V6a2 2 0 0 0-2.5-1.5z"/><path d="M12.5 4.5A2.5 2.5 0 0 1 15 7v.5A2.5 2.5 0 0 1 16 12a2.5 2.5 0 0 1-1.5 3.5A2.5 2.5 0 0 1 10 17"/>',
  cpu: '<rect x="5" y="5" width="10" height="10" rx="2"/><path d="M8 2.5v2M12 2.5v2M8 15.5v2M12 15.5v2M2.5 8h2M2.5 12h2M15.5 8h2M15.5 12h2"/>',
  settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"/>',
  back: '<path d="M12 4.5 6.5 10l5.5 5.5"/>',
  send: '<path d="M3 10 17 3.5 13 17l-3.4-5.6z"/><path d="M9.6 11.4 17 3.5"/>',
  stop: '<rect x="6" y="6" width="8" height="8" rx="1.5" fill="currentColor" stroke="none"/>',
  trash: '<path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6"/>',
  edit: '<path d="M13.5 3.8 16.2 6.5 8 14.7l-3.2.7.7-3.2z"/>',
  download: '<path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15.5h12"/>',
  upload: '<path d="M10 13V4M6.5 7.5 10 4l3.5 3.5M4 15.5h12"/>',
  link: '<path d="M8.2 11.8 11.8 8.2"/><path d="M7 13.5 5.6 14.9a2.6 2.6 0 0 1-3.7-3.7l2.4-2.4a2.6 2.6 0 0 1 3.7 0"/><path d="M13 6.5l1.4-1.4a2.6 2.6 0 1 1 3.7 3.7l-2.4 2.4a2.6 2.6 0 0 1-3.7 0"/>',
  check: '<path d="M4.5 10.5 8 14l7.5-8"/>',
  x: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
  more: '<circle cx="4.5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor" stroke="none"/>',
  refresh: '<path d="M16 10a6 6 0 1 1-1.8-4.3"/><path d="M16 3v3.5h-3.5"/>',
  play: '<path d="M6.5 4.5 15 10l-8.5 5.5z"/>',
  key: '<circle cx="7" cy="12" r="3.2"/><path d="M9.4 9.6 16 3M13 6l2 2M15 4l2 2"/>',
  logout: '<path d="M12 10H4M6.5 7 3.5 10l3 3"/><path d="M9 4.5h6A1.5 1.5 0 0 1 16.5 6v8A1.5 1.5 0 0 1 15 15.5H9"/>',
  search: '<circle cx="9" cy="9" r="4.5"/><path d="M12.5 12.5 16.5 16.5"/>',
  chevron: '<path d="M7 5.5 12 10l-5 4.5"/>',
  sparkle: '<path d="M10 3.5 11.6 8 16 9.6 11.6 11.2 10 15.7 8.4 11.2 4 9.6 8.4 8z"/>',
  shield: '<path d="M10 3 16 5v5c0 3.6-2.5 6.3-6 7-3.5-.7-6-3.4-6-7V5z"/><path d="M7.5 10 9.5 12 13 8.5"/>',
  clock: '<circle cx="10" cy="10" r="6.5"/><path d="M10 6v4.3l2.7 1.6"/>',
  folderOpen: '<path d="M3 8.5V6a1.5 1.5 0 0 1 1.5-1.5h3L9 6.5h6A1.5 1.5 0 0 1 16.5 8v.5"/><path d="M3 8.5h13.5l-1.6 6.4a1.5 1.5 0 0 1-1.5 1.1H4.3a1.3 1.3 0 0 1-1.3-1.6z"/>',
  info: '<circle cx="10" cy="10" r="6.5"/><path d="M10 9v4.5"/><circle cx="10" cy="6.7" r=".8" fill="currentColor" stroke="none"/>',
};

export function icon(name, className = '') {
  const path = ICONS[name] || ICONS.info;
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${path}</svg>`;
}

// ---------------------------------------------------------------------------
// toasts
// ---------------------------------------------------------------------------

export function toast(message, { kind = '', timeout = 3800 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .2s, transform .2s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 220);
  }, timeout);
}

// ---------------------------------------------------------------------------
// modal
// ---------------------------------------------------------------------------

let modalCleanup = null;

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body html
 * @param {Array<{label:string,value:any,variant?:string}>} opts.actions
 * @param {(el:HTMLElement)=>void} [opts.onMount]
 */
export function openModal({ title, body = '', actions = [], onMount = null, size = '' }) {
  closeModal();
  const root = document.getElementById('modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-head">
        <h2>${escapeHtml(title)}</h2>
        <button class="btn ghost icon small" data-close aria-label="Close">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions"></div>
    </div>`;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };

    const actionsHost = backdrop.querySelector('.modal-actions');
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${action.variant || ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => {
        if (action.onClick) {
          const result = action.onClick(backdrop);
          if (result === false) return;
        }
        finish(action.value);
      });
      actionsHost.appendChild(btn);
    }

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) finish(null);
    });
    backdrop.querySelector('[data-close]')?.addEventListener('click', () => finish(null));

    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); finish(null); }
    };
    document.addEventListener('keydown', onKey);

    modalCleanup = () => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      modalCleanup = null;
    };

    root.appendChild(backdrop);
    onMount?.(backdrop);
    const focusable = backdrop.querySelector('input, textarea, select, button.primary');
    setTimeout(() => focusable?.focus(), 30);
  });
}

export function closeModal() {
  if (modalCleanup) modalCleanup();
}

export async function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, details = '' }) {
  const result = await openModal({
    title,
    body: `<p class="small" style="color:var(--text-2);margin-bottom:8px">${escapeHtml(message)}</p>${details ? `<div class="callout ${danger ? 'danger' : ''} small">${escapeHtml(details)}</div>` : ''}`,
    actions: [
      { label: cancelLabel, value: false, variant: 'ghost' },
      { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary' },
    ],
  });
  return result === true;
}

export async function promptDialog({ title, label = '', value = '', placeholder = '', multiline = false, hint = '', confirmLabel = 'Save' }) {
  const body = `
    <div class="field">
      ${label ? `<label for="pd-input">${escapeHtml(label)}</label>` : ''}
      ${multiline
        ? `<textarea class="textarea" id="pd-input" rows="5" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
        : `<input class="input" id="pd-input" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />`}
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
  const result = await openModal({
    title,
    body,
    actions: [
      { label: 'Cancel', value: null, variant: 'ghost' },
      {
        label: confirmLabel,
        value: '__confirm__',
        variant: 'primary',
        onClick: () => {
          const input = document.getElementById('pd-input');
          if (!input) return false;
          const v = input.value.trim();
          return v ? undefined : false;
        },
      },
    ],
    onMount: (el) => {
      const input = el.querySelector('#pd-input');
      input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !multiline) {
          event.preventDefault();
          el.querySelector('.modal-actions .primary')?.click();
        }
      });
    },
  });
  if (result !== '__confirm__') return null;
  const input = document.getElementById('pd-input');
  return input ? input.value.trim() : null;
}

// ---------------------------------------------------------------------------
// markdown (small, safe subset)
// ---------------------------------------------------------------------------

function inline(text) {
  return text
    .replace(/`([^`\n]+)`/g, (_, code) => `<code>${code}</code>`)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export function renderMarkdown(source) {
  if (!source) return '';
  const codeBlocks = [];
  let text = String(source).replace(/\r\n/g, '\n');

  text = text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.push({ lang, code }) - 1;
    return `\u0000CB${index}\u0000`;
  });

  text = escapeHtml(text);

  const lines = text.split('\n');
  const out = [];
  let listType = null;
  let paragraph = [];
  let inTable = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };
  const closeTable = () => {
    if (inTable) { out.push('</tbody></table>'); inTable = false; }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (/^\u0000CB\d+\u0000$/.test(line.trim())) {
      flushParagraph(); closeList(); closeTable();
      const index = Number(line.trim().replace(/\u0000CB(\d+)\u0000/, '$1'));
      const block = codeBlocks[index];
      out.push(`<pre><code>${escapeHtml(block.code.replace(/\n$/, ''))}</code></pre>`);
      continue;
    }

    if (!line.trim()) { flushParagraph(); closeList(); closeTable(); continue; }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph(); closeList(); closeTable(); out.push('<hr/>'); continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph(); closeList(); closeTable();
      const level = Math.min(4, heading[1].length) + 1;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(); closeList(); closeTable();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph(); closeTable();
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph(); closeTable();
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      flushParagraph(); closeList();
      const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
      if (!inTable) {
        out.push('<table><tbody>');
        inTable = true;
        out.push(`<tr>${cells.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr>`);
      } else {
        out.push(`<tr>${cells.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`);
      }
      continue;
    }

    closeList();
    closeTable();
    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  closeTable();
  return out.join('\n');
}

export function codeBlockWithCopy(code, { language = '' } = {}) {
  return `<div class="code-block"><button class="btn small ghost copy" data-copy>Copy</button><pre><code>${escapeHtml(code)}</code></pre></div>`;
}

export function statusLabel(status) {
  const map = {
    completed: 'Completed',
    failed: 'Failed',
    interrupted: 'Interrupted',
    cancelled: 'Stopped',
    blocked: 'Needs you',
    unverified: 'Unverified',
    running: 'Working',
    done: 'Done',
    doing: 'In progress',
    todo: 'To do',
    queued: 'Queued',
  };
  return map[status] || status;
}

export function statusBadge(status) {
  const cls = {
    completed: 'ok', done: 'ok',
    running: 'accent', doing: 'accent',
    failed: 'danger', cancelled: 'danger',
    interrupted: 'warn', blocked: 'warn', unverified: 'warn',
    todo: '', queued: '',
  }[status] ?? '';
  return `<span class="badge dot ${cls}">${escapeHtml(statusLabel(status))}</span>`;
}

export function emptyState({ iconName = 'sparkle', title, body, actionLabel = '', actionId = '' }) {
  return `<div class="empty">
    <div style="color:var(--accent);opacity:.9">${icon(iconName, 'big')}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(body)}</p>
    ${actionLabel ? `<button class="btn primary" id="${actionId}">${escapeHtml(actionLabel)}</button>` : ''}
  </div>`;
}
