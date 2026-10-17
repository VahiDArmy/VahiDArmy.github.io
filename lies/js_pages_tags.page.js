/* ============================================================
   js/pages/tags.page.js
   UPDATED: Added tabs for Lie Types and Moods.
   ============================================================ */

import { el, clear } from '../utils/dom.js';
import * as categoriesService from '../services/categories.service.js';
import * as tagsService from '../services/tags.service.js';
import * as taxonomyService from '../services/taxonomy.service.js';
import { categoriesManager } from '../features/tags/categories-manager.js';
import { tagsManager } from '../features/tags/tags-manager.js';
import { renderTaxonomyManager } from '../features/tags/taxonomy-manager.js';
import { tabs } from '../ui/tabs.js';
import { skeletonPage } from '../ui/skeleton.js';

export async function renderTags(container) {
  container.appendChild(skeletonPage({ variant: 'list' }));

  let categories = []; let counts = {}; let tags = []; let lieTypes = []; let moods = [];

  const reload = async () => {
    [categories, counts, tags, lieTypes, moods] = await Promise.all([
      categoriesService.list().catch(() => []),
      categoriesService.countLies().catch(() => ({})),
      tagsService.withCounts().catch(() => []),
      taxonomyService.listTypes().catch(() => []),
      taxonomyService.listMoods().catch(() => []),
    ]);
  };

  try { await reload(); }
  catch (err) { clear(container); container.appendChild(renderError(err)); return; }

  clear(container);
  const page = el('div', { class: 'page page--tags' });

  const head = el('header', { class: 'page-head' });
  const headLeft = el('div', { class: 'page-head__left' });
  headLeft.appendChild(el('h1', { class: 'page-title' }, { children: [el('span', { class: 'page-title__icon' }, { children: ['🏷️'] }), 'مدیریت داده‌ها'] }));
  head.appendChild(headLeft);
  page.appendChild(head);

  const tabHost = el('div', { class: 'tags-tabs' });
  const contentHost = el('div', { class: 'tags-content' });

  const renderContent = (tab) => {
    clear(contentHost);
    if (tab === 'categories') contentHost.appendChild(categoriesManager({ categories, counts, onChange: async () => { await reload(); renderContent('categories'); } }));
    else if (tab === 'tags') contentHost.appendChild(tagsManager({ tags, onChange: async () => { await reload(); renderContent('tags'); } }));
    else if (tab === 'types') contentHost.appendChild(renderTaxonomyManager('type', lieTypes, async () => { await reload(); renderContent('types'); }));
    else if (tab === 'moods') contentHost.appendChild(renderTaxonomyManager('mood', moods, async () => { await reload(); renderContent('moods'); }));
  };

  const tabsEl = tabs({
    items: [
      { id: 'categories', label: 'دسته‌بندی‌ها', icon: '📁', badge: categories.length },
      { id: 'tags', label: 'برچسب‌ها', icon: '🏷️', badge: tags.length },
      { id: 'types', label: 'انواع دروغ', icon: '🎭', badge: lieTypes.length },
      { id: 'moods', label: 'حال و احساس', icon: '😶', badge: moods.length },
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