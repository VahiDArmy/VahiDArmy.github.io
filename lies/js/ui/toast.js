/* ============================================================
   js/ui/toast.js
   Toast notification system with stacking, actions, progress.
   FIXED:
     - Always render the message text (never leaves empty toast)
     - Hardcoded fallback colors so text is ALWAYS visible
     - Never let an undefined message create an empty toast
     - Logs a warning if called with no message
   ============================================================ */

import { el, byId, remove } from '../utils/dom.js';
import { TOAST_TYPES } from '../config/constants.js';
import { TOAST_DURATION } from '../config/app.config.js';

/** @type {HTMLElement|null} */
let root = null;
const MAX_VISIBLE = 5;
const queue = [];

function ensureRoot() {
  if (!root) root = byId('toast-root');
  if (!root) {
    root = el('div', { class: 'toast-root', attrs: { id: 'toast-root', 'aria-live': 'polite' } });
    document.body.appendChild(root);
  }
  // Ensure it's always on top and visible
  root.style.position = 'fixed';
  root.style.bottom = '20px';
  root.style.right = '20px';
  root.style.zIndex = '9999';
  root.style.pointerEvents = 'none';
  return root;
}

const ICONS = {
  [TOAST_TYPES.SUCCESS]: '✓',
  [TOAST_TYPES.ERROR]: '✕',
  [TOAST_TYPES.WARNING]: '⚠',
  [TOAST_TYPES.INFO]: 'ℹ',
  [TOAST_TYPES.LOADING]: '',
};

/* ── Main toast ─────────────────────────────────────────── */

/**
 * Show a toast.
 * @param {string|{
 *   message?:string, type?:string, title?:string, duration?:number,
 *   action?:{label:string, onClick:Function}, dismissible?:boolean, progress?:boolean
 * }} arg
 * @returns {{id:string, dismiss:()=>void, update:(patch:object)=>void}}
 */
export function toast(arg) {
  // Normalize arg
  let opts;
  if (typeof arg === 'string') {
    opts = { message: arg };
  } else if (arg && typeof arg === 'object') {
    opts = { ...arg };
  } else {
    opts = { message: '—' };
  }

  const {
    message = '',
    title = '',
    type = TOAST_TYPES.INFO,
    duration = TOAST_DURATION.normal,
    action = null,
    dismissible = true,
    progress = false,
  } = opts;

  // Guard: never render an empty toast
  const finalMessage = String(message || '').trim() || (
    type === TOAST_TYPES.ERROR ? 'خطایی رخ داد.' :
    type === TOAST_TYPES.SUCCESS ? 'انجام شد.' :
    type === TOAST_TYPES.WARNING ? 'توجه کنید.' :
    type === TOAST_TYPES.LOADING ? 'در حال انجام…' :
    'اطلاع‌رسانی'
  );

  if (!message && !title) {
    console.warn('[toast] called with no message — using fallback:', finalMessage);
  }

  const container = ensureRoot();
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const node = el('div', {
    class: ['toast', `toast--${type}`],
    attrs: { role: type === TOAST_TYPES.ERROR ? 'alert' : 'status', 'data-toast-id': id },
  });

  // Force visible styles (in case CSS is broken)
  node.style.cssText = `
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    min-width: 280px;
    max-width: 420px;
    background: #13131c;
    color: #f2f2f7;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgba(0,0,0,0.55), 0 6px 16px rgba(0,0,0,0.35);
    font-family: Vazirmatn, system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    direction: rtl;
    position: relative;
    opacity: 1;
    transition: opacity 220ms, transform 220ms;
  `;

  // Icon
  const icon = el('div', { class: 'toast__icon' });
  icon.style.cssText = `
    flex-shrink: 0;
    width: 26px; height: 26px;
    border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    background: rgba(124,92,255,0.14);
    color: #7c5cff;
  `;
  if (type === TOAST_TYPES.SUCCESS) icon.style.cssText += 'background:rgba(62,199,168,0.15);color:#3ec7a8;';
  else if (type === TOAST_TYPES.ERROR) icon.style.cssText += 'background:rgba(255,107,107,0.15);color:#ff6b6b;';
  else if (type === TOAST_TYPES.WARNING) icon.style.cssText += 'background:rgba(240,166,62,0.15);color:#f0a63e;';
  else if (type === TOAST_TYPES.INFO) icon.style.cssText += 'background:rgba(88,179,255,0.15);color:#58b3ff;';

  if (type === TOAST_TYPES.LOADING) {
    const sp = el('span', { class: 'toast__spinner' });
    sp.style.cssText = `
      width:14px;height:14px;border-radius:50%;
      border:2px solid currentColor;border-right-color:transparent;
      animation:spin 700ms linear infinite;display:inline-block;
    `;
    icon.appendChild(sp);
  } else {
    icon.textContent = ICONS[type] || '·';
  }
  node.appendChild(icon);

  // Content
  const content = el('div', { class: 'toast__content' });
  content.style.cssText = `flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;`;

  if (title) {
    const titleEl = el('div', { class: 'toast__title' }, { children: [title] });
    titleEl.style.cssText = `font-size:13px;font-weight:600;color:#f2f2f7;`;
    content.appendChild(titleEl);
  }

  const messageEl = el('div', { class: 'toast__message' }, { children: [finalMessage] });
  messageEl.style.cssText = `font-size:13px;line-height:1.6;color:#c8c8d8;word-break:break-word;`;
  content.appendChild(messageEl);

  if (action && typeof action.onClick === 'function') {
    const btn = el('button', {
      class: 'toast__action',
      attrs: { type: 'button' },
    }, { children: [action.label] });
    btn.style.cssText = `
      margin-top:6px;align-self:flex-start;
      padding:4px 10px;border-radius:6px;
      background:rgba(124,92,255,0.16);color:#b6a5ff;
      font-size:11px;font-weight:600;border:none;cursor:pointer;
    `;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      try { action.onClick(); } catch (e) { console.error(e); }
      dismiss();
    });
    content.appendChild(btn);
  }
  node.appendChild(content);

  // Close button
  if (dismissible) {
    const closeBtn = el('button', {
      class: 'toast__close',
      attrs: { type: 'button', 'aria-label': 'بستن' },
    }, { children: ['✕'] });
    closeBtn.style.cssText = `
      flex-shrink:0;width:22px;height:22px;border-radius:6px;
      display:inline-flex;align-items:center;justify-content:center;
      font-size:11px;color:#6f6f88;background:transparent;border:none;cursor:pointer;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.06)';
      closeBtn.style.color = '#f2f2f7';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = '#6f6f88';
    });
    closeBtn.addEventListener('click', () => dismiss());
    node.appendChild(closeBtn);
  }

  // Progress bar
  let progressBar = null;
  if (progress && duration > 0) {
    progressBar = el('div', { class: 'toast__progress' });
    progressBar.style.cssText = `position:absolute;inset-inline:0;bottom:0;height:2px;background:rgba(255,255,255,0.06);overflow:hidden;border-radius:0 0 14px 14px;`;
    progressBar.appendChild(el('div', { class: 'toast__progress-bar' }));
    node.appendChild(progressBar);
  }

  let timer = null;
  let remaining = duration;
  let startTs = 0;
  let paused = false;
  let dismissed = false;

  function startTimer() {
    if (!duration) return;
    startTs = Date.now();
    timer = setTimeout(() => dismiss(), remaining);
  }

  function pauseTimer() {
    if (dismissed || !timer) return;
    paused = true;
    clearTimeout(timer);
    timer = null;
    remaining -= Date.now() - startTs;
  }

  function resumeTimer() {
    if (dismissed || !paused) return;
    paused = false;
    startTimer();
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    node.style.opacity = '0';
    node.style.transform = 'translateY(10px)';
    setTimeout(() => {
      remove(node);
      const idx = queue.indexOf(handle);
      if (idx >= 0) queue.splice(idx, 1);
    }, 220);
  }

  node.addEventListener('mouseenter', pauseTimer);
  node.addEventListener('mouseleave', resumeTimer);

  // Enforce max visible
  if (container.children.length >= MAX_VISIBLE) {
    const first = container.firstElementChild;
    if (first) {
      first.style.opacity = '0';
      setTimeout(() => remove(first), 220);
    }
  }

  container.appendChild(node);
  startTimer();

  /** @type {{id:string, dismiss:()=>void, update:(p:object)=>void}} */
  const handle = {
    id,
    dismiss,
    update(patch = {}) {
      if (patch.message) messageEl.textContent = String(patch.message);
      if (patch.type) {
        node.classList.remove(`toast--${type}`);
        node.classList.add(`toast--${patch.type}`);
      }
    },
  };
  queue.push(handle);
  return handle;
}

/* ── Convenience wrappers ───────────────────────────────── */

toast.success = (message, opts = {}) => toast({ message, type: TOAST_TYPES.SUCCESS, ...opts });
toast.error = (message, opts = {}) => toast({ message, type: TOAST_TYPES.ERROR, duration: TOAST_DURATION.long, ...opts });
toast.warning = (message, opts = {}) => toast({ message, type: TOAST_TYPES.WARNING, ...opts });
toast.info = (message, opts = {}) => toast({ message, type: TOAST_TYPES.INFO, ...opts });
toast.loading = (message, opts = {}) =>
  toast({ message, type: TOAST_TYPES.LOADING, duration: 0, dismissible: false, ...opts });
toast.dismissAll = () => {
  [...queue].forEach((t) => t.dismiss());
};

/**
 * Promise-aware toast: shows loading, then success/error.
 * @template T
 * @param {Promise<T>} promise
 * @param {{loading?:string, success?:string|((r:T)=>string), error?:string|((e:any)=>string)}} msgs
 * @returns {Promise<T>}
 */
export async function toastPromise(promise, msgs = {}) {
  const handle = toast.loading(msgs.loading || 'در حال انجام…', { duration: 0 });
  try {
    const result = await promise;
    handle.dismiss();
    if (msgs.success) {
      toast.success(typeof msgs.success === 'function' ? msgs.success(result) : msgs.success);
    }
    return result;
  } catch (err) {
    handle.dismiss();
    toast.error(
      typeof msgs.error === 'function'
        ? msgs.error(err)
        : msgs.error || err?.message || 'خطایی رخ داد.'
    );
    throw err;
  }
}

export { TOAST_TYPES };