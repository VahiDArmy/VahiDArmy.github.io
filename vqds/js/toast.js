/* ==========================================================================
   toast.js — اعلان‌های شناور (Toast Notifications)
   ========================================================================== */

import { CONFIG } from './config.js';

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  heart: '♥',
};

function getRoot() {
  return document.getElementById('toastRoot');
}

function createToastNode(message, type) {
  const node = document.createElement('div');
  node.className = `toast toast--${type}`;
  node.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.textContent = ICONS[type] || ICONS.info;

  const text = document.createElement('span');
  text.className = 'toast__msg';
  text.textContent = String(message ?? '');

  node.appendChild(icon);
  node.appendChild(text);
  return node;
}

/**
 * نمایش پیام شناور
 * @param {string} message
 * @param {'info'|'success'|'error'|'heart'} [type='info']
 * @param {number} [duration]
 */
export function toast(message, type = 'info', duration = CONFIG.ui.toastDuration) {
  const root = getRoot();
  if (!root) {
    console.log(`[toast:${type}] ${message}`);
    return;
  }

  const node = createToastNode(message, type);
  root.appendChild(node);

  const remove = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 260);
  };

  const timer = setTimeout(remove, duration);

  // امکان بستن با کلیک
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

export const successToast = (m, d) => toast(m, 'success', d);
export const errorToast = (m, d) => toast(m, 'error', d);
export const infoToast = (m, d) => toast(m, 'info', d);
export const heartToast = (m, d) => toast(m, 'heart', d);

export default toast;