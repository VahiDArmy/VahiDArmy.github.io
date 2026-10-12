/* ============================================================================
   DOM UTILITIES
   ============================================================================ */

(function (window) {
  "use strict";

  const Dom = {
    /* ---------- Query ---------- */
    q(selector, ctx) {
      return (ctx || document).querySelector(selector);
    },

    qa(selector, ctx) {
      return Array.from((ctx || document).querySelectorAll(selector));
    },

    id(id) {
      return document.getElementById(id);
    },

    /* ---------- Create ---------- */
    el(tag, attrs, children) {
      const node = document.createElement(tag);
      if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
          if (value == null || value === false) return;
          if (key === "class" || key === "className") {
            node.className = value;
          } else if (key === "style" && typeof value === "object") {
            Object.assign(node.style, value);
          } else if (key === "dataset" && typeof value === "object") {
            Object.assign(node.dataset, value);
          } else if (key === "html") {
            node.innerHTML = value;
          } else if (key.startsWith("on") && typeof value === "function") {
            node.addEventListener(key.slice(2).toLowerCase(), value);
          } else if (value === true) {
            node.setAttribute(key, "");
          } else {
            node.setAttribute(key, value);
          }
        });
      }
      if (children != null) {
        (Array.isArray(children) ? children : [children]).forEach((child) => {
          if (child == null || child === false) return;
          node.appendChild(
            typeof child === "string" || typeof child === "number"
              ? document.createTextNode(String(child))
              : child
          );
        });
      }
      return node;
    },

    /* ---------- Classes ---------- */
    addClass(node, ...classes) {
      if (!node) return;
      node.classList.add(...classes.filter(Boolean));
    },

    removeClass(node, ...classes) {
      if (!node) return;
      node.classList.remove(...classes.filter(Boolean));
    },

    toggleClass(node, className, force) {
      if (!node) return;
      return node.classList.toggle(className, force);
    },

    hasClass(node, className) {
      return node ? node.classList.contains(className) : false;
    },

    /* ---------- Attributes ---------- */
    attr(node, name, value) {
      if (!node) return null;
      if (value === undefined) return node.getAttribute(name);
      if (value === null || value === false) node.removeAttribute(name);
      else node.setAttribute(name, value);
      return node;
    },

    data(node, key, value) {
      if (!node) return null;
      if (value === undefined) return node.dataset[key];
      node.dataset[key] = value;
      return node;
    },

    /* ---------- Show / hide ---------- */
    show(node, display) {
      if (!node) return;
      node.hidden = false;
      if (display) node.style.display = display;
    },

    hide(node) {
      if (node) node.hidden = true;
    },

    toggle(node, force) {
      if (!node) return;
      if (force === undefined) node.hidden = !node.hidden;
      else node.hidden = !force;
    },

    /* ---------- Content ---------- */
    html(node, value) {
      if (!node) return null;
      if (value === undefined) return node.innerHTML;
      node.innerHTML = value;
      return node;
    },

    text(node, value) {
      if (!node) return null;
      if (value === undefined) return node.textContent;
      node.textContent = value;
      return node;
    },

    /* ---------- Events ---------- */
    on(node, type, handler, opts) {
      if (!node) return () => {};
      node.addEventListener(type, handler, opts);
      return () => node.removeEventListener(type, handler, opts);
    },

    off(node, type, handler, opts) {
      if (node) node.removeEventListener(type, handler, opts);
    },

    once(node, type, handler, opts) {
      if (!node) return () => {};
      const wrapper = (e) => {
        handler(e);
        node.removeEventListener(type, wrapper, opts);
      };
      node.addEventListener(type, wrapper, opts);
      return () => node.removeEventListener(type, wrapper, opts);
    },

    delegate(root, type, selector, handler) {
      if (!root) return () => {};
      const listener = (e) => {
        const target = e.target.closest(selector);
        if (target && root.contains(target)) {
          handler.call(target, e, target);
        }
      };
      root.addEventListener(type, listener);
      return () => root.removeEventListener(type, listener);
    },

    /* ---------- Clear ---------- */
    empty(node) {
      if (!node) return node;
      while (node.firstChild) node.removeChild(node.firstChild);
      return node;
    },

    remove(node) {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    },

    /* ---------- Insert ---------- */
    prepend(parent, child) {
      if (!parent || !child) return;
      parent.insertBefore(child, parent.firstChild);
    },

    append(parent, child) {
      if (!parent || !child) return;
      parent.appendChild(child);
    },

    before(node, sibling) {
      if (node?.parentNode) node.parentNode.insertBefore(sibling, node);
    },

    after(node, sibling) {
      if (node?.parentNode) node.parentNode.insertBefore(sibling, node.nextSibling);
    },

    /* ---------- Dimensions ---------- */
    rect(node) {
      return node?.getBoundingClientRect() || null;
    },

    offset(node) {
      const r = this.rect(node);
      return r ? { top: r.top + window.scrollY, left: r.left + window.scrollX } : null;
    },

    /* ---------- Scroll ---------- */
    scrollTo(node, opts) {
      if (node) node.scrollIntoView({ behavior: "smooth", block: "start", ...opts });
    },

    scrollTop(node, value) {
      if (!node) return 0;
      if (value === undefined) return node.scrollTop;
      node.scrollTop = value;
      return value;
    },

    /* ---------- Focus ---------- */
    focus(node, opts) {
      if (node && typeof node.focus === "function") node.focus(opts);
    },

    blur(node) {
      if (node && typeof node.blur === "function") node.blur();
    },

    focusable(container) {
      if (!container) return [];
      const selector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled]):not([type='hidden'])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(",");
      return Array.from(container.querySelectorAll(selector)).filter(
        (el) => el.offsetParent !== null
      );
    },

    /* ---------- Form values ---------- */
    formValues(form) {
      if (!form) return {};
      const fd = new FormData(form);
      const values = {};
      for (const [k, v] of fd.entries()) {
        if (k in values) {
          if (!Array.isArray(values[k])) values[k] = [values[k]];
          values[k].push(v);
        } else {
          values[k] = v;
        }
      }
      return values;
    },

    setFormValues(form, values = {}) {
      if (!form) return;
      Object.entries(values).forEach(([k, v]) => {
        const fields = form.querySelectorAll(`[name="${k}"]`);
        fields.forEach((f) => {
          if (f.type === "checkbox") f.checked = !!v;
          else if (f.type === "radio") f.checked = f.value === String(v);
          else f.value = v == null ? "" : v;
        });
      });
    },

    /* ---------- Position helpers ---------- */
    positionFor(elem, anchor, placement = "bottom-start", offset = 6) {
      if (!elem || !anchor) return;
      const a = anchor.getBoundingClientRect();
      const m = elem.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      let top = 0;
      let left = 0;
      const isRTL = document.documentElement.dir === "rtl";

      switch (placement) {
        case "bottom-start":
          top = a.bottom + offset;
          left = isRTL ? a.right - m.width : a.left;
          break;
        case "bottom-end":
          top = a.bottom + offset;
          left = isRTL ? a.left : a.right - m.width;
          break;
        case "top-start":
          top = a.top - m.height - offset;
          left = isRTL ? a.right - m.width : a.left;
          break;
        case "top-end":
          top = a.top - m.height - offset;
          left = isRTL ? a.left : a.right - m.width;
          break;
        case "right-start":
          top = a.top;
          left = a.right + offset;
          break;
        case "left-start":
          top = a.top;
          left = a.left - m.width - offset;
          break;
        case "center":
          top = a.top + a.height / 2 - m.height / 2;
          left = a.left + a.width / 2 - m.width / 2;
          break;
        default:
          top = a.bottom + offset;
          left = a.left;
      }

      if (left + m.width > vw - 8) left = vw - m.width - 8;
      if (left < 8) left = 8;
      if (top + m.height > vh - 8 && placement.startsWith("bottom")) {
        top = a.top - m.height - offset;
      }
      if (top < 8) top = 8;

      Object.assign(elem.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: "9999",
      });
    },

    positionAtPoint(elem, x, y) {
      if (!elem) return;
      const m = elem.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x;
      let top = y;
      if (left + m.width > vw - 8) left = vw - m.width - 8;
      if (top + m.height > vh - 8) top = vh - m.height - 8;
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      Object.assign(elem.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        zIndex: "9999",
      });
    },

    /* ---------- Create overlay backdrop ---------- */
    backdrop(className = "modal__backdrop") {
      return this.el("div", { class: className });
    },

    /* ---------- Lock scroll ---------- */
    lockScroll() {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.style.setProperty("--sb-size", `${scrollbarWidth}px`);
      document.body.classList.add("is-locked");
    },

    unlockScroll() {
      document.body.classList.remove("is-locked");
      document.documentElement.style.removeProperty("--sb-size");
    },

    /* ---------- Check visibility ---------- */
    isVisible(node) {
      if (!node) return false;
      if (node.hidden) return false;
      const style = window.getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    },

    /* ---------- Escape HTML ---------- */
    escape(str) {
      if (str == null) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    /* ---------- Copy to clipboard ---------- */
    async copy(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        console.warn("copy failed:", e);
        return false;
      }
    },

    /* ---------- Download ---------- */
    download(content, filename, mime = "text/plain;charset=utf-8") {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 200);
    },

    /* ---------- Icon helper ---------- */
    icon(name, className = "") {
      return this.el("i", { class: `${name} ${className}`.trim() });
    },

    /* ---------- Build from HTML string ---------- */
    fromHTML(html) {
      const tpl = document.createElement("template");
      tpl.innerHTML = html.trim();
      return tpl.content.firstElementChild;
    },

    /* ---------- Debounce ---------- */
    debounce(fn, wait = 300) {
      let timer = null;
      return function (...args) {
        const ctx = this;
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(ctx, args), wait);
      };
    },

    /* ---------- Throttle ---------- */
    throttle(fn, wait = 200) {
      let last = 0;
      let timer = null;
      return function (...args) {
        const ctx = this;
        const now = Date.now();
        if (now - last >= wait) {
          last = now;
          fn.apply(ctx, args);
        } else {
          clearTimeout(timer);
          timer = setTimeout(() => {
            last = Date.now();
            fn.apply(ctx, args);
          }, wait - (now - last));
        }
      };
    },

    /* ---------- Ready ---------- */
    ready(fn) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", fn, { once: true });
      } else {
        fn();
      }
    },
  };

  window.Dom = Dom;
})(window);