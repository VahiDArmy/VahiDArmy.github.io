/** Model chooser that can be opened mid-conversation. */
import {
  escapeHtml,
  formatContext,
  formatDuration,
  formatTokens,
  modelBadges,
  modelHue,
  prettyModelName,
  providerFromSlug,
} from '../utils.js';
import { getModelOrFallback, sortModels } from '../services/models.js';
import { openModal } from '../ui/modal.js';
import { icon } from '../ui/icons.js';
import { toast } from '../ui/toast.js';

function modelRow(model, currentSlug, usage) {
  const selected = model.slug === currentSlug;
  const active = model.is_active !== false;
  const badges = modelBadges(model);
  return `<button type="button" class="model-pick ${selected ? 'is-selected' : ''} ${active ? '' : 'is-inactive'}" data-pick-slug="${escapeHtml(model.slug)}" ${active ? '' : 'data-inactive="true"'} aria-pressed="${selected}">
    <span class="model-pick__orb" style="--hue:${modelHue(model.slug)}">${model.slug === 'openrouter/free' ? icon('spark', { size: 17 }) : escapeHtml((model.provider || 'M').slice(0, 1))}</span>
    <span class="model-pick__copy">
      <span class="model-pick__title">${escapeHtml(model.name)}${model.is_favorite ? `<span class="fav-mark" title="Favourite">${icon('star', { size: 12 })}</span>` : ''}</span>
      <span class="model-pick__meta">
        <span>${escapeHtml(model.provider || providerFromSlug(model.slug))}</span>
        <i></i>
        <span>${formatContext(model.context_length)} context</span>
        ${usage?.requests ? `<i></i><span>${usage.requests} requests</span>` : ''}
        ${usage?.avgLatency ? `<i></i><span>${formatDuration(usage.avgLatency)}</span>` : ''}
      </span>
      <span class="model-pick__badges">
        ${badges.slice(0, 4).map((badge) => `<span class="tag tag--ghost">${escapeHtml(badge.label)}</span>`).join('')}
        ${!active ? '<span class="tag tag--danger">Inactive</span>' : ''}
      </span>
    </span>
    <span class="model-pick__check">${selected ? icon('checkCircle', { size: 18 }) : active ? icon('chevronRight', { size: 16 }) : icon('lock', { size: 15 })}</span>
  </button>`;
}

/**
 * @param {object} options
 * @param {string} options.currentSlug
 * @param {Array} options.models
 * @param {Function} options.onSelect
 * @param {Function} options.onManage
 * @param {Map<string, object>} [options.usageByModel]
 */
export function openModelPicker({ currentSlug, models = [], onSelect, onManage, usageByModel = new Map() }) {
  const active = models.filter((model) => model.is_active !== false || model.slug === currentSlug || model.slug === 'openrouter/free');
  const favorites = active.filter((model) => model.is_favorite);
  let tab = 'active';
  let query = '';

  const body = document.createElement('div');
  body.className = 'model-picker';
  body.innerHTML = `
    <div class="model-picker__current">
      <span>Current chat model</span>
      <strong>${escapeHtml(currentSlug === 'openrouter/free' ? 'Free Models Router' : getModelOrFallback(models, currentSlug)?.name || prettyModelName(currentSlug))}</strong>
      <p>Changing the model affects the next reply only. Earlier answers keep their own model label.</p>
    </div>
    <div class="model-picker__tools">
      <div class="searchfield searchfield--compact">${icon('search', { size: 16 })}<input type="search" class="input input--search" placeholder="Search models, providers, capabilities…" data-model-search autocomplete="off"></div>
      <div class="segmented segmented--small" role="tablist" aria-label="Model filters">
        <button type="button" class="segmented__item is-active" data-model-tab="active">Active <span>${active.length}</span></button>
        <button type="button" class="segmented__item" data-model-tab="favorites">Favourites <span>${favorites.length}</span></button>
        <button type="button" class="segmented__item" data-model-tab="all">All <span>${models.length}</span></button>
      </div>
    </div>
    <div class="model-picker__list" data-model-list></div>
    <p class="model-picker__hint">${icon('info', { size: 14 })} Inactive models stay in your catalogue but are hidden from quick picks. The router is always available.</p>
  `;

  const modal = openModal({
    title: 'Choose a model',
    subtitle: 'Free endpoints via OpenRouter. Switch at any point in the conversation.',
    body,
    size: 'lg',
    className: 'model-picker-modal',
    actions: [
      { label: 'Manage models', variant: 'ghost', icon: 'cpu', close: false, onClick: () => { modal.close(); window.setTimeout(() => onManage?.(), 180); } },
      { label: 'Close', variant: 'primary' },
    ],
  });

  const list = body.querySelector('[data-model-list]');
  const search = body.querySelector('[data-model-search]');

  function filtered() {
    let rows = tab === 'active' ? active : tab === 'favorites' ? favorites : models;
    if (query) {
      const needle = query.toLowerCase();
      rows = rows.filter((model) =>
        `${model.name} ${model.slug} ${model.provider} ${model.description}`.toLowerCase().includes(needle),
      );
    }
    return sortModels(rows, 'favorite');
  }

  function paint() {
    const rows = filtered();
    if (!rows.length) {
      list.innerHTML = `<div class="picker-empty">${icon('search', { size: 24 })}<p>No model matches this search.</p><button type="button" class="btn btn--small btn--ghost" data-picker-reset>Clear search</button></div>`;
      return;
    }
    list.innerHTML = rows
      .map((model) => modelRow(model, currentSlug, usageByModel.get(model.slug)))
      .join('');
  }

  paint();

  search.addEventListener('input', () => {
    query = search.value.trim();
    paint();
  });
  body.addEventListener('click', (event) => {
    const tabButton = event.target.closest('[data-model-tab]');
    if (tabButton) {
      tab = tabButton.dataset.modelTab;
      body.querySelectorAll('[data-model-tab]').forEach((button) => button.classList.toggle('is-active', button === tabButton));
      paint();
      return;
    }
    if (event.target.closest('[data-picker-reset]')) {
      query = '';
      search.value = '';
      paint();
      search.focus();
      return;
    }
    const row = event.target.closest('[data-pick-slug]');
    if (!row) return;
    if (row.dataset.inactive === 'true') {
      toast({ title: 'Model is inactive', message: 'Reactivate it in Model Atelier before selecting it here.', type: 'warning' });
      return;
    }
    const slug = row.dataset.pickSlug;
    modal.close();
    window.setTimeout(() => onSelect?.(slug), 120);
  });

  requestAnimationFrame(() => search.focus());
  return modal;
}

export function routerNotice() {
  return `The router chooses a free model for each request and reports the exact model that answered. When it answers, this chat adopts that model as its chat model, exactly as required.`;
}
