/**
 * Footer
 */

import { el } from '../utils/dom.js';
import { APP_VERSION, ROUTES, NAV_ITEMS } from '../config/constants.js';
import { router } from '../core/router.js';
import { toFaDigits } from '../utils/format.js';

export function mountFooter(root) {
  if (!root) return () => {};

  const year = new Date().getFullYear();
  const faYear = toFaDigits(year);

  // Get internal links only for footer (to keep it clean)
  const internalLinks = NAV_ITEMS.filter(i => !i.isExternal);

  const container = el('div', { class: 'container' }, [
    el('div', { class: 'footer' }, [
      el('div', { class: 'footer__brand' }, [
        el('span', { class: 'footer__mark' }, ['O']),
        el('span', {}, ['The Office — بایگانی اداره']),
      ]),
      el('nav', { class: 'footer__links', 'aria-label': 'پیوندهای پاورقی' }, 
        internalLinks.map(item => 
          el('a', { class: 'footer__link', href: router.href(item.href) }, [item.label])
        )
      ),
      el('div', { class: 'footer__copy' }, [
        `© ${faYear} — نسخه ${toFaDigits(APP_VERSION)}`,
      ]),
    ]),
  ]);

  root.appendChild(container);
  return () => { root.innerHTML = ''; };
}

export default mountFooter;