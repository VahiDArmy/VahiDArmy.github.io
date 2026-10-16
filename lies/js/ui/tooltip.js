/* ============================================================
   js/ui/tooltip.js
   Lightweight tooltip using event delegation
   ============================================================ */

import { el, byId } from '../utils/dom.js';

let root = null;
let hideTimer = null;
let showTimer = null;
let activeTarget = null;

const SHOW_DELAY = 380;
const HIDE_DELAY = 80;

function ensureRoot() {
  if (!root) root = byId('tooltip-root');
  if (!root) {
    root = el('div', { class: 'tooltip-root', attrs: { id: 'tooltip-root' } });
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Attach tooltips globally. Elements with `[data-tooltip]` get a tip.
 */
export function initTooltips() {
  const r = ensureRoot();

  const onEnter = (ev) => {
    const target = ev.target.closest?.('[data-tooltip]');
    if (!target) return;
    activeTarget = target;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    showTimer = setTimeout(() => showTip(target), SHOW_DELAY);
  };

  const onLeave = (ev) => {
    const target = ev.target.closest?.('[data-tooltip]');
    if (!target) return;
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    hideTimer = setTimeout(hideTip, HIDE_DELAY);
  };

  document.addEventListener('mouseover', onEnter, true);
  document.addEventListener('mouseout', onLeave, true);
  document.addEventListener('focusin', onEnter, true);
  document.addEventListener('focusout', onLeave, true);
  document.addEventListener('mousedown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('blur', hideTip);

  return () => {
    document.removeEventListener('mouseover', onEnter, true);
    document.removeEventListener('mouseout', onLeave, true);
    document.removeEventListener('focusin', onEnter, true);
    document.removeEventListener('focusout', onLeave, true);
    document.removeEventListener('mousedown', hideTip, true);
    window.removeEventListener('scroll', hideTip, true);
    window.removeEventListener('blur', hideTip);
  };
}

function showTip(target) {
  if (!target || !target.isConnected) return;
  const text = target.getAttribute('data-tooltip');
  if (!text) return;

  const r = ensureRoot();
  r.innerHTML = '';
  const tip = el('div', { class: 'tooltip', attrs: { role: 'tooltip' } }, { children: [text] });
  r.appendChild(tip);

  const placement = target.getAttribute('data-tooltip-placement') || 'top';
  const tr = target.getBoundingClientRect();
  tip.style.visibility = 'hidden';

  requestAnimationFrame(() => {
    const tRect = tip.getBoundingClientRect();
    let top = 0;
    let left = 0;
    const gap = 8;

    switch (placement) {
      case 'top':    top = tr.top - tRect.height - gap; left = tr.left + tr.width / 2 - tRect.width / 2; break;
      case 'bottom': top = tr.bottom + gap; left = tr.left + tr.width / 2 - tRect.width / 2; break;
      case 'left':   top = tr.top + tr.height / 2 - tRect.height / 2; left = tr.left - tRect.width - gap; break;
      case 'right':  top = tr.top + tr.height / 2 - tRect.height / 2; left = tr.right + gap; break;
      default:       top = tr.top - tRect.height - gap; left = tr.left + tr.width / 2 - tRect.width / 2;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (left < 6) left = 6;
    if (left + tRect.width > vw - 6) left = vw - tRect.width - 6;
    if (top < 6) { top = tr.bottom + gap; tip.classList.add('tooltip--flipped'); }
    if (top + tRect.height > vh - 6) top = vh - tRect.height - 6;

    tip.style.position = 'fixed';
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    tip.style.visibility = '';
    tip.classList.add('is-visible');
  });
}

function hideTip() {
  if (!root) return;
  root.innerHTML = '';
  activeTarget = null;
}

export default { initTooltips };