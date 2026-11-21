import { AUTO_MODEL } from '../lib/config.js';
import { state, emit } from '../lib/state.js';
import * as db from '../lib/db.js';
import { fetchFreeModels } from '../lib/openrouter.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { escapeHtml, formatNum, prettyModel, debounce } from '../lib/utils.js';
import { updateSettings } from '../lib/prefs.js';
import { openModal, closeModal } from './overlay.js';
import { toast, toastError } from './toast.js';

export function getModelRecord(modelId) {
  if (!modelId) return null;
  return state.models.find((m) => m.model_id === modelId) || null;
}

export function modelLabel(modelId) {
  if (!modelId) return t('No model');
  if (modelId === AUTO_MODEL) return `${t('Auto router')} · openrouter/free`;
  const record = getModelRecord(modelId);
  return record?.name || prettyModel(modelId);
}

/** Resolve the model a conversation will actually request right now. */
export function effectiveModelId(conversation = state.conversation) {
  const wanted = conversation?.model_id || state.settings?.defaultModel || AUTO_MODEL;
  if (wanted === AUTO_MODEL) return AUTO_MODEL;
  const record = getModelRecord(wanted);
  if (!record) return AUTO_MODEL;
  if (record.active === false || record.available === false) return AUTO_MODEL;
  return wanted;
}

export function activeModels() {
  return state.models.filter((m) => m.active !== false && m.available !== false);
}

export function modelIsUsable(modelId) {
  if (modelId === AUTO_MODEL) return true;
  const record = getModelRecord(modelId);
  return Boolean(record && record.active !== false && record.available !== false);
}

export async function ensureCatalog() {
  if (!state.user) return;
  if (state.models.length > 0) return;
  await syncFreeModels({ silent: true });
}

let lastSyncSummary = null;

export async function syncFreeModels({ silent = false } = {}) {
  if (!state.user) return;
  if (state.syncing) return;
  state.syncing = true;
  emit('models-sync', { syncing: true });
  try {
    const key = state.profile?.openrouter_key || '';
    const { free, all } = await fetchFreeModels(key);
    const existing = state.models;
    const existingById = new Map(existing.map((m) => [m.model_id, m]));
    const nowIso = new Date().toISOString();

    const toInsert = [];
    const toUpdate = [];
    let newCount = 0;
    let updatedCount = 0;

    for (const model of free) {
      const current = existingById.get(model.model_id);
      if (!current) {
        toInsert.push({
          user_id: state.user.id,
          model_id: model.model_id,
          name: model.name,
          description: model.description,
          context_length: model.context_length,
          pricing: model.pricing,
          architecture: model.architecture,
          supported_parameters: model.supported_parameters,
          is_free: true,
          active: true,
          available: true,
          favorite: false,
        });
        newCount++;
      } else {
        const patch = {};
        if (current.name !== model.name) patch.name = model.name;
        if ((current.description || '') !== (model.description || '')) patch.description = model.description;
        if (Number(current.context_length || 0) !== Number(model.context_length || 0)) {
          patch.context_length = model.context_length;
        }
        if (JSON.stringify(current.supported_parameters || []) !== JSON.stringify(model.supported_parameters || [])) {
          patch.supported_parameters = model.supported_parameters;
        }
        if (current.available === false) patch.available = true;
        if (Object.keys(patch).length) {
          toUpdate.push({ model_id: model.model_id, patch });
          updatedCount++;
        }
      }
    }

    if (toInsert.length) await db.insertModelRows(toInsert);

    // Models that vanished from the free catalog become unavailable (never deleted).
    const freeIds = new Set(free.map((m) => m.model_id));
    const stale = existing.filter((m) => !freeIds.has(m.model_id) && m.available !== false);
    if (stale.length) {
      await db.updateModelRows(
        state.user.id,
        stale.map((m) => ({ model_id: m.model_id, patch: { available: false } })),
      );
    }
    if (toUpdate.length) await db.updateModelRows(state.user.id, toUpdate);

    state.models = await db.listModels(state.user.id);
    lastSyncSummary = { newCount, updatedCount, total: free.length, all, at: nowIso };
    emit('models-changed', lastSyncSummary);
    if (!silent) {
      toast(
        t('{total} free models · {n} new · {u} updated · no duplicates', {
          total: free.length,
          n: newCount,
          u: updatedCount,
        }),
        { type: 'ok', title: t('Catalog synced') },
      );
    }
    return lastSyncSummary;
  } catch (error) {
    if (!silent) toastError(t('Model sync failed'), error);
    else console.warn('silent model sync failed', error);
    return null;
  } finally {
    state.syncing = false;
    emit('models-sync', { syncing: false });
  }
}

export async function setConversationModel(modelId) {
  if (!state.user) return;
  if (!state.conversation) {
    updateSettings({ defaultModel: modelId });
    toast(t('Default model set to {m}', { m: modelLabel(modelId) }), { type: 'info' });
    emit('models-changed');
    return;
  }
  try {
    const updated = await db.updateConversation(state.conversation.id, { model_id: modelId });
    if (updated) state.conversation = { ...state.conversation, ...updated };
    const cached = state.conversations.find((c) => c.id === state.conversation.id);
    if (cached) cached.model_id = modelId;
    emit('conversation-changed');
    emit('conversations-changed');
    toast(t('This chat now uses {m}', { m: modelLabel(modelId) }), { type: 'info' });
  } catch (error) {
    toastError(t('Could not switch model'), error);
  }
}

export async function toggleModelActive(modelId) {
  const record = getModelRecord(modelId);
  if (!record || !state.user) return;
  const next = record.active === false;
  record.active = next;
  emit('models-changed');
  try {
    await db.updateModel(state.user.id, modelId, { active: next });
    if (!next && state.conversation?.model_id === modelId) {
      toast(t('That model is now inactive. This chat falls back to the auto router.'), { type: 'info' });
      emit('conversation-changed');
    }
  } catch (error) {
    record.active = !next;
    emit('models-changed');
    toastError(t('Could not update the model'), error);
  }
}

export async function toggleModelFavorite(modelId) {
  const record = getModelRecord(modelId);
  if (!record || !state.user) return;
  record.favorite = !record.favorite;
  emit('models-changed');
  try {
    await db.updateModel(state.user.id, modelId, { favorite: record.favorite });
  } catch (error) {
    record.favorite = !record.favorite;
    emit('models-changed');
    toastError(t('Could not update the model'), error);
  }
}

export async function toggleAutoLock() {
  if (!state.conversation) {
    updateSettings({ lockAutoModel: !state.settings.lockAutoModel });
    emit('models-changed');
    return;
  }
  const next = !state.conversation.lock_auto_model;
  state.conversation.lock_auto_model = next;
  emit('conversation-changed');
  try {
    await db.updateConversation(state.conversation.id, { lock_auto_model: next });
    toast(
      next
        ? t('The first resolved model will be locked in for this chat.')
        : t('openrouter/free stays pinned; each reply still reports its real model.'),
      { type: 'info' },
    );
  } catch (error) {
    state.conversation.lock_auto_model = !next;
    emit('conversation-changed');
    toastError(t('Could not save the lock setting'), error);
  }
}

/* -------------------------------- picker UI ------------------------------- */

let filter = 'active';
let searchTerm = '';

function filterModels() {
  const q = searchTerm.trim().toLowerCase();
  let list = state.models;
  if (filter === 'active') list = list.filter((m) => m.active !== false && m.available !== false);
  if (filter === 'inactive') list = list.filter((m) => m.active === false || m.available === false);
  if (filter === 'favorites') list = list.filter((m) => m.favorite);
  if (q) {
    list = list.filter(
      (m) =>
        m.model_id.toLowerCase().includes(q) ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q),
    );
  }
  return list;
}

export function openModelPicker() {
  const selectedId = effectiveModelId();
  const conversationModel = state.conversation?.model_id || state.settings.defaultModel || AUTO_MODEL;

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="auto-row ${conversationModel === AUTO_MODEL ? 'selected' : ''}" id="auto-row">
      <div class="auto-orb">${icon('zap')}</div>
      <div class="model-main" data-select-model="${AUTO_MODEL}">
        <div class="model-name">${t('Auto router')} <span class="badge accent">${t('free')}</span></div>
        <div class="model-id">openrouter/free</div>
        <div class="model-desc">${t('OpenRouter picks a free model for each request. The real model is reported on every reply.')}</div>
      </div>
      <div class="model-controls">
        ${conversationModel === AUTO_MODEL ? `<span class="badge ok">${t('Selected')}</span>` : ''}
      </div>
    </div>

    <div class="model-search">
      <input class="input" id="model-search" placeholder="${t('Search {n} free models…', { n: state.models.length })}" value="${escapeHtml(
        searchTerm,
      )}" dir="auto" />
      <button class="btn btn-sm" id="sync-models">${state.syncing ? `<span class="spin">${icon('refresh')}</span>` : icon('refresh')} ${t('Sync free models')}</button>
    </div>

    <div class="pill-row" style="margin-bottom:8px">
      ${['active', 'all', 'favorites', 'inactive']
        .map(
          (id) =>
            `<button class="chip ${filter === id ? 'is-accent' : ''}" data-model-filter="${id}">${t(
              id === 'active' ? 'Active' : id === 'all' ? 'All' : id === 'favorites' ? 'Favorites' : 'Inactive',
            )}</button>`,
        )
        .join('')}
    </div>

    <div class="model-list" id="model-list"></div>`;

  const modal = openModal({
    title: t('Models'),
    subtitle: t('Free OpenRouter models only'),
    iconName: 'cpu',
    body,
    className: 'wide tall',
    footer: `
      <div class="row" style="width:100%;gap:12px">
        <label class="switch" title="${t('Lock actual model')}">
          <input type="checkbox" id="lock-auto" ${state.conversation?.lock_auto_model ?? state.settings.lockAutoModel ? 'checked' : ''} />
          <span class="track"></span>
          <span>${t('Lock actual model')}</span>
        </label>
        <span class="muted tiny-text" style="flex:1;min-width:140px">${t(
          'When openrouter/free resolves to a model, use that model for the rest of this chat.',
        )}</span>
        <button class="btn btn-primary btn-sm" data-action="close-modal">${t('Done')}</button>
      </div>`,
  });

  const listEl = body.querySelector('#model-list');

  function drawList() {
    const list = filterModels();
    if (!list.length) {
      listEl.innerHTML = `<div class="conv-empty">${t(
        'No models match. Sync the catalog or widen the filter.',
      )}</div>`;
      return;
    }
    listEl.innerHTML = list
      .map((m) => {
        const inactive = m.active === false;
        const unavailable = m.available === false;
        const tags = [];
        if (m.context_length) tags.push(`${formatNum(m.context_length)} ctx`);
        const architecture = m.architecture || {};
        if (architecture.input_modalities?.includes('image')) tags.push('vision');
        if (architecture.input_modalities?.includes('audio')) tags.push('audio');
        if ((m.supported_parameters || []).includes('tools')) tags.push('tools');
        if (unavailable) tags.push(t('not in catalog'));
        return `<div class="model-row ${inactive || unavailable ? 'inactive' : ''} ${
          m.model_id === selectedId ? 'selected' : ''
        }" data-model-row="${escapeHtml(m.model_id)}">
          <div class="model-main" data-select-model="${escapeHtml(m.model_id)}">
            <div class="model-name">
              ${escapeHtml(m.name || prettyModel(m.model_id))}
              ${m.model_id === selectedId ? `<span class="badge ok">${t('Selected')}</span>` : ''}
              ${unavailable ? `<span class="badge warn">${t('Unavailable')}</span>` : ''}
            </div>
            <div class="model-id">${escapeHtml(m.model_id)}</div>
            ${m.description ? `<div class="model-desc">${escapeHtml(m.description)}</div>` : ''}
            <div class="model-tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
          </div>
          <div class="model-controls">
            <button class="icon-btn tiny star-btn ${m.favorite ? 'on' : ''}" data-fav-model="${escapeHtml(
              m.model_id,
            )}" title="${t('Favorites')}">${icon('star')}</button>
            <label class="switch" title="${inactive ? t('Inactive') : t('Active')}" style="margin-inline-start:4px">
              <input type="checkbox" data-active-model="${escapeHtml(m.model_id)}" ${inactive ? '' : 'checked'} />
              <span class="track"></span>
            </label>
          </div>
        </div>`;
      })
      .join('');
  }

  drawList();

  // search
  const searchInput = body.querySelector('#model-search');
  searchInput.addEventListener(
    'input',
    debounce(() => {
      searchTerm = searchInput.value;
      drawList();
    }, 140),
  );

  body.querySelectorAll('[data-model-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filter = btn.dataset.modelFilter;
      body.querySelectorAll('[data-model-filter]').forEach((b) => b.classList.remove('is-accent'));
      btn.classList.add('is-accent');
      drawList();
    });
  });

  body.querySelector('#sync-models').addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">${icon('refresh')}</span> ${t('Syncing…')}`;
    await syncFreeModels();
    closeModal();
    openModelPicker();
  });

  body.addEventListener('click', async (event) => {
    const selectEl = event.target.closest('[data-select-model]');
    if (selectEl) {
      await setConversationModel(selectEl.dataset.selectModel);
      closeModal();
      openModelPicker();
      return;
    }
    const favEl = event.target.closest('[data-fav-model]');
    if (favEl) {
      event.preventDefault();
      await toggleModelFavorite(favEl.dataset.favModel);
      closeModal();
      openModelPicker();
    }
  });

  body.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-active-model]');
    if (!input) return;
    await toggleModelActive(input.dataset.activeModel);
    closeModal();
    openModelPicker();
  });

  const lockInput = modal.scrim.querySelector('#lock-auto');
  lockInput?.addEventListener('change', () => {
    toggleAutoLock();
  });
}
