/* ============================================================
   js/utils/dom.js
   Tiny DOM toolkit — query, create, events, class helpers
   ============================================================ */

/* ── Query ───────────────────────────────────────────────── */

/**
 * Query a single element.
 * @param {string|Element|Document} sel
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
export function $(sel, root = document) {
  if (sel instanceof Element || sel instanceof Document) return sel;
  return root.querySelector(sel);
}

/**
 * Query all elements as a real array.
 * @param {string} sel
 * @param {ParentNode} [root=document]
 * @returns {Element[]}
 */
export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

/**
 * Query by id.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function byId(id) {
  return document.getElementById(id);
}

/* ── Create ──────────────────────────────────────────────── */

/**
 * Create an element with props, attrs, dataset, styles, and children.
 * @param {string} tag
 * @param {Object} [opts]
 * @param {Object} [opts.props]   - direct property assignments
 * @param {Object} [opts.attrs]   - attributes
 * @param {Object} [opts.dataset] - data-* attributes
 * @param {Object} [opts.style]   - inline styles
 * @param {Object} [opts.class]   - class list (string | string[])
 * @param {Object} [opts.on]      - event listeners { eventName: handler }
 * @param {(Node|string)[]} [opts.children]
 * @returns {HTMLElement}
 */
export function el(tag, opts = {}) {
  const node = document.createElement(tag);

  if (opts.class) {
    const list = Array.isArray(opts.class) ? opts.class : String(opts.class).split(/\s+/);
    list.filter(Boolean).forEach((c) => node.classList.add(c));
  }

  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v === null || v === undefined || v === false) continue;
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }

  if (opts.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) {
      if (v === null || v === undefined) continue;
      node.dataset[k] = String(v);
    }
  }

  if (opts.style) {
    for (const [k, v] of Object.entries(opts.style)) {
      if (k.startsWith('--')) node.style.setProperty(k, v);
      else node.style[k] = v;
    }
  }

  if (opts.props) {
    for (const [k, v] of Object.entries(opts.props)) {
      node[k] = v;
    }
  }

  if (opts.on) {
    for (const [evt, handler] of Object.entries(opts.on)) {
      node.addEventListener(evt, handler);
    }
  }

  if (opts.children) {
    append(node, opts.children);
  }

  return node;
}

/**
 * Create an SVG element (namespace-aware).
 * @param {string} tag
 * @param {Object} [attrs]
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

/**
 * Create a DocumentFragment from an HTML string.
 * @param {string} html
 * @returns {DocumentFragment}
 */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content;
}

/* ── Append / Remove ─────────────────────────────────────── */

/**
 * Append one or many children to a parent.
 * @param {Node} parent
 * @param {Node|string|(Node|string)[]} children
 * @returns {Node} parent
 */
export function append(parent, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/**
 * Remove an element from the DOM safely.
 * @param {Node|null} node
 */
export function remove(node) {
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

/**
 * Remove all children of a node.
 * @param {Node} node
 */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Replace a node with new content.
 * @param {Node} oldNode
 * @param {Node} newNode
 */
export function replace(oldNode, newNode) {
  if (oldNode && oldNode.parentNode) oldNode.parentNode.replaceChild(newNode, oldNode);
}

/* ── Classes ─────────────────────────────────────────────── */

export function addClass(node, ...cls) { node?.classList.add(...cls.flat().filter(Boolean)); }
export function removeClass(node, ...cls) { node?.classList.remove(...cls.flat().filter(Boolean)); }
export function toggleClass(node, cls, force) {
  if (!node) return;
  if (force === undefined) node.classList.toggle(cls);
  else node.classList.toggle(cls, force);
}
export function hasClass(node, cls) { return !!node?.classList.contains(cls); }

/* ── Attributes ──────────────────────────────────────────── */

export function attr(node, name, value) {
  if (!node) return null;
  if (value === undefined) return node.getAttribute(name);
  if (value === null || value === false) node.removeAttribute(name);
  else node.setAttribute(name, value === true ? '' : String(value));
  return node;
}

export function data(node, key, value) {
  if (!node) return null;
  if (value === undefined) return node.dataset[key];
  node.dataset[key] = String(value);
  return node;
}

/* ── Styles ──────────────────────────────────────────────── */

export function css(node, prop, value) {
  if (!node) return null;
  if (typeof prop === 'object') {
    for (const [k, v] of Object.entries(prop)) {
      if (k.startsWith('--')) node.style.setProperty(k, v);
      else node.style[k] = v;
    }
    return node;
  }
  if (value === undefined) return getComputedStyle(node)[prop];
  node.style[prop] = value;
  return node;
}

export function show(node, display = '') {
  if (!node) return;
  node.hidden = false;
  node.style.display = display;
}
export function hide(node) {
  if (!node) return;
  node.hidden = true;
}

/* ── Events ──────────────────────────────────────────────── */

/**
 * Add an event listener; returns an unsubscribe function.
 * @param {EventTarget} target
 * @param {string} type
 * @param {Function} handler
 * @param {boolean|AddEventListenerOptions} [opts]
 * @returns {() => void}
 */
export function on(target, type, handler, opts) {
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
}

/**
 * Delegated event listener.
 * @param {EventTarget} root
 * @param {string} type
 * @param {string} selector
 * @param {(this: Element, ev: Event, matched: Element) => void} handler
 * @returns {() => void}
 */
export function delegate(root, type, selector, handler) {
  const listener = (ev) => {
    const matched = ev.target instanceof Element ? ev.target.closest(selector) : null;
    if (matched && root.contains(matched)) handler.call(matched, ev, matched);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

/**
 * Fire a custom event.
 * @param {EventTarget} target
 * @param {string} type
 * @param {any} [detail]
 * @param {{bubbles?:boolean, cancelable?:boolean}} [opts]
 */
export function emit(target, type, detail, opts = {}) {
  const ev = new CustomEvent(type, { detail, bubbles: opts.bubbles ?? true, cancelable: opts.cancelable ?? true });
  target.dispatchEvent(ev);
  return ev;
}

/**
 * Wait for an event once.
 * @param {EventTarget} target
 * @param {string} type
 * @param {{timeout?:number}} [opts]
 * @returns {Promise<Event>}
 */
export function once(target, type, opts = {}) {
  return new Promise((resolve, reject) => {
    const handler = (ev) => {
      cleanup();
      resolve(ev);
    };
    const timer = opts.timeout
      ? setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for "${type}"`));
        }, opts.timeout)
      : null;
    const cleanup = () => {
      target.removeEventListener(type, handler);
      if (timer) clearTimeout(timer);
    };
    target.addEventListener(type, handler, { once: true });
  });
}

/* ── Ready ───────────────────────────────────────────────── */

/**
 * Run a callback when DOM is ready.
 * @param {() => void} fn
 */
export function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

/* ── Focus trap helper ───────────────────────────────────── */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

/**
 * Get focusable elements inside a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
export function focusables(container) {
  return $$(FOCUSABLE, container).filter(
    (n) => !n.hasAttribute('hidden') && n.offsetParent !== null
  );
}

/**
 * Trap focus inside a container.
 * @param {HTMLElement} container
 * @returns {() => void} release
 */
export function trapFocus(container) {
  const previouslyFocused = document.activeElement;
  const first = () => focusables(container)[0];
  const last = () => {
    const list = focusables(container);
    return list[list.length - 1];
  };

  const onKeydown = (ev) => {
    if (ev.key !== 'Tab') return;
    const list = focusables(container);
    if (!list.length) { ev.preventDefault(); return; }
    const firstEl = list[0];
    const lastEl = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === firstEl) {
      ev.preventDefault();
      lastEl.focus();
    } else if (!ev.shiftKey && document.activeElement === lastEl) {
      ev.preventDefault();
      firstEl.focus();
    }
  };

  container.addEventListener('keydown', onKeydown);
  // Focus first available element after paint
  requestAnimationFrame(() => {
    const f = first();
    if (f) f.focus();
  });

  return () => {
    container.removeEventListener('keydown', onKeydown);
    if (previouslyFocused && previouslyFocused.focus) {
      try { previouslyFocused.focus(); } catch { /* noop */ }
    }
  };
}

/* ── Misc ────────────────────────────────────────────────── */

/**
 * Scroll an element into view smoothly.
 * @param {Element} node
 * @param {ScrollIntoViewOptions} [opts]
 */
export function scrollTo(node, opts = { behavior: 'smooth', block: 'center' }) {
  node?.scrollIntoView(opts);
}

/**
 * Measure an element's rect.
 * @param {Element} node
 * @returns {DOMRect}
 */
export function rect(node) {
  return node.getBoundingClientRect();
}

/**
 * Check if an element is in the viewport.
 * @param {Element} node
 * @param {number} [threshold=0]
 * @returns {boolean}
 */
export function inViewport(node, threshold = 0) {
  const r = rect(node);
  return (
    r.top >= -threshold &&
    r.left >= -threshold &&
    r.bottom <= (window.innerHeight || document.documentElement.clientHeight) + threshold &&
    r.right <= (window.innerWidth || document.documentElement.clientWidth) + threshold
  );
}

/**
 * Clamp an element within the viewport (for popovers/menus).
 * @param {HTMLElement} node
 * @param {number} [pad=8]
 */
export function clampToViewport(node, pad = 8) {
  const r = rect(node);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let dx = 0, dy = 0;
  if (r.right > vw - pad) dx = vw - pad - r.right;
  if (r.left < pad) dx = pad - r.left;
  if (r.bottom > vh - pad) dy = vh - pad - r.bottom;
  if (r.top < pad) dy = pad - r.top;
  if (dx || dy) {
    node.style.transform = `translate(${dx}px, ${dy}px)`;
  }
}