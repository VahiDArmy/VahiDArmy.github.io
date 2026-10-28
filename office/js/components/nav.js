/**
 * Primary navigation — desktop inline nav + mobile context-menu.
 * Handles both internal (hash) and external (absolute) links safely.
 */

import { el, icon } from '../utils/dom.js';
import { NAV_ITEMS } from '../config/constants.js';
import { router } from '../core/router.js';

function isActive(href, currentPath) {
  if (!currentPath) return false;
  if (href === '/') return currentPath === '/' || currentPath === '';
  return currentPath === href || currentPath.startsWith(href + '/');
}

// Safely generate the href attribute based on link type
function getSafeHref(item) {
  return item.isExternal ? item.href : router.href(item.href);
}

export function createDesktopNav() {
  const nav = el('nav', { class: 'header__nav', 'aria-label': 'ناوبری اصلی' });
  const links = NAV_ITEMS.map((item) => {
    const attrs = {
      class: 'nav-link',
      href: getSafeHref(item),
      dataset: { navKey: item.key, navHref: item.href },
    };
    
    if (item.isExternal) {
      attrs.target = '_blank';
      attrs.rel = 'noopener noreferrer';
      attrs.title = 'باز شدن در تب جدید';
    }

    const a = el('a', attrs, [item.label]);
    nav.appendChild(a);
    return a;
  });

  function refresh() {
    const current = router.getCurrent();
    const path = current?.path || '';
    for (const a of links) {
      const item = NAV_ITEMS.find(i => i.key === a.dataset.navKey);
      // Only highlight internal links
      if (item && !item.isExternal) {
        a.classList.toggle('is-active', isActive(item.href, path));
      }
    }
  }

  return { node: nav, refresh };
}

/**
 * Mobile context menu opened by the header hamburger.
 */
export function openMobileNav(anchor) {
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
    NAV_ITEMS.map((item) => {
      const isExt = item.isExternal;
      const attrs = {
        href: getSafeHref(item),
        class: `mobile-nav__item${!isExt && isActive(item.href, path) ? ' is-active' : ''}`,
        role: 'menuitem',
        on: { click: () => close() },
      };
      
      if (isExt) {
        attrs.target = '_blank';
        attrs.rel = 'noopener noreferrer';
      }

      return el('a', attrs, [
        el('span', { class: 'icon', style: { width: '16px', height: '16px' } }, [icon(item.icon)]),
        el('span', {}, [item.label]),
        isExt ? el('span', { class: 'icon', style: { width: '12px', height: '12px', marginInlineStart: 'auto', opacity: 0.5 } }, [icon('external')]) : null
      ]);
    })
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

  setTimeout(() => {
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);

  return { close, menu };
}

export const nav = { createDesktopNav, openMobileNav };
export default nav;