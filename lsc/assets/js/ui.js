/* ============================================================
   THEORIES STUDIO — UI primitives (toast, modal, drawer, confirm,
   command palette, lightbox, loading bar)
   ============================================================ */
import { $, el, escapeHtml, uid } from './utils.js';

/* ---------- Global loading bar ---------- */
let loadingCount = 0;
let loadingBar = null;

export const showLoading = () => {
  loadingCount++;
  if (!loadingBar) loadingBar = document.getElementById('global-loading');
  if (loadingBar) loadingBar.hidden = false;
};
export const hideLoading = () => {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0 && loadingBar) loadingBar.hidden = true;
};

/* ---------- Toast ---------- */
const TOAST_ICONS = {
  success: 'ri-checkbox-circle-line',
  error: 'ri-error-warning-line',
  warning: 'ri-alert-line',
  info: 'ri-information-line',
  default: 'ri-notification-3-line'
};

export const toast = (opts = {}) => {
  const {
    title, message = '', type = 'default', duration = 3600, closable = true
  } = typeof opts === 'string' ? { title: opts } : opts;
  const root = document.getElementById('toast-root');
  if (!root) return () => {};
  const id = uid('toast');
  const elT = document.createElement('div');
  elT.className = `toast toast--${type}`;
  elT.dataset.toastId = id;
  elT.style.position = 'relative';
  elT.innerHTML = `
    <span class="toast__icon"><i class="${TOAST_ICONS[type] || TOAST_ICONS.default}"></i></span>
    <div class="toast__body">
      <div class="toast__title">${escapeHtml(title || '')}</div>
      ${message ? `<div class="toast__msg">${escapeHtml(message)}</div>` : ''}
    </div>
    ${closable ? `<button type="button" class="toast__close" aria-label="بستن"><i class="ri-close-line"></i></button>` : ''}
    ${duration > 0 ? `<span class="toast__progress" style="animation-duration:${duration}ms;"></span>` : ''}
  `;
  root.appendChild(elT);
  let timer = null;
  const close = () => {
    if (!elT.isConnected) return;
    elT.classList.add('is-leaving');
    setTimeout(() => elT.remove(), 220);
    clearTimeout(timer);
  };
  elT.querySelector('.toast__close')?.addEventListener('click', close);
  if (duration > 0) timer = setTimeout(close, duration);
  return close;
};

export const toastSuccess = (t, m, d) => toast({ title: t, message: m, type: 'success', duration: d ?? 3200 });
export const toastError = (t, m, d) => toast({ title: t, message: m, type: 'error', duration: d ?? 4800 });
export const toastWarning = (t, m, d) => toast({ title: t, message: m, type: 'warning', duration: d ?? 4200 });
export const toastInfo = (t, m, d) => toast({ title: t, message: m, type: 'info', duration: d ?? 3600 });

/* ---------- Modal ---------- */
const openModals = new Set();

export const openModal = ({
  title, subtitle, body, footer, size = 'md', onClose, closeOnBackdrop = true, id
}) => {
  const root = document.getElementById('modal-root');
  if (!root) return { close: () => {} };
  const modalId = id || uid('modal');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = `modal modal--${size}`;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (title) modal.setAttribute('aria-label', String(title));
  modal.innerHTML = `
    <div class="modal__header">
      <div>
        ${title ? `<div class="modal__title">${escapeHtml(title)}</div>` : ''}
        ${subtitle ? `<div class="modal__subtitle">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <button type="button" class="icon-btn modal__close" aria-label="بستن"><i class="ri-close-line"></i></button>
    </div>
    <div class="modal__body"></div>
    ${footer ? '<div class="modal__footer"></div>' : ''}
  `;
  const bodyEl = modal.querySelector('.modal__body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  const footerEl = modal.querySelector('.modal__footer');
  if (footerEl && footer) {
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) footerEl.appendChild(footer);
  }

  root.appendChild(backdrop);
  root.appendChild(modal);
  root.classList.add('is-open');

  const close = () => {
    if (!root.contains(modal)) return;
    modal.style.animation = 'fade-out 150ms var(--ease-out) forwards';
    backdrop.style.animation = 'fade-out 150ms var(--ease-out) forwards';
    setTimeout(() => {
      modal.remove();
      backdrop.remove();
      if (!root.children.length) root.classList.remove('is-open');
      openModals.delete(modalId);
      if (typeof onClose === 'function') onClose();
    }, 160);
  };

  modal.querySelector('.modal__close')?.addEventListener('click', close);
  if (closeOnBackdrop) backdrop.addEventListener('click', close);
  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);

  const handle = {
    id: modalId,
    el: modal,
    body: bodyEl,
    footer: footerEl,
    close,
    setBody: (n) => {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(n instanceof Node ? n : document.createTextNode(String(n)));
    }
  };
  openModals.add(modalId);
  setTimeout(() => modal.querySelector('input, textarea, button:not(.modal__close)')?.focus?.(), 80);
  return handle;
};

export const closeAllModals = () => {
  document.querySelectorAll('#modal-root .modal__close').forEach(b => b.click());
};

/* ---------- Drawer ---------- */
export const openDrawer = ({ title, body, footer, side = 'end', onClose, width }) => {
  const root = document.getElementById('drawer-root');
  if (!root) return { close: () => {} };
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  const drawer = document.createElement('aside');
  drawer.className = `drawer drawer--${side}`;
  if (width) drawer.style.width = width;
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.innerHTML = `
    <div class="drawer__header">
      <div class="drawer__title">${escapeHtml(title || '')}</div>
      <button type="button" class="icon-btn" aria-label="بستن"><i class="ri-close-line"></i></button>
    </div>
    <div class="drawer__body"></div>
    ${footer ? '<div class="drawer__footer"></div>' : ''}
  `;
  const bodyEl = drawer.querySelector('.drawer__body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);
  const footerEl = drawer.querySelector('.drawer__footer');
  if (footerEl && footer) {
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else if (footer instanceof Node) footerEl.appendChild(footer);
  }
  root.appendChild(backdrop);
  root.appendChild(drawer);
  root.classList.add('is-open');
  const close = () => {
    backdrop.style.animation = 'fade-out 150ms var(--ease-out) forwards';
    drawer.style.animation = 'drawer-out 200ms var(--ease-out) forwards';
    setTimeout(() => {
      drawer.remove(); backdrop.remove();
      if (!root.children.length) root.classList.remove('is-open');
      if (typeof onClose === 'function') onClose();
    }, 210);
  };
  drawer.querySelector('.drawer__header .icon-btn')?.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
  return { el: drawer, body: bodyEl, footer: footerEl, close };
};

/* ---------- Confirm ---------- */
export const confirm = ({
  title = 'آیا مطمئن هستید؟',
  message = '',
  confirmText = 'تأیید',
  cancelText = 'انصراف',
  danger = false,
  icon = 'ri-question-line'
} = {}) => new Promise((resolve) => {
  const root = document.getElementById('confirm-root');
  if (!root) return resolve(false);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = `confirm${danger ? ' confirm--danger' : ''}`;
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <div class="confirm__icon"><i class="${icon}"></i></div>
    <div class="confirm__title">${escapeHtml(title)}</div>
    <div class="confirm__msg">${escapeHtml(message)}</div>
    <div class="confirm__actions">
      <button type="button" class="btn" data-act="cancel">${escapeHtml(cancelText)}</button>
      <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok">${escapeHtml(confirmText)}</button>
    </div>
  `;
  root.append(backdrop, box);
  root.classList.add('is-open');
  const finish = (v) => {
    backdrop.style.animation = 'fade-out 150ms var(--ease-out) forwards';
    box.style.animation = 'fade-out 150ms var(--ease-out) forwards';
    setTimeout(() => {
      box.remove(); backdrop.remove();
      if (!root.children.length) root.classList.remove('is-open');
      resolve(v);
    }, 160);
  };
  box.querySelector('[data-act="cancel"]').addEventListener('click', () => finish(false));
  box.querySelector('[data-act="ok"]').addEventListener('click', () => finish(true));
  backdrop.addEventListener('click', () => finish(false));
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { finish(false); document.removeEventListener('keydown', onKey); }
    if (e.key === 'Enter') { finish(true); document.removeEventListener('keydown', onKey); }
  });
  setTimeout(() => box.querySelector('[data-act="ok"]').focus(), 50);
});

/* ---------- Prompt ---------- */
export const prompt = ({
  title = 'ورودی',
  message = '',
  placeholder = '',
  defaultValue = '',
  confirmText = 'ثبت',
  cancelText = 'انصراف',
  multiline = false,
  required = true
} = {}) => new Promise((resolve) => {
  const input = multiline ? document.createElement('textarea') : document.createElement('input');
  if (multiline) {
    input.className = 'textarea';
    input.rows = 4;
  } else {
    input.className = 'input';
    input.type = 'text';
  }
  input.placeholder = placeholder;
  input.value = defaultValue;
  input.style.width = '100%';
  const wrap = el('div', { class: 'field' });
  if (message) {
    const hint = el('div', { class: 'field__hint' });
    hint.textContent = message;
    wrap.appendChild(hint);
  }
  wrap.appendChild(input);
  const footer = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;' });
  let settled = false;
  const finish = (v) => { if (settled) return; settled = true; resolve(v); modal.close(); };
  const cancelBtn = el('button', { type: 'button', class: 'btn' }, cancelText);
  const okBtn = el('button', { type: 'button', class: 'btn btn--primary' }, confirmText);
  cancelBtn.addEventListener('click', () => finish(null));
  okBtn.addEventListener('click', () => {
    const v = input.value.trim();
    if (required && !v) { input.focus(); input.classList.add('input--error'); setTimeout(() => input.classList.remove('input--error'), 900); return; }
    finish(v);
  });
  footer.append(cancelBtn, okBtn);
  const modal = openModal({ title, body: wrap, footer, size: 'sm', onClose: () => { if (!settled) resolve(null); } });
  setTimeout(() => input.focus(), 80);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) okBtn.click(); });
});

/* ---------- Command palette ---------- */
export const openCommandPalette = (commands = []) => {
  const root = document.getElementById('command-palette-root');
  if (!root) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = 'command-palette';
  box.innerHTML = `
    <div class="command-palette__input-wrap">
      <i class="ri-search-2-line"></i>
      <input type="text" class="command-palette__input" placeholder="یک دستور یا صفحه را جستجو کنید…" />
      <span class="command-palette__esc">ESC</span>
    </div>
    <div class="command-palette__list"></div>
  `;
  root.append(backdrop, box);
  root.classList.add('is-open');
  const list = box.querySelector('.command-palette__list');
  const input = box.querySelector('.command-palette__input');
  let filtered = commands.slice();
  let active = 0;

  const renderList = () => {
    list.innerHTML = '';
    if (!filtered.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--ink-mute);font-size:var(--fs-sm);">نتیجه‌ای یافت نشد</div>`;
      return;
    }
    const groups = filtered.reduce((acc, c) => {
      const g = c.group || 'عمومی';
      (acc[g] ||= []).push(c);
      return acc;
    }, {});
    let idx = 0;
    for (const [g, items] of Object.entries(groups)) {
      const label = document.createElement('div');
      label.className = 'command-palette__group-label';
      label.textContent = g;
      list.appendChild(label);
      for (const cmd of items) {
        const i = idx++;
        const item = document.createElement('div');
        item.className = 'command-item' + (i === active ? ' is-active' : '');
        item.dataset.idx = String(i);
        item.innerHTML = `
          <span class="command-item__icon"><i class="${cmd.icon || 'ri-circle-line'}"></i></span>
          <span class="command-item__text">${escapeHtml(cmd.label)}</span>
          ${cmd.hint ? `<span class="command-item__hint">${escapeHtml(cmd.hint)}</span>` : ''}
        `;
        item.addEventListener('click', () => { close(); cmd.run(); });
        list.appendChild(item);
      }
    }
  };

  const close = () => {
    backdrop.style.animation = 'fade-out 120ms var(--ease-out) forwards';
    box.style.animation = 'fade-out 120ms var(--ease-out) forwards';
    setTimeout(() => {
      box.remove(); backdrop.remove();
      if (!root.children.length) root.classList.remove('is-open');
    }, 130);
  };

  const normalize = (s) => String(s || '').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  const filter = () => {
    const q = normalize(input.value.trim());
    filtered = !q ? commands.slice() : commands.filter(c =>
      normalize(c.label).includes(q) || normalize(c.group || '').includes(q) || normalize(c.keywords || '').includes(q)
    );
    active = 0;
    renderList();
  };

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); close(); }
    else if (e.key === 'Escape') { close(); }
  });
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  });
  filter();
  setTimeout(() => input.focus(), 50);
};

/* ---------- Lightbox ---------- */
export const openLightbox = (src, caption = '') => {
  if (!src) return;
  const box = document.createElement('div');
  box.className = 'lightbox is-open';
  box.innerHTML = `
    <button class="icon-btn lightbox__close" aria-label="بستن"><i class="ri-close-line"></i></button>
    <img class="lightbox__img" src="${escapeHtml(src)}" alt="${escapeHtml(caption || '')}" />
    ${caption ? `<div class="lightbox__caption">${escapeHtml(caption)}</div>` : ''}
  `;
  document.body.appendChild(box);
  const close = () => {
    box.style.animation = 'fade-out 160ms var(--ease-out) forwards';
    setTimeout(() => box.remove(), 170);
  };
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } });
};

/* ---------- Confetti ---------- */
export const confetti = (count = 80) => {
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  const colors = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = Math.random() * 0.6 + 's';
    p.style.animationDuration = 2 + Math.random() * 1.6 + 's';
    p.style.width = 6 + Math.random() * 6 + 'px';
    p.style.height = 10 + Math.random() * 10 + 'px';
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4200);
};

/* ---------- Dropdown ---------- */
export const attachDropdown = (trigger, menu) => {
  let open = false;
  const close = () => {
    if (!open) return;
    open = false;
    menu.remove();
    document.removeEventListener('click', onDocClick, true);
  };
  const onDocClick = (e) => {
    if (!menu.contains(e.target) && !trigger.contains(e.target)) close();
  };
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) return close();
    trigger.parentElement.appendChild(menu);
    open = true;
    setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
  });
  return { close };
};

/* ---------- Copy to clipboard toast ---------- */
export const copyWithToast = async (text, message = 'کپی شد') => {
  const { copyText } = await import('./utils.js');
  const ok = await copyText(text);
  if (ok) toastSuccess(message);
  else toastError('کپی ناموفق بود');
  return ok;
};

/* ---------- Helpers for empty states ---------- */
export const emptyState = ({ title, desc, actions = [], art = null }) => {
  const wrap = document.createElement('div');
  wrap.className = 'empty-state';
  wrap.innerHTML = `
    <div class="empty-state__art">${art || `
      <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="34" width="140" height="96" rx="14" stroke="currentColor" stroke-width="2" stroke-dasharray="6 6" opacity=".45"/>
        <circle cx="100" cy="76" r="22" stroke="currentColor" stroke-width="2" opacity=".7"/>
        <path d="M100 64v24M88 76h24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      </svg>`}
    </div>
    <h3 class="empty-state__title">${escapeHtml(title || '')}</h3>
    <p class="empty-state__desc">${escapeHtml(desc || '')}</p>
    <div class="empty-state__actions"></div>
  `;
  const actionWrap = wrap.querySelector('.empty-state__actions');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${a.primary ? 'btn--primary' : ''}`;
    btn.innerHTML = `${a.icon ? `<i class="${a.icon}"></i>` : ''}${escapeHtml(a.label)}`;
    btn.addEventListener('click', a.onClick || (() => {}));
    actionWrap.appendChild(btn);
  });
  return wrap;
};

/* ---------- Skeleton helpers ---------- */
export const skeletonCards = (n = 6) => {
  const grid = document.createElement('div');
  grid.className = 'theory-grid';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'skeleton-card';
    c.innerHTML = `
      <div class="skeleton skeleton-card__thumb"></div>
      <div class="skeleton-card__lines">
        <div class="skeleton skeleton--title"></div>
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text" style="width:80%"></div>
      </div>
    `;
    grid.appendChild(c);
  }
  return grid;
};
