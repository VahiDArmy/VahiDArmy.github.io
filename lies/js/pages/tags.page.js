/* ============================================================
   js/pages/tags.page.js
   Tabs: categories | tags
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as categoriesService from '../services/categories.service.js';
import * as tagsService from '../services/tags.service.js';
import { categoriesManager } from '../features/tags/categories-manager.js';
import { tagsManager } from '../features/tags/tags-manager.js';
import { tabs } from '../ui/tabs.js';
import { skeletonPage } from '../ui/skeleton.js';
import { emptyState } from '../ui/empty-state.js';

/**
 * @param {HTMLElement} container
 */
export async function renderTags(container) {
  container.appendChild(skeletonPage({ variant: 'list' }));

  let categories = [];
  let counts = {};
  let tags = [];

  const reload = async () => {
    [categories, counts, tags] = await Promise.all([
      categoriesService.list().catch(() => []),
      categoriesService.countLies().catch(() => ({})),
      tagsService.withCounts().catch(() => []),
    ]);
  };

  try {
    await reload();
  } catch (err) {
    clear(container);
    container.appendChild(renderError(err));
    return;
  }

  clear(container);

  const page = el('div', { class: 'page page--tags' });

  // Header
  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, {
    children: [el('span', { class: 'page-title__icon' }, { children: ['🏷️'] }), 'دسته‌ها و برچسب‌ها'],
  }));
  headLeft.appendChild(el('p', { class: 'page-subtitle' }, {
    children: ['دسته‌بندی‌های بزرگ و برچسب‌های ریز برای سازمان‌دهی بهتر دروغ‌ها.'],
  }));
  head.appendChild(headLeft);
  page.appendChild(head);

  // Tabs
  const tabHost = el('div', { class: 'tags-tabs' });
  const contentHost = el('div', { class: 'tags-content' });

  const renderContent = (tab) => {
    clear(contentHost);
    if (tab === 'categories') {
      contentHost.appendChild(categoriesManager({
        categories,
        counts,
        onChange: async () => { await reload(); renderContent('categories'); },
      }));
    } else {
      contentHost.appendChild(tagsManager({
        tags,
        onChange: async () => { await reload(); renderContent('tags'); },
      }));
    }
  };

  const tabsEl = tabs({
    items: [
      { id: 'categories', label: 'دسته‌بندی‌ها', icon: '📁', badge: categories.length },
      { id: 'tags', label: 'برچسب‌ها', icon: '🏷️', badge: tags.length },
    ],
    active: 'categories',
    onChange: (tab) => renderContent(tab),
    variant: 'pill',
  });

  tabHost.appendChild(tabsEl);
  page.appendChild(tabHost);
  page.appendChild(contentHost);

  renderContent('categories');

  container.appendChild(page);
}

function renderError(err) {
  const box = el('div', { class: 'page-error' });
  box.appendChild(el('div', { class: 'page-error__icon' }, { children: ['⚠️'] }));
  box.appendChild(el('h2', { class: 'page-error__title' }, { children: ['خطا'] }));
  box.appendChild(el('p', { class: 'page-error__message' }, { children: [err?.message || 'خطای نامشخص'] }));
  return box;
}

export default { renderTags };