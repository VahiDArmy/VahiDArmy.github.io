/**
 * Primary navigation — desktop inline nav + mobile context-menu.
 * Both are built from the same NAV_ITEMS source of truth.
 */

import { el, icon } from '../utils/dom.js';
import { NAV_ITEMS } from '../config/constants.js';
import { router } from '../core/router.js';

function isActive(href, currentPath) {
  if (!currentPath) return false;
  if (href === '/') return currentPath === '/' || currentPath === '';
  return currentPath === href || currentPath.startsWith(href + '/');
}

export function createDesktopNav() {
  const nav = el('nav', { class: 'header__nav', 'aria-label': 'ناوبری اصلی' });
  const links = NAV_ITEMS.map((item) => {
    const a = el(
      'a',
      {
        class: 'nav-link',
        href: router.href(item.href),
        dataset: { navKey: item.key, navHref: item.href },
      },
      [item.label]
    );
    nav.appendChild(a);
    return a;
  });

  function refresh() {
    const current = router.getCurrent();
    const path = current?.path || '';
    for (const a of links) {
      const href = a.dataset.navHref || '/';
      a.classList.toggle('is-active', isActive(href, path));
    }
  }

  return { node: nav, refresh };
}

/**
 * Mobile context menu opened by the header hamburger.
 * Uses the same items, collapses on click/outside/Escape.
 */
export function openMobileNav(anchor) {
  // Remove any existing menu
  document.querySelectorAll('.mobile-nav').forEach((n) => n.remove());

  const current = router.getCurrent();
  const path = current?.path || '';

  const menu = el(
    'div',
    {
      class: 'mobile-nav',
      role: 'menu',
      'aria-label': 'منوی اصلی',
    },
    NAV_ITEMS.map((item) =>
      el(
        'a',
        {
          href: router.href(item.href),
          class: `mobile-nav__item${isActive(item.href, path) ? ' is-active' : ''}`,
          role: 'menuitem',
          on: { click: () => close() },
        },
        [
          el('span', { class: 'icon', style: { width: '16px', height: '16px' } }, [icon(item.icon)]),
          el('span', {}, [item.label]),
        ]
      )
    )
  );

  function close() {
    menu.remove();
    anchor?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', onKey, true);
  }
  function outside(e) {
    if (!menu.contains(e.target) && e.target !== anchor && !anchor?.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  document.body.appendChild(menu);
  anchor?.setAttribute('aria-expanded', 'true');

  // Defer so the click that opened the menu doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);

  return { close, menu };
}

export const nav = { createDesktopNav, openMobileNav };
export default nav;