import { icon } from '../lib/icons.js';
import { escapeHtml } from '../lib/utils.js';

const overlayRoot = () => document.getElementById('overlay-root');

let activeScrim = null;
let activeMenu = null;

export function openModal({
  title = '',
  subtitle = '',
  iconName = 'spark',
  body = '',
  footer = '',
  tabs = null,
  className = '',
  onClose = null,
  closable = true,
} = {}) {
  closeModal();
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.dataset.overlay = 'modal';

  const tabMarkup = Array.isArray(tabs)
    ? `<nav class="modal-tabs">${tabs
        .map(
          (tabName) =>
            `<button type="button" class="modal-tab" data-modal-tab="${escapeHtml(tabName)}">${escapeHtml(tabName)}</button>`,
        )
        .join('')}</nav>`
    : '';

  scrim.innerHTML = `
    <div class="modal ${className}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <header class="modal-head">
        <div>
          <h2>${icon(iconName)} ${escapeHtml(title)}</h2>
          ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        ${closable ? `<button type="button" class="icon-btn" data-overlay-close aria-label="Close">${icon('x')}</button>` : ''}
      </header>
      ${tabMarkup}
      <div class="modal-body" data-modal-body></div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;

  const bodyEl = scrim.querySelector('[data-modal-body]');
  if (body instanceof Node) bodyEl.appendChild(body);
  else bodyEl.innerHTML = body;

  scrim.addEventListener('mousedown', (event) => {
    if (event.target === scrim && closable) closeModal();
  });
  scrim.querySelector('[data-overlay-close]')?.addEventListener('click', () => closeModal());

  overlayRoot().appendChild(scrim);
  activeScrim = scrim;
  onClose && (scrim._onClose = onClose);

  return {
    scrim,
    bodyEl,
    close: closeModal,
    setTitle(text) {
      const h2 = scrim.querySelector('.modal-head h2');
      if (h2) h2.innerHTML = `${icon(iconName)} ${escapeHtml(text)}`;
    },
    setBody(html) {
      if (html instanceof Node) {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(html);
      } else bodyEl.innerHTML = html;
    },
    setFooter(html) {
      let foot = scrim.querySelector('.modal-foot');
      if (!foot) {
        foot = document.createElement('footer');
        foot.className = 'modal-foot';
        scrim.querySelector('.modal').appendChild(foot);
      }
      foot.innerHTML = html;
    },
  };
}

export function closeModal() {
  if (!activeScrim) return;
  const scrim = activeScrim;
  activeScrim = null;
  const cb = scrim._onClose;
  scrim.remove();
  cb && cb();
}

export function hasModal() {
  return Boolean(activeScrim);
}

/* --------------------------------- menus --------------------------------- */

export function closeMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('resize', closeMenu);
    window.removeEventListener('scroll', closeMenu, true);
  }
}

function onOutside(event) {
  if (activeMenu && !activeMenu.contains(event.target)) closeMenu();
}

export function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.dataset.overlay = 'menu';
  menu.innerHTML = items
    .map((item) => {
      if (!item || item === 'sep') return '<div class="menu-sep"></div>';
      return `<button type="button" class="menu-item ${item.danger ? 'danger' : ''}" data-menu-key="${escapeHtml(
        item.key || item.label,
      )}">${item.icon ? icon(item.icon) : ''}<span>${escapeHtml(item.label)}</span>${
        item.hint ? `<span class="kbd-hint">${escapeHtml(item.hint)}</span>` : ''
      }</button>`;
    })
    .join('');

  menu.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-menu-key]');
    if (!btn) return;
    const item = items.find((i) => i && i !== 'sep' && (i.key || i.label) === btn.dataset.menuKey);
    closeMenu();
    if (item && item.onClick) item.onClick();
  });

  overlayRoot().appendChild(menu);
  activeMenu = menu;

  const rect = typeof anchor === 'object' && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const menuRect = menu.getBoundingClientRect();
  const pad = 8;
  let left = rect.right - menuRect.width;
  let top = rect.bottom + 6;
  if (left < pad) left = pad;
  if (left + menuRect.width > window.innerWidth - pad) left = window.innerWidth - menuRect.width - pad;
  if (top + menuRect.height > window.innerHeight - pad) top = Math.max(pad, rect.top - menuRect.height - 6);
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;

  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
  return menu;
}

/* -------------------------------- confirm -------------------------------- */

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  details = '',
} = {}) {
  return new Promise((resolve) => {
    const scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.style.zIndex = '260';
    scrim.innerHTML = `
      <div class="modal narrow" role="dialog" aria-modal="true">
        <header class="modal-head">
          <div><h2>${icon(danger ? 'alert' : 'info')} ${escapeHtml(title)}</h2></div>
        </header>
        <div class="modal-body">
          <p style="font-size:.87rem;line-height:1.65;color:var(--text-soft)">${escapeHtml(message)}</p>
          ${details ? `<div class="inspector-note" style="margin:12px 0 0">${escapeHtml(details)}</div>` : ''}
        </div>
        <footer class="modal-foot">
          <div class="spacer"></div>
          <button type="button" class="btn" data-confirm-cancel>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm-ok>${escapeHtml(
            confirmLabel,
          )}</button>
        </footer>
      </div>`;

    const done = (value) => {
      scrim.remove();
      resolve(value);
    };
    scrim.querySelector('[data-confirm-cancel]').addEventListener('click', () => done(false));
    scrim.querySelector('[data-confirm-ok]').addEventListener('click', () => done(true));
    scrim.addEventListener('mousedown', (e) => {
      if (e.target === scrim) done(false);
    });
    overlayRoot().appendChild(scrim);
    scrim.querySelector('[data-confirm-ok]').focus();
  });
}

export function closeAllOverlays() {
  closeMenu();
  closeModal();
  document.querySelectorAll('[data-confirm-scrim]').forEach((el) => el.remove());
}
