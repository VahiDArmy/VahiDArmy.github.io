// js/ui/toast.js
import { el } from './dom.js';

let root;
function ensureRoot() {
  if (!root) {
    root = document.getElementById('toast-root');
    if (!root) {
      root = el('div', { id: 'toast-root', class: 'toast-root' });
      document.body.appendChild(root);
    }
  }
  return root;
}

export function toast(message, type = 'info', duration = 3200) {
  const node = el('div', { class: `toast toast-${type}` }, message);
  ensureRoot().appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, duration);
  return node;
}
