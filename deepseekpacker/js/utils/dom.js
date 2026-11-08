// DOM utilities — minimal helpers used across the app.

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs && typeof attrs === 'object') {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class' || key === 'className') {
        node.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      } else if (key === 'dataset') {
        for (const [dk, dv] of Object.entries(value)) {
          if (dv !== null && dv !== undefined) node.dataset[dk] = dv;
        }
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(node.style, value);
      } else if (key === 'on' && typeof value === 'object') {
        for (const [evt, handler] of Object.entries(value)) {
          if (typeof handler === 'function') node.addEventListener(evt, handler);
        }
      } else if (key === 'html') {
        node.innerHTML = value;
      } else if (key === 'text') {
        node.textContent = String(value);
      } else if (key === 'attrs' && typeof value === 'object') {
        for (const [a, v] of Object.entries(value)) {
          if (v !== null && v !== undefined && v !== false) node.setAttribute(a, String(v));
        }
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        try {
          node[key] = value;
        } catch (err) {
          node.setAttribute(key, String(value));
        }
      }
    }
  }
  appendChildren(node, children);
  return node;
}

export function appendChildren(node, children) {
  if (!children) return node;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      appendChildren(node, child);
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
  return node;
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function on(node, event, handler, opts) {
  node.addEventListener(event, handler, opts);
  return () => node.removeEventListener(event, handler, opts);
}

export function debounce(fn, ms) {
  let timer = null;
  function wrapped(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  }
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  return function wrapped(...args) {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

export function raf(fn) {
  return requestAnimationFrame(fn);
}

export function nextTick(fn) {
  return Promise.resolve().then(fn);
}

export function isVisible(node) {
  return !!(node && node.offsetParent !== null);
}

export function scrollIntoViewIfNeeded(node, opts = { block: 'nearest', behavior: 'smooth' }) {
  if (!node) return;
  try {
    node.scrollIntoView(opts);
  } catch (err) {
    node.scrollIntoView();
  }
}

export function setAttr(node, name, value) {
  if (value === null || value === undefined || value === false) {
    node.removeAttribute(name);
  } else {
    node.setAttribute(name, String(value));
  }
}

export function toggleClass(node, name, force) {
  if (force === undefined) {
    node.classList.toggle(name);
  } else {
    node.classList.toggle(name, !!force);
  }
}

export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text)
    );
  }
  return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text) {
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.top = '0';
  helper.style.left = '-9999px';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    ok = false;
  }
  document.body.removeChild(helper);
  return ok;
}
