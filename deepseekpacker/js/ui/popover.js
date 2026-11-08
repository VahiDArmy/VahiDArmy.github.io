// Slick, anchored popovers using the HTML Popover API.

import { el, clear } from '../utils/dom.js';

let activePopover = null;

export function openPopover(anchor, contentFn) {
  closePopover();

  const popover = el('div', { class: 'ui-popover', popover: 'auto' });
  const arrow = el('div', { class: 'popover-arrow' });
  popover.appendChild(arrow);

  const body = el('div', { class: 'popover-body' });
  body.appendChild(contentFn());
  popover.appendChild(body);

  document.body.appendChild(popover);

  // Positioning
  const rect = anchor.getBoundingClientRect();
  popover.style.top = (rect.bottom + 10) + 'px';
  popover.style.left = '0px';

  requestAnimationFrame(() => {
    const popRect = popover.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popRect.width / 2;
    if (left < 8) left = 8;
    if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
    popover.style.left = left + 'px';

    const arrowLeft = (rect.left + rect.width / 2) - left - 5;
    arrow.style.left = arrowLeft + 'px';
  });

  if (popover.showPopover) {
    popover.showPopover();
  }

  activePopover = popover;

  const onDocClick = (e) => {
    if (!popover.contains(e.target) && e.target !== anchor) {
      closePopover();
    }
  };
  setTimeout(() => document.addEventListener('click', onDocClick), 10);

  const onScroll = () => closePopover();
  window.addEventListener('scroll', onScroll, { passive: true, once: true });

  return {
    close: closePopover,
    popover,
  };
}

export function closePopover() {
  if (activePopover) {
    if (activePopover.matches(':popover-open')) {
      activePopover.hidePopover();
    }
    activePopover.remove();
    activePopover = null;
  }
}
