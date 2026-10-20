/**
 * Scroll-to-top button, shown after scrolling 300px.
 */

import { el, icon } from '../utils/dom.js';
import { rafThrottle } from '../utils/debounce.js';

let node = null;
let installed = false;

export function installScrollTop() {
  if (installed) return;
  installed = true;

  node = el(
    'button',
    {
      type: 'button',
      class: 'scroll-top',
      'aria-label': 'بازگشت به بالا',
      title: 'بازگشت به بالا',
      on: {
        click: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      },
    },
    [icon('arrow-up')]
  );
  document.body.appendChild(node);

  const onScroll = rafThrottle(() => {
    const show = window.scrollY > 300;
    node.classList.toggle('is-visible', show);
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}