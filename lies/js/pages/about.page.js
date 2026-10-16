/* ============================================================
   js/pages/about.page.js
   Standalone About page (also reused in settings)
   ============================================================ */

import { el } from '../utils/dom.js';
import { aboutSection } from '../features/settings/about-section.js';

export function renderAbout(container) {
  const page = el('div', { class: 'page page--about' });

  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['ℹ️'] }), 'درباره'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  page.appendChild(aboutSection());
  container.appendChild(page);
}

export default { renderAbout };