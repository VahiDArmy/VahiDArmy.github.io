/* ============================================================
   js/ui/loader.js
   Global page-level loader + button-level loader helper
   ============================================================ */

import { byId, el } from '../utils/dom.js';
import { CLS } from '../config/constants.js';

/** @type {HTMLElement|null} */
let root = null;
/** @type {HTMLElement|null} */
let labelNode = null;
let visibleCount = 0;

function ensure() {
  if (!root) root = byId('loader-root');
  if (!root) {
    root = el('div', { class: 'loader-root', attrs: { id: 'loader-root', hidden: true } });
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Show the global loader (idempotent, ref-counted).
 * @param {string} [message='در حال بارگذاری…']
 */
export function showLoader(message = 'در حال بارگذاری…') {
  visibleCount++;
  const r = ensure();
  if (!labelNode) {
    labelNode = el('p', { class: 'loader-root__label' });
    r.appendChild(el('div', { class: 'loader-root__inner' }, {
      children: [
        el('div', { class: 'loader-root__spinner' }, {
          children: [
            el('span'), el('span'), el('span'),
          ],
        }),
        labelNode,
      ],
    }));
  }
  labelNode.textContent = message;
  r.hidden = false;
  requestAnimationFrame(() => r.classList.add('is-visible'));
}

/**
 * Hide the global loader.
 */
export function hideLoader() {
  visibleCount = Math.max(0, visibleCount - 1);
  if (visibleCount > 0) return;
  const r = ensure();
  r.classList.remove('is-visible');
  setTimeout(() => {
    if (visibleCount === 0) r.hidden = true;
  }, 250);
}

/**
 * Force hide regardless of counter.
 */
export function forceHideLoader() {
  visibleCount = 0;
  const r = ensure();
  r.classList.remove('is-visible');
  setTimeout(() => { r.hidden = true; }, 250);
}

/**
 * Toggle a button into loading state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 * @param {string} [loadingLabel]
 */
export function setButtonLoading(btn, loading, loadingLabel) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.originalLabel) {
      const labelEl = btn.querySelector('.btn__label');
      btn.dataset.originalLabel = labelEl ? labelEl.textContent : btn.textContent;
    }
    btn.classList.add(CLS.LOADING);
    btn.disabled = true;
    if (loadingLabel) {
      const labelEl = btn.querySelector('.btn__label');
      if (labelEl) labelEl.textContent = loadingLabel;
      else btn.textContent = loadingLabel;
    }
  } else {
    btn.classList.remove(CLS.LOADING);
    btn.disabled = false;
    if (btn.dataset.originalLabel) {
      const labelEl = btn.querySelector('.btn__label');
      if (labelEl) labelEl.textContent = btn.dataset.originalLabel;
      else btn.textContent = btn.dataset.originalLabel;
      delete btn.dataset.originalLabel;
    }
  }
}

/**
 * Render a skeleton block (returns a node).
 * @param {{lines?:number, variant?:'text'|'card'|'avatar'|'chart', width?:string, height?:string}} [opts]
 * @returns {HTMLElement}
 */
export function skeleton(opts = {}) {
  const { lines = 3, variant = 'text', width, height } = opts;
  const wrap = el('div', { class: ['skeleton-wrap', `skeleton-wrap--${variant}`] });
  if (variant === 'text') {
    for (let i = 0; i < lines; i++) {
      wrap.appendChild(el('div', {
        class: 'skeleton skeleton--line',
        style: { width: i === lines - 1 ? '60%' : '100%', height: height || '14px' },
      }));
    }
  } else if (variant === 'avatar') {
    wrap.appendChild(el('div', { class: 'skeleton skeleton--avatar', style: { width: width || '48px', height: height || '48px' } }));
  } else if (variant === 'card') {
    wrap.appendChild(el('div', { class: 'skeleton skeleton--card', style: { height: height || '180px' } }));
  } else if (variant === 'chart') {
    wrap.appendChild(el('div', { class: 'skeleton skeleton--chart', style: { height: height || '240px' } }));
  }
  return wrap;
}

export default { showLoader, hideLoader, forceHideLoader, setButtonLoading, skeleton };