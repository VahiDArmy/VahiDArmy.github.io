/**
 * DOM helpers — tiny, dependency-free, RTL-aware.
 */

/* ---------- Selection -------------------------------------------------- */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

/* ---------- Creation --------------------------------------------------- */
/**
 * createElement("div.card#id", { attrs }, ...children)
 * Tag string supports: tag, .class, .class2, #id
 */
export function createElement(tag, attrs = {}, ...children) {
  let name = "div";
  const classes = [];
  let id = null;

  // Split "div.card.foo#id"
  const parts = String(tag).split(/(?=[.#])/);
  parts.forEach((part) => {
    if (part.startsWith(".")) classes.push(part.slice(1));
    else if (part.startsWith("#")) id = part.slice(1);
    else name = part;
  });

  const el = document.createElement(name);
  if (classes.length) el.classList.add(...classes);
  if (id) el.id = id;

  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") {
      String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
    } else if (k === "style" && typeof v === "object") {
      Object.assign(el.style, v);
    } else if (k === "dataset" && typeof v === "object") {
      Object.entries(v).forEach(([dk, dv]) => (el.dataset[dk] = dv));
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "html") {
      el.innerHTML = v;
    } else if (k === "text") {
      el.textContent = v;
    } else if (v === true) {
      el.setAttribute(k, "");
    } else {
      el.setAttribute(k, v);
    }
  }

  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  children.flat(Infinity).forEach((child) => {
    if (child == null || child === false) return;
    if (typeof child === "string" || typeof child === "number") {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  });
}

/* ---------- Mutation --------------------------------------------------- */
export function setHTML(el, html) {
  if (!el) return;
  el.innerHTML = html;
  return el;
}

export function setText(el, text) {
  if (!el) return;
  el.textContent = text == null ? "" : String(text);
  return el;
}

export function clear(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function append(parent, ...children) {
  appendChildren(parent, children);
  return parent;
}

export function remove(el) {
  el?.parentNode?.removeChild(el);
}

export function show(el, display = "") {
  if (!el) return;
  el.hidden = false;
  el.style.display = display;
}

export function hide(el) {
  if (!el) return;
  el.hidden = true;
  el.style.display = "none";
}

/* ---------- Classes ---------------------------------------------------- */
export const addClass = (el, ...c) => el?.classList.add(...c);
export const removeClass = (el, ...c) => el?.classList.remove(...c);
export const toggleClass = (el, c, force) => el?.classList.toggle(c, force);
export const hasClass = (el, c) => !!el?.classList.contains(c);

/* ---------- Delegation ------------------------------------------------- */
export function delegate(root, event, selector, handler) {
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, listener);
  return () => root.removeEventListener(event, listener);
}

/* ---------- Focus / scroll --------------------------------------------- */
export function focusFirst(container) {
  const focusable = container?.querySelector(
    'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])'
  );
  focusable?.focus();
}

export function scrollIntoView(el, opts = { behavior: "smooth", block: "nearest" }) {
  el?.scrollIntoView(opts);
}

/* ---------- Attributes ------------------------------------------------ */
export function setAttr(el, name, value) {
  if (!el) return;
  if (value == null || value === false) el.removeAttribute(name);
  else el.setAttribute(name, value === true ? "" : value);
}

export function getAttr(el, name, fallback = null) {
  return el?.getAttribute(name) ?? fallback;
}

/* ---------- Traversal -------------------------------------------------- */
export function closest(el, selector) {
  return el?.closest(selector) ?? null;
}

export function findAll(el, selector) {
  return $$(selector, el);
}

/* ---------- Document helpers ------------------------------------------- */
export const onReady = (fn) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
};

export const isRTL = () =>
  document.documentElement.getAttribute("dir") === "rtl";