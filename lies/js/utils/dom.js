/* ============================================================
   js/utils/dom.js
   Tiny DOM toolkit — query, create, events, class helpers
   FIXED:
     - `el()` now accepts BOTH forms:
         el('div', { class: 'x', children: [...] })
         el('div', { class: 'x' }, { children: [...] })
       Previously the 3rd argument was silently ignored, which
       caused many components (toast, modal, etc.) to render
       without their text/children.
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
 * Create an element.
 *
 * Usage examples (ALL supported):
 *   el('div')
 *   el('div', { class: 'x' })
 *   el('div', { class: 'x', children: ['hello'] })
 *   el('div', { class: 'x' }, { children: ['hello'] })   ← 3-arg form
 *
 * @param {string} tag
 * @param {Object} [opts]
 * @param {Object} [extra]  - optional 3rd arg; merged into opts
 * @returns {HTMLElement}
 */
export function el(tag, opts = {}, extra = {}) {
  const node = document.createElement(tag);

  // Merge any 3rd-argument props (e.g. { children })
  const merged = { ...opts };
  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra)) {
      if (merged[k] === undefined) merged[k] = v;
    }
  }

  if (merged.class) {
    const list = Array.isArray(merged.class)
      ? merged.class
      : String(merged.class).split(/\s+/);
    list.filter(Boolean).forEach((c) => node.classList.add(c));
  }

  if (merged.attrs) {
    for (const [k, v] of Object.entries(merged.attrs)) {
      if (v === null || v === undefined || v === false) continue;
      try { node.setAttribute(k, v === true ? '' : String(v)); } catch { /* noop */ }
    }
  }

  if (merged.dataset) {
    for (const [k, v] of Object.entries(merged.dataset)) {
      if (v === null || v === undefined) continue;
      node.dataset[k] = String(v);
    }
  }

  if (merged.style) {
    for (const [k, v] of Object.entries(merged.style)) {
      if (k.startsWith('--')) node.style.setProperty(k, v);
      else node.style[k] = v;
    }
  }

  if (merged.props) {
    for (const [k, v] of Object.entries(merged.props)) {
      try { node[k] = v; } catch { /* noop */ }
    }
  }

  if (merged.on) {
    for (const [evt, handler] of Object.entries(merged.on)) {
      if (typeof handler === 'function') node.addEventListener(evt, handler);
    }
  }

  // Children can be either `opts.children` or `extra.children`
  const children = merged.children;
  if (children !== undefined && children !== null) {
    append(node, children);
  }

  return node;
}

/**
 * Create an SVG element (namespace-aware).
 * @param {string} tag
 * @param {Object} [attrs]
 * @param {Object} [extra] - optional 3rd arg; supports { children }
 * @returns {SVGElement}
 */
export function svg(tag, attrs = {}, extra = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    try { node.setAttribute(k, String(v)); } catch { /* noop */ }
  }
  const children = extra?.children;
  if (children !== undefined && children !== null) {
    append(node, children);
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
  t.innerHTML = String(html || '').trim();
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
    try {
      parent.appendChild(
        child instanceof Node ? child : document.createTextNode(String(child))
      );
    } catch (err) {
      console.warn('[dom] append failed', err, child);
    }
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
  if (!node) return;
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
  const ev = new CustomEvent(type, {
    detail,
    bubbles: opts.bubbles ?? true,
    cancelable: opts.cancelable ?? true,
  });
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
    const handler = (ev) => { cleanup(); resolve(ev); };
    const timer = opts.timeout
      ? setTimeout(() => { cleanup(); reject(new Error(`Timeout waiting for "${type}"`)); }, opts.timeout)
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

export function scrollTo(node, opts = { behavior: 'smooth', block: 'center' }) {
  node?.scrollIntoView(opts);
}

export function rect(node) {
  return node.getBoundingClientRect();
}

export function inViewport(node, threshold = 0) {
  const r = rect(node);
  return (
    r.top >= -threshold &&
    r.left >= -threshold &&
    r.bottom <= (window.innerHeight || document.documentElement.clientHeight) + threshold &&
    r.right <= (window.innerWidth || document.documentElement.clientWidth) + threshold
  );
}

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