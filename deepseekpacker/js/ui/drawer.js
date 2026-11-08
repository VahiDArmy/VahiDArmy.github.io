// Mobile drawer toggle for the sidebar.

import { el } from '../utils/dom.js';

let scrimEl = null;

export function initDrawer() {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menu-btn');
  if (!sidebar || !menuBtn) return;

  // Create scrim and append to body to ensure it covers everything
  scrimEl = el('div', { class: 'scrim', 'aria-hidden': 'true' });
  document.body.appendChild(scrimEl);

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });
  
  scrimEl.addEventListener('click', () => close());

  // Handle window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) close();
  });

  // Handle Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) close();
  });
  
  // Handle navigation to close drawer
  window.addEventListener('hashchange', () => {
    if (window.innerWidth <= 980) close();
  });
}

export function open() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.add('is-open');
  if (scrimEl) scrimEl.classList.add('is-open');
}

export function close() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.remove('is-open');
  if (scrimEl) scrimEl.classList.remove('is-open');
}

export function toggle() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  if (sidebar.classList.contains('is-open')) close();
  else open();
}
