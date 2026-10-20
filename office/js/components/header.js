/**
 * Top header: brand, desktop nav, theme toggle, mobile hamburger, user menu.
 */

import { el, icon } from '../utils/dom.js';
import { APP_NAME_FA, ROUTES } from '../config/constants.js';
import { router } from '../core/router.js';
import { createThemeToggle } from './theme-toggle.js';
import { createUserMenu } from './user-menu.js';
import { createDesktopNav, openMobileNav } from './nav.js';

export function mountHeader(root) {
  if (!root) return () => {};

  const container = el('div', { class: 'container' }, []);
  const bar = el('div', { class: 'header' }, []);

  // Brand
  const brand = el(
    'a',
    {
      class: 'header__brand',
      href: router.href(ROUTES.HOME),
      'aria-label': `${APP_NAME_FA} — خانه`,
    },
    [
      el('span', { class: 'header__brand-mark' }, ['O']),
      el('span', { style: { display: 'flex', flexDirection: 'column' } }, [
        el('span', { class: 'header__brand-name' }, ['The Office']),
        el('span', { class: 'header__brand-sub' }, ['بایگانی اداره']),
      ]),
    ]
  );

  // Desktop nav
  const desktopNav = createDesktopNav();

  // Actions
  const themeToggle = createThemeToggle();
  const userMenu = createUserMenu();

  const menuBtn = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn header__menu-toggle',
      'aria-label': 'منو',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
      on: {
        click: (e) => {
          e.stopPropagation();
          openMobileNav(menuBtn);
        },
      },
    },
    [icon('menu')]
  );

  const actions = el('div', { class: 'header__actions' }, [
    themeToggle,
    userMenu,
    menuBtn,
  ]);

  bar.append(brand, desktopNav.node, actions);
  container.appendChild(bar);
  root.appendChild(container);

  // Refresh active state on route change
  const onRoute = () => desktopNav.refresh();
  const offAfter = routerListener(onRoute);
  onRoute();

  return function cleanup() {
    root.innerHTML = '';
    offAfter?.();
  };
}

/** Lightweight bridge — router emits on bus, but we import lazily to avoid cycles. */
function routerListener(fn) {
  // Use hashchange to avoid importing bus here (avoids double wiring)
  const handler = () => fn();
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}

export default mountHeader;