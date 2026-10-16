/* ============================================================
   js/pages/settings.page.js
   Settings tabs: profile / appearance / data / account / about
   ============================================================ */

import { el } from '../utils/dom.js';
import { tabs } from '../ui/tabs.js';
import { profileSection } from '../features/settings/profile-section.js';
import { appearanceSection } from '../features/settings/appearance-section.js';
import { dataSection } from '../features/settings/data-section.js';
import { accountSection } from '../features/settings/account-section.js';
import { aboutSection } from '../features/settings/about-section.js';

const TABS = [
  { id: 'profile', label: 'پروفایل', icon: '👤' },
  { id: 'appearance', label: 'ظاهر', icon: '🎨' },
  { id: 'data', label: 'داده‌ها', icon: '💾' },
  { id: 'account', label: 'حساب', icon: '🔐' },
  { id: 'about', label: 'درباره', icon: 'ℹ️' },
];

/**
 * @param {HTMLElement} container
 */
export function renderSettings(container) {
  const page = el('div', { class: 'page page--settings' });

  // Header
  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['⚙️'] }), 'تنظیمات'],
  }));
  headLeft.appendChild(el('p', { class: 'page-subtitle' }, {
    children: ['همهٔ چیزهایی که می‌توانی در این فضا شخصی‌سازی کنی.'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  // Tabs host
  const tabsHost = el('div', { class: 'settings-tabs' });
  const content = el('div', { class: 'settings-content' });
  page.appendChild(tabsHost);
  page.appendChild(content);

  const renderTab = (id) => {
    content.innerHTML = '';
    let section;
    switch (id) {
      case 'profile':    section = profileSection(); break;
      case 'appearance': section = appearanceSection(); break;
      case 'data':       section = dataSection(); break;
      case 'account':    section = accountSection(); break;
      case 'about':
      default:           section = aboutSection(); break;
    }
    content.appendChild(section);
  };

  const tabsEl = tabs({
    items: TABS,
    active: 'profile',
    onChange: (id) => renderTab(id),
    variant: 'pill',
    className: 'settings-tabs__bar',
  });
  tabsHost.appendChild(tabsEl);

  renderTab('profile');
  container.appendChild(page);
}

export default { renderSettings };