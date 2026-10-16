/* ============================================================
   js/core/error-boundary.js
   Global error handling: window.onerror, unhandledrejection,
   and a friendly overlay with copy/reload/dismiss.
   Includes loop protection to avoid infinite error storms.
   ============================================================ */

import { bus } from './event-bus.js';
import { EVENTS } from '../config/constants.js';
import { el, byId } from '../utils/dom.js';
import { escapeHtml } from '../utils/sanitize.js';

const MAX_ERRORS_PER_WINDOW = 3;
const WINDOW_MS = 8000;

let initialized = false;
/** @type {number[]} */
let errorTimestamps = [];
let overlayOpen = false;

/* ── Public API ──────────────────────────────────────────── */

/**
 * Initialize global error handling. Safe to call multiple times.
 * @returns {() => void} teardown
 */
export function initErrorBoundary() {
  if (initialized) return () => {};
  initialized = true;

  const onError = (event) => {
    // Ignore cross-origin script errors without details
    const err = event.error;
    if (!err) return;
    handleError({
      source: 'window.error',
      message: err.message || event.message || 'خطای نامشخص',
      stack: err.stack || '',
      filename: event.filename || '',
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  const onRejection = (event) => {
    const reason = event.reason;
    const info = normalizeReason(reason);
    handleError({ source: 'unhandledrejection', ...info });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    initialized = false;
  };
}

/**
 * Report an error manually (from try/catch blocks).
 * @param {any} err
 * @param {{ silent?: boolean, context?: string }} [opts]
 */
export function reportError(err, opts = {}) {
  const info = normalizeReason(err);
  if (opts.context) info.context = opts.context;
  handleError({ source: 'manual', ...info, silent: opts.silent });
}

/* ── Internals ───────────────────────────────────────────── */

function normalizeReason(reason) {
  if (!reason) return { message: 'خطای نامشخص', stack: '' };
  if (reason instanceof Error) {
    return { message: reason.message || String(reason), stack: reason.stack || '' };
  }
  if (typeof reason === 'string') return { message: reason, stack: '' };
  try {
    return { message: JSON.stringify(reason), stack: '' };
  } catch {
    return { message: String(reason), stack: '' };
  }
}

function handleError(info) {
  console.error('[error-boundary]', info);

  // Loop protection: if too many errors in a short window, stop showing UI
  const now = Date.now();
  errorTimestamps = errorTimestamps.filter((t) => now - t < WINDOW_MS);
  errorTimestamps.push(now);

  bus.emit('app:error', info);

  if (info.silent) return;

  if (errorTimestamps.length > MAX_ERRORS_PER_WINDOW) {
    if (!overlayOpen) showOverlay({
      ...info,
      message: 'خطاهای متعدد رخ داد. لطفاً صفحه را دوباره بارگذاری کنید.',
      stack: info.stack,
      isStorm: true,
    });
    return;
  }

  showOverlay(info);
}

/* ── Overlay UI ──────────────────────────────────────────── */

function showOverlay(info) {
  if (overlayOpen) {
    updateOverlay(info);
    return;
  }
  overlayOpen = true;

  const overlay = el('div', {
    class: 'error-overlay',
    attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'error-title' },
    dataset: { id: 'error-overlay' },
  });

  overlay.innerHTML = `
    <div class="error-overlay__backdrop"></div>
    <div class="error-overlay__card">
      <div class="error-overlay__icon" aria-hidden="true">⚠️</div>
      <h2 class="error-overlay__title" id="error-title">مشکلی رخ داد</h2>
      <p class="error-overlay__message" data-error-message></p>

      <details class="error-overlay__details">
        <summary>جزئیات فنی</summary>
        <pre class="error-overlay__stack" data-error-stack></pre>
        <div class="error-overlay__meta" data-error-meta></div>
      </details>

      <div class="error-overlay__actions">
        <button class="btn btn--ghost" data-action="copy" type="button">
          <span class="btn__icon">📋</span>
          <span class="btn__label">کپی خطا</span>
        </button>
        <button class="btn btn--ghost" data-action="dismiss" type="button">
          <span class="btn__icon">✕</span>
          <span class="btn__label">بستن</span>
        </button>
        <button class="btn btn--primary" data-action="reload" type="button">
          <span class="btn__icon">↻</span>
          <span class="btn__label">بارگذاری دوباره</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('has-overlay');

  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  overlay.querySelector('[data-action="reload"]').addEventListener('click', () => {
    try { location.reload(); } catch { /* noop */ }
  });
  overlay.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
    closeOverlay();
  });
  overlay.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    const text = formatErrorForCopy(info);
    try {
      await navigator.clipboard.writeText(text);
      const btn = overlay.querySelector('[data-action="copy"] .btn__label');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'کپی شد ✓';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    } catch { /* noop */ }
  });

  overlay.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeOverlay();
  });

  updateOverlay(info);
}

function updateOverlay(info) {
  const overlay = byId('error-overlay');
  if (!overlay) return;
  const msgEl = overlay.querySelector('[data-error-message]');
  const stackEl = overlay.querySelector('[data-error-stack]');
  const metaEl = overlay.querySelector('[data-error-meta]');
  if (msgEl) msgEl.textContent = info.message || 'خطای نامشخص';
  if (stackEl) stackEl.textContent = info.stack || '—';
  if (metaEl) {
    const parts = [];
    if (info.source) parts.push(`منبع: ${info.source}`);
    if (info.filename) parts.push(`فایل: ${info.filename}`);
    if (info.lineno) parts.push(`خط: ${info.lineno}`);
    if (info.context) parts.push(`زمینه: ${info.context}`);
    metaEl.textContent = parts.join(' · ');
  }
}

function closeOverlay() {
  const overlay = byId('error-overlay');
  if (!overlay) { overlayOpen = false; return; }
  overlay.classList.remove('is-visible');
  document.body.classList.remove('has-overlay');
  setTimeout(() => {
    overlay.remove();
    overlayOpen = false;
  }, 220);
}

function formatErrorForCopy(info) {
  return [
    `Message: ${info.message}`,
    info.source ? `Source: ${info.source}` : '',
    info.filename ? `File: ${info.filename}` : '',
    info.lineno ? `Line: ${info.lineno}` : '',
    info.context ? `Context: ${info.context}` : '',
    '',
    info.stack || '',
    '',
    `URL: ${location.href}`,
    `UserAgent: ${navigator.userAgent}`,
    `Time: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n');
}

export default { initErrorBoundary, reportError };