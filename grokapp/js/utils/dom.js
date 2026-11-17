/** Small DOM helpers */

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function on(el, event, handler, opts) {
  el.addEventListener(event, handler, opts);
  return () => el.removeEventListener(event, handler, opts);
}

export function show(el) {
  el?.classList.remove('hidden');
}

export function hide(el) {
  el?.classList.add('hidden');
}

export function toast(message, ms = 2800) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  show(el);
  clearTimeout(toast._t);
  toast._t = setTimeout(() => hide(el), ms);
}

export function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}
