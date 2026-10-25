/* ==========================================================================
   Component — Tooltip
   Automatically attaches to any [data-tooltip] element via delegation.
   Supports: data-tooltip, data-tooltip-placement (top|bottom|left|right)
   ========================================================================== */

(function (window, document) {
  'use strict';

  const App = (window.App = window.App || {});
  const DOM = App.DOM;

  let root = null;
  let current = null;
  let currentTarget = null;
  let showTimer = null;
  let hideTimer = null;

  const SHOW_DELAY = 350;
  const HIDE_DELAY = 80;

  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.getElementById('tooltip-root');
    if (!root) {
      root = DOM.el('div', { id: 'tooltip-root', class: 'tooltip-root' });
      document.body.appendChild(root);
    }
    return root;
  }

  function position(tooltip, target, placement) {
    const rect = target.getBoundingClientRect();
    tooltip.style.visibility = 'hidden';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    const tRect = tooltip.getBoundingClientRect();
    const gap = 8;
    let x, y;

    switch (placement) {
      case 'bottom':
        x = rect.left + rect.width / 2 - tRect.width / 2;
        y = rect.bottom + gap;
        break;
      case 'left':
        x = rect.left - tRect.width - gap;
        y = rect.top + rect.height / 2 - tRect.height / 2;
        break;
      case 'right':
        x = rect.right + gap;
        y = rect.top + rect.height / 2 - tRect.height / 2;
        break;
      case 'top':
      default:
        x = rect.left + rect.width / 2 - tRect.width / 2;
        y = rect.top - tRect.height - gap;
        placement = 'top';
        break;
    }

    // Clamp within viewport
    const margin = 6;
    if (x < margin) x = margin;
    if (x + tRect.width + margin > window.innerWidth) {
      x = window.innerWidth - tRect.width - margin;
    }
    if (y < margin) {
      y = rect.bottom + gap;
      placement = 'bottom';
    }
    if (y + tRect.height + margin > window.innerHeight) {
      y = rect.top - tRect.height - gap;
      placement = 'top';
    }

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
    tooltip.style.visibility = 'visible';
    tooltip.setAttribute('data-placement', placement);

    // Position arrow
    const arrow = tooltip.querySelector('.tooltip__arrow');
    if (arrow) {
      if (placement === 'top' || placement === 'bottom') {
        const cx = rect.left + rect.width / 2;
        arrow.style.left = Math.max(8, Math.min(tRect.width - 8, cx - x)) + 'px';
        arrow.style.right = '';
        arrow.style.marginLeft = '-4px';
      } else {
        const cy = rect.top + rect.height / 2;
        arrow.style.top = Math.max(8, Math.min(tRect.height - 8, cy - y)) + 'px';
        arrow.style.marginTop = '-4px';
      }
    }
  }

  function show(target) {
    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    // Don't show if disabled
    if (target.disabled) return;

    cancelHide();
    if (currentTarget === target && current) return;

    hideNow();

    const placement = target.getAttribute('data-tooltip-placement') || 'top';
    const multiline = target.hasAttribute('data-tooltip-multiline');

    const tooltip = DOM.el('div', {
      class: 'tooltip' + (multiline ? ' tooltip--multiline' : ''),
      role: 'tooltip'
    });
    tooltip.textContent = text;
    const arrow = DOM.el('div', { class: 'tooltip__arrow' });
    tooltip.appendChild(arrow);

    ensureRoot().appendChild(tooltip);
    current = tooltip;
    currentTarget = target;
    position(tooltip, target, placement);
  }

  function cancelHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(hideNow, HIDE_DELAY);
  }

  function hideNow() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (current) {
      DOM.remove(current);
    }
    current = null;
    currentTarget = null;
  }

  function scheduleShow(target) {
    if (showTimer) clearTimeout(showTimer);
    cancelHide();
    if (current && currentTarget === target) return;
    showTimer = setTimeout(() => {
      showTimer = null;
      show(target);
    }, SHOW_DELAY);
  }

  /* ---------- Delegated listeners ---------- */

  document.addEventListener('mouseover', (ev) => {
    const target = ev.target.closest && ev.target.closest('[data-tooltip]');
    if (!target) {
      if (current) scheduleHide();
      return;
    }
    scheduleShow(target);
  });

  document.addEventListener('mouseout', (ev) => {
    const target = ev.target.closest && ev.target.closest('[data-tooltip]');
    if (!target) return;
    const related = ev.relatedTarget;
    if (related && target.contains(related)) return;
    scheduleHide();
  });

  document.addEventListener('focusin', (ev) => {
    const target = ev.target.closest && ev.target.closest('[data-tooltip]');
    if (target) show(target);
  });

  document.addEventListener('focusout', (ev) => {
    const target = ev.target.closest && ev.target.closest('[data-tooltip]');
    if (target && currentTarget === target) scheduleHide();
  });

  // Hide when scroll / resize / click
  window.addEventListener('scroll', hideNow, true);
  window.addEventListener('resize', hideNow);
  document.addEventListener('mousedown', () => {
    if (current) hideNow();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && current) hideNow();
  });

  App.Tooltip = {
    show,
    hide: hideNow
  };
})(window, document);