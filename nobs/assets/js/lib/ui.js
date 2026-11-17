/* ==========================================================================
   ui.js — توست، مودال، دراور، منو، تاییدیه، چسبناک‌ها
   ========================================================================== */

import { icon } from './icons.js';
import { esc, uid, nextFrame, trapFocus, focusFirst, copyText } from './utils.js';

const overlayRoot = () => document.getElementById('overlay-root') || document.body;
const toastRoot = () => document.getElementById('toast-root') || document.body;

/* -------------------------------- قفل اسکرول ----------------------------- */
let lockCount = 0;

function lockScroll() {
  lockCount += 1;
  document.body.classList.add('is-locked');
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.classList.remove('is-locked');
}

/* --------------------------------- توست --------------------------------- */
const TOAST_TYPES = {
  success: { cls: 'toast--success', icon: 'check-circle', title: 'انجام شد' },
  error: { cls: 'toast--error', icon: 'alert', title: 'خطا' },
  warn: { cls: 'toast--warn', icon: 'alert', title: 'توجه' },
  info: { cls: 'toast--info', icon: 'info', title: '' },
};

export function toast(message, { type = 'info', title = '', duration = 3800, action = null } = {}) {
  const conf = TOAST_TYPES[type] || TOAST_TYPES.info;
  const el = document.createElement('div');
  el.className = `toast ${conf.cls}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="toast__ico">${icon(conf.icon, 13)}</div>
    <div class="toast__text">
      ${title || conf.title ? `<div class="toast__title">${esc(title || conf.title)}</div>` : ''}
      <div class="${title || conf.title ? 'toast__sub' : ''}">${esc(message)}</div>
      ${action ? `<button type="button" class="btn btn--sm btn--soft u-mt-2" data-toast-action>${esc(action.label)}</button>` : ''}
    </div>
    <button type="button" class="toast__close" aria-label="بستن">${icon('x', 12)}</button>
  `;

  const close = () => {
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 180);
  };

  el.querySelector('.toast__close')?.addEventListener('click', close);
  if (action?.onClick) {
    el.querySelector('[data-toast-action]')?.addEventListener('click', () => {
      action.onClick();
      close();
    });
  }

  toastRoot().appendChild(el);
  if (duration > 0) setTimeout(close, duration);
  return { close };
}

toast.success = (message, options = {}) => toast(message, { ...options, type: 'success' });
toast.error = (message, options = {}) => toast(message, { ...options, type: 'error', duration: 5200 });
toast.warn = (message, options = {}) => toast(message, { ...options, type: 'warn' });
toast.info = (message, options = {}) => toast(message, { ...options, type: 'info' });

/* ------------------------------- پشته لایه‌ها ----------------------------- */
const layerStack = [];

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !layerStack.length) return;
  const top = layerStack[layerStack.length - 1];
  if (top && top.dismissible) {
    event.preventDefault();
    top.close();
  }
});

export function closeTopLayer() {
  const top = layerStack[layerStack.length - 1];
  if (top) top.close();
}

export function hasOpenLayer() {
  return layerStack.length > 0;
}

function pushLayer(layer) {
  layerStack.push(layer);
}

function popLayer(layer) {
  const idx = layerStack.indexOf(layer);
  if (idx >= 0) layerStack.splice(idx, 1);
}

/* -------------------------------- مودال --------------------------------- */
export function openModal(options = {}) {
  const {
    title = '',
    subtitle = '',
    body = '',
    footer = '',
    size = '',
    className = '',
    onMount = null,
    onClose = null,
    closeOnBackdrop = true,
    dismissible = true,
  } = options;

  const id = uid('modal');
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.dataset.overlay = id;
  overlay.innerHTML = `
    <div class="modal ${size ? `modal--${size}` : ''} ${className}" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
      <header class="modal__head">
        <div class="u-grow">
          <h2 class="modal__title" id="${id}-title">${esc(title)}</h2>
          ${subtitle ? `<p class="modal__sub">${esc(subtitle)}</p>` : ''}
        </div>
        ${dismissible ? `<button type="button" class="icon-btn" data-modal-close aria-label="بستن">${icon('x', 18)}</button>` : ''}
      </header>
      <div class="modal__body">${body}</div>
      ${footer ? `<footer class="modal__foot">${footer}</footer>` : ''}
    </div>
  `;

  let closed = false;
  const modal = overlay.querySelector('.modal');
  const bodyEl = overlay.querySelector('.modal__body');

  const close = () => {
    if (closed) return;
    closed = true;
    popLayer(layer);
    overlay.classList.remove('is-open');
    unlockScroll();
    setTimeout(() => {
      overlay.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
      onClose?.();
    }, 220);
  };

  const layer = { close, dismissible };
  pushLayer(layer);
  lockScroll();

  overlay.addEventListener('click', (event) => {
    if (!closeOnBackdrop) return;
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-modal-close]')?.addEventListener('click', close);

  overlayRoot().appendChild(overlay);
  const releaseTrap = trapFocus(modal);
  overlay.addEventListener('transitionend', () => {
    if (!overlay.isConnected) releaseTrap();
  });

  nextFrame(() => {
    overlay.classList.add('is-open');
    focusFirst(modal);
    onMount?.({ el: overlay, modal, bodyEl, close, setTitle, setBody, setFooter });
  });

  function setTitle(text) {
    const node = modal.querySelector('.modal__title');
    if (node) node.textContent = text;
  }

  function setBody(html) {
    bodyEl.innerHTML = html;
  }

  function setFooter(html) {
    const foot = modal.querySelector('.modal__foot');
    if (foot) foot.innerHTML = html;
  }

  return { el: overlay, modal, bodyEl, close, setTitle, setBody, setFooter };
}

/* -------------------------------- دراور --------------------------------- */
export function openDrawer(options = {}) {
  const {
    title = '',
    subtitle = '',
    body = '',
    footer = '',
    onMount = null,
    onClose = null,
    wide = false,
    closeOnBackdrop = true,
    head = '',
  } = options;

  const id = uid('drawer');
  const previousFocus = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'drawer-root';
  wrap.innerHTML = `
    <div class="drawer-overlay" data-drawer-backdrop></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="${id}-title" ${wide ? 'style="width:min(680px,100%)"' : ''}>
      <header class="drawer__head">
        <div class="u-grow" style="min-width:0">
          ${head || `<h2 class="modal__title" id="${id}-title">${esc(title)}</h2>
          ${subtitle ? `<p class="modal__sub">${esc(subtitle)}</p>` : ''}`}
        </div>
        <button type="button" class="icon-btn" data-drawer-close aria-label="بستن">${icon('x', 18)}</button>
      </header>
      <div class="drawer__body">${body}</div>
      ${footer ? `<footer class="drawer__foot">${footer}</footer>` : ''}
    </aside>
  `;

  const drawer = wrap.querySelector('.drawer');
  const overlay = wrap.querySelector('.drawer-overlay');
  const bodyEl = wrap.querySelector('.drawer__body');
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    popLayer(layer);
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    unlockScroll();
    setTimeout(() => {
      wrap.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
      onClose?.();
    }, 380);
  };

  const layer = { close, dismissible: true };
  pushLayer(layer);
  lockScroll();

  overlay.addEventListener('click', () => closeOnBackdrop && close());
  wrap.querySelector('[data-drawer-close]')?.addEventListener('click', close);

  overlayRoot().appendChild(wrap);
  trapFocus(drawer);

  nextFrame(() => {
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    onMount?.({ el: wrap, drawer, bodyEl, close, setHead, setBody, setFooter });
  });

  function setHead(html) {
    const headEl = drawer.querySelector('.drawer__head .u-grow');
    if (headEl) headEl.innerHTML = html;
  }

  function setBody(html) {
    bodyEl.innerHTML = html;
  }

  function setFooter(html) {
    const foot = drawer.querySelector('.drawer__foot');
    if (foot) foot.innerHTML = html;
  }

  return { el: wrap, drawer, bodyEl, close, setHead, setBody, setFooter };
}

/* -------------------------------- تاییدیه ------------------------------- */
export function confirmDialog({
  title = 'مطمئن هستید؟',
  message = '',
  confirmText = 'تأیید',
  cancelText = 'انصراف',
  tone = 'danger',
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    openModal({
      title,
      size: 'sm',
      body: `<p class="u-muted u-sm" style="line-height:2">${esc(message)}</p>`,
      footer: `
        <button type="button" class="btn btn--ghost" data-cancel>${esc(cancelText)}</button>
        <span class="u-grow"></span>
        <button type="button" class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" data-confirm>${esc(confirmText)}</button>
      `,
      onMount({ el, close }) {
        el.querySelector('[data-cancel]')?.addEventListener('click', close);
        el.querySelector('[data-confirm]')?.addEventListener('click', () => {
          settled = true;
          close();
          resolve(true);
        });
      },
      onClose() {
        if (!settled) resolve(false);
      },
    });
  });
}

/* ---------------------------------- منو --------------------------------- */
export function openMenu(anchor, items) {
  if (!anchor) return { close: () => {} };
  const previousFocus = anchor;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');

  const markup = items
    .map((item, index) => {
      if (!item) return '';
      if (item.sep) return '<div class="menu__sep"></div>';
      if (item.group) return `<div class="menu__group">${esc(item.group)}</div>`;
      return `
        <button type="button" role="menuitem" data-menu-index="${index}"
          class="menu__item ${item.danger ? 'is-danger' : ''} ${item.disabled ? 'is-disabled' : ''}">
          ${item.icon ? icon(item.icon, 15) : ''}
          <span class="u-truncate">${esc(item.label)}</span>
          ${item.hint ? `<span class="menu__item-hint">${esc(item.hint)}</span>` : ''}
        </button>
      `;
    })
    .join('');

  menu.innerHTML = markup;
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + 6;

  if (left + menuRect.width > window.innerWidth - 10) left = window.innerWidth - menuRect.width - 10;
  if (left < 10) left = 10;
  if (top + menuRect.height > window.innerHeight - 10) {
    top = Math.max(10, rect.top - menuRect.height - 6);
  }

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;

  const close = () => {
    if (!menu.isConnected) return;
    popLayer(layer);
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', close, true);
    menu.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  };

  const layer = { close, dismissible: true };
  pushLayer(layer);

  const onOutside = (event) => {
    if (menu.contains(event.target) || anchor.contains(event.target)) return;
    close();
  };

  menu.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-menu-index]');
    if (!btn) return;
    const item = items[Number(btn.dataset.menuIndex)];
    if (!item || item.disabled) return;
    close();
    setTimeout(() => item.onClick?.(), 0);
  });

  document.addEventListener('mousedown', onOutside, true);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, true);
  menu.querySelector('.menu__item')?.focus({ preventScroll: true });

  return { close, el: menu };
}

/* -------------------------------- کمک‌ها -------------------------------- */

export async function copyWithToast(text, label = 'متن') {
  const ok = await copyText(text);
  if (ok) toast.success(`${label} کپی شد.`);
  else toast.error('کپی انجام نشد. دستی انتخاب کنید.');
  return ok;
}

export function setBusy(button, busy = true) {
  if (!button) return;
  button.classList.toggle('is-loading', Boolean(busy));
  button.disabled = Boolean(busy);
}

export function formToObject(form) {
  const out = {};
  for (const el of Array.from(form.elements)) {
    if (!el.name) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else out[el.name] = el.value;
  }
  return out;
}

export function markInvalid(input, invalid = true) {
  if (!input) return;
  input.classList.toggle('input--invalid', invalid);
  input.classList.toggle('textarea--invalid', invalid);
  input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

export function scrollToEl(el, { behavior = 'smooth', block = 'start' } = {}) {
  if (!el) return;
  el.scrollIntoView({ behavior, block });
}

export function pageLoader(text = 'در حال بارگذاری…') {
  return `<div class="u-center u-gap-3" style="padding:56px 0;flex-direction:column">
    <div class="searchbox__spinner" style="width:22px;height:22px;border-width:3px"></div>
    <span class="u-xs u-dim">${esc(text)}</span>
  </div>`;
}
