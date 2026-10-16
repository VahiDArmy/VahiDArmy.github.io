/* ============================================================
   js/ui/dropdown.js
   Anchored dropdown / popover with outside-click & ESC close
   ============================================================ */

import { el, clampToViewport } from '../utils/dom.js';

/** @type {HTMLElement|null} */
let openPop = null;
let cleanup = null;

/**
 * @param {HTMLElement} anchor
 * @param {HTMLElement|((ctx:{close:()=>void})=>HTMLElement)} content
 * @param {{
 *   placement?: 'bottom-start'|'bottom-end'|'top-start'|'top-end'|'right-start'|'left-start',
 *   offset?: number,
 *   width?: 'auto'|'anchor'|number,
 *   matchAnchor?: boolean,
 *   className?: string,
 * }} [opts]
 * @returns {{close:()=>void, el:HTMLElement}}
 */
export function openDropdown(anchor, content, opts = {}) {
  closeDropdown();

  const {
    placement = 'bottom-start',
    offset = 8,
    width = 'auto',
    matchAnchor = false,
    className = '',
  } = opts;

  const pop = el('div', {
    class: ['dropdown', `dropdown--${placement}`, className].filter(Boolean),
    attrs: { role: 'dialog' },
  });

  const ctx = { close: () => closeDropdown() };

  if (typeof content === 'function') {
    const out = content(ctx);
    if (out) pop.appendChild(out);
  } else {
    pop.appendChild(content);
  }

  document.body.appendChild(pop);

  // Position
  const r = anchor.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.visibility = 'hidden';

  if (matchAnchor) {
    pop.style.width = `${r.width}px`;
  } else if (typeof width === 'number') {
    pop.style.width = `${width}px`;
  } else if (width === 'anchor') {
    pop.style.minWidth = `${r.width}px`;
  }

  const place = () => {
    const pr = pop.getBoundingClientRect();
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom-start': top = r.bottom + offset; left = r.left; break;
      case 'bottom-end':   top = r.bottom + offset; left = r.right - pr.width; break;
      case 'top-start':    top = r.top - pr.height - offset; left = r.left; break;
      case 'top-end':      top = r.top - pr.height - offset; left = r.right - pr.width; break;
      case 'right-start':  top = r.top; left = r.right + offset; break;
      case 'left-start':   top = r.top; left = r.left - pr.width - offset; break;
      default: top = r.bottom + offset; left = r.left;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left + pr.width > vw - 8) left = vw - pr.width - 8;
    if (left < 8) left = 8;
    if (top + pr.height > vh - 8) {
      // flip above
      if (placement.startsWith('bottom')) {
        top = r.top - pr.height - offset;
      } else {
        top = vh - pr.height - 8;
      }
    }
    if (top < 8) top = 8;

    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
    clampToViewport(pop);
  };

  requestAnimationFrame(() => {
    place();
    pop.style.visibility = '';
    pop.classList.add('is-open');
  });

  // Outside click / Esc
  const onDown = (ev) => {
    if (pop.contains(ev.target) || anchor.contains(ev.target)) return;
    closeDropdown();
  };
  const onKey = (ev) => { if (ev.key === 'Escape') closeDropdown(); };
  const onScroll = () => closeDropdown();
  const onResize = () => place();

  setTimeout(() => {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
  }, 0);

  cleanup = () => {
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
  };

  openPop = pop;
  return { close: closeDropdown, el: pop };
}

/**
 * Close the current dropdown.
 */
export function closeDropdown() {
  if (!openPop) return;
  cleanup?.();
  const p = openPop;
  openPop = null;
  cleanup = null;
  p.classList.remove('is-open');
  setTimeout(() => p.remove(), 140);
}

/**
 * Toggle a dropdown for a button. If it's already open, closes it.
 * @param {HTMLElement} anchor
 * @param {HTMLElement|((ctx:{close:()=>void})=>HTMLElement)} content
 * @param {object} [opts]
 */
export function toggleDropdown(anchor, content, opts = {}) {
  if (openPop && anchor.dataset.ddOpen === '1') {
    closeDropdown();
    anchor.dataset.ddOpen = '0';
    return null;
  }
  const handle = openDropdown(anchor, content, opts);
  anchor.dataset.ddOpen = '1';
  const originalClose = handle.close;
  return {
    ...handle,
    close: () => {
      anchor.dataset.ddOpen = '0';
      originalClose();
    },
  };
}

export default { openDropdown, closeDropdown, toggleDropdown };