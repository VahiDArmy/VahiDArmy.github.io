/**
 * Tiny DOM toolkit — all UI code should use these helpers
 * instead of sprinkling raw DOM access across the app.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Create an element with attributes, dataset and children.
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {(Node|string|Array<Node|string>)[]} [children]
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;

    if (key === 'class' || key === 'className') {
      node.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key === 'on' && typeof value === 'object') {
      for (const [evt, fn] of Object.entries(value)) {
        node.addEventListener(evt, fn);
      }
    } else if (key in node && typeof value !== 'string') {
      try { node[key] = value; } catch { node.setAttribute(key, String(value)); }
    } else {
      node.setAttribute(key, String(value));
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Safely empty a node. */
export function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Replace children of a container with new content (nodes or array). */
export function render(container, content) {
  clear(container);
  if (content == null) return;
  const list = Array.isArray(content) ? content : [content];
  for (const child of list) {
    if (child == null) continue;
    container.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Escape user-provided strings for safe HTML injection. */
export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Toggle a class. */
export function toggleClass(node, className, force) {
  if (!node) return;
  node.classList.toggle(className, force);
}

/** Attach an event and return a detach function (for cleanup). */
export function on(target, type, listener, options) {
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

/** Delegated event listener. */
export function delegate(root, selector, type, handler) {
  const wrapped = (e) => {
    const match = e.target.closest(selector);
    if (match && root.contains(match)) handler(e, match);
  };
  root.addEventListener(type, wrapped);
  return () => root.removeEventListener(type, wrapped);
}

/** Lock/unlock body scroll (modals, drawers). */
let lockCount = 0;
export function lockBodyScroll() {
  lockCount += 1;
  if (lockCount === 1) document.body.style.overflow = 'hidden';
}
export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
}

/** Trap focus inside a container (for modals). */
export function trapFocus(container) {
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return () => {};
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  const handle = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', handle);
  return () => container.removeEventListener('keydown', handle);
}

/** Build a fragment from an array of nodes. */
export function fragment(nodes = []) {
  const f = document.createDocumentFragment();
  for (const n of nodes) if (n != null) f.appendChild(n instanceof Node ? n : document.createTextNode(String(n)));
  return f;
}

/** Inline SVG icon lookup — populated by icons.js later. */
export const icons = new Map();
export function registerIcon(name, svgString) { icons.set(name, svgString); }
export function icon(name, attrs = {}) {
  const svg = icons.get(name);
  if (!svg) return el('span', { class: 'icon icon--missing', 'aria-hidden': 'true' });
  const span = el('span', { class: 'icon', 'aria-hidden': 'true', ...attrs });
  span.innerHTML = svg;
  return span;
}