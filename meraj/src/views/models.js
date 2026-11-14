/** Model atelier: stored free models, activation, favourites, real test calls, analytics. */
import { CONFIG } from '../config.js';
import { state, setState } from '../store.js';
import * as db from '../services/db.js';
import { syncFreeModels, latestModelSync, modelsAreStale, filterModels, sortModels, getModelOrFallback } from '../services/models.js';
import { buildAnalytics } from '../services/analytics.js';
import { createRequestSnapshot } from '../services/requestBuilder.js';
import { streamCompletion, errorRecordFrom } from '../services/openrouter.js';
import { getApiKey, saveSettings, setLastModel } from '../services/settings.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { reportError, openErrorDialog } from '../ui/errorDialog.js';
import { icon } from '../ui/icons.js';
import { renderErrorCard } from '../components/errorCard.js';
import { openRequestInspector } from '../components/requestInspector.js';
import {
  escapeHtml,
  formatContext,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTokens,
  modelBadges,
  modelHue,
  providerFromSlug,
  relativeTime,
  truncate,
  copyText,
} from '../utils.js';

let rootEl = null;
let ctx = null;
let events = [];
let eventsError = null;
let query = '';
let statusFilter = 'all';
let capabilityFilter = 'all';
let sortMode = 'active';
let analytics = null;
let usageMap = new Map();
let syncing = false;
let testBusy = false;

const CAPABILITIES = [
  ['all', 'All capabilities'],
  ['vision', 'Vision'],
  ['reasoning', 'Reasoning'],
  ['tools', 'Tools'],
  ['long', 'Long context'],
];

function usageFor(model) {
  return usageMap.get(model.slug) || null;
}

function statCard(label, value, sub, iconName) {
  return `<div class="stat-card">
    <span class="stat-card__icon">${icon(iconName, { size: 17 })}</span>
    <div><span class="stat-card__label">${escapeHtml(label)}</span><strong>${value}</strong><p>${escapeHtml(sub)}</p></div>
  </div>`;
}

function modelCard(model) {
  const usage = usageFor(model);
  const badges = modelBadges(model);
  const active = model.is_active !== false;
  const isRouter = model.slug === 'openrouter/free';
  return `<article class="model-card ${active ? '' : 'is-inactive'}" data-model-id="${model.id}">
    <div class="model-card__top">
      <span class="model-orb model-orb--large" style="--hue:${modelHue(model.slug)}">${isRouter ? icon('spark', { size: 20 }) : escapeHtml((model.provider || 'M').slice(0, 1))}</span>
      <div class="model-card__identity">
        <p class="model-card__provider">${escapeHtml(model.provider || providerFromSlug(model.slug))}</p>
        <h3>${escapeHtml(model.name)}</h3>
        <code class="model-card__slug" title="${escapeHtml(model.slug)}">${escapeHtml(model.slug)}</code>
      </div>
      <button type="button" class="icon-btn model-fav ${model.is_favorite ? 'is-on' : ''}" data-model-fav="${model.id}" aria-label="${model.is_favorite ? 'Remove from favourites' : 'Add to favourites'}" title="${model.is_favorite ? 'Favourite' : 'Add to favourites'}">${icon('star', { size: 17 })}</button>
    </div>
    <p class="model-card__desc">${escapeHtml(model.description || 'No description was published for this model.')}</p>
    <div class="model-card__tags">${badges.map((badge) => `<span class="tag tag--ghost">${escapeHtml(badge.label)}</span>`).join('')}${active ? '' : '<span class="tag tag--danger">Inactive</span>'}</div>
    <div class="model-card__metrics">
      <div><span>Context</span><strong>${formatContext(model.context_length)}</strong></div>
      <div><span>Requests</span><strong>${formatNumber(usage?.requests || 0)}</strong></div>
      <div><span>Tokens</span><strong>${formatTokens(usage?.tokens || 0)}</strong></div>
      <div><span>Success</span><strong>${usage?.successRate === null || usage?.successRate === undefined ? '—' : `${usage.successRate.toFixed(0)}%`}</strong></div>
    </div>
    <div class="model-card__foot">
      <button type="button" class="switch ${active ? 'is-on' : ''}" role="switch" aria-checked="${active}" data-model-toggle="${model.id}" ${isRouter ? 'disabled title="The router stays available by design"' : ''}>
        <span class="switch__track"><span class="switch__thumb"></span></span>
        <span>${active ? 'Active' : 'Deactivated'}</span>
      </button>
      <div class="model-card__actions">
        <button type="button" class="btn btn--small btn--ghost" data-model-details="${model.id}">${icon('info', { size: 14 })}<span>Details</span></button>
        <button type="button" class="btn btn--small btn--ghost" data-model-test="${model.id}" title="Send a real test request">${icon('zap', { size: 14 })}<span>Test</span></button>
        <button type="button" class="btn btn--small btn--primary" data-model-use="${model.id}">${icon('arrowRight', { size: 14 })}<span>Use</span></button>
      </div>
    </div>
  </article>`;
}

function filteredModels() {
  return sortModels(
    filterModels(state.models, { query, status: statusFilter, capability: capabilityFilter }),
    sortMode,
  );
}

function paintGrid() {
  const grid = rootEl?.querySelector('#model-grid');
  const count = rootEl?.querySelector('#model-count');
  if (!grid) return;
  const rows = filteredModels();
  if (count) count.textContent = `${rows.length} of ${state.models.length} models`;
  if (!rows.length) {
    grid.innerHTML = `<div class="model-empty">
      ${icon(query ? 'search' : 'cpu', { size: 30 })}
      <h3>${query ? 'No model matches this search' : 'No models stored yet'}</h3>
      <p>${query ? 'Try a shorter query or switch the filter.' : 'Fetch the current free-model catalogue from OpenRouter. The stored list is yours; deactivating a model never deletes its metadata.'}</p>
      <div class="model-empty__actions">
        ${query ? '<button type="button" class="btn btn--ghost" data-clear-filters>Clear filters</button>' : ''}
        <button type="button" class="btn btn--primary" data-sync-models>${icon('refresh', { size: 15 })}<span>Fetch free models</span></button>
      </div>
    </div>`;
    bindGrid();
    return;
  }
  grid.innerHTML = rows.map(modelCard).join('');
  bindGrid();
}

function bindGrid() {
  const grid = rootEl?.querySelector('#model-grid');
  if (!grid) return;
  grid.querySelectorAll('[data-model-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const model = state.models.find((item) => item.id === button.dataset.modelToggle);
      if (model) toggleModel(model);
    });
  });
  grid.querySelectorAll('[data-model-fav]').forEach((button) => {
    button.addEventListener('click', () => {
      const model = state.models.find((item) => item.id === button.dataset.modelFav);
      if (model) toggleFavorite(model);
    });
  });
  grid.querySelectorAll('[data-model-details]').forEach((button) => {
    button.addEventListener('click', () => {
      const model = state.models.find((item) => item.id === button.dataset.modelDetails);
      if (model) openModelDetails(model);
    });
  });
  grid.querySelectorAll('[data-model-test]').forEach((button) => {
    button.addEventListener('click', () => {
      const model = state.models.find((item) => item.id === button.dataset.modelTest);
      if (model) openModelTest(model);
    });
  });
  grid.querySelectorAll('[data-model-use]').forEach((button) => {
    button.addEventListener('click', () => {
      const model = state.models.find((item) => item.id === button.dataset.modelUse);
      if (model) useModel(model.slug);
    });
  });
  grid.querySelector('[data-sync-models]')?.addEventListener('click', (event) => {
    event.preventDefault();
    refreshCatalogue();
  });
  grid.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    query = '';
    statusFilter = 'all';
    capabilityFilter = 'all';
    renderPage();
  });
}

function renderPage() {
  if (!rootEl) return;
  const active = state.models.filter((model) => model.is_active !== false);
  const favorites = state.models.filter((model) => model.is_favorite);
  const avgContext = active.length
    ? Math.round(active.reduce((sum, model) => sum + (model.context_length || 0), 0) / active.length)
    : 0;
  const lastSync = latestModelSync(state.models);
  const routerUsage = usageMap.get('openrouter/free');
  const stale = modelsAreStale(state.models);
  const totalRequests = analytics?.totals.requests || 0;
  const totalTokens = analytics?.totals.tokens || 0;
  const success = analytics?.totals.successRate;

  rootEl.innerHTML = `<div class="page models-page">
    <header class="page-head">
      <button type="button" class="icon-btn page-menu" data-open-sidebar aria-label="Open conversations">${icon('menu', { size: 19 })}</button>
      <div class="page-head__copy">
        <p class="eyebrow"><span class="eyebrow__line"></span> Free-model intelligence</p>
        <h1>Model atelier</h1>
        <p>Fetch, inspect, and govern every free OpenRouter model. Deactivate the ones you do not need; their history stays intact, and the router remains available as a fallback.</p>
      </div>
      <div class="page-head__actions">
        <button type="button" class="btn btn--ghost" data-refresh-analytics>${icon('refresh', { size: 15 })}<span>Refresh metrics</span></button>
        <button type="button" class="btn btn--primary" data-sync-models ${syncing || state.modelsSyncing ? 'disabled' : ''}>${icon(syncing || state.modelsSyncing ? 'loader' : 'download', { size: 15, className: syncing || state.modelsSyncing ? 'spin' : '' })}<span>${syncing || state.modelsSyncing ? 'Syncing…' : 'Sync catalogue'}</span></button>
      </div>
    </header>

    <div class="stats-grid stats-grid--models">
      ${statCard('Active models', formatNumber(active.length), `${state.models.length} stored in your catalogue`, 'cpu')}
      ${statCard('Free models', formatNumber(state.models.length), 'Fetched from OpenRouter /models', 'spark')}
      ${statCard('Favourites', formatNumber(favorites.length), 'Kept first in quick picks', 'star')}
      ${statCard('Mean context', avgContext ? formatContext(avgContext) : '—', 'Across active models', 'layers')}
      ${statCard('Catalogue sync', lastSync ? relativeTime(lastSync) : 'never', stale ? 'Stale — refresh recommended' : `Fresh · ${state.models.length} models`, 'clock')}
      ${statCard('Recorded usage', formatTokens(totalTokens), `${formatNumber(totalRequests)} requests · ${success === null || success === undefined ? '—' : `${success.toFixed(0)}% success`}`, 'chart')}
    </div>

    ${state.modelsError ? `<div class="panel-error">${renderInlineError(state.modelsError, 'Catalogue sync error')}</div>` : ''}
    ${eventsError ? `<div class="panel-error">${renderInlineError(eventsError, 'Model analytics could not load')}</div>` : ''}

    <section class="router-card">
      <div class="router-card__glow" aria-hidden="true"></div>
      <div class="router-card__head">
        <span class="router-card__icon">${icon('spark', { size: 24 })}</span>
        <span class="tag tag--accent">Always available</span>
      </div>
      <div class="router-card__body">
        <p class="eyebrow">OpenRouter · openrouter/free</p>
        <h2>Free Models Router</h2>
        <p>One request, one free model chosen by OpenRouter. The exact model that answers is written into the chat as the new chat model and stamped on the reply. Nothing about the routing is hidden.</p>
        <div class="router-card__meta">
          <span>${icon('layers', { size: 13 })} ${formatContext(200000)} context</span>
          <span>${icon('activity', { size: 13 })} ${formatNumber(routerUsage?.requests || 0)} routed requests</span>
          <span>${icon('checkCircle', { size: 13 })} ${routerUsage?.successRate === null || routerUsage?.successRate === undefined ? 'no data' : `${routerUsage.successRate.toFixed(0)}% success`}</span>
        </div>
      </div>
      <div class="router-card__actions">
        <button type="button" class="btn btn--primary" data-router-use>${icon('arrowRight', { size: 16 })}<span>Use router</span></button>
        <button type="button" class="btn btn--ghost" data-router-test>${icon('zap', { size: 15 })}<span>Test it</span></button>
      </div>
    </section>

    <section class="model-toolbar">
      <div class="model-toolbar__top">
        <div class="searchfield searchfield--wide">${icon('search', { size: 17 })}<input id="model-search" class="input input--search" type="search" placeholder="Search name, provider, slug, or description…" value="${escapeHtml(query)}" autocomplete="off"></div>
        <div class="model-toolbar__right">
          <label class="field-inline"><span>Capability</span><select id="model-capability" class="input input--select">${CAPABILITIES.map(([value, label]) => `<option value="${value}" ${value === capabilityFilter ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          <label class="field-inline"><span>Sort</span><select id="model-sort" class="input input--select">
            ${[
              ['active', 'Active first'],
              ['name', 'Name'],
              ['context', 'Context window'],
              ['recent', 'Newest sync'],
              ['favorite', 'Favourites first'],
            ]
              .map(([value, label]) => `<option value="${value}" ${value === sortMode ? 'selected' : ''}>${label}</option>`)
              .join('')}
          </select></label>
        </div>
      </div>
      <div class="model-toolbar__bottom">
        <div class="segmented segmented--small">
          ${[
            ['all', 'All', state.models.length],
            ['active', 'Active', active.length],
            ['inactive', 'Inactive', state.models.length - active.length],
            ['favorite', 'Favourites', favorites.length],
          ]
            .map(([value, label, count]) => `<button type="button" class="segmented__item ${statusFilter === value ? 'is-active' : ''}" data-model-status="${value}">${label} <span>${count}</span></button>`)
            .join('')}
        </div>
        <span class="model-count" id="model-count"></span>
      </div>
    </section>

    <div class="model-grid" id="model-grid"></div>

    <section class="model-bulk">
      <div><span class="model-bulk__icon">${icon('sliders', { size: 16 })}</span><div><strong>Bulk hygiene</strong><p>Deactivate every model you have not starred. Nothing is deleted; the metadata and all analytics remain.</p></div></div>
      <div class="model-bulk__actions">
        <button type="button" class="btn btn--small btn--ghost" data-bulk-activate>${icon('check', { size: 14 })}<span>Activate all</span></button>
        <button type="button" class="btn btn--small btn--ghost" data-bulk-favorites>${icon('star', { size: 14 })}<span>Only favourites</span></button>
        <button type="button" class="btn btn--small btn--ghost" data-bulk-reset>${icon('refresh', { size: 14 })}<span>Reset flags</span></button>
      </div>
    </section>

    <p class="page-footnote">${icon('info', { size: 14 })} The catalogue is fetched from OpenRouter's public <code>/models</code> endpoint and stored per user in Supabase. Re-syncing never overwrites your on/off or favourite choices. Free eligibility is determined by zero prompt and completion pricing plus text output capability.</p>
  </div>`;

  paintGrid();
  bindPage();
}

function renderInlineError(error, title) {
  const raw = error.bodyText || JSON.stringify(error, null, 2);
  return `<div class="inline-error">
    <div class="inline-error__head">${icon('alert', { size: 17 })}<strong>${escapeHtml(title)}</strong><button type="button" class="link-btn" data-error-raw>Open raw error</button><button type="button" class="link-btn" data-error-retry>Retry</button></div>
    <p>${escapeHtml(error.message || 'No message returned.')}</p>
    <details><summary>Exact error</summary><pre>${escapeHtml(raw)}</pre></details>
  </div>`;
}

function bindPage() {
  rootEl.querySelector('[data-open-sidebar]')?.addEventListener('click', () => ctx?.openSidebar?.());
  rootEl.querySelector('[data-sync-models]')?.addEventListener('click', () => refreshCatalogue());
  rootEl.querySelector('[data-refresh-analytics]')?.addEventListener('click', () => loadEvents(true));
  rootEl.querySelector('[data-router-use]')?.addEventListener('click', () => useModel('openrouter/free'));
  rootEl.querySelector('[data-router-test]')?.addEventListener('click', () => {
    const model = getModelOrFallback(state.models, 'openrouter/free');
    openModelTest(model);
  });

  const search = rootEl.querySelector('#model-search');
  search?.addEventListener('input', () => {
    query = search.value;
    paintGrid();
  });
  rootEl.querySelector('#model-capability')?.addEventListener('change', (event) => {
    capabilityFilter = event.target.value;
    paintGrid();
  });
  rootEl.querySelector('#model-sort')?.addEventListener('change', (event) => {
    sortMode = event.target.value;
    paintGrid();
  });
  rootEl.querySelectorAll('[data-model-status]').forEach((button) => {
    button.addEventListener('click', () => {
      statusFilter = button.dataset.modelStatus;
      rootEl.querySelectorAll('[data-model-status]').forEach((item) => item.classList.toggle('is-active', item === button));
      paintGrid();
    });
  });

  rootEl.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    query = '';
    statusFilter = 'all';
    capabilityFilter = 'all';
    renderPage();
  });
  rootEl.querySelector('[data-bulk-activate]')?.addEventListener('click', () => bulkFlags(true));
  rootEl.querySelector('[data-bulk-favorites]')?.addEventListener('click', () => bulkFavoritesOnly());
  rootEl.querySelector('[data-bulk-reset]')?.addEventListener('click', () => bulkReset());

  rootEl.querySelectorAll('[data-error-raw]').forEach((button) => {
    button.addEventListener('click', () => openErrorDialog('Catalogue error', state.modelsError || eventsError));
  });
  rootEl.querySelectorAll('[data-error-retry]').forEach((button) => {
    button.addEventListener('click', () => (state.modelsError ? refreshCatalogue() : loadEvents(true)));
  });
}

async function loadEvents(showToast = false) {
  const { data, error } = await db.listEvents({ limit: CONFIG.limits.events });
  if (error) {
    eventsError = error;
    events = [];
    analytics = buildAnalytics([], state.models, { days: 'all' });
    usageMap = new Map();
    if (showToast) reportError('Could not load model analytics', error);
  } else {
    events = data || [];
    eventsError = null;
    analytics = buildAnalytics(events, state.models, { days: 'all' });
    usageMap = new Map(analytics.models.map((row) => [row.slug, row]));
    if (showToast) toast({ title: 'Metrics refreshed', message: `${formatNumber(events.length)} events aggregated.`, type: 'success', duration: 2400 });
  }
  renderPage();
}

async function refreshCatalogue() {
  if (syncing || state.modelsSyncing) return;
  syncing = true;
  setState({ modelsSyncing: true }, 'models-syncing');
  renderPage();
  const result = await syncFreeModels(state.user.id, { currentModels: state.models, force: true });
  syncing = false;
  if (result.error) {
    setState({ modelsSyncing: false, modelsError: result.error }, 'models-sync-error');
    reportError('Model catalogue sync failed', result.error);
    renderPage();
    return;
  }
  const { data, error } = await db.listModels();
  if (error) {
    setState({ modelsSyncing: false, modelsError: error }, 'models-read-error');
    reportError('The refreshed catalogue could not be read back', error);
    renderPage();
    return;
  }
  setState({ models: data || [], modelsLoaded: true, modelsSyncing: false, modelsError: null }, 'models-synced');
  toast({
    title: 'Catalogue synced',
    message: `${formatNumber((data || []).length)} free models stored. Your active and favourite flags were preserved.`,
    type: 'success',
    duration: 4200,
  });
  renderPage();
}

async function toggleModel(model) {
  if (model.slug === 'openrouter/free') {
    toast({ title: 'Router stays active', message: 'openrouter/free is the fallback route and cannot be deactivated.', type: 'info' });
    return;
  }
  const next = !(model.is_active !== false);
  const { data, error } = await db.updateModel(model.id, { is_active: next });
  if (error) {
    reportError('Could not change the model state', error);
    return;
  }
  setState({ models: state.models.map((item) => (item.id === model.id ? { ...item, ...(data || {}), is_active: next } : item)) }, 'model-updated');
  toast({
    title: next ? 'Model activated' : 'Model deactivated',
    message: next ? `${model.name} is back in quick picks.` : `${model.name} is hidden from quick picks. Its history and metadata stay.`,
    type: 'success',
    duration: 3000,
  });
  renderPage();
}

async function toggleFavorite(model) {
  const next = !model.is_favorite;
  const { data, error } = await db.updateModel(model.id, { is_favorite: next });
  if (error) {
    reportError('Could not update the favourite', error);
    return;
  }
  setState({ models: state.models.map((item) => (item.id === model.id ? { ...item, ...(data || {}), is_favorite: next } : item)) }, 'model-updated');
  toast({ title: next ? 'Favourite added' : 'Favourite removed', message: model.name, type: 'success', duration: 2200 });
  renderPage();
}

function useModel(slug) {
  const next = saveSettings({ defaultModel: slug });
  setState({ settings: next }, 'settings-changed');
  setLastModel(slug);
  toast({
    title: 'Model ready',
    message: `${slug === 'openrouter/free' ? 'The router will choose a free model.' : slug} is set as the default for a new chat.`,
    type: 'success',
    duration: 3200,
  });
  if (ctx?.newChat) ctx.newChat(true);
  else ctx?.navigate?.('/chat');
}

async function bulkUpdate(ids, patch, label) {
  if (!ids.length) {
    toast({ title: 'Nothing to do', message: 'No models matched that rule.', type: 'info' });
    return;
  }
  const { data, error } = await db.bulkUpdateModels(state.user.id, ids, patch);
  if (error) {
    reportError('Bulk update failed', error);
    return;
  }
  const byId = new Map((data || []).map((item) => [item.id, item]));
  setState(
    {
      models: state.models.map((model) => (byId.has(model.id) ? { ...model, ...byId.get(model.id) } : model)),
    },
    'models-bulk-updated',
  );
  toast({ title: 'Models updated', message: `${label} · ${ids.length} model(s).`, type: 'success', duration: 3200 });
  renderPage();
}

async function bulkFlags(active) {
  const ids = state.models.filter((model) => model.slug !== 'openrouter/free').map((model) => model.id);
  if (!ids.length) return;
  if (!active) {
    const confirmed = await confirmDialog({
      title: 'Deactivate every model?',
      message: 'The router remains active and every model can be reactivated individually. Nothing is deleted.',
      confirmLabel: 'Deactivate all',
      danger: true,
    });
    if (!confirmed) return;
  }
  await bulkUpdate(ids, { is_active: active }, active ? 'Activated all' : 'Deactivated all');
}

async function bulkFavoritesOnly() {
  const ids = state.models
    .filter((model) => !model.is_favorite && model.is_active !== false && model.slug !== 'openrouter/free')
    .map((model) => model.id);
  if (!ids.length) {
    toast({ title: 'Already tidy', message: 'There are no active, unstarred models to deactivate.', type: 'info' });
    return;
  }
  const confirmed = await confirmDialog({
    title: 'Keep only favourites active?',
    message: `${ids.length} active, unstarred model(s) will be deactivated. The router stays available. Nothing is deleted.`,
    confirmLabel: 'Deactivate unstarred',
    danger: true,
  });
  if (!confirmed) return;
  await bulkUpdate(ids, { is_active: false }, 'Only favourites remain active');
}

async function bulkReset() {
  const ids = state.models.filter((model) => model.slug !== 'openrouter/free').map((model) => model.id);
  await bulkUpdate(ids, { is_active: true }, 'All models reactivated');
}

function openModelDetails(model) {
  const usage = usageFor(model) || {};
  const supported = model.supported_parameters || [];
  const metadata = model.metadata || {};
  const modal = openModal({
    title: model.name,
    subtitle: `${model.provider || providerFromSlug(model.slug)} · ${model.slug}`,
    size: 'lg',
    className: 'model-details-modal',
    body: `<div class="model-details">
      <div class="model-details__hero">
        <span class="model-orb model-orb--large" style="--hue:${modelHue(model.slug)}">${model.slug === 'openrouter/free' ? icon('spark', { size: 21 }) : escapeHtml((model.provider || 'M').slice(0, 1))}</span>
        <div>
          <div class="model-details__tags">${modelBadges(model).map((badge) => `<span class="tag tag--ghost">${escapeHtml(badge.label)}</span>`).join('')}<span class="tag ${model.is_active !== false ? 'tag--ok' : 'tag--danger'}">${model.is_active !== false ? 'Active' : 'Inactive'}</span>${model.is_favorite ? '<span class="tag tag--accent">Favourite</span>' : ''}</div>
          <p class="model-details__desc">${escapeHtml(model.description || 'No description was published.')}</p>
        </div>
      </div>
      <div class="model-details__stats">
        <div><span>Context</span><strong>${formatContext(model.context_length)}</strong></div>
        <div><span>Max reply</span><strong>${model.max_completion_tokens ? formatTokens(model.max_completion_tokens) : '—'}</strong></div>
        <div><span>Requests</span><strong>${formatNumber(usage.requests || 0)}</strong></div>
        <div><span>Tokens</span><strong>${formatTokens(usage.tokens || 0)}</strong></div>
        <div><span>Avg latency</span><strong>${usage.avgLatency ? formatDuration(usage.avgLatency) : '—'}</strong></div>
        <div><span>Success</span><strong>${usage.successRate === null || usage.successRate === undefined ? '—' : `${usage.successRate.toFixed(0)}%`}</strong></div>
      </div>
      <dl class="model-details__facts">
        <div><dt>Slug</dt><dd><code>${escapeHtml(model.slug)}</code></dd></div>
        <div><dt>Canonical slug</dt><dd><code>${escapeHtml(model.canonical_slug || model.slug)}</code></dd></div>
        <div><dt>Input / output</dt><dd>${escapeHtml(`${(model.architecture?.input_modalities || []).join(', ') || 'unknown'} → ${(model.architecture?.output_modalities || []).join(', ') || 'unknown'}`)}</dd></div>
        <div><dt>Pricing</dt><dd>${escapeHtml(`${model.pricing?.prompt ?? '?'} prompt · ${model.pricing?.completion ?? '?'} completion`)}</dd></div>
        <div><dt>Last synced</dt><dd>${formatDateTime(model.last_synced_at)}</dd></div>
        <div><dt>Last used</dt><dd>${usage.lastUsed ? formatDateTime(usage.lastUsed) : 'never'}</dd></div>
        <div><dt>Expiration</dt><dd>${metadata.expiration_date ? formatDateTime(metadata.expiration_date) : 'not published'}</dd></div>
      </dl>
      <div class="model-details__params">
        <p>Supported parameters</p>
        <div>${supported.length ? supported.map((param) => `<span class="tag tag--ghost">${escapeHtml(param)}</span>`).join('') : '<span class="muted">capabilities unknown</span>'}</div>
      </div>
      <details class="model-details__raw"><summary>Provider metadata (JSON)</summary><pre>${escapeHtml(JSON.stringify(metadata, null, 2))}</pre></details>
      ${usage.errors ? `<p class="notice notice--warn">${icon('alert', { size: 14 })} ${formatNumber(usage.errors)} recorded error(s) for this model. Open Analytics for exact stored error messages.</p>` : ''}
    </div>`,
    actions: [
      { label: 'Test model', variant: 'ghost', icon: 'zap', close: false, onClick: () => { modal.close(); window.setTimeout(() => openModelTest(model), 170); } },
      { label: 'Use in chat', variant: 'ghost', icon: 'arrowRight', onClick: () => useModel(model.slug) },
      { label: 'Set as default', variant: 'primary', icon: 'check', onClick: () => useModel(model.slug) },
    ],
  });
  return modal;
}

/* ───────────────────────────── test a model ───────────────────────────── */

function openModelTest(model) {
  if (!getApiKey()) {
    toast({
      title: 'OpenRouter key required',
      message: 'A test sends a real request, so it needs your key. Add one in Settings first.',
      type: 'warning',
      actions: [{ label: 'Open settings', onClick: () => ctx?.navigate?.('/settings') }],
    });
    return;
  }
  let requestSnapshot = null;
  let result = null;
  let error = null;
  const modal = openModal({
    title: `Test ${model.name}`,
    subtitle: 'One real, minimal request through the same builder and transport as chat.',
    size: 'lg',
    body: `<div class="model-test">
      <div class="model-test__note">${icon('info', { size: 16 })}<p>This sends a real request to OpenRouter with your key. Free models may rate-limit. The test is not added to your conversations or analytics.</p></div>
      <label class="field-label" for="model-test-prompt">Test prompt</label>
      <textarea id="model-test-prompt" class="input textarea" rows="3">Reply with exactly: OK</textarea>
      <div class="model-test__actions">
        <button type="button" class="btn btn--primary" data-run-test>${icon('zap', { size: 15 })}<span>Send test request</span></button>
        <button type="button" class="btn btn--ghost" data-test-request disabled>${icon('code', { size: 15 })}<span>Exact request</span></button>
      </div>
      <div class="model-test__result" data-test-result>
        <div class="test-empty">${icon('activity', { size: 22 })}<p>No test has run yet. The provider response will appear here exactly as received.</p></div>
      </div>
    </div>`,
    actions: [
      { label: 'Close', variant: 'ghost' },
      {
        label: 'Run test',
        variant: 'primary',
        icon: 'zap',
        close: false,
        onClick: async () => {
          if (testBusy) return false;
          const prompt = modal.body.querySelector('#model-test-prompt')?.value || 'Reply with exactly: OK';
          const resultEl = modal.body.querySelector('[data-test-result]');
          const requestButton = modal.body.querySelector('[data-test-request]');
          testBusy = true;
          resultEl.innerHTML = `<div class="test-running"><span class="boot-spinner"></span><p>Calling ${escapeHtml(model.name)} through OpenRouter…</p></div>`;
          try {
            requestSnapshot = await createRequestSnapshot({
              conversation: {
                id: null,
                title: 'Model test',
                model_slug: model.slug,
                system_prompt: '',
                params: { temperature: 0.2, top_p: 1, max_tokens: 256, reasoning: 'off' },
              },
              model,
              path: [{ role: 'user', content: prompt }],
              settings: { ...state.settings, stream: false },
              stream: false,
            });
            requestButton.disabled = false;
            result = await streamCompletion({
              requestSnapshot,
              apiKey: getApiKey(),
              onDelta: () => {},
            });
            error = null;
            resultEl.innerHTML = `<div class="test-result test-result--ok">
              <div class="test-result__head">${icon('checkCircle', { size: 17 })}<strong>${escapeHtml(model.name)} answered</strong><span class="mono">${formatDuration(result.latencyMs)}</span></div>
              <pre class="verbatim" tabindex="0">${escapeHtml(result.content || '(The provider returned no visible content.)')}</pre>
              <dl class="test-meta">
                <div><dt>Actual model</dt><dd><code>${escapeHtml(result.model || model.slug)}</code></dd></div>
                <div><dt>Provider</dt><dd>${escapeHtml(result.provider || 'not reported')}</dd></div>
                <div><dt>Usage</dt><dd>${result.usage ? `${formatNumber(result.usage.prompt_tokens)} prompt · ${formatNumber(result.usage.completion_tokens)} completion` : 'not reported'}</dd></div>
                <div><dt>Finish</dt><dd>${escapeHtml(result.finishReason || 'not reported')}</dd></div>
              </dl>
            </div>`;
          } catch (caught) {
            error = errorRecordFrom(caught);
            resultEl.innerHTML = `<div class="test-result test-result--error">
              <div class="test-result__head">${icon('xCircle', { size: 17 })}<strong>Test failed — raw provider response</strong><span class="mono">${error.status ? `HTTP ${error.status}` : error.kind}</span></div>
              ${renderErrorCard(error, { messageId: null, canRetry: false })}
            </div>`;
          } finally {
            testBusy = false;
            requestButton.disabled = !requestSnapshot;
          }
          return false;
        },
      },
    ],
    footerNote: 'Tests use the exact same request serializer and streaming parser as normal chat.',
  });

  modal.body.querySelector('#model-test-prompt')?.focus();
  modal.body.querySelector('[data-run-test]')?.addEventListener('click', () => {
    modal.root.querySelector('[data-action-index="1"]')?.click();
  });
  modal.body.querySelector('[data-test-request]')?.addEventListener('click', async () => {
    if (!requestSnapshot) return;
    await openRequestInspector({
      snapshot: requestSnapshot,
      preview: false,
      subtitle: 'This snapshot was sent by the model test. It is not stored in your conversation history.',
    });
  });
  const resultEl = modal.body.querySelector('[data-test-result]');
  resultEl?.addEventListener('click', async (event) => {
    if (event.target.closest('[data-copy-test]')) {
      const text = result?.content || error?.bodyText || '';
      try {
        await copyText(text);
        toast({ title: 'Test output copied', type: 'success' });
      } catch {
        toast({ title: 'Clipboard unavailable', type: 'error' });
      }
    }
  });
  void error;
}

/* ───────────────────────────── mount ───────────────────────────── */

export async function mountModels(root, context = {}) {
  rootEl = root;
  ctx = context;
  query = '';
  statusFilter = 'all';
  capabilityFilter = 'all';
  sortMode = 'active';
  events = [];
  eventsError = null;
  analytics = buildAnalytics([], state.models, { days: 'all' });
  usageMap = new Map();

  rootEl.innerHTML = `<div class="page-loading"><span class="boot-spinner"></span><p>Reading the model catalogue…</p></div>`;
  const { data, error } = await db.listEvents({ limit: CONFIG.limits.events });
  if (error) {
    eventsError = error;
  } else {
    events = data || [];
    analytics = buildAnalytics(events, state.models, { days: 'all' });
    usageMap = new Map(analytics.models.map((row) => [row.slug, row]));
  }
  renderPage();
}

export function unmountModels() {
  rootEl = null;
  ctx = null;
  events = [];
  analytics = null;
  usageMap = new Map();
}
