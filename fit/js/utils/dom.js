/* ==========================================================================
   Utils — DOM helpers
   ========================================================================== */

(function (window, document) {
  'use strict';

  const App = (window.App = window.App || {});

  /**
   * Query selector — single element.
   * @param {string} selector
   * @param {Element|Document} [root]
   */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  /**
   * Query selector — all elements as array.
   */
  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /**
   * Create an element with attributes and children.
   * @param {string} tag
   * @param {Object} [attrs]  — special keys: class, style, dataset, on<Event>, html, text
   * @param {Array|Node|string} [children]
   */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const v = attrs[key];
        if (v === null || v === undefined || v === false) continue;
        if (key === 'class' || key === 'className') {
          node.className = v;
        } else if (key === 'style' && typeof v === 'object') {
          Object.assign(node.style, v);
        } else if (key === 'dataset' && typeof v === 'object') {
          Object.assign(node.dataset, v);
        } else if (key === 'html') {
          node.innerHTML = v;
        } else if (key === 'text') {
          node.textContent = v;
        } else if (key.startsWith('on') && typeof v === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), v);
        } else if (v === true) {
          node.setAttribute(key, '');
        } else {
          node.setAttribute(key, v);
        }
      }
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) return;
    if (Array.isArray(children)) {
      children.forEach((c) => appendChildren(node, c));
      return;
    }
    if (typeof children === 'string' || typeof children === 'number') {
      node.appendChild(document.createTextNode(String(children)));
      return;
    }
    if (children instanceof Node) {
      node.appendChild(children);
    }
  }

  /**
   * Set innerHTML safely — for controlled templates only.
   */
  function setHTML(node, html) {
    if (!node) return;
    node.innerHTML = html;
  }

  /**
   * Set text content.
   */
  function setText(node, text) {
    if (!node) return;
    node.textContent = text == null ? '' : String(text);
  }

  /**
   * Add classes.
   */
  function addClass(node, ...classes) {
    if (!node) return;
    node.classList.add(...classes.filter(Boolean));
  }

  /**
   * Remove classes.
   */
  function removeClass(node, ...classes) {
    if (!node) return;
    node.classList.remove(...classes.filter(Boolean));
  }

  /**
   * Toggle class.
   */
  function toggleClass(node, cls, force) {
    if (!node) return false;
    return node.classList.toggle(cls, force);
  }

  /**
   * Check if a class is present.
   */
  function hasClass(node, cls) {
    return !!node && node.classList.contains(cls);
  }

  /**
   * Show / hide via hidden attribute.
   */
  function show(node) {
    if (!node) return;
    node.hidden = false;
    node.removeAttribute('aria-hidden');
  }
  function hide(node) {
    if (!node) return;
    node.hidden = true;
    node.setAttribute('aria-hidden', 'true');
  }
  function toggleHidden(node, force) {
    if (!node) return;
    const shouldHide = typeof force === 'boolean' ? force : !node.hidden;
    if (shouldHide) hide(node);
    else show(node);
  }

  /**
   * Event delegation.
   * @param {Element} root
   * @param {string} eventName
   * @param {string} selector
   * @param {Function} handler
   */
  function delegate(root, eventName, selector, handler) {
    const listener = function (ev) {
      const target = ev.target.closest(selector);
      if (target && root.contains(target)) {
        handler.call(target, ev, target);
      }
    };
    root.addEventListener(eventName, listener);
    return () => root.removeEventListener(eventName, listener);
  }

  /**
   * Remove a node.
   */
  function remove(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  /**
   * Empty a node's children.
   */
  function empty(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /**
   * Replace a node with another.
   */
  function replace(oldNode, newNode) {
    if (oldNode && oldNode.parentNode) {
      oldNode.parentNode.replaceChild(newNode, oldNode);
    }
  }

  /**
   * Escape HTML characters — used when building strings by hand.
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get or set a CSS variable on an element.
   */
  function cssVar(node, name, value) {
    if (!node) return '';
    if (value === undefined) {
      return getComputedStyle(node).getPropertyValue(name).trim();
    }
    node.style.setProperty(name, value);
    return value;
  }

  /**
   * Focus the first visible input inside a container.
   */
  function focusFirst(container) {
    if (!container) return;
    const target = container.querySelector(
      'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
    );
    if (target) target.focus();
  }

  /**
   * True if the event target is an editable field.
   */
  function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  /**
   * Download a Blob or string as a file.
   */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 100);
  }

  App.DOM = {
    $,
    $$,
    el,
    appendChildren,
    setHTML,
    setText,
    addClass,
    removeClass,
    toggleClass,
    hasClass,
    show,
    hide,
    toggleHidden,
    delegate,
    remove,
    empty,
    replace,
    escapeHTML,
    cssVar,
    focusFirst,
    isEditableTarget,
    downloadBlob
  };

  // Also expose $ / $$ globally for brevity
  window.$ = $;
  window.$$ = $$;
})(window, document);