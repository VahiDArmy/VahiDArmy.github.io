/**
 * dom.js — ابزارهای تعامل با DOM
 * بدون وابستگی به کتابخانه خارجی
 */

/* ---------- انتخاب عناصر ---------- */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- ساخت المان ---------- */

/**
 * el('div', { class: 'x', dataset: { id: 1 } }, ['text', childEl])
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  appendChildren(node, children);
  return node;
}

export function svg(tag, attrs = {}, children = []) {
  const NS = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  appendChildren(node, children);
  return node;
}

function applyAttrs(node, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') {
      node.className = String(v).trim();
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(node.style, v);
    } else if (k === 'dataset' && typeof v === 'object') {
      for (const [dk, dv] of Object.entries(v)) {
        if (dv != null) node.dataset[dk] = String(dv);
      }
    } else if (k === 'html') {
      node.innerHTML = String(v);
    } else if (k === 'text') {
      node.textContent = String(v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'value' && 'value' in node) {
      node.value = v;
    } else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'required') {
      if (v) node.setAttribute(k, '');
      else node.removeAttribute(k);
    } else {
      node.setAttribute(k, String(v));
    }
  }
}

function appendChildren(node, children) {
  if (children == null) return;
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  }
}

/* ---------- رویدادها ---------- */

export function on(target, event, handler, opts) {
  target.addEventListener(event, handler, opts);
  return () => target.removeEventListener(event, handler, opts);
}

export function delegate(root, event, selector, handler) {
  const listener = (e) => {
    const found = e.target.closest(selector);
    if (found && root.contains(found)) handler.call(found, e, found);
  };
  root.addEventListener(event, listener);
  return () => root.removeEventListener(event, listener);
}

export function once(target, event, handler) {
  target.addEventListener(event, handler, { once: true });
}

/* ---------- کلاس‌ها ---------- */

export function addClass(node, ...names) {
  names.filter(Boolean).forEach((n) => node.classList.add(...n.split(' ')));
  return node;
}
export function removeClass(node, ...names) {
  names.filter(Boolean).forEach((n) => node.classList.remove(...n.split(' ')));
  return node;
}
export function toggleClass(node, name, force) {
  if (force === undefined) node.classList.toggle(name);
  else node.classList.toggle(name, !!force);
  return node;
}
export function hasClass(node, name) {
  return node.classList.contains(name);
}

/* ---------- مخفی/نمایان ---------- */

export function show(node) { node?.classList.remove('hidden'); node?.removeAttribute('aria-hidden'); }
export function hide(node) { node?.classList.add('hidden'); node?.setAttribute('aria-hidden', 'true'); }
export function setVisible(node, visible) { visible ? show(node) : hide(node); }

/* ---------- خالی کردن ---------- */

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ---------- امن: escapeHtml ---------- */

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}
export function escapeAttr(str) { return escapeHtml(str); }

/* ---------- Attribute helpers ---------- */

export function setAttr(node, name, value) {
  if (value == null || value === false) node.removeAttribute(name);
  else node.setAttribute(name, String(value));
  return node;
}
export function getAttr(node, name) { return node?.getAttribute?.(name); }
export function setText(node, text) { if (node) node.textContent = String(text ?? ''); }
export function setHTML(node, html) { if (node) node.innerHTML = html; }

/* ---------- Position helpers ---------- */

export function rectOf(node) {
  return node ? node.getBoundingClientRect() : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
}
export function isInViewport(node, offset = 0) {
  const r = rectOf(node);
  return r.top >= -offset && r.bottom <= window.innerHeight + offset;
}

/* ---------- Scroll locking ---------- */

let _lockCount = 0;
export function lockScroll() {
  _lockCount++;
  document.body.style.overflow = 'hidden';
  document.body.classList.add('no-scroll');
}
export function unlockScroll() {
  _lockCount = Math.max(0, _lockCount - 1);
  if (_lockCount === 0) {
    document.body.style.overflow = '';
    document.body.classList.remove('no-scroll');
  }
}

/* ---------- Focus trap ---------- */

export function trapFocus(container) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function keydown(e) {
    if (e.key !== 'Tab') return;
    const items = Array.from(container.querySelectorAll(selector)).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', keydown);
  return () => container.removeEventListener('keydown', keydown);
}

/* ---------- Wait helpers ---------- */

export const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }