import { store } from './store.js';
import { icon } from './icons.js';
import { escapeHtml, formatNumber } from './utils.js';
import { fetchModels, filterFreeModels, isFreeModel } from './openrouter.js';
import { loadModelsFromDB, saveModelsToDB, updateModel, deactivateModel } from './supabase.js';
import { toast } from './toast.js';

let state = {
  models: [],
  search: '',
  loading: false,
  lastFetchedAt: 0
};

export function renderModelsView(container, modelsById, handlers = {}) {
  state.models = Array.from(modelsById.values());

  container.innerHTML = `
    <header class="topbar">
      <div class="topbar-left">
        <button class="btn btn-ghost btn-icon btn-sm mobile-menu-btn" data-action="back-chat" title="Back">
          ${icon('chevronRight')}
        </button>
        <div>
          <div class="topbar-title">Models</div>
          <div class="topbar-meta">${state.models.length} model${state.models.length === 1 ? '' : 's'} cached</div>
        </div>
      </div>
      <div class="topbar-right">
        <button class="btn btn-sm" data-action="refresh-from-api">
          ${icon('refresh', 'icon-sm')} Refresh from OpenRouter
        </button>
      </div>
    </header>

    <div class="models-page">
      <div class="models-inner">
        <div class="models-header">
          <div>
            <div class="models-title">Free Models</div>
            <div class="models-sub">Only zero-cost models are shown. Cached in Supabase, fetched from OpenRouter on demand.</div>
          </div>
        </div>

        <div class="special-model-card" data-model-id="openrouter/free">
          <div class="special-model-icon">${icon('sparkles', 'icon-lg')}</div>
          <div class="special-model-info">
            <div class="special-model-name">OpenRouter Auto · free</div>
            <div class="special-model-desc">Let OpenRouter choose the best free model for each request. The actual model used is reported in the chat.</div>
          </div>
          <span class="badge badge-free">AUTO</span>
        </div>

        <div class="models-toolbar">
          <div class="models-search">
            <span class="models-search-icon">${icon('search', 'icon-sm')}</span>
            <input type="text" class="input" id="models-search" placeholder="Search models, vendors, tags…">
          </div>
          <span class="dim" style="font-size:12px" id="models-count">${state.models.length} loaded</span>
        </div>

        <div class="models-grid" id="models-grid"></div>
      </div>
    </div>
  `;

  renderModelCards(container, modelsById);

  const searchEl = container.querySelector('#models-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      state.search = searchEl.value.toLowerCase().trim();
      renderModelCards(container, modelsById);
    });
  }

  container.querySelectorAll('[data-model-id="openrouter/free"]').forEach(el => {
    el.addEventListener('click', () => selectModelForActiveChat('openrouter/free', container, modelsById));
  });

  container.querySelector('[data-action="refresh-from-api"]')?.addEventListener('click', async () => {
    await fetchAndStoreModels(container, modelsById, handlers);
  });

  container.querySelector('[data-action="back-chat"]')?.addEventListener('click', () => {
    handlers.onBack?.();
  });
}

function renderModelCards(container, modelsById) {
  const grid = container.querySelector('#models-grid');
  if (!grid) return;

  const filtered = state.models.filter(m => {
    if (!state.search) return true;
    const hay = `${m.id} ${m.label} ${m.vendor} ${m.tags} ${m.note}`.toLowerCase();
    return hay.includes(state.search);
  });

  filtered.sort((a, b) => (a.label || '').localeCompare(b.label || ''));

  const activeChat = store.getActiveChat();
  const activeModel = activeChat?.model || store.getSettings().defaultModel;

  grid.innerHTML = filtered.map(m => {
    const selected = m.id === activeModel;
    const ctx = parseInt(m.context, 10) || 0;
    const isFree = m.is_free !== false;
    return `
      <div class="model-card ${selected ? 'selected' : ''}" data-model-id="${escapeHtml(m.id)}">
        <div class="model-card-check">${icon('check', 'icon-sm')}</div>
        <div class="model-card-head">
          <div style="flex:1;min-width:0">
            <div class="model-card-name">${escapeHtml(m.label || m.id)}</div>
            <div class="model-card-vendor">${escapeHtml(m.vendor || 'unknown')}</div>
          </div>
        </div>
        <div class="model-card-desc">${escapeHtml(m.note || 'No description available')}</div>
        <div class="model-card-foot">
          ${isFree ? '<span class="badge badge-free">FREE</span>' : '<span class="badge badge-paid">PAID</span>'}
          ${ctx ? `<span class="model-card-ctx">${formatNumber(ctx)} ctx</span>` : ''}
          ${m.tags ? String(m.tags).split(',').slice(0, 3).filter(Boolean).map(t => `<span class="badge badge-tag">${escapeHtml(t.trim())}</span>`).join('') : ''}
        </div>
      </div>
    `;
  }).join('') || `<div class="models-empty">No models match your search.</div>`;

  const count = grid.parentElement.querySelector('#models-count');
  if (count) count.textContent = `${filtered.length} shown · ${state.models.length} total`;

  grid.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-model-id');
      selectModelForActiveChat(id, container, modelsById);
    });
  });
}

function selectModelForActiveChat(modelId, container, modelsById) {
  const chat = store.getActiveChat();
  if (chat) {
    store.updateChat(chat.id, { model: modelId, usedModel: null });
    toast({ type: 'success', title: 'Model selected', message: modelId, duration: 2500 });
  } else {
    store.updateSettings({ defaultModel: modelId });
    toast({ type: 'success', title: 'Default model updated', message: modelId, duration: 2500 });
  }
  renderModelCards(container, modelsById);
}

async function fetchAndStoreModels(container, modelsById, handlers) {
  if (state.loading) return;
  state.loading = true;
  const btn = container.querySelector('[data-action="refresh-from-api"]');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon('refresh', 'icon-sm spin')} Fetching…`;

  try {
    const raw = await fetchModels();
    const freeModels = filterFreeModels(raw);
    if (!freeModels.length) {
      toast({ type: 'warning', title: 'No free models found in OpenRouter response' });
      return;
    }

    const existingIds = new Set(Array.from(modelsById.keys()));
    const toSave = freeModels.map(m => ({ ...m, active: true }));

    for (let i = 0; i < toSave.length; i += 50) {
      const batch = toSave.slice(i, i + 50);
      await saveModelsToDB(batch);
    }

    const removedIds = Array.from(existingIds).filter(id => !freeModels.some(m => m.id === id));
    for (const id of removedIds) {
      try { await deactivateModel(id); } catch {}
    }

    const rows = await loadModelsFromDB();
    modelsById.clear();
    for (const r of rows) {
      modelsById.set(r.id, {
        ...r,
        context: parseInt(r.context, 10) || 0,
        is_free: r.is_free !== false
      });
    }
    state.models = Array.from(modelsById.values());
    state.lastFetchedAt = Date.now();

    toast({
      type: 'success',
      title: 'Models synced',
      message: `${freeModels.length} free models loaded from OpenRouter`
    });

    handlers.onChange?.();
    renderModelsView(container, modelsById, handlers);
  } catch (e) {
    const detail = e?.body || e?.message || 'Unknown error';
    toast({
      type: 'error',
      title: 'Failed to sync models',
      message: `${e?.message || 'Error'}${e?.provider ? ' · ' + e.provider : ''}`
    });
    console.error('[fetch-models]', e);
  } finally {
    state.loading = false;
    if (btn.isConnected) {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }
}
