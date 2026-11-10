import { esc, $ } from './utils.js';

/* ---------------- Theme ---------------- */
export function applyTheme(theme) {
  let value = theme;
  if (theme === 'system') {
    localStorage.removeItem('joy-theme');
    value = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } else {
    try { localStorage.setItem('joy-theme', theme); } catch (err) { /* ignore */ }
  }
  
  document.documentElement.setAttribute('data-theme', value);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = value === 'dark' ? '☀️' : '🌙';
  return value;
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/* ---------------- Toasts ---------------- */
const TOAST_ICONS = {
  success: '✅',
  error: '⛔',
  warning: '⚠️',
  info: '💡',
};

export function toast(message, type = 'info', duration = 3600) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || '💡'}</span>
    <span class="toast-message">${esc(message)}</span>
    <button type="button" class="toast-close" aria-label="بستن">✕</button>
  `;
  root.appendChild(node);

  let timer = null;
  const remove = () => {
    clearTimeout(timer);
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 260);
  };
  node.querySelector('.toast-close')?.addEventListener('click', remove);
  timer = setTimeout(remove, duration);
  return remove;
}

/* ---------------- Modal ---------------- */
const openModals = [];

export function openModal({ title = '', body = '', footer = '', size = '', onMount, onClose, dismissible = true } = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return null;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = `modal${size ? ` modal-${size}` : ''}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${esc(title)}</h3>
      <button type="button" class="modal-close" aria-label="بستن">✕</button>
    </div>
    <div class="modal-body"></div>
    ${footer ? `<div class="modal-footer"></div>` : ''}
  `;

  // Handle body as string or DOM node
  const bodyContainer = modal.querySelector('.modal-body');
  if (typeof body === 'string') {
    bodyContainer.innerHTML = body;
  } else if (body instanceof Node) {
    bodyContainer.appendChild(body);
  }

  // Handle footer as string or DOM node
  if (footer) {
    const footerContainer = modal.querySelector('.modal-footer');
    if (typeof footer === 'string') {
      footerContainer.innerHTML = footer;
    } else if (footer instanceof Node) {
      footerContainer.appendChild(footer);
    }
  }

  root.appendChild(backdrop);
  root.appendChild(modal);

  requestAnimationFrame(() => {
    backdrop.classList.add('active');
    modal.classList.add('active');
  });

  const handle = {
    el: modal,
    body: modal.querySelector('.modal-body'),
    footer: modal.querySelector('.modal-footer'),
    close,
  };

  function close(result) {
    const index = openModals.indexOf(handle);
    if (index >= 0) openModals.splice(index, 1);
    backdrop.classList.remove('active');
    modal.classList.remove('active');
    setTimeout(() => {
      backdrop.remove();
      modal.remove();
      if (typeof onClose === 'function') onClose(result);
    }, 240);
  }

  modal.querySelector('.modal-close')?.addEventListener('click', () => close(false));
  if (dismissible) {
    backdrop.addEventListener('click', () => close(false));
  }

  openModals.push(handle);
  document.addEventListener('keydown', escHandler);

  function escHandler(event) {
    if (event.key === 'Escape' && openModals[openModals.length - 1] === handle) {
      close(false);
    }
    if (openModals[openModals.length - 1] !== handle) {
      document.removeEventListener('keydown', escHandler);
    }
  }

  setTimeout(() => {
    const focusable = modal.querySelector('input, textarea, select, button:not(.modal-close)');
    focusable?.focus();
  }, 120);

  if (typeof onMount === 'function') onMount(handle);

  return handle;
}

export function confirmDialog({ title = 'تأیید', message = '', confirmText = 'بله', cancelText = 'انصراف', danger = false } = {}) {
  return new Promise((resolve) => {
    const handle = openModal({
      title,
      size: 'sm',
      body: `<p class="modal-body" style="color:var(--text-secondary)">${esc(message)}</p>`,
      footer: `
        <button type="button" class="btn btn-ghost" data-cancel>${esc(cancelText)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${esc(confirmText)}</button>
      `,
      onClose: () => resolve(false),
      onMount: (m) => {
        m.footer.querySelector('[data-cancel]').addEventListener('click', () => { resolve(false); m.close(false); });
        m.footer.querySelector('[data-confirm]').addEventListener('click', () => { resolve(true); m.close(true); });
      },
    });
    if (!handle) resolve(false);
  });
}

export function promptDialog({ title = 'ورود اطلاعات', label = '', placeholder = '', value = '', confirmText = 'ثبت', type = 'text' } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    openModal({
      title,
      size: 'sm',
      body: `
        <div class="field">
          ${label ? `<label>${esc(label)}</label>` : ''}
          <input class="input" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" data-prompt-input>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-ghost" data-cancel>انصراف</button>
        <button type="button" class="btn btn-primary" data-confirm>${esc(confirmText)}</button>
      `,
      onClose: () => { if (!settled) { settled = true; resolve(null); } },
      onMount: (m) => {
        const input = m.el.querySelector('[data-prompt-input]');
        const submit = () => {
          settled = true;
          resolve(input.value.trim());
          m.close(true);
        };
        m.footer.querySelector('[data-cancel]').addEventListener('click', () => m.close(false));
        m.footer.querySelector('[data-confirm]').addEventListener('click', submit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
        setTimeout(() => input.focus(), 100);
      },
    });
  });
}

/* ---------------- Confetti ---------------- */
const CONFETTI_COLORS = ['#f59e0b', '#f43f5e', '#8b5cf6', '#10b981', '#0ea5e9', '#fbbf24', '#fb7185'];

export function confetti(count = 60) {
  const root = document.getElementById('confetti-root');
  if (!root) return;
  const width = window.innerWidth;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const size = 6 + Math.random() * 8;
    piece.style.left = `${Math.random() * width}px`;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 0.5)}px`;
    piece.style.background = color;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    piece.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
    root.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}

/* ---------------- Buttons loading ---------------- */
export function setLoading(button, loading) {
  if (!button) return;
  button.dataset.loading = loading ? 'true' : 'false';
  button.disabled = !!loading;
}

/* ---------------- Empty state ---------------- */
export function emptyState({ emoji = '🌱', title = 'هنوز چیزی اینجا نیست', desc = '', actionLabel = '', actionView = '' } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-emoji">${esc(emoji)}</div>
      <div class="empty-title">${esc(title)}</div>
      ${desc ? `<div class="empty-desc">${esc(desc)}</div>` : ''}
      ${actionLabel ? `<button type="button" class="btn btn-primary" data-goto="${esc(actionView)}">${esc(actionLabel)}</button>` : ''}
    </div>
  `;
}

/* ---------------- Skeleton ---------------- */
export function skeletonList(count = 3) {
  return Array.from({ length: count }).map(() => `
    <div class="card" style="display:flex;gap:1rem;align-items:center">
      <div class="skeleton" style="width:48px;height:48px;border-radius:12px"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:.5rem">
        <div class="skeleton" style="height:14px;width:45%"></div>
        <div class="skeleton" style="height:12px;width:75%"></div>
      </div>
    </div>
  `).join('');
}

export function closeAllModals() {
  [...openModals].reverse().forEach((m) => m.close(false));
}

export { $ };
