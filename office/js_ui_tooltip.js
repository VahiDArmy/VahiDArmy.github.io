/**
 * Tooltip system — attribute-based (data-tooltip) + programmatic.
 *
 *   attachTooltips(document.body);           // wire all [data-tooltip]
 *   tooltip.attach(el, 'متن راهنما');       // programmatic
 */

import { el } from '../utils/dom.js';
import { rafThrottle } from '../utils/debounce.js';

let root = null;
let currentNode = null;
let hideTimer = null;

function ensureRoot() {
  if (root && document.body.contains(root)) return root;
  root = document.getElementById('tooltip-root');
  if (!root) {
    root = el('div', { id: 'tooltip-root', class: 'tooltip-root' });
    document.body.appendChild(root);
  }
  return root;
}

function show(target, text, opts = {}) {
  if (!text) return;
  ensureRoot();

  const position = opts.position || target.dataset.tooltipPos || 'top';
  const wrap = opts.wrap || target.hasAttribute('data-tooltip-wrap');

  const node = el('div', {
    class: `tooltip${wrap ? ' tooltip--wrap' : ''}`,
    'data-pos': position,
    role: 'tooltip',
  }, [
    document.createTextNode(text),
    el('span', { class: 'tooltip__arrow' }),
  ]);

  root.appendChild(node);

  const tRect = target.getBoundingClientRect();
  const nRect = node.getBoundingClientRect();
  const gap = 8;
  let top = 0;
  let left = 0;

  switch (position) {
    case 'bottom':
      top = tRect.bottom + gap;
      left = tRect.left + tRect.width / 2 - nRect.width / 2;
      break;
    case 'left':
      top = tRect.top + tRect.height / 2 - nRect.height / 2;
      left = tRect.left - nRect.width - gap;
      break;
    case 'right':
      top = tRect.top + tRect.height / 2 - nRect.height / 2;
      left = tRect.right + gap;
      break;
    case 'top':
    default:
      top = tRect.top - nRect.height - gap;
      left = tRect.left + tRect.width / 2 - nRect.width / 2;
      break;
  }

  const pad = 6;
  if (left < pad) left = pad;
  if (left + nRect.width > window.innerWidth - pad) left = window.innerWidth - nRect.width - pad;
  if (top < pad) top = pad;
  if (top + nRect.height > window.innerHeight - pad) top = window.innerHeight - nRect.height - pad;

  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  currentNode = node;
}

function hide(delay = 60) {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (currentNode) { currentNode.remove(); currentNode = null; }
  }, delay);
}

function attach(target, text, opts = {}) {
  if (!target) return () => {};
  const get = () => (typeof text === 'function' ? text() : text);

  const onEnter = () => { hide(0); show(target, get(), opts); };
  const onLeave = () => hide();
  const onFocus = () => onEnter();
  const onBlur = () => onLeave();

  target.addEventListener('mouseenter', onEnter);
  target.addEventListener('mouseleave', onLeave);
  target.addEventListener('focus', onFocus);
  target.addEventListener('blur', onBlur);

  const reposition = rafThrottle(() => {
    if (currentNode && target.matches(':hover')) {
      hide(0);
      show(target, get(), opts);
    }
  });
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);

  return () => {
    target.removeEventListener('mouseenter', onEnter);
    target.removeEventListener('mouseleave', onLeave);
    target.removeEventListener('focus', onFocus);
    target.removeEventListener('blur', onBlur);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
  };
}

/** Wire every [data-tooltip] in a subtree (idempotent). */
export function attachTooltips(scope = document.body) {
  if (!scope) return;
  scope.querySelectorAll('[data-tooltip]').forEach((node) => {
    if (node.dataset.tooltipBound === '1') return;
    node.dataset.tooltipBound = '1';
    attach(node, () => node.getAttribute('data-tooltip'));
  });
}

export const tooltip = { attach, show, hide, attachAll: attachTooltips };
export default tooltip;