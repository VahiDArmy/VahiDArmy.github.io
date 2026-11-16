/* ============================================================
   Error boundary — wraps render functions, catches throws,
   shows a graceful fallback with retry
   ============================================================ */
import { el } from '../utils.js';
import { icon } from './icons.js';

/**
 * Run `fn()` inside a try/catch.
 * On error returns a fallback element the caller can append.
 * On success returns `{ ok: true, value }`.
 *
 * Usage:
 *   const result = safeRender(() => mountSomething());
 *   if (result.ok) host.append(result.value);
 *   else host.append(result.fallback);
 */
export function safeRender(fn, { label = 'این بخش', onRetry } = {}) {
  try {
    const value = fn();
    return { ok: true, value };
  } catch (err) {
    console.error(`[error-boundary] ${label} crashed:`, err);
    return {
      ok: false,
      error: err,
      fallback: renderFallback({ label, err, onRetry }),
    };
  }
}

/**
 * Async version — awaits fn and returns same shape.
 */
export async function safeRenderAsync(fn, { label = 'این بخش', onRetry } = {}) {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err) {
    console.error(`[error-boundary] ${label} crashed:`, err);
    return {
      ok: false,
      error: err,
      fallback: renderFallback({ label, err, onRetry }),
    };
  }
}

function renderFallback({ label, err, onRetry }) {
  const wrap = el('div', { class: 'error-boundary' }, [
    el('div', { class: 'error-boundary__icon', html: icon('alert', 28) }),
    el('div', { class: 'error-boundary__title', text: `خطا در ${label}` }),
    el('div', { class: 'error-boundary__msg', text: String(err?.message || err || 'خطای ناشناخته') }),
  ]);

  const actions = el('div', { class: 'error-boundary__actions' });

  if (typeof onRetry === 'function') {
    actions.appendChild(el('button', {
      type: 'button',
      class: 'btn btn--primary btn--sm',
      html: `${icon('refresh', 14)}<span>تلاش دوباره</span>`,
      onclick: () => {
        try { onRetry(); }
        catch (e) { console.error('[error-boundary] retry failed:', e); }
      },
    }));
  }

  actions.appendChild(el('button', {
    type: 'button',
    class: 'btn btn--ghost btn--sm',
    text: 'بارگذاری مجدد صفحه',
    onclick: () => location.reload(),
  }));

  wrap.appendChild(actions);

  if (err?.stack) {
    const details = el('details', { class: 'error-boundary__details' }, [
      el('summary', { text: 'جزئیات فنی' }),
      el('pre', { text: String(err.stack) }),
    ]);
    wrap.appendChild(details);
  }

  return wrap;
}

/* ---------- styles (injected once) ---------- */
function injectStyles() {
  if (document.getElementById('error-boundary-styles')) return;
  const s = document.createElement('style');
  s.id = 'error-boundary-styles';
  s.textContent = `
    .error-boundary {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 24px;
      border-radius: var(--r-xl, 20px);
      background: var(--shit-soft, rgba(239,68,68,0.14));
      border: 1px solid var(--shit-border, rgba(239,68,68,0.34));
      text-align: center;
    }
    .error-boundary__icon {
      width: 56px; height: 56px;
      display: grid; place-items: center;
      border-radius: 50%;
      background: var(--shit-soft, rgba(239,68,68,0.14));
      color: var(--shit-2, #f87171);
      border: 1px solid var(--shit-border, rgba(239,68,68,0.34));
    }
    .error-boundary__title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-1, #f3f4ff);
    }
    .error-boundary__msg {
      font-size: 13px;
      color: var(--text-3, rgba(243,244,255,0.5));
      max-width: 520px;
      line-height: 1.65;
      word-break: break-word;
    }
    .error-boundary__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .error-boundary__details {
      width: 100%;
      max-width: 520px;
      text-align: right;
      font-size: 11px;
      color: var(--text-4, rgba(243,244,255,0.32));
    }
    .error-boundary__details summary {
      cursor: pointer;
      padding: 6px;
      user-select: none;
    }
    .error-boundary__details pre {
      background: var(--surface-2, rgba(255,255,255,0.06));
      padding: 12px;
      border-radius: 8px;
      overflow: auto;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      line-height: 1.5;
      color: var(--text-2, rgba(243,244,255,0.74));
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;
  document.head.appendChild(s);
}

injectStyles();
